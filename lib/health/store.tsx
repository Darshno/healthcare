import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { evaluatePriority } from "./priority";
import { priorityLabel, priorityReasonLabel, referralLabel, syncLabel, translate, type TranslationKey } from "./i18n";
import { serializeOperation, type SyncTransport } from "./sync";
import type {
  AppLanguage,
  Appointment,
  AppointmentStatus,
  CareTag,
  Encounter,
  HealthState,
  HospitalFacility,
  InventoryTransactionType,
  Medicine,
  MedicineOrder,
  MedicineOrderItem,
  MedicineOrderStatus,
  OfflineOperation,
  Patient,
  Priority,
  PriorityInput,
  QueueEntry,
  QueueStatus,
  ReferralStatus,
  SyncState,
} from "./types";

const STORAGE_KEY = "rural-health-access.workspace.v2";
let sequence = 0;
const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(sequence += 1).toString(36)}`;
const now = Date.now();

export const SEEDED_HOSPITALS: HospitalFacility[] = [
  {
    id: "hosp-1",
    name: "Nandipur Primary Health Centre (PHC)",
    type: "PHC (Primary Health Centre)",
    address: "Main Road, Nandipur Village, Block 2",
    distanceKm: 1.2,
    phone: "0542-234890",
    emergencyHotline: "108 / 0542-234999",
    ambulanceAvailable: true,
    totalBeds: 12,
    availableBeds: 5,
    icuBedsAvailable: 1,
    facilities: ["24x7 Emergency", "Delivery Room (Labour)", "Essential Drug Pharmacy", "Basic Lab Tests", "Immunization Desk"],
    doctors: [
      {
        id: "doc-101",
        name: "Dr. Asha Verma",
        qualification: "MBBS, DCH",
        specialization: "Community Medicine / MO",
        experience: "9 years",
        opdTimings: "09:00 AM - 02:00 PM",
        availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        isAvailableToday: true,
        phone: "98765 43210",
        rating: 4.9,
      },
      {
        id: "doc-102",
        name: "Dr. Rajesh Gupta",
        qualification: "MBBS, MD (Pediatrics)",
        specialization: "Pediatrics / Child Health",
        experience: "12 years",
        opdTimings: "10:00 AM - 03:00 PM",
        availableDays: ["Mon", "Wed", "Fri"],
        isAvailableToday: true,
        phone: "98765 11223",
        rating: 4.8,
      },
      {
        id: "doc-103",
        name: "Dr. Meenakshi Iyer",
        qualification: "MBBS, DGO",
        specialization: "Obstetrics & Gynecology",
        experience: "14 years",
        opdTimings: "09:30 AM - 01:30 PM",
        availableDays: ["Tue", "Thu", "Sat"],
        isAvailableToday: true,
        phone: "98765 88990",
        rating: 4.9,
      },
    ],
  },
  {
    id: "hosp-2",
    name: "Rampur Community Health Centre (CHC)",
    type: "CHC (Community Health Centre)",
    address: "Hospital Chowk, Rampur Town, Sector 4",
    distanceKm: 6.8,
    phone: "0542-261200",
    emergencyHotline: "108 / 0542-261999",
    ambulanceAvailable: true,
    totalBeds: 30,
    availableBeds: 11,
    icuBedsAvailable: 3,
    facilities: ["Major & Minor OT", "Digital X-Ray & Ultrasound", "Dental Clinic", "Blood Storage Unit", "24x7 Ambulance"],
    doctors: [
      {
        id: "doc-201",
        name: "Dr. Alok Nath",
        qualification: "MBBS, MS (General Surgery)",
        specialization: "General Surgery & Trauma",
        experience: "16 years",
        opdTimings: "09:00 AM - 02:00 PM",
        availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        isAvailableToday: true,
        phone: "98765 33445",
        rating: 4.7,
      },
      {
        id: "doc-202",
        name: "Dr. Sneha Reddy",
        qualification: "MBBS, MD (General Medicine)",
        specialization: "General Medicine & Diabetes",
        experience: "10 years",
        opdTimings: "10:00 AM - 04:00 PM",
        availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        isAvailableToday: true,
        phone: "98765 66778",
        rating: 4.8,
      },
      {
        id: "doc-203",
        name: "Dr. Vikram Malhotra",
        qualification: "MBBS, MS (Orthopedics)",
        specialization: "Orthopedics & Joint Care",
        experience: "11 years",
        opdTimings: "11:00 AM - 03:00 PM",
        availableDays: ["Wed", "Thu", "Sat"],
        isAvailableToday: false,
        phone: "98765 99001",
        rating: 4.6,
      },
    ],
  },
  {
    id: "hosp-3",
    name: "District Civil Hospital & Trauma Centre",
    type: "District Civil Hospital",
    address: "Civil Lines, District Headquarters",
    distanceKm: 18.5,
    phone: "0542-280011",
    emergencyHotline: "108 / 102 / 0542-280911",
    ambulanceAvailable: true,
    totalBeds: 150,
    availableBeds: 38,
    icuBedsAvailable: 8,
    facilities: ["Advanced ICU & CCU", "Multi-slice CT Scan", "Dialysis Unit", "Govt Licensed Blood Bank", "Specialized Burn Unit"],
    doctors: [
      {
        id: "doc-301",
        name: "Dr. Arvind Swaminathan",
        qualification: "MBBS, MS, MCh",
        specialization: "Trauma & Critical Care",
        experience: "22 years",
        opdTimings: "08:30 AM - 01:00 PM",
        availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        isAvailableToday: true,
        phone: "98765 12345",
        rating: 4.9,
      },
      {
        id: "doc-302",
        name: "Dr. Fatima Sheikh",
        qualification: "MBBS, MD (Cardiology)",
        specialization: "Cardiology & Internal Medicine",
        experience: "15 years",
        opdTimings: "10:00 AM - 03:00 PM",
        availableDays: ["Mon", "Wed", "Fri"],
        isAvailableToday: true,
        phone: "98765 67890",
        rating: 4.9,
      },
    ],
  },
  {
    id: "hosp-4",
    name: "Chandpur Health & Wellness Sub-Centre",
    type: "Sub-Centre",
    address: "Panchayat Bhawan, Chandpur Village",
    distanceKm: 3.4,
    phone: "0542-219800",
    emergencyHotline: "108",
    ambulanceAvailable: false,
    totalBeds: 4,
    availableBeds: 2,
    icuBedsAvailable: 0,
    facilities: ["Primary First Aid", "Maternal Nutrition & ANC", "Child Growth Monitoring", "Free Essential Meds Dispensing"],
    doctors: [
      {
        id: "doc-401",
        name: "Dr. Asha Verma (Visiting)",
        qualification: "MBBS, DCH",
        specialization: "Community Health & Triage",
        experience: "9 years",
        opdTimings: "02:30 PM - 05:00 PM",
        availableDays: ["Tue", "Fri"],
        isAvailableToday: true,
        phone: "98765 43210",
        rating: 4.8,
      },
    ],
  },
];

const seededState: HealthState = {
  language: "en",
  patients: [
    {
      id: "p-101",
      localId: "RH-1024",
      abhaId: "91-4820-9912-3401",
      name: "Asha Devi",
      age: 27,
      sex: "female",
      contact: "98765 18120",
      address: "House 14, Ward 2, Nandipur Village",
      bloodGroup: "B+",
      careTags: ["maternal"],
      allergies: ["None recorded"],
      currentMedicines: ["Iron + folic acid", "Calcium 500mg"],
      syncState: "synced",
      updatedAt: now - 3600000,
    },
    {
      id: "p-102",
      localId: "RH-1025",
      abhaId: "91-2290-8812-4419",
      name: "Rohan Kumar",
      age: 3,
      sex: "male",
      contact: "98765 44190",
      address: "Near Water Tank, Nandipur",
      bloodGroup: "O+",
      careTags: ["child"],
      allergies: ["None recorded"],
      currentMedicines: [],
      syncState: "synced",
      updatedAt: now - 5400000,
    },
    {
      id: "p-103",
      localId: "RH-1026",
      abhaId: "91-7712-3390-1124",
      name: "Savitri Bai",
      age: 62,
      sex: "female",
      contact: "97123 10130",
      address: "East Gali, Nandipur",
      bloodGroup: "O+",
      careTags: ["chronic"],
      allergies: ["Penicillin"],
      currentMedicines: ["Amlodipine 5 mg", "Atorvastatin 10 mg"],
      syncState: "pending",
      updatedAt: now - 900000,
    },
    {
      id: "p-104",
      localId: "RH-1027",
      abhaId: "91-5544-2211-8890",
      name: "Imran Khan",
      age: 48,
      sex: "male",
      contact: "99887 84200",
      address: "Market Road, Nandipur",
      bloodGroup: "A+",
      careTags: ["general", "chronic"],
      allergies: ["None recorded"],
      currentMedicines: ["Metformin 500mg"],
      syncState: "synced",
      updatedAt: now - 7200000,
    },
  ],
  queue: [
    {
      id: "q-101",
      patientId: "p-102",
      service: "Child care & Paediatrics",
      arrivedAt: now - 42 * 60000,
      priority: "emergency",
      priorityReason: "childDanger",
      status: "consulting",
      tokenNumber: 101,
      roomNumber: "Room 1 (Pediatrics)",
      doctorName: "Dr. Rajesh Gupta",
      syncState: "synced",
    },
    {
      id: "q-102",
      patientId: "p-101",
      service: "Maternal & Antenatal Care",
      arrivedAt: now - 30 * 60000,
      priority: "urgent",
      priorityReason: "vitalConcern",
      status: "waiting",
      tokenNumber: 102,
      roomNumber: "Room 2 (ANC / Maternity)",
      doctorName: "Dr. Meenakshi Iyer",
      syncState: "synced",
    },
    {
      id: "q-103",
      patientId: "p-103",
      service: "Chronic care & Hypertension",
      arrivedAt: now - 18 * 60000,
      priority: "priority",
      priorityReason: "chronicReview",
      status: "waiting",
      tokenNumber: 103,
      roomNumber: "Room 3 (General OPD)",
      doctorName: "Dr. Asha Verma",
      syncState: "pending",
    },
    {
      id: "q-104",
      patientId: "p-104",
      service: "General OPD",
      arrivedAt: now - 8 * 60000,
      priority: "routine",
      priorityReason: "routineCare",
      status: "waiting",
      tokenNumber: 104,
      roomNumber: "Room 3 (General OPD)",
      doctorName: "Dr. Asha Verma",
      syncState: "synced",
    },
  ],
  encounters: [
    {
      id: "e-101",
      patientId: "p-101",
      type: "consultation",
      doctorName: "Dr. Meenakshi Iyer",
      diagnosis: "2nd Trimester Routine ANC checkup. Mild fatigue.",
      prescriptions: ["Iron + Folic Acid (100 days supply)", "Calcium 500mg"],
      note: "Antenatal follow-up completed. BP 118/76 mmHg. Fetal heart rate normal (142 bpm). Hemoglobin 11.2 g/dL. Next ultrasound scheduled.",
      createdAt: now - 3 * 86400000,
      syncState: "synced",
    },
    {
      id: "e-102",
      patientId: "p-103",
      type: "consultation",
      doctorName: "Dr. Asha Verma",
      diagnosis: "Essential Hypertension - Grade 1",
      prescriptions: ["Amlodipine 5 mg OD (30 days)", "Low sodium dietary advice"],
      note: "Blood pressure review: 146/92 mmHg. Medicine adherence discussed. Advised 30 mins daily walking.",
      createdAt: now - 14 * 86400000,
      syncState: "synced",
    },
    {
      id: "e-103",
      patientId: "p-104",
      type: "consultation",
      doctorName: "Dr. Asha Verma",
      diagnosis: "Type 2 Diabetes Mellitus review",
      prescriptions: ["Metformin 500mg BD after meals"],
      note: "Fasting blood sugar 128 mg/dL. Good control. Advised annual eye & foot screening.",
      createdAt: now - 28 * 86400000,
      syncState: "synced",
    },
  ],
  referrals: [
    {
      id: "r-101",
      patientId: "p-101",
      destination: "District Women’s Hospital",
      reason: "Obstetric ultrasound review & anomaly scan",
      urgency: "priority",
      status: "accepted",
      createdAt: now - 86400000,
      updatedAt: now - 2 * 3600000,
      syncState: "synced",
    },
    {
      id: "r-102",
      patientId: "p-102",
      destination: "Community Health Centre",
      reason: "Paediatric danger-sign assessment & nebulization",
      urgency: "emergency",
      status: "sent",
      createdAt: now - 45 * 60000,
      updatedAt: now - 45 * 60000,
      syncState: "pending",
    },
  ],
  medicines: [
    {
      id: "m-101",
      name: "Oral rehydration salts (ORS)",
      localName: "ओआरएस घोल",
      category: "general",
      unit: "sachets",
      stock: 58,
      minimumStock: 25,
      expiryDays: 210,
      isGovtSupply: true,
      pricePerUnit: 0,
      lastSyncedAt: now - 15 * 60000,
      syncState: "synced",
    },
    {
      id: "m-102",
      name: "Iron + Folic Acid Tablets",
      localName: "आयरन + फोलिक एसिड",
      category: "maternal",
      unit: "tablets",
      stock: 120,
      minimumStock: 30,
      expiryDays: 105,
      isGovtSupply: true,
      pricePerUnit: 0,
      lastSyncedAt: now - 15 * 60000,
      syncState: "synced",
    },
    {
      id: "m-103",
      name: "Amoxicillin 250mg Suspension",
      localName: "एमोक्सिसिलिन सिरप",
      category: "antibiotic",
      unit: "bottles",
      stock: 14,
      minimumStock: 8,
      expiryDays: 42,
      isGovtSupply: true,
      pricePerUnit: 0,
      lastSyncedAt: now - 150 * 60000,
      syncState: "synced",
    },
    {
      id: "m-104",
      name: "Amlodipine 5 mg",
      localName: "एम्लोडिपिन 5 मि.ग्रा.",
      category: "chronic",
      unit: "tablets",
      stock: 74,
      minimumStock: 40,
      expiryDays: 180,
      isGovtSupply: true,
      pricePerUnit: 0,
      lastSyncedAt: now - 15 * 60000,
      syncState: "synced",
    },
    {
      id: "m-105",
      name: "Paracetamol 500 mg",
      localName: "पैरासिटामोल",
      category: "analgesic",
      unit: "tablets",
      stock: 240,
      minimumStock: 50,
      expiryDays: 360,
      isGovtSupply: true,
      pricePerUnit: 0,
      lastSyncedAt: now - 15 * 60000,
      syncState: "synced",
    },
    {
      id: "m-106",
      name: "Metformin 500 mg",
      localName: "मेटफॉर्मिन",
      category: "chronic",
      unit: "tablets",
      stock: 90,
      minimumStock: 30,
      expiryDays: 240,
      isGovtSupply: true,
      pricePerUnit: 0,
      lastSyncedAt: now - 15 * 60000,
      syncState: "synced",
    },
  ],
  inventoryTransactions: [],
  operations: [{ id: "op-seed", type: "inventory.adjustment", entityId: "m-103", createdAt: now - 150 * 60000 }],
  hospitals: SEEDED_HOSPITALS,
  appointments: [
    {
      id: "apt-101",
      patientId: "p-101",
      patientName: "Asha Devi",
      patientPhone: "98765 18120",
      facilityId: "hosp-1",
      facilityName: "Nandipur Primary Health Centre (PHC)",
      doctorId: "doc-103",
      doctorName: "Dr. Meenakshi Iyer",
      specialty: "Obstetrics & Gynecology",
      date: new Date(now + 86400000 * 2).toISOString().split("T")[0],
      timeSlot: "10:30 AM",
      reason: "Antenatal 3rd trimester routine evaluation & BP monitoring",
      isEmergency: false,
      status: "confirmed",
      createdAt: now - 86400000,
      notes: "Please carry previous ANC health card and blood reports.",
    },
    {
      id: "apt-102",
      patientId: "p-103",
      patientName: "Savitri Bai",
      patientPhone: "97123 10130",
      facilityId: "hosp-1",
      facilityName: "Nandipur Primary Health Centre (PHC)",
      doctorId: "doc-101",
      doctorName: "Dr. Asha Verma",
      specialty: "Community Medicine / MO",
      date: new Date(now + 86400000 * 4).toISOString().split("T")[0],
      timeSlot: "11:00 AM",
      reason: "Monthly hypertension checkup & prescription refill",
      isEmergency: false,
      status: "scheduled",
      createdAt: now - 48 * 3600000,
    },
  ],
  medicineOrders: [
    {
      id: "ord-101",
      patientId: "p-101",
      patientName: "Asha Devi",
      patientPhone: "98765 18120",
      facilityName: "Nandipur Primary Health Centre",
      items: [
        { medicineId: "m-102", medicineName: "Iron + Folic Acid Tablets", quantity: 60, unit: "tablets" },
      ],
      fulfillmentType: "asha_home_delivery",
      status: "ready_for_pickup",
      notes: "ASHA worker Sunita will deliver to village home on next visit.",
      createdAt: now - 36 * 3600000,
      updatedAt: now - 12 * 3600000,
    },
    {
      id: "ord-102",
      patientId: "p-103",
      patientName: "Savitri Bai",
      patientPhone: "97123 10130",
      facilityName: "Nandipur Primary Health Centre",
      items: [
        { medicineId: "m-104", medicineName: "Amlodipine 5 mg", quantity: 30, unit: "tablets" },
      ],
      fulfillmentType: "pickup_phc",
      status: "approved",
      notes: "Refill approved by Dr. Asha Verma.",
      createdAt: now - 18 * 3600000,
      updatedAt: now - 6 * 3600000,
    },
  ],
  lastSyncedAt: now - 15 * 60000,
};

type RegistrationInput = {
  name: string;
  age: number;
  sex: Patient["sex"];
  contact?: string;
  careTags: CareTag[];
  service: string;
  priorityInput: PriorityInput;
};

type BookAppointmentInput = {
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
  isEmergency?: boolean;
};

type RequestEmergencyInput = {
  patientId: string;
  patientName: string;
  patientPhone?: string;
  facilityId: string;
  facilityName: string;
  reason: string;
  symptoms: string[];
  severity?: "critical" | "severe" | "moderate";
};

type OrderMedicineInput = {
  patientId: string;
  patientName: string;
  patientPhone?: string;
  facilityName: string;
  items: MedicineOrderItem[];
  fulfillmentType: "pickup_phc" | "asha_home_delivery";
  notes?: string;
};

type HealthContextValue = {
  state: HealthState;
  isHydrated: boolean;
  syncing: boolean;
  syncError: string | null;
  t: (key: TranslationKey) => string;
  priorityLabel: (priority: Priority) => string;
  priorityReasonLabel: (reason: Parameters<typeof priorityReasonLabel>[1]) => string;
  referralLabel: (status: ReferralStatus) => string;
  syncLabel: (syncState: SyncState) => string;
  setLanguage: (language: AppLanguage) => void;
  // Patient & Clinical Actions
  registerPatient: (input: RegistrationInput) => string;
  joinQueue: (input: { patientId: string; service: string; priority?: Priority; priorityReason?: Parameters<typeof priorityReasonLabel>[1] }) => string;
  updateQueueStatus: (queueId: string, status: QueueStatus) => void;
  overrideQueuePriority: (queueId: string, priority: Priority, reason: string) => void;
  addEncounter: (patientId: string, note: string, diagnosis?: string, prescriptions?: string[], doctorName?: string) => void;
  createReferral: (input: { patientId: string; destination: string; reason: string; urgency: Priority }) => void;
  updateReferralStatus: (referralId: string, status: ReferralStatus) => void;
  recordInventoryTransaction: (medicineId: string, type: InventoryTransactionType, quantity: number) => void;
  // Appointment & Medicine Actions
  bookAppointment: (input: BookAppointmentInput) => string;
  cancelAppointment: (appointmentId: string) => void;
  requestEmergencyAppointment: (input: RequestEmergencyInput) => string;
  orderMedicine: (input: OrderMedicineInput) => string;
  updateMedicineOrderStatus: (orderId: string, status: MedicineOrderStatus) => void;
  syncNow: () => void;
  getPatient: (patientId: string) => Patient | undefined;
  getPatientEncounters: (patientId: string) => Encounter[];
  getPatientAppointments: (patientId: string) => Appointment[];
  getPatientOrders: (patientId: string) => MedicineOrder[];
  getPatientActiveQueue: (patientId: string) => QueueEntry | undefined;
};

const HealthContext = createContext<HealthContextValue | undefined>(undefined);

function addOperation(state: HealthState, type: string, entityId: string) {
  const operation: OfflineOperation = { id: makeId("op"), type, entityId, createdAt: Date.now() };
  return { ...state, operations: [...state.operations, operation] };
}

export function HealthProvider({ children, syncTransport }: PropsWithChildren<{ syncTransport?: SyncTransport }>) {
  const [state, setState] = useState<HealthState>(seededState);
  const [isHydrated, setIsHydrated] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const transportRef = useRef<SyncTransport | undefined>(syncTransport);
  transportRef.current = syncTransport;

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved) {
          const parsed = JSON.parse(saved) as HealthState;
          // Ensure newly added top-level state arrays are present
          setState({
            ...seededState,
            ...parsed,
            hospitals: parsed.hospitals?.length ? parsed.hospitals : seededState.hospitals,
            appointments: parsed.appointments ?? seededState.appointments,
            medicineOrders: parsed.medicineOrders ?? seededState.medicineOrders,
          });
        }
      })
      .catch(() => undefined)
      .finally(() => setIsHydrated(true));
  }, []);

  useEffect(() => {
    if (isHydrated) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined);
  }, [isHydrated, state]);

  const setLanguage = useCallback((language: AppLanguage) => {
    setState((previous) => ({ ...previous, language }));
  }, []);

  const registerPatient = useCallback((input: RegistrationInput) => {
    const patientId = makeId("patient");
    const queueId = makeId("queue");
    const timestamp = Date.now();
    const assessment = evaluatePriority(input.priorityInput);
    const token = 100 + (state.queue.length + 1);

    const patient: Patient = {
      id: patientId,
      localId: `RH-${Math.floor(1000 + Math.random() * 9000)}`,
      name: input.name.trim(),
      age: input.age,
      sex: input.sex,
      contact: input.contact?.trim(),
      careTags: input.careTags.length ? input.careTags : ["general"],
      allergies: ["Not recorded"],
      currentMedicines: [],
      syncState: "pending",
      updatedAt: timestamp,
    };
    const queueEntry: QueueEntry = {
      id: queueId,
      patientId,
      service: input.service,
      arrivedAt: timestamp,
      priority: assessment.priority,
      priorityReason: assessment.reason,
      status: "waiting",
      tokenNumber: token,
      roomNumber: "Room 1",
      syncState: "pending",
    };
    const triageEncounter: Encounter = {
      id: makeId("encounter"),
      patientId,
      type: "triage",
      note: `Initial triage: ${assessment.reason}.`,
      createdAt: timestamp,
      syncState: "pending",
    };
    setState((previous) => {
      const next = {
        ...previous,
        patients: [patient, ...previous.patients],
        queue: [queueEntry, ...previous.queue],
        encounters: [triageEncounter, ...previous.encounters],
      };
      return addOperation(addOperation(next, "patient.create", patientId), "queue.add", queueId);
    });
    return patientId;
  }, [state.queue.length]);

  const joinQueue = useCallback((input: { patientId: string; service: string; priority?: Priority; priorityReason?: Parameters<typeof priorityReasonLabel>[1] }) => {
    const queueId = makeId("queue");
    const timestamp = Date.now();
    const token = 100 + (state.queue.length + 1);

    const queueEntry: QueueEntry = {
      id: queueId,
      patientId: input.patientId,
      service: input.service,
      arrivedAt: timestamp,
      priority: input.priority || "routine",
      priorityReason: input.priorityReason || "routineCare",
      status: "waiting",
      tokenNumber: token,
      roomNumber: "Room 3 (General OPD)",
      doctorName: "Dr. Asha Verma",
      syncState: "pending",
    };

    setState((previous) => {
      const next = {
        ...previous,
        queue: [...previous.queue, queueEntry],
      };
      return addOperation(next, "queue.add", queueId);
    });

    return queueId;
  }, [state.queue.length]);

  const updateQueueStatus = useCallback((queueId: string, status: QueueStatus) => {
    setState((previous) => {
      const next = { ...previous, queue: previous.queue.map((item) => item.id === queueId ? { ...item, status, syncState: "pending" as const } : item) };
      return addOperation(next, "queue.status", queueId);
    });
  }, []);

  const overrideQueuePriority = useCallback((queueId: string, priority: Priority, reason: string) => {
    setState((previous) => {
      const next = { ...previous, queue: previous.queue.map((item) => item.id === queueId ? { ...item, priority, priorityReason: "clinicianUrgent" as const, overrideReason: reason, syncState: "pending" as const } : item) };
      return addOperation(next, "queue.override", queueId);
    });
  }, []);

  const addEncounter = useCallback((patientId: string, note: string, diagnosis?: string, prescriptions?: string[], doctorName?: string) => {
    const encounter: Encounter = {
      id: makeId("encounter"),
      patientId,
      type: "consultation",
      note,
      diagnosis,
      prescriptions,
      doctorName,
      createdAt: Date.now(),
      syncState: "pending",
    };
    setState((previous) => addOperation({ ...previous, encounters: [encounter, ...previous.encounters] }, "encounter.create", encounter.id));
  }, []);

  const createReferral = useCallback((input: { patientId: string; destination: string; reason: string; urgency: Priority }) => {
    const referral = { id: makeId("referral"), ...input, status: "draft" as const, createdAt: Date.now(), updatedAt: Date.now(), syncState: "pending" as const };
    setState((previous) => addOperation({ ...previous, referrals: [referral, ...previous.referrals] }, "referral.create", referral.id));
  }, []);

  const updateReferralStatus = useCallback((referralId: string, status: ReferralStatus) => {
    setState((previous) => {
      const next = { ...previous, referrals: previous.referrals.map((item) => item.id === referralId ? { ...item, status, updatedAt: Date.now(), syncState: "pending" as const } : item) };
      return addOperation(next, "referral.status", referralId);
    });
  }, []);

  const recordInventoryTransaction = useCallback((medicineId: string, type: InventoryTransactionType, quantity: number) => {
    const signedQuantity = type === "receipt" ? quantity : -Math.abs(quantity);
    const transaction = { id: makeId("inventory"), medicineId, type, quantity: signedQuantity, createdAt: Date.now(), syncState: "pending" as const };
    setState((previous) => {
      const next = {
        ...previous,
        medicines: previous.medicines.map((medicine) => medicine.id === medicineId ? { ...medicine, stock: Math.max(0, medicine.stock + signedQuantity), syncState: "pending" as const } : medicine),
        inventoryTransactions: [transaction, ...previous.inventoryTransactions],
      };
      return addOperation(next, `inventory.${type}`, transaction.id);
    });
  }, []);

  // ─── Appointment Actions ───────────────────────────────────────────────────

  const bookAppointment = useCallback((input: BookAppointmentInput): string => {
    const aptId = makeId("apt");
    const appointment: Appointment = {
      id: aptId,
      patientId: input.patientId,
      patientName: input.patientName,
      patientPhone: input.patientPhone,
      facilityId: input.facilityId,
      facilityName: input.facilityName,
      doctorId: input.doctorId,
      doctorName: input.doctorName,
      specialty: input.specialty,
      date: input.date,
      timeSlot: input.timeSlot,
      reason: input.reason,
      isEmergency: !!input.isEmergency,
      status: "confirmed",
      createdAt: Date.now(),
    };

    setState((previous) => {
      const next = { ...previous, appointments: [appointment, ...previous.appointments] };
      return addOperation(next, "appointment.book", aptId);
    });

    return aptId;
  }, []);

  const cancelAppointment = useCallback((appointmentId: string) => {
    setState((previous) => {
      const next = {
        ...previous,
        appointments: previous.appointments.map((a) =>
          a.id === appointmentId ? { ...a, status: "cancelled" as const } : a,
        ),
      };
      return addOperation(next, "appointment.cancel", appointmentId);
    });
  }, []);

  const requestEmergencyAppointment = useCallback((input: RequestEmergencyInput): string => {
    const aptId = makeId("apt-emg");
    const queueId = makeId("q-emg");
    const nowTs = Date.now();
    const token = 100 + (state.queue.length + 1);

    const appointment: Appointment = {
      id: aptId,
      patientId: input.patientId,
      patientName: input.patientName,
      patientPhone: input.patientPhone,
      facilityId: input.facilityId,
      facilityName: input.facilityName,
      doctorId: "doc-101",
      doctorName: "Dr. Asha Verma (On Duty Medical Officer)",
      specialty: "Emergency & Critical Triage",
      date: new Date().toISOString().split("T")[0],
      timeSlot: "IMMEDIATE EMERGENCY",
      reason: `[SOS EMERGENCY] ${input.reason}. Symptoms: ${input.symptoms.join(", ")}`,
      isEmergency: true,
      emergencySeverity: input.severity || "critical",
      status: "emergency_dispatched",
      createdAt: nowTs,
      notes: "Emergency alert sent to on-duty medical team. Direct triage active.",
    };

    // Also auto-inject high-priority emergency queue entry
    const emergencyQueue: QueueEntry = {
      id: queueId,
      patientId: input.patientId,
      service: "🚨 EMERGENCY SOS TRIAGE",
      arrivedAt: nowTs,
      priority: "emergency",
      priorityReason: "vitalConcern",
      status: "called",
      tokenNumber: token,
      roomNumber: "Red Emergency Resuscitation Bay",
      doctorName: "Dr. Asha Verma",
      syncState: "pending",
    };

    setState((previous) => {
      const next = {
        ...previous,
        appointments: [appointment, ...previous.appointments],
        queue: [emergencyQueue, ...previous.queue],
      };
      return addOperation(next, "appointment.emergency", aptId);
    });

    return aptId;
  }, [state.queue.length]);

  // ─── Medicine Order Actions ────────────────────────────────────────────────

  const orderMedicine = useCallback((input: OrderMedicineInput): string => {
    const orderId = makeId("ord");
    const nowTs = Date.now();

    const order: MedicineOrder = {
      id: orderId,
      patientId: input.patientId,
      patientName: input.patientName,
      patientPhone: input.patientPhone,
      facilityName: input.facilityName,
      items: input.items,
      fulfillmentType: input.fulfillmentType,
      status: "pending",
      notes: input.notes,
      createdAt: nowTs,
      updatedAt: nowTs,
    };

    setState((previous) => {
      const next = { ...previous, medicineOrders: [order, ...previous.medicineOrders] };
      return addOperation(next, "medicine.order", orderId);
    });

    return orderId;
  }, []);

  const updateMedicineOrderStatus = useCallback((orderId: string, status: MedicineOrderStatus) => {
    setState((previous) => {
      const next = {
        ...previous,
        medicineOrders: previous.medicineOrders.map((o) =>
          o.id === orderId ? { ...o, status, updatedAt: Date.now() } : o,
        ),
      };
      return addOperation(next, "medicine.orderStatus", orderId);
    });
  }, []);

  const syncNow = useCallback(() => {
    if (syncing) return;
    setSyncing(true);
    setSyncError(null);
    if (!transportRef.current) {
      setState((previous) => ({ ...previous, lastSyncedAt: Date.now() }));
      setSyncing(false);
      return;
    }
    const batch = state.operations.map(serializeOperation);
    if (batch.length === 0) {
      setState((previous) => ({ ...previous, lastSyncedAt: Date.now() }));
      setSyncing(false);
      return;
    }
    transportRef.current(batch)
      .then((result) => {
        const acked = new Set(result.acknowledgedIds);
        setState((previous) => ({
          ...previous,
          patients: previous.patients.map((item) => (acked.has(item.id) ? { ...item, syncState: "synced" as const } : item)),
          queue: previous.queue.map((item) => (acked.has(item.id) ? { ...item, syncState: "synced" as const } : item)),
          encounters: previous.encounters.map((item) => (acked.has(item.id) ? { ...item, syncState: "synced" as const } : item)),
          referrals: previous.referrals.map((item) => (acked.has(item.id) ? { ...item, syncState: "synced" as const } : item)),
          medicines: previous.medicines.map((item) => (acked.has(item.id) ? { ...item, syncState: "synced" as const, lastSyncedAt: Date.now() } : item)),
          inventoryTransactions: previous.inventoryTransactions.map((item) => (acked.has(item.id) ? { ...item, syncState: "synced" as const } : item)),
          operations: previous.operations.filter((operation) => !acked.has(operation.id)),
          lastSyncedAt: result.acknowledgedAt,
        }));
      })
      .catch((error) => {
        setSyncError(error instanceof Error ? error.message : "Sync failed. Changes remain queued locally and will retry on the next network check.");
      })
      .finally(() => setSyncing(false));
  }, [state.operations, syncing]);

  // Auto-sync
  const syncNowRef = useRef<() => void>(() => undefined);
  syncNowRef.current = syncNow;
  const wasOnlineRef = useRef<boolean | null>(null);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((netState) => {
      const isOnline = Boolean(netState.isConnected && netState.isInternetReachable !== false);
      const previouslyOnline = wasOnlineRef.current;
      wasOnlineRef.current = isOnline;
      if (isOnline && previouslyOnline === false) {
        syncNowRef.current();
      }
    });
    return unsubscribe;
  }, []);

  const value = useMemo<HealthContextValue>(() => ({
    state,
    isHydrated,
    syncing,
    syncError,
    t: (key) => translate(state.language, key),
    priorityLabel: (priority) => priorityLabel(state.language, priority),
    priorityReasonLabel: (reason) => priorityReasonLabel(state.language, reason),
    referralLabel: (status) => referralLabel(state.language, status),
    syncLabel: (syncState) => syncLabel(state.language, syncState),
    setLanguage,
    registerPatient,
    joinQueue,
    updateQueueStatus,
    overrideQueuePriority,
    addEncounter,
    createReferral,
    updateReferralStatus,
    recordInventoryTransaction,
    bookAppointment,
    cancelAppointment,
    requestEmergencyAppointment,
    orderMedicine,
    updateMedicineOrderStatus,
    syncNow,
    getPatient: (patientId) => state.patients.find((patient) => patient.id === patientId),
    getPatientEncounters: (patientId) => state.encounters.filter((encounter) => encounter.patientId === patientId).sort((a, b) => b.createdAt - a.createdAt),
    getPatientAppointments: (patientId) => state.appointments.filter((a) => a.patientId === patientId).sort((a, b) => b.createdAt - a.createdAt),
    getPatientOrders: (patientId) => state.medicineOrders.filter((o) => o.patientId === patientId).sort((a, b) => b.createdAt - a.createdAt),
    getPatientActiveQueue: (patientId) => state.queue.find((q) => q.patientId === patientId && q.status !== "completed"),
  }), [addEncounter, bookAppointment, cancelAppointment, createReferral, isHydrated, joinQueue, orderMedicine, overrideQueuePriority, recordInventoryTransaction, registerPatient, requestEmergencyAppointment, setLanguage, state, syncNow, syncing, syncError, updateMedicineOrderStatus, updateQueueStatus, updateReferralStatus]);

  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>;
}

export function useHealth() {
  const context = useContext(HealthContext);
  if (!context) throw new Error("useHealth must be used within HealthProvider");
  return context;
}

