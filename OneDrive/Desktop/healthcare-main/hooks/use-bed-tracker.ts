import { useCallback, useEffect, useState } from 'react';
import { useTrpc } from './use-trpc';
import type { HospitalUnit, BedRecord, FacilityWithBeds, BedOccupancyUpdate } from '@/lib/health/bed-types';

/**
 * Hook to fetch and manage bed data for a facility
 */
export function useBedTracker(facilityId: number) {
  const trpc = useTrpc();
  const [units, setUnits] = useState<HospitalUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch units for facility
  const fetchUnits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await trpc.bed.unitsForFacility.query({ facilityId });
      setUnits(result as HospitalUnit[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch units');
      console.error('[useBedTracker] Error fetching units:', err);
    } finally {
      setLoading(false);
    }
  }, [facilityId, trpc]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  return { units, loading, error, refetch: fetchUnits };
}

/**
 * Hook to fetch beds for a specific unit
 */
export function useUnitBeds(unitId: number | null) {
  const trpc = useTrpc();
  const [beds, setBeds] = useState<BedRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBeds = useCallback(async () => {
    if (!unitId) return;
    
    setLoading(true);
    setError(null);
    try {
      const result = await trpc.bed.bedsForUnit.query({ unitId });
      setBeds(result as BedRecord[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch beds');
      console.error('[useUnitBeds] Error fetching beds:', err);
    } finally {
      setLoading(false);
    }
  }, [unitId, trpc]);

  useEffect(() => {
    fetchBeds();
  }, [fetchBeds]);

  return { beds, loading, error, refetch: fetchBeds };
}

/**
 * Hook to update bed status (local + sync to server)
 */
export function useUpdateBedStatus() {
  const trpc = useTrpc();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateBedStatus = useCallback(
    async (
      bedId: number,
      status: 'available' | 'occupied' | 'maintenance' | 'reserved',
      patientId?: string,
    ) => {
      setLoading(true);
      setError(null);
      try {
        const result = await trpc.bed.updateBedStatus.mutate({
          bedId,
          status,
          patientId,
        });
        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to update bed status';
        setError(errorMsg);
        console.error('[useUpdateBedStatus] Error:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [trpc],
  );

  return { updateBedStatus, loading, error };
}

/**
 * Hook to get available bed count for a facility
 */
export function useAvailableBedCount(facilityId: number) {
  const trpc = useTrpc();
  const [availableBeds, setAvailableBeds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCount = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await trpc.bed.availableBedCount.query({ facilityId });
      setAvailableBeds(result.availableBeds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch available beds');
      console.error('[useAvailableBedCount] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [facilityId, trpc]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  return { availableBeds, loading, error, refetch: fetchCount };
}

/**
 * Hook to find nearby facilities with available beds
 */
export function useNearbyFacilitiesWithBeds(
  latitude: string | null,
  longitude: string | null,
  radiusKm: number = 10,
) {
  const trpc = useTrpc();
  const [facilities, setFacilities] = useState<FacilityWithBeds[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNearbyFacilities = useCallback(async () => {
    if (!latitude || !longitude) return;

    setLoading(true);
    setError(null);
    try {
      const result = await trpc.bed.nearbyFacilitiesWithBeds.query({
        latitude,
        longitude,
        radiusKm,
      });
      setFacilities(result as FacilityWithBeds[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch nearby facilities');
      console.error('[useNearbyFacilitiesWithBeds] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude, radiusKm, trpc]);

  useEffect(() => {
    fetchNearbyFacilities();
  }, [fetchNearbyFacilities]);

  return { facilities, loading, error, refetch: fetchNearbyFacilities };
}

/**
 * Hook to create a new unit (local + sync to server)
 */
export function useCreateUnit() {
  const trpc = useTrpc();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createUnit = useCallback(
    async (facilityId: number, data: { name: string; totalBeds: number; description?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const result = await trpc.bed.createUnit.mutate({
          facilityId,
          ...data,
        });
        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to create unit';
        setError(errorMsg);
        console.error('[useCreateUnit] Error:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [trpc],
  );

  return { createUnit, loading, error };
}
