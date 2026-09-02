import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useUserAuth } from "@/lib/health/DoctorAuthContext";
import { useHealth } from "@/lib/health/store";
import { AuthScreen } from "./AuthScreen";

/**
 * Bridges the auth context user into the health store's currentUser,
 * so that registerPatient() and other actions know who is logged in.
 */
function CurrentUserSync() {
  const { user } = useUserAuth();
  const { setCurrentUser } = useHealth();

  useEffect(() => {
    if (user) {
      setCurrentUser({
        id: user.id,
        name: user.name,
        facilityId: user.facilityId,
        facilityName: user.facilityName,
        role: user.role as any,
      });
    } else {
      setCurrentUser(null);
    }
  }, [user, setCurrentUser]);

  return null;
}

export function DoctorAuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAuthReady } = useUserAuth();

  if (!isAuthReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#087E7B" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <>
      <CurrentUserSync />
      {children}
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F4F7F5",
    alignItems: "center",
    justifyContent: "center",
  },
});
