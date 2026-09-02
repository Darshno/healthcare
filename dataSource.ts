import "dotenv/config";
import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "./server/database/entities/user.entity";
import { Hospital } from "./server/database/entities/hospital.entity";
import { SyncOperation } from "./server/database/entities/sync-operation.entity";
import { Patient } from "./server/database/entities/patient.entity";
import { QueueEntry } from "./server/database/entities/queue-entry.entity";
import { TeleconsultSession } from "./server/database/entities/teleconsult-session.entity";
import { TriageResult } from "./server/database/entities/triage-result.entity";
import { ChatMessage } from "./server/database/entities/chat-message.entity";

export default new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [
    User,
    Hospital,
    SyncOperation,
    Patient,
    QueueEntry,
    TeleconsultSession,
    TriageResult,
    ChatMessage,
  ],
  migrations: ["dist/server/database/migrations/*.js"],
  migrationsRun: true,
  synchronize: false,
  logging: process.env.NODE_ENV !== "production",
});
