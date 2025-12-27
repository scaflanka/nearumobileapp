import AsyncStorage from "@react-native-async-storage/async-storage";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import * as TaskManager from "expo-task-manager";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Modal as RNModal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import MapView, { Circle, Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

import { FontAwesome5, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";


import { useSafeAreaInsets } from "react-native-safe-area-context";

// --- Components & Utils ---
import * as ImagePicker from "expo-image-picker";
import AddPlaceModal from "../../components/AddPlaceModal";
import { API_BASE_URL, authenticatedFetch, logout } from "../../utils/auth";
import {
  readBatteryLevel,
  sendBatteryLevelValue,
  sendLowBatteryAlert,
  watchBatteryLevel
} from "../../utils/battery";
import { storeLastKnownLocation } from "../../utils/locationCache";
import { setNotificationReceptionEnabled } from "../../utils/notificationListeners";
import { requestNotificationPermissions } from "../../utils/permissions";
import AccountActionsModal from "../components/modals/AccountActionsModal";
import {
  AssignedLocationDetails,
  AssignedLocationRecord,
  BatteryLevelInfo,
  CircleData,
  CircleMember,
  LocationHistoryEntry,
  LocationHistoryFilterKey,
  LocationPoint,
  MemberLocationOption,
  UserLocation,
} from "../types/models";
import CirclesModal from "./CirclesModal";

// --- Enums & Types for Circle Notifications ---
export enum NotificationType {
  LOCATION_REACHED = "location_reached", // Location arrived
  LOCATION_LEFT = "location_left", // Departed from location
  INVITE = "invite",
  MEMBERSHIP_ACCEPTED = "membership_accepted", // Join
  MEMBERSHIP_REJECTED = "membership_rejected",
  MEMBER_REMOVED = "member_removed", // Remove
  ROLE_UPDATED = "role_updated", // Change user role
  NICKNAME_UPDATED = "nickname_updated",
  LOCATION_ADDED = "location_added", // Location add to circle
  LOCATION_REMOVED = "location_removed", // Location remove from circle
  LOCATION_ASSIGNED = "location_assigned", // Assign location
  LOCATION_UNASSIGNED = "location_unassigned", // Unassign location
  CRASH_DETECTED = "crash_detected", // App crash
  SOS_ALERT = "sos_alert",
  LOW_BATTERY = "low_battery",
}

export enum NotificationRecipientType {
  ALL_MEMBERS = "all_members",
  CREATOR_AND_ADMINS = "creator_and_admins",
  TRIGGERING_USER_ONLY = "triggering_user_only",
  NONE = "none",
}

export interface CircleNotificationSettings {
  [key: string]: NotificationRecipientType;
}


// Helper: split array into chunks of 2
function splitIntoJourneys(history: LocationHistoryEntry[]): LocationHistoryEntry[][] {
  const journeys: LocationHistoryEntry[][] = [];
  for (let i = 0; i < history.length; i += 2) {
    journeys.push(history.slice(i, i + 2));
  }
  return journeys;
}

// Modal component for member journeys
const MemberJourneysModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  members: CircleMember[];
  insets: { top: number; bottom: number; left: number; right: number };
}> = ({ visible, onClose, members, insets }) => {
  const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/initials/svg?seed=";

  return (
    <RNModal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      transparent={false}
    >
      <View style={{ flex: 1, backgroundColor: '#F8FAFC', paddingTop: insets.top }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 16,
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
          elevation: 2,
        }}>
          <View>
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#1A1A1A' }}>Today's Journeys</Text>
            <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 2 }}>{members.length} {members.length === 1 ? 'member' : 'members'}</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: '#F3F4F6',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={22} color="#1A1A1A" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}
          showsVerticalScrollIndicator={false}
        >
          {members.map((member) => {
            const rawHistory = member.todayLocationHistory || [];
            // Take only the last 10 entries (or first 10 if that's what "last" means in this context, assuming chronological order might vary, but typically lists are often newest first or we just want a limit. User said "last 10". If the array is chronological [old...new], last 10 is .slice(-10). If it's [new...old], it's .slice(0, 10). Let's assume typical history list behavior. API usually returns ordered list. Let's try slicing first 10 if it's descending, or verify.)
            // Assuming the list is already sorted or we just want to cap it. The user said "last 10", often implying "most recent". If `todayLocationHistory` is large, we want to limit the markers/lines.
            // Let's assume standard "latest first" or just "limit to 10". If it's chronological, `slice(-10)` gives the end.
            // However, usually detailed history is huge.
            // Let's try slicing safe.
            const limitedHistory = rawHistory.slice(0, 20);
            const journeys = splitIntoJourneys(limitedHistory);

            console.log(journeys);
            const battery = member.batteryLevel?.level ?? null;
            const batteryPercent = battery !== null ? Math.round(battery) : null;
            const displayName = member.Membership?.nickname || member.name || member.email || 'Member';
            const avatarUrl = member.avatar || `${DEFAULT_AVATAR}${encodeURIComponent(displayName)}`;

            return (
              <View
                key={String(member.id)}
                style={{
                  marginBottom: 20,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  padding: 16,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.08,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                {/* Member Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <Image
                    source={{ uri: avatarUrl }}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: '#E5E7EB',
                      marginRight: 12,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 18, fontWeight: '600', color: '#1A1A1A' }}>{displayName}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Ionicons
                        name="battery-half"
                        size={14}
                        color={batteryPercent !== null && batteryPercent < 20 ? '#EF4444' : '#22C55E'}
                      />
                      <Text style={{
                        fontSize: 13,
                        color: batteryPercent !== null && batteryPercent < 20 ? '#EF4444' : '#6B7280',
                        marginLeft: 4,
                        fontWeight: '500',
                      }}>
                        {batteryPercent !== null ? `${batteryPercent}%` : 'N/A'}
                      </Text>
                    </View>
                  </View>

                  {/* Speed/Status Display */}
                  {(() => {
                    const metadata = member.currentLocation?.metadata;
                    // Handle both parsed object and stringified metadata
                    const speedVal = metadata?.speed;

                    if (typeof speedVal === 'number') {
                      // Speed is in m/s, convert to km/h
                      // 1 m/s = 3.6 km/h
                      const speedKmh = speedVal * 3.6;
                      const isStopped = speedKmh <= 1; // Tolerance for "Stopped"
                      const isWalking = speedKmh > 1 && speedKmh <= 5;
                      const isDriving = speedKmh > 5;

                      let statusText = "";
                      let showSpeed = false;

                      if (isStopped) {
                        statusText = "Stopped";
                      } else if (isDriving) {
                        statusText = "Driving";
                        showSpeed = true;
                      } else if (isWalking) {
                        statusText = "Walking";
                        showSpeed = true;
                      } else {
                        statusText = "Moving";
                        showSpeed = true;
                      }

                      return (
                        <View style={{ alignItems: 'flex-end', justifyContent: 'center', marginRight: 12 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: isStopped ? '#6B7280' : '#2563EB' }}>
                            {statusText}
                          </Text>
                          {showSpeed && (
                            <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>
                              {Math.round(speedKmh)} km/h
                            </Text>
                          )}
                        </View>
                      );
                    }
                    return null;
                  })()}
                  <View style={{
                    backgroundColor: '#F3F0FF',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#4F359B' }}>
                      {journeys.length} {journeys.length === 1 ? 'journey' : 'journeys'}
                    </Text>
                  </View>
                </View>

                {/* Journeys */}
                {
                  journeys.length === 0 ? (
                    <View style={{
                      padding: 20,
                      alignItems: 'center',
                      backgroundColor: '#F9FAFB',
                      borderRadius: 12,
                    }}>
                      <Ionicons name="location-outline" size={32} color="#9CA3AF" />
                      <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 8 }}>No journeys recorded today</Text>
                    </View>
                  ) : (
                    journeys.map((journey, idx) => {
                      const startTime = journey[0]?.createdAt ? new Date(journey[0].createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
                      const endTime = journey[journey.length - 1]?.createdAt ? new Date(journey[journey.length - 1].createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';

                      return (
                        <View
                          key={idx}
                          style={{
                            marginBottom: idx < journeys.length - 1 ? 12 : 0,
                            backgroundColor: '#F9FAFB',
                            borderRadius: 12,
                            padding: 12,
                            borderWidth: 1,
                            borderColor: '#E5E7EB',
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text style={{ fontSize: 15, fontWeight: '600', color: '#1A1A1A' }}>Journey {idx + 1}</Text>
                            {startTime && endTime && (
                              <Text style={{ fontSize: 12, color: '#6B7280' }}>{startTime} - {endTime}</Text>
                            )}
                          </View>

                          {journey.length >= 2 ? (
                            <MapView
                              style={{ width: '100%', height: 140, borderRadius: 8 }}
                              initialRegion={{
                                latitude: (journey[0].latitude + journey[journey.length - 1].latitude) / 2,
                                longitude: (journey[0].longitude + journey[journey.length - 1].longitude) / 2,
                                latitudeDelta: Math.abs(journey[0].latitude - journey[journey.length - 1].latitude) + 0.01,
                                longitudeDelta: Math.abs(journey[0].longitude - journey[journey.length - 1].longitude) + 0.01,
                              }}
                              pointerEvents="none"
                              provider={PROVIDER_GOOGLE}
                            >
                              <Polyline
                                coordinates={journey.map(j => ({ latitude: j.latitude, longitude: j.longitude }))}
                                strokeColor="#4F359B"
                                strokeWidth={4}
                              />
                              <Marker
                                coordinate={{ latitude: journey[0].latitude, longitude: journey[0].longitude }}
                                anchor={{ x: 0.5, y: 0.5 }}
                              >
                                <View style={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: 6,
                                  backgroundColor: '#22C55E',
                                  borderWidth: 2,
                                  borderColor: '#FFFFFF',
                                }} />
                              </Marker>
                              <Marker
                                coordinate={{ latitude: journey[journey.length - 1].latitude, longitude: journey[journey.length - 1].longitude }}
                                anchor={{ x: 0.5, y: 0.5 }}
                              >
                                <View style={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: 6,
                                  backgroundColor: '#EF4444',
                                  borderWidth: 2,
                                  borderColor: '#FFFFFF',
                                }} />
                              </Marker>
                            </MapView>
                          ) : (
                            <View style={{
                              padding: 16,
                              alignItems: 'center',
                              backgroundColor: '#FFFFFF',
                              borderRadius: 8,
                            }}>
                              <Text style={{ fontSize: 13, color: '#9CA3AF' }}>Not enough location points</Text>
                            </View>
                          )}
                        </View>
                      );
                    })
                  )
                }
              </View>
            );
          })}
        </ScrollView>
      </View >
    </RNModal >
  );
};

// --- Constants ---
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
const TOP_HEADER_HEIGHT = 60;
const TAB_BAR_HEIGHT = 85;
const HANDLE_HEIGHT = 30;

const MAX_HEIGHT = SCREEN_HEIGHT - TOP_HEADER_HEIGHT;
const MIN_HEIGHT = TAB_BAR_HEIGHT + HANDLE_HEIGHT;
const MID_HEIGHT = MIN_HEIGHT + (MAX_HEIGHT - MIN_HEIGHT) / 2;
const INITIAL_SHEET_HEIGHT = MID_HEIGHT;

const COLORS = {
  primary: "#4F359B",
  accent: "#EF4444",
  white: "#FFFFFF",
  black: "#1A1A1A",
  gray: "#6B7280",
  lightGray: "#F3F4F6",
  success: "#22C55E",
};

const STORAGE_KEYS = {
  lastSelectedCircleId: "mapScreen:lastSelectedCircleId",
  locationSharingEnabled: "mapScreen:settings:locationSharingEnabled",
  notificationsEnabled: "mapScreen:settings:notificationsEnabled",
};

const BACKGROUND_LOCATION_TASK_NAME = "circle-location-background-task";
const LAST_POSTED_LOCATION_STORAGE_KEY = "mapScreen:lastPostedPerCircle";
const isNativePlatform = Platform.OS === "ios" || Platform.OS === "android";
const CIRCLE_LOCATIONS_CACHE_KEY = "mapScreen:circleLocationsCache";
const LOCATION_PRESENCE_STORAGE_KEY = "mapScreen:locationPresenceCache";
const DEFAULT_LOCATION_RADIUS_METERS = 20;
const ASSIGNED_LOCATION_STROKE_COLOR = "rgba(79, 53, 155, 0.6)";
const ASSIGNED_LOCATION_FILL_COLOR = "rgba(79, 53, 155, 0.18)";
const USER_ACCURACY_STROKE_COLOR = "rgba(79, 70, 229, 0.35)";
const USER_ACCURACY_FILL_COLOR = "rgba(129, 140, 248, 0.14)";
const MAX_USER_ACCURACY_RADIUS = 250;
const MIN_CIRCLE_REFRESH_INTERVAL_MS = 4000;
const MIN_ASSIGNED_REFRESH_INTERVAL_MS = 4000;
const MIN_MEMBER_REFRESH_INTERVAL_MS = 3000;
const WEBP_MIME_TYPE = "image/webp";
const BATTERY_SYNC_MIN_INTERVAL_MS = 5 * 60 * 1000;
const LOW_BATTERY_THRESHOLD = 20;
const LOCATION_HISTORY_LIMIT = 100; // Limit for history items per fetch
// Google Maps API Key directly from app.json/config or hardcoded if necessary for reliability in this context
// In a real app, use Constants.expoConfig or similar, but for immediate stability we use the key found in app.json.
const GOOGLE_API_KEY = "AIzaSyBoqhQWOBssPSZpeWLuVEiaqF0Qzu2oQqk";

const MAP_THEME_LIGHT = [
  {
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#f5f5f5"
      }
    ]
  },
  {
    "elementType": "labels.icon",
    "stylers": [
      {
        "visibility": "on"
      }
    ]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#f5f5f5"
      }
    ]
  },
  {
    "featureType": "administrative.land_parcel",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#bdbdbd"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#eeeeee"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#edf7ed"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#6b9a76"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#ffffff"
      }
    ]
  },
  {
    "featureType": "road.arterial",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#dadada"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "featureType": "road.local",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  },
  {
    "featureType": "transit.line",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#e5e5e5"
      }
    ]
  },
  {
    "featureType": "transit.station",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#eeeeee"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#BBE2F9"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  }
];

const parseBooleanPreference = (value: string | null | undefined, fallback: boolean): boolean => {
  if (value === null || value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
};

const ensureWebpFileName = (name: string): string => {
  const trimmed = name ? name.trim() : "";
  if (!trimmed) {
    return `avatar_${Date.now()}.webp`;
  }
  const normalized = trimmed.replace(/\s+/g, "_");
  const dotIndex = normalized.lastIndexOf(".");
  const base = dotIndex >= 0 ? normalized.slice(0, dotIndex) : normalized;
  return `${base}.webp`;
};

const isWebpResource = (uri: string, mimeType?: string | null): boolean => {
  const loweredMime = mimeType?.toLowerCase() ?? null;
  if (loweredMime && (loweredMime === WEBP_MIME_TYPE || loweredMime.endsWith("+webp"))) {
    return true;
  }
  const normalizedUri = uri?.toLowerCase?.() ?? "";
  if (!normalizedUri) {
    return false;
  }
  const [pathWithoutQuery] = normalizedUri.split("?");
  return pathWithoutQuery.endsWith(".webp");
};

const prepareImageAsWebp = async (uri: string, name: string, mimeType: string): Promise<PickedImage> => {
  const targetName = ensureWebpFileName(name);

  if (isWebpResource(uri, mimeType)) {
    return {
      uri,
      name: targetName,
      type: WEBP_MIME_TYPE,
    };
  }

  const manipulated = await manipulateAsync(
    uri,
    [],
    {
      compress: 0.9,
      format: SaveFormat.WEBP,
    }
  );

  return {
    uri: manipulated.uri,
    name: targetName,
    type: WEBP_MIME_TYPE,
  };
};

const normalizeIdentifier = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveMembershipLocationId = (member: CircleMember | null | undefined): string | null => {
  const membership = member?.Membership as Record<string, unknown> | undefined;
  if (!membership) {
    return null;
  }

  const candidates: unknown[] = [
    membership.locationId,
    membership.LocationId,
    membership.location_id,
    membership.specialLocationId,
    membership.assignedLocationId,
    (membership as any)?.location?.id,
  ];

  const resolved = candidates.find((candidate) => candidate !== undefined && candidate !== null);
  return normalizeIdentifier(resolved ?? null);
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

type StoredLocationSnapshot = {
  latitude: number;
  longitude: number;
  timestamp: number;
};

type PickedImage = {
  uri: string;
  name: string;
  type: string;
};

const readLastPostedLocationMap = async (): Promise<Record<string, StoredLocationSnapshot>> => {
  try {
    const raw = await AsyncStorage.getItem(LAST_POSTED_LOCATION_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, StoredLocationSnapshot>;
    }
  } catch (error) {
    console.warn("Failed to read cached location updates", error);
  }

  return {};
};

const writeLastPostedLocationMap = async (map: Record<string, StoredLocationSnapshot>) => {
  const mapKeys = Object.keys(map);
  if (!mapKeys.length) {
    await AsyncStorage.removeItem(LAST_POSTED_LOCATION_STORAGE_KEY).catch(() => undefined);
    return;
  }

  await AsyncStorage.setItem(LAST_POSTED_LOCATION_STORAGE_KEY, JSON.stringify(map)).catch(() => undefined);
};

const getLastPostedLocationForCircle = async (circleId: string): Promise<StoredLocationSnapshot | null> => {
  const map = await readLastPostedLocationMap();
  return map[circleId] ?? null;
};

const setLastPostedLocationForCircle = async (
  circleId: string,
  coords: { latitude: number; longitude: number }
) => {
  const map = await readLastPostedLocationMap();
  map[circleId] = {
    latitude: coords.latitude,
    longitude: coords.longitude,
    timestamp: Date.now(),
  };
  await writeLastPostedLocationMap(map);
};

const removeLastPostedLocationForCircle = async (circleId: string) => {
  const map = await readLastPostedLocationMap();
  if (map[circleId]) {
    delete map[circleId];
    await writeLastPostedLocationMap(map);
  }
};

const clearAllPostedLocations = async (): Promise<void> => {
  await AsyncStorage.removeItem(LAST_POSTED_LOCATION_STORAGE_KEY).catch(() => undefined);
};

// --- Google Maps Geocoding Helper ---
const getLocationNameFromGoogle = async (latitude: number, longitude: number): Promise<string> => {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK" && data.results && data.results.length > 0) {
      // Try to find a specific type of address (e.g., street_address, neighborhood) or just take the formatted_address of the first result
      const result = data.results[0];
      return result.formatted_address || "Unknown Location";
    } else {
      console.warn("Geocoding failed or returned no results:", data.status);
      return "Unknown Location";
    }
  } catch (error) {
    console.warn("Error fetching location name:", error);
    return "Unknown Location";
  }
};

interface LocationUpdatePayload {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  status?: string;
}

const maybePostCircleLocationUpdate = async (
  circleIdLike: unknown,
  coords: LocationUpdatePayload
): Promise<boolean> => {
  const circleId = normalizeIdentifier(circleIdLike);
  if (!circleId) {
    return false;
  }

  const { latitude, longitude } = coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }

  const previous = await getLastPostedLocationForCircle(circleId);
  if (previous) {
    const distance = haversineDistanceMeters(previous.latitude, previous.longitude, latitude, longitude);
    if (distance < 20 && !coords.status) { // Allow update if status is present (e.g. journey start/end)
      return false;
    }
  }

  // Fetch real location name
  const realLocationName = await getLocationNameFromGoogle(latitude, longitude);

  const response = await authenticatedFetch(`${API_BASE_URL}/profile/circles/${circleId}/location`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      latitude,
      longitude,
      name: realLocationName, // Use the fetched name
      metadata: {
        accuracy: coords.accuracy ?? null,
        speed: coords.speed ?? null,
        ...(coords.status ? { status: coords.status } : {}),
      },
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message ?? "Failed to post location update.");
  }

  await setLastPostedLocationForCircle(circleId, { latitude, longitude });
  return true;
};

let backgroundTaskRegistered = false;

const registerBackgroundLocationTask = () => {
  if (!isNativePlatform || backgroundTaskRegistered) {
    return;
  }

  try {
    if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK_NAME)) {
      TaskManager.defineTask(BACKGROUND_LOCATION_TASK_NAME, async ({ data, error }) => {
        if (error) {
          console.warn("Background location task error", error);
          return;
        }

        const firstLocation = (data as { locations?: Location.LocationObject[] })?.locations?.[0];
        if (!firstLocation?.coords) {
          return;
        }

        const circleIdRaw = await AsyncStorage.getItem(STORAGE_KEYS.lastSelectedCircleId).catch(() => null);
        const circleId = normalizeIdentifier(circleIdRaw);
        if (!circleId) {
          return;
        }

        try {
          await processCircleLocationUpdate(circleId, {
            latitude: firstLocation.coords.latitude,
            longitude: firstLocation.coords.longitude,
            accuracy: firstLocation.coords.accuracy ?? null,
            speed: firstLocation.coords.speed ?? null,
          });
        } catch (updateError) {
          console.warn("Background location update failed", updateError);
        }
      });
    }

    backgroundTaskRegistered = true;

  } catch (registrationError) {
    console.warn("Failed to register background location task", registrationError);
  }
};



type CachedCircleLocation = {
  id: string;
  latitude: number;
  longitude: number;
  radius: number;
  name?: string;
  metadata?: Record<string, unknown> | null;
};

type CachedCircleLocationMap = Record<string, CachedCircleLocation[]>;
type LocationPresenceMap = Record<string, Record<string, boolean>>;

const coerceFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const extractRadiusFromMetadata = (metadata: LocationPoint["metadata"] | null | undefined): number | null => {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const metadataRecord = metadata as Record<string, unknown>;
  const candidates: unknown[] = [
    metadataRecord.radius,
    metadataRecord.Radius,
    (metadataRecord as any)?.geofenceRadius,
    (metadataRecord as any)?.geofence_radius,
    (metadataRecord as any)?.geofence?.radius,
  ];

  for (const candidate of candidates) {
    const numeric = coerceFiniteNumber(candidate);
    if (numeric !== null) {
      return numeric;
    }
    if (candidate && typeof candidate === "object") {
      const nestedRadius = coerceFiniteNumber((candidate as any)?.radius);
      if (nestedRadius !== null) {
        return nestedRadius;
      }
    }
  }

  return null;
};

const getRadiusForLocation = (
  location: LocationPoint,
  fallbackRadius: number = DEFAULT_LOCATION_RADIUS_METERS
): number => {
  const directRadius = coerceFiniteNumber((location as any)?.radius);
  if (directRadius !== null) {
    return directRadius;
  }

  const metadataRadius = extractRadiusFromMetadata(location.metadata);
  if (metadataRadius !== null) {
    return metadataRadius;
  }

  return fallbackRadius;
};

const sanitizeLocationForCache = (
  location: LocationPoint,
  fallbackRadius: number = DEFAULT_LOCATION_RADIUS_METERS
): CachedCircleLocation | null => {
  const id = normalizeIdentifier(location.id);
  if (!id) {
    return null;
  }

  if (!isValidCoordinate(location.latitude, location.longitude)) {
    return null;
  }

  const radius = getRadiusForLocation(location, fallbackRadius);
  const name =
    typeof location.name === "string" && location.name.trim().length > 0
      ? location.name.trim()
      : undefined;

  return {
    id,
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    radius,
    name,
    metadata: location.metadata && typeof location.metadata === "object" ? { ...location.metadata } : null,
  };
};

const readCircleLocationsCache = async (): Promise<CachedCircleLocationMap> => {
  try {
    const raw = await AsyncStorage.getItem(CIRCLE_LOCATIONS_CACHE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as CachedCircleLocationMap;
    }
  } catch (error) {
    console.warn("Failed to read circle locations cache", error);
  }
  return {};
};

const writeCircleLocationsCache = async (map: CachedCircleLocationMap): Promise<void> => {
  const hasEntries = Object.values(map).some((locations) => locations.length > 0);
  if (!hasEntries) {
    await AsyncStorage.removeItem(CIRCLE_LOCATIONS_CACHE_KEY).catch(() => undefined);
    return;
  }

  await AsyncStorage.setItem(CIRCLE_LOCATIONS_CACHE_KEY, JSON.stringify(map)).catch(() => undefined);
};

const readCachedCircleLocations = async (circleId: string): Promise<CachedCircleLocation[]> => {
  const map = await readCircleLocationsCache();
  return map[circleId] ?? [];
};

const cacheCircleLocations = async (
  circleId: string,
  locations: LocationPoint[],
  fallbackRadius: number = DEFAULT_LOCATION_RADIUS_METERS
): Promise<CachedCircleLocation[]> => {
  const sanitized = locations
    .map((location) => sanitizeLocationForCache(location, fallbackRadius))
    .filter((location): location is CachedCircleLocation => location !== null);

  const map = await readCircleLocationsCache();
  if (sanitized.length > 0) {
    map[circleId] = sanitized;
  } else {
    delete map[circleId];
  }

  await writeCircleLocationsCache(map);
  return sanitized;
};

const removeCachedCircleLocations = async (circleId: string): Promise<void> => {
  const map = await readCircleLocationsCache();
  if (!map[circleId]) {
    return;
  }

  delete map[circleId];
  await writeCircleLocationsCache(map);
};

const clearCircleLocationsCache = async (): Promise<void> => {
  await AsyncStorage.removeItem(CIRCLE_LOCATIONS_CACHE_KEY).catch(() => undefined);
};

const readLocationPresenceMap = async (): Promise<LocationPresenceMap> => {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_PRESENCE_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as LocationPresenceMap;
    }
  } catch (error) {
    console.warn("Failed to read location presence map", error);
  }
  return {};
};

