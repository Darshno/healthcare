import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useBedTracker, useUnitBeds, useUpdateBedStatus, useAvailableBedCount, useNearbyFacilitiesWithBeds } from '@/hooks/use-bed-tracker';
import type { HospitalUnit, BedRecord, FacilityWithBeds } from '@/lib/health/bed-types';

interface BedTrackerScreenProps {
  facilityId: number;
  latitude?: string;
  longitude?: string;
}

export function BedTrackerScreen({ facilityId, latitude, longitude }: BedTrackerScreenProps) {
  const { units, loading: unitsLoading } = useBedTracker(facilityId);
  const { availableBeds } = useAvailableBedCount(facilityId);
  const { updateBedStatus } = useUpdateBedStatus();
  const { facilities: nearbyFacilities } = useNearbyFacilitiesWithBeds(latitude || null, longitude || null);
  const [selectedUnit, setSelectedUnit] = useState<HospitalUnit | null>(null);
  const [showNearby, setShowNearby] = useState(false);

  const totalBeds = units.reduce((sum, unit) => sum + unit.totalBeds, 0);
  const occupiedBeds = units.reduce((sum, unit) => sum + unit.occupiedBeds, 0);
  const allBedsFilled = availableBeds === 0 && totalBeds > 0;

  return (
    <ScrollView style={styles.container}>
      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.title}>Bed Availability</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Beds</Text>
            <Text style={styles.summaryValue}>{totalBeds}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Occupied</Text>
            <Text style={[styles.summaryValue, { color: '#d32f2f' }]}>{occupiedBeds}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Available</Text>
            <Text style={[styles.summaryValue, { color: '#388e3c' }]}>{availableBeds}</Text>
          </View>
        </View>
        
        {allBedsFilled && (
          <TouchableOpacity 
            style={styles.warningBanner}
            onPress={() => setShowNearby(!showNearby)}
          >
            <Text style={styles.warningText}>⚠️ All beds filled! Tap to view nearby hospitals</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Units List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Units ({units.length})</Text>
        {unitsLoading ? (
          <ActivityIndicator size="large" color="#0066cc" />
        ) : (
          units.map((unit) => (
            <TouchableOpacity
              key={unit.id}
              style={[
                styles.unitCard,
                selectedUnit?.id === unit.id && styles.unitCardActive,
              ]}
              onPress={() => setSelectedUnit(selectedUnit?.id === unit.id ? null : unit)}
            >
              <View style={styles.unitHeader}>
                <Text style={styles.unitName}>{unit.name}</Text>
                <Text style={styles.unitBeds}>
                  {unit.totalBeds} beds • {unit.occupiedBeds} occupied
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${(unit.occupiedBeds / unit.totalBeds) * 100}%` },
                  ]}
                />
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Beds Detail */}
      {selectedUnit && (
        <UnitBedsDetail unit={selectedUnit} onUpdateBed={updateBedStatus} />
      )}

      {/* Nearby Facilities */}
      {showNearby && nearbyFacilities.length > 0 && (
        <NearbyFacilitiesList facilities={nearbyFacilities} />
      )}
    </ScrollView>
  );
}

interface UnitBedsDetailProps {
  unit: HospitalUnit;
  onUpdateBed: (bedId: number, status: string, patientId?: string) => Promise<any>;
}

function UnitBedsDetail({ unit, onUpdateBed }: UnitBedsDetailProps) {
  const { beds, loading } = useUnitBeds(Number(unit.id));
  const [updating, setUpdating] = useState<string | null>(null);

  const handleBedToggle = async (bed: BedRecord) => {
    setUpdating(bed.id);
    try {
      const newStatus = bed.status === 'available' ? 'occupied' : 'available';
      await onUpdateBed(Number(bed.id), newStatus);
      // Refresh beds after update
    } catch (error) {
      Alert.alert('Error', 'Failed to update bed status');
    } finally {
      setUpdating(null);
    }
  };

  return (
    <View style={styles.bedsDetailSection}>
      <Text style={styles.sectionTitle}>Beds in {unit.name}</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#0066cc" />
      ) : (
        <View style={styles.bedsGrid}>
          {beds.map((bed) => (
            <TouchableOpacity
              key={bed.id}
              style={[
                styles.bedTile,
                bed.status === 'occupied' && styles.bedOccupied,
                bed.status === 'maintenance' && styles.bedMaintenance,
                bed.status === 'reserved' && styles.bedReserved,
              ]}
              onPress={() => handleBedToggle(bed)}
              disabled={updating === bed.id}
            >
              {updating === bed.id && (
                <ActivityIndicator size="small" color="#fff" />
              )}
              {!updating && (
                <>
                  <Text style={styles.bedNumber}>{bed.bedNumber}</Text>
                  <Text style={styles.bedStatus}>
                    {bed.status === 'available' ? '✓' : bed.status === 'occupied' ? '✗' : '⚙'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

interface NearbyFacilitiesListProps {
  facilities: FacilityWithBeds[];
}

function NearbyFacilitiesList({ facilities }: NearbyFacilitiesListProps) {
  return (
    <View style={styles.nearbySection}>
      <Text style={styles.sectionTitle}>Nearby Hospitals with Beds</Text>
      {facilities.map((facility) => (
        <View key={facility.id} style={styles.facilityCard}>
          <View style={styles.facilityHeader}>
            <Text style={styles.facilityName}>{facility.name}</Text>
            {facility.distance && (
              <Text style={styles.distance}>{facility.distance.toFixed(1)} km away</Text>
            )}
          </View>
          <Text style={styles.facilityAddress}>{facility.location.address}</Text>
          <Text style={styles.facilityPhone}>📞 {facility.location.phoneNumber}</Text>
          <View style={styles.bedsInfo}>
            <Text style={styles.bedsInfoText}>
              Available: {facility.availableBeds} / {facility.totalBeds} beds
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 12,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  warningBanner: {
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
    padding: 12,
    borderRadius: 4,
    marginTop: 12,
  },
  warningText: {
    color: '#856404',
    fontWeight: '500',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  unitCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    elevation: 1,
  },
  unitCardActive: {
    borderLeftWidth: 4,
    borderLeftColor: '#0066cc',
    backgroundColor: '#f0f7ff',
  },
  unitHeader: {
    marginBottom: 8,
  },
  unitName: {
    fontSize: 14,
    fontWeight: '600',
  },
  unitBeds: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ff9800',
  },
  bedsDetailSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
  },
  bedsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bedTile: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4caf50',
  },
  bedOccupied: {
    backgroundColor: '#ffebee',
    borderColor: '#d32f2f',
  },
  bedMaintenance: {
    backgroundColor: '#f3e5f5',
    borderColor: '#7b1fa2',
  },
  bedReserved: {
    backgroundColor: '#fff3e0',
    borderColor: '#f57c00',
  },
  bedNumber: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  bedStatus: {
    fontSize: 16,
  },
  nearbySection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
  },
  facilityCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0066cc',
  },
  facilityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  facilityName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  distance: {
    fontSize: 12,
    color: '#666',
  },
  facilityAddress: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  facilityPhone: {
    fontSize: 12,
    fontWeight: '500',
    color: '#0066cc',
    marginBottom: 8,
  },
  bedsInfo: {
    backgroundColor: '#e3f2fd',
    borderRadius: 4,
    padding: 8,
  },
  bedsInfoText: {
    fontSize: 12,
    color: '#0066cc',
    fontWeight: '500',
  },
});
