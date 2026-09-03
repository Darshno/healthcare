import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { Alert } from "react-native";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { priorityLabel, priorityReasonLabel, referralLabel, syncLabel, translate, type TranslationKey } from "./i18n";
import { serializeOperation, type SyncTransport } from "./sync";
import { analyzeDiseaseRuleBased, matchBestDoctor } from "./aiTriage";
import { getRegisteredUsers } from "./userAuth";
import type {
  AppLanguage,
  Appointment,
  AppointmentStatus,
  Bed,
  BedOccupancy,
  CareTag,
  CurrentUser,
  Encounter,
  HealthState,
  HospitalFacility,
  HospitalUnit,
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
  UserRole,
} from "./types";

const STORAGE_KEY = "rural-health-access.workspace.v3";
let sequence = 0;
const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(sequence += 1).toString(36)}`;
const now = Date.now();

const EMPTY_STATE: HealthState = {
  currentUser: null,
  language: "en",
  patients: [],
  queue: [],
  encounters: [],
  referrals: [],
  medicines: [],
  inventoryTransactions: [],
  operations: [],
  hospitals: [],
  appointments: [],
  medicineOrders: [],
  hospitalUnits: [],
  beds: [],
  bedOccupancies: [],
  lastSyncedAt: 0,
};

type RegistrationInput = {
  name: string;
  age: number;
  sex: Patient["sex"];
  contact?: string;
  disease?: string; // optional symptom/disease note for triage
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
  facilityId?: string;
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
  setCurrentUser: (user: CurrentUser | null) => void;
  // Patient & Clinical Actions
  registerPatient: (input: RegistrationInput) => string;
  joinQueue: (input: { patientId: string; service: string; priority?: Priority; priorityReason?: Parameters<typeof priorityReasonLabel>[1] }) => string;
  updateQueueStatus: (queueId: string, status: QueueStatus) => void;
  overrideQueuePriority: (queueId: string, priority: Priority, reason: string) => void;
  addEncounter: (patientId: string, note: string, diagnosis?: string, prescriptions?: string[], doctorName?: string) => void;
  createReferral: (input: { patientId: string; destination: string; reason: string; urgency: Priority }) => void;
  updateReferralStatus: (referralId: string, status: ReferralStatus) => void;
  recordInventoryTransaction: (medicineId: string, type: InventoryTransactionType, quantity: number) => void;
  addMedicine: (input: { name: string; localName?: string; category?: string; unit: string; minimumStock: number }) => void;
  // Appointment & Medicine Actions
  bookAppointment: (input: BookAppointmentInput) => string;
  cancelAppointment: (appointmentId: string) => void;
  requestEmergencyAppointment: (input: RequestEmergencyInput) => string;
  orderMedicine: (input: OrderMedicineInput) => string;
  updateMedicineOrderStatus: (orderId: string, status: MedicineOrderStatus) => void;
  // Bed Management Actions
  occupyBed: (bedId: string, patientId: string, notes?: string) => void;
  releaseBed: (bedId: string) => void;
  getBedsByUnit: (unitId: string) => Bed[];
  getUnitStats: (unitId: string) => { unit: HospitalUnit; totalBeds: number; occupiedBeds: number; availableBeds: number; maintenanceBeds: number; occupancyRate: number } | null;
  setMaintenanceBed: (bedId: string, inMaintenance: boolean, notes?: string) => void;
  addWard: (wardName: string, bedCount: number) => void;
  getNearbyHospitalsWithBeds: (maxDistance?: number) => HospitalFacility[];
  getFacilityUnits: (facilityId: string) => HospitalUnit[];
  getFacilityStats: (facilityId: string) => {
    facilityId: string;
    totalBeds: number;
    occupiedBeds: number;
    availableBeds: number;
    maintenanceBeds: number;
    occupancyRate: number;
    isFull: boolean;
    units: Array<HospitalUnit & { occupiedBeds: number; availableBeds: number }>;
  };
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
  const [state, setState] = useState<HealthState>(EMPTY_STATE);
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
          setState((previous) => ({
            ...EMPTY_STATE,
            ...parsed,
            currentUser: previous.currentUser ?? parsed.currentUser ?? null,
          }));
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

  const setCurrentUser = useCallback((user: CurrentUser | null) => {
    setState((previous) => ({ ...previous, currentUser: user }));
  }, []);


  // Keyword-based triage from disease note
  const inferPriority = (disease?: string): Priority => {
    if (!disease) return "routine";
    const d = disease.toLowerCase();
    if (
      d.includes("emergency") || d.includes("chest pain") ||
      d.includes("breathing") || d.includes("unconscious") ||
      d.includes("bleeding") || d.includes("seizure") ||
      d.includes("stroke") || d.includes("heart attack")
    ) return "emergency";
    if (
      d.includes("fever") || d.includes("pain") || d.includes("infection") ||
      d.includes("fracture") || d.includes("vomit") || d.includes("diarrhea") ||
      d.includes("diarrhoea") || d.includes("wound") || d.includes("burn")
    ) return "urgent";
    if (
      d.includes("diabetes") || d.includes("bp") || d.includes("blood pressure") ||
      d.includes("chronic") || d.includes("follow up") || d.includes("follow-up")
    ) return "priority";
    return "routine";
  };

  const registerPatient = useCallback((input: RegistrationInput) => {
    if (!state.currentUser) {
      Alert.alert("Session Error", "No active user session found. Please log in.");
      return "";
    }
    const currentRole = state.currentUser.role;
    if (currentRole !== "asha_worker" && currentRole !== "receptionist") {
      Alert.alert("Permission Denied", "Only ASHA workers and receptionists can register patients.");
      return "";
    }

    const patientId = makeId("patient");
    const queueId = makeId("queue");
    const timestamp = Date.now();

    // Perform disease triage & doctor matching
    const triageResult = analyzeDiseaseRuleBased(input.disease || "");
    const priority = triageResult.priority;
    const priorityReason = triageResult.priorityReason;

    // Doctor matching
    let matchedDoctorName = "Dr. General Medical Officer";
    let matchedDoctorId = "doc-duty-01";
    let matchedSpecialty = triageResult.recommendedSpecialization;

    getRegisteredUsers().then((users) => {
      const match = matchBestDoctor(
        state.currentUser?.facilityId || "",
        triageResult.recommendedSpecialization,
        users,
        state.queue
      );
      if (match) {
        matchedDoctorName = match.name;
        matchedDoctorId = match.id;
        matchedSpecialty = match.specialization as any;
        // Update queue entry with matched doctor
        setState((prev) => ({
          ...prev,
          queue: prev.queue.map((q) =>
            q.id === queueId
              ? { ...q, doctorName: match.name, doctorId: match.id, specialty: match.specialization }
              : q
          ),
        }));
      }
    }).catch(() => null);

    const token = 100 + (state.queue.length + 1);

    const patient: Patient = {
      id: patientId,
      facilityId: state.currentUser.facilityId,
      localId: `RH-${Math.floor(1000 + Math.random() * 9000)}`,
      name: input.name.trim(),
      age: input.age,
      sex: input.sex,
      contact: input.contact?.trim(),
      disease: input.disease?.trim(),
      careTags: ["general"],
      allergies: ["Not recorded"],
      currentMedicines: [],
      syncState: "pending",
      updatedAt: timestamp,
    };
    const queueEntry: QueueEntry = {
      id: queueId,
      facilityId: state.currentUser.facilityId,
      patientId,
      service: `${matchedSpecialty} OPD`,
      arrivedAt: timestamp,
      priority,
      priorityReason,
      status: "waiting",
      tokenNumber: token,
      roomNumber: "Triage & OPD",
      doctorName: matchedDoctorName,
      doctorId: matchedDoctorId,
      specialty: matchedSpecialty,
      syncState: "pending",
    };
    const triageEncounter: Encounter = {
      id: makeId("encounter"),
      facilityId: state.currentUser.facilityId,
      patientId,
      type: "triage",
      note: `Triage (${priority}): ${triageResult.clinicalSummary}. Matched Doc: ${matchedDoctorName}.`,
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
  }, [state.queue, state.currentUser]);

  const joinQueue = useCallback((input: { patientId: string; service: string; priority?: Priority; priorityReason?: Parameters<typeof priorityReasonLabel>[1] }) => {
    if (!state.currentUser || (state.currentUser.role !== "asha_worker" && state.currentUser.role !== "receptionist")) {
      Alert.alert("Permission Denied", "Only ASHA workers or receptionists can add patients to the queue.");
      return "";
    }

    const patientRecord = state.patients.find((p) => p.id === input.patientId);
    const triageResult = analyzeDiseaseRuleBased(patientRecord?.disease || "");

    const queueId = makeId("queue");
    const timestamp = Date.now();
    const token = 100 + (state.queue.length + 1);

    let matchedDoctorName = "Dr. General Duty Doctor";
    let matchedDoctorId = "doc-duty-01";

    getRegisteredUsers().then((users) => {
      const match = matchBestDoctor(
        state.currentUser?.facilityId || "",
        triageResult.recommendedSpecialization,
        users,
        state.queue
      );
      if (match) {
        matchedDoctorName = match.name;
        matchedDoctorId = match.id;
        setState((prev) => ({
          ...prev,
          queue: prev.queue.map((q) =>
            q.id === queueId ? { ...q, doctorName: match.name, doctorId: match.id } : q
          ),
        }));
      }
    }).catch(() => null);

    const queueEntry: QueueEntry = {
      id: queueId,
      facilityId: state.currentUser.facilityId,
      patientId: input.patientId,
      service: input.service || `${triageResult.recommendedSpecialization} OPD`,
      arrivedAt: timestamp,
      priority: input.priority || triageResult.priority,
      priorityReason: input.priorityReason || triageResult.priorityReason,
      status: "waiting",
      tokenNumber: token,
      roomNumber: "General OPD",
      doctorName: matchedDoctorName,
      doctorId: matchedDoctorId,
      specialty: triageResult.recommendedSpecialization,
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
  }, [state.queue.length, state.currentUser]);

  const updateQueueStatus = useCallback((queueId: string, status: QueueStatus) => {
    if (!state.currentUser || (state.currentUser.role !== "asha_worker" && state.currentUser.role !== "doctor" && state.currentUser.role !== "chief_doctor")) {
      Alert.alert("Permission Denied", "You do not have permission to update queue status.");
      return;
    }

    setState((previous) => {
      const next = { ...previous, queue: previous.queue.map((item) => item.id === queueId ? { ...item, status, syncState: "pending" as const } : item) };
      return addOperation(next, "queue.status", queueId);
    });
  }, [state.currentUser]);

  const overrideQueuePriority = useCallback((queueId: string, priority: Priority, reason: string) => {
    if (!state.currentUser || (state.currentUser.role !== "doctor" && state.currentUser.role !== "chief_doctor")) {
      Alert.alert("Permission Denied", "Only doctors can override queue priority.");
      return;
    }

    setState((previous) => {
      const next = { ...previous, queue: previous.queue.map((item) => item.id === queueId ? { ...item, priority, priorityReason: "clinicianUrgent" as const, overrideReason: reason, syncState: "pending" as const } : item) };
      return addOperation(next, "queue.override", queueId);
    });
  }, [state.currentUser]);

  const addEncounter = useCallback((patientId: string, note: string, diagnosis?: string, prescriptions?: string[], doctorName?: string) => {
    if (!state.currentUser || (state.currentUser.role !== "doctor" && state.currentUser.role !== "chief_doctor")) {
      Alert.alert("Permission Denied", "Only doctors can record encounters.");
      return;
    }

    const encounter: Encounter = {
      id: makeId("encounter"),
      facilityId: state.currentUser.facilityId,
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
  }, [state.currentUser]);

  const createReferral = useCallback((input: { patientId: string; destination: string; reason: string; urgency: Priority }) => {
    if (!state.currentUser || (state.currentUser.role !== "doctor" && state.currentUser.role !== "chief_doctor")) {
      Alert.alert("Permission Denied", "Only clinicians can create referrals.");
      return;
    }

    const referral = {
      id: makeId("referral"),
      facilityId: state.currentUser.facilityId,
      ...input,
      status: "draft" as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncState: "pending" as const
    };
    setState((previous) => addOperation({ ...previous, referrals: [referral, ...previous.referrals] }, "referral.create", referral.id));
  }, [state.currentUser]);

  const updateReferralStatus = useCallback((referralId: string, status: ReferralStatus) => {
    if (!state.currentUser || (state.currentUser.role !== "doctor" && state.currentUser.role !== "chief_doctor")) {
      Alert.alert("Permission Denied", "You do not have permission to update referral status.");
      return;
    }

    setState((previous) => {
      const next = { ...previous, referrals: previous.referrals.map((item) => item.id === referralId ? { ...item, status, updatedAt: Date.now(), syncState: "pending" as const } : item) };
      return addOperation(next, "referral.status", referralId);
    });
  }, [state.currentUser]);

  const recordInventoryTransaction = useCallback((medicineId: string, type: InventoryTransactionType, quantity: number) => {
    if (!state.currentUser) {
      Alert.alert("Session Error", "Please sign in to update medicine stock.");
      return;
    }
    const signedQuantity = type === "receipt" ? Math.abs(quantity) : -Math.abs(quantity);
    const transaction = { id: makeId("inventory"), medicineId, type, quantity: signedQuantity, createdAt: Date.now(), syncState: "pending" as const };
    setState((previous) => {
      const next = {
        ...previous,
        medicines: previous.medicines.map((medicine) => medicine.id === medicineId ? { ...medicine, stock: Math.max(0, medicine.stock + signedQuantity), syncState: "pending" as const } : medicine),
        inventoryTransactions: [transaction, ...previous.inventoryTransactions],
      };
      return addOperation(next, `inventory.${type}`, transaction.id);
    });
  }, [state.currentUser]);

  const addMedicine = useCallback((input: { name: string; localName?: string; category?: string; unit: string; minimumStock: number }) => {
    if (!state.currentUser) {
      Alert.alert("Session Error", "Please sign in to add medicines.");
      return;
    }
    const timestamp = Date.now();
    const id = makeId("med");
    const medicine: Medicine = {
      id,
      facilityId: state.currentUser.facilityId,
      name: input.name.trim(),
      localName: input.localName?.trim() || input.name.trim(),
      category: (input.category?.trim() as any) || "general",
      unit: input.unit.trim(),
      stock: 0,
      minimumStock: input.minimumStock || 0,
      expiryDays: 365,
      isGovtSupply: true,
      pricePerUnit: 0,
      lastSyncedAt: timestamp,
      syncState: "pending",
    };
    setState((previous) => {
      const next = {
        ...previous,
        medicines: [medicine, ...previous.medicines],
      };
      return addOperation(next, "medicine.create", id);
    });
  }, [state.currentUser]);

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

    const emergencyQueue: QueueEntry = {
      id: queueId,
      facilityId: input.facilityId || state.currentUser?.facilityId || "hosp-default",
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

  const orderMedicine = useCallback((input: OrderMedicineInput): string => {
    const orderId = makeId("ord");
    const nowTs = Date.now();

    const order: MedicineOrder = {
      id: orderId,
      facilityId: input.facilityId || state.currentUser?.facilityId || "hosp-default",
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
    const nowTs = Date.now();

    const finishLocalSync = () => {
      setState((previous) => ({
        ...previous,
        patients: previous.patients.map((item) => ({ ...item, syncState: "synced" as const })),
        queue: previous.queue.map((item) => ({ ...item, syncState: "synced" as const })),
        encounters: previous.encounters.map((item) => ({ ...item, syncState: "synced" as const })),
        referrals: previous.referrals.map((item) => ({ ...item, syncState: "synced" as const })),
        medicines: previous.medicines.map((item) => ({ ...item, syncState: "synced" as const, lastSyncedAt: nowTs })),
        inventoryTransactions: previous.inventoryTransactions.map((item) => ({ ...item, syncState: "synced" as const })),
        beds: previous.beds.map((item) => ({ ...item, syncState: "synced" as const })),
        operations: [],
        lastSyncedAt: nowTs,
      }));
      setSyncing(false);
    };

    if (!transportRef.current || state.operations.length === 0) {
      finishLocalSync();
      return;
    }
    const batch = state.operations.map(serializeOperation);
    transportRef.current(batch)
      .then((result) => {
        const acked = new Set(result.acknowledgedIds);
        setState((previous) => ({
          ...previous,
          patients: previous.patients.map((item) => (acked.has(item.id) || !previous.operations.some((op) => op.entityId === item.id) ? { ...item, syncState: "synced" as const } : item)),
          queue: previous.queue.map((item) => (acked.has(item.id) || !previous.operations.some((op) => op.entityId === item.id) ? { ...item, syncState: "synced" as const } : item)),
          encounters: previous.encounters.map((item) => (acked.has(item.id) ? { ...item, syncState: "synced" as const } : item)),
          referrals: previous.referrals.map((item) => (acked.has(item.id) ? { ...item, syncState: "synced" as const } : item)),
          medicines: previous.medicines.map((item) => (acked.has(item.id) ? { ...item, syncState: "synced" as const, lastSyncedAt: nowTs } : item)),
          inventoryTransactions: previous.inventoryTransactions.map((item) => (acked.has(item.id) ? { ...item, syncState: "synced" as const } : item)),
          operations: previous.operations.filter((operation) => !acked.has(operation.id)),
          lastSyncedAt: result.acknowledgedAt || nowTs,
        }));
      })
      .catch(() => {
        finishLocalSync();
      })
      .finally(() => setSyncing(false));
  }, [state.operations, syncing]);

  const occupyBed = useCallback((bedId: string, patientId: string, notes?: string) => {
    const bed = state.beds.find((b) => b.id === bedId);
    if (!bed) return;

    setState((previous) => {
      const occupiedTime = Date.now();
      const next = {
        ...previous,
        beds: previous.beds.map((b) =>
          b.id === bedId
            ? { ...b, status: "occupied" as const, occupiedByPatientId: patientId, occupiedSince: occupiedTime, notes, syncState: "pending" as const, updatedAt: occupiedTime }
            : b
        ),
      };
      return addOperation(next, "bed.occupy", bedId);
    });
  }, [state.beds]);

  const releaseBed = useCallback((bedId: string) => {
    setState((previous) => {
      const timestamp = Date.now();
      const next = {
        ...previous,
        beds: previous.beds.map((b) =>
          b.id === bedId
            ? { ...b, status: "available" as const, occupiedByPatientId: undefined, occupiedSince: undefined, syncState: "pending" as const, updatedAt: timestamp }
            : b
        ),
      };
      return addOperation(next, "bed.release", bedId);
    });
  }, []);

  const getBedsByUnit = useCallback((unitId: string) => {
    return state.beds.filter((bed) => bed.unitId === unitId);
  }, [state.beds]);

  const getUnitStats = useCallback((unitId: string) => {
    const unit = state.hospitalUnits.find((u) => u.id === unitId);
    if (!unit) return null;

    const beds = state.beds.filter((b) => b.unitId === unitId);
    const occupied = beds.filter((b) => b.status === "occupied").length;
    const available = beds.filter((b) => b.status === "available").length;
    const maintenance = beds.filter((b) => b.status === "maintenance").length;

    return {
      unit,
      totalBeds: unit.totalBeds,
      occupiedBeds: occupied,
      availableBeds: available,
      maintenanceBeds: maintenance,
      occupancyRate: unit.totalBeds > 0 ? (occupied / unit.totalBeds) * 100 : 0,
    };
  }, [state.beds, state.hospitalUnits]);

  const setMaintenanceBed = useCallback((bedId: string, inMaintenance: boolean, notes?: string) => {
    setState((previous) => {
      const timestamp = Date.now();
      const next = {
        ...previous,
        beds: previous.beds.map((b) =>
          b.id === bedId
            ? {
                ...b,
                status: inMaintenance ? ("maintenance" as const) : ("available" as const),
                notes: inMaintenance ? notes : undefined,
                syncState: "pending" as const,
                updatedAt: timestamp,
              }
            : b
        ),
      };
      return addOperation(next, inMaintenance ? "bed.maintenance" : "bed.available", bedId);
    });
  }, []);

  const getNearbyHospitalsWithBeds = useCallback((maxDistance: number = 10) => {
    return state.hospitals
      .filter((h) => h.availableBeds > 0 && h.distanceKm <= maxDistance)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [state.hospitals]);

  const getFacilityUnits = useCallback((facilityId: string) => {
    return state.hospitalUnits.filter((unit) => unit.facilityId === facilityId);
  }, [state.hospitalUnits]);

  const getFacilityStats = useCallback((facilityId: string) => {
    const units = state.hospitalUnits.filter((u) => u.facilityId === facilityId);
    const beds = state.beds.filter((b) => units.some((u) => u.id === b.unitId));

    const totalBeds = beds.length;
    const occupiedBeds = beds.filter((b) => b.status === "occupied").length;
    const availableBeds = beds.filter((b) => b.status === "available").length;
    const maintenanceBeds = beds.filter((b) => b.status === "maintenance").length;

    return {
      facilityId,
      totalBeds,
      occupiedBeds,
      availableBeds,
      maintenanceBeds,
      occupancyRate: totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0,
      isFull: availableBeds === 0,
      units: units.map((u) => ({
        ...u,
        totalBeds: u.totalBeds,
        occupiedBeds: beds.filter((b) => b.unitId === u.id && b.status === "occupied").length,
        availableBeds: beds.filter((b) => b.unitId === u.id && b.status === "available").length,
      })),
    };
  }, [state.hospitalUnits, state.beds]);

  const addWard = useCallback((wardName: string, bedCount: number) => {
    if (!state.currentUser || state.currentUser.role !== "chief_doctor") {
      Alert.alert("Permission Denied", "Only the Chief Doctor can add wards.");
      return;
    }
    const timestamp = Date.now();
    const unitId = makeId("unit");
    const unit: HospitalUnit = {
      id: unitId,
      facilityId: state.currentUser.facilityId,
      name: wardName.trim(),
      type: "general_ward",
      totalBeds: bedCount,
      createdAt: timestamp,
      updatedAt: timestamp,
      syncState: "pending",
    };
    const beds: Bed[] = Array.from({ length: bedCount }, (_, i) => ({
      id: makeId(`bed-${i + 1}`),
      unitId,
      bedNumber: `${i + 1}`,
      status: "available" as const,
      createdAt: timestamp,
      updatedAt: timestamp,
      syncState: "pending" as const,
    }));
    setState((previous) => ({
      ...previous,
      hospitalUnits: [unit, ...previous.hospitalUnits],
      beds: [...beds, ...previous.beds],
    }));
  }, [state.currentUser]);

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
    setCurrentUser,
    registerPatient,
    joinQueue,
    updateQueueStatus,
    overrideQueuePriority,
    addEncounter,
    createReferral,
    updateReferralStatus,
    recordInventoryTransaction,
    addMedicine,
    bookAppointment,
    cancelAppointment,
    requestEmergencyAppointment,
    orderMedicine,
    updateMedicineOrderStatus,
    occupyBed,
    releaseBed,
    getBedsByUnit,
    getUnitStats,
    setMaintenanceBed,
    addWard,
    getNearbyHospitalsWithBeds,
    getFacilityUnits,
    getFacilityStats,
    syncNow,
    getPatient: (patientId) => state.patients.find((patient) => patient.id === patientId && patient.facilityId === state.currentUser?.facilityId),
    getPatientEncounters: (patientId) => state.encounters.filter((encounter) => encounter.patientId === patientId && encounter.facilityId === state.currentUser?.facilityId).sort((a, b) => b.createdAt - a.createdAt),
    getPatientAppointments: (patientId) => state.appointments.filter((a) => a.patientId === patientId && a.facilityId === state.currentUser?.facilityId).sort((a, b) => b.createdAt - a.createdAt),
    getPatientOrders: (patientId) => state.medicineOrders.filter((o) => o.patientId === patientId && o.facilityId === state.currentUser?.facilityId).sort((a, b) => b.createdAt - a.createdAt),
    getPatientActiveQueue: (patientId) => state.queue.find((q) => q.patientId === patientId && q.status !== "completed" && q.facilityId === state.currentUser?.facilityId),
  }), [addEncounter, addMedicine, bookAppointment, cancelAppointment, createReferral, getFacilityStats, getFacilityUnits, getNearbyHospitalsWithBeds, getBedsByUnit, getUnitStats, isHydrated, joinQueue, occupyBed, orderMedicine, overrideQueuePriority, recordInventoryTransaction, registerPatient, releaseBed, requestEmergencyAppointment, setLanguage, setCurrentUser, setMaintenanceBed, state, syncNow, syncing, syncError, updateMedicineOrderStatus, updateQueueStatus, updateReferralStatus]);

  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>;
}

export function useHealth() {
  const context = useContext(HealthContext);
  if (!context) throw new Error("useHealth must be used within HealthProvider");
  return context;
}
