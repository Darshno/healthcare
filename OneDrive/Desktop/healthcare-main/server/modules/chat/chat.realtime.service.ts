import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { EventEmitter } from "events";
import { execSync } from "child_process";

export interface ChatMessagePayload {
  id: number;
  channel: string;
  senderId: string;
  senderName: string;
  senderRole?: string | null;
  senderInitials: string;
  text: string;
  tag?: string | null;
  sentAt: number;
}

const CHANNEL_PREFIX = "chat:messages:";

function isRedisReachable(): boolean {
  if (!process.env.REDIS_URL) return false;
  try {
    const url = new URL(process.env.REDIS_URL);
    const port = parseInt(url.port || "6379", 10);
    const host = url.hostname || "localhost";
    execSync(
      `node -e "require('net').createConnection(${port},'${host}').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"`,
      { timeout: 2000, stdio: "pipe" },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Real-time bus for chat messages.
 *
 * When Redis is configured and reachable it uses Redis pub/sub so multiple
 * server instances stay in sync, otherwise it falls back to an in-process
 * EventEmitter (single-instance behaviour). Mirrors QueueRealtimeService.
 */
@Injectable()
export class ChatRealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatRealtimeService.name);
  private readonly emitter = new EventEmitter();
  private publisher: any = null;
  private subscriber: any = null;
  private subscribedChannels = new Set<string>();

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl || !isRedisReachable()) {
      this.logger.log("ChatRealtimeService: no reachable Redis — using in-process event bus");
      return;
    }
    try {
      const Redis = (await import("ioredis")).default;
      const opts = {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // don't retry endlessly if dropped
      };
      this.publisher = new Redis(redisUrl, opts);
      this.subscriber = new Redis(redisUrl, opts);
      this.publisher.on("error", (err: Error) => {
        this.logger.warn(`ChatRealtimeService publisher error: ${err.message}`);
      });
      this.subscriber.on("error", (err: Error) => {
        this.logger.warn(`ChatRealtimeService subscriber error: ${err.message}`);
      });
      this.logger.log("ChatRealtimeService: Redis pub/sub active");
    } catch (error) {
      this.logger.warn(`ChatRealtimeService: Redis unavailable (${error instanceof Error ? error.message : error}) — using in-process event bus`);
      this.publisher = null;
      this.subscriber = null;
    }
  }

  channel(channel: string): string {
    return `${CHANNEL_PREFIX}${channel}`;
  }

  async publish(message: ChatMessagePayload) {
    const raw = JSON.stringify(message);
    const channel = this.channel(message.channel);
    this.emitter.emit(channel, raw);
    if (this.publisher) {
      try {
        await this.publisher.publish(channel, raw);
      } catch (error) {
        this.logger.warn(`Failed to publish chat event: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  subscribe(channel: string, handler: (message: ChatMessagePayload) => void): () => void {
    const key = this.channel(channel);
    const onMessage = (raw: string) => {
      try {
        handler(JSON.parse(raw) as ChatMessagePayload);
      } catch {
        /* ignore malformed */
      }
    };
    const localListener = (raw: string) => onMessage(raw);

    this.emitter.on(key, localListener);
    if (this.subscriber && !this.subscribedChannels.has(key)) {
      this.subscribedChannels.add(key);
      this.subscriber.subscribe(key);
      this.subscriber.on("message", (ch: string, message: string) => {
        if (ch === key) onMessage(message);
      });
    }

    return () => {
      this.emitter.off(key, localListener);
    };
  }

  async onModuleDestroy() {
    if (this.subscriber) {
      try { await this.subscriber.quit(); } catch { /* noop */ }
    }
    if (this.publisher) {
      try { await this.publisher.quit(); } catch { /* noop */ }
    }
    this.emitter.removeAllListeners();
  }
}
