import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { EventEmitter } from "events";

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
    if (!redisUrl) {
      this.logger.log("ChatRealtimeService: no Redis — using in-process event bus");
      return;
    }
    try {
      const Redis = (await import("ioredis")).default;
      this.publisher = new Redis(redisUrl);
      this.subscriber = new Redis(redisUrl);
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
