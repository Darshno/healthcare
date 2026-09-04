import "dotenv/config";
import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "./server/database/entities/user.entity";
import { Hospital } from "./server/database/entities/hospital.entity";
import { HospitalUnit } from "./server/database/entities/hospital-unit.entity";
import { SyncOperation } from "./server/database/entities/sync-operation.entity";
import { Patient } from "./server/database/entities/patient.entity";
import { QueueEntry } from "./server/database/entities/queue-entry.entity";
import { TeleconsultSession } from "./server/database/entities/teleconsult-session.entity";
import { TriageResult } from "./server/database/entities/triage-result.entity";
import { ChatMessage } from "./server/database/entities/chat-message.entity";
import { Bed } from "./server/database/entities/bed.entity";
import { BedOccupancy } from "./server/database/entities/bed-occupancy.entity";
import { Medicine } from "./server/database/entities/medicine.entity";
import { InventoryTransaction } from "./server/database/entities/inventory-transaction.entity";

export default new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [
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
  ],
  migrations: ["dist/server/database/migrations/*.js"],
  migrationsRun: true,
  synchronize: false,
  logging: process.env.NODE_ENV !== "production",
});