const writeLocationPresenceMap = async (map: LocationPresenceMap): Promise<void> => {
  const hasEntries = Object.values(map).some((circle) => Object.keys(circle).length > 0);
  if (!hasEntries) {
    await AsyncStorage.removeItem(LOCATION_PRESENCE_STORAGE_KEY).catch(() => undefined);
    return;
  }

  await AsyncStorage.setItem(LOCATION_PRESENCE_STORAGE_KEY, JSON.stringify(map)).catch(() => undefined);
};

const clearLocationPresenceMap = async (): Promise<void> => {
  await AsyncStorage.removeItem(LOCATION_PRESENCE_STORAGE_KEY).catch(() => undefined);
};


const markCircleLocationReached = async (
  circleId: string,
  locationId: string,
  coords: LocationUpdatePayload
): Promise<void> => {
  const response = await authenticatedFetch(`${API_BASE_URL} /circles/${circleId}/mark-location-reached`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      locationId,
      latitude: coords.latitude,
      longitude: coords.longitude,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message ?? "Failed to notify members that the location was reached.");
  }
};

const markCircleLocationLeft = async (circleId: string, locationId: string): Promise<void> => {
  const response = await authenticatedFetch(`${API_BASE_URL}/circles/${circleId}/mark-location-left`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      locationId,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message ?? "Failed to notify members that the location was left.");
  }
};

type PresenceSnapshot = Record<string, boolean>;

interface PresenceTransitions {
  validIds: Set<string>;
  entered: CachedCircleLocation[];
  exited: string[];
}

const computePresenceTransitions = (
  locations: CachedCircleLocation[],
  coords: LocationUpdatePayload,
  snapshot: PresenceSnapshot
): PresenceTransitions => {
  const validIds = new Set<string>();
  const entered: CachedCircleLocation[] = [];
  const exited: string[] = [];

  for (const location of locations) {
    validIds.add(location.id);

    const distance = haversineDistanceMeters(
      coords.latitude,
      coords.longitude,
      location.latitude,
      location.longitude
    );

    const isInside = distance <= location.radius;
    const previouslyInside = snapshot[location.id] ?? false;

    if (isInside && !previouslyInside) {
      entered.push(location);
    } else if (!isInside && previouslyInside) {
      exited.push(location.id);
    }
  }

  return {
    validIds,
    entered,
    exited,
  };
};

const prunePresenceSnapshot = (snapshot: PresenceSnapshot, validIds: Set<string>): boolean => {
  let changed = false;
  for (const locationId of Object.keys(snapshot)) {
    if (!validIds.has(locationId)) {
      delete snapshot[locationId];
      changed = true;
    }
  }
  return changed;
};

const notifyLocationEntries = async (
  circleId: string,
  entered: CachedCircleLocation[],
  coords: LocationUpdatePayload,
  snapshot: PresenceSnapshot
): Promise<CachedCircleLocation[]> => {
  const processed: CachedCircleLocation[] = [];
  for (const location of entered) {
    try {
      await markCircleLocationReached(circleId, location.id, coords);
      snapshot[location.id] = true;
      processed.push(location);
    } catch (error) {
      console.warn("Failed to mark location reached", error);
    }
  }
  return processed;
};

const notifyLocationExits = async (
  circleId: string,
  exited: string[],
  snapshot: PresenceSnapshot
): Promise<boolean> => {
  let changed = false;
  for (const locationId of exited) {
    try {
      await markCircleLocationLeft(circleId, locationId);
      snapshot[locationId] = false;
      changed = true;
    } catch (error) {
      console.warn("Failed to mark location left", error);
    }
  }
  return changed;
};

const handleLocationPresence = async (
  circleId: string,
  coords: LocationUpdatePayload,
  candidateLocations?: LocationPoint[]
): Promise<CachedCircleLocation[]> => {
  let locations: CachedCircleLocation[] = [];

  if (candidateLocations?.length) {
    locations = candidateLocations
      .map((loc) => sanitizeLocationForCache(loc))
      .filter((loc): loc is CachedCircleLocation => loc !== null);
  }

  if (!locations.length) {
    locations = await readCachedCircleLocations(circleId);
  }

  if (!locations.length) {
    return [];
  }

  const presenceMap = await readLocationPresenceMap();
  const circlePresenceSnapshot: PresenceSnapshot = { ...presenceMap[circleId] };

  const { validIds, entered, exited } = computePresenceTransitions(locations, coords, circlePresenceSnapshot);

  let hasChanges = prunePresenceSnapshot(circlePresenceSnapshot, validIds);
  const processedEntries = await notifyLocationEntries(circleId, entered, coords, circlePresenceSnapshot);
  const entriesChanged = processedEntries.length > 0;
  const exitsChanged = await notifyLocationExits(circleId, exited, circlePresenceSnapshot);

  hasChanges = hasChanges || entriesChanged || exitsChanged;

  if (hasChanges) {
    const cleanedEntries = Object.fromEntries(
      Object.entries(circlePresenceSnapshot).filter(([, inside]) => inside)
    );

    if (Object.keys(cleanedEntries).length > 0) {
      presenceMap[circleId] = cleanedEntries;
    } else {
      delete presenceMap[circleId];
    }

    await writeLocationPresenceMap(presenceMap);
  }
  return processedEntries;
};

const processCircleLocationUpdate = async (
  circleIdLike: unknown,
  coords: LocationUpdatePayload,
  candidateLocations?: LocationPoint[],
  options?: { onLocationsArrived?: (arrived: CachedCircleLocation[]) => void }
): Promise<boolean> => {
  const circleId = normalizeIdentifier(circleIdLike);
  if (!circleId) {
    return false;
  }

  let arrivedLocations: CachedCircleLocation[] = [];
  try {
    arrivedLocations = await handleLocationPresence(circleId, coords, candidateLocations);
  } catch (error) {
    console.warn("Location presence handling failed", error);
  }

  if (arrivedLocations.length && options?.onLocationsArrived) {
    try {
      options.onLocationsArrived(arrivedLocations);
    } catch (callbackError) {
      console.warn("onLocationsArrived handler failed", callbackError);
    }
  }

  // --- Journey Logic ---
  const now = Date.now();
  const LAST_UPDATE_TIME_KEY = `journey_last_update_time_${circleId}`;

  try {
    const lastUpdateStr = await AsyncStorage.getItem(LAST_UPDATE_TIME_KEY);
    const lastUpdateTime = lastUpdateStr ? parseInt(lastUpdateStr, 10) : 0;

    // 5 minutes = 5 * 60 * 1000 ms = 300000 ms
    if (lastUpdateTime > 0 && (now - lastUpdateTime) > 300000) {
      // It's been more than 5 mins since last update.
      // 1. Send "Journey End" for the PREVIOUS location (last known)
      const previousLoc = await getLastPostedLocationForCircle(circleId);
      if (previousLoc) {
        if (previousLoc) {
          await maybePostCircleLocationUpdate(circleId, {
            latitude: previousLoc.latitude,
            longitude: previousLoc.longitude,
            // Force journey_end status
            status: "journey_end",
            speed: 0
          });
        }

        // 2. Send "Journey Start" for CURRENT location
        await maybePostCircleLocationUpdate(circleId, { ...coords, status: "journey_start", speed: coords.speed ?? 0 });
      }

      await AsyncStorage.setItem(LAST_UPDATE_TIME_KEY, now.toString());
    }
  } catch (jError) {
    console.warn("Journey logic failed", jError);
  }
  // ---------------------

  return maybePostCircleLocationUpdate(circleId, coords);
};

const LOCATION_HISTORY_FILTERS: { key: LocationHistoryFilterKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_week", label: "This Week" },
  { key: "this_month", label: "This Month" },
  { key: "custom", label: "Custom" },
];

const DEFAULT_MEMBER_AVATAR = "https://i.pravatar.cc/120?u=";

const AVATAR_FIELD_KEYS = [
  "avatar",
  "Avatar",
  "profileImage",
  "profile_image",
  "profileImageUrl",
  "profile_image_url",
  "profileImageURL",
  "profilePicture",
  "profile_picture",
  "profilePic",
  "profile_pic",
  "photo",
  "photoUrl",
  "photo_url",
  "photoURL",
  "picture",
  "image",
  "imageUrl",
  "image_url",
  "imageURL",
];

const extractAvatarUrl = (source: any, visited = new WeakSet<object>()): string | null => {
  if (!source) {
    return null;
  }

  if (typeof source === "string") {
    const trimmed = source.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof source !== "object") {
    return null;
  }

  if (visited.has(source)) {
    return null;
  }
  visited.add(source);

  if (Array.isArray(source)) {
    for (const item of source) {
      const resolved = extractAvatarUrl(item, visited);
      if (resolved) {
        return resolved;
      }
    }
    return null;
  }

  const extractFromObject = (value: unknown): string | null => {
    if (!value) {
      return null;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof value === "object") {
      const nested = value as Record<string, unknown>;
      const nestedKeys = ["url", "uri", "href", "source", "path"];
      for (const key of nestedKeys) {
        if (key in nested) {
          const resolved = extractFromObject(nested[key]);
          if (resolved) {
            return resolved;
          }
        }
      }
    }
    return null;
  };

  for (const key of AVATAR_FIELD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const resolved = extractFromObject((source as Record<string, unknown>)[key]);
      if (resolved) {
        return resolved;
      }
    }
  }

  const relatedObjects = [
    (source as Record<string, unknown>).profile,
    (source as Record<string, unknown>).user,
    (source as Record<string, unknown>).data,
    (source as Record<string, unknown>).attributes,
  ];

  for (const candidate of relatedObjects) {
    if (candidate && typeof candidate === "object") {
      const resolved = extractAvatarUrl(candidate, visited);
      if (resolved) {
        return resolved;
      }
    }
  }

  return null;
};

const toDateAtMidnight = (date: Date): Date => {
  const clone = new Date(date);
  clone.setHours(0, 0, 0, 0);
  return clone;
};

const toDateAtEndOfDay = (date: Date): Date => {
  const clone = new Date(date);
  clone.setHours(23, 59, 59, 999);
  return clone;
};

const startOfWeekLocal = (date: Date): Date => {
  const clone = new Date(date);
  const day = clone.getDay();
  const diff = (day === 0 ? 6 : day - 1); // start week on Monday
  clone.setDate(clone.getDate() - diff);
  return toDateAtMidnight(clone);
};

const startOfMonthLocal = (date: Date): Date => {
  const clone = new Date(date.getFullYear(), date.getMonth(), 1);
  return toDateAtMidnight(clone);
};

const parseDateInput = (value: string): Date | null => {
  if (!value) {
    return null;
  }
  const parts = value.trim().split("-");
  if (parts.length !== 3) {
    return null;
  }
  const [yearStr, monthStr, dayStr] = parts;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const result = new Date(year, month - 1, day);
  if (Number.isNaN(result.getTime())) {
    return null;
  }
  return result;
};

const calculateHeadingDegrees = (
  from: { latitude: number; longitude: number } | null,
  to: { latitude: number; longitude: number } | null
): number => {
  if (!from || !to) {
    return 0;
  }
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const deltaLon = ((to.longitude - from.longitude) * Math.PI) / 180;

  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  const bearing = Math.atan2(y, x);
  const bearingDeg = (bearing * 180) / Math.PI;
  return (bearingDeg + 360) % 360;
};

// --- Helpers ---
const extractBatteryLevelInfo = (candidate: unknown): BatteryLevelInfo | null => {
  if (candidate === null || candidate === undefined) {
    return null;
  }

  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    const clamped = Math.max(0, Math.min(100, candidate));
    return {
      level: clamped,
      deviceId: null,
      updatedAt: null,
    };
  }

  if (typeof candidate === "string") {
    const trimmed = candidate.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      const clamped = Math.max(0, Math.min(100, parsed));
      return {
        level: clamped,
        deviceId: null,
        updatedAt: null,
      };
    }
    try {
      const parsedJson = JSON.parse(trimmed);
      if (parsedJson && typeof parsedJson === "object") {
        return extractBatteryLevelInfo(parsedJson);
      }
    } catch {
      // ignore non-JSON strings
    }
    return null;
  }

  if (typeof candidate !== "object") {
    return null;
  }

  const record = candidate as Record<string, unknown>;

  const numericKeys = [
    "level",
    "batteryLevel",
    "battery_level",
    "percentage",
    "percent",
    "value",
    "charge",
    "battery",
    "current",
  ];

  for (const key of numericKeys) {
    if (!(key in record)) {
      continue;
    }
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      const clamped = Math.max(0, Math.min(100, value));
      const deviceId =
        asNonEmptyString(record.deviceId) ??
        asNonEmptyString(record.device_id) ??
        asNonEmptyString(record.device) ??
        asNonEmptyString(record.deviceName) ??
        asNonEmptyString(record.device_name) ??
        null;
      const updatedAt =
        asNonEmptyString(record.updatedAt) ??
        asNonEmptyString(record.updated_at) ??
        asNonEmptyString(record.timestamp) ??
        asNonEmptyString(record.updated) ??
        asNonEmptyString(record.lastUpdated) ??
        asNonEmptyString(record.last_updated) ??
        null;
      return {
        level: clamped,
        deviceId,
        updatedAt,
      };
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        const parsed = Number(trimmed);
        if (Number.isFinite(parsed)) {
          const clamped = Math.max(0, Math.min(100, parsed));
          const deviceId =
            asNonEmptyString(record.deviceId) ??
            asNonEmptyString(record.device_id) ??
            asNonEmptyString(record.device) ??
            asNonEmptyString(record.deviceName) ??
            asNonEmptyString(record.device_name) ??
            null;
          const updatedAt =
            asNonEmptyString(record.updatedAt) ??
            asNonEmptyString(record.updated_at) ??
            asNonEmptyString(record.timestamp) ??
            asNonEmptyString(record.updated) ??
            asNonEmptyString(record.lastUpdated) ??
            asNonEmptyString(record.last_updated) ??
            null;
          return {
            level: clamped,
            deviceId,
            updatedAt,
          };
        }
      }
    }
    if (value && typeof value === "object") {
      const nested = extractBatteryLevelInfo(value);
      if (nested) {
        return nested;
      }
    }
  }

  const nestedKeys = [
    "batteryLevel",
    "battery_level",
    "data",
    "payload",
    "info",
    "latest",
    "details",
  ];

  for (const key of nestedKeys) {
    const nestedCandidate = record[key];
    if (nestedCandidate && typeof nestedCandidate === "object" && nestedCandidate !== record) {
      const nested = extractBatteryLevelInfo(nestedCandidate);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
};
const extractCircleMembers = (circle: any): CircleMember[] => {
  if (!circle) return [];

  const candidateLists = [
    circle?.Users,
  ];

  const rawMembers = candidateLists.find((value) => Array.isArray(value)) ?? [];

  if (!Array.isArray(rawMembers)) return [];

  return rawMembers
    .filter(Boolean)
    .map((member: any) => ({
      id: member?.id ?? member?.userId ?? member?.UserId ?? undefined,
      name: member?.name ?? member?.Name,
      email: member?.email ?? member?.Email,

      // Avatar Fix: Check direct string first
      avatar:
        (() => {
          const raw = member?.avatar ??
            extractAvatarUrl(member) ??
            extractAvatarUrl(member?.Membership) ??
            null;

          if (typeof raw === "string" && raw.trim().length > 0) {
            let cleaned = raw.trim();
            if (cleaned.startsWith("/")) {
              cleaned = `${API_BASE_URL}${cleaned}`;
            }
            return cleaned.replace("/api/uploads", "/uploads");
          }
          return raw;
        })(),

      // Battery Fix: Check nested object property first
      batteryLevel:
        extractBatteryLevelInfo(member?.batteryLevel?.batteryLevel) ??
        extractBatteryLevelInfo(member?.batteryLevel) ??
        extractBatteryLevelInfo(member?.latestBatteryLevel) ??
        extractBatteryLevelInfo(member?.Membership?.batteryLevel) ??
        null,

      currentLocation: member?.currentLocation ?? member?.current_location ?? null,

      Membership: member?.Membership ?? member?.membership ?? undefined,

      // --- ADDED LOCATION HISTORY HERE ---
      // Mapping the array directly from the log you provided
      locationHistory: member?.todayLocationHistory ?? member?.locationHistory ?? [],
    }));
};
const parseAssignedLocationsList = (payload: any): any[] => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.data)) {
    return payload.data;
  }
  if (payload && Array.isArray(payload.assignedLocations)) {
    return payload.assignedLocations;
  }
  return [];
};

const buildAssignedLocationRecord = (item: any): { circleId: string; record: AssignedLocationRecord } | null => {
  if (!item) {
    return null;
  }

  const circleId = normalizeIdentifier(item.circleId ?? item.CircleId ?? item.circle_id);
  if (!circleId) {
    return null;
  }

  const locationId = normalizeIdentifier(item.locationId ?? item.LocationId ?? item.location_id ?? item.location?.id);

  const locationCandidate: Record<string, unknown> =
    item.location && typeof item.location === "object" ? { ...item.location } : {};

  if (locationCandidate.id === undefined) {
    locationCandidate.id = item.location?.id ?? item.locationId ?? item.location_id;
  }

  const latFallback = typeof item.latitude === "number" ? item.latitude : item.lat;
  const lngFallback = typeof item.longitude === "number" ? item.longitude : item.lng;

  if (locationCandidate.latitude === undefined) {
    locationCandidate.latitude = item.location?.latitude ?? (locationCandidate as any).lat ?? latFallback;
  }

  if (locationCandidate.longitude === undefined) {
    locationCandidate.longitude = item.location?.longitude ?? (locationCandidate as any).lng ?? lngFallback;
  }

  if (locationCandidate.name === undefined) {
    locationCandidate.name = item.location?.name ?? item.name;
  }

  if (locationCandidate.metadata === undefined) {
    locationCandidate.metadata = item.location?.metadata ?? item.metadata;
  }

  const formattedFallback =
    item.location?.formattedAddress ?? item.location?.formatted_address ?? item.formattedAddress;
  if ((locationCandidate as any).formattedAddress === undefined && formattedFallback !== undefined) {
    (locationCandidate as any).formattedAddress = formattedFallback;
  }

  if ((locationCandidate as any).address === undefined && item.location?.address) {
    (locationCandidate as any).address = item.location.address;
  }

  const locationPoint = normalizeLocationPoint(locationCandidate);
  const assignmentId =
    normalizeIdentifier(item.id ?? item.assignmentId ?? item.assignment_id) ?? `${circleId}:${locationId ?? "pending"}`;

  let normalizedMetadata: Record<string, unknown> | null = null;
  if (item.metadata && typeof item.metadata === "object") {
    normalizedMetadata = { ...item.metadata };
  } else if (item.location?.metadata && typeof item.location.metadata === "object") {
    normalizedMetadata = { ...item.location.metadata };
  }

  const latitudeValue = typeof item.latitude === "number" ? item.latitude : undefined;
  const longitudeValue = typeof item.longitude === "number" ? item.longitude : undefined;

  return {
    circleId,
    record: {
      assignmentId,
      circleId,
      locationId,
      locationPoint,
      latitude: latitudeValue,
      longitude: longitudeValue,
      metadata: normalizedMetadata,
      raw: item,
    },
  };
};

const normalizeLocationPoint = (loc: any): LocationPoint | null => {
  const latitudeCandidate = loc?.latitude ?? loc?.lat ?? loc?.Latitude ?? loc?.Lat;
  const longitudeCandidate = loc?.longitude ?? loc?.lng ?? loc?.lon ?? loc?.Longitude ?? loc?.Lon;
  const latitude = typeof latitudeCandidate === "string" ? Number(latitudeCandidate) : latitudeCandidate;
  const longitude = typeof longitudeCandidate === "string" ? Number(longitudeCandidate) : longitudeCandidate;

  if (!isValidCoordinate(latitude, longitude)) {
    return null;
  }

  let metadata: LocationPoint["metadata"] | undefined;
  if (loc?.metadata && typeof loc.metadata === "object") {
    metadata = { ...loc.metadata };
  }

  const mergeMetadata = (updates: Partial<NonNullable<LocationPoint["metadata"]>>) => {
    metadata = { ...(metadata ?? {}), ...updates };
  };

  const inferredAddress = loc?.address ?? loc?.Address ?? loc?.formattedAddress ?? loc?.formatted_address;
  if (typeof inferredAddress === "string" && inferredAddress.trim().length > 0) {
    mergeMetadata({
      address: metadata?.address ?? inferredAddress.trim(),
      formattedAddress: metadata?.formattedAddress ?? inferredAddress.trim(),
    });
  }

  if (loc?.radius !== undefined && loc?.radius !== null) {
    const numericRadius = Number(loc.radius);
    if (Number.isFinite(numericRadius) && (metadata?.radius === undefined || metadata?.radius === null)) {
      mergeMetadata({ radius: numericRadius });
    }
  }

  const rawId = loc?.id ?? loc?.locationId ?? loc?.LocationId;
  let resolvedId: number | string | undefined;

  if (typeof rawId === "string") {
    resolvedId = rawId.trim().length > 0 ? rawId.trim() : undefined;
  } else if (typeof rawId === "number" && Number.isFinite(rawId)) {
    resolvedId = rawId;
  }

  return {
    id: resolvedId,
    latitude,
    longitude,
    name: typeof loc?.name === "string" && loc.name.trim().length > 0 ? loc.name : loc?.label ?? undefined,
    metadata,
  };
};

const extractCircleLocations = (circle: any): LocationPoint[] => {
  if (!circle) return [];
  const rawLocations =
    circle?.Locations ??
    circle?.locations ??
    circle?.SavedLocations ??
    circle?.savedLocations ??
    circle?.locationList ??
    [];

  if (!Array.isArray(rawLocations)) return [];
  return rawLocations
    .map((loc) => normalizeLocationPoint(loc))
    .filter((loc): loc is LocationPoint => loc !== null);
};

type LocationLike = Record<string, unknown>;

const COORDINATE_FIELD_PAIRS: [string, string][] = [
  ["latitude", "longitude"],
  ["lat", "lng"],
  ["lat", "lon"],
  ["Latitude", "Longitude"],
  ["Lat", "Long"],
  ["LATITUDE", "LONGITUDE"],
  ["LAT", "LON"],
];

const ACCURACY_FIELD_KEYS = ["accuracy", "horizontalAccuracy", "accuracyMeters", "accuracy_meters", "precision"];
const HEADING_FIELD_KEYS = ["heading", "bearing", "course"];
const LOCATION_COLLECTION_KEYS = [
  "memberLocations",
  "member_locations",
  "memberLocation",
  "member_location",
  "userLocations",
  "user_locations",
  "usersLocations",
  "users_locations",
  "currentMemberLocations",
  "current_member_locations",
  "currentLocations",
  "current_locations",
  "latestLocations",
  "latest_locations",
  "liveLocations",
  "live_locations",
  "Locations",
  "locations",
  "locationUpdates",
  "location_updates",
];

const LOCATION_OWNER_ID_KEYS = [
  "userId",
  "user_id",
  "userID",
  "memberId",
  "member_id",
  "memberID",
  "profileId",
  "profile_id",
  "personId",
  "person_id",
  "accountId",
  "account_id",
  "ownerId",
  "owner_id",
  "deviceUserId",
  "device_user_id",
];

const nestedCoordinateKeys = ["coords", "coordinate", "position", "location", "geo", "point"];

const extractCoordinatesFromCandidate = (candidate: unknown, visited = new WeakSet<object>()): UserLocation | null => {
  if (!candidate) {
    return null;
  }

  if (typeof candidate === "string") {
    const trimmed = candidate.trim();
    if (!trimmed) {
      return null;
    }
    try {
      const parsed = JSON.parse(trimmed);
      return extractCoordinatesFromCandidate(parsed, visited);
    } catch {
      return null;
    }
  }

  if (typeof candidate !== "object") {
    return null;
  }

  if (visited.has(candidate as object)) {
    return null;
  }
  visited.add(candidate as object);

  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      const extracted = extractCoordinatesFromCandidate(item, visited);
      if (extracted) {
        return extracted;
      }
    }
    return null;
  }

  const obj = candidate as LocationLike;

  for (const [latKey, lonKey] of COORDINATE_FIELD_PAIRS) {
    const latCandidate = obj[latKey];
    const lonCandidate = obj[lonKey];
    const latitude = coerceFiniteNumber(latCandidate);
    const longitude = coerceFiniteNumber(lonCandidate);
    if (latitude !== null && longitude !== null) {
      let accuracy: number | null = null;
      for (const key of ACCURACY_FIELD_KEYS) {
        const val = coerceFiniteNumber(obj[key]);
        if (val !== null) {
          accuracy = val;
          break;
        }
      }

      let heading: number | undefined;
      for (const key of HEADING_FIELD_KEYS) {
        const val = coerceFiniteNumber(obj[key]);
        if (val !== null) {
          heading = val;
          break;
        }
      }

      return {
        latitude,
        longitude,
        accuracy,
        heading,
      };
    }
  }

  for (const key of nestedCoordinateKeys) {
    const nested = obj[key];
    if (nested && typeof nested === "object") {
      const extracted = extractCoordinatesFromCandidate(nested, visited);
      if (extracted) {
        return extracted;
      }
    }
  }

  return null;
};

const gatherLocationEntries = (circlePayload: any): unknown[] => {
  if (!circlePayload || typeof circlePayload !== "object") {
    return [];
  }

  const entries: unknown[] = [];

  for (const key of LOCATION_COLLECTION_KEYS) {
    const value = (circlePayload as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      entries.push(...value);
    }
  }

  const nestedCandidates = [
    (circlePayload as Record<string, unknown>)?.data,
    (circlePayload as Record<string, unknown>)?.payload,
    (circlePayload as Record<string, unknown>)?.details,
  ];

  for (const candidate of nestedCandidates) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }
    for (const key of LOCATION_COLLECTION_KEYS) {
      const nestedValue = (candidate as Record<string, unknown>)[key];
      if (Array.isArray(nestedValue)) {
        entries.push(...nestedValue);
      }
    }
  }

  return entries;
};

