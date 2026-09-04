import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity("audit_logs")
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 128 })
  entity: string;

  @Column({ type: "varchar", length: 128 })
  entityId: string;

  @Column({ type: "varchar", length: 64 })
  action: string;

  @Column({ type: "varchar", length: 128, nullable: true })
  user: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  role: string | null;

  @Column({ type: "text", nullable: true })
  details: string | null;

  @CreateDateColumn()
  timestamp: Date;
}
