import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiBaseUrl } from "@/constants/oauth";
import { useDoctorAuth } from "./DoctorAuthContext";

export type ChatTag = "urgent" | "referral" | "medicine" | "general";

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  senderInitials: string;
  text: string;
  timestamp: number;
  tag?: ChatTag;
};

export type ChatConnectionState = "idle" | "connecting" | "open" | "reconnecting" | "error";

type ServerMessage = {
  id: number;
  channel: string;
  senderId: string;
  senderName: string;
  senderRole?: string | null;
  senderInitials: string;
  text: string;
  tag?: ChatTag | null;
  sentAt: number;
};

const HISTORY_KEY = "rural-health-access.chat-server-cache.v1";

function toClient(m: ServerMessage): ChatMessage {
  return {
    id: `server-${m.id}`,
    senderId: m.senderId,
    senderName: m.senderName,
    senderRole: m.senderRole ?? undefined,
    senderInitials: m.senderInitials,
    text: m.text,
    timestamp: m.sentAt,
    tag: m.tag ?? undefined,
  };
}

function parseBlock(block: string): { event: string; data: string } {
  let event = "";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith(":")) continue;
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  return { event, data: data.join("\n") };
}

type MergedState = {
  messages: ChatMessage[];
  lastServerId: number;
};

function mergeIncoming(
  state: MergedState,
  incoming: ChatMessage[],
): MergedState {
  const next = [...state.messages];
  for (const msg of incoming) {
    // Ignore optimistic duplicates and anything already present.
    if (next.some((m) => m.id === msg.id)) continue;
    if (next.some((m) => m.id.replace(/^server-/, "") === msg.id.replace(/^server-/, ""))) continue;
    next.push(msg);
  }
  next.sort((a, b) => a.timestamp - b.timestamp);
  const lastServerId = Math.max(
    state.lastServerId,
    ...next
      .map((m) => Number(m.id.replace(/^server-/, "")))
      .filter((n) => Number.isFinite(n) && n > 0),
    0,
  );
  return { messages: next, lastServerId };
}

/**
 * Server-backed real-time chat.
 *
 * Persists and streams messages through the API (SSE). It degrades to a
 * local-only store when the API is unreachable so the demo still works
 * offline, and re-syncs from the server the next time a connection is made.
 */
