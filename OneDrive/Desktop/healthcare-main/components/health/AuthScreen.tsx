import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState, useMemo } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUserAuth } from "@/lib/health/DoctorAuthContext";
import {
  PRESET_USERS,
  type UserProfile,
  type UserRole,
  type DoctorSpecialization,
  DEFAULT_DEMO_PIN,
} from "@/lib/health/userAuth";

const DOCTOR_SPECIALTIES: DoctorSpecialization[] = [
  "General Medicine (MBBS)",
  "Pediatrics / Child Health",
  "Obstetrics & Gynecology",
  "Emergency & Trauma Care",
  "Community Medicine / MO",
  "General Surgery",
  "Dental & Oral Health",
];

const HEALTH_WORKER_DESIGNATIONS = [
  "ASHA Facilitator",
  "ANM Community Nurse",
  "Clinic Health Helper",
  "Anganwadi Worker",
] as const;

export function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp, registeredUsers } = useUserAuth();

  const [activeRole, setActiveRole] = useState<UserRole>("doctor");
  const [mode, setMode] = useState<"quick" | "signin" | "signup">("quick");

  // Sign In inputs
  const [signInIdentifier, setSignInIdentifier] = useState("");
  const [signInPasscode, setSignInPasscode] = useState("");

  // Sign Up inputs
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [facilityName, setFacilityName] = useState("Nandipur Primary Health Centre");

  // Role-specific signup
  const [doctorId, setDoctorId] = useState("");
  const [specialization, setSpecialization] = useState<DoctorSpecialization>("General Medicine (MBBS)");
  const [workerId, setWorkerId] = useState("");
  const [designation, setDesignation] = useState<(typeof HEALTH_WORKER_DESIGNATIONS)[number]>("ASHA Facilitator");
  const [assignedVillage, setAssignedVillage] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"female" | "male" | "other">("female");
  const [bloodGroup, setBloodGroup] = useState("B+");
  const [abhaId, setAbhaId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter registered users by active role
  const roleUsers = useMemo(() => {
    return registeredUsers.filter((u) => u.role === activeRole);
  }, [registeredUsers, activeRole]);

  const handleQuickLogin = async (profile: UserProfile) => {
    setLoading(true);
    setError(null);
    try {
      await signIn(profile.name, DEFAULT_DEMO_PIN, profile.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quick sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleManualSignIn = async () => {
    if (!signInIdentifier.trim()) {
      setError("Please enter your Name, ID, or Phone number");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signIn(signInIdentifier.trim(), signInPasscode.trim() || DEFAULT_DEMO_PIN, activeRole);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signUp({
        name: name.trim(),
        role: activeRole,
        phone: phone.trim(),
        email: email.trim(),
        passcode: passcode.trim() || DEFAULT_DEMO_PIN,
        facilityName: facilityName.trim(),
        doctorId: activeRole === "doctor" ? doctorId.trim() : undefined,
        specialization: activeRole === "doctor" ? specialization : undefined,
        workerId: activeRole === "health_worker" ? workerId.trim() : undefined,
        designation: activeRole === "health_worker" ? designation : undefined,
        assignedVillage: activeRole === "health_worker" ? assignedVillage.trim() : undefined,
        age: activeRole === "patient" ? (parseInt(age, 10) || 30) : undefined,
        gender: activeRole === "patient" ? gender : undefined,
        bloodGroup: activeRole === "patient" ? bloodGroup : undefined,
        abhaId: activeRole === "patient" ? abhaId.trim() : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const roleMeta = {
    doctor: {
      title: "Doctor / Medical Officer",
      subtitle: "Clinical Consultations, Triage, Patient Calling & Referrals",
      icon: "medical-services" as const,
      color: "#087E7B",
      bgColor: "#E6F5F3",
      idPlaceholder: "Doctor ID (e.g. MCI-48201), Name or Email",
    },
    health_worker: {
      title: "Health Helper / ASHA",
      subtitle: "Community Care, Vitals Intake, OPD Registration & Dispensing",
      icon: "volunteer-activism" as const,
      color: "#B66A00",
      bgColor: "#FFF4E5",
      idPlaceholder: "Worker ID (e.g. ASHA-101), Name or Phone",
    },
    patient: {
      title: "Patient Portal",
      subtitle: "Live Queue Tracking, Health Records, Appointments & Medicines",
      icon: "person" as const,
      color: "#1B6B93",
      bgColor: "#E9F4F9",
      idPlaceholder: "ABHA ID, Patient ID (RH-1024), Name or Phone",
    },
  };

  const currentMeta = roleMeta[activeRole];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Branding Header */}
        <View style={styles.brandHeader}>
          <View style={styles.logoBadge}>
            <MaterialIcons name="local-hospital" size={32} color="#087E7B" />
          </View>
          <Text style={styles.brandTitle}>Rural Health Access</Text>
          <Text style={styles.brandSub}>Unified Rural Healthcare & Patient Information Platform</Text>
        </View>

        {/* 3-Role Segmented Switcher */}
        <View style={styles.roleSelectorCard}>
          <Text style={styles.roleSelectorLabel}>SELECT YOUR ACCESS ROLE:</Text>
          <View style={styles.roleTabsRow}>
            {(["doctor", "health_worker", "patient"] as const).map((role) => {
              const active = activeRole === role;
              const meta = roleMeta[role];
              return (
                <Pressable
                  key={role}
                  onPress={() => {
                    setActiveRole(role);
                    setError(null);
                  }}
                  style={[
                    styles.roleTabBtn,
                    active && {
                      backgroundColor: meta.bgColor,
                      borderColor: meta.color,
                      borderWidth: 2,
                    },
                  ]}
                >
                  <MaterialIcons
                    name={meta.icon}
                    size={22}
                    color={active ? meta.color : "#6C817C"}
                  />
                  <Text
                    style={[
                      styles.roleTabBtnText,
                      active && { color: meta.color, fontWeight: "900" },
                    ]}
                  >
                    {role === "doctor" ? "Doctor" : role === "health_worker" ? "Health Helper" : "Patient"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Active Role Banner */}
          <View style={[styles.activeRoleBanner, { backgroundColor: currentMeta.bgColor, borderColor: currentMeta.color }]}>
            <MaterialIcons name={currentMeta.icon} size={20} color={currentMeta.color} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.activeRoleTitle, { color: currentMeta.color }]}>{currentMeta.title}</Text>
              <Text style={styles.activeRoleSub}>{currentMeta.subtitle}</Text>
            </View>
          </View>
        </View>

        {/* Sub-mode Navigation Tabs */}
        <View style={styles.modeNav}>
          <Pressable
            onPress={() => { setMode("quick"); setError(null); }}
            style={[styles.modeBtn, mode === "quick" && styles.modeBtnActive]}
          >
            <MaterialIcons name="touch-app" size={18} color={mode === "quick" ? "#087E7B" : "#6C817C"} />
            <Text style={[styles.modeBtnText, mode === "quick" && styles.modeBtnTextActive]}>
              1-Click Demo Logins
            </Text>
          </Pressable>

          <Pressable
            onPress={() => { setMode("signin"); setError(null); }}
            style={[styles.modeBtn, mode === "signin" && styles.modeBtnActive]}
          >
            <MaterialIcons name="login" size={18} color={mode === "signin" ? "#087E7B" : "#6C817C"} />
            <Text style={[styles.modeBtnText, mode === "signin" && styles.modeBtnTextActive]}>
              Sign In with PIN
            </Text>
          </Pressable>

          <Pressable
            onPress={() => { setMode("signup"); setError(null); }}
            style={[styles.modeBtn, mode === "signup" && styles.modeBtnActive]}
          >
            <MaterialIcons name="person-add" size={18} color={mode === "signup" ? "#087E7B" : "#6C817C"} />
            <Text style={[styles.modeBtnText, mode === "signup" && styles.modeBtnTextActive]}>
              New Register
            </Text>
          </Pressable>
        </View>

        {/* Error Alert */}
        {error ? (
          <View style={styles.errorAlert}>
            <MaterialIcons name="error-outline" size={18} color="#B42318" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ─── Mode 1: 1-Click Quick Demo Logins ─── */}
        {mode === "quick" && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Choose an Active {activeRole === "doctor" ? "Doctor" : activeRole === "health_worker" ? "Health Worker" : "Patient"}</Text>
              <Text style={styles.cardSub}>Tap any profile below for instant access with demo credentials.</Text>
            </View>

            <View style={styles.profilesList}>
              {roleUsers.map((profile) => (
                <Pressable
                  key={profile.id}
                  onPress={() => handleQuickLogin(profile)}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.profileCard,
                    { opacity: pressed || loading ? 0.75 : 1 },
                  ]}
                >
                  <View style={[styles.profileAvatar, { backgroundColor: currentMeta.color }]}>
                    <Text style={styles.profileAvatarText}>
                      {profile.name.replace(/^Dr\.\s*/i, "").slice(0, 2).toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.profileTitleRow}>
                      <Text style={styles.profileName}>{profile.name}</Text>
                      <View style={[styles.roleBadge, { backgroundColor: currentMeta.bgColor }]}>
                        <Text style={[styles.roleBadgeText, { color: currentMeta.color }]}>
                          {profile.role === "doctor" ? (profile as any).specialization : profile.role === "health_worker" ? (profile as any).designation : `Age ${(profile as any).age} · ${(profile as any).gender}`}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.profileFacility}>
                      {profile.facilityName}
                    </Text>

                    <View style={styles.profileMetaRow}>
                      {profile.role === "doctor" && (
                        <Text style={styles.profileIdText}>ID: {(profile as any).doctorId}</Text>
                      )}
                      {profile.role === "health_worker" && (
                        <Text style={styles.profileIdText}>Worker ID: {(profile as any).workerId} · {(profile as any).assignedVillage}</Text>
                      )}
                      {profile.role === "patient" && (
                        <Text style={styles.profileIdText}>Health ID: {(profile as any).abhaId} · Ref: {(profile as any).localId}</Text>
                      )}
                    </View>
                  </View>

                  <MaterialIcons name="arrow-forward-ios" size={16} color="#8CA19B" />
                </Pressable>
              ))}
            </View>

            <View style={styles.quickPinHint}>
              <MaterialIcons name="info-outline" size={16} color="#54716B" />
              <Text style={styles.quickPinHintText}>
                Demo PIN for all accounts is preset to <Text style={{ fontWeight: "900", color: "#087E7B" }}>1234</Text>.
              </Text>
            </View>
          </View>
        )}

        {/* ─── Mode 2: Manual Sign In ─── */}
        {mode === "signin" && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Sign In to {currentMeta.title}</Text>
              <Text style={styles.cardSub}>Enter your registered ID, Phone number, or Name and PIN.</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>ID, Phone Number, or Name</Text>
              <TextInput
                value={signInIdentifier}
                onChangeText={setSignInIdentifier}
                placeholder={currentMeta.idPlaceholder}
                placeholderTextColor="#8CA19B"
                style={styles.input}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Passcode / PIN (Demo default: 1234)</Text>
              <TextInput
                value={signInPasscode}
                onChangeText={setSignInPasscode}
                placeholder="Enter 4-digit PIN"
                placeholderTextColor="#8CA19B"
                secureTextEntry
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>

            <Pressable
              onPress={handleManualSignIn}
              disabled={loading}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: currentMeta.color, opacity: loading ? 0.7 : pressed ? 0.85 : 1 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Sign In as {activeRole === "doctor" ? "Doctor" : activeRole === "health_worker" ? "Health Worker" : "Patient"}</Text>
                  <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* ─── Mode 3: New Account Registration ─── */}
        {mode === "signup" && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Register New {currentMeta.title}</Text>
              <Text style={styles.cardSub}>Create a new profile with role-specific access credentials.</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={activeRole === "doctor" ? "Dr. Sunita Rao" : activeRole === "health_worker" ? "Kavita Devi" : "Ramesh Chand"}
                placeholderTextColor="#8CA19B"
                style={styles.input}
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="98765 00000"
                  placeholderTextColor="#8CA19B"
                  keyboardType="phone-pad"
                  style={styles.input}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>4-Digit PIN (Passcode)</Text>
                <TextInput
                  value={passcode}
                  onChangeText={setPasscode}
                  placeholder="1234"
                  placeholderTextColor="#8CA19B"
                  keyboardType="number-pad"
                  secureTextEntry
                  style={styles.input}
                />
              </View>
            </View>

            {/* Doctor specific fields */}
            {activeRole === "doctor" && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Medical Registration / Doctor ID</Text>
                  <TextInput
                    value={doctorId}
                    onChangeText={setDoctorId}
                    placeholder="MCI-99482"
                    placeholderTextColor="#8CA19B"
                    style={styles.input}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Specialization</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
                    {DOCTOR_SPECIALTIES.map((spec) => {
                      const active = specialization === spec;
                      return (
                        <Pressable
                          key={spec}
                          onPress={() => setSpecialization(spec)}
                          style={[styles.pill, active && styles.pillActive]}
                        >
                          <Text style={[styles.pillText, active && styles.pillTextActive]}>{spec}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              </>
            )}

            {/* Health Worker specific fields */}
            {activeRole === "health_worker" && (
              <>
                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Worker ID</Text>
                    <TextInput
                      value={workerId}
                      onChangeText={setWorkerId}
                      placeholder="ASHA-208"
                      placeholderTextColor="#8CA19B"
                      style={styles.input}
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Assigned Village/Ward</Text>
                    <TextInput
                      value={assignedVillage}
                      onChangeText={setAssignedVillage}
                      placeholder="Nandipur Sector 2"
                      placeholderTextColor="#8CA19B"
                      style={styles.input}
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Designation</Text>
                  <View style={styles.tagWrapRow}>
                    {HEALTH_WORKER_DESIGNATIONS.map((desig) => {
                      const active = designation === desig;
                      return (
                        <Pressable
                          key={desig}
                          onPress={() => setDesignation(desig)}
                          style={[styles.pill, active && styles.pillActive]}
                        >
                          <Text style={[styles.pillText, active && styles.pillTextActive]}>{desig}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </>
            )}

            {/* Patient specific fields */}
            {activeRole === "patient" && (
              <>
                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Age (Years)</Text>
                    <TextInput
                      value={age}
                      onChangeText={setAge}
                      placeholder="32"
                      placeholderTextColor="#8CA19B"
                      keyboardType="number-pad"
                      style={styles.input}
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Gender</Text>
                    <View style={styles.genderRow}>
                      {(["female", "male", "other"] as const).map((g) => (
                        <Pressable
                          key={g}
                          onPress={() => setGender(g)}
                          style={[styles.genderBtn, gender === g && styles.genderBtnActive]}
                        >
                          <Text style={[styles.genderBtnText, gender === g && styles.genderBtnTextActive]}>
                            {g.charAt(0).toUpperCase() + g.slice(1)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>ABHA / Health ID (Optional)</Text>
                  <TextInput
                    value={abhaId}
                    onChangeText={setAbhaId}
                    placeholder="91-4820-9912-3401"
                    placeholderTextColor="#8CA19B"
                    style={styles.input}
                  />
                </View>
              </>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Assigned Health Facility</Text>
              <TextInput
                value={facilityName}
                onChangeText={setFacilityName}
                placeholder="Nandipur Primary Health Centre"
                placeholderTextColor="#8CA19B"
                style={styles.input}
              />
            </View>

            <Pressable
              onPress={handleSignUp}
              disabled={loading}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: currentMeta.color, opacity: loading ? 0.7 : pressed ? 0.85 : 1 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Complete Registration</Text>
                  <MaterialIcons name="check-circle" size={18} color="#FFFFFF" />
                </>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F8F6",
  },
  scroll: {
    paddingHorizontal: 16,
    maxWidth: 580,
    width: "100%",
    alignSelf: "center",
  },
  brandHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#E6F5F3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: "#BEE6E2",
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#18332F",
    letterSpacing: -0.3,
  },
  brandSub: {
    fontSize: 12,
    color: "#54716B",
    marginTop: 3,
    textAlign: "center",
  },
  roleSelectorCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2ECE8",
    marginBottom: 14,
  },
  roleSelectorLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#6C817C",
    letterSpacing: 0.6,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  roleTabsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  roleTabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: "#F4F7F5",
    borderWidth: 1,
    borderColor: "#DCE7E3",
  },
  roleTabBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#54716B",
  },
  activeRoleBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  activeRoleTitle: {
    fontSize: 13,
    fontWeight: "900",
  },
  activeRoleSub: {
    fontSize: 11,
    color: "#54716B",
    marginTop: 1,
  },
  modeNav: {
    flexDirection: "row",
    backgroundColor: "#E7EFEA",
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
    gap: 2,
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    borderRadius: 9,
  },
  modeBtnActive: {
    backgroundColor: "#FFFFFF",
    ...Platform.select({
      web: { boxShadow: "0 1px 3px rgba(0,0,0,0.06)" } as any,
      default: { elevation: 1 },
    }),
  },
  modeBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6C817C",
  },
  modeBtnTextActive: {
    color: "#087E7B",
    fontWeight: "900",
  },
  errorAlert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FDECEC",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F7C3C0",
    marginBottom: 14,
  },
  errorText: {
    color: "#B42318",
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2ECE8",
  },
  cardHeader: {
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#18332F",
  },
  cardSub: {
    fontSize: 12,
    color: "#54716B",
    marginTop: 2,
  },
  profilesList: {
    gap: 10,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F9FBFB",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E4EDE9",
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  profileTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    flexWrap: "wrap",
  },
  profileName: {
    fontSize: 14,
    fontWeight: "900",
    color: "#18332F",
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  profileFacility: {
    fontSize: 11,
    color: "#54716B",
    marginTop: 2,
  },
  profileMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 3,
  },
  profileIdText: {
    fontSize: 10,
    color: "#8CA19B",
    fontWeight: "700",
  },
  quickPinHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F2F7F5",
    padding: 10,
    borderRadius: 8,
    marginTop: 14,
  },
  quickPinHintText: {
    fontSize: 11,
    color: "#54716B",
  },
  formGroup: {
    marginBottom: 12,
  },
  formRow: {
    flexDirection: "row",
    gap: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: "#54716B",
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: "#F7FAF9",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D5E1DD",
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: "#18332F",
  },
  pillRow: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 4,
  },
  tagWrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#F2F6F4",
    borderWidth: 1,
    borderColor: "#D5E1DD",
    marginRight: 6,
  },
  pillActive: {
    backgroundColor: "#E6F5F3",
    borderColor: "#087E7B",
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#54716B",
  },
  pillTextActive: {
    color: "#087E7B",
    fontWeight: "900",
  },
  genderRow: {
    flexDirection: "row",
    gap: 4,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#F2F6F4",
    borderWidth: 1,
    borderColor: "#D5E1DD",
  },
  genderBtnActive: {
    backgroundColor: "#E6F5F3",
    borderColor: "#087E7B",
  },
  genderBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#54716B",
  },
  genderBtnTextActive: {
    color: "#087E7B",
    fontWeight: "900",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
});
