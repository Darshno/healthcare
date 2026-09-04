/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type {
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
  SyncConflict,
  AuditLog,
} from "../server/database/entities";

export * from "./_core/errors";
