import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";

@Entity("sync_operations")
export class SyncOperation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 128, unique: true })
  operationId: string;

  @Column({ type: "int" })
  userId: number;

  @Column({ type: "int", nullable: true })
  hospitalId: number | null;

  @Column({ type: "varchar", length: 96 })
  operationType: string;

  @Column({ type: "varchar", length: 128 })
  entityId: string;

  @Column({ type: "varchar", length: 128, nullable: true })
  deviceId: string | null;

  @Column({ type: "int", default: 1 })
  version: number;

  @Column({ type: "text", nullable: true })
  payload: string | null;

  @Column({ type: "timestamptz" })
  clientCreatedAt: Date;

  @CreateDateColumn()
  receivedAt: Date;

  @ManyToOne(() => User, (u) => u.syncOperations, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;
}

