import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BedOccupancyUpdate } from '@/lib/health/bed-types';

const BED_SYNC_KEY = 'bed_sync_operations';
const FACILITY_LOCATIONS_KEY = 'facility_locations_cache';

/**
 * Store a bed occupancy update locally for offline sync
 */
export async function storeBedUpdate(update: BedOccupancyUpdate): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(BED_SYNC_KEY);
    const updates: BedOccupancyUpdate[] = existing ? JSON.parse(existing) : [];
    
    // Replace if bed update already exists, otherwise add new
    const index = updates.findIndex((u) => u.bedId === update.bedId);
    if (index >= 0) {
      updates[index] = update;
    } else {
      updates.push(update);
    }
    
    await AsyncStorage.setItem(BED_SYNC_KEY, JSON.stringify(updates));
  } catch (error) {
    console.error('[storeBedUpdate] Error storing bed update:', error);
  }
}

/**
 * Get all pending bed updates
 */
export async function getPendingBedUpdates(): Promise<BedOccupancyUpdate[]> {
  try {
    const data = await AsyncStorage.getItem(BED_SYNC_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[getPendingBedUpdates] Error retrieving pending updates:', error);
    return [];
  }
}

/**
 * Clear pending bed updates after successful sync
 */
export async function clearBedUpdates(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BED_SYNC_KEY);
  } catch (error) {
    console.error('[clearBedUpdates] Error clearing bed updates:', error);
  }
}

/**
 * Cache facility locations for offline access
 */
export async function cacheFacilityLocations(locations: any[]): Promise<void> {
  try {
    await AsyncStorage.setItem(FACILITY_LOCATIONS_KEY, JSON.stringify({
      data: locations,
      cachedAt: Date.now(),
    }));
  } catch (error) {
    console.error('[cacheFacilityLocations] Error caching locations:', error);
  }
}

/**
 * Get cached facility locations
 */
export async function getCachedFacilityLocations(): Promise<any[]> {
  try {
    const data = await AsyncStorage.getItem(FACILITY_LOCATIONS_KEY);
    if (!data) return [];
    
    const cached = JSON.parse(data);
    // Cache is valid for 1 hour
    const isExpired = Date.now() - cached.cachedAt > 60 * 60 * 1000;
    
    if (isExpired) {
      await AsyncStorage.removeItem(FACILITY_LOCATIONS_KEY);
      return [];
    }
    
    return cached.data || [];
  } catch (error) {
    console.error('[getCachedFacilityLocations] Error retrieving cached locations:', error);
    return [];
  }
}

/**
 * Sync bed updates with server
 * This is called when connection is restored
 */
export async function syncBedUpdates(trpcClient: any): Promise<boolean> {
  try {
    const updates = await getPendingBedUpdates();
    
    if (updates.length === 0) {
      return true; // Nothing to sync
    }

    console.log(`[syncBedUpdates] Syncing ${updates.length} bed updates...`);
    
    // Convert bed updates to sync operations
    const syncOps = updates.map((update) => ({
      id: `${update.bedId}_${update.timestamp}`,
      type: 'bed_occupancy_update',
      entityId: update.bedId,
      createdAt: update.timestamp,
      payload: JSON.stringify(update),
    }));

    // Send to server via sync.push
    await trpcClient.sync.push.mutate({
      facilityId: updates[0]?.facilityId,
      operations: syncOps,
    });

    // Clear local updates after successful sync
    await clearBedUpdates();
    console.log('[syncBedUpdates] Successfully synced bed updates');
    return true;
  } catch (error) {
    console.error('[syncBedUpdates] Error syncing bed updates:', error);
    return false;
  }
}

/**
 * Get statistics for offline bed tracking
 */
export async function getOfflineBedStats(): Promise<{
  pendingUpdates: number;
  lastSync: number | null;
}> {
  try {
    const updates = await getPendingBedUpdates();
    const lastSync = await AsyncStorage.getItem('last_bed_sync');
    
    return {
      pendingUpdates: updates.length,
      lastSync: lastSync ? parseInt(lastSync, 10) : null,
    };
  } catch (error) {
    console.error('[getOfflineBedStats] Error getting stats:', error);
    return { pendingUpdates: 0, lastSync: null };
  }
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
