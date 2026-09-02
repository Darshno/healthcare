# Bed Tracker - Offline Syncable Feature

A complete bed management and tracking system for hospitals with offline sync capabilities, nearby hospital finder, and real-time occupancy updates.

## Features

- **Bed Tracking**: Track beds per unit with status (available, occupied, maintenance, reserved)
- **Unit Management**: Create and manage hospital units with configurable bed counts
- **Occupancy Monitoring**: Real-time occupancy updates and statistics
- **Offline Sync**: All bed updates sync automatically when device comes online
- **Nearby Hospital Finder**: Show nearby hospitals with available beds when current hospital is full
- **Location-Based Search**: Find hospitals within specified radius using geolocation
- **Phone Directory**: Direct phone numbers for nearby facilities

## Architecture

### Database Schema

#### `hospital_units`

```sql
- id: integer (primary key)
- facilityId: integer (facility reference)
- name: string (unit name - ICU, General Ward, etc.)
- description: text (optional unit details)
- totalBeds: integer (total number of beds)
- occupiedBeds: integer (currently occupied count)
- createdAt: timestamp
- updatedAt: timestamp
```

#### `beds`

```sql
- id: integer (primary key)
- unitId: integer (unit reference)
- facilityId: integer (facility reference)
- bedNumber: string (bed identifier - A1, A2, etc.)
- status: enum (available, occupied, maintenance, reserved)
- patientId: string (optional, linked patient)
- occupiedSince: timestamp (when bed was occupied)
- notes: text (maintenance notes, etc.)
- createdAt: timestamp
- updatedAt: timestamp
```

#### `facility_locations`

```sql
- id: integer (primary key)
- facilityId: integer (facility reference, unique)
- latitude: string (GPS latitude)
- longitude: string (GPS longitude)
- address: text (full address)
- phoneNumber: string (contact number)
- createdAt: timestamp
- updatedAt: timestamp
```

## API Endpoints

### REST Endpoints (NestJS)

```
GET    /api/beds/facility/:facilityId/units
       Get all units for a facility

GET    /api/beds/unit/:unitId/beds
       Get all beds for a unit

GET    /api/beds/facility/:facilityId/available-count
       Get available bed count for facility

POST   /api/beds/facility/:facilityId/units
       Create new unit
       Body: { name, totalBeds, description? }

PUT    /api/beds/bed/:bedId/status
       Update bed status
       Body: { status, patientId? }

GET    /api/beds/nearby-facilities?latitude=X&longitude=Y&radius=10
       Find nearby facilities with available beds
```

### tRPC Endpoints (Type-safe Client Calls)

```typescript
// Get units for facility
await trpc.bed.unitsForFacility.query({ facilityId: 1 });

// Get beds for unit
await trpc.bed.bedsForUnit.query({ unitId: 5 });

// Get available bed count
await trpc.bed.availableBedCount.query({ facilityId: 1 });

// Update bed status (creates sync operation)
await trpc.bed.updateBedStatus.mutate({
  bedId: 10,
  status: "occupied",
  patientId: "PATIENT_123",
});

// Find nearby hospitals
await trpc.bed.nearbyFacilitiesWithBeds.query({
  latitude: "28.7041",
  longitude: "77.1025",
  radiusKm: 10,
});

// Create new unit
await trpc.bed.createUnit.mutate({
  facilityId: 1,
  name: "ICU Ward",
  totalBeds: 20,
  description: "Intensive Care Unit",
});
```

## Client-Side Hooks

### `useBedTracker(facilityId)`

Fetch and manage all units for a facility.

```typescript
const { units, loading, error, refetch } = useBedTracker(1);
```

### `useUnitBeds(unitId)`

Fetch all beds for a specific unit.

```typescript
const { beds, loading, error, refetch } = useUnitBeds(5);
```

### `useUpdateBedStatus()`

Update bed status (local + server sync).

```typescript
const { updateBedStatus, loading, error } = useUpdateBedStatus();
await updateBedStatus(10, "occupied", "PATIENT_123");
```

