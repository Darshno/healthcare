import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState, useEffect, useCallback } from "react";
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
import { type UserRole } from "@/lib/health/userAuth";
import {
  getHospitals,
  registerHospital,
  type HospitalRecord,
} from "@/lib/health/hospitalRegistry";

// ──────────────────────────────────────────────────────────────────────────────
// Role meta
// ──────────────────────────────────────────────────────────────────────────────

type RoleOption = {
  id: UserRole | "chief_doctor";
  label: string;
  sublabel: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
  bg: string;
};

const ROLES: RoleOption[] = [
  {
    id: "chief_doctor",
    label: "Chief Doctor",
    sublabel: "Register your hospital & manage wards",
    icon: "medical-services",
    color: "#087E7B",
    bg: "#E6F5F3",
  },
  {
    id: "doctor",
    label: "Doctor",
    sublabel: "View patient queue & consultations",
    icon: "local-hospital",
    color: "#2369A5",
    bg: "#EAF4FF",
  },
  {
    id: "asha_worker",
    label: "ASHA Worker",
    sublabel: "Register patients & manage medicines",
    icon: "volunteer-activism",
    color: "#B66A00",
    bg: "#FFF4E5",
  },
  {
    id: "receptionist",
    label: "Receptionist",
    sublabel: "Register patients & manage arrivals",
    icon: "person-pin",
    color: "#6B3FA0",
    bg: "#F3EEFF",
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useUserAuth();

  const [activeRole, setActiveRole] = useState<UserRole>("chief_doctor");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [hospitals, setHospitals] = useState<HospitalRecord[]>([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Sign in form ──
  const [signInIdentifier, setSignInIdentifier] = useState("");
  const [signInPasscode, setSignInPasscode] = useState("");
  const [signInRole, setSignInRole] = useState<UserRole>("chief_doctor");

  // ── Sign up form ──
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [passcode, setPasscode] = useState("");
  // Chief doctor only
  const [hospitalName, setHospitalName] = useState("");
  // Staff fields
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>("");

  const refreshHospitals = useCallback(async () => {
    setHospitalsLoading(true);
    try {
      const list = await getHospitals();
      setHospitals(list);
      if (list.length > 0) {
        setSelectedHospitalId((prev) => (prev && list.some((h) => h.id === prev)) ? prev : list[0].id);
      }
    } catch {
      setHospitals([]);
    } finally {
      setHospitalsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshHospitals();
  }, [refreshHospitals]);

  const resetForm = () => {
    setName("");
    setPhone("");
    setPasscode("");
    setHospitalName("");
    setError(null);
  };

  const handleSignIn = async () => {
    if (!signInIdentifier.trim()) {
      setError("Please enter your Name, ID, or Phone number");
      return;
    }
    if (!signInPasscode.trim()) {
      setError("Please enter your passcode");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signIn(signInIdentifier.trim(), signInPasscode.trim(), signInRole);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    if (!passcode.trim() || passcode.trim().length < 4) {
      setError("Passcode must be at least 4 characters");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (activeRole === "chief_doctor") {
        // 1. Register the hospital first
        if (!hospitalName.trim()) { setError("Hospital name is required"); setLoading(false); return; }
        const tempId = `tmp-${Date.now()}`;
        const hospital = await registerHospital(hospitalName.trim(), tempId);
        // 2. Sign up the chief doctor
        await signUp({
          name: name.trim(),
          role: "chief_doctor",
          phone: phone.trim() || undefined,
          passcode: passcode.trim(),
          facilityName: hospital.name,
          facilityId: hospital.id,
        });
        await refreshHospitals();
      } else {
        // Staff doctor / asha / receptionist
        if (!selectedHospitalId) {
          setError("Please select your hospital");
          setLoading(false);
          return;
        }
        const hospital = hospitals.find((h) => h.id === selectedHospitalId);
        if (!hospital) {
          setError("Selected hospital not found");
          setLoading(false);
          return;
        }
        await signUp({
          name: name.trim(),
          role: activeRole,
          phone: phone.trim() || undefined,
          passcode: passcode.trim(),
          facilityName: hospital.name,
          facilityId: hospital.id,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const currentRoleMeta = ROLES.find((r) => r.id === activeRole) ?? ROLES[0];
  const isStaff = activeRole !== "chief_doctor";
  const noHospitalsWarning = isStaff && !hospitalsLoading && hospitals.length === 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.brandHeader}>
          <View style={styles.logoBadge}>
            <MaterialIcons name="local-hospital" size={34} color="#087E7B" />
          </View>
          <Text style={styles.brandTitle}>Rural Health Access</Text>
          <Text style={styles.brandSub}>Healthcare Management Platform</Text>
        </View>

        {/* Role Picker */}
        <Text style={styles.sectionLabel}>SELECT YOUR ROLE</Text>
        <View style={styles.roleGrid}>
          {ROLES.map((role) => {
            const active = activeRole === role.id;
            return (
              <Pressable
                key={role.id}
                onPress={() => {
                  setActiveRole(role.id as UserRole);
                  setSignInRole(role.id as UserRole);
                  setError(null);
                  resetForm();
                  void refreshHospitals();
                }}
                style={[styles.roleCard, active && { borderColor: role.color, borderWidth: 2, backgroundColor: role.bg }]}
              >
                <View style={[styles.roleIconBadge, active && { backgroundColor: role.color }]}>
                  <MaterialIcons name={role.icon} size={22} color={active ? "#fff" : "#6C817C"} />
                </View>
                <Text style={[styles.roleCardTitle, active && { color: role.color }]}>{role.label}</Text>
                <Text style={styles.roleCardSub}>{role.sublabel}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Mode Tabs */}
        <View style={styles.modeTabs}>
          {(["signin", "signup"] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => {
                setMode(m);
                setError(null);
                void refreshHospitals();
              }}
              style={[styles.modeTab, mode === m && { backgroundColor: currentRoleMeta.color }]}
            >
              <MaterialIcons
                name={m === "signin" ? "login" : "person-add"}
                size={16}
                color={mode === m ? "#fff" : "#6C817C"}
              />
              <Text style={[styles.modeTabText, mode === m && { color: "#fff", fontWeight: "900" }]}>
                {m === "signin" ? "Sign In" : "Register"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorBox}>
            <MaterialIcons name="error-outline" size={18} color="#B42318" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ─── SIGN IN ─── */}
        {mode === "signin" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign In as {currentRoleMeta.label}</Text>

            {/* Hospital Facility preview */}
            {hospitals.length > 0 && (
              <View style={styles.facilityBanner}>
                <MaterialIcons name="local-hospital" size={18} color="#087E7B" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.facilityBannerLabel}>Hospital Facility</Text>
                  <Text style={styles.facilityBannerName}>
                    {hospitals.find((h) => h.id === selectedHospitalId)?.name || hospitals[0]?.name}
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.inputLabel}>Name, Phone, or ID</Text>
            <TextInput
              value={signInIdentifier}
              onChangeText={setSignInIdentifier}
              placeholder={activeRole === "chief_doctor" || activeRole === "doctor" ? "e.g. Dr. Priya Sharma or DOC-1234" : "e.g. Sunita Devi or 9876543210"}
              placeholderTextColor="#8CA19B"
              style={styles.input}
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Passcode / PIN</Text>
            <TextInput
              value={signInPasscode}
              onChangeText={setSignInPasscode}
              placeholder="Enter your PIN"
              placeholderTextColor="#8CA19B"
              secureTextEntry
              keyboardType="number-pad"
              style={styles.input}
            />

            <Pressable
              onPress={handleSignIn}
              disabled={loading}
              style={({ pressed }) => [styles.primaryBtn, { backgroundColor: currentRoleMeta.color, opacity: pressed || loading ? 0.75 : 1 }]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <MaterialIcons name="login" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Sign In</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* ─── SIGN UP ─── */}
        {mode === "signup" && (
          <View style={styles.card}>
            <View style={[styles.rolePill, { backgroundColor: currentRoleMeta.bg }]}>
              <MaterialIcons name={currentRoleMeta.icon} size={18} color={currentRoleMeta.color} />
              <Text style={[styles.rolePillText, { color: currentRoleMeta.color }]}>
                Registering as {currentRoleMeta.label}
              </Text>
            </View>

            {/* ── Chief Doctor: create hospital ── */}
            {activeRole === "chief_doctor" && (
              <>
                <Text style={styles.cardSectionTitle}>🏥 Register Your Hospital</Text>
                <Text style={styles.inputLabel}>Hospital Name</Text>
                <TextInput
                  value={hospitalName}
                  onChangeText={setHospitalName}
                  placeholder="e.g. Nandipur Primary Health Centre"
                  placeholderTextColor="#8CA19B"
                  style={styles.input}
                />
                <View style={styles.infoBox}>
                  <MaterialIcons name="info-outline" size={16} color="#2369A5" />
                  <Text style={styles.infoText}>
                    As Chief Doctor you will set up wards, beds, and manage the hospital.
                    Other staff will select this hospital name when they register.
                  </Text>
                </View>
              </>
            )}

            {/* ── Staff: pick hospital ── */}
            {isStaff && (
              <>
                <Text style={styles.cardSectionTitle}>🏥 Select Hospital Facility</Text>
                {hospitalsLoading ? (
                  <ActivityIndicator color="#087E7B" style={{ marginVertical: 12 }} />
                ) : hospitals.length === 0 ? (
                  <View style={styles.warningBox}>
                    <MaterialIcons name="warning" size={20} color="#9A5B00" />
                    <Text style={styles.warningText}>
                      No hospital registered yet. Please ask your Chief Doctor to register the hospital first.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.hospitalListContainer}>
                    {hospitals.map((h) => {
                      const isSelected = selectedHospitalId === h.id || (!selectedHospitalId && hospitals[0]?.id === h.id);
                      return (
                        <Pressable
                          key={h.id}
                          onPress={() => setSelectedHospitalId(h.id)}
                          style={[
                            styles.hospitalCardItem,
                            isSelected && styles.hospitalCardItemSelected,
                          ]}
                        >
                          <MaterialIcons
                            name="local-hospital"
                            size={18}
                            color={isSelected ? "#087E7B" : "#6C817C"}
                          />
                          <Text
                            style={[
                              styles.hospitalCardItemText,
                              isSelected && styles.hospitalCardItemTextSelected,
                            ]}
                          >
                            {h.name}
                          </Text>
                          {isSelected && (
                            <MaterialIcons name="check-circle" size={18} color="#087E7B" style={{ marginLeft: "auto" }} />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </>
            )}

            {/* ── Common fields ── */}
            <Text style={styles.cardSectionTitle}>Your Details</Text>
            <Text style={styles.inputLabel}>
              {activeRole === "chief_doctor" || activeRole === "doctor" ? "Full Name (e.g. Dr. Priya)" : "Full Name"}
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor="#8CA19B"
              style={styles.input}
            />

            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="10-digit mobile number"
              placeholderTextColor="#8CA19B"
              keyboardType="phone-pad"
              style={styles.input}
            />

            <Text style={styles.inputLabel}>Set PIN / Passcode</Text>
            <TextInput
              value={passcode}
              onChangeText={setPasscode}
              placeholder="Min 4 digits"
              placeholderTextColor="#8CA19B"
              secureTextEntry
              keyboardType="number-pad"
              style={styles.input}
            />

            {(!isStaff || !noHospitalsWarning) && (
              <Pressable
                onPress={handleSignUp}
                disabled={loading || (isStaff && noHospitalsWarning)}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: currentRoleMeta.color, opacity: pressed || loading ? 0.75 : 1 },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <MaterialIcons name="person-add" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>
                      {activeRole === "chief_doctor" ? "Register Hospital & Sign In" : "Register & Sign In"}
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F7F5" },
  scroll: { paddingHorizontal: 18, gap: 16 },
  brandHeader: { alignItems: "center", marginBottom: 4, gap: 6 },
  logoBadge: {
    width: 68, height: 68, borderRadius: 20, backgroundColor: "#E6F5F3",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#087E7B", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  brandTitle: { color: "#18332F", fontSize: 22, fontWeight: "900", letterSpacing: -0.3 },
  brandSub: { color: "#6C817C", fontSize: 13, fontWeight: "600", textAlign: "center" },
  sectionLabel: { color: "#6C817C", fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  roleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  roleCard: {
    flex: 1, minWidth: "45%", backgroundColor: "#fff", borderRadius: 14,
    borderWidth: 1.5, borderColor: "#E0EBE7", padding: 12, gap: 6,
    alignItems: "flex-start",
  },
  roleIconBadge: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: "#F0F4F2",
    alignItems: "center", justifyContent: "center",
  },
  roleCardTitle: { color: "#18332F", fontSize: 14, fontWeight: "800" },
  roleCardSub: { color: "#6C817C", fontSize: 11, fontWeight: "600", lineHeight: 15 },
  modeTabs: { flexDirection: "row", gap: 8 },
  modeTab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 11, borderRadius: 12, backgroundColor: "#FFFFFF",
    borderWidth: 1, borderColor: "#E0EBE7",
  },
  modeTabText: { color: "#6C817C", fontSize: 14, fontWeight: "700" },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FDECEC", borderRadius: 12, padding: 12,
  },
  errorText: { color: "#B42318", fontSize: 13, fontWeight: "700", flex: 1, lineHeight: 18 },
  card: {
    backgroundColor: "#fff", borderRadius: 18, padding: 18, gap: 4,
    shadowColor: "#18332F", shadowOpacity: 0.06, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  cardTitle: { color: "#18332F", fontSize: 19, fontWeight: "900", marginBottom: 10 },
  cardSectionTitle: { color: "#18332F", fontSize: 14, fontWeight: "900", marginTop: 10, marginBottom: 2 },
  inputLabel: { color: "#4A6560", fontSize: 12, fontWeight: "800", marginTop: 8, marginBottom: 4 },
  input: {
    backgroundColor: "#F7FAF9", borderColor: "#D5E1DD", borderRadius: 12, borderWidth: 1,
    color: "#18332F", fontSize: 15, minHeight: 48, paddingHorizontal: 14,
  },
  primaryBtn: {
    alignItems: "center", borderRadius: 14, flexDirection: "row", gap: 8,
    justifyContent: "center", minHeight: 50, marginTop: 14, paddingHorizontal: 18,
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  rolePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
    marginBottom: 4,
  },
  rolePillText: { fontSize: 13, fontWeight: "800" },
  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#EAF4FF", borderRadius: 12, padding: 12, marginTop: 4,
  },
  infoText: { color: "#2369A5", fontSize: 12, fontWeight: "700", flex: 1, lineHeight: 17 },
  warningBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "#FFF4E5", borderRadius: 12, padding: 14, marginVertical: 6,
  },
  warningText: { color: "#9A5B00", fontSize: 13, fontWeight: "700", flex: 1, lineHeight: 19 },
  facilityBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#E6F5F3", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#B2DFDB", marginBottom: 10,
  },
  facilityBannerLabel: { color: "#087E7B", fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  facilityBannerName: { color: "#18332F", fontSize: 14, fontWeight: "800", marginTop: 2 },
  hospitalListContainer: { gap: 8, marginVertical: 6 },
  hospitalCardItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#F7FAF9", borderRadius: 12, borderWidth: 1.5,
    borderColor: "#D5E1DD", paddingHorizontal: 14, paddingVertical: 12,
  },
  hospitalCardItemSelected: {
    backgroundColor: "#E6F5F3", borderColor: "#087E7B",
  },
  hospitalCardItemText: { color: "#4A6560", fontSize: 14, fontWeight: "700", flex: 1 },
  hospitalCardItemTextSelected: { color: "#087E7B", fontWeight: "900" },
  hospitalScroll: { marginBottom: 4 },
  hospitalChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#F7FAF9", borderRadius: 10, borderWidth: 1.5,
    borderColor: "#D5E1DD", paddingHorizontal: 12, paddingVertical: 8, marginRight: 8,
  },
  hospitalChipText: { color: "#4A6560", fontSize: 13, fontWeight: "700" },
  inlineRoles: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  inlineRoleBtn: {
    borderRadius: 8, borderWidth: 1.5, borderColor: "#D5E1DD",
    paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "#F7FAF9",
  },
  inlineRoleBtnText: { color: "#4A6560", fontSize: 12, fontWeight: "700" },
});
