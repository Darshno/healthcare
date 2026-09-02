import AsyncStorage from "@react-native-async-storage/async-storage";

export type UserRole = "doctor" | "health_worker" | "patient";

export type DoctorSpecialization =
  | "General Medicine (MBBS)"
  | "Pediatrics / Child Health"
  | "Obstetrics & Gynecology"
  | "Emergency & Trauma Care"
  | "Community Medicine / MO"
  | "General Surgery"
  | "Dental & Oral Health";

export type BaseUserProfile = {
  id: string;
  name: string;
  role: UserRole;
  phone?: string;
  email?: string;
  passcodeHash?: string;
  facilityName: string;
  facilityId: number;
  createdAt: number;
  lastLoginAt: number;
};

export type DoctorProfile = BaseUserProfile & {
  role: "doctor";
  doctorId: string; // e.g. "MCI-48201"
  specialization: DoctorSpecialization | string;
};

export type HealthWorkerProfile = BaseUserProfile & {
  role: "health_worker";
  workerId: string; // e.g. "ASHA-101"
  designation: "ASHA Facilitator" | "ANM Community Nurse" | "Clinic Health Helper" | "Anganwadi Worker";
  assignedVillage?: string;
};

export type PatientProfile = BaseUserProfile & {
  role: "patient";
  patientId: string; // linked to Patient.id e.g. "p-101"
  localId: string; // e.g. "RH-1024"
  abhaId: string; // e.g. "91-4820-9912-3401"
  age: number;
  gender: "female" | "male" | "other";
  bloodGroup?: string;
  allergies?: string[];
  careTags?: ("maternal" | "child" | "chronic" | "general")[];
};

export type UserProfile = DoctorProfile | HealthWorkerProfile | PatientProfile;

export type CreateUserInput = {
  name: string;
  role: UserRole;
  phone?: string;
  email?: string;
  passcode?: string;
  facilityName?: string;
  facilityId?: number;
  // Doctor fields
  doctorId?: string;
  specialization?: string;
  // Health worker fields
  workerId?: string;
  designation?: HealthWorkerProfile["designation"];
  assignedVillage?: string;
  // Patient fields
  patientId?: string;
  localId?: string;
  abhaId?: string;
  age?: number;
  gender?: "female" | "male" | "other";
  bloodGroup?: string;
};

const USER_PROFILE_KEY = "rural-health-access.user-profile.v2";
const USER_REGISTRY_KEY = "rural-health-access.user-registry.v2";
const PORTAL_TOKEN_KEY = "rural-health-access.portal-token";

export const DEFAULT_DEMO_PIN = "1234";

function simpleHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

export function hashPasscode(passcode: string): string {
  return simpleHash(passcode.trim());
}

export function verifyPasscode(entered: string, storedHash: string): boolean {
  return simpleHash(entered.trim()) === storedHash;
}

const DEMO_PIN_HASH = hashPasscode(DEFAULT_DEMO_PIN);

// ─── Preset Demo Accounts ──────────────────────────────────────────────────────

