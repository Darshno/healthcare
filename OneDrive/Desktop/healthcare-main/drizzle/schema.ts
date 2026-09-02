import { integer, pgEnum, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const defaultLanguageEnum = pgEnum("defaultLanguage", ["en", "hi"]);
export const staffRoleEnum = pgEnum("staffRole", ["registration", "nurse", "clinician", "pharmacy", "referral", "manager", "supervisor"]);

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const facilities = pgTable("facilities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  defaultLanguage: defaultLanguageEnum("defaultLanguage").default("en").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const facilityMemberships = pgTable("facility_memberships", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId").notNull(),
  facilityId: integer("facilityId").notNull(),
  staffRole: staffRoleEnum("staffRole").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("facilityMembership_user_facility_role").on(table.userId, table.facilityId, table.staffRole)]);

export const syncOperations = pgTable("sync_operations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  operationId: varchar("operationId", { length: 128 }).notNull().unique(),
  userId: integer("userId").notNull(),
  facilityId: integer("facilityId"),
  operationType: varchar("operationType", { length: 96 }).notNull(),
  entityId: varchar("entityId", { length: 128 }).notNull(),
  payload: text("payload"),
  clientCreatedAt: timestamp("clientCreatedAt").notNull(),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
});

export const bedStatusEnum = pgEnum("bedStatus", ["available", "occupied", "maintenance", "reserved"]);

export const hospitalUnits = pgTable("hospital_units", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  facilityId: integer("facilityId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  totalBeds: integer("totalBeds").notNull(),
  occupiedBeds: integer("occupiedBeds").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const beds = pgTable("beds", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  unitId: integer("unitId").notNull(),
  facilityId: integer("facilityId").notNull(),
  bedNumber: varchar("bedNumber", { length: 64 }).notNull(),
  status: bedStatusEnum("status").default("available").notNull(),
  patientId: varchar("patientId", { length: 128 }),
  occupiedSince: timestamp("occupiedSince"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const facilityLocations = pgTable("facility_locations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  facilityId: integer("facilityId").notNull().unique(),
  latitude: varchar("latitude", { length: 64 }).notNull(),
  longitude: varchar("longitude", { length: 64 }).notNull(),
  address: text("address").notNull(),
  phoneNumber: varchar("phoneNumber", { length: 20 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Facility = typeof facilities.$inferSelect;
export type FacilityMembership = typeof facilityMemberships.$inferSelect;
export type SyncOperation = typeof syncOperations.$inferSelect;
export type HospitalUnit = typeof hospitalUnits.$inferSelect;
export type Bed = typeof beds.$inferSelect;
export type FacilityLocation = typeof facilityLocations.$inferSelect;
