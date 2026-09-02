import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, StyleSheet } from "react-native";
import { useHealth } from "@/lib/health/store";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#1a1a1a",
  },
  unitCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#2369A5",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  unitTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    color: "#2369A5",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    flexWrap: "wrap",
  },
  statItem: {
    flex: 1,
    marginRight: 8,
    marginBottom: 8,
    minWidth: "45%",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2369A5",
  },
  occupancyBar: {
    height: 8,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 12,
  },
  occupancyFill: {
    height: "100%",
    backgroundColor: "#4CAF50",
  },
  bedsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  bedItem: {
    width: "22%",
    aspectRatio: 1,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  bedAvailable: {
    backgroundColor: "#E8F5E9",
    borderColor: "#4CAF50",
  },
  bedOccupied: {
    backgroundColor: "#FFEBEE",
    borderColor: "#F44336",
  },
  bedMaintenance: {
    backgroundColor: "#FFF3E0",
    borderColor: "#FF9800",
  },
  bedNumber: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1a1a1a",
    textAlign: "center",
  },
  bedIcon: {
    marginBottom: 4,
  },
  button: {
    flexDirection: "row",
    backgroundColor: "#2369A5",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#1a1a1a",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonPrimary: {
    backgroundColor: "#2369A5",
  },
  actionButtonSecondary: {
    backgroundColor: "#FF9800",
  },
  actionButtonDanger: {
    backgroundColor: "#F44336",
  },
  actionButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    marginTop: 12,
  },
  isFull: {
    backgroundColor: "#FFEBEE",
    borderColor: "#F44336",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  isFullText: {
    color: "#F44336",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
});

type BedManagementScreenProps = {
  facilityId: string;
};

