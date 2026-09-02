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
    return list;
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
