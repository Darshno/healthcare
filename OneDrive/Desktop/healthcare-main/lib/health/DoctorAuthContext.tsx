import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, type PropsWithChildren } from "react";
import {
  type UserProfile,
  type DoctorProfile,
  type HealthWorkerProfile,
  type PatientProfile,
  type UserRole,
  type CreateUserInput,
  getStoredUserProfile,
  getRegisteredUsers,
  getRegisteredUsersByRole,
  storeUserSession,
  clearUserSession,
  createUserProfile,
  authenticateUser,
  PRESET_USERS,
} from "./userAuth";

export type UserAuthContextValue = {
  user: UserProfile | null;
  role: UserRole;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  registeredUsers: UserProfile[];
  // Role specific convenience getters
  doctor: DoctorProfile | null;
  healthWorker: HealthWorkerProfile | null;
  patient: PatientProfile | null;
  // Auth operations
  signIn: (identifier: string, passcode: string, targetRole?: UserRole) => Promise<void>;
  signUp: (input: CreateUserInput) => Promise<void>;
  signOut: () => Promise<void>;
  switchUser: (profile: UserProfile) => Promise<void>;
};

const UserAuthContext = createContext<UserAuthContextValue | undefined>(undefined);

export function DoctorAuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>(PRESET_USERS);

  useEffect(() => {
    async function init() {
      try {
        const stored = await getStoredUserProfile();
        if (stored) {
          setUser(stored);
        } else {
          // Default to first preset doctor for initial state if unassigned
          // But leave null so AuthGate displays role login screen
        }
        const registered = await getRegisteredUsers();
        setRegisteredUsers(registered);
      } catch (err) {
        console.error("User auth initialization failed:", err);
      } finally {
        setIsAuthReady(true);
      }
    }
    void init();
  }, []);

  const signIn = useCallback(async (identifier: string, passcode: string, targetRole?: UserRole) => {
    const authed = await authenticateUser(identifier, passcode, targetRole);
    setUser(authed);
    const updated = await getRegisteredUsers();
    setRegisteredUsers(updated);
  }, []);

  const signUp = useCallback(async (input: CreateUserInput) => {
    const created = await createUserProfile(input);
    setUser(created);
    const updated = await getRegisteredUsers();
    setRegisteredUsers(updated);
  }, []);

  const signOut = useCallback(async () => {
    await clearUserSession();
    setUser(null);
  }, []);

  const switchUser = useCallback(async (profile: UserProfile) => {
    await storeUserSession(profile);
    setUser(profile);
  }, []);

  const doctor = user?.role === "doctor" ? (user as DoctorProfile) : null;
  const healthWorker = user?.role === "health_worker" ? (user as HealthWorkerProfile) : null;
  const patient = user?.role === "patient" ? (user as PatientProfile) : null;

  const value: UserAuthContextValue = {
    user,
    role: user?.role || "doctor",
    isAuthenticated: !!user,
    isAuthReady,
    registeredUsers,
    doctor,
    healthWorker,
    patient,
    signIn,
    signUp,
    signOut,
    switchUser,
  };

  return <UserAuthContext.Provider value={value}>{children}</UserAuthContext.Provider>;
}

export function useUserAuth() {
  const context = useContext(UserAuthContext);
  if (!context) {
    throw new Error("useUserAuth must be used within DoctorAuthProvider");
  }
  return context;
}

/**
 * Backward compatibility hook for doctor-specific screens
 */
export function useDoctorAuth() {
  const context = useUserAuth();
  const registeredDoctors = useMemo(
    () => context.registeredUsers.filter((u) => u.role === "doctor") as DoctorProfile[],
    [context.registeredUsers],
  );

  const signUpDoctor = useCallback(
    async (input: any) => {
      await context.signUp({
        ...input,
        role: "doctor",
      });
    },
    [context],
  );

  return {
    ...context,
    doctor: context.doctor,
    registeredDoctors,
    signUp: signUpDoctor,
  };
}


