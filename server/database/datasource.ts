/**
 * Provides a lazily-initialised TypeORM DataSource for use in tRPC routers.
 * This is separate from the NestJS TypeOrmModule because tRPC routers run
 * outside of the NestJS DI container (they're plain functions).
 *
 * Returns null when no database is configured so the app can run
 * without a database (demo / offline dev mode).
 */
import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "./entities/user.entity";
import { Hospital } from "./entities/hospital.entity";
import { HospitalUnit } from "./entities/hospital-unit.entity";
import { SyncOperation } from "./entities/sync-operation.entity";
import { Patient } from "./entities/patient.entity";
import { QueueEntry } from "./entities/queue-entry.entity";
import { TeleconsultSession } from "./entities/teleconsult-session.entity";
import { TriageResult } from "./entities/triage-result.entity";
import { ChatMessage } from "./entities/chat-message.entity";
import { Bed } from "./entities/bed.entity";
import { BedOccupancy } from "./entities/bed-occupancy.entity";
import { Medicine } from "./entities/medicine.entity";
import { InventoryTransaction } from "./entities/inventory-transaction.entity";
import { SyncConflict } from "./entities/sync-conflict.entity";
import { AuditLog } from "./entities/audit-log.entity";

const entities = [
  User, Hospital, HospitalUnit, SyncOperation, Patient, QueueEntry,
  TeleconsultSession, TriageResult, ChatMessage, Bed, BedOccupancy,
  Medicine, InventoryTransaction, SyncConflict, AuditLog,
];


let _ds: DataSource | null = null;

export async function getDataSource(): Promise<DataSource | null> {
  if (!process.env.DATABASE_URL) return null;

  if (_ds && _ds.isInitialized) return _ds;

  try {
    _ds = new DataSource({
      type: "postgres",
      url: process.env.DATABASE_URL,
      entities,
      migrations: ["dist/server/database/migrations/*.js"],
      migrationsRun: true,
      synchronize: false,
      logging: process.env.NODE_ENV !== "production",
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
    });

    await _ds.initialize();
    return _ds;
  } catch (error) {
    console.warn("[DataSource] Failed to connect:", error);
    _ds = null;
    return null;
  }
}
