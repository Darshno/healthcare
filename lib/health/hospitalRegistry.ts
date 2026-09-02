/**
 * Hospital Registry
 *
 * Stores the list of registered hospitals in AsyncStorage (local-device).
 * The chief doctor creates the hospital when they first sign up.
 * Other staff pick their hospital from the dropdown during registration.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export type HospitalRecord = {
  id: string;           // e.g. "hosp-1abc234"
  name: string;
  chiefDoctorId: string;
  createdAt: number;
};

const HOSPITAL_REGISTRY_KEY = "rural-health-access.hospitals.v3";

export const DEFAULT_HOSPITALS: HospitalRecord[] = [
  {
    id: "hosp-nandipur-01",
    name: "Nandipur Primary Health Centre",
    chiefDoctorId: "doc-chief-01",
    createdAt: 1700000000000,
  },
  {
    id: "hosp-chandpur-02",
    name: "Chandpur Community Health Centre (CHC)",
    chiefDoctorId: "doc-chief-02",
    createdAt: 1700000001000,
  },
  {
    id: "hosp-rampur-03",
    name: "Rampur Sub-Divisional Civil Hospital",
    chiefDoctorId: "doc-chief-03",
    createdAt: 1700000002000,
  },
  {
    id: "hosp-shivpur-04",
    name: "Shivpur District General Hospital",
    chiefDoctorId: "doc-chief-04",
    createdAt: 1700000003000,
  },
  {
    id: "hosp-kalyanpur-05",
    name: "Kalyanpur Rural Referral Centre",
    chiefDoctorId: "doc-chief-05",
    createdAt: 1700000004000,
  },
  {
    id: "hosp-meerapur-06",
    name: "Meerapur Primary Health Centre",
    chiefDoctorId: "doc-chief-06",
    createdAt: 1700000005000,
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Read helpers
// ──────────────────────────────────────────────────────────────────────────────

export async function getHospitals(): Promise<HospitalRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(HOSPITAL_REGISTRY_KEY);
    if (!raw) {
      await AsyncStorage.setItem(HOSPITAL_REGISTRY_KEY, JSON.stringify(DEFAULT_HOSPITALS));
      return DEFAULT_HOSPITALS;
    }
    const list = JSON.parse(raw) as HospitalRecord[];
    if (!Array.isArray(list) || list.length === 0) {
      await AsyncStorage.setItem(HOSPITAL_REGISTRY_KEY, JSON.stringify(DEFAULT_HOSPITALS));
      return DEFAULT_HOSPITALS;
    }
    // Merge defaults so all default hospitals are always present alongside custom registered ones
    const combined = [...list];
    for (const def of DEFAULT_HOSPITALS) {
      if (!combined.some((h) => h.id === def.id || h.name.toLowerCase() === def.name.toLowerCase())) {
        combined.push(def);
      }
    }
    return combined;
  } catch {
    return DEFAULT_HOSPITALS;
  }
}

export async function getHospitalById(id: string): Promise<HospitalRecord | null> {
  const all = await getHospitals();
  return all.find((h) => h.id === id) ?? null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Write helpers
// ──────────────────────────────────────────────────────────────────────────────

export async function registerHospital(
  name: string,
  chiefDoctorId: string,
): Promise<HospitalRecord> {
  const id = `hosp-${Date.now().toString(36)}`;
  const hospital: HospitalRecord = {
    id,
    name: name.trim(),
    chiefDoctorId,
    createdAt: Date.now(),
  };

  const all = await getHospitals();
  // Prevent duplicates by name (case-insensitive)
  const exists = all.find(
    (h) => h.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );
  if (exists) {
    return exists;
  }

  const updated = [hospital, ...all];
  await AsyncStorage.setItem(
    HOSPITAL_REGISTRY_KEY,
    JSON.stringify(updated),
  );
  return hospital;
}
