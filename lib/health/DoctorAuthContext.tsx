import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type PropsWithChildren,
} from "react";
import {
  type UserProfile,
  type DoctorProfile,
  type HealthWorkerProfile,
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
  role: UserRole | null;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  registeredUsers: UserProfile[];
  // Role-specific convenience getters
  doctor: DoctorProfile | null;
  healthWorker: HealthWorkerProfile | null;
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
  // Start with empty array — no preset users
  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    async function init() {
      try {
        const stored = await getStoredUserProfile();
        if (stored) {
          setUser(stored);
        }
        const registered = await getRegisteredUsers();
        // Merge stored with PRESET_USERS (which is now []) to stay type-safe
        setRegisteredUsers([...registered, ...PRESET_USERS.filter(
          (p) => !registered.find((r) => r.id === p.id)
        )]);
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

  const role = user?.role ?? null;
  const doctor = (role === "doctor" || role === "chief_doctor")
    ? (user as DoctorProfile)
    : null;
  const healthWorker = (role === "asha_worker" || role === "receptionist")
    ? (user as HealthWorkerProfile)
    : null;

  const value: UserAuthContextValue = {
    user,
    role,
    isAuthenticated: !!user,
    isAuthReady,
    registeredUsers,
    doctor,
    healthWorker,
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
    () =>
      context.registeredUsers.filter(
        (u) => u.role === "doctor" || u.role === "chief_doctor",
      ) as DoctorProfile[],
    [context.registeredUsers],
  );

  const signUpDoctor = useCallback(
    async (input: any) => {
      await context.signUp({
        ...input,
        role: input.isChiefDoctor ? "chief_doctor" : "doctor",
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
