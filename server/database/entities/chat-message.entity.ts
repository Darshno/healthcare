import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

export type ChatTag = "urgent" | "referral" | "medicine" | "general";

@Entity("chat_messages")
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: "varchar", length: 64 })
  channel: string;

  @Column({ type: "varchar", length: 64 })
  senderId: string;

  @Column({ type: "varchar", length: 255 })
  senderName: string;

  @Column({ type: "varchar", length: 128, nullable: true })
  senderRole: string | null;

  @Column({ type: "varchar", length: 16 })
  senderInitials: string;

  @Column({ type: "text" })
  text: string;

  @Column({
    type: "enum",
    enum: ["urgent", "referral", "medicine", "general"],
    nullable: true,
  })
  tag: ChatTag | null;

  @CreateDateColumn()
  sentAt: Date;
}
