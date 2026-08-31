import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useUserAuth } from "@/lib/health/DoctorAuthContext";
import { AuthScreen } from "./AuthScreen";

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

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F4F7F5",
    alignItems: "center",
    justifyContent: "center",
  },
});

