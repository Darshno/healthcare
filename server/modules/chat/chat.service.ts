import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThan, type FindOptionsWhere } from "typeorm";
import { ChatMessage, ChatTag } from "../../database/entities";
import { ChatRealtimeService, ChatMessagePayload } from "./chat.realtime.service";

export interface SendChatMessageInput {
  channel: string;
  senderId: string;
  senderName: string;
  senderRole?: string | null;
  senderInitials: string;
  text: string;
  tag?: ChatTag | null;
}

const HISTORY_LIMIT = 200;

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly repo: Repository<ChatMessage>,
    private readonly realtime: ChatRealtimeService,
  ) {}

  async send(input: SendChatMessageInput): Promise<ChatMessage> {
    const saved = await this.repo.save(
      this.repo.create({
        channel: input.channel,
        senderId: input.senderId,
        senderName: input.senderName,
        senderRole: input.senderRole ?? null,
        senderInitials: input.senderInitials,
        text: input.text,
        tag: input.tag ?? null,
      }),
    );

    const payload: ChatMessagePayload = {
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

    // Broadcast best-effort; never fail the request if pub/sub fails.
    await this.realtime.publish(payload).catch(() => undefined);

    return saved;
  }

  async history(
    channel: string,
    opts: { beforeId?: number; limit?: number } = {},
  ): Promise<ChatMessage[]> {
    const limit = Math.min(Math.max(opts.limit ?? HISTORY_LIMIT, 1), HISTORY_LIMIT);
    const where: FindOptionsWhere<ChatMessage> = {
      channel,
      ...(opts.beforeId ? { id: MoreThan(opts.beforeId) } : {}),
    };

    let rows = await this.repo.find({
      where,
      order: { id: "DESC" },
      take: limit,
    });
    rows = rows.reverse();
    return rows;
  }
}
