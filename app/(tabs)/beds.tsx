import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useHealth } from "@/lib/health/store";
import { BedManagementScreen } from "@/components/health/BedManagementScreen";
import { NearbyHospitalsScreen } from "@/components/health/NearbyHospitalsScreen";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  facilitySwitcher: {
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  switcherLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 8,
    fontWeight: "600",
  },
  facilityButtons: {
    flexDirection: "row",
    gap: 8,
  },
  facilityButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    backgroundColor: "white",
  },
  facilityButtonActive: {
    borderColor: "#2369A5",
    backgroundColor: "#E3F2FD",
  },
  facilityButtonText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
  },
  facilityButtonTextActive: {
    color: "#2369A5",
  },
  viewToggle: {
    flexDirection: "row",
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    backgroundColor: "white",
  },
  toggleButtonActive: {
    borderColor: "#2369A5",
    backgroundColor: "#E3F2FD",
  },
  toggleButtonText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
    marginLeft: 6,
  },
  toggleButtonTextActive: {
    color: "#2369A5",
  },
  contentArea: {
    flex: 1,
  },
  header: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#666",
  },
  infoCard: {
    backgroundColor: "#E3F2FD",
    margin: 16,
    padding: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#2369A5",
    lineHeight: 18,
  },
});

type View = "management" | "nearby";

export default function BedTrackerScreen() {
  const health = useHealth();
  const [selectedFacility, setSelectedFacility] = useState("hosp-1");
  const [view, setView] = useState<View>("management");
  const [isFull, setIsFull] = useState(false);

  // Get list of available facilities
  const facilities = health.state.hospitals || [];

  // Check if current facility is full
  useEffect(() => {
    const stats = health.getFacilityStats(selectedFacility);
    setIsFull(stats?.isFull || false);
  }, [selectedFacility, health.state.beds, health.state.hospitalUnits]);

  // Auto-switch to nearby view when facility becomes full
  useEffect(() => {
    if (isFull && view === "management") {
      Alert.alert(
        "Beds Full",
        "All beds are occupied at this facility. Would you like to view nearby hospitals?",
        [
          { text: "Stay", onPress: () => {} },
          { text: "View Nearby", onPress: () => setView("nearby") },
        ]
      );
    }
  }, [isFull]);

  return (
    <View style={styles.container}>
      {/* Facility Switcher */}
      <View style={styles.facilitySwitcher}>
        <Text style={styles.switcherLabel}>Select Hospital</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.facilityButtons}>
          {facilities.map((facility) => (
            <TouchableOpacity
              key={facility.id}
              style={[styles.facilityButton, selectedFacility === facility.id && styles.facilityButtonActive]}
              onPress={() => setSelectedFacility(facility.id)}
            >
              <Text
                style={[
                  styles.facilityButtonText,
                  selectedFacility === facility.id && styles.facilityButtonTextActive,
                ]}
              >
                {facility.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* View Toggle */}
      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[styles.toggleButton, view === "management" && styles.toggleButtonActive]}
          onPress={() => setView("management")}
        >
          <MaterialIcons name="hotel" size={18} color={view === "management" ? "#2369A5" : "#666"} />
          <Text style={[styles.toggleButtonText, view === "management" && styles.toggleButtonTextActive]}>
            Manage Beds
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleButton, view === "nearby" && styles.toggleButtonActive]}
          onPress={() => setView("nearby")}
        >
          <MaterialIcons name="search" size={18} color={view === "nearby" ? "#2369A5" : "#666"} />
          <Text style={[styles.toggleButtonText, view === "nearby" && styles.toggleButtonTextActive]}>
            Nearby Hospitals
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content Area */}
      <View style={styles.contentArea}>
        {view === "management" ? (
          <>
            {isFull && (
              <View style={styles.infoCard}>
                <MaterialIcons name="warning" size={20} color="#2369A5" style={styles.infoIcon} />
                <Text style={styles.infoText}>
                  All beds at this facility are occupied. Tap the "Nearby Hospitals" tab to find alternatives.
                </Text>
              </View>
            )}
            <BedManagementScreen facilityId={selectedFacility} />
          </>
        ) : (
          <NearbyHospitalsScreen currentFacilityId={selectedFacility} maxDistance={15} />
        )}
      </View>
    </View>
  );
}