### `useAvailableBedCount(facilityId)`

Get real-time available bed count.

```typescript
const { availableBeds, loading, error, refetch } = useAvailableBedCount(1);
```

### `useNearbyFacilitiesWithBeds(latitude, longitude, radiusKm)`

Find nearby hospitals with available beds.

```typescript
const { facilities, loading, error, refetch } = useNearbyFacilitiesWithBeds(
  "28.7041",
  "77.1025",
  10,
);
```

### `useCreateUnit()`

Create new hospital unit.

```typescript
const { createUnit, loading, error } = useCreateUnit();
await createUnit(1, {
  name: "Emergency Ward",
  totalBeds: 15,
  description: "Emergency care unit",
});
```

## Offline Sync

### How It Works

1. **Offline Update**: When user updates bed status offline, it's stored in AsyncStorage
2. **Local Storage**: Updates remain in local cache with timestamp
3. **Automatic Sync**: When device reconnects, `syncBedUpdates()` is called
4. **Server Sync**: All pending updates are sent via `sync.push` tRPC endpoint
5. **Confirmation**: On successful sync, local cache is cleared

### Offline Sync Functions

```typescript
import {
  storeBedUpdate,
  getPendingBedUpdates,
  syncBedUpdates,
  getOfflineBedStats,
  cacheFacilityLocations,
  getCachedFacilityLocations,
  calculateDistance,
} from "@/lib/health/bed-offline-sync";

// Store offline update
await storeBedUpdate({
  id: "unique_id",
  facilityId: 1,
  unitId: "5",
  bedId: "10",
  status: "occupied",
  patientId: "PATIENT_123",
  timestamp: Date.now(),
});

// Get pending updates
const pending = await getPendingBedUpdates();

// Sync with server
const success = await syncBedUpdates(trpcClient);

// Get offline stats
const stats = await getOfflineBedStats();
// Returns: { pendingUpdates: 5, lastSync: 1234567890 }

// Cache facility locations for offline access
await cacheFacilityLocations(facilities);

// Get cached locations
const cached = await getCachedFacilityLocations();

// Calculate distance between coordinates
const distance = calculateDistance(28.7041, 77.1025, 28.5355, 77.391);
```

## UI Components

### BedTrackerScreen

Main component for bed management with offline support.

```typescript
import { BedTrackerScreen } from '@/components/health/BedTrackerScreen';

<BedTrackerScreen
  facilityId={1}
  latitude="28.7041"
  longitude="77.1025"
/>
```

**Features:**

- Summary card showing total/occupied/available beds
- Unit list with occupancy progress bars
- Interactive bed grid (tap to toggle status)
- Nearby hospitals list when all beds are full
- Distance calculation and phone directory
- Loading states and error handling

## Integration Steps

### 1. Database Migration

Generate and run migrations:

```bash
pnpm db:migration:generate
pnpm db:migration:run
```

### 2. Setup Location Tracking

Add facility locations to database:

```typescript
// In your admin/setup code
await trpc.bed.createUnit.mutate({
  facilityId: 1,
  name: "General Ward",
  totalBeds: 50,
  description: "General patient beds",
});
```

### 3. Enable in App

Add bed tracker screen to your navigation:

```typescript
// In app navigation
{
  name: 'beds',
  component: BedTrackerScreen,
  options: {
    title: 'Bed Availability',
    tabBarIcon: ({ color }) => <Ionicons name="bed" color={color} size={24} />,
  }
}
```

### 4. Listen to Connection Changes

Hook into app connection state to trigger sync:

```typescript
import { useEffect } from "react";
import NetInfo from "@react-native-community/netinfo";
import { syncBedUpdates } from "@/lib/health/bed-offline-sync";
import { useTrpc } from "@/hooks/use-trpc";

export function useBedSync() {
  const trpc = useTrpc();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(({ isConnected }) => {
      if (isConnected) {
        console.log("[useBedSync] Connection restored, syncing bed data...");
        syncBedUpdates(trpc);
      }
    });

    return () => unsubscribe();
  }, [trpc]);
}
```

