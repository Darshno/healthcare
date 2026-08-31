import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Res,
  Logger,
  HttpCode,
  BadRequestException,
} from "@nestjs/common";
import { Response } from "express";
import { ChatService } from "./chat.service";
import { ChatRealtimeService } from "./chat.realtime.service";

const HISTORY_LIMIT = 200;

@Controller("api/chat")
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly chat: ChatService,
    private readonly realtime: ChatRealtimeService,
  ) {}

  @Post("messages")
  @HttpCode(200)
  async send(
    @Body()
    body: {
      channel?: string;
      senderId: string;
      senderName: string;
      senderRole?: string;
      senderInitials: string;
      text: string;
      tag?: "urgent" | "referral" | "medicine" | "general";
    },
  ) {
    const text = (body.text ?? "").trim();
    if (!text) {
      throw new BadRequestException("Message text must not be empty");
    }
    const senderName = (body.senderName ?? "").trim();
    if (!senderName) {
      throw new BadRequestException("senderName is required");
    }

    const saved = await this.chat.send({
      channel: body.channel || "clinical-staff",
      senderId: body.senderId || "anon",
      senderName,
      senderRole: body.senderRole,
      senderInitials: (body.senderInitials || senderName.slice(0, 2).toUpperCase() || "HW"),
      text,
      tag: body.tag ?? null,
    });

    return {
      id: saved.id,
      channel: saved.channel,
      senderId: saved.senderId,
      senderName: saved.senderName,
      senderRole: saved.senderRole,
      senderInitials: saved.senderInitials,
      text: saved.text,
      tag: saved.tag,
      sentAt: saved.sentAt.getTime(),
    };
  }

  @Get("messages")
  async history(
    @Query("channel") channel?: string,
    @Query("afterId") afterId?: string,
    @Query("limit") limit?: string,
  ) {
    return this.chat.history(channel || "clinical-staff", {
      beforeId: afterId ? Number(afterId) : undefined,
      limit: limit ? Number(limit) : HISTORY_LIMIT,
    });
  }

  /**
   * Server-Sent Events stream of live chat messages for a channel.
   * Emits any messages newer than `afterId` first, then each new message.
   */
  @Get("events")
  async stream(
    @Query("channel") channel?: string,
    @Query("afterId") afterId?: string,
    @Res() res?: Response,
  ) {
    if (!res) return;
    const room = channel || "clinical-staff";
    const after = afterId ? Number(afterId) : 0;

    res.status(200).set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Catch up any messages that landed between the history fetch and stream open.
    try {
      const missed = await this.chat.history(room, {
        beforeId: after || undefined,
        limit: HISTORY_LIMIT,
      });
      for (const msg of missed) {
        if (msg.id > after) {
          send("chat.message", {
            id: msg.id,
            channel: msg.channel,
            senderId: msg.senderId,
            senderName: msg.senderName,
            senderRole: msg.senderRole,
            senderInitials: msg.senderInitials,
            text: msg.text,
            tag: msg.tag,
            sentAt: msg.sentAt.getTime(),
          });
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to catch up chat history: ${error instanceof Error ? error.message : error}`);
    }

    const unsubscribe = this.realtime.subscribe(room, (message) => {
      send("chat.message", message);
    });

    const heartbeat = setInterval(() => {
      res.write(": ping\n\n");
    }, 25000);

    res.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  }
}
