import type {
  TriagePriority,
  TriagePriorityReason,
  TriageFlagInput,
} from "@/shared/triage";

export type AppLanguage = "en" | "hi";

export type SyncState = "synced" | "pending" | "conflict";
export type Priority = TriagePriority;
export type PriorityReason = TriagePriorityReason;
export type CareTag = "maternal" | "child" | "chronic" | "general";
export type QueueStatus = "waiting" | "called" | "consulting" | "pharmacy" | "completed" | "paused";
export type ReferralStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "awaitingTransport"
  | "inTransit"
  | "arrived"
  | "completed"
  | "followUpOverdue";
export type InventoryTransactionType = "receipt" | "dispense" | "adjustment" | "wastage" | "expiry";

export type Patient = {
  id: string;
  facilityId: string;
  localId: string;
  name: string;
  age: number;
  sex: "female" | "male" | "other";
  contact?: string;
  disease?: string;
  abhaId?: string;
  address?: string;
  bloodGroup?: string;
  careTags: CareTag[];
  allergies: string[];
  currentMedicines: string[];
  syncState: SyncState;
  updatedAt: number;
};

export type QueueEntry = {
  id: string;
  facilityId: string;
  patientId: string;
  service: string;
  arrivedAt: number;
  priority: Priority;
  priorityReason: PriorityReason;
  status: QueueStatus;
  overrideReason?: string;
  tokenNumber?: number;
  roomNumber?: string;
  doctorName?: string;
  doctorId?: string;
  specialty?: string;
  syncState: SyncState;
};

export type Encounter = {
  id: string;
  facilityId: string;
  patientId: string;
  type: "triage" | "consultation" | "followUp";
  doctorName?: string;
  diagnosis?: string;
  prescriptions?: string[];
  note: string;
  createdAt: number;
  syncState: SyncState;
};

export type Referral = {
  id: string;
  facilityId: string;
  patientId: string;
  destination: string;
  reason: string;
  urgency: Priority;
  status: ReferralStatus;
  createdAt: number;
  updatedAt: number;
  syncState: SyncState;
};

export type Medicine = {
  id: string;
  facilityId: string;
  name: string;
  localName: string;
  category?: "antibiotic" | "analgesic" | "maternal" | "chronic" | "pediatric" | "general";
  unit: string;
  stock: number;
  minimumStock: number;
  expiryDays: number;
  isGovtSupply?: boolean;
  pricePerUnit?: number;
  lastSyncedAt: number;
  syncState: SyncState;
};

export type InventoryTransaction = {
  id: string;
  medicineId: string;
  type: InventoryTransactionType;
  quantity: number;
  createdAt: number;
  syncState: SyncState;
};

export type OfflineOperation = {
  id: string;
  type: string;
  entityId: string;
  createdAt: number;
};

export type PriorityInput = TriageFlagInput;

// ─── Hospitals & Doctor Directory Types ────────────────────────────────────────

export type HospitalDoctor = {
  id: string;
  name: string;
  qualification: string;
  specialization: string;
  experience: string;
  opdTimings: string;
  availableDays: string[];
  isAvailableToday: boolean;
  phone?: string;
  rating?: number;
};

export type HospitalFacility = {
  id: string;
  name: string;
  type: "PHC (Primary Health Centre)" | "CHC (Community Health Centre)" | "District Civil Hospital" | "Sub-Centre";
  address: string;
  distanceKm: number;
  phone: string;
  emergencyHotline: string;
  ambulanceAvailable: boolean;
  totalBeds: number;
  availableBeds: number;
  icuBedsAvailable: number;
  facilities: string[];
  doctors: HospitalDoctor[];
};

// ─── Appointment Types ─────────────────────────────────────────────────────────

export type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "emergency_dispatched";

export type Appointment = {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  facilityId: string;
  facilityName: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  date: string;
  timeSlot: string;
  reason: string;
  isEmergency: boolean;
  emergencySeverity?: "critical" | "severe" | "moderate";
  status: AppointmentStatus;
  createdAt: number;
  notes?: string;
};

// ─── Medicine Order Types ──────────────────────────────────────────────────────

export type MedicineOrderStatus = "pending" | "approved" | "ready_for_pickup" | "dispensed" | "cancelled";

export type MedicineOrderItem = {
  medicineId: string;
  medicineName: string;
  quantity: number;
  unit: string;
};

export type MedicineOrder = {
  id: string;
  facilityId: string;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  facilityName: string;
  items: MedicineOrderItem[];
  fulfillmentType: "pickup_phc" | "asha_home_delivery";
  status: MedicineOrderStatus;
  notes?: string;
  createdAt: number;
  updatedAt: number;
};

// ─── Bed Tracking Types ────────────────────────────────────────────────────────

export type BedStatus = "available" | "occupied" | "maintenance";
export type UnitType = "general_ward" | "icu" | "icu_pediatric" | "maternity" | "emergency" | "isolation";

export type HospitalUnit = {
  id: string;
  facilityId: string;
  name: string;
  type: UnitType;
  totalBeds: number;
  description?: string;
  createdAt: number;
  updatedAt: number;
  syncState: SyncState;
};

export type Bed = {
  id: string;
  unitId: string;
  bedNumber: string;
  status: BedStatus;
  occupiedByPatientId?: string;
  occupiedSince?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  syncState: SyncState;
};

export type BedOccupancy = {
  id: string;
  bedId: string;
  patientId: string;
  status: BedStatus;
  occupiedFrom: number;
  occupiedUntil?: number;
  notes?: string;
  recordedBy?: string;
  createdAt: number;
  syncState: SyncState;
};

export type UserRole = "chief_doctor" | "doctor" | "asha_worker" | "receptionist";

export type CurrentUser = {
  id: string;
  name: string;
  facilityId: string;
  facilityName: string;
  role: UserRole;
  specialty?: string;
};

export type HealthState = {
  currentUser: CurrentUser | null;
  language: AppLanguage;
  patients: Patient[];
  queue: QueueEntry[];
  encounters: Encounter[];
  referrals: Referral[];
  medicines: Medicine[];
  inventoryTransactions: InventoryTransaction[];
  operations: OfflineOperation[];
  hospitals: HospitalFacility[];
  appointments: Appointment[];
  medicineOrders: MedicineOrder[];
  hospitalUnits: HospitalUnit[];
  beds: Bed[];
  bedOccupancies: BedOccupancy[];
  lastSyncedAt: number;
};

