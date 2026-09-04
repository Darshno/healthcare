import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique, OneToMany } from "typeorm";
import { HospitalUnit } from "./hospital-unit.entity";
import { BedOccupancy } from "./bed-occupancy.entity";

export type BedStatus = "available" | "occupied" | "maintenance";

@Entity("beds")
@Unique(["unitId", "bedNumber"])
export class Bed {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int" })
  unitId: number;

  @Column({ type: "varchar", length: 50 })
  bedNumber: string;

  @Column({ type: "enum", enum: ["available", "occupied", "maintenance"], default: "available" })
  status: BedStatus;

  @Column({ type: "varchar", length: 128, nullable: true })
  occupiedByPatientId: string | null;

  @Column({ type: "timestamptz", nullable: true })
  occupiedSince: Date | null;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @Column({ type: "int", default: 1 })
  version: number;

  @Column({ type: "varchar", length: 128, nullable: true })
  deviceId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;


  @ManyToOne(() => HospitalUnit, (u) => u.beds, { onDelete: "CASCADE" })
  @JoinColumn({ name: "unitId" })
  unit: HospitalUnit;

  @OneToMany(() => BedOccupancy, (occ) => occ.bed)
  occupancies: BedOccupancy[];
}
