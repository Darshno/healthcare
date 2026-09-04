import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity("sync_conflicts")
export class SyncConflict {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 128 })
  operationId: string;

  @Column({ type: "varchar", length: 128, nullable: true })
  deviceId: string | null;

  @Column({ type: "varchar", length: 128 })
  entityId: string;

  @Column({ type: "text" })
  reason: string;

  @Column({ type: "text", nullable: true })
  clientPayload: string | null;

  @Column({ type: "text", nullable: true })
  serverState: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