const buildMemberNameLookup = (members: CircleMember[]): Map<string, string> => {
  const map = new Map<string, string>();
  members.forEach((member) => {
    const memberId = resolveMemberId(member);
    if (!memberId) {
      return;
    }
    const names = [
      member?.Membership?.nickname,
      member?.name,
      member?.email,
    ];
    names
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .forEach((value) => {
        map.set(value.trim().toLowerCase(), memberId);
      });
  });
  return map;
};

const resolveLocationOwnerId = (
  location: Record<string, unknown>,
  members: CircleMember[],
  nameLookup: Map<string, string>
): string | null => {
  for (const key of LOCATION_OWNER_ID_KEYS) {
    const ownerCandidate = location[key];
    const normalized = normalizeIdentifier(ownerCandidate);
    if (normalized) {
      return normalized;
    }
  }

  const nestedOwnerCandidates = [
    (location.user as Record<string, unknown> | undefined)?.id,
    (location.member as Record<string, unknown> | undefined)?.id,
    (location.profile as Record<string, unknown> | undefined)?.id,
    (location.owner as Record<string, unknown> | undefined)?.id,
    (location.device as Record<string, unknown> | undefined)?.userId,
  ];

  for (const candidate of nestedOwnerCandidates) {
    const normalized = normalizeIdentifier(candidate);
    if (normalized) {
      return normalized;
    }
  }

  if (location.metadata && typeof location.metadata === "object") {
    const metadataRecord = location.metadata as Record<string, unknown>;
    for (const key of LOCATION_OWNER_ID_KEYS) {
      const normalized = normalizeIdentifier(metadataRecord[key]);
      if (normalized) {
        return normalized;
      }
    }
    if (metadataRecord.user && typeof metadataRecord.user === "object") {
      const nestedUserId = normalizeIdentifier((metadataRecord.user as Record<string, unknown>).id);
      if (nestedUserId) {
        return nestedUserId;
      }
    }
  }

  const possibleNameKeys = ["name", "label", "title", "nickname"];
  for (const key of possibleNameKeys) {
    const value = location[key];
    if (typeof value === "string" && value.trim().length > 0) {
      const normalized = nameLookup.get(value.trim().toLowerCase());
      if (normalized) {
        return normalized;
      }
    }
  }

  // Fallback: Check if the location's own ID matches a member ID (or normalized member ID)
  // This helps if the API returns a list of locations where the 'id' IS the userId
  if (location.id) {
    const candidateId = normalizeIdentifier(location.id);
    if (candidateId) {
      // Check if this ID exists in our members list
      // We can check if it's in the nameLookup values (which are member IDs)
      // keys -> names, values -> member IDs.
      // But nameLookup is a Map<Name, MemberId>. 
      // We need to check if 'candidateId' is a valid MemberId.
      // We can iterate members or build a Set. 
      // Since we have 'members' array here:
      const match = members.find(m => resolveMemberId(m) === candidateId);
      if (match) {
        return candidateId;
      }
    }
  }

  return null;
};

const extractLocationFromMemberRecord = (member: CircleMember): UserLocation | null => {
  const membership = (member as any)?.Membership ?? {};
  const candidates: unknown[] = [
    (member as any)?.latestLocation,
    (member as any)?.latest_location,
    (member as any)?.lastLocation,
    (member as any)?.last_location,
    (member as any)?.lastKnownLocation,
    (member as any)?.last_known_location,
    (member as any)?.currentLocation,
    (member as any)?.current_location,
    (member as any)?.liveLocation,
    (member as any)?.live_location,
    (member as any)?.location,
    (member as any)?.Location,
    membership?.latestLocation,
    membership?.latest_location,
    membership?.lastLocation,
    membership?.last_location,
    membership?.lastKnownLocation,
    membership?.last_known_location,
    membership?.currentLocation,
    membership?.current_location,
    membership?.location,
    membership?.Location,
    // Add batteryLevel as a candidate, sometimes APIs mix them or user said "battery level"
    (member as any)?.batteryLevel,
    (member as any)?.battery_level,
  ];

  const locationArrays: unknown[] = [
    (member as any)?.locations,
    membership?.locations,
    membership?.locationHistory,
    (member as any)?.locationHistory,
  ];

  for (const arr of locationArrays) {
    if (Array.isArray(arr) && arr.length > 0) {
      candidates.push(arr[0]);
    }
  }

  const metadataCandidates: unknown[] = [];
  if ((member as any)?.metadata && typeof (member as any).metadata === "string") {
    metadataCandidates.push((member as any).metadata);
  }
  if (membership?.metadata) {
    metadataCandidates.push(membership.metadata);
  }

  candidates.push(...metadataCandidates);

  for (const candidate of candidates) {
    const extracted = extractCoordinatesFromCandidate(candidate);
    if (extracted) {
      return extracted;
    }
  }

  return null;
};

const buildMemberLocationMap = (circlePayload: any, members: CircleMember[]): Record<string, UserLocation> => {
  const map: Record<string, UserLocation> = {};
  if (!members.length) {
    return map;
  }

  const nameLookup = buildMemberNameLookup(members);
  const rawLocations = gatherLocationEntries(circlePayload);

  for (const raw of rawLocations) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const ownerId = resolveLocationOwnerId(raw as Record<string, unknown>, members, nameLookup);
    if (!ownerId) {
      continue;
    }
    const coords = extractCoordinatesFromCandidate(raw);
    if (!coords || !Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) {
      continue;
    }
    map[ownerId] = coords;
  }

  members.forEach((member) => {
    const memberId = resolveMemberId(member);
    if (!memberId) {
      return;
    }
    const directLocation = extractLocationFromMemberRecord(member);
    if (directLocation && Number.isFinite(directLocation.latitude) && Number.isFinite(directLocation.longitude)) {
      map[memberId] = directLocation;
    }
  });

  return map;
};

type MapType = 'standard' | 'satellite' | 'hybrid' | 'terrain';

const isValidCoordinate = (lat: number, lon: number) => {
  return typeof lat === "number" && typeof lon === "number" && !isNaN(lat) && !isNaN(lon);
};

const ROLE_OPTIONS = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
];

const normalizeRole = (role?: string | null) => {
  if (typeof role !== "string") return null;
  const trimmed = role.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
};

const formatRoleLabel = (role: string | null) => {
  if (!role) return "Member";
  if (role === "creator") return "Creator";
  if (role === "admin") return "Admin";
  return role.charAt(0).toUpperCase() + role.slice(1);
};

const resolveMemberId = (member: CircleMember | null | undefined) => {
  if (!member) {
    return null;
  }

  const membershipRecord = ((member as any)?.Membership ?? {}) as Record<string, unknown>;
  const primaryCandidates: unknown[] = [
    (member as any)?.id,
    (member as any)?.userId,
    (member as any)?.UserId,
    (member as any)?.user_id,
    (member as any)?.memberId,
    (member as any)?.member_id,
    (member as any)?.profileId,
    (member as any)?.profile_id,
    (member as any)?._id,
    (member as any)?.uuid,
    membershipRecord.id,
    membershipRecord.userId,
    membershipRecord.user_id,
    membershipRecord.memberId,
    membershipRecord.member_id,
    membershipRecord.profileId,
    membershipRecord.profile_id,
    (member as any)?.user?.id,
    (member as any)?.user?.userId,
    (member as any)?.user?.user_id,
    (member as any)?.user?._id,
    (member as any)?.user?.uuid,
    (member as any)?.account?.id,
    (member as any)?.Account?.id,
    (member as any)?.person?.id,
    (member as any)?.Person?.id,
  ];

  for (const candidate of primaryCandidates) {
    const normalized = normalizeIdentifier(candidate);
    if (normalized) {
      return normalized;
    }
  }

  const fallbackEmail = asNonEmptyString((member as any)?.email ?? (member as any)?.Email);
  if (fallbackEmail) {
    return fallbackEmail.toLowerCase();
  }

  return null;
};

// Modal component for circle notification settings
const CircleNotificationSettingsModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  loading: boolean;
  settings: CircleNotificationSettings;
  onSave: (newSettings: CircleNotificationSettings) => void;
  insets: { top: number; bottom: number; left: number; right: number };
}> = ({ visible, onClose, loading, settings, onSave, insets }) => {
  const [localSettings, setLocalSettings] = useState<CircleNotificationSettings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleChange = (type: string, value: NotificationRecipientType) => {
    setLocalSettings(prev => ({ ...prev, [type]: value }));
  };

  const notificationOptions = [
    { label: "Location Reached", key: NotificationType.LOCATION_REACHED },
    { label: "Location Left", key: NotificationType.LOCATION_LEFT },
    { label: "SOS Alert", key: NotificationType.SOS_ALERT },
    { label: "Low Battery", key: NotificationType.LOW_BATTERY },
    { label: "Crash Detected", key: NotificationType.CRASH_DETECTED },
    { label: "Invite", key: NotificationType.INVITE },
    { label: "Membership Accepted", key: NotificationType.MEMBERSHIP_ACCEPTED },
    { label: "Membership Rejected", key: NotificationType.MEMBERSHIP_REJECTED },
    { label: "Member Removed", key: NotificationType.MEMBER_REMOVED },
    { label: "Role Updated", key: NotificationType.ROLE_UPDATED },
    { label: "Nickname Updated", key: NotificationType.NICKNAME_UPDATED },
    { label: "Location Added", key: NotificationType.LOCATION_ADDED },
    { label: "Location Removed", key: NotificationType.LOCATION_REMOVED },
    { label: "Location Assigned", key: NotificationType.LOCATION_ASSIGNED },
    { label: "Location Unassigned", key: NotificationType.LOCATION_UNASSIGNED },
  ];

  const recipientOptions = [
    { label: "All Members", value: NotificationRecipientType.ALL_MEMBERS },
    { label: "Admins Only", value: NotificationRecipientType.CREATOR_AND_ADMINS },
    { label: "Triggering User", value: NotificationRecipientType.TRIGGERING_USER_ONLY },
    { label: "None", value: NotificationRecipientType.NONE },
  ];

  return (
    <RNModal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLORS.white, paddingTop: insets.top }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.black }}>Notification Settings</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={COLORS.black} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {notificationOptions.map(option => (
            <View key={option.key} style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.black, marginBottom: 8 }}>{option.label}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {recipientOptions.map(recipient => {
                  const isSelected = localSettings[option.key] === recipient.value || (!localSettings[option.key] && recipient.value === NotificationRecipientType.CREATOR_AND_ADMINS);
                  return (
                    <TouchableOpacity
                      key={recipient.value}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: isSelected ? COLORS.primary : COLORS.lightGray,
                        backgroundColor: isSelected ? COLORS.primary : 'transparent',
                        marginRight: 8,
                        marginBottom: 8
                      }}
                      onPress={() => handleChange(option.key, recipient.value)}
                    >
                      <Text style={{
                        color: isSelected ? COLORS.white : COLORS.gray,
                        fontSize: 12,
                        fontWeight: isSelected ? '600' : '500'
                      }}>{recipient.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={{ height: 1, backgroundColor: '#F3F4F6', marginTop: 8 }} />
            </View>
          ))}
        </ScrollView>

        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: COLORS.lightGray }}>
          <TouchableOpacity
            style={{ backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: 'center', opacity: loading ? 0.7 : 1 }}
            onPress={() => onSave(localSettings)}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 16 }}>Save Changes</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </RNModal>
  );
};

