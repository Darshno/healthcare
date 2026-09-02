import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from "typeorm";
import { User } from "./user.entity";
import { Patient } from "./patient.entity";

@Entity("hospitals")
export class Hospital {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "enum", enum: ["en", "hi"], default: "en" })
  language: "en" | "hi";

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => User, (user) => user.hospital)
  users: User[];

  @OneToMany(() => Patient, (patient) => patient.hospital)
  patients: Patient[];
}
