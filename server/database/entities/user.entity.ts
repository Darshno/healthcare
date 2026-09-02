import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { SyncOperation } from "./sync-operation.entity";
import { Hospital } from "./hospital.entity";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 64, unique: true })
  openId: string;

  @Column({ type: "text", nullable: true })
  name: string | null;

  @Column({ type: "varchar", length: 320, nullable: true })
  email: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  loginMethod: string | null;

  @Column({ type: "enum", enum: ["chief_doc", "doctor", "asha", "receptionist", "admin"], default: "doctor" })
  role: "chief_doc" | "doctor" | "asha" | "receptionist" | "admin";

  @Column({ type: "int" })
  hospitalId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: "timestamptz", default: () => "NOW()" })
  lastSignedIn: Date;

  @ManyToOne(() => Hospital, (h) => h.users, { onDelete: "SET NULL" })
  @JoinColumn({ name: "hospitalId" })
  hospital: Hospital;

  @OneToMany(() => SyncOperation, (so) => so.user)
  syncOperations: SyncOperation[];
}