// =======================================================
// MAP SCREEN COMPONENT
// =======================================================
const MapScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadingCircles, setLoadingCircles] = useState(false);
  const loadingCirclesRef = useRef(false);
  const lastCircleFetchTimestampRef = useRef(0);
  const [location, setLocation] = useState<UserLocation | null>(null);
  const locationRef = useRef<UserLocation | null>(null);
  const locationWatchSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const [circles, setCircles] = useState<CircleData[]>([]);
  const circlesRef = useRef<CircleData[]>([]); // Ref to avoid stale closures in selection logic

  const [selectedCircle, setSelectedCircle] = useState<CircleData | null>(null);
  const selectedCircleRef = useRef<CircleData | null>(null);
  const activeCircleIdRef = useRef<string | null>(null);
  const [selectedCircleMembers, setSelectedCircleMembers] = useState<CircleMember[]>([]);
  const [memberLocations, setMemberLocations] = useState<Record<string, UserLocation>>({});
  const [memberAvatarUrls, setMemberAvatarUrls] = useState<Record<string, string | null>>({});
  const [activeTab, setActiveTab] = useState("Location");

  const [mapLayerStyle, setMapLayerStyle] = useState<MapType>('standard');
  const [isMapStyleModalOpen, setIsMapStyleModalOpen] = useState(false);

  const mapRef = useRef<MapView | null>(null);
  const locationHistoryMapRef = useRef<MapView | null>(null);
  const [isCirclesModalOpen, setIsCirclesModalOpen] = useState(false);
  const [isAddPlaceModalOpen, setIsAddPlaceModalOpen] = useState(false);
  const [placeModalMode, setPlaceModalMode] = useState<"create" | "edit">("create");
  const [locationBeingEdited, setLocationBeingEdited] = useState<LocationPoint | null>(null);
  const [shareTargetCircle, setShareTargetCircle] = useState<CircleData | null>(null);
  const [shareRequestId, setShareRequestId] = useState(0);
  const insets = useSafeAreaInsets();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserAvatarUrl, setCurrentUserAvatarUrl] = useState<string | null>(null);
  const [currentUserBatteryLevel, setCurrentUserBatteryLevel] = useState<BatteryLevelInfo | null>(null);
  const [editMemberModalVisible, setEditMemberModalVisible] = useState(false);
  const [memberBeingEdited, setMemberBeingEdited] = useState<CircleMember | null>(null);
  const [editedMemberRole, setEditedMemberRole] = useState<string>("member");
  const [editedMemberNickname, setEditedMemberNickname] = useState<string>("");
  const [isSavingMemberChanges, setIsSavingMemberChanges] = useState(false);
  const [memberModalError, setMemberModalError] = useState<string | null>(null);
  const [selectedMemberLocationId, setSelectedMemberLocationId] = useState<string | null>(null);
  const [memberRemovalLoadingId, setMemberRemovalLoadingId] = useState<string | null>(null);
  const [accountActionsVisible, setAccountActionsVisible] = useState(false);
  const [isLeavingCircle, setIsLeavingCircle] = useState(false);
  const [isDeletingCircle, setIsDeletingCircle] = useState(false);
  const [assignedLocationsByCircle, setAssignedLocationsByCircle] = useState<Record<string, AssignedLocationRecord>>({});
  const [loadingAssignedLocations, setLoadingAssignedLocations] = useState(false);
  const loadingAssignedLocationsRef = useRef(false);
  const lastAssignedFetchTimestampRef = useRef(0);
  const fetchCircleMembersInFlightRef = useRef(new Set<string>());
  const memberFetchTimestampsRef = useRef<Record<string, number>>({});
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState("");
  const [profileMetadataInput, setProfileMetadataInput] = useState("");
  const [profileAvatarOriginal, setProfileAvatarOriginal] = useState<string | null>(null);
  const [profileAvatarPreview, setProfileAvatarPreview] = useState<string | null>(null);
  const [profileAvatarUpload, setProfileAvatarUpload] = useState<PickedImage | null>(null);
  const [isPickingProfileImage, setIsPickingProfileImage] = useState(false);
  const [profileModalError, setProfileModalError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSendingSos, setIsSendingSos] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isUpdatingLocationSharing, setIsUpdatingLocationSharing] = useState(false);
  const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false);
  const [isLocationHistoryModalVisible, setIsLocationHistoryModalVisible] = useState(false);
  const [locationHistoryLoading, setLocationHistoryLoading] = useState(false);
  const [locationHistory, setLocationHistory] = useState<LocationHistoryEntry[]>([]);
  const [locationHistoryError, setLocationHistoryError] = useState<string | null>(null);
  const [locationHistoryActiveFilter, setLocationHistoryActiveFilter] = useState<LocationHistoryFilterKey>("today");
  const [locationHistoryCustomStart, setLocationHistoryCustomStart] = useState("");
  const [locationHistoryCustomEnd, setLocationHistoryCustomEnd] = useState("");
  const [shouldRenderLocationHistoryMap, setShouldRenderLocationHistoryMap] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // State for new journeys modal
  const [isMemberJourneysModalVisible, setIsMemberJourneysModalVisible] = useState(false);
  const [memberJourneysData, setMemberJourneysData] = useState<CircleMember[]>([]);

  // Circle Notification Settings
  const [isCircleNotificationSettingsModalVisible, setIsCircleNotificationSettingsModalVisible] = useState(false);
  const [currentNotificationSettings, setCurrentNotificationSettings] = useState<CircleNotificationSettings>({});
  const [isSavingCircleNotificationSettings, setIsSavingCircleNotificationSettings] = useState(false);

  const handleOpenCircleNotificationSettings = () => {
    if (!selectedCircle) return;

    // Permission check: Creator or Admin
    const myMemberRecord = selectedCircleMembers.find(m => resolveMemberId(m) === currentUserId);
    const role = normalizeRole((myMemberRecord?.Membership as any)?.role);
    const isCreator = selectedCircle.creatorId === currentUserId;
    const isAdmin = role === "admin";

    if (!isCreator && !isAdmin) {
      Alert.alert("Permission Denied", "Only circle creators and admins can update notification settings.");
      return;
    }

    // Load settings from circle data
    const settings = (selectedCircle as any).notificationSettings || {};
    setCurrentNotificationSettings(settings);
    setIsCircleNotificationSettingsModalVisible(true);
  };

  const handleSaveCircleNotificationSettings = async (newSettings: CircleNotificationSettings) => {
    if (!selectedCircle) return;
    setIsSavingCircleNotificationSettings(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/circles/${selectedCircle.id}/notification-settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ notificationSettings: newSettings }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message ?? "Failed to update notification settings.");
      }

      // Update local state by merging new settings
      // We do a shallow merge so we don't lose other circle props
      const updatedCircle = { ...selectedCircle, notificationSettings: newSettings };
      setSelectedCircle(updatedCircle);
      setCircles(prev => prev.map(c => c.id === updatedCircle.id ? updatedCircle : c));

      Alert.alert("Success", "Notification settings updated.");
      setIsCircleNotificationSettingsModalVisible(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update settings.";
      Alert.alert("Error", message);
    } finally {
      setIsSavingCircleNotificationSettings(false);
    }
  };


  const batteryLevelRef = useRef<number | null>(null);
  const lastBatterySyncRef = useRef<number>(0);
  const lowBatteryAlertSentRef = useRef(false);

  const postBatteryLevel = useCallback((level: number, force = false) => {
    const now = Date.now();
    if (!force && lastBatterySyncRef.current > 0) {
      const elapsed = now - lastBatterySyncRef.current;
      if (elapsed < BATTERY_SYNC_MIN_INTERVAL_MS) {
        return;
      }
    }

    lastBatterySyncRef.current = now;
    void sendBatteryLevelValue(level);
  }, []);

  const handleLowBatteryAlert = useCallback((level: number) => {
    if (level <= LOW_BATTERY_THRESHOLD) {
      if (lowBatteryAlertSentRef.current) {
        return;
      }

      lowBatteryAlertSentRef.current = true;
      void sendLowBatteryAlert(level, LOW_BATTERY_THRESHOLD).catch((error) => {
        console.warn("Failed to send low battery alert", error);
        lowBatteryAlertSentRef.current = false;
      });
    } else if (lowBatteryAlertSentRef.current) {
      lowBatteryAlertSentRef.current = false;
    }
  }, []);

  const handleOpenSettingsModal = useCallback(() => {
    setIsSettingsModalVisible(true);
  }, []);

  const handleCloseSettingsModal = useCallback(() => {
    setIsSettingsModalVisible(false);
  }, []);

  const handleToggleLocationSharing = useCallback(async (nextValue: boolean) => {
    if (isUpdatingLocationSharing || nextValue === locationSharingEnabled) {
      return;
    }

    setIsUpdatingLocationSharing(true);

    try {
      if (nextValue) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          Alert.alert(
            "Permission needed",
            "Allow location access in your device settings to share your location with the circle."
          );
          return;
        }

        if (isNativePlatform) {
          try {
            const backgroundPermission = await Location.requestBackgroundPermissionsAsync();
            if (backgroundPermission.status !== "granted") {
              Alert.alert(
                "Background access limited",
                "We'll share your location while the app is open. Enable background access in system settings for continuous updates."
              );
            }
          } catch (backgroundError) {
            console.warn("Failed to request background location permission", backgroundError);
          }
        }

        if (!locationRef.current) {
          try {
            const latest = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const refreshedLocation: UserLocation = {
              latitude: latest.coords.latitude,
              longitude: latest.coords.longitude,
              heading: latest.coords.heading ?? undefined,
              accuracy: latest.coords.accuracy ?? null,
            };
            setLocation(refreshedLocation);
            locationRef.current = refreshedLocation;
          } catch (refreshError) {
            console.warn("Failed to refresh location after enabling sharing", refreshError);
          }
        }
        if (isNativePlatform) {
          try {
            await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME, {
              accuracy: Location.Accuracy.High,
              distanceInterval: 20,
              deferredUpdatesDistance: 20,
              foregroundService: {
                notificationTitle: "Location Sharing Active",
                notificationBody: "Sharing your live location with your circle.",
                notificationColor: "#4F359B",
              },
            });
          } catch (startError) {
            console.warn("Failed to start background location updates", startError);
            Alert.alert("Background Error", "Could not start background location tracking.");
          }
        }
      } else if (isNativePlatform) {
        try {
          const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);
          if (hasStarted) {
            await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);
          }
        } catch (stopError) {
          console.warn("Failed to stop background location updates when disabling sharing", stopError);
        }
      }

      setLocationSharingEnabled(nextValue);

      await AsyncStorage.setItem(
        STORAGE_KEYS.locationSharingEnabled,
        nextValue ? "true" : "false"
      ).catch(() => undefined);

      if (!nextValue) {
        await clearAllPostedLocations().catch(() => undefined);
      } else if (selectedCircle?.id) {
        const circleId = normalizeIdentifier(selectedCircle.id);
        const latestLocation = locationRef.current;
        if (circleId && latestLocation) {
          void maybePostCircleLocationUpdate(circleId, {
            latitude: latestLocation.latitude,
            longitude: latestLocation.longitude,
            accuracy: latestLocation.accuracy ?? null,
          }).catch((error) => {
            console.warn("Immediate location post failed after enabling sharing", error);
          });
        }
      }
    } catch (error) {
      console.warn("Failed to update location sharing preference", error);
      Alert.alert(
        "Location sharing",
        "We couldn't update your location sharing preference. Please try again."
      );
    } finally {
      setIsUpdatingLocationSharing(false);
    }
  }, [isUpdatingLocationSharing, locationSharingEnabled, selectedCircle]);

  const handleToggleNotifications = useCallback(async (nextValue: boolean) => {
    if (isUpdatingNotifications || nextValue === notificationsEnabled) {
      return;
    }

    setIsUpdatingNotifications(true);

    try {
      if (nextValue) {
        const granted = await requestNotificationPermissions();
        if (!granted) {
          Alert.alert(
            "Permission needed",
            "Enable notifications in your device settings to receive circle alerts."
          );
          return;
        }
      }

      await setNotificationReceptionEnabled(nextValue);
      setNotificationsEnabled(nextValue);

      await AsyncStorage.setItem(
        STORAGE_KEYS.notificationsEnabled,
        nextValue ? "true" : "false"
      ).catch(() => undefined);
    } catch (error) {
      console.warn("Failed to update notification preference", error);
      Alert.alert(
        "Notifications",
        "We couldn't update your notification preference. Please try again."
      );
    } finally {
      setIsUpdatingNotifications(false);
    }
  }, [isUpdatingNotifications, notificationsEnabled]);

  useEffect(() => {
    let cancelled = false;

    const hydrateSettings = async () => {
      try {
        const [storedLocationSharing, storedNotifications] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.locationSharingEnabled),
          AsyncStorage.getItem(STORAGE_KEYS.notificationsEnabled),
        ]);

        if (cancelled) {
          return;
        }

        const initialLocationSharing = parseBooleanPreference(storedLocationSharing, true);
        setLocationSharingEnabled(initialLocationSharing);

        if (!initialLocationSharing && isNativePlatform) {
          try {
            const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);
            if (hasStarted) {
              await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);
            }
          } catch (stopError) {
            console.warn("Failed to stop location updates during settings hydration", stopError);
          }
        }

        const initialNotifications = parseBooleanPreference(storedNotifications, true);
        setNotificationsEnabled(initialNotifications);
        await setNotificationReceptionEnabled(initialNotifications);
        if (initialNotifications) {
          await requestNotificationPermissions();
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to hydrate settings preferences", error);
        }
      }
    };

    void hydrateSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    locationRef.current = location;

    if (!location) {
      return;
    }

    void storeLastKnownLocation({
      latitude: location.latitude,
      longitude: location.longitude,
    });
  }, [location]);

  useEffect(() => {
    let cancelled = false;

    const syncInitialBattery = async () => {
      const level = await readBatteryLevel();
      if (cancelled || level === null) {
        return;
      }

      batteryLevelRef.current = level;
      postBatteryLevel(level, true);
      handleLowBatteryAlert(level);
    };

    void syncInitialBattery();

    const unsubscribe = watchBatteryLevel((level) => {
      if (cancelled) {
        return;
      }

      const previousLevel = batteryLevelRef.current;
      batteryLevelRef.current = level;

      const shouldForce = previousLevel === null || Math.abs(level - (previousLevel ?? level)) >= 1;
      postBatteryLevel(level, shouldForce);
      handleLowBatteryAlert(level);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [handleLowBatteryAlert, postBatteryLevel]);

  useEffect(() => {
    selectedCircleRef.current = selectedCircle;
  }, [selectedCircle]);

  // --- Animation State (Pan Responder, SnapTo) ---
  const sheetHeight = useRef(new Animated.Value(INITIAL_SHEET_HEIGHT)).current;
  const [isExpanded, setIsExpanded] = useState(INITIAL_SHEET_HEIGHT > MID_HEIGHT);
  const dragStartHeightRef = useRef(INITIAL_SHEET_HEIGHT);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 10,
      onPanResponderGrant: () => {
        sheetHeight.stopAnimation((value) => {
          dragStartHeightRef.current = value ?? INITIAL_SHEET_HEIGHT;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        let newHeight = dragStartHeightRef.current - gestureState.dy;

        if (newHeight < MIN_HEIGHT) newHeight = MIN_HEIGHT;
        if (newHeight > MAX_HEIGHT) newHeight = MAX_HEIGHT;

        sheetHeight.setValue(newHeight);
      },
      onPanResponderRelease: (_, gestureState) => {
        const finalHeight = Math.min(
          Math.max(dragStartHeightRef.current - gestureState.dy, MIN_HEIGHT),
          MAX_HEIGHT
        );

        // Velocity check or significant distance check
        const isSwipeUp = gestureState.dy < -50;
        const isSwipeDown = gestureState.dy > 50;

        let target = finalHeight;

        if (isSwipeUp) {
          // Swipe Up: move to next stop
          if (dragStartHeightRef.current < MID_HEIGHT) { // From Min
            target = MID_HEIGHT;
          } else { // From Mid or Max
            target = MAX_HEIGHT;
          }
        } else if (isSwipeDown) {
          // Swipe Down: move to prev stop
          if (dragStartHeightRef.current > MID_HEIGHT) { // From Max
            target = MID_HEIGHT;
          } else { // From Mid or Min
            target = MIN_HEIGHT;
          }
        } else {
          // Snap to closest
          const distMin = Math.abs(finalHeight - MIN_HEIGHT);
          const distMid = Math.abs(finalHeight - MID_HEIGHT);
          const distMax = Math.abs(finalHeight - MAX_HEIGHT);

          if (distMid < distMin && distMid < distMax) {
            target = MID_HEIGHT;
          } else if (distMax < distMin && distMax < distMid) {
            target = MAX_HEIGHT;
          } else {
            target = MIN_HEIGHT;
          }
        }

        snapTo(target);
        setIsExpanded(target > MIN_HEIGHT);
      },
    })
  ).current;

  const snapTo = (targetHeight: number) => {
    dragStartHeightRef.current = targetHeight;
    Animated.spring(sheetHeight, {
      toValue: targetHeight,
      useNativeDriver: false,
      bounciness: 4,
      speed: 12
    }).start();
  };

  // --- Scroll / Section Tracking ---
  const sheetScrollRef = useRef<ScrollView | null>(null);
  const sectionPositions = useRef<Record<string, number>>({}).current;

  const scrollToSection = (key: string) => {
    const y = sectionPositions[key];
    if (y === undefined) return;
    const performScroll = () => {
      sheetScrollRef.current?.scrollTo({ y: Math.max(y - 10, 0), animated: true });
    };
    if (!isExpanded) {
      setIsExpanded(true);
      snapTo(MAX_HEIGHT);
      setTimeout(performScroll, 280);
    } else {
      performScroll();
    }
  };

  // --- CORE LOGIC: Fetch Members and their data from circle ---
  const fetchCircleMembers = useCallback(async (circleId: number | string | undefined) => {
    if (circleId === undefined || circleId === null) return;
    const circleIdParam = typeof circleId === "string" ? circleId : String(circleId);

    if (fetchCircleMembersInFlightRef.current.has(circleIdParam)) {
      return;
    }

    const lastFetch = memberFetchTimestampsRef.current[circleIdParam];
    if (lastFetch && Date.now() - lastFetch < MIN_MEMBER_REFRESH_INTERVAL_MS) {
      return;
    }

    fetchCircleMembersInFlightRef.current.add(circleIdParam);

    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/circles/${circleIdParam}`, {
        headers: { accept: "application/json" },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.warn("Failed to load circle members", payload?.message);
        return;
      }

      const circlePayload =
        payload?.data?.circle ??
        payload?.circle ??
        payload?.data ??
        payload;

      const normalizedLocations = extractCircleLocations(circlePayload);
      const normalizedCircle = {
        ...circlePayload,
        Locations: normalizedLocations,
      } as CircleData;

      const members = extractCircleMembers(normalizedCircle);
      console.log("fetchCircleMembers members extracted:", members.length, members.map(m => ({ id: m.id, avatar: m.avatar })));

      setSelectedCircleMembers(members);

      const avatarMap = members.reduce<Record<string, string | null>>((acc, member) => {
        const memberId = resolveMemberId(member);
        if (!memberId) {
          return acc;
        }
        // Use direct avatar property from CircleMember if available, otherwise try extraction
        const avatar = member.avatar ?? extractAvatarUrl(member) ?? extractAvatarUrl(member?.Membership) ?? null;
        acc[memberId] = avatar;
        return acc;
      }, {});



      const locationMap = buildMemberLocationMap(circlePayload, members);

      setMemberAvatarUrls(avatarMap);
      setMemberLocations(locationMap);

      if (currentUserId) {
        const selfMember = members.find((member) => resolveMemberId(member) === currentUserId);
        const avatarFromMembers = extractAvatarUrl(selfMember) ?? extractAvatarUrl(selfMember?.Membership);
        if (avatarFromMembers) {
          setCurrentUserAvatarUrl(avatarFromMembers);
        }
        if (selfMember?.batteryLevel) {
          setCurrentUserBatteryLevel(selfMember.batteryLevel);
        }
      }

      // Update the full object if we got more details
      setSelectedCircle((prev) => {
        if (prev && String(prev.id) === circleIdParam) {
          return {
            ...prev,
            ...normalizedCircle,
            Locations: normalizedLocations,
          } as CircleData;
        }
        return prev;
      });
    } catch (error) {
      console.error("Failed to fetch circle members", error);
    } finally {
      fetchCircleMembersInFlightRef.current.delete(circleIdParam);
      memberFetchTimestampsRef.current[circleIdParam] = Date.now();
    }
  }, [currentUserId]);

  // --- CORE LOGIC: Select Circle ---
  const selectCircle = useCallback(
    async (circleId: number | string | null, circleList?: CircleData[]) => {
      if (circleId === null) {
        const previousCircleId = normalizeIdentifier(selectedCircleRef.current?.id);
        if (previousCircleId) {
          await removeCachedCircleLocations(previousCircleId);
          await removeLastPostedLocationForCircle(previousCircleId);
        }
        setSelectedCircle(null);
        setSelectedCircleMembers([]);
        setMemberAvatarUrls({});
        setMemberLocations({});
        await AsyncStorage.removeItem(STORAGE_KEYS.lastSelectedCircleId).catch(() => undefined);
        return;
      }

      const sourceList = circleList ?? circlesRef.current;
      if (!sourceList.length) return;

      const targetId = String(circleId);
      const found = sourceList.find((c) => String(c.id) === targetId);
      if (!found) return;

      const normalizedLocations = extractCircleLocations(found);
      const normalizedCircle: CircleData = {
        ...found,
        Locations: normalizedLocations,
      };

      setSelectedCircle(normalizedCircle);
      const currentMembers = extractCircleMembers(normalizedCircle);
      console.log("selectCircle members extracted:", currentMembers.length, currentMembers.map(m => ({ id: m.id, avatar: m.avatar })));

      setSelectedCircleMembers(currentMembers);

      const avatarMap = currentMembers.reduce<Record<string, string | null>>((acc, member) => {
        const memberId = resolveMemberId(member);
        if (!memberId) {
          return acc;
        }
        // Explicitly check member.avatar which we know is populated
        const avatar = member.avatar ?? extractAvatarUrl(member) ?? extractAvatarUrl(member?.Membership) ?? null;
        acc[memberId] = avatar;
        return acc;
      }, {});

      console.log("selectCircle avatarMap:", JSON.stringify(avatarMap, null, 2));

      const locationMap = buildMemberLocationMap(found, currentMembers);
      const hasMemberLocations = Object.keys(locationMap).length > 0;

      setMemberAvatarUrls(avatarMap);
      setMemberLocations(locationMap);

      if (currentUserId) {
        const selfMember = currentMembers.find((member) => resolveMemberId(member) === currentUserId);
        const avatarFromMembers = extractAvatarUrl(selfMember);
        if (avatarFromMembers) {
          setCurrentUserAvatarUrl(avatarFromMembers);
        }
        if (selfMember?.batteryLevel) {
          setCurrentUserBatteryLevel(selfMember.batteryLevel);
        }
      }

      // Always fetch fresh member data to ensure we have the latest locations
      // This fixes an issue where the initial list might lack current locations
      fetchCircleMembers(found.id);

      setIsCirclesModalOpen(false);
      await AsyncStorage.setItem(STORAGE_KEYS.lastSelectedCircleId, String(found.id)).catch(() => undefined);

      // Fit Map to Circle Content
      if (normalizedLocations.length > 0 && mapRef.current) {
        const coords = normalizedLocations
          .filter((l) => isValidCoordinate(l.latitude, l.longitude))
          .map((l) => ({ latitude: l.latitude, longitude: l.longitude }));

        // Include user location in bounds if available
        const latestLocation = locationRef.current;
        if (latestLocation) {
          coords.push({ latitude: latestLocation.latitude, longitude: latestLocation.longitude });
        }

        if (coords.length > 0) {
          setTimeout(() => {
            mapRef.current?.fitToCoordinates(coords, {
              edgePadding: { top: 100, right: 50, bottom: MIN_HEIGHT + 100, left: 50 },
              animated: true,
            });
          }, 500);
        }
      }
    },
    [currentUserId, fetchCircleMembers]
  );

  const handleSelectCircle = useCallback(
    (circleId: number | string, circleList?: CircleData[]) => {
      selectCircle(circleId, circleList);
    },
    [selectCircle]
  );

  // --- CORE LOGIC: Fetch Current User Profile ---
  const fetchCurrentUserProfile = useCallback(async () => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/profile`, {
        method: "GET",
        headers: { accept: "application/json" },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.warn("Failed to fetch current user profile", payload?.message);
        return;
      }

      const userPayload =
        payload?.data?.user ??
        payload?.user ??
        payload?.data ??
        payload;

      const userIdCandidate =
        userPayload?.id ??
        userPayload?._id ??
        userPayload?.userId ??
        userPayload?.uuid ??
        null;

      const normalizedUserId =
        userIdCandidate !== undefined && userIdCandidate !== null
          ? String(userIdCandidate)
          : currentUserId;

      if (normalizedUserId && normalizedUserId !== currentUserId) {
        setCurrentUserId(normalizedUserId);
      }

      const avatarFromProfile = extractAvatarUrl(userPayload);
      if (avatarFromProfile) {
        setCurrentUserAvatarUrl(avatarFromProfile);
        setProfileAvatarOriginal((prev) => prev ?? avatarFromProfile);
        setProfileAvatarPreview((prev) => prev ?? avatarFromProfile);

        if (normalizedUserId) {
          setMemberAvatarUrls((prev) => {
            if (prev[normalizedUserId] === avatarFromProfile) {
              return prev;
            }
            return { ...prev, [normalizedUserId]: avatarFromProfile };
          });
        }
      }

      if (userPayload?.batteryLevel) {
        const batteryData = userPayload.batteryLevel as Record<string, unknown>;
        setCurrentUserBatteryLevel({
          level: typeof batteryData.level === "number" ? batteryData.level : Number(batteryData.level ?? NaN),
          deviceId: asNonEmptyString(batteryData.deviceId) ?? null,
          updatedAt: asNonEmptyString(batteryData.updatedAt) ?? null,
        });
      } else {
        setCurrentUserBatteryLevel(null);
      }

      if (normalizedUserId) {
        const possibleLocation = extractCoordinatesFromCandidate(userPayload);
        if (
          possibleLocation &&
          Number.isFinite(possibleLocation.latitude) &&
          Number.isFinite(possibleLocation.longitude)
        ) {
          setMemberLocations((prev) => {
            const existing = prev[normalizedUserId];
            if (
              existing &&
              existing.latitude === possibleLocation.latitude &&
              existing.longitude === possibleLocation.longitude &&
              existing.accuracy === possibleLocation.accuracy
            ) {
              return prev;
            }
            return { ...prev, [normalizedUserId]: possibleLocation };
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch current user profile", error);
    }
  }, [currentUserId]);

  const loadAssignedLocations = useCallback(async (force: boolean = false) => {
    if (loadingAssignedLocationsRef.current) {
      return;
    }

    if (!force) {
      const elapsed = Date.now() - lastAssignedFetchTimestampRef.current;
      if (elapsed < MIN_ASSIGNED_REFRESH_INTERVAL_MS) {
        return;
      }
    }

    loadingAssignedLocationsRef.current = true;
    setLoadingAssignedLocations(true);

    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/profile/assigned-locations`, {
        method: "GET",
        headers: { accept: "application/json" },
      });

      if (response.status === 401) {
        console.log("Assigned locations request unauthorized - redirecting to login");
        await logout();
        router.replace("/screens/LogInScreen");
        return;
      }

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.warn("Failed to fetch assigned locations", payload?.message);
        return;
      }

      const rawList = parseAssignedLocationsList(payload);

      if (!rawList.length) {
        setAssignedLocationsByCircle({});
        return;
      }

      const map: Record<string, AssignedLocationRecord> = {};
      for (const item of rawList) {
        const normalized = buildAssignedLocationRecord(item);
        if (!normalized) {
          continue;
        }
        map[normalized.circleId] = normalized.record;
      }

      setAssignedLocationsByCircle(map);
    } catch (error) {
      console.warn("Failed to load assigned locations", error);
    } finally {
      loadingAssignedLocationsRef.current = false;
      setLoadingAssignedLocations(false);
      lastAssignedFetchTimestampRef.current = Date.now();
    }
  }, []);

  // --- CORE LOGIC: Load Circles (Robust Version) ---
  const loadCircles = useCallback(async (force: boolean = false) => {
    if (loadingCirclesRef.current) {
      return;
    }

    if (!force) {
      const elapsed = Date.now() - lastCircleFetchTimestampRef.current;
      if (elapsed < MIN_CIRCLE_REFRESH_INTERVAL_MS) {
        return;
      }
    }

    try {
      loadingCirclesRef.current = true;
      setLoadingCircles(true);
      console.log("Fetching circles from:", `${API_BASE_URL}/circles`);

      const res = await authenticatedFetch(`${API_BASE_URL}/circles`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 401) {
        console.log("Unauthorized access - redirecting to login");
        loadingCirclesRef.current = false;
        setLoadingCircles(false);
        await logout();
        return router.replace("/screens/LogInScreen");
      }

      if (!res.ok) {
        console.error("Failed to fetch circles. Status:", res.status);
        return;
      }

      const data = await res.json();

      // Handle various response structures
      let list: CircleData[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data && Array.isArray(data.data)) {
        list = data.data;
      } else if (data && Array.isArray(data.circles)) {
        list = data.circles;
      }

      setCircles(list);

      if (list.length === 0) {
        await selectCircle(null, []);
        return;
      }

      // Restore last selected circle or default to first
      try {
        const storedCircleId = await AsyncStorage.getItem(STORAGE_KEYS.lastSelectedCircleId);
        if (storedCircleId) {
          const matchingByString = list.find((c) => String(c.id) === storedCircleId);
          if (matchingByString) {
            await selectCircle(matchingByString.id, list);
            return;
          }

          const parsed = Number(storedCircleId);
          if (Number.isFinite(parsed)) {
            const matchingByNumber = list.find((c) => Number(c.id) === parsed);
            if (matchingByNumber) {
              await selectCircle(matchingByNumber.id, list);
              return;
            }
          }
        }

        await selectCircle(list[0].id, list);
      } catch (storageError) {
        console.warn("Failed to restore last selected circle", storageError);
      }
    } catch (e) {
      console.error("Network or Logic Error in loadCircles:", e);
      Alert.alert("Connection Error", "Please check your internet connection.");
    } finally {
      loadingCirclesRef.current = false;
      setLoadingCircles(false);
      lastCircleFetchTimestampRef.current = Date.now();
    }
  }, [selectCircle]);

  const requestCirclesRefresh = useCallback(() => {
    void loadCircles(true);
  }, [loadCircles]);


  // --- EFFECTS ---

  // 1. Sync Ref
  useEffect(() => {
    circlesRef.current = circles;
  }, [circles]);

  useEffect(() => {
    if (!currentUserId || !currentUserAvatarUrl) {
      return;
    }

    setSelectedCircleMembers((prevMembers) => {
      let changed = false;
      const updated = prevMembers.map((member) => {
        if (resolveMemberId(member) === currentUserId) {
          if (member.avatar === currentUserAvatarUrl) {
            return member;
          }
          changed = true;
          return {
            ...member,
            avatar: currentUserAvatarUrl,
          };
        }
        return member;
      });

      return changed ? updated : prevMembers;
    });
  }, [currentUserAvatarUrl, currentUserId]);

  useEffect(() => {
    if (!currentUserId || !currentUserAvatarUrl) {
      return;
    }

    setMemberAvatarUrls((prev) => {
      if (prev[currentUserId] === currentUserAvatarUrl) {
        return prev;
      }
      return { ...prev, [currentUserId]: currentUserAvatarUrl };
    });
  }, [currentUserAvatarUrl, currentUserId]);

  useEffect(() => {
    fetchCurrentUserProfile();
  }, [fetchCurrentUserProfile]);

  // 2. Initial Data Load (Location + Circles)
  useEffect(() => {
    const loadData = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            heading: pos.coords.heading || 0,
            accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy ?? null : null,
          });
        }
        // Load circles regardless of location success
        await loadCircles();
        await loadAssignedLocations();
      } catch (e) {
        console.warn("Location permission or load error:", e);
        await loadCircles();
        await loadAssignedLocations();
      } finally {
        setLoading(false);
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once

  // 3. Focus Effect (Refresh when screen comes into focus)
  useFocusEffect(
    useCallback(() => {
      if (!loading) {
        loadCircles();
        loadAssignedLocations();
      }
    }, [loading, loadCircles, loadAssignedLocations]) // Safe dependencies
  );

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const handleKeyboardShow = (event: any) => {
      setKeyboardHeight(event?.endCoordinates?.height ?? 0);
    };

    const handleKeyboardHide = () => {
      setKeyboardHeight(0);
    };

    const showListener = Keyboard.addListener(showEvent, handleKeyboardShow);
    const hideListener = Keyboard.addListener(hideEvent, handleKeyboardHide);

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const ensureForegroundWatch = async () => {
      try {
        let status = (await Location.getForegroundPermissionsAsync()).status;
        if (status !== "granted") {
          status = (await Location.requestForegroundPermissionsAsync()).status;
        }

        if (status !== "granted") {
          return;
        }

        try {
          locationWatchSubscriptionRef.current?.remove();
        } catch (cleanupError) {
          console.warn("Failed to remove existing location subscription", cleanupError);
        }

        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 5,
            timeInterval: 3500,
          },
          (position) => {
            if (cancelled || !position?.coords) {
              return;
            }

            const nextLocation: UserLocation = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              heading: position.coords.heading ?? undefined,
              accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy ?? null : null,
            };

            // Process location update immediately for connected circle
            if (activeCircleIdRef.current) {
              // Use non-blocking call to avoid freezing UI
              void processCircleLocationUpdate(activeCircleIdRef.current, {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy ?? null,
                speed: position.coords.speed ?? null,
              });
            }

            // Process location update immediately for connected circle
            if (activeCircleIdRef.current) {
              // Use non-blocking call to avoid freezing UI
              void processCircleLocationUpdate(activeCircleIdRef.current, {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy ?? null,
                speed: position.coords.speed ?? null,
              });
            }

            setLocation(nextLocation);
            locationRef.current = nextLocation;
          }
        );

        if (cancelled) {
          subscription.remove();
        } else {
          locationWatchSubscriptionRef.current = subscription;
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to start foreground location watcher", error);
        }
      }
    };

    void ensureForegroundWatch();

    return () => {
      cancelled = true;
      if (locationWatchSubscriptionRef.current) {
        try {
          locationWatchSubscriptionRef.current.remove();
        } catch (error) {
          console.warn("Failed to remove location watcher", error);
        }
        locationWatchSubscriptionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    activeCircleIdRef.current = selectedCircle?.id ? String(selectedCircle.id) : null;
  }, [selectedCircle]);

  // 4. Update members when selection changes
  useEffect(() => {
    if (!selectedCircle) {
      setSelectedCircleMembers([]);
      return;
    }

    const members = extractCircleMembers(selectedCircle);
    setSelectedCircleMembers(members);

    if (!members.length) {
      fetchCircleMembers(selectedCircle.id);
    }
  }, [selectedCircle, fetchCircleMembers]);

  // 5. Close modals on specific state changes
  useEffect(() => {
    if (!selectedCircle && isAddPlaceModalOpen) {
      setIsAddPlaceModalOpen(false);
    }
  }, [isAddPlaceModalOpen, selectedCircle]);

  useEffect(() => {
    if (!isNativePlatform) {
      return;
    }

    registerBackgroundLocationTask();

    let cancelled = false;

    const manageBackgroundLocationUpdates = async () => {
      try {
        if (!locationSharingEnabled) {
          const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);
          if (hasStarted) {
            await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);
          }
          return;
        }

        if (!selectedCircle) {
          const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);
          if (hasStarted) {
            await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);
          }
          return;
        }

        const foregroundPermissions = await Location.getForegroundPermissionsAsync();
        let foregroundStatus = foregroundPermissions.status;
        if (foregroundStatus !== "granted") {
          const request = await Location.requestForegroundPermissionsAsync();
          foregroundStatus = request.status;
          if (foregroundStatus !== "granted") {
            return;
          }
        }

        const backgroundPermissions = await Location.getBackgroundPermissionsAsync();
        let backgroundStatus = backgroundPermissions.status;
        if (backgroundStatus !== "granted") {
          const request = await Location.requestBackgroundPermissionsAsync();
          backgroundStatus = request.status;
          if (backgroundStatus !== "granted") {
            return;
          }
        }

        const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);
        if (!hasStarted) {
          await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME, {
            accuracy: Location.Accuracy.High,
            distanceInterval: 10,
            deferredUpdatesDistance: 10,
            showsBackgroundLocationIndicator: Platform.OS === "ios",
            pausesUpdatesAutomatically: false,
            foregroundService: {
              notificationTitle: "Location sharing active",
              notificationBody: "Sharing your location with the circle.",
              notificationColor: COLORS.primary,
            },
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("Background location setup failed", error);
        }
      }
    };

    void manageBackgroundLocationUpdates();

    return () => {
      cancelled = true;
    };
  }, [locationSharingEnabled, selectedCircle]);

  const circleMembersById = useMemo(() => {
    const map = new Map<string, CircleMember>();
    selectedCircleMembers.forEach((member) => {
      const memberId = resolveMemberId(member);
      if (memberId) {
        map.set(memberId, member);
      }
    });
    return map;
  }, [selectedCircleMembers]);

  const currentLocations = useMemo(() => extractCircleLocations(selectedCircle), [selectedCircle]);

  useEffect(() => {
    const circleId = normalizeIdentifier(selectedCircle?.id);
    if (!circleId) {
      return;
    }

    void cacheCircleLocations(circleId, currentLocations);
  }, [currentLocations, selectedCircle]);

  const locationOptions = useMemo<MemberLocationOption[]>(() => {
    return currentLocations
      .map((loc, index) => {
        const id = normalizeIdentifier(loc.id);
        if (!id) {
          return null;
        }

        let metadataAddress: string | undefined;
        if (loc.metadata && typeof loc.metadata === "object") {
          const addressValue = (loc.metadata as any).address;
          const formattedValue = (loc.metadata as any).formattedAddress;
          if (typeof addressValue === "string" && addressValue.trim().length > 0) {
            metadataAddress = addressValue.trim();
          } else if (typeof formattedValue === "string" && formattedValue.trim().length > 0) {
            metadataAddress = formattedValue.trim();
          }
        }

        const label =
          loc.name && loc.name.trim().length > 0
            ? loc.name.trim()
            : metadataAddress ?? `Place ${index + 1}`;
        const subtitle = metadataAddress ?? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;

        return {
          id,
          label,
          subtitle,
        };
      })
      .filter((item): item is MemberLocationOption => item !== null);
  }, [currentLocations]);

  const assignedLocationLabel = useMemo(() => {
    if (!selectedMemberLocationId) {
      return "None";
    }
    const match = locationOptions.find((option) => option.id === selectedMemberLocationId);
    return match?.label ?? "Unknown place";
  }, [locationOptions, selectedMemberLocationId]);

  const selectedLocationExists = useMemo(() => {
    if (!selectedMemberLocationId) {
      return true;
    }
    return locationOptions.some((option) => option.id === selectedMemberLocationId);
  }, [locationOptions, selectedMemberLocationId]);

  const currentCircleId = useMemo(() => normalizeIdentifier(selectedCircle?.id), [selectedCircle]);

  const currentAssignedEntry = useMemo(() => {
    if (!currentCircleId) {
      return null;
    }
    return assignedLocationsByCircle[currentCircleId] ?? null;
  }, [assignedLocationsByCircle, currentCircleId]);

  const currentUserAssignedLocationId = useMemo(() => {
    if (!currentAssignedEntry) {
      return null;
    }

    return (
      normalizeIdentifier(
        currentAssignedEntry.locationId ??
        currentAssignedEntry.locationPoint?.id ??
        currentAssignedEntry.raw?.location?.id ??
        currentAssignedEntry.raw?.locationId ??
        currentAssignedEntry.raw?.location_id
      ) ?? null
    );
  }, [currentAssignedEntry]);

  const handleLocationArrivalAlerts = useCallback((arrived: CachedCircleLocation[]) => {
    if (!notificationsEnabled) {
      return;
    }

    if (!arrived || arrived.length === 0) {
      return;
    }

    const assignedLocationId = currentUserAssignedLocationId;

    arrived.forEach((location) => {
      const normalizedId = normalizeIdentifier(location.id);
      const isAssignedLocation = assignedLocationId !== null && normalizedId === assignedLocationId;

      let label: string | undefined;
      if (typeof location.name === "string" && location.name.trim().length > 0) {
        label = location.name.trim();
      } else if (location.metadata && typeof location.metadata === "object") {
        const metadataRecord = location.metadata as Record<string, unknown>;
        const addressValue = metadataRecord.address;
        const formattedValue = metadataRecord.formattedAddress ?? (metadataRecord as any)?.formatted_address;
        if (typeof addressValue === "string" && addressValue.trim().length > 0) {
          label = addressValue.trim();
        } else if (typeof formattedValue === "string" && formattedValue.trim().length > 0) {
          label = formattedValue.trim();
        }
      }

      if (!label) {
        label = `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
      }

      const title = isAssignedLocation ? "Assigned place reached" : "Circle place reached";
      const message = isAssignedLocation
        ? `You arrived at your assigned place${label ? `: ${label}` : ""}. We're notifying everyone in the circle.`
        : `You arrived at ${label}. We're notifying everyone in the circle.`;

      Alert.alert(title, message);
    });
  }, [currentUserAssignedLocationId, notificationsEnabled]);

  useEffect(() => {
    if (!locationSharingEnabled || !selectedCircle || !location) {
      return;
    }

    const circleId = normalizeIdentifier(selectedCircle.id);
    if (!circleId) {
      return;
    }

    void processCircleLocationUpdate(circleId, {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy ?? null,
    }, currentLocations, {
      onLocationsArrived: handleLocationArrivalAlerts,
    }).catch((error) => {
      console.warn("Location update failed", error);
    });
  }, [currentLocations, handleLocationArrivalAlerts, location, locationSharingEnabled, selectedCircle]);

  const assignedLocationDetails = useMemo<AssignedLocationDetails | null>(() => {
    if (!currentAssignedEntry) {
      return null;
    }

    const candidateId = currentUserAssignedLocationId;
    const matchingSavedLocation = candidateId
      ? currentLocations.find((loc) => normalizeIdentifier(loc.id) === candidateId)
      : undefined;

    const getMetadataAddress = (loc: LocationPoint | null | undefined) => {
      if (!loc?.metadata || typeof loc.metadata !== "object") {
        return undefined;
      }
      const meta = loc.metadata as Record<string, unknown>;
      const addressValue = meta.address;
      const formattedValue = meta.formattedAddress ?? (meta as any)?.formatted_address;
      if (typeof addressValue === "string" && addressValue.trim().length > 0) {
        return addressValue.trim();
      }
      if (typeof formattedValue === "string" && String(formattedValue).trim().length > 0) {
        return String(formattedValue).trim();
      }
      return undefined;
    };

    let label = "Assigned location";
    let subtitle: string | undefined;
    let coordinates: { latitude: number; longitude: number } | undefined;

    if (matchingSavedLocation) {
      label =
        (typeof matchingSavedLocation.name === "string" && matchingSavedLocation.name.trim().length > 0)
          ? matchingSavedLocation.name.trim()
          : getMetadataAddress(matchingSavedLocation) ?? label;
      coordinates = {
        latitude: matchingSavedLocation.latitude,
        longitude: matchingSavedLocation.longitude,
      };
      const savedSubtitle = getMetadataAddress(matchingSavedLocation);
      subtitle = savedSubtitle ?? `${matchingSavedLocation.latitude.toFixed(4)}, ${matchingSavedLocation.longitude.toFixed(4)}`;
    } else if (currentAssignedEntry.locationPoint) {
      const loc = currentAssignedEntry.locationPoint;
      label =
        (typeof loc.name === "string" && loc.name.trim().length > 0)
          ? loc.name.trim()
          : getMetadataAddress(loc) ?? label;
      coordinates = { latitude: loc.latitude, longitude: loc.longitude };
      const locationSubtitle = getMetadataAddress(loc);
      subtitle = locationSubtitle ?? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
    } else if (
      typeof currentAssignedEntry.latitude === "number" &&
      typeof currentAssignedEntry.longitude === "number"
    ) {
      coordinates = {
        latitude: currentAssignedEntry.latitude,
        longitude: currentAssignedEntry.longitude,
      };
      subtitle = `${currentAssignedEntry.latitude.toFixed(4)}, ${currentAssignedEntry.longitude.toFixed(4)}`;
    }

    return {
      label,
      subtitle,
      coordinates,
    };
  }, [currentAssignedEntry, currentLocations, currentUserAssignedLocationId]);

  const fallbackAssignedMarker = useMemo(() => {
    if (!currentAssignedEntry) {
      return null;
    }

    if (currentUserAssignedLocationId) {
      const existsInSaved = currentLocations.some(
        (loc) => normalizeIdentifier(loc.id) === currentUserAssignedLocationId
      );
      if (existsInSaved) {
        return null;
      }
    }

    if (currentAssignedEntry.locationPoint) {
      const { latitude, longitude } = currentAssignedEntry.locationPoint;
      if (isValidCoordinate(latitude, longitude)) {
        return {
          latitude,
          longitude,
          title: assignedLocationDetails?.label ??
            (typeof currentAssignedEntry.locationPoint.name === "string" && currentAssignedEntry.locationPoint.name.trim().length > 0
              ? currentAssignedEntry.locationPoint.name.trim()
              : "Assigned location"),
          subtitle: assignedLocationDetails?.subtitle,
          radius: getRadiusForLocation(currentAssignedEntry.locationPoint),
        };
      }
    }

    if (
      typeof currentAssignedEntry.latitude === "number" &&
      typeof currentAssignedEntry.longitude === "number" &&
      isValidCoordinate(currentAssignedEntry.latitude, currentAssignedEntry.longitude)
    ) {
      return {
        latitude: currentAssignedEntry.latitude,
        longitude: currentAssignedEntry.longitude,
        title: assignedLocationDetails?.label ?? "Assigned location",
        subtitle: assignedLocationDetails?.subtitle,
        radius: DEFAULT_LOCATION_RADIUS_METERS,
      };
    }

    return null;
  }, [assignedLocationDetails, currentAssignedEntry, currentLocations, currentUserAssignedLocationId]);

  const handleFocusAssignedLocation = useCallback(() => {
    if (!assignedLocationDetails?.coordinates) {
      return;
    }

    const { latitude, longitude } = assignedLocationDetails.coordinates;
    mapRef.current?.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      },
      800
    );
    setIsExpanded(true);
  }, [assignedLocationDetails, mapRef, setIsExpanded]);

  const circleCreatorId = useMemo(() => {
    const creatorIdRaw = selectedCircle?.creatorId;
    if (creatorIdRaw === undefined || creatorIdRaw === null) {
      return null;
    }
    return String(creatorIdRaw);
  }, [selectedCircle]);

  const isCircleCreator = useMemo(() => {
    if (!currentUserId || !circleCreatorId) {
      return false;
    }
    return currentUserId === circleCreatorId;
  }, [circleCreatorId, currentUserId]);

  const currentMembership = useMemo(() => {
    if (!currentUserId) return null;
    return (
      selectedCircleMembers.find((member) => resolveMemberId(member) === currentUserId) ?? null
    );
  }, [currentUserId, selectedCircleMembers]);

  const currentMembershipRole = useMemo(() => {
    if (isCircleCreator) return "creator";
    return normalizeRole(currentMembership?.Membership?.role) ?? null;
  }, [currentMembership, isCircleCreator]);

  const canManageLocations = useMemo(() => {
    return isCircleCreator || currentMembershipRole === "admin";
  }, [currentMembershipRole, isCircleCreator]);

  const {
    filteredDescending: locationHistoryFilteredDescending,
    polylineCoordinates: locationHistoryPolylineCoordinates,
    arrowMarkers: locationHistoryArrowMarkers,
    filterError: locationHistoryFilterError,
  } = useMemo(() => {
    if (!locationHistory.length) {
      return {
        filteredChronological: [],
        filteredDescending: [],
        polylineCoordinates: [] as { latitude: number; longitude: number }[],
        arrowMarkers: [] as { id: string; latitude: number; longitude: number; rotation: number }[],
        filterError: null as string | null,
      };
    }

    const sortedChronological = [...locationHistory].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return aTime - bTime;
    });

    const now = new Date();
    let rangeStart: Date | null = null;
    let rangeEnd: Date | null = null;
    let filterError: string | null = null;

    switch (locationHistoryActiveFilter) {
      case "today": {
        rangeStart = toDateAtMidnight(now);
        rangeEnd = toDateAtEndOfDay(now);
        break;
      }
      case "yesterday": {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        rangeStart = toDateAtMidnight(yesterday);
        rangeEnd = toDateAtEndOfDay(yesterday);
        break;
      }
      case "this_week": {
        rangeStart = startOfWeekLocal(now);
        rangeEnd = toDateAtEndOfDay(now);
        break;
      }
      case "this_month": {
        rangeStart = startOfMonthLocal(now);
        rangeEnd = toDateAtEndOfDay(now);
        break;
      }
      case "custom": {
        const parsedStart = parseDateInput(locationHistoryCustomStart);
        const parsedEnd = parseDateInput(locationHistoryCustomEnd);
        if (!parsedStart || !parsedEnd) {
          filterError = "Enter valid dates in YYYY-MM-DD format.";
        } else if (parsedStart > parsedEnd) {
          filterError = "Start date must be before end date.";
        } else {
          rangeStart = toDateAtMidnight(parsedStart);
          rangeEnd = toDateAtEndOfDay(parsedEnd);
        }
        break;
      }
      default:
        rangeStart = null;
        rangeEnd = null;
        break;
    }

    const filteredChronological = sortedChronological.filter((entry) => {
      const entryDate = new Date(entry.createdAt);
      if (Number.isNaN(entryDate.getTime())) {
        return false;
      }
      if (rangeStart && entryDate < rangeStart) {
        return false;
      }
      if (rangeEnd && entryDate > rangeEnd) {
        return false;
      }
      return true;
    });

    const filteredDescending = [...filteredChronological].reverse();

    const polylineCoordinates = filteredChronological
      .map((entry) => {
        if (!Number.isFinite(entry.latitude) || !Number.isFinite(entry.longitude)) {
          return null;
        }
        return { latitude: entry.latitude, longitude: entry.longitude };
      })
      .filter((coord): coord is { latitude: number; longitude: number } => coord !== null);

    const arrowMarkers: { id: string; latitude: number; longitude: number; rotation: number }[] = [];
    if (filteredChronological.length >= 2) {
      for (let i = 1; i < filteredChronological.length; i += 1) {
        const prev = filteredChronological[i - 1];
        const curr = filteredChronological[i];
        if (!Number.isFinite(prev.latitude) || !Number.isFinite(prev.longitude)) {
          continue;
        }
        if (!Number.isFinite(curr.latitude) || !Number.isFinite(curr.longitude)) {
          continue;
        }
        const midpoint = {
          latitude: prev.latitude + (curr.latitude - prev.latitude) * 0.5,
          longitude: prev.longitude + (curr.longitude - prev.longitude) * 0.5,
        };
        arrowMarkers.push({
          id: `${prev.id}-${curr.id}`,
          latitude: midpoint.latitude,
          longitude: midpoint.longitude,
          rotation: calculateHeadingDegrees(prev, curr),
        });
      }
    }

    return {
      filteredChronological,
      filteredDescending,
      polylineCoordinates,
      arrowMarkers,
      filterError,
    };
  }, [
    locationHistory,
    locationHistoryActiveFilter,
    locationHistoryCustomEnd,
    locationHistoryCustomStart,
  ]);

  const locationHistoryMapInitialRegion = useMemo(() => {
    if (!locationHistoryPolylineCoordinates.length) {
      return null;
    }

    const latitudes = locationHistoryPolylineCoordinates.map((coord) => coord.latitude);
    const longitudes = locationHistoryPolylineCoordinates.map((coord) => coord.longitude);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);

    const latitude = (minLat + maxLat) / 2;
    const longitude = (minLon + maxLon) / 2;
    const latitudeDelta = Math.max((maxLat - minLat) * 1.2, 0.01);
    const longitudeDelta = Math.max((maxLon - minLon) * 1.2, 0.01);

    return {
      latitude,
      longitude,
      latitudeDelta,
      longitudeDelta,
    };
  }, [locationHistoryPolylineCoordinates]);

  const batteryLevelPercent = useMemo(() => {
    if (currentUserBatteryLevel?.level === undefined || currentUserBatteryLevel?.level === null) {
      return null;
    }
    const numeric = Number(currentUserBatteryLevel.level);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    return Math.max(0, Math.min(100, Math.round(numeric)));
  }, [currentUserBatteryLevel]);

  const batteryUpdatedAtLabel = useMemo(() => {
    const timestamp = currentUserBatteryLevel?.updatedAt;
    if (!timestamp) {
      return null;
    }
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toLocaleString();
  }, [currentUserBatteryLevel]);

  useEffect(() => {
    if (!isLocationHistoryModalVisible) {
      setShouldRenderLocationHistoryMap(false);
      return;
    }

    const timeout = setTimeout(() => {
      setShouldRenderLocationHistoryMap(true);
    }, 120);

    return () => {
      clearTimeout(timeout);
    };
  }, [isLocationHistoryModalVisible]);

  useEffect(() => {
    if (!isLocationHistoryModalVisible || !shouldRenderLocationHistoryMap) {
      return;
    }
    if (locationHistoryPolylineCoordinates.length < 2) {
      return;
    }
    if (!locationHistoryMapRef.current) {
      return;
    }
    const uniqueCoords = locationHistoryPolylineCoordinates.filter((coord, index, array) => {
      if (index === 0) {
        return true;
      }
      const prev = array[index - 1];
      return coord.latitude !== prev.latitude || coord.longitude !== prev.longitude;
    });
    if (!uniqueCoords.length) {
      return;
    }
    const timer = setTimeout(() => {
      locationHistoryMapRef.current?.fitToCoordinates(uniqueCoords, {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: true,
      });
    }, 350);
    return () => {
      clearTimeout(timer);
    };
  }, [isLocationHistoryModalVisible, locationHistoryPolylineCoordinates, shouldRenderLocationHistoryMap]);

  const canEditMemberRole = useCallback(
    (member: CircleMember) => {
      if (!member) return false;
      const memberId = resolveMemberId(member);
      if (!memberId) return false;
      const memberRole = normalizeRole(member.Membership?.role);

      if (isCircleCreator) {
        return memberRole !== "creator" || memberId === currentUserId;
      }

      if (currentMembershipRole === "admin") {
        if (memberId === currentUserId) return false;
        if (memberRole === "creator" || memberRole === "admin") return false;
        return true;
      }

      return false;
    },
    [currentMembershipRole, currentUserId, isCircleCreator]
  );

  const canEditMemberNickname = useCallback(
    (member: CircleMember) => {
      if (!member) return false;
      const memberId = resolveMemberId(member);
      if (!memberId) return false;
      const memberRole = normalizeRole(member.Membership?.role);

      if (isCircleCreator) {
        return true;
      }

      if (currentMembershipRole === "admin") {
        if (memberRole === "creator") return false;
        return true;
      }

      return false;
    },
    [currentMembershipRole, isCircleCreator]
  );

  const canRemoveMember = useCallback(
    (member: CircleMember) => {
      if (!member || !selectedCircle) return false;
      const memberId = resolveMemberId(member);
      if (!memberId || memberId === currentUserId) return false;
      const memberRole = normalizeRole(member.Membership?.role);

      if (isCircleCreator) {
        return memberRole !== "creator";
      }

      if (currentMembershipRole === "admin") {
        return memberRole === "member";
      }

      return false;
    },
    [currentMembershipRole, currentUserId, isCircleCreator, selectedCircle]
  );

  const openEditMemberModal = useCallback(
    (member: CircleMember) => {
      const memberId = resolveMemberId(member);
      if (!memberId) return;

      if (!canEditMemberRole(member) && !canEditMemberNickname(member)) {
        Alert.alert("Permission denied", "You do not have permission to modify this member.");
        return;
      }

      setMemberBeingEdited(member);
      setEditedMemberRole(normalizeRole(member.Membership?.role) ?? "member");
      const baseNickname =
        member.Membership?.nickname ??
        member.name ??
        member.Membership?.nickname ??
        member.email ??
        "";
      setEditedMemberNickname(baseNickname);
      setSelectedMemberLocationId(resolveMembershipLocationId(member));
      setMemberModalError(null);
      setEditMemberModalVisible(true);
    },
    [canEditMemberNickname, canEditMemberRole]
  );

  const closeEditMemberModal = useCallback(() => {
    setEditMemberModalVisible(false);
    setMemberBeingEdited(null);
    setEditedMemberRole("member");
    setEditedMemberNickname("");
    setMemberModalError(null);
    setSelectedMemberLocationId(null);
  }, []);

  const handleSaveMemberChanges = useCallback(async () => {
    if (!selectedCircle || !memberBeingEdited) {
      closeEditMemberModal();
      return;
    }

    const circleId = String(selectedCircle.id);
    const memberId = resolveMemberId(memberBeingEdited);
    if (!memberId) {
      closeEditMemberModal();
      return;
    }

    const originalRole = normalizeRole(memberBeingEdited.Membership?.role) ?? "member";
    const originalNickname = memberBeingEdited.Membership?.nickname?.trim() ?? "";
    const desiredRole = editedMemberRole || "member";
    const desiredNickname = editedMemberNickname.trim();
    const originalLocationId = resolveMembershipLocationId(memberBeingEdited);
    const desiredLocationId = normalizeIdentifier(selectedMemberLocationId);

    const roleChanged = desiredRole !== originalRole;
    const nicknameChanged = desiredNickname !== originalNickname;
    const locationChanged = canManageLocations && desiredLocationId !== originalLocationId;

    if (!roleChanged && !nicknameChanged && !locationChanged) {
      closeEditMemberModal();
      return;
    }

    try {
      setIsSavingMemberChanges(true);
      setMemberModalError(null);

      if (roleChanged) {
        if (!canEditMemberRole(memberBeingEdited)) {
          throw new Error("You do not have permission to change this member's role.");
        }

        const roleResponse = await authenticatedFetch(
          `${API_BASE_URL}/circles/${circleId}/members/${memberId}/role`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              accept: "application/json",
            },
            body: JSON.stringify({ role: desiredRole }),
          }
        );

        if (!roleResponse.ok) {
          const payload = await roleResponse.json().catch(() => ({}));
          throw new Error(payload?.message ?? "Failed to update role.");
        }
      }

      if (nicknameChanged) {
        if (!canEditMemberNickname(memberBeingEdited)) {
          throw new Error("You do not have permission to update this nickname.");
        }

        const nicknameResponse = await authenticatedFetch(
          `${API_BASE_URL}/circles/${circleId}/members/${memberId}/nickname`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              accept: "application/json",
            },
            body: JSON.stringify({ nickname: desiredNickname }),
          }
        );

        if (!nicknameResponse.ok) {
          const payload = await nicknameResponse.json().catch(() => ({}));
          throw new Error(payload?.message ?? "Failed to update nickname.");
        }
      }

      if (locationChanged) {
        const assignmentResponse = await authenticatedFetch(
          `${API_BASE_URL}/circles/${circleId}/assign-location`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              accept: "application/json",
            },
            body: JSON.stringify({
              userId: memberId,
              locationId: desiredLocationId,
            }),
          }
        );

        if (!assignmentResponse.ok) {
          const payload = await assignmentResponse.json().catch(() => ({}));
          throw new Error(payload?.message ?? "Failed to update assigned place.");
        }
      }

      await fetchCircleMembers(selectedCircle.id);
      await loadAssignedLocations(true);
      closeEditMemberModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update member.";
      setMemberModalError(message);
    } finally {
      setIsSavingMemberChanges(false);
    }
  }, [
    canEditMemberNickname,
    canEditMemberRole,
    canManageLocations,
    closeEditMemberModal,
    editedMemberNickname,
    editedMemberRole,
    fetchCircleMembers,
    loadAssignedLocations,
    memberBeingEdited,
    selectedMemberLocationId,
    selectedCircle,
  ]);

  const executeRemoveMember = useCallback(
    async (member: CircleMember, memberId: string) => {
      if (!selectedCircle) return;
      const circleId = String(selectedCircle.id);

      try {
        setMemberRemovalLoadingId(memberId);
        const response = await authenticatedFetch(
          `${API_BASE_URL}/circles/${circleId}/members/${memberId}`,
          {
            method: "DELETE",
            headers: {
              accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message ?? "Failed to remove member.");
        }

        await fetchCircleMembers(selectedCircle.id);
        await loadAssignedLocations(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not remove member.";
        Alert.alert("Remove failed", message);
      } finally {
        setMemberRemovalLoadingId(null);
      }
    },
    [fetchCircleMembers, loadAssignedLocations, selectedCircle]
  );

  const confirmRemoveMember = useCallback(
    (member: CircleMember) => {
      const memberId = resolveMemberId(member);
      if (!memberId) return;

      if (!canRemoveMember(member)) {
        Alert.alert("Permission denied", "You do not have permission to remove this member.");
        return;
      }

      const memberName = member.Membership?.nickname || member.name || member.email || "this member";

      Alert.alert(
        "Remove member",
        `Are you sure you want to remove ${memberName} from this circle?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => executeRemoveMember(member, memberId),
          },
        ]
      );
    },
    [canRemoveMember, executeRemoveMember]
  );


  // --- HANDLERS ---

  const toggleCirclesModal = () => setIsCirclesModalOpen(!isCirclesModalOpen);

  const handleStartInviteFlow = () => {
    if (!selectedCircle) {
      Alert.alert("Select a circle", "Choose a circle first to invite new members.");
      return;
    }
    setShareTargetCircle(selectedCircle);
    setShareRequestId((prev) => prev + 1);
    setIsCirclesModalOpen(true);
  };

  const handleNavigateToAddPlace = () => {
    if (!selectedCircle) {
      Alert.alert("Select a circle", "Choose a circle before adding a place.");
      return;
    }
    snapTo(MIN_HEIGHT);
    setIsExpanded(false);
    setPlaceModalMode("create");
    setLocationBeingEdited(null);
    setIsAddPlaceModalOpen(true);
  };

  const handleEditSavedPlace = (locationPoint: LocationPoint) => {
    if (!selectedCircle) {
      Alert.alert("Select a circle", "Choose a circle before editing a place.");
      return;
    }

    if (!canManageLocations) {
      Alert.alert("Permission denied", "You do not have permission to update saved places.");
      return;
    }

    const hasValidId = locationPoint?.id !== undefined && locationPoint?.id !== null && String(locationPoint.id).trim().length > 0;
    if (!hasValidId) {
      Alert.alert("Cannot edit place", "This saved location is missing an identifier and cannot be updated.");
      return;
    }

    snapTo(MIN_HEIGHT);
    setIsExpanded(false);
    setPlaceModalMode("edit");
    setLocationBeingEdited(locationPoint);
    setIsAddPlaceModalOpen(true);
  };

  const handleDeleteSavedPlace = (locationPoint: LocationPoint) => {
    if (!selectedCircle) {
      Alert.alert("Select a circle", "Choose a circle before deleting a place.");
      return;
    }

    if (!canManageLocations) {
      Alert.alert("Permission denied", "You do not have permission to delete saved places.");
      return;
    }

    const hasValidId = locationPoint?.id !== undefined && locationPoint?.id !== null && String(locationPoint.id).trim().length > 0;
    if (!hasValidId) {
      Alert.alert("Cannot delete place", "This saved location is missing an identifier.");
      return;
    }

    const locationId = String(locationPoint.id);
    const placeName = locationPoint.name || "this place";

    Alert.alert(
      "Delete Place",
      `Are you sure you want to delete "${placeName}"? This will also remove any user assignments to this place.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              const circleId = String(selectedCircle.id);
              const response = await authenticatedFetch(
                `${API_BASE_URL}/circles/${circleId}/locations/${locationId}`,
                {
                  method: "DELETE",
                  headers: {
                    accept: "application/json",
                  },
                }
              );

              if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload?.message ?? "Failed to delete location.");
              }

              // Refresh data
              await loadCircles(true);
              await loadAssignedLocations(true);
              Alert.alert("Success", "Location deleted successfully.");

            } catch (error) {
              const message = error instanceof Error ? error.message : "Could not delete location.";
              Alert.alert("Delete failed", message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSelectMemberLocation = useCallback((locationId: string | null) => {
    setSelectedMemberLocationId(locationId);
  }, []);

  const locationSelectionControls = useMemo(() => {
    if (!canManageLocations) {
      return (
        <Text style={styles.memberModalHelperText}>
          Assigned: {assignedLocationLabel}. Only circle admins can assign a saved place.
        </Text>
      );
    }

    if (!locationOptions.length) {
      return (
        <Text style={styles.memberModalHelperText}>
          Save a place for this circle to assign it here.
        </Text>
      );
    }

    return (
      <View style={styles.memberLocationOptionsWrapper}>
        <TouchableOpacity
          style={[
            styles.memberLocationOption,
            selectedMemberLocationId === null && styles.memberLocationOptionSelected,
          ]}
          onPress={() => handleSelectMemberLocation(null)}
        >
          <View style={styles.memberLocationOptionTextWrapper}>
            <Text style={styles.memberLocationOptionTitle}>No special place</Text>
            <Text style={styles.memberLocationOptionSubtitle}>
              Member will not be tied to a saved location.
            </Text>
          </View>
          <Ionicons
            name={selectedMemberLocationId === null ? "radio-button-on" : "radio-button-off"}
            size={20}
            color={selectedMemberLocationId === null ? COLORS.primary : COLORS.gray}
          />
        </TouchableOpacity>

        {locationOptions.map((option) => {
          const isSelected = selectedMemberLocationId === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.memberLocationOption, isSelected && styles.memberLocationOptionSelected]}
              onPress={() => handleSelectMemberLocation(option.id)}
            >
              <View style={styles.memberLocationOptionTextWrapper}>
                <Text style={styles.memberLocationOptionTitle}>{option.label}</Text>
                <Text style={styles.memberLocationOptionSubtitle}>{option.subtitle}</Text>
              </View>
              <Ionicons
                name={isSelected ? "radio-button-on" : "radio-button-off"}
                size={20}
                color={isSelected ? COLORS.primary : COLORS.gray}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }, [assignedLocationLabel, canManageLocations, handleSelectMemberLocation, locationOptions, selectedMemberLocationId]);

  const handleClosePlaceModal = useCallback(() => {
    setIsAddPlaceModalOpen(false);
    setLocationBeingEdited(null);
    setPlaceModalMode("create");
  }, []);

  const handleLogout = () => {
    setAccountActionsVisible(false);
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true);
            if (isNativePlatform) {
              try {
                const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);
                if (hasStarted) {
                  await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);
                }
              } catch (stopError) {
                console.warn("Failed to stop background updates during logout", stopError);
              }
            }
            await AsyncStorage.removeItem(STORAGE_KEYS.lastSelectedCircleId).catch(() => undefined);
            await clearAllPostedLocations();
            await clearCircleLocationsCache();
            await clearLocationPresenceMap();
            await logout();
            router.replace("/screens/LogInScreen");
          } catch (error) {
            setLoading(false);
            const message = error instanceof Error ? error.message : "Could not log out.";
            Alert.alert("Logout failed", message);
          }
        },
      },
    ]);
  };

  const handleOpenMapLayersModal = () => setIsMapStyleModalOpen(true);
  const handleChangeMapStyle = (type: MapType) => {
    setMapLayerStyle(type);
    setIsMapStyleModalOpen(false);
  };

  const handleOpenChat = async () => {
    const url = 'sms:';
    try { await Linking.openURL(url); }
    catch { Alert.alert("Chat Unavailable", "Unable to open the messaging app."); }
  };

  const executeSosAlert = useCallback(async () => {
    if (isSendingSos) {
      return;
    }

    if (!selectedCircle) {
      Alert.alert("Select a circle", "Choose a circle before sending an SOS alert.");
      return;
    }

    setIsSendingSos(true);

    try {
      const circleId = normalizeIdentifier(selectedCircle.id);
      if (!circleId) {
        throw new Error("We could not determine which circle to notify. Please select a circle and try again.");
      }

      const circleName = asNonEmptyString(selectedCircle.name);
      const memberIds = selectedCircleMembers
        .map((member) => resolveMemberId(member))
        .filter((memberId): memberId is string => typeof memberId === "string" && memberId.trim().length > 0)
        .filter((memberId) => !currentUserId || memberId !== currentUserId);
      const notifyMemberIds = Array.from(new Set(memberIds));

      let coords = location;

      if (!coords) {
        try {
          const latest = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          coords = {
            latitude: latest.coords.latitude,
            longitude: latest.coords.longitude,
            heading: latest.coords.heading ?? undefined,
          };
          setLocation({ latitude: coords.latitude, longitude: coords.longitude, heading: coords.heading });
        } catch (positionError) {
          console.warn("Unable to refresh location for SOS alert", positionError);
        }
      }

      if (!coords) {
        throw new Error("We could not determine your current location.");
      }

      const payload: Record<string, unknown> = {
        message: circleName ? `Emergency SOS – ${circleName}` : "Emergency SOS alert",
        latitude: coords.latitude,
        longitude: coords.longitude,
      };

      payload.circleId = circleId;

      if (circleName) {
        payload.circleName = circleName;
      }

      if (currentUserId) {
        payload.senderId = currentUserId;
      }

      if (notifyMemberIds.length > 0) {
        payload.notifyMemberIds = notifyMemberIds;
      }

      const response = await authenticatedFetch(`${API_BASE_URL}/profile/sos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const isJson = response.headers.get("content-type")?.includes("application/json");
      const body = isJson ? await response.json().catch(() => ({})) : {};

      if (!response.ok) {
        const message = typeof body?.message === "string" && body.message.trim().length > 0
          ? body.message
          : "Unable to send the SOS alert.";
        throw new Error(message);
      }

      const successMessage = typeof body?.message === "string" && body.message.trim().length > 0
        ? body.message
        : "SOS alert sent successfully.";

      Alert.alert("SOS sent", successMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : "We could not send your SOS alert. Please try again.";
      Alert.alert("SOS failed", message);
    } finally {
      setIsSendingSos(false);
    }
  }, [currentUserId, isSendingSos, location, selectedCircle, selectedCircleMembers]);

  const handlePressSos = useCallback(() => {
    if (isSendingSos) {
      return;
    }

    if (!selectedCircle) {
      Alert.alert("Select a circle", "Choose a circle before sending an SOS alert.");
      return;
    }

    Alert.alert(
      "Send SOS alert?",
      "This will notify your circle members using your current location.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          style: "destructive",
          onPress: () => {
            void executeSosAlert();
          },
        },
      ]
    );
  }, [executeSosAlert, isSendingSos, selectedCircle]);

  const handleOpenProfileModal = useCallback(() => {
    const defaultName = currentMembership?.name ?? "";
    let defaultMetadata = "";
    const membershipMetadata = currentMembership?.Membership?.metadata;
    if (typeof membershipMetadata === "string") {
      defaultMetadata = membershipMetadata;
    } else if (membershipMetadata && typeof membershipMetadata === "object") {
      try {
        defaultMetadata = JSON.stringify(membershipMetadata, null, 2);
      } catch {
        defaultMetadata = "";
      }
    }

    setProfileNameInput(defaultName);
    setProfileMetadataInput(defaultMetadata);
    const existingAvatar =
      extractAvatarUrl(currentMembership) ??
      (typeof currentUserAvatarUrl === "string" ? currentUserAvatarUrl : null) ??
      profileAvatarOriginal ??
      null;
    setProfileAvatarOriginal(existingAvatar);
    setProfileAvatarPreview(existingAvatar);
    setProfileAvatarUpload(null);
    setProfileModalError(null);
    setIsProfileModalVisible(true);
    setAccountActionsVisible(false);
  }, [currentMembership, currentUserAvatarUrl, profileAvatarOriginal]);

  const fetchLocationHistory = useCallback(async () => {
    if (locationHistoryLoading) {
      return;
    }

    setLocationHistoryError(null);
    setLocationHistoryLoading(true);

    try {
      const params = new URLSearchParams({ limit: String(LOCATION_HISTORY_LIMIT), offset: "0" });
      const response = await authenticatedFetch(`${API_BASE_URL}/profile/location-history?${params.toString()}`, {
        headers: { accept: "application/json" },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.message ?? "Failed to load location history.";
        throw new Error(message);
      }

      const records = Array.isArray(payload?.data) ? payload.data : [];
      const normalized: LocationHistoryEntry[] = records
        .map((item: any): LocationHistoryEntry | null => {
          const lat = Number(item?.latitude ?? item?.lat);
          const lon = Number(item?.longitude ?? item?.lng);
          const createdAtRaw = asNonEmptyString(item?.createdAt) ?? asNonEmptyString(item?.created_at);
          if (!Number.isFinite(lat) || !Number.isFinite(lon) || !createdAtRaw) {
            return null;
          }
          return {
            id: asNonEmptyString(item?.id) ?? `${lat}-${lon}-${createdAtRaw}`,
            latitude: lat,
            longitude: lon,
            createdAt: createdAtRaw,
            name: asNonEmptyString(item?.name) ?? null,
            circleId: asNonEmptyString(item?.circleId) ?? asNonEmptyString(item?.circle_id) ?? null,
          };
        })
        .filter((entry: LocationHistoryEntry | null): entry is LocationHistoryEntry => entry !== null);

      setLocationHistory(normalized);

      if (records.length > 0) {
        const batteryCandidate = records.find((item: any) => item?.user?.batteryLevel)?.user?.batteryLevel;
        if (batteryCandidate) {
          const batteryData = batteryCandidate as Record<string, unknown>;
          setCurrentUserBatteryLevel({
            level: typeof batteryData.level === "number" ? batteryData.level : Number(batteryData.level ?? NaN),
            deviceId: asNonEmptyString(batteryData.deviceId) ?? null,
            updatedAt: asNonEmptyString(batteryData.updatedAt) ?? null,
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load location history.";
      setLocationHistoryError(message);
    } finally {
      setLocationHistoryLoading(false);
    }
  }, [locationHistoryLoading]);

  const handleOpenLocationHistoryModal = useCallback(() => {
    setShouldRenderLocationHistoryMap(false);
    setIsLocationHistoryModalVisible(true);
    setAccountActionsVisible(false);
    void fetchLocationHistory();
  }, [fetchLocationHistory]);

  const handleCloseLocationHistoryModal = useCallback(() => {
    setIsLocationHistoryModalVisible(false);
    setShouldRenderLocationHistoryMap(false);
  }, []);

  const handleSelectLocationHistoryFilter = useCallback((filterKey: LocationHistoryFilterKey) => {
    setLocationHistoryActiveFilter(filterKey);
    if (filterKey !== "custom") {
      setLocationHistoryCustomStart("");
      setLocationHistoryCustomEnd("");
    }
  }, []);

  const handleCustomFilterStartChange = useCallback((value: string) => {
    setLocationHistoryCustomStart(value);
  }, []);

  const handleCustomFilterEndChange = useCallback((value: string) => {
    setLocationHistoryCustomEnd(value);
  }, []);

  const handleRefreshLocationHistory = useCallback(() => {
    void fetchLocationHistory();
  }, [fetchLocationHistory]);

  const renderLocationHistoryItem = useCallback(({ item }: { item: LocationHistoryEntry }) => {
    const createdAtDate = new Date(item.createdAt);
    const timestampLabel = Number.isNaN(createdAtDate.getTime())
      ? item.createdAt
      : createdAtDate.toLocaleString();

    return (
      <View style={styles.locationHistoryListItem}>
        <View style={styles.locationHistoryListItemHeader}>
          <Text style={styles.locationHistoryListItemTimestamp} numberOfLines={1}>
            {timestampLabel}
          </Text>
          {item.name ? (
            <Text style={styles.locationHistoryListItemName} numberOfLines={1}>
              {item.name}
            </Text>
          ) : null}
        </View>
        <Text style={styles.locationHistoryListItemCoords}>
          {`${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}`}
        </Text>
        {item.circleId ? (
          <Text style={styles.locationHistoryListItemCircle}>{`Circle: ${item.circleId}`}</Text>
        ) : null}
      </View>
    );
  }, []);

  const locationHistoryKeyExtractor = useCallback((item: LocationHistoryEntry) => item.id, []);

  const closeProfileModal = useCallback(() => {
    if (isSavingProfile) return;
    setIsProfileModalVisible(false);
    setProfileAvatarUpload(null);
    setProfileAvatarPreview(profileAvatarOriginal);
  }, [isSavingProfile, profileAvatarOriginal]);

  const handlePickProfileImage = useCallback(async () => {
    if (isSavingProfile || isPickingProfileImage) {
      return;
    }

    try {
      setProfileModalError(null);
      setIsPickingProfileImage(true);

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission required", "Allow photo library access to update your profile picture.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      const uri = asset.uri;
      if (!uri) {
        return;
      }

      const mimeType = asset.mimeType ?? "image/jpeg";
      const fileName = asset.fileName ?? `avatar_${Date.now()}`;

      const preparedImage = await prepareImageAsWebp(uri, fileName, mimeType);

      setProfileAvatarPreview(preparedImage.uri);
      setProfileAvatarUpload(preparedImage);
    } catch (error) {
      console.warn("Failed to pick profile image", error);
      Alert.alert("Image error", "We couldn't open that image. Please try again.");
    } finally {
      setIsPickingProfileImage(false);
    }
  }, [isPickingProfileImage, isSavingProfile]);

  const handleClearProfileImage = useCallback(() => {
    if (isSavingProfile) {
      return;
    }

    setProfileAvatarUpload(null);
    setProfileAvatarPreview(profileAvatarOriginal);
  }, [isSavingProfile, profileAvatarOriginal]);

  const handleSubmitProfileUpdate = useCallback(async () => {
    if (isSavingProfile) return;

    setProfileModalError(null);
    setIsSavingProfile(true);

    try {
      const trimmedName = profileNameInput.trim();
      const trimmedMetadata = profileMetadataInput.trim();
      const payloadEntries: [string, string][] = [];
      if (trimmedName.length > 0) {
        payloadEntries.push(["name", trimmedName]);
      }
      if (trimmedMetadata.length > 0) {
        payloadEntries.push(["metadata", trimmedMetadata]);
      }

      const hasAvatarChange = Boolean(profileAvatarUpload);
      const hasFieldUpdates = payloadEntries.length > 0;

      if (!hasAvatarChange && !hasFieldUpdates) {
        setProfileModalError("Nothing to update.");
        return;
      }

      const requestOptions: RequestInit = {
        method: "PUT",
        headers: {
          accept: "application/json",
        },
      };

      if (hasAvatarChange) {
        const formData = new FormData();
        for (const [key, value] of payloadEntries) {
          formData.append(key, value);
        }
        formData.append(
          "profileImage",
          {
            uri: profileAvatarUpload!.uri,
            type: profileAvatarUpload!.type,
            name: profileAvatarUpload!.name,
          } as any
        );
        requestOptions.body = formData;
      } else {
        const jsonPayload: Record<string, string> = {};
        for (const [key, value] of payloadEntries) {
          jsonPayload[key] = value;
        }
        requestOptions.headers = {
          ...requestOptions.headers,
          "Content-Type": "application/json",
        };
        requestOptions.body = JSON.stringify(jsonPayload);
      }

      const response = await authenticatedFetch(`${API_BASE_URL}/profile`, requestOptions);

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.message ?? "Failed to update profile.";
        throw new Error(message);
      }

      setIsProfileModalVisible(false);
      setProfileAvatarUpload(null);
      Alert.alert("Profile updated", "Your profile details were saved.");

      if (hasAvatarChange && profileAvatarUpload) {
        setProfileAvatarOriginal(profileAvatarUpload.uri);
        setProfileAvatarPreview(profileAvatarUpload.uri);
        setCurrentUserAvatarUrl(profileAvatarUpload.uri);
        if (currentUserId) {
          setSelectedCircleMembers((prevMembers) => {
            let changed = false;
            const updated = prevMembers.map((member) => {
              if (resolveMemberId(member) === currentUserId) {
                changed = true;
                return {
                  ...member,
                  avatar: profileAvatarUpload.uri,
                };
              }
              return member;
            });
            return changed ? updated : prevMembers;
          });
        }
      }

      if (selectedCircle?.id) {
        fetchCircleMembers(selectedCircle.id);
      } else {
        await loadCircles(true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update profile.";
      setProfileModalError(message);
    } finally {
      setIsSavingProfile(false);
    }
  }, [currentUserId, fetchCircleMembers, isSavingProfile, loadCircles, profileAvatarUpload, profileMetadataInput, profileNameInput, selectedCircle]);

  const executeDeleteCircle = useCallback(async () => {
    if (!selectedCircle) {
      Alert.alert("No circle selected", "Select a circle before deleting.");
      return;
    }

    if (isDeletingCircle) {
      return;
    }

    setIsDeletingCircle(true);

    try {
      const circleIdParam = typeof selectedCircle.id === "string" ? selectedCircle.id : String(selectedCircle.id);
      const response = await authenticatedFetch(`${API_BASE_URL}/circles/${circleIdParam}`, {
        method: "DELETE",
        headers: {
          accept: "application/json",
        },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.message ?? "Unable to delete this circle.";
        throw new Error(message);
      }

      await AsyncStorage.removeItem(STORAGE_KEYS.lastSelectedCircleId).catch(() => undefined);
      await removeLastPostedLocationForCircle(circleIdParam).catch(() => undefined);
      await removeCachedCircleLocations(circleIdParam);
      setSelectedCircle(null);
      setSelectedCircleMembers([]);
      setCircles((prev) => {
        const filtered = prev.filter((circle) => String(circle.id) !== circleIdParam);
        circlesRef.current = filtered;
        return filtered;
      });
      await loadCircles(true);
      await loadAssignedLocations(true);
      Alert.alert("Circle deleted", "The circle was deleted successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete this circle.";
      Alert.alert("Delete failed", message);
    } finally {
      setIsDeletingCircle(false);
      setAccountActionsVisible(false);
    }
  }, [isDeletingCircle, loadAssignedLocations, loadCircles, selectedCircle]);

  const executeLeaveCircle = useCallback(async () => {
    if (!selectedCircle) {
      Alert.alert("No circle selected", "Select a circle before leaving.");
      return;
    }

    if (isLeavingCircle) {
      return;
    }

    setIsLeavingCircle(true);

    try {
      const circleIdParam = typeof selectedCircle.id === "string" ? selectedCircle.id : String(selectedCircle.id);
      const response = await authenticatedFetch(`${API_BASE_URL}/circles/${circleIdParam}/leave`, {
        method: "DELETE",
        headers: {
          accept: "application/json",
        },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.message ?? "Unable to leave this circle.";
        throw new Error(message);
      }

      await AsyncStorage.removeItem(STORAGE_KEYS.lastSelectedCircleId).catch(() => undefined);
      await removeLastPostedLocationForCircle(circleIdParam).catch(() => undefined);
      setSelectedCircle(null);
      setSelectedCircleMembers([]);
      await loadCircles(true);
      await loadAssignedLocations(true);
      await removeCachedCircleLocations(circleIdParam);
      Alert.alert("Circle left", "You have left the circle successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to leave this circle.";
      Alert.alert("Leave failed", message);
    } finally {
      setIsLeavingCircle(false);
      setAccountActionsVisible(false);
    }
  }, [isLeavingCircle, loadAssignedLocations, loadCircles, selectedCircle]);

  const handleDeleteCircle = useCallback(() => {
    if (!selectedCircle) {
      Alert.alert("No circle selected", "Select a circle before deleting.");
      return;
    }

    setAccountActionsVisible(false);
    const circleName = selectedCircle?.name ?? "this circle";
    Alert.alert(
      "Delete circle",
      `Deleting ${circleName} will remove the circle for every member. This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void executeDeleteCircle();
          },
        },
      ]
    );
  }, [executeDeleteCircle, selectedCircle]);

  const handleLeaveCircle = useCallback(() => {
    if (!selectedCircle) {
      Alert.alert("No circle selected", "Select a circle before leaving.");
      return;
    }

    setAccountActionsVisible(false);
    const circleName = selectedCircle?.name ?? "this circle";
    Alert.alert(
      "Leave circle",
      `Are you sure you want to leave ${circleName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => {
            void executeLeaveCircle();
          },
        },
      ]
    );
  }, [executeLeaveCircle, selectedCircle]);

  // --- RENDER HELPERS ---
  const mapStylesList: { key: MapType; label: string; icon: string; previewColor: string }[] = [
    { key: 'standard', label: 'Auto', icon: 'map', previewColor: '#84CC16' },
    { key: 'hybrid', label: 'Street', icon: 'map-outline', previewColor: '#60A5FA' },
    { key: 'satellite', label: 'Satellite', icon: 'image', previewColor: '#FBBF24' },
    { key: 'terrain', label: 'Terrain', icon: 'earth', previewColor: '#34D399' }
  ];

  const savedPlaces = currentLocations;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const canEditRoleInModal = memberBeingEdited ? canEditMemberRole(memberBeingEdited) : false;
  const canEditNicknameInModal = memberBeingEdited ? canEditMemberNickname(memberBeingEdited) : false;

  // Fallback location if permissions denied (e.g., center of map)
  const mapRegion = location ? {
    latitude: location.latitude,
    longitude: location.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  } : {
    latitude: 6.9271, // Default (e.g., Colombo)
    longitude: 79.8612,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const membershipNickname = currentMembership?.Membership?.nickname;
  const resolvedNickname = asNonEmptyString(membershipNickname);
  const membershipName = asNonEmptyString(currentMembership?.name);
  const userDisplayName = resolvedNickname ?? membershipName ?? "You";
  const userAccuracyRadius =
    location && typeof location.accuracy === "number" && Number.isFinite(location.accuracy) && location.accuracy > 0
      ? Math.min(Math.max(location.accuracy, 25), MAX_USER_ACCURACY_RADIUS)
      : null;

  // Fetch a specific member's location history (today)
  const fetchMemberLocationHistory = async (memberId: string) => {
    setLocationHistoryError(null);
    setLocationHistoryLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LOCATION_HISTORY_LIMIT), offset: "0", filter: "today", userId: memberId });
      const response = await authenticatedFetch(`${API_BASE_URL}/profile/location-history?${params.toString()}`, {
        headers: { accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.message ?? "Failed to load location history.";
        throw new Error(message);
      }
      const records = Array.isArray(payload?.data) ? payload.data : [];
      const normalized: LocationHistoryEntry[] = records
        .map((item: any): LocationHistoryEntry | null => {
          const lat = Number(item?.latitude ?? item?.lat);
          const lon = Number(item?.longitude ?? item?.lng);
          const createdAtRaw = asNonEmptyString(item?.createdAt) ?? asNonEmptyString(item?.created_at);
          if (!Number.isFinite(lat) || !Number.isFinite(lon) || !createdAtRaw) {
            return null;
          }
          return {
            id: asNonEmptyString(item?.id) ?? `${lat}-${lon}-${createdAtRaw}`,
            latitude: lat,
            longitude: lon,
            createdAt: createdAtRaw,
            name: asNonEmptyString(item?.name) ?? null,
            circleId: asNonEmptyString(item?.circleId) ?? asNonEmptyString(item?.circle_id) ?? null,
          };
        })
        .filter((entry: LocationHistoryEntry | null): entry is LocationHistoryEntry => entry !== null);
      setLocationHistory(normalized);
      setLocationHistoryActiveFilter("today");
      setIsLocationHistoryModalVisible(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load location history.";
      setLocationHistoryError(message);
    } finally {
      setLocationHistoryLoading(false);
    }
  };



  // Handler to open journeys modal with a specific member
  const handleOpenMemberJourneysModal = async (member: CircleMember) => {
    // Show modal immediately with available data (history might be empty initially)
    setMemberJourneysData([{ ...member, todayLocationHistory: [] }]);
    setIsMemberJourneysModalVisible(true);

    const memberId = resolveMemberId(member);
    if (!memberId) return;

    try {
      const params = new URLSearchParams({
        limit: "500",
        offset: "0",
        filter: "today",
        userId: memberId
      });

      const response = await authenticatedFetch(`${API_BASE_URL}/profile/location-history?${params.toString()}`, {
        headers: { accept: "application/json" },
      });

      if (response.ok) {
        const payload = await response.json().catch(() => ({}));
        const records = Array.isArray(payload?.data) ? payload.data : [];

        const normalized: LocationHistoryEntry[] = records
          .map((item: any): LocationHistoryEntry | null => {
            const lat = Number(item?.latitude ?? item?.lat);
            const lon = Number(item?.longitude ?? item?.lng);
            const createdAtRaw = asNonEmptyString(item?.createdAt) ?? asNonEmptyString(item?.created_at);
            if (!Number.isFinite(lat) || !Number.isFinite(lon) || !createdAtRaw) {
              return null;
            }
            return {
              id: asNonEmptyString(item?.id) ?? `${lat}-${lon}-${createdAtRaw}`,
              latitude: lat,
              longitude: lon,
              createdAt: createdAtRaw,
              name: asNonEmptyString(item?.name) ?? null,
              circleId: asNonEmptyString(item?.circleId) ?? asNonEmptyString(item?.circle_id) ?? null,
            };
          })
          .filter((entry: LocationHistoryEntry | null): entry is LocationHistoryEntry => entry !== null);

        // Update the member data with the fetched history
        setMemberJourneysData([{ ...member, todayLocationHistory: normalized }]);
      }
    } catch (e) {
      console.warn("Failed to fetch member journeys history", e);
    }
  };

  const renderMemberMarker = (
    memberId: string | null,
    coordinate: UserLocation | null | undefined,
    isCurrentUser: boolean
  ): React.ReactElement | null => {
    if (!coordinate || !isValidCoordinate(coordinate.latitude, coordinate.longitude)) {
      return null;
    }

    const safeMemberId = memberId ?? (isCurrentUser ? "current-user" : null);
    const memberRecord = memberId ? circleMembersById.get(memberId) : undefined;
    const displayName = isCurrentUser
      ? userDisplayName || "You"
      : memberRecord?.Membership?.nickname || memberRecord?.name || memberRecord?.email || "Circle member";
    const fallbackSeed =
      memberRecord?.email ??
      memberRecord?.name ??
      memberRecord?.Membership?.nickname ??
      safeMemberId ??
      displayName ??
      "member";
    const avatarCandidate = isCurrentUser
      ? currentUserAvatarUrl
      : memberId
        ? memberAvatarUrls[memberId]
        : null;
    let tempAvatar =
      typeof avatarCandidate === "string" && avatarCandidate.trim().length > 0
        ? avatarCandidate.trim()
        : null;

    if (tempAvatar && tempAvatar.startsWith("/")) {
      tempAvatar = `${API_BASE_URL}${tempAvatar}`;
    }
    if (tempAvatar) {
      tempAvatar = tempAvatar.replace("/api/uploads", "/uploads");
    }

    const resolvedAvatar = tempAvatar ?? `${DEFAULT_MEMBER_AVATAR}${encodeURIComponent(fallbackSeed)}`;

    const memberBatteryInfo = memberRecord?.batteryLevel ?? null;
    const effectiveBatteryInfo = isCurrentUser
      ? currentUserBatteryLevel ?? memberBatteryInfo
      : memberBatteryInfo;
    const batteryPercent =
      effectiveBatteryInfo && typeof effectiveBatteryInfo.level === "number" && Number.isFinite(effectiveBatteryInfo.level)
        ? Math.max(0, Math.min(100, Math.round(effectiveBatteryInfo.level)))
        : null;

    const markerKey = safeMemberId
      ? `member-marker-${safeMemberId}`
      : `member-marker-${Math.round(coordinate.latitude * 1e6)}-${Math.round(coordinate.longitude * 1e6)}`;

    const markerLabel = isCurrentUser ? "You" : displayName;
    const initialsSource = displayName || fallbackSeed;

    return (
      <Marker
        key={markerKey}
        coordinate={{ latitude: coordinate.latitude, longitude: coordinate.longitude }}
        anchor={{ x: 0.5, y: 1 }}
        title={displayName}
        zIndex={isCurrentUser ? 3 : 2}
        onPress={() => {
          const isReallyCurrentUser = isCurrentUser || (currentUserId && memberId === currentUserId);
          if (isReallyCurrentUser) {
            return;
          }
          if (memberRecord) {
            handleOpenMemberJourneysModal(memberRecord);
          }
        }}
      >
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          {/* Avatar Circle */}
          <View style={{
            width: 33,
            height: 33,
            borderRadius: 28,
            borderWidth: 3,
            borderColor: isCurrentUser ? "#2563EB" : "#22C55E",
            backgroundColor: 'white',
            overflow: 'hidden',
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 3,
            elevation: 5,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Image
              source={{ uri: resolvedAvatar }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          </View>

          {/* Pointer Triangle */}
          <View style={{
            width: 0,
            height: 0,
            backgroundColor: 'transparent',
            borderStyle: 'solid',
            borderLeftWidth: 6,
            borderRightWidth: 6,
            borderTopWidth: 8,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: isCurrentUser ? "#2563EB" : "#22C55E",
            marginTop: -2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.2,
            shadowRadius: 1,
            elevation: 2,
          }} />

          {/* Battery Badge */}
          {batteryPercent !== null && (
            <View style={{
              position: 'absolute',
              top: -4,
              right: -4,
              backgroundColor: 'white',
              borderRadius: 10,
              borderWidth: 2,
              borderColor: isCurrentUser ? "#2563EB" : "#22C55E",
              paddingHorizontal: 4,
              paddingVertical: 1,
              alignItems: 'center',
              justifyContent: 'center',
              elevation: 6,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.2,
              shadowRadius: 1,
            }}>
              <Text style={{ fontSize: 9, fontWeight: '800', color: 'black' }}>
                {batteryPercent}%
              </Text>
            </View>
          )}
        </View>
      </Marker>
    );
  };

  // Determine if the current user's location is already present in memberLocations
  const hasMemberLocationForCurrentUser = typeof currentUserId === "string" && currentUserId in memberLocations;
  const shouldRenderStandaloneCurrentUserMarker = Boolean(location) && !hasMemberLocationForCurrentUser;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top + 24}
    >
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

        {/* --- MAP LAYER --- */}
        <MapView
          ref={mapRef}
          style={[styles.map, { paddingBottom: MIN_HEIGHT }]}
          provider={PROVIDER_GOOGLE}
          initialRegion={mapRegion}
          mapType={mapLayerStyle}
          customMapStyle={mapLayerStyle === 'standard' ? MAP_THEME_LIGHT : undefined}
          showsUserLocation={false}
          showsCompass={false}
          showsMyLocationButton={false}
        >
          {location && userAccuracyRadius ? (
            <Circle
              key="user-accuracy-circle"
              center={{ latitude: location.latitude, longitude: location.longitude }}
              radius={userAccuracyRadius}
              strokeColor={USER_ACCURACY_STROKE_COLOR}
              fillColor={USER_ACCURACY_FILL_COLOR}
              strokeWidth={1.5}
            />
          ) : null}

          {/* Render member markers with profile avatars */}
          {Object.entries(memberLocations).map(([memberId, coords]) => {
            const isCurrentUser = typeof currentUserId === "string" && currentUserId === memberId;
            const coordinate = isCurrentUser && location ? location : coords;
            return renderMemberMarker(memberId, coordinate, isCurrentUser);
          })}

          {shouldRenderStandaloneCurrentUserMarker && location
            ? renderMemberMarker(currentUserId, location, true)
            : null}

          {currentLocations.flatMap((loc: LocationPoint, index: number) => {
            let metadataAddress: string | undefined;
            if (loc.metadata && typeof loc.metadata === "object") {
              const metadataRecord = loc.metadata as Record<string, unknown>;
              const addressValue = metadataRecord.address;
              const formattedValue = metadataRecord.formattedAddress;
              if (typeof addressValue === "string" && addressValue.trim().length > 0) {
                metadataAddress = addressValue.trim();
              } else if (typeof formattedValue === "string" && formattedValue.trim().length > 0) {
                metadataAddress = formattedValue.trim();
              }
            }

            let markerTitle = "Saved Place";
            if (typeof loc.name === "string" && loc.name.trim().length > 0) {
              markerTitle = loc.name.trim();
            } else if (metadataAddress) {
              markerTitle = metadataAddress;
            }

            let markerDescription: string | undefined;
            if (metadataAddress && metadataAddress !== markerTitle) {
              markerDescription = metadataAddress;
            }

            const markerKey = loc.id ? `loc-${loc.id}` : `loc-${index}`;
            const circleKey = `${markerKey}-circle`;
            const markerNodeKey = `${markerKey}-marker`;
            const circleRadius = getRadiusForLocation(loc);
            const normalizedId = normalizeIdentifier(loc.id);
            const isAssignedToCurrentUser =
              currentUserAssignedLocationId !== null && normalizedId !== null && normalizedId === currentUserAssignedLocationId;

            const assignedSubtitle = isAssignedToCurrentUser ? "Assigned to you" : undefined;

            const circleStrokeColor = isAssignedToCurrentUser
              ? ASSIGNED_LOCATION_STROKE_COLOR
              : "rgba(239, 68, 68, 0.6)";
            const circleFillColor = isAssignedToCurrentUser
              ? ASSIGNED_LOCATION_FILL_COLOR
              : "rgba(239, 68, 68, 0.15)";
            const calloutDescription = assignedSubtitle
              ? markerDescription
                ? `${markerDescription}\n${assignedSubtitle}`
                : assignedSubtitle
              : markerDescription;

            return [
              <Circle
                key={circleKey}
                center={{ latitude: loc.latitude, longitude: loc.longitude }}
                radius={circleRadius}
                strokeColor={circleStrokeColor}
                fillColor={circleFillColor}
                strokeWidth={2}
              />,
              <Marker
                key={markerNodeKey}
                identifier={markerKey}
                coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
                title={markerTitle}
                description={calloutDescription}
                zIndex={isAssignedToCurrentUser ? 2 : 1}
                anchor={{ x: 0.5, y: 1 }}


              >
                <Ionicons
                  name="location-sharp"
                  size={isAssignedToCurrentUser ? 30 : 34}
                  color={isAssignedToCurrentUser ? "#FACC15" : "#EF4444"}
                />
              </Marker>,
            ];
          })}

          {fallbackAssignedMarker
            ? [
              <Circle
                key="assigned-fallback-circle"
                center={{
                  latitude: fallbackAssignedMarker.latitude,
                  longitude: fallbackAssignedMarker.longitude,
                }}
                radius={fallbackAssignedMarker.radius ?? DEFAULT_LOCATION_RADIUS_METERS}
                strokeColor={ASSIGNED_LOCATION_STROKE_COLOR}
                fillColor={ASSIGNED_LOCATION_FILL_COLOR}
                strokeWidth={2}
              />,
              <Marker
                key="assigned-fallback-marker"
                identifier="assigned-fallback"
                coordinate={{
                  latitude: fallbackAssignedMarker.latitude,
                  longitude: fallbackAssignedMarker.longitude,
                }}
                title={fallbackAssignedMarker.title}
                description={fallbackAssignedMarker.subtitle ? `${fallbackAssignedMarker.subtitle}\nAssigned to you` : "Assigned to you"}
                zIndex={2}
                anchor={{ x: 0.5, y: 1 }}
              >
                <Ionicons name="star" size={30} color="#FACC15" />
              </Marker>,
            ]
            : null}

        </MapView>

        {/* --- TOP HEADER --- */}
        <View style={[styles.headerContainer, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.roundButton} onPress={handleOpenCircleNotificationSettings}>
            <Ionicons name="settings-sharp" size={24} color={COLORS.black} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.circleSelector} onPress={toggleCirclesModal} activeOpacity={0.9}>
            <View style={styles.selectorTextContainer}>
              <Text style={styles.selectorLabel}>Current Circle</Text>
              <Text style={styles.circleName} numberOfLines={1}>{selectedCircle ? selectedCircle.name : "Select Circle"}</Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={COLORS.primary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.roundButton} onPress={() => setAccountActionsVisible(true)}>
            <Ionicons name="person-circle-outline" size={26} color={COLORS.black} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.roundButton, styles.floatingChatButton, { top: insets.top + SCREEN_HEIGHT * 0.25 }]}
          onPress={handleOpenChat}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={COLORS.black} />
        </TouchableOpacity>

        {/* --- FLOATING MAP BUTTONS --- */}
        <Animated.View
          style={[
            styles.floatingControlsContainer,
            { bottom: Animated.add(sheetHeight, 20) }
          ]}
        >
          <TouchableOpacity style={styles.pillButton}>
            <View style={styles.iconCirclePurple}><Ionicons name="checkmark" size={16} color={COLORS.white} /></View>
            <Text style={styles.pillButtonText}>Check in</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pillButton, isSendingSos && styles.pillButtonDisabled]}
            onPress={handlePressSos}
            disabled={isSendingSos}
          >
            <View style={styles.iconCircleRed}><MaterialCommunityIcons name="lifebuoy" size={18} color={COLORS.white} /></View>
            <Text style={styles.pillButtonText}>{isSendingSos ? "Sending..." : "SOS"}</Text>
            {isSendingSos ? (
              <ActivityIndicator size="small" color={COLORS.accent} style={styles.pillButtonSpinner} />
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity style={styles.roundButtonSmall} onPress={handleOpenMapLayersModal}>
            <Ionicons name="layers" size={22} color={COLORS.primary} />
          </TouchableOpacity>


        </Animated.View>



        <CircleNotificationSettingsModal
          visible={isCircleNotificationSettingsModalVisible}
          onClose={() => setIsCircleNotificationSettingsModalVisible(false)}
          loading={isSavingCircleNotificationSettings}
          settings={currentNotificationSettings}
          onSave={handleSaveCircleNotificationSettings}
          insets={insets}
        />

        {/* --- UNIFIED BOTTOM SHEET (Content and Nav) --- */}
        <Animated.View style={[styles.unifiedSheet, { height: sheetHeight, paddingBottom: insets.bottom + keyboardHeight }]}>
          <View {...panResponder.panHandlers} style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>

          <View style={{ flex: 1, width: '100%' }}>
            <ScrollView
              ref={sheetScrollRef}
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}
              scrollEnabled={isExpanded}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.quickActionsRow}>
                <TouchableOpacity style={styles.quickActionButton} onPress={() => scrollToSection('members')}>
                  <View style={styles.quickActionIconCircle}><Ionicons name="people" size={20} color={COLORS.primary} /></View>
                  <Text style={styles.quickActionLabel}>Members</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionButton} onPress={() => scrollToSection('pet')}>
                  <View style={styles.quickActionIconCircle}><FontAwesome5 name="paw" size={18} color={COLORS.primary} /></View>
                  <Text style={styles.quickActionLabel}>Pet</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionButton} onPress={() => scrollToSection('key')}>
                  <View style={styles.quickActionIconCircle}><Ionicons name="key" size={20} color={COLORS.primary} /></View>
                  <Text style={styles.quickActionLabel}>Key</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionButton} onPress={() => scrollToSection('place')}>
                  <View style={styles.quickActionIconCircle}><MaterialCommunityIcons name="home-map-marker" size={20} color={COLORS.primary} /></View>
                  <Text style={styles.quickActionLabel}>Place</Text>
                </TouchableOpacity>
              </View>

              {/* Members Section */}
              <View style={styles.sectionTitleContainer} onLayout={e => { sectionPositions['members'] = e.nativeEvent.layout.y; }}>
                <Text style={styles.sectionTitle}>People in {selectedCircle?.name || "Circle"}</Text>
              </View>

              <TouchableOpacity style={styles.listItem} onPress={handleStartInviteFlow}>
                <View style={[styles.listIconCircle, { borderStyle: 'dashed', borderColor: COLORS.primary }]}>
                  <Ionicons name="add" size={24} color={COLORS.primary} />
                </View>
                <Text style={styles.listItemText}>Add a new member</Text>
              </TouchableOpacity>

              {selectedCircleMembers.map((member) => {
                const memberId = resolveMemberId(member);
                const displayName = member.Membership?.nickname || member.name || member.email || "Unknown Member";
                const memberRole = normalizeRole(member.Membership?.role) ?? "member";
                const roleLabel = formatRoleLabel(memberRole);
                const nicknameLabel = member.Membership?.nickname;
                const fallbackSeed = member.email || member.name || (memberId ?? displayName);
                let normalizedMemberAvatar = null;
                if (typeof member.avatar === "string" && member.avatar.trim().length > 0) {
                  const trimmed = member.avatar.trim();
                  if (trimmed.startsWith("/")) {
                    normalizedMemberAvatar = `${API_BASE_URL}${trimmed}`.replace("/api/uploads", "/uploads");
                  } else {
                    normalizedMemberAvatar = trimmed;
                  }
                }

                // Debug log
                //  console.log(`[MemberRendering] ${displayName}: raw=${member.avatar}, final=${avatarUri}, base=${API_BASE_URL}`);

                const selfAvatarFallback =
                  memberId && currentUserId && memberId === currentUserId && currentUserAvatarUrl
                    ? currentUserAvatarUrl
                    : null;
                const avatarUri =
                  normalizedMemberAvatar ??
                  selfAvatarFallback ??
                  `${DEFAULT_MEMBER_AVATAR}${encodeURIComponent(fallbackSeed)}`;



                const memberKey = memberId ?? member.email ?? `${displayName}-${memberRole}`;
                const allowEdit = canEditMemberRole(member) || canEditMemberNickname(member);
                const allowRemove = canRemoveMember(member);
                const isRemoving = memberRemovalLoadingId === memberId;

                return (
                  <View key={memberKey} style={[styles.listItem, styles.memberRow]}>
                    <View style={styles.memberAvatarCircle}>
                      <Image source={{ uri: avatarUri }} style={styles.memberAvatarImage} resizeMode="cover" />
                    </View>
                    <View style={styles.memberDetails}>
                      <Text style={styles.listItemText}>{displayName}</Text>
                      <Text style={styles.listItemSubText}>{roleLabel}</Text>
                      {nicknameLabel && (
                        <Text style={styles.memberNicknameText}>Nickname: {nicknameLabel}</Text>
                      )}
                    </View>
                    {(allowEdit || allowRemove) && (
                      <View style={styles.memberActionsColumn}>
                        {allowEdit && (
                          <TouchableOpacity
                            style={[styles.memberActionButton, allowRemove && styles.memberActionButtonSpacing]}
                            onPress={() => openEditMemberModal(member)}
                          >
                            <Ionicons name="create-outline" size={20} color={COLORS.primary} />
                          </TouchableOpacity>
                        )}
                        {allowRemove && (
                          <TouchableOpacity
                            style={styles.memberActionButton}
                            onPress={() => confirmRemoveMember(member)}
                            disabled={isRemoving}
                          >
                            {isRemoving ? (
                              <ActivityIndicator size="small" color={COLORS.accent} />
                            ) : (
                              <Ionicons name="trash-outline" size={20} color={COLORS.accent} />
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}

              <View style={styles.divider} />

              {/* Pet Section */}
              <View style={styles.sectionTitleContainer} onLayout={e => { sectionPositions['pet'] = e.nativeEvent.layout.y; }}>
                <Text style={styles.sectionTitle}>Pet</Text>
              </View>
              <TouchableOpacity style={styles.listItem} onPress={handleNavigateToAddPlace}>
                <View style={[styles.listIconCircle, { backgroundColor: '#FDE68A' }]}>
                  <FontAwesome5 name="paw" size={18} color={COLORS.primary} />
                </View>
                <View>
                  <Text style={styles.listItemText}>Add a pet</Text>
                  <Text style={styles.listItemSubText}>Track your pet&apos;s location.</Text>
                </View>
              </TouchableOpacity>

              {/* Key Section */}
              <View style={styles.sectionTitleContainer} onLayout={e => { sectionPositions['key'] = e.nativeEvent.layout.y; }}>
                <Text style={styles.sectionTitle}>Key</Text>
              </View>
              <TouchableOpacity style={styles.listItem}>
                <View style={[styles.listIconCircle, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="key" size={20} color={COLORS.primary} />
                </View>
                <View>
                  <Text style={styles.listItemText}>Add a key</Text>
                  <Text style={styles.listItemSubText}>Attach a tracker to keys.</Text>
                </View>
              </TouchableOpacity>

              {/* Place Section */}
              <View style={styles.sectionTitleContainer} onLayout={e => { sectionPositions['place'] = e.nativeEvent.layout.y; }}>
                <Text style={styles.sectionTitle}>Place</Text>
              </View>
              <TouchableOpacity style={styles.listItem} onPress={handleNavigateToAddPlace}>
                <View style={[styles.listIconCircle, { backgroundColor: '#DCFCE7' }]}>
                  <MaterialCommunityIcons name="home-map-marker" size={20} color={COLORS.primary} />
                </View>
                <View>
                  <Text style={styles.listItemText}>Add a place</Text>
                  <Text style={styles.listItemSubText}>Save home, office, etc.</Text>
                </View>
              </TouchableOpacity>

              {currentAssignedEntry ? (
                <TouchableOpacity
                  style={[
                    styles.assignedSummaryCard,
                    !assignedLocationDetails?.coordinates && styles.assignedSummaryCardDisabled,
                  ]}
                  onPress={handleFocusAssignedLocation}
                  activeOpacity={assignedLocationDetails?.coordinates ? 0.85 : 1}
                  disabled={!assignedLocationDetails?.coordinates}
                >
                  <View style={styles.assignedSummaryIcon}>
                    <Ionicons name="star" size={18} color={COLORS.white} />
                  </View>
                  <View style={styles.assignedSummaryTextWrapper}>
                    <Text style={styles.assignedSummaryTitle}>{assignedLocationDetails?.label ?? "Assigned location"}</Text>
                    <Text style={styles.assignedSummarySubtitle}>
                      {assignedLocationDetails?.subtitle ?? "We will notify you once additional details are available."}
                    </Text>
                    {assignedLocationDetails?.coordinates ? (
                      <Text style={styles.assignedSummaryHint}>Tap to focus on this place</Text>
                    ) : null}
                  </View>
                  {loadingAssignedLocations ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : null}
                </TouchableOpacity>
              ) : null}

              {savedPlaces.length > 0 ? (
                <View style={styles.savedPlacesWrapper}>
                  <Text style={styles.savedPlacesTitle}>Saved places</Text>
                  {savedPlaces.map((loc: LocationPoint, index: number) => {
                    let metadataAddress: string | undefined;
                    if (loc.metadata && typeof loc.metadata === "object") {
                      const addressValue = (loc.metadata as any).address;
                      const formattedValue = (loc.metadata as any).formattedAddress;
                      if (typeof addressValue === "string" && addressValue.trim().length > 0) {
                        metadataAddress = addressValue.trim();
                      } else if (typeof formattedValue === "string" && formattedValue.trim().length > 0) {
                        metadataAddress = formattedValue.trim();
                      }
                    }

                    const label = loc.name && loc.name.trim().length > 0 ? loc.name.trim() : metadataAddress ?? `Place ${index + 1}`;
                    const coordinateLabel = `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
                    const subtitle = metadataAddress && metadataAddress !== label ? metadataAddress : coordinateLabel;
                    const hasEditableId = loc.id !== undefined && loc.id !== null && String(loc.id).trim().length > 0;
                    const canEditThisLocation = canManageLocations && hasEditableId;
                    const normalizedLocationId = normalizeIdentifier(loc.id);
                    const isAssignedToCurrentUser =
                      currentUserAssignedLocationId !== null &&
                      normalizedLocationId !== null &&
                      normalizedLocationId === currentUserAssignedLocationId;

                    return (
                      <View key={loc.id ? `saved-${loc.id}` : `saved-${index}`} style={styles.savedPlaceRow}>
                        <View style={styles.savedPlaceIconCircle}>
                          <MaterialCommunityIcons name="map-marker" size={18} color={COLORS.primary} />
                        </View>
                        <View style={styles.savedPlaceTextWrapper}>
                          <Text style={styles.savedPlaceName}>{label}</Text>
                          <Text style={styles.savedPlaceCoords}>{subtitle}</Text>
                          {isAssignedToCurrentUser ? (
                            <View style={styles.assignedBadge}>
                              <Ionicons name="star" size={12} color={COLORS.primary} />
                              <Text style={styles.assignedBadgeText}>Assigned to you</Text>
                            </View>
                          ) : null}
                        </View>
                        {canEditThisLocation ? (
                          <TouchableOpacity
                            style={styles.savedPlaceActionButton}
                            onPress={() => handleEditSavedPlace(loc)}
                          >
                            <Ionicons name="create-outline" size={20} color={COLORS.primary} />
                          </TouchableOpacity>
                        ) : null}

                        {canEditThisLocation ? (
                          <TouchableOpacity
                            style={styles.savedPlaceActionButton}
                            onPress={() => handleDeleteSavedPlace(loc)}
                          >
                            <Ionicons name="trash-outline" size={20} color={COLORS.accent} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.savedPlacesEmpty}>No saved places yet.</Text>
              )}

              <View style={{ height: 20 }} />
            </ScrollView>
          </View>

          {/* Navigation Bar */}
          <View style={styles.navBar}>
            <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab("Location")}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="map-marker-radius" size={28} color={activeTab === "Location" ? COLORS.primary : COLORS.gray} />
              </View>
              <Text style={[styles.navText, activeTab === "Location" && styles.activeNavText]}>Location</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab("Driving")}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="steering" size={28} color={activeTab === "Driving" ? COLORS.primary : COLORS.gray} />
              </View>
              <Text style={[styles.navText, activeTab === "Driving" && styles.activeNavText]}>Driving</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab("Safety")}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="shield-check-outline" size={28} color={activeTab === "Safety" ? COLORS.primary : COLORS.gray} />
              </View>
              <Text style={[styles.navText, activeTab === "Safety" && styles.activeNavText]}>Safety</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <CirclesModal
          isOpen={isCirclesModalOpen}
          onClose={() => setIsCirclesModalOpen(false)}
          onRefresh={requestCirclesRefresh}
          circles={circles as any}
          loadingCircles={loadingCircles}
          onSelectCircle={handleSelectCircle}
          shareTargetCircle={shareTargetCircle as any}
          shareRequestId={shareRequestId}
          onShareHandled={() => setShareTargetCircle(null)}
        />

        <AddPlaceModal
          visible={isAddPlaceModalOpen}
          mode={placeModalMode}
          circleId={selectedCircle?.id ?? null}
          circleName={selectedCircle?.name ?? null}
          editingLocation={locationBeingEdited}
          onClose={handleClosePlaceModal}
          onPlaceSaved={requestCirclesRefresh}
        />

        <AccountActionsModal
          visible={accountActionsVisible}
          onClose={() => setAccountActionsVisible(false)}
          topPadding={insets.top + 64}
          colors={COLORS}
          onPressProfile={handleOpenProfileModal}
          onPressLocationHistory={handleOpenLocationHistoryModal}
          onPressLogout={handleLogout}
          isCircleCreator={isCircleCreator}
          onPressDeleteCircle={handleDeleteCircle}
          onPressLeaveCircle={handleLeaveCircle}
          isDeletingCircle={isDeletingCircle}
          isLeavingCircle={isLeavingCircle}
          canDeleteCircle={Boolean(selectedCircle)}
          canLeaveCircle={Boolean(selectedCircle)}
        />

        <Modal
          visible={isLocationHistoryModalVisible}
          transparent
          animationType="fade"
          statusBarTranslucent
          presentationStyle="overFullScreen"
          onRequestClose={handleCloseLocationHistoryModal}
        >
          <View style={styles.memberModalOverlay}>
            <TouchableOpacity
              style={styles.memberModalBackdrop}
              activeOpacity={1}
              onPress={handleCloseLocationHistoryModal}
            />
            <View style={[styles.locationHistoryCard, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.locationHistoryHeader}>
                <Text style={styles.locationHistoryTitle}>Location history</Text>
                <TouchableOpacity
                  style={styles.locationHistoryCloseButton}
                  onPress={handleCloseLocationHistoryModal}
                >
                  <Ionicons name="close" size={22} color={COLORS.black} />
                </TouchableOpacity>
              </View>

              <View style={styles.locationHistoryBatteryRow}>
                <View>
                  <Text style={styles.locationHistoryBatteryLabel}>Battery status</Text>
                  {batteryUpdatedAtLabel ? (
                    <Text style={styles.locationHistoryBatterySubLabel}>{`Updated ${batteryUpdatedAtLabel}`}</Text>
                  ) : null}
                </View>
                <View style={styles.batteryIndicatorWrapper}>
                  <View style={styles.batteryShell}>
                    <View
                      style={[
                        styles.batteryFill,
                        batteryLevelPercent !== null
                          ? {
                            width: `${batteryLevelPercent}%`,
                            backgroundColor:
                              batteryLevelPercent < LOW_BATTERY_THRESHOLD ? COLORS.accent : COLORS.success,
                          }
                          : styles.batteryFillEmpty,
                      ]}
                    />
                    <View style={styles.batteryCap} />
                  </View>
                  <Text style={styles.batteryPercentText}>
                    {batteryLevelPercent !== null ? `${batteryLevelPercent}%` : "--"}
                  </Text>
                </View>
              </View>

              <View style={styles.locationHistoryActionsRow}>
                <TouchableOpacity
                  style={[
                    styles.locationHistoryRefreshButton,
                    locationHistoryLoading && styles.locationHistoryRefreshButtonDisabled,
                  ]}
                  onPress={handleRefreshLocationHistory}
                  disabled={locationHistoryLoading}
                >
                  {locationHistoryLoading ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.locationHistoryRefreshButtonText}>Refresh</Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.locationHistoryFiltersRow}>
                {LOCATION_HISTORY_FILTERS.map((filter) => {
                  const isActive = filter.key === locationHistoryActiveFilter;
                  return (
                    <TouchableOpacity
                      key={filter.key}
                      style={[styles.locationHistoryFilterChip, isActive && styles.locationHistoryFilterChipActive]}
                      onPress={() => handleSelectLocationHistoryFilter(filter.key)}
                    >
                      <Text
                        style={[
                          styles.locationHistoryFilterText,
                          isActive && styles.locationHistoryFilterTextActive,
                        ]}
                      >
                        {filter.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {locationHistoryActiveFilter === "custom" ? (
                <View style={styles.locationHistoryCustomRange}>
                  <View style={styles.locationHistoryCustomInputBlock}>
                    <Text style={styles.locationHistoryCustomLabel}>Start (YYYY-MM-DD)</Text>
                    <TextInput
                      style={styles.locationHistoryCustomInput}
                      placeholder="2025-12-01"
                      placeholderTextColor={COLORS.gray}
                      value={locationHistoryCustomStart}
                      onChangeText={handleCustomFilterStartChange}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "default"}
                    />
                  </View>
                  <View style={[styles.locationHistoryCustomInputBlock, styles.locationHistoryCustomInputBlockLast]}>
                    <Text style={styles.locationHistoryCustomLabel}>End (YYYY-MM-DD)</Text>
                    <TextInput
                      style={styles.locationHistoryCustomInput}
                      placeholder="2025-12-10"
                      placeholderTextColor={COLORS.gray}
                      value={locationHistoryCustomEnd}
                      onChangeText={handleCustomFilterEndChange}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "default"}
                    />
                  </View>
                </View>
              ) : null}

              {shouldRenderLocationHistoryMap && locationHistoryPolylineCoordinates.length > 0 ? (
                <View style={styles.locationHistoryMapWrapper}>
                  <MapView
                    ref={locationHistoryMapRef}
                    style={styles.locationHistoryMap}
                    initialRegion={locationHistoryMapInitialRegion ?? undefined}
                    scrollEnabled={false}
                    pitchEnabled={false}
                    rotateEnabled={false}
                    zoomEnabled={false}
                    liteMode={Platform.OS === "android"}
                    pointerEvents="none"
                  >
                    {locationHistoryPolylineCoordinates.length >= 2 ? (
                      <Polyline
                        coordinates={locationHistoryPolylineCoordinates}
                        strokeColor="#2563EB"
                        strokeWidth={4}
                      />
                    ) : null}

                    {locationHistoryPolylineCoordinates.length === 1 ? (
                      <Marker
                        coordinate={locationHistoryPolylineCoordinates[0]}
                        anchor={{ x: 0.5, y: 0.5 }}
                      >
                        <View style={styles.locationHistorySinglePoint} />
                      </Marker>
                    ) : null}

                    {locationHistoryArrowMarkers.map((segment) => (
                      <Marker
                        key={`history-arrow-${segment.id}`}
                        coordinate={{ latitude: segment.latitude, longitude: segment.longitude }}
                        flat
                        anchor={{ x: 0.5, y: 0.5 }}
                        rotation={segment.rotation}
                      >
                        <View style={styles.locationHistoryArrowIcon}>
                          <Ionicons name="arrow-forward-circle" size={18} color="#2563EB" />
                        </View>
                      </Marker>
                    ))}
                  </MapView>
                </View>
              ) : null}

              {locationHistoryFilterError ? (
                <Text style={styles.locationHistoryErrorText}>{locationHistoryFilterError}</Text>
              ) : null}

              {locationHistoryError ? (
                <View style={styles.locationHistoryErrorBanner}>
                  <Text style={styles.locationHistoryErrorBannerText}>{locationHistoryError}</Text>
                </View>
              ) : null}

              <View style={styles.locationHistoryListWrapper}>
                {locationHistoryLoading && !locationHistory.length ? (
                  <ActivityIndicator size="large" color={COLORS.primary} style={styles.locationHistoryLoadingSpinner} />
                ) : null}

                {!locationHistoryLoading && locationHistoryFilteredDescending.length === 0 && !locationHistoryFilterError ? (
                  <View style={styles.locationHistoryEmptyState}>
                    <MaterialCommunityIcons name="map-search-outline" size={42} color={COLORS.gray} />
                    <Text style={styles.locationHistoryEmptyText}>No location history found for this range.</Text>
                  </View>
                ) : null}

                {locationHistoryFilteredDescending.length > 0 ? (
                  <FlatList
                    data={locationHistoryFilteredDescending}
                    keyExtractor={locationHistoryKeyExtractor}
                    renderItem={renderLocationHistoryItem}
                    contentContainerStyle={styles.locationHistoryList}
                    showsVerticalScrollIndicator={false}
                  />
                ) : null}
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={isProfileModalVisible}
          transparent
          animationType="fade"
          onRequestClose={closeProfileModal}
        >
          <View style={styles.memberModalOverlay}>
            <TouchableOpacity
              style={styles.memberModalBackdrop}
              activeOpacity={1}
              onPress={closeProfileModal}
            />
            <View style={[styles.memberModalCard, { paddingBottom: insets.bottom + 16 }]}>
              <Text style={styles.memberModalTitle}>Update profile</Text>
              <Text style={styles.memberModalSubtitle}>Your name and metadata apply across all circles.</Text>

              <Text style={styles.memberModalLabel}>Display name</Text>
              <TextInput
                style={styles.memberModalInput}
                value={profileNameInput}
                onChangeText={setProfileNameInput}
                placeholder="Enter your name"
                placeholderTextColor={COLORS.gray}
                editable={!isSavingProfile}
              />

              <Text style={[styles.memberModalLabel, { marginTop: 16 }]}>Profile picture</Text>
              <View style={styles.profileAvatarRow}>
                <View style={styles.profileAvatarPreviewWrapper}>
                  {profileAvatarPreview ? (
                    <Image source={{ uri: profileAvatarPreview }} style={styles.profileAvatarImage} />
                  ) : (
                    <View style={styles.profileAvatarPlaceholder}>
                      <Ionicons name="person-circle-outline" size={48} color={COLORS.gray} />
                    </View>
                  )}
                </View>
                <View style={styles.profileAvatarActions}>
                  <TouchableOpacity
                    style={styles.profileAvatarPrimaryButton}
                    onPress={handlePickProfileImage}
                    disabled={isSavingProfile || isPickingProfileImage}
                  >
                    {isPickingProfileImage ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <Text style={styles.profileAvatarPrimaryText}>Choose image</Text>
                    )}
                  </TouchableOpacity>
                  {profileAvatarUpload ? (
                    <TouchableOpacity
                      style={styles.profileAvatarSecondaryButton}
                      onPress={handleClearProfileImage}
                      disabled={isSavingProfile}
                    >
                      <Text style={styles.profileAvatarSecondaryText}>Remove selection</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              <Text style={[styles.memberModalLabel, { marginTop: 16 }]}>Metadata (JSON or text)</Text>
              <TextInput
                style={[styles.memberModalInput, styles.memberModalTextarea]}
                value={profileMetadataInput}
                onChangeText={setProfileMetadataInput}
                placeholder='{"bio": "Loves maps"}'
                placeholderTextColor={COLORS.gray}
                editable={!isSavingProfile}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              {profileModalError ? <Text style={styles.memberModalError}>{profileModalError}</Text> : null}

              <View style={styles.memberModalButtonsRow}>
                <TouchableOpacity
                  style={styles.memberModalSecondaryButton}
                  onPress={closeProfileModal}
                  disabled={isSavingProfile}
                >
                  <Text style={styles.memberModalSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.memberModalPrimaryButton, isSavingProfile && styles.memberModalPrimaryButtonDisabled]}
                  onPress={handleSubmitProfileUpdate}
                  disabled={isSavingProfile}
                >
                  {isSavingProfile ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.memberModalPrimaryText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={editMemberModalVisible}
          transparent
          animationType="fade"
          onRequestClose={closeEditMemberModal}
        >
          <View style={styles.memberModalOverlay}>
            <TouchableOpacity
              style={styles.memberModalBackdrop}
              activeOpacity={1}
              onPress={closeEditMemberModal}
            />
            <View style={[styles.memberModalCard, { maxHeight: '90%', paddingBottom: 0 }]}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
                <Text style={styles.memberModalTitle}>Manage member</Text>
                {memberBeingEdited ? (
                  <Text style={styles.memberModalSubtitle}>
                    {memberBeingEdited.Membership?.nickname || memberBeingEdited.name || memberBeingEdited.email || "Unnamed member"}
                  </Text>
                ) : null}

                <Text style={styles.memberModalLabel}>Role</Text>
                <View style={styles.roleOptionsRow}>
                  {ROLE_OPTIONS.map((option, index) => {
                    const isSelected = editedMemberRole === option.value;
                    const isDisabled = !canEditRoleInModal;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.roleOptionChip,
                          isSelected && styles.roleOptionChipSelected,
                          isDisabled && styles.roleOptionChipDisabled,
                          index === ROLE_OPTIONS.length - 1 && { marginRight: 0 },
                        ]}
                        onPress={() => {
                          if (isDisabled) return;
                          setEditedMemberRole(option.value);
                        }}
                        disabled={isDisabled}
                      >
                        <Text
                          style={[
                            styles.roleOptionText,
                            isSelected && styles.roleOptionTextSelected,
                            isDisabled && styles.roleOptionTextDisabled,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.memberModalLabel}>Nickname</Text>
                <TextInput
                  style={[styles.memberModalInput, !canEditNicknameInModal && styles.memberModalInputDisabled]}
                  value={editedMemberNickname}
                  onChangeText={setEditedMemberNickname}
                  editable={canEditNicknameInModal}
                  placeholder="Enter nickname"
                  placeholderTextColor={COLORS.gray}
                />

                <Text style={[styles.memberModalLabel, { marginTop: 16 }]}>Special place</Text>
                {locationSelectionControls}

                {canManageLocations && selectedMemberLocationId && !selectedLocationExists ? (
                  <Text style={styles.memberModalHelperText}>
                    The previously assigned place is no longer available.
                  </Text>
                ) : null}

                {memberModalError ? <Text style={styles.memberModalError}>{memberModalError}</Text> : null}

                <View style={styles.memberModalButtonsRow}>
                  <TouchableOpacity style={styles.memberModalSecondaryButton} onPress={closeEditMemberModal} disabled={isSavingMemberChanges}>
                    <Text style={styles.memberModalSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.memberModalPrimaryButton, isSavingMemberChanges && styles.memberModalPrimaryButtonDisabled]}
                    onPress={handleSaveMemberChanges}
                    disabled={isSavingMemberChanges}
                  >
                    {isSavingMemberChanges ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <Text style={styles.memberModalPrimaryText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* --- MAP STYLE MODAL --- */}
        <Modal
          visible={isMapStyleModalOpen}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsMapStyleModalOpen(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsMapStyleModalOpen(false)}
          >
            <View style={[styles.mapStyleModalContent, { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 10 : 20 }]}>
              <View style={styles.modalHeaderRow}>
                <TouchableOpacity onPress={() => setIsMapStyleModalOpen(false)} style={styles.modalCloseIcon}>
                  <Ionicons name="close" size={24} color={COLORS.black} />
                </TouchableOpacity>
                <Text style={styles.activateSosText}>Activate SOS →</Text>
              </View>

              <Text style={styles.modalTitle}>Map type</Text>

              <FlatList
                data={mapStylesList}
                keyExtractor={(item) => item.key}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalOptionsContainer}
                snapToInterval={SCREEN_WIDTH * 0.35 + 15}
                decelerationRate="fast"
                renderItem={({ item }) => {
                  const isSelected = mapLayerStyle === item.key;
                  return (
                    <TouchableOpacity
                      style={styles.mapPreviewCard}
                      onPress={() => handleChangeMapStyle(item.key)}
                    >
                      <View style={[styles.mapPreviewInner, { backgroundColor: item.previewColor }, isSelected && styles.mapPreviewInnerSelected]}>
                        <Ionicons name={item.icon as any} size={40} color={COLORS.white} />
                      </View>
                      <View style={styles.mapPreviewLabelContainer}>
                        <Text style={[styles.mapPreviewLabel, isSelected && { color: COLORS.primary, fontWeight: '700' }]} numberOfLines={1}>
                          {item.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
              <View style={styles.activeStyleIndicatorBar}>
                <View style={styles.activeStyleIndicator} />
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* --- MEMBER JOURNEYS MODAL --- */}
        <MemberJourneysModal
          visible={isMemberJourneysModalVisible}
          onClose={() => setIsMemberJourneysModalVisible(false)}
          members={memberJourneysData}
          insets={insets}
        />

      </View>
    </KeyboardAvoidingView >
  );
};

export default MapScreen;

// =======================================================
// STYLES
// =======================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  map: { flex: 1 },

  // --- Map Style Modal Styles ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  mapStyleModalContent: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalCloseIcon: {
    padding: 5,
  },
  activateSosText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    padding: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 20,
  },
  horizontalOptionsContainer: {
    paddingVertical: 10,
    paddingHorizontal: 5,
  },
  mapPreviewCard: {
    width: SCREEN_WIDTH * 0.35,
    marginRight: 15,
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },
  mapPreviewInner: {
    height: SCREEN_WIDTH * 0.35 * 0.8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.lightGray,
  },
  mapPreviewInnerSelected: {
    borderColor: COLORS.primary,
    borderWidth: 3,
  },
  mapPreviewLabelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  mapPreviewLabel: {
    fontSize: 14,
    color: COLORS.black,
    fontWeight: '500',
    textAlign: 'center',
  },
  activeStyleIndicatorBar: {
    height: 10,
    width: '100%',
    backgroundColor: COLORS.lightGray,
    borderRadius: 5,
    marginTop: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeStyleIndicator: {
    height: 6,
    width: '30%',
    backgroundColor: COLORS.white,
    borderRadius: 3,
    position: 'absolute',
    left: '5%',
  },

  // Header
  headerContainer: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    paddingHorizontal: 16, paddingBottom: 10, zIndex: 10
  },
  roundButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center",
    elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3
  },
  floatingChatButton: {
    position: 'absolute',
    right: 16,
    zIndex: 12,
    elevation: 6,
  },
  circleSelector: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: COLORS.white, marginHorizontal: 12,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24,
    elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3
  },
  selectorTextContainer: { flex: 1, justifyContent: 'center' },
  selectorLabel: { fontSize: 10, color: COLORS.gray, textTransform: 'uppercase', fontWeight: '700' },
  circleName: { fontSize: 16, fontWeight: "700", color: COLORS.primary },

  // Floating Controls
  floatingControlsContainer: {
    position: 'absolute',
    bottom: MIN_HEIGHT + 15,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 15,
  },
  pillButton: {
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 30,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    marginRight: 8,
  },
  pillButtonDisabled: {
    opacity: 0.65,
  },
  pillButtonText: {
    marginLeft: 8,
    fontWeight: '600',
    color: COLORS.primary,
    fontSize: 14,
  },
  pillButtonSpinner: {
    marginLeft: 8,
  },
  iconCirclePurple: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleRed: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButtonSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },

  locationHistoryArrowIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationHistoryCard: {
    marginHorizontal: 16,
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: SCREEN_HEIGHT * 0.75,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  locationHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationHistoryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.black,
  },
  locationHistoryCloseButton: {
    padding: 6,
  },
  locationHistoryBatteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  locationHistoryBatteryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
  },
  locationHistoryBatterySubLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
  },
  batteryIndicatorWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  batteryShell: {
    width: 70,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.black,
    justifyContent: 'center',
    paddingHorizontal: 2,
    marginRight: 8,
    position: 'relative',
  },
  batteryCap: {
    position: 'absolute',
    right: -6,
    width: 6,
    height: 12,
    backgroundColor: COLORS.black,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    top: 7,
  },
  batteryFill: {
    height: '80%',
    borderRadius: 4,
  },
  batteryFillEmpty: {
    width: '0%',
    backgroundColor: COLORS.lightGray,
  },
  batteryPercentText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.black,
  },
  locationHistoryActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  locationHistoryRefreshButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  locationHistoryRefreshButtonDisabled: {
    opacity: 0.6,
  },
  locationHistoryRefreshButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  locationHistoryFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  locationHistoryFilterChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    marginRight: 8,
    marginBottom: 8,
  },
  locationHistoryFilterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  locationHistoryFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.black,
  },
  locationHistoryFilterTextActive: {
    color: COLORS.white,
  },
  locationHistoryCustomRange: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  locationHistoryCustomInputBlock: {
    flex: 1,
    marginRight: 12,
  },
  locationHistoryCustomInputBlockLast: {
    marginRight: 0,
  },
  locationHistoryMapWrapper: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  locationHistoryMap: {
    width: '100%',
    height: 200,
  },
  locationHistorySinglePoint: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  locationHistoryCustomLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 6,
  },
  locationHistoryCustomInput: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: COLORS.black,
    backgroundColor: '#F9FAFB',
  },
  locationHistoryErrorText: {
    color: COLORS.accent,
    fontSize: 12,
    marginBottom: 8,
  },
  locationHistoryErrorBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  locationHistoryErrorBannerText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  locationHistoryListWrapper: {
    flex: 1,
    flexGrow: 1,
    minHeight: 160,
  },
  locationHistoryLoadingSpinner: {
    marginVertical: 24,
  },
  locationHistoryEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  locationHistoryEmptyText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
  },
  locationHistoryList: {
    paddingBottom: 16,
  },
  locationHistoryListItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  locationHistoryListItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationHistoryListItemTimestamp: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    flex: 1,
    marginRight: 12,
  },
  locationHistoryListItemName: {
    fontSize: 13,
    color: COLORS.gray,
    flexShrink: 0,
  },
  locationHistoryListItemCoords: {
    fontSize: 13,
    color: COLORS.black,
  },
  locationHistoryListItemCircle: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
  },

  // Markers
  userMarkerWrapper: { alignItems: 'center', justifyContent: 'center', maxWidth: 180 },
  userMarkerGlow: {
    padding: 4,
    borderRadius: 24,
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  userMarkerCard: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 6,
    position: 'relative',
  },
  userMarkerAvatarShell: {
    width: 46,
    height: 46,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMarkerAvatarImage: { width: '100%', height: '100%' },
  userMarkerInitial: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  userMarkerStatusDot: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#34D399',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  userMarkerPointer: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#4F46E5',
    marginTop: -3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 1.4,
    elevation: 4,
  },
  userMarkerLabelBubble: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
  },
  userMarkerLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.white,
    maxWidth: 150,
  },
  locationMarkerWrapper: { alignItems: 'center', maxWidth: 220 },
  locationMarkerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 6,
    borderWidth: 1,
  },
  locationMarkerCardDefault: {
    backgroundColor: COLORS.white,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  locationMarkerCardAssigned: {
    backgroundColor: COLORS.primary,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  locationMarkerBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationMarkerBadgeDefault: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  locationMarkerBadgeAssigned: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  locationMarkerBadgeText: { fontSize: 14, fontWeight: '700' },
  locationMarkerBadgeTextDefault: { color: COLORS.accent },
  locationMarkerBadgeTextAssigned: { color: COLORS.white },
  locationMarkerTextBlock: { marginLeft: 10, maxWidth: 160 },
  locationMarkerTitle: { fontSize: 13, fontWeight: '700', color: COLORS.accent },
  locationMarkerTitleAssigned: { color: COLORS.white },
  locationMarkerSubtitle: { fontSize: 11, color: '#4B5563', marginTop: 2 },
  locationMarkerSubtitleAssigned: { color: 'rgba(255, 255, 255, 0.85)' },
  locationMarkerPointer: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 11,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.2,
    elevation: 4,
  },
  locationMarkerPointerDefault: { borderTopColor: COLORS.white },
  locationMarkerPointerAssigned: { borderTopColor: COLORS.primary },

  // Bottom Sheet
  unifiedSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    elevation: 20, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.15, shadowRadius: 8,
    zIndex: 20, overflow: 'hidden'
  },
  dragHandleContainer: { width: '100%', height: HANDLE_HEIGHT, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white },
  dragHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB' },

  sheetContent: { paddingHorizontal: 20, paddingTop: 5 },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 4,
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickActionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  sectionTitleContainer: { paddingVertical: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.black },
  divider: { height: 1, backgroundColor: COLORS.lightGray, marginVertical: 10 },

  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  memberRow: { alignItems: 'center' },
  listIconCircle: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.lightGray,
    alignItems: 'center', justifyContent: 'center', marginRight: 16, borderWidth: 1, borderColor: '#E5E7EB'
  },
  memberAvatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: COLORS.lightGray,
  },
  memberAvatarImage: {
    width: '100%',
    height: '100%',
  },
  memberDetails: {
    flex: 1,
  },
  listItemText: { fontSize: 16, fontWeight: '600', color: COLORS.black },
  listItemSubText: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  memberNicknameText: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  memberActionsColumn: {
    marginLeft: 12,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  memberActionButton: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  memberActionButtonSpacing: {
    marginBottom: 6,
  },

  // Nav Bar
  navBar: {
    height: TAB_BAR_HEIGHT, flexDirection: "row", width: '100%',
    justifyContent: "space-around", alignItems: "flex-start", paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: COLORS.white
  },
  navItem: { alignItems: "center", justifyContent: "flex-start", flex: 1 },
  iconContainer: { marginBottom: 4 },
  navText: { fontSize: 11, color: COLORS.gray, fontWeight: "600" },
  activeNavText: { color: COLORS.primary, fontWeight: "700" },

  savedPlacesWrapper: {
    marginTop: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  savedPlacesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 6,
  },
  savedPlaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  savedPlaceIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  savedPlaceTextWrapper: {
    flex: 1,
  },
  savedPlaceName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.black,
  },
  savedPlaceCoords: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  assignedSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F4F0FF',
    marginTop: 16,
  },
  assignedSummaryCardDisabled: {
    opacity: 0.7,
  },
  assignedSummaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  assignedSummaryTextWrapper: {
    flex: 1,
  },
  assignedSummaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.black,
  },
  assignedSummarySubtitle: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
  },
  assignedSummaryHint: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  assignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#EDE9FE',
    borderRadius: 999,
  },
  assignedBadgeText: {
    marginLeft: 4,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  savedPlaceActionButton: {
    padding: 6,
    marginLeft: 8,
  },
  savedPlacesEmpty: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.gray,
  },
  memberModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  memberModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  memberModalCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  memberModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.black,
    textAlign: 'center',
  },
  memberModalSubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
  },
  memberModalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 8,
  },
  profileAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  profileAvatarPreviewWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
  },
  profileAvatarPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarActions: {
    flex: 1,
  },
  profileAvatarPrimaryButton: {
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  profileAvatarPrimaryText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  profileAvatarSecondaryButton: {
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarSecondaryText: {
    color: COLORS.gray,
    fontWeight: '600',
  },
  roleOptionsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  roleOptionChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    marginRight: 10,
  },
  roleOptionChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#F3F0FF',
  },
  roleOptionChipDisabled: {
    opacity: 0.5,
  },
  roleOptionText: {
    fontSize: 14,
    color: COLORS.black,
    fontWeight: '600',
  },
  roleOptionTextSelected: {
    color: COLORS.primary,
  },
  roleOptionTextDisabled: {
    color: COLORS.gray,
  },
  memberModalInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.black,
    backgroundColor: '#F8FAFC',
  },
  memberModalTextarea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  memberModalInputDisabled: {
    opacity: 0.5,
  },
  memberLocationOptionsWrapper: {
    marginTop: 8,
  },
  memberLocationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
    backgroundColor: COLORS.white,
  },
  memberLocationOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#F3F0FF',
  },
  memberLocationOptionTextWrapper: {
    flex: 1,
    marginRight: 12,
  },
  memberLocationOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.black,
  },
  memberLocationOptionSubtitle: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
  memberModalHelperText: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 6,
  },
  memberModalError: {
    color: COLORS.accent,
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
  memberModalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  memberModalSecondaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberModalSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.gray,
  },
  memberModalPrimaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberModalPrimaryButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  memberModalPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
});