export const PRESET_USERS: UserProfile[] = [
  // ─── Doctors ───
  {
    id: "doc-101",
    name: "Dr. Asha Verma",
    role: "doctor",
    doctorId: "MCI-48201",
    specialization: "Community Medicine / MO",
    facilityName: "Nandipur Primary Health Centre",
    facilityId: 1,
    phone: "98765 43210",
    email: "dr.asha@phc.in",
    passcodeHash: DEMO_PIN_HASH,
    createdAt: Date.now() - 86400000 * 30,
    lastLoginAt: Date.now(),
  },
  {
    id: "doc-102",
    name: "Dr. Rajesh Gupta",
    role: "doctor",
    doctorId: "MCI-29184",
    specialization: "Pediatrics / Child Health",
    facilityName: "Nandipur Primary Health Centre",
    facilityId: 1,
    phone: "98765 11223",
    email: "dr.rajesh@phc.in",
    passcodeHash: DEMO_PIN_HASH,
    createdAt: Date.now() - 86400000 * 15,
    lastLoginAt: Date.now(),
  },
  {
    id: "doc-103",
    name: "Dr. Meenakshi Iyer",
    role: "doctor",
    doctorId: "MCI-67092",
    specialization: "Obstetrics & Gynecology",
    facilityName: "Nandipur Primary Health Centre",
    facilityId: 1,
    phone: "98765 88990",
    email: "dr.meenakshi@phc.in",
    passcodeHash: DEMO_PIN_HASH,
    createdAt: Date.now() - 86400000 * 10,
    lastLoginAt: Date.now(),
  },

  // ─── Health Helpers / ASHA ───
  {
    id: "hw-201",
    name: "Sunita Sharma",
    role: "health_worker",
    workerId: "ASHA-101",
    designation: "ASHA Facilitator",
    assignedVillage: "Nandipur Ward 4",
    facilityName: "Nandipur Primary Health Centre",
    facilityId: 1,
    phone: "98765 22334",
    email: "sunita.asha@phc.in",
    passcodeHash: DEMO_PIN_HASH,
    createdAt: Date.now() - 86400000 * 60,
    lastLoginAt: Date.now(),
  },
  {
    id: "hw-202",
    name: "Priya Patel",
    role: "health_worker",
    workerId: "ANM-204",
    designation: "ANM Community Nurse",
    assignedVillage: "Rampur East",
    facilityName: "Rampur Community Health Centre",
    facilityId: 2,
    phone: "98765 55667",
    email: "priya.anm@chc.in",
    passcodeHash: DEMO_PIN_HASH,
    createdAt: Date.now() - 86400000 * 45,
    lastLoginAt: Date.now(),
  },

  // ─── Patients ───
  {
    id: "pat-301",
    name: "Asha Devi",
    role: "patient",
    patientId: "p-101",
    localId: "RH-1024",
    abhaId: "91-4820-9912-3401",
    age: 27,
    gender: "female",
    bloodGroup: "B+",
    facilityName: "Nandipur Primary Health Centre",
    facilityId: 1,
    phone: "98765 18120",
    email: "asha.devi@gmail.com",
    careTags: ["maternal"],
    allergies: ["None recorded"],
    passcodeHash: DEMO_PIN_HASH,
    createdAt: Date.now() - 86400000 * 90,
    lastLoginAt: Date.now(),
  },
  {
    id: "pat-302",
    name: "Savitri Bai",
    role: "patient",
    patientId: "p-103",
    localId: "RH-1026",
    abhaId: "91-7712-3390-1124",
    age: 62,
    gender: "female",
    bloodGroup: "O+",
    facilityName: "Nandipur Primary Health Centre",
    facilityId: 1,
    phone: "97123 10130",
    email: "savitri.bai@gmail.com",
    careTags: ["chronic"],
    allergies: ["Penicillin"],
    passcodeHash: DEMO_PIN_HASH,
    createdAt: Date.now() - 86400000 * 120,
    lastLoginAt: Date.now(),
  },
  {
    id: "pat-303",
    name: "Imran Khan",
    role: "patient",
    patientId: "p-104",
    localId: "RH-1027",
    abhaId: "91-5544-2211-8890",
    age: 48,
    gender: "male",
    bloodGroup: "A+",
    facilityName: "Nandipur Primary Health Centre",
    facilityId: 1,
    phone: "99887 84200",
    email: "imran.khan@gmail.com",
    careTags: ["general", "chronic"],
    allergies: ["None recorded"],
    passcodeHash: DEMO_PIN_HASH,
    createdAt: Date.now() - 86400000 * 40,
    lastLoginAt: Date.now(),
  },
];

function safeBase64Encode(str: string): string {
  if (typeof btoa === "function") return btoa(str);
  if (typeof Buffer !== "undefined") return Buffer.from(str).toString("base64");
  return "";
}

function syncPortalToken(token: string) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(PORTAL_TOKEN_KEY, token);
    }
  } catch {
    /* noop */
  }
}

function removePortalToken() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(PORTAL_TOKEN_KEY);
    }
  } catch {
    /* noop */
  }
}

export async function getStoredUserProfile(): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export async function getRegisteredUsers(): Promise<UserProfile[]> {
  try {
    const raw = await AsyncStorage.getItem(USER_REGISTRY_KEY);
    if (!raw) return PRESET_USERS;
    const parsed = JSON.parse(raw) as UserProfile[];
    const existingIds = new Set(parsed.map((u) => u.id.toLowerCase()));
    const merged = [...parsed];
    for (const preset of PRESET_USERS) {
      if (!existingIds.has(preset.id.toLowerCase())) {
        merged.push(preset);
      }
    }
    return merged;
  } catch {
    return PRESET_USERS;
  }
}

export async function getRegisteredUsersByRole(role: UserRole): Promise<UserProfile[]> {
  const all = await getRegisteredUsers();
  return all.filter((u) => u.role === role);
}

