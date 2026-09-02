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

  if (!input.facilityName) {
    throw new Error("Facility name is required.");
  }
  const facilityName = input.facilityName.trim();
  const facilityId = input.facilityId ?? 1;

  if (!input.passcode) {
    throw new Error("A passcode is required.");
  }
  const passcodeHash = hashPasscode(input.passcode.trim());

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
