import AsyncStorage from "@react-native-async-storage/async-storage";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export type UserRole = "chief_doctor" | "doctor" | "asha_worker" | "receptionist";

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
  facilityId: string; // hospital UUID from hospitalRegistry
  createdAt: number;
  lastLoginAt: number;
};

export type DoctorProfile = BaseUserProfile & {
  role: "chief_doctor" | "doctor";
  doctorId: string;
  specialization: DoctorSpecialization | string;
};

export type HealthWorkerProfile = BaseUserProfile & {
  role: "asha_worker" | "receptionist";
  workerId: string;
  designation: "ASHA Worker" | "ANM Community Nurse" | "Receptionist" | "Anganwadi Worker";
  assignedVillage?: string;
};

// Patient is no longer a user role in auth — kept for backward compat
export type PatientProfile = BaseUserProfile & {
  role: never;
};

export type UserProfile = DoctorProfile | HealthWorkerProfile;

export type CreateUserInput = {
  name: string;
  role: UserRole;
  phone?: string;
  email?: string;
  passcode?: string;
  facilityName: string;
  facilityId: string;
  // Doctor fields
  doctorId?: string;
  specialization?: string;
  // Health worker fields
  workerId?: string;
  designation?: HealthWorkerProfile["designation"];
  assignedVillage?: string;
};

// Empty preset — no demo users
export const PRESET_USERS: UserProfile[] = [];

// ──────────────────────────────────────────────────────────────────────────────
// Storage Keys  (bumped to v3 so old v2 data is ignored)
// ──────────────────────────────────────────────────────────────────────────────

const USER_PROFILE_KEY = "rural-health-access.user-profile.v3";
const USER_REGISTRY_KEY = "rural-health-access.user-registry.v3";
const PORTAL_TOKEN_KEY = "rural-health-access.portal-token";

// ──────────────────────────────────────────────────────────────────────────────
// Hashing helpers
// ──────────────────────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────────────────────
// Portal token sync
// ──────────────────────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────────────────────
// CRUD
// ──────────────────────────────────────────────────────────────────────────────

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
    if (!raw) return [];
    return JSON.parse(raw) as UserProfile[];
  } catch {
    return [];
  }
}

export async function getRegisteredUsersByRole(role: UserRole): Promise<UserProfile[]> {
  const all = await getRegisteredUsers();
  return all.filter((u) => u.role === role);
}

export async function saveRegisteredUser(profile: UserProfile): Promise<void> {
  try {
    const all = await getRegisteredUsers();
    const updated = [profile, ...all.filter((u) => u.id !== profile.id)];
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

  if (!input.facilityName?.trim()) throw new Error("Facility name is required.");
  if (!input.facilityId?.trim()) throw new Error("Hospital is required.");
  if (!input.passcode?.trim()) throw new Error("A passcode is required.");

  const passcodeHash = hashPasscode(input.passcode.trim());
  let profile: UserProfile;

  if (input.role === "chief_doctor" || input.role === "doctor") {
    const formattedName = input.name.trim().startsWith("Dr.")
      ? input.name.trim()
      : `Dr. ${input.name.trim()}`;
    profile = {
      id,
      name: formattedName,
      role: input.role,
      doctorId: input.doctorId?.trim() || `DOC-${Math.floor(1000 + Math.random() * 9000)}`,
      specialization: input.specialization || "General Medicine (MBBS)",
      facilityName: input.facilityName.trim(),
      facilityId: input.facilityId,
      phone: input.phone?.trim(),
      email: input.email?.trim(),
      passcodeHash,
      createdAt: timestamp,
      lastLoginAt: timestamp,
    } as DoctorProfile;
  } else {
    profile = {
      id,
      name: input.name.trim(),
      role: input.role,
      workerId: input.workerId?.trim() || `WORK-${Math.floor(100 + Math.random() * 900)}`,
      designation: input.designation || (input.role === "receptionist" ? "Receptionist" : "ASHA Worker"),
      assignedVillage: input.assignedVillage?.trim(),
      facilityName: input.facilityName.trim(),
      facilityId: input.facilityId,
      phone: input.phone?.trim(),
      email: input.email?.trim(),
      passcodeHash,
      createdAt: timestamp,
      lastLoginAt: timestamp,
    } as HealthWorkerProfile;
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
    const matchesPhone = u.phone?.replace(/\s+/g, "") === query.replace(/\s+/g, "");

    let matchesId = false;
    if (u.role === "chief_doctor" || u.role === "doctor") {
      matchesId = (u as DoctorProfile).doctorId.toLowerCase() === query;
    } else {
      matchesId = (u as HealthWorkerProfile).workerId.toLowerCase() === query;
    }

    return matchesName || matchesPhone || matchesId;
  });

  if (!found) {
    throw new Error(
      `No user found matching "${identifier}". Check your details or register a new account.`,
    );
  }

  if (found.passcodeHash) {
    if (!passcode?.trim()) throw new Error("Please enter your PIN or passcode.");
    if (!verifyPasscode(passcode, found.passcodeHash)) {
      throw new Error("Incorrect PIN / passcode. Please try again.");
    }
  }

  await storeUserSession(found);
  return found;
}
