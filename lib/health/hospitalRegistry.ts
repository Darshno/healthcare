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

// Bumped to v3 to discard old data alongside the user registry reset
const HOSPITAL_REGISTRY_KEY = "rural-health-access.hospitals.v3";

// ──────────────────────────────────────────────────────────────────────────────
// Read helpers
// ──────────────────────────────────────────────────────────────────────────────

export async function getHospitals(): Promise<HospitalRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(HOSPITAL_REGISTRY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HospitalRecord[];
  } catch {
    return [];
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
    throw new Error(`A hospital named "${name}" is already registered.`);
  }

  await AsyncStorage.setItem(
    HOSPITAL_REGISTRY_KEY,
    JSON.stringify([hospital, ...all]),
  );
  return hospital;
}
