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

const EMPTY_STATE: HealthState = {
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
  // Bed Management Actions
  occupyBed: (bedId: string, patientId: string, notes?: string) => void;
  releaseBed: (bedId: string) => void;
  getBedsByUnit: (unitId: string) => Bed[];
  getUnitStats: (unitId: string) => { unit: HospitalUnit; totalBeds: number; occupiedBeds: number; availableBeds: number; maintenanceBeds: number; occupancyRate: number } | null;
  setMaintenanceBed: (bedId: string, inMaintenance: boolean, notes?: string) => void;
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
          setState({
            ...EMPTY_STATE,
            ...parsed,
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
    occupyBed,
    releaseBed,
    getBedsByUnit,
    getUnitStats,
    setMaintenanceBed,
    getNearbyHospitalsWithBeds,
    getFacilityUnits,
    getFacilityStats,
    syncNow,
    getPatient: (patientId) => state.patients.find((patient) => patient.id === patientId),
    getPatientEncounters: (patientId) => state.encounters.filter((encounter) => encounter.patientId === patientId).sort((a, b) => b.createdAt - a.createdAt),
    getPatientAppointments: (patientId) => state.appointments.filter((a) => a.patientId === patientId).sort((a, b) => b.createdAt - a.createdAt),
    getPatientOrders: (patientId) => state.medicineOrders.filter((o) => o.patientId === patientId).sort((a, b) => b.createdAt - a.createdAt),
    getPatientActiveQueue: (patientId) => state.queue.find((q) => q.patientId === patientId && q.status !== "completed"),
  }), [addEncounter, bookAppointment, cancelAppointment, createReferral, getFacilityStats, getFacilityUnits, getNearbyHospitalsWithBeds, getBedsByUnit, getUnitStats, isHydrated, joinQueue, occupyBed, orderMedicine, overrideQueuePriority, recordInventoryTransaction, registerPatient, releaseBed, requestEmergencyAppointment, setLanguage, setMaintenanceBed, state, syncNow, syncing, syncError, updateMedicineOrderStatus, updateQueueStatus, updateReferralStatus]);

  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>;
}

export function useHealth() {
  const context = useContext(HealthContext);
  if (!context) throw new Error("useHealth must be used within HealthProvider");
  return context;
}
