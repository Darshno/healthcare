import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Bed, BedStatus } from "./bed.entity";

@Entity("bed_occupancy")
export class BedOccupancy {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int" })
  bedId: number;

  @Column({ type: "varchar", length: 128 })
  patientId: string;

  @Column({ type: "enum", enum: ["available", "occupied", "maintenance"] })
  status: BedStatus;

  @Column({ type: "timestamptz" })
  occupiedFrom: Date;

  @Column({ type: "timestamptz", nullable: true })
  occupiedUntil: Date | null;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @Column({ type: "varchar", length: 128, nullable: true })
  recordedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Bed, (bed) => bed.occupancies, { onDelete: "CASCADE" })
  @JoinColumn({ name: "bedId" })
  bed: Bed;
}
