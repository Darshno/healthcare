import type { SyncState } from "./types";

export type BedStatus = "available" | "occupied" | "maintenance" | "reserved";

export type HospitalUnit = {
  id: string;
  facilityId: number;
  name: string;
  description?: string;
  totalBeds: number;
  occupiedBeds: number;
  syncState: SyncState;
  updatedAt: number;
};

export type BedRecord = {
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

export type FacilityLocation = {
  id: string;
  facilityId: number;
  latitude: string;
  longitude: string;
  address: string;
  phoneNumber: string;
  updatedAt: number;
};

export type FacilityWithBeds = {
  id: number;
  name: string;
  location: FacilityLocation;
  availableBeds: number;
  totalBeds: number;
  distance?: number; // in km
};

export type BedOccupancyUpdate = {
  id: string;
  facilityId: number;
  unitId: string;
  bedId: string;
  status: BedStatus;
  patientId?: string;
  occupiedSince?: number;
  notes?: string;
  timestamp: number;
};
