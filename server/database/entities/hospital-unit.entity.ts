import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique, OneToMany } from "typeorm";
import { Hospital } from "./hospital.entity";
import { Bed } from "./bed.entity";

export type UnitType = "general_ward" | "icu" | "icu_pediatric" | "maternity" | "emergency" | "isolation";

@Entity("hospital_units")
@Unique(["hospitalId", "name"])
export class HospitalUnit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int" })
  hospitalId: number;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "enum", enum: ["general_ward", "icu", "icu_pediatric", "maternity", "emergency", "isolation"] })
  type: UnitType;

  @Column({ type: "int" })
  totalBeds: number;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Hospital, (h) => h.units, { onDelete: "CASCADE" })
  @JoinColumn({ name: "hospitalId" })
  hospital: Hospital;

  @OneToMany(() => Bed, (bed) => bed.unit)
  beds: Bed[];
}
