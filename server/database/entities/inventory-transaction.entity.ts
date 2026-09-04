import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Medicine } from "./medicine.entity";
import { User } from "./user.entity";

export type TransactionType = "restock" | "dispense" | "adjustment";

@Entity("inventory_transactions")
export class InventoryTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int" })
  medicineId: number;

  @Column({ type: "enum", enum: ["restock", "dispense", "adjustment"] })
  type: TransactionType;

  @Column({ type: "int" })
  quantity: number;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @Column({ type: "int" })
  recordedById: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Medicine, { onDelete: "CASCADE" })
  @JoinColumn({ name: "medicineId" })
  medicine: Medicine;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "recordedById" })
  recordedBy: User;
}
