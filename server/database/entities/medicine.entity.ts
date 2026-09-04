import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("medicines")
export class Medicine {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  localName: string | null;

  @Column({ type: "varchar", length: 64 })
  category: string;

  @Column({ type: "varchar", length: 32 })
  unit: string;

  @Column({ type: "int", default: 0 })
  minimumStock: number;

  @Column({ type: "boolean", default: true })
  isGovtSupply: boolean;

  @Column({ type: "int", default: 0 })
  pricePerUnit: number;

  @Column({ type: "int", default: 0 })
  stock: number;

  @Column({ type: "int", default: 1 })
  version: number;

  @Column({ type: "varchar", length: 128, nullable: true })
  deviceId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @CreateDateColumn()
  updatedAt: Date;

}
