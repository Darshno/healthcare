import { integer, pgEnum, pgTable, text, timestamp, uniqueIndex, varchar, boolean } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["chief_doc", "doctor", "asha", "receptionist", "admin"]);
export const defaultLanguageEnum = pgEnum("defaultLanguage", ["en", "hi"]);
export const staffRoleEnum = pgEnum("staffRole", ["registration", "nurse", "clinician", "pharmacy", "referral", "manager", "supervisor"]);

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("doctor").notNull(),
  hospitalId: integer("hospitalId").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const hospitals = pgTable("hospitals", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  language: defaultLanguageEnum("language").default("en").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Hospital = typeof hospitals.$inferSelect;
export type InsertHospital = typeof hospitals.$inferInsert;

export const syncOperations = pgTable("sync_operations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  operationId: varchar("operationId", { length: 128 }).notNull().unique(),
  userId: integer("userId").notNull(),
  hospitalId: integer("hospitalId"),
  operationType: varchar("operationType", { length: 96 }).notNull(),
  entityId: varchar("entityId", { length: 128 }).notNull(),
  payload: text("payload"),
  clientCreatedAt: timestamp("clientCreatedAt").notNull(),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
});

export const bedStatusEnum = pgEnum("bedStatus", ["available", "occupied", "maintenance"]);
export const unitTypeEnum = pgEnum("unitType", ["general_ward", "icu", "icu_pediatric", "maternity", "emergency", "isolation"]);

/**
 * Hospital Units (e.g., ICU, General Ward, Maternity)
 */
export const hospitalUnits = pgTable("hospital_units", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  hospitalId: integer("hospitalId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: unitTypeEnum("type").notNull(),
  totalBeds: integer("totalBeds").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("hospital_units_name").on(table.hospitalId, table.name)]);

/**
 * Individual Beds in Hospital Units
 */
export const beds = pgTable("beds", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  unitId: integer("unitId").notNull(),
  bedNumber: varchar("bedNumber", { length: 50 }).notNull(),
  status: bedStatusEnum("status").default("available").notNull(),
  occupiedByPatientId: varchar("occupiedByPatientId", { length: 128 }),
  occupiedSince: timestamp("occupiedSince"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("beds_unit_number").on(table.unitId, table.bedNumber)]);

/**
 * Bed Occupancy History/Transactions
 */
export const bedOccupancy = pgTable("bed_occupancy", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  bedId: integer("bedId").notNull(),
  patientId: varchar("patientId", { length: 128 }).notNull(),
  status: bedStatusEnum("status").notNull(),
  occupiedFrom: timestamp("occupiedFrom").notNull(),
  occupiedUntil: timestamp("occupiedUntil"),
  notes: text("notes"),
  recordedBy: varchar("recordedBy", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const medicines = pgTable("medicines", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  localName: varchar("localName", { length: 255 }),
  category: varchar("category", { length: 64 }).notNull(),
  unit: varchar("unit", { length: 32 }).notNull(),
  minimumStock: integer("minimumStock").default(0).notNull(),
  isGovtSupply: boolean("isGovtSupply").default(true).notNull(),
  pricePerUnit: integer("pricePerUnit").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type HospitalUnit = typeof hospitalUnits.$inferSelect;
export type InsertHospitalUnit = typeof hospitalUnits.$inferInsert;
export type Bed = typeof beds.$inferSelect;
export type InsertBed = typeof beds.$inferInsert;
export type BedOccupancy = typeof bedOccupancy.$inferSelect;
export type InsertBedOccupancy = typeof bedOccupancy.$inferInsert;
export type SyncOperation = typeof syncOperations.$inferSelect;