export function useChatRealtime(channel = "clinical-staff") {
  const { doctor } = useDoctorAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [connectionState, setConnectionState] = useState<ChatConnectionState>("idle");
  const [error, setError] = useState<string | null>(null);

  const stateRef = useRef<MergedState>({ messages: [], lastServerId: 0 });
  const channelRef = useRef(channel);
  const serverMessagesTracked = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  const apply = useCallback((incoming: ChatMessage[]) => {
    const next = mergeIncoming(stateRef.current, incoming);
    stateRef.current = next;
    setMessages(next.messages);
  }, []);

  // Initial history: prefer server, fall back to local cache so offline is usable.
  useEffect(() => {
    channelRef.current = channel;
    let cancelled = false;

    async function loadInitial() {
      apply([]); // reset
      const baseUrl = getApiBaseUrl();

      try {
        if (Platform.OS === "web" && baseUrl) {
          const res = await fetch(`${baseUrl}/api/chat/messages?channel=${encodeURIComponent(channel)}&limit=200`);
          if (res.ok) {
            const data = (await res.json()) as ServerMessage[];
            apply(data.map(toClient));
            serverMessagesTracked.current = true;
          }
        }
      } catch (e) {
        console.error("[Chat] Failed to load server history", e);
      }

      // Seed from local cache for anything not on the server (kept as fallback).
      if (!serverMessagesTracked.current) {
        try {
          const raw = await AsyncStorage.getItem(HISTORY_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as ChatMessage[];
            if (Array.isArray(parsed)) apply(parsed);
          }
        } catch {
          /* ignore */
        }
      }

      if (!cancelled) setLoaded(true);
    }

    void loadInitial();

    return () => {
      cancelled = true;
    };
  }, [channel, apply]);

  // SSE subscription for live updates from other users.
  useEffect(() => {
    if (Platform.OS !== "web") {
      setConnectionState("idle");
      return;
    }

    const baseUrl = getApiBaseUrl();
    if (!baseUrl) {
      setConnectionState("idle");
      return;
    }

    let cancelled = false;
    let attempt = 0;
    let retryTimer: number | null = null;
    let controller: AbortController | null = null;

    const connect = async () => {
      if (cancelled) return;
      controller?.abort();
      const next = new AbortController();
      controller = next;

      setConnectionState(attempt === 0 ? "connecting" : "reconnecting");
      setError(null);

      const afterId = stateRef.current.lastServerId || 0;
      const url = `${baseUrl}/api/chat/events?channel=${encodeURIComponent(channelRef.current)}&afterId=${afterId}`;

      try {
        const response = await fetch(url, {
          credentials: "include",
          signal: next.signal,
        });

        if (!response.ok || !response.body || !response.body.getReader) {
          throw new Error(response.ok ? "Streaming not supported" : `Chat stream rejected (${response.status})`);
        }

        attempt = 0;
        setConnectionState("open");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let boundary = buffer.indexOf("\n\n");
          while (boundary !== -1) {
            const block = buffer.slice(0, boundary).trim();
            buffer = buffer.slice(boundary + 2);
            if (block) {
              const { event: ev, data } = parseBlock(block);
              if (ev === "chat.message" && data) {
                try {
                  apply([toClient(JSON.parse(data) as ServerMessage)]);
                } catch {
                  /* ignore */
                }
              }
            }
            boundary = buffer.indexOf("\n\n");
          }
        }
      } catch (err: unknown) {
        if (next.signal.aborted || cancelled) return;
        setError(err instanceof Error ? err.message : "Chat connection failed");
      }

      if (cancelled) return;
      setConnectionState("reconnecting");
      attempt += 1;
      retryTimer = setTimeout(connect, Math.min(1000 * 2 ** Math.min(attempt - 1, 4), 15000)) as unknown as number;
    };

    void connect();

    return () => {
      cancelled = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      controller?.abort();
    };
  }, [apply]);

  // Persist merged state to local cache as a resilience fallback.
  useEffect(() => {
    if (!loaded) return;
    if (!serverMessagesTracked.current) return;
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(stateRef.current.messages)).catch(() => {
      /* ignore */
    });
  }, [messages, loaded]);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const send = useCallback(
    async (input: { text: string; tag?: ChatTag }) => {
      if (!doctor) return;
      const text = input.text.trim();
      if (!text) return;

      const optimistic: ChatMessage = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        senderId: doctor.id,
        senderName: doctor.name,
        senderRole: doctor.specialization,
        senderInitials:
          doctor.name.replace(/^Dr\.\s*/i, "").trim().slice(0, 2).toUpperCase() || "HW",
        text,
        timestamp: Date.now(),
        tag: input.tag,
      };

      // Add optimistically so the sender sees it instantly.
      apply([optimistic]);

      const baseUrl = getApiBaseUrl();
      if (Platform.OS === "web" && baseUrl) {
        try {
          const res = await fetch(`${baseUrl}/api/chat/messages?channel=${encodeURIComponent(channelRef.current)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              channel: channelRef.current,
              senderId: doctor.id,
              senderName: doctor.name,
              senderRole: doctor.specialization,
              senderInitials:
                doctor.name.replace(/^Dr\.\s*/i, "").trim().slice(0, 2).toUpperCase() || "HW",
              text,
              tag: input.tag ?? null,
            }),
          });
          if (res.ok) {
            const saved = (await res.json()) as ServerMessage;
            // Replace the optimistic copy with the authoritative server message.
            const next = stateRef.current.messages.filter(
              (m) => m.id !== optimistic.id && m.text !== saved.text,
            );
            const merged = mergeIncoming({ ...stateRef.current, messages: next }, [toClient(saved)]);
            stateRef.current = merged;
            setMessages(merged.messages);
          }
        } catch (err) {
          console.error("[Chat] Failed to send message to server", err);
        }
      } else {
        // Offline / native fallback keeps the local copy.
        try {
          const raw = await AsyncStorage.getItem(HISTORY_KEY);
          const parsed = raw ? (JSON.parse(raw) as ChatMessage[]) : [];
          await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify([...parsed, optimistic]));
        } catch {
          /* ignore */
        }
      }

      return optimistic;
    },
    [doctor, apply],
  );

  return { messages, loaded, connectionState, error, send };
}