## Data Flow

```
┌─────────────────────┐
│  User Updates Bed   │
│   (Offline/Online)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  storeBedUpdate()   │
│ (AsyncStorage)      │
└──────────┬──────────┘
           │
        ┌──┴───┐
        ▼      ▼
   ┌─────┐  ┌──────────┐
   │Local│  │ If Online│
   │Sync │  └─────┬────┘
   └─────┘        │
                  ▼
            ┌─────────────┐
            │ tRPC Call   │
            │  sync.push  │
            └──────┬──────┘
                   │
                   ▼
            ┌──────────────┐
            │   Server     │
            │ Processes    │
            │   Updates    │
            └──────┬───────┘
                   │
                   ▼
            ┌──────────────┐
            │   Clear      │
            │   Local      │
            │   Updates    │
            └──────────────┘
```

## Type Definitions

```typescript
type BedStatus = "available" | "occupied" | "maintenance" | "reserved";

type HospitalUnit = {
  id: string;
  facilityId: number;
  name: string;
  description?: string;
  totalBeds: number;
  occupiedBeds: number;
  syncState: SyncState;
  updatedAt: number;
};

type BedRecord = {
  id: string;
  unitId: string;
  facilityId: number;
  bedNumber: string;
  status: BedStatus;
  patientId?: string;
  occupiedSince?: number;
  notes?: string;
  syncState: SyncState;
  updatedAt: number;
};

type FacilityWithBeds = {
  id: number;
  name: string;
  location: FacilityLocation;
  availableBeds: number;
  totalBeds: number;
  distance?: number;
};
```

## Error Handling

The system handles various error scenarios:

- **Offline Updates**: Stored and synced automatically
- **Sync Failures**: Updates retained for retry
- **Network Errors**: Graceful fallback to cached data
- **Invalid Status**: Validation before server submission
- **Geolocation**: Falls back to predefined radius search

## Performance Considerations

1. **Caching**: Facility locations cached for 1 hour offline
2. **Batching**: Multiple bed updates batched in single sync
3. **Pagination**: Large unit lists paginated (configurable)
4. **Lazy Loading**: Bed details loaded only when unit selected
5. **Debouncing**: Location searches debounced to avoid excessive queries

## Testing

### Unit Tests

```typescript
describe("Bed Tracker", () => {
  it("should store offline bed updates", async () => {
    await storeBedUpdate({
      /* update data */
    });
    const pending = await getPendingBedUpdates();
    expect(pending).toHaveLength(1);
  });

  it("should sync pending updates", async () => {
    // Store multiple updates
    // Trigger sync
    // Verify cleared
  });

  it("should calculate distance correctly", () => {
    const distance = calculateDistance(0, 0, 0, 1);
    expect(distance).toBeCloseTo(111.32, 1);
  });
});
```

## Files Modified/Created

### Backend

- `server/modules/bed/` - New bed module (service, controller, module)
- `server/bedRouter.ts` - tRPC bed endpoints
- `server/routers.ts` - Updated to include bed router
- `server/app.module.ts` - Registered BedModule
- `drizzle/schema.ts` - Added bed-related tables

### Frontend

- `lib/health/bed-types.ts` - Type definitions
- `lib/health/bed-offline-sync.ts` - Offline sync utilities
- `hooks/use-bed-tracker.ts` - React hooks for bed operations
- `components/health/BedTrackerScreen.tsx` - UI component

## Future Enhancements

- [ ] Real-time WebSocket updates for bed status
- [ ] Push notifications when beds become available
- [ ] Historical analytics on bed usage patterns
- [ ] Predictive bed availability forecasting
- [ ] Integration with patient admission system
- [ ] SMS alerts for critical bed shortage
- [ ] Mobile-specific optimizations
- [ ] Multi-language support for hospital names