export function BedManagementScreen({ facilityId }: BedManagementScreenProps) {
  const health = useHealth();
  const [selectedBed, setSelectedBed] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [actionType, setActionType] = useState<"occupy" | "release" | "maintenance">("occupy");
  const [patientId, setPatientId] = useState("");
  const [notes, setNotes] = useState("");

  const facilityStats = health.getFacilityStats(facilityId);
  const units = health.getFacilityUnits(facilityId);

  const handleBedPress = (bedId: string, currentStatus: string) => {
    setSelectedBed(bedId);
    if (currentStatus === "occupied") {
      setActionType("release");
    } else if (currentStatus === "maintenance") {
      setActionType("release");
    } else {
      setActionType("occupy");
    }
    setModalVisible(true);
  };

  const handleSubmitAction = () => {
    if (!selectedBed) return;

    switch (actionType) {
      case "occupy":
        if (!patientId) {
          alert("Please enter patient ID");
          return;
        }
        health.occupyBed(selectedBed, patientId, notes);
        break;
      case "release":
        health.releaseBed(selectedBed);
        break;
      case "maintenance":
        health.setMaintenanceBed(selectedBed, true, notes);
        break;
    }

    setModalVisible(false);
    setPatientId("");
    setNotes("");
    setSelectedBed(null);
  };

  if (!facilityStats) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Bed Management</Text>
        <View style={styles.emptyState}>
          <MaterialIcons name="error-outline" size={48} color="#999" />
          <Text style={styles.emptyText}>Facility not found</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Bed Management</Text>

      {/* Facility Overview */}
      <View style={styles.unitCard}>
        <Text style={styles.unitTitle}>Facility Overview</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Beds</Text>
            <Text style={styles.statValue}>{facilityStats.totalBeds}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Occupied</Text>
            <Text style={[styles.statValue, { color: "#F44336" }]}>{facilityStats.occupiedBeds}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Available</Text>
            <Text style={[styles.statValue, { color: "#4CAF50" }]}>{facilityStats.availableBeds}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Maintenance</Text>
            <Text style={[styles.statValue, { color: "#FF9800" }]}>{facilityStats.maintenanceBeds}</Text>
          </View>
        </View>
        <Text style={styles.statLabel}>Occupancy Rate</Text>
        <View style={styles.occupancyBar}>
          <View style={[styles.occupancyFill, { width: `${Math.min(facilityStats.occupancyRate, 100)}%` }]} />
        </View>
        <Text style={styles.statValue}>{facilityStats.occupancyRate.toFixed(1)}%</Text>

        {facilityStats.isFull && (
          <View style={styles.isFull}>
            <MaterialIcons name="warning" size={20} color="#F44336" />
            <Text style={styles.isFullText}>All beds are occupied. Check nearby hospitals.</Text>
          </View>
        )}
      </View>

      {/* Units and Beds */}
      {units.map((unit) => {
        const unitStats = health.getUnitStats(unit.id);
        const beds = health.getBedsByUnit(unit.id);

        return (
          <View key={unit.id} style={styles.unitCard}>
            <Text style={styles.unitTitle}>{unit.name}</Text>
            {unitStats && (
              <>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Total</Text>
                    <Text style={styles.statValue}>{unitStats.totalBeds}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Occupied</Text>
                    <Text style={[styles.statValue, { color: "#F44336" }]}>{unitStats.occupiedBeds}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Available</Text>
                    <Text style={[styles.statValue, { color: "#4CAF50" }]}>{unitStats.availableBeds}</Text>
                  </View>
                </View>
                <Text style={styles.statLabel}>Occupancy</Text>
                <View style={styles.occupancyBar}>
                  <View style={[styles.occupancyFill, { width: `${Math.min(unitStats.occupancyRate, 100)}%` }]} />
                </View>
                <Text style={styles.statValue}>{unitStats.occupancyRate.toFixed(1)}%</Text>
              </>
            )}

            <Text style={[styles.statLabel, { marginTop: 16, marginBottom: 8 }]}>Beds</Text>
            <View style={styles.bedsGrid}>
              {beds.map((bed) => (
                <TouchableOpacity
                  key={bed.id}
                  style={[
                    styles.bedItem,
                    bed.status === "available"
                      ? styles.bedAvailable
                      : bed.status === "occupied"
                        ? styles.bedOccupied
                        : styles.bedMaintenance,
                  ]}
                  onPress={() => handleBedPress(bed.id, bed.status)}
                >
                  <MaterialIcons
                    name={bed.status === "available" ? "check-circle" : bed.status === "occupied" ? "person" : "build"}
                    size={20}
                    color={bed.status === "available" ? "#4CAF50" : bed.status === "occupied" ? "#F44336" : "#FF9800"}
                    style={styles.bedIcon}
                  />
                  <Text style={styles.bedNumber}>{bed.bedNumber}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      })}

      {/* Nearby Hospitals Button */}
      {facilityStats.isFull && (
        <TouchableOpacity style={styles.button}>
          <MaterialIcons name="local-hospital" size={20} color="white" />
          <Text style={styles.buttonText}>View Nearby Hospitals with Beds</Text>
        </TouchableOpacity>
      )}

      {/* Action Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              {actionType === "occupy" ? "Occupy Bed" : actionType === "release" ? "Release Bed" : "Maintenance"}
            </Text>

            {actionType === "occupy" && (
              <>
                <TextInput style={styles.input} placeholder="Patient ID" value={patientId} onChangeText={setPatientId} />
                <TextInput
                  style={styles.input}
                  placeholder="Notes (optional)"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                />
              </>
            )}

            {actionType === "maintenance" && (
              <TextInput
                style={styles.input}
                placeholder="Maintenance reason"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            )}

            <TouchableOpacity style={[styles.actionButton, styles.actionButtonPrimary]} onPress={handleSubmitAction}>
              <MaterialIcons name="check" size={20} color="white" />
              <Text style={styles.actionButtonText}>Confirm</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSecondary]}
              onPress={() => {
                setModalVisible(false);
                setPatientId("");
                setNotes("");
              }}
            >
              <MaterialIcons name="close" size={20} color="white" />
              <Text style={styles.actionButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
