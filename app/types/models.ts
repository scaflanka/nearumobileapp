export type IdLike = string | number | null | undefined;

export interface LocationPoint {
  id?: number | string;
  latitude: number;
  longitude: number;
  name?: string;
  metadata?: Record<string, unknown> | null;
}

export interface CircleData {
  id: number | string;
  name?: string;
  code?: string;
  invitationCode?: string;
  Locations?: LocationPoint[];
  metadata?: { radius?: number };
  creatorId?: string;
  creator?: { id: string; name?: string };
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  heading?: number;
  accuracy?: number | null;
  speed?: number | null;
}

export interface JourneyHistoryPoint {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  name?: string | null;
}

export interface Journey {
  journeyName: string;
  startTime: string;
  endTime: string;
  history: JourneyHistoryPoint[];
}

export interface CircleMember {
  id?: IdLike;
  name?: string;
  email?: string;
  avatar?: string | null;
  batteryLevel?: BatteryLevelInfo | null;
  currentLocation?: {
    id?: string;
    latitude: number;
    longitude: number;
    name?: string | null;
    metadata?: any;
    updatedAt: string;
  } | null;
  todayLocationHistory?: LocationHistoryEntry[];
  journeys?: Journey[];
  Membership?: {
    nickname?: string;
    role?: string;
    status?: string;
    locationId?: IdLike;
    LocationId?: IdLike;
    location_id?: IdLike;
    specialLocationId?: IdLike;
    assignedLocationId?: IdLike;
    metadata?: any;
  };
}

export interface MemberLocationOption {
  id: string;
  label: string;
  subtitle: string;
}

export interface AssignedLocationRecord {
  assignmentId: string;
  circleId: string;
  locationId: string | null;
  locationPoint: LocationPoint | null;
  latitude?: number;
  longitude?: number;
  metadata?: Record<string, unknown> | null;
  raw: any;
}

export interface AssignedLocationDetails {
  label: string;
  subtitle?: string;
  coordinates?: { latitude: number; longitude: number };
}

export interface BatteryLevelInfo {
  // level?: number | null;
  batteryLevel?: number | null;
  deviceId?: string | null;
  updatedAt?: string | null;
}

export interface LocationHistoryEntry {
  id: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  name?: string | null;
  circleId?: string | null;
}

export type LocationHistoryFilterKey = "today" | "yesterday" | "this_week" | "this_month" | "custom";

export type MapType = "standard" | "satellite" | "hybrid" | "terrain";