export async function saveRegisteredUser(profile: UserProfile): Promise<void> {
  try {
    const all = await getRegisteredUsers();
    const updated = [profile, ...all.filter((u) => u.id.toLowerCase() !== profile.id.toLowerCase())];
    await AsyncStorage.setItem(USER_REGISTRY_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Failed to save registered user:", error);
  }
}

export async function storeUserSession(profile: UserProfile): Promise<void> {
  try {
    const updatedProfile = { ...profile, lastLoginAt: Date.now() };
    await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(updatedProfile));
    await saveRegisteredUser(updatedProfile);

    // Sync token with portal auth
    const syntheticToken = safeBase64Encode(
      JSON.stringify({
        openId: profile.id,
        name: profile.name,
        role: profile.role,
        facilityId: profile.facilityId,
        facilityName: profile.facilityName,
      }),
    );
    syncPortalToken(`eyJhbGciOiJIUzI1NiJ9.${syntheticToken}.user_session`);
  } catch (error) {
    console.error("Failed to store user session:", error);
  }
}

export async function clearUserSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(USER_PROFILE_KEY);
    removePortalToken();
  } catch (error) {
    console.error("Failed to clear user session:", error);
  }
}

export async function createUserProfile(input: CreateUserInput): Promise<UserProfile> {
  const timestamp = Date.now();
  const id = `${input.role.slice(0, 3)}-${timestamp.toString(36)}`;
  const facilityName = input.facilityName?.trim() || "Nandipur Primary Health Centre";
  const facilityId = input.facilityId ?? 1;
  const passcodeHash = input.passcode?.trim() ? hashPasscode(input.passcode.trim()) : DEMO_PIN_HASH;

  let profile: UserProfile;

  if (input.role === "doctor") {
    const formattedName = input.name.trim().startsWith("Dr.") ? input.name.trim() : `Dr. ${input.name.trim()}`;
    profile = {
      id,
      name: formattedName,
      role: "doctor",
      doctorId: input.doctorId?.trim() || `DOC-${Math.floor(1000 + Math.random() * 9000)}`,
      specialization: input.specialization || "General Medicine (MBBS)",
      facilityName,
      facilityId,
      phone: input.phone?.trim(),
      email: input.email?.trim(),
      passcodeHash,
      createdAt: timestamp,
      lastLoginAt: timestamp,
    };
  } else if (input.role === "health_worker") {
    profile = {
      id,
      name: input.name.trim(),
      role: "health_worker",
      workerId: input.workerId?.trim() || `ASHA-${Math.floor(100 + Math.random() * 900)}`,
      designation: input.designation || "ASHA Facilitator",
      assignedVillage: input.assignedVillage?.trim() || "Nandipur Area",
      facilityName,
      facilityId,
      phone: input.phone?.trim(),
      email: input.email?.trim(),
      passcodeHash,
      createdAt: timestamp,
      lastLoginAt: timestamp,
    };
  } else {
    // Patient
    const randNum = Math.floor(1000 + Math.random() * 9000);
    profile = {
      id,
      name: input.name.trim(),
      role: "patient",
      patientId: input.patientId || `p-${randNum}`,
      localId: input.localId || `RH-${randNum}`,
      abhaId: input.abhaId || `91-${randNum}-4412-8821`,
      age: input.age || 30,
      gender: input.gender || "female",
      bloodGroup: input.bloodGroup || "O+",
      facilityName,
      facilityId,
      phone: input.phone?.trim(),
      email: input.email?.trim(),
      careTags: ["general"],
      allergies: ["None recorded"],
      passcodeHash,
      createdAt: timestamp,
      lastLoginAt: timestamp,
    };
  }

  await storeUserSession(profile);
  return profile;
}

export async function authenticateUser(
  identifier: string,
  passcode: string,
  targetRole?: UserRole,
): Promise<UserProfile> {
  const query = identifier.trim().toLowerCase();
  const all = await getRegisteredUsers();

  const found = all.find((u) => {
    if (targetRole && u.role !== targetRole) return false;
    const matchesName = u.name.toLowerCase() === query || u.name.toLowerCase().includes(query);
    const matchesEmail = u.email?.toLowerCase() === query;
    const matchesPhone = u.phone?.replace(/\s+/g, "") === query.replace(/\s+/g, "");

    let matchesId = false;
    if (u.role === "doctor") matchesId = u.doctorId.toLowerCase() === query;
    else if (u.role === "health_worker") matchesId = u.workerId.toLowerCase() === query;
    else if (u.role === "patient") matchesId = u.localId.toLowerCase() === query || u.abhaId.toLowerCase() === query || u.patientId.toLowerCase() === query;

    return matchesName || matchesEmail || matchesPhone || matchesId;
  });

  if (!found) {
    throw new Error(
      `No user profile found matching "${identifier}". Please check your details or create a new account.`,
    );
  }

  if (found.passcodeHash) {
    if (!passcode?.trim()) {
      throw new Error("Please enter your PIN or passcode.");
    }
    if (!verifyPasscode(passcode, found.passcodeHash)) {
      throw new Error("Incorrect PIN / passcode. Please try again.");
    }
  }

  await storeUserSession(found);
  return found;
}
