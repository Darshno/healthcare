import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  User,
  Hospital,
  HospitalUnit,
  SyncOperation,
  Patient,
  QueueEntry,
  TeleconsultSession,
  TriageResult,
  ChatMessage,
  Bed,
  BedOccupancy,
  Medicine,
  InventoryTransaction,
} from "./entities";

import { execSync } from "child_process";

const entities = [
  User,
  Hospital,
  HospitalUnit,
  SyncOperation,
  Patient,
  QueueEntry,
  TeleconsultSession,
  TriageResult,
  ChatMessage,
  Bed,
  BedOccupancy,
  Medicine,
  InventoryTransaction,
];

function isDatabaseReachable(): boolean {
  if (!process.env.DATABASE_URL) return false;
  try {
    const url = new URL(process.env.DATABASE_URL);
    const port = parseInt(url.port || "5432", 10);
    const host = url.hostname || "localhost";
    execSync(
      `node -e "require('net').createConnection(${port},'${host}').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"`,
      { timeout: 2000, stdio: "pipe" },
    );
    return true;
  } catch {
    return false;
  }
}

const hasDatabase = isDatabaseReachable();

export function getDatabaseConfig() {
  return {
    type: "postgres" as const,
    url: process.env.DATABASE_URL,
    entities,
    migrations: ["dist/server/database/migrations/*.js"],
    migrationsRun: true,
    synchronize: false,
    logging: process.env.NODE_ENV !== "production",
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  };
}

@Module({
  imports: hasDatabase
    ? [
        TypeOrmModule.forRootAsync({
          useFactory: () => getDatabaseConfig(),
        }),
        TypeOrmModule.forFeature(entities),
      ]
    : [],
  exports: hasDatabase ? [TypeOrmModule] : [],
})
export class DatabaseModule {}
