import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import BackgroundService from 'react-native-background-actions';
import { API_BASE_URL, authenticatedFetch } from '../utils/auth';

const BACKGROUND_LOCATION_TASK = 'background-location-task';
const LOCATION_QUEUE_KEY = 'location-sync-queue';

// --- Type Definitions ---
interface LocationData {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    timestamp: number;
    speed: number | null;
}

// --- Queue Management ---

const getQueue = async (): Promise<LocationData[]> => {
    try {
        const raw = await AsyncStorage.getItem(LOCATION_QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (error) {
        console.error('Error reading location queue:', error);
        return [];
    }
};

const saveQueue = async (queue: LocationData[]) => {
    try {
        await AsyncStorage.setItem(LOCATION_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
        console.error('Error saving location queue:', error);
    }
};

const queueLocation = async (location: LocationData) => {
    const queue = await getQueue();
    queue.push(location);
    await saveQueue(queue);
};

// --- Sync Logic ---

export const syncLocationQueue = async () => {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
        console.log('Offline: Skipping sync.');
        return;
    }

    const queue = await getQueue();
    if (queue.length === 0) return;

    console.log(`Syncing ${queue.length} locations...`);

    const remainingQueue: LocationData[] = [];

    for (const loc of queue) {
        try {
            const circleId = await AsyncStorage.getItem("mapScreen:lastSelectedCircleId");

            if (!circleId) {
                console.warn("No circle ID found for background update. Dropping location.");
                continue;
            }

            const response = await authenticatedFetch(`${API_BASE_URL}/profile/circles/${circleId}/location`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    accept: "application/json",
                },
                body: JSON.stringify({
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    name: "Background Update",
                    metadata: {
                        accuracy: loc.accuracy,
                        speed: loc.speed,
                        timestamp: loc.timestamp,
                        is_offline_sync: true
                    }
                })
            });

            if (!response.ok) {
                console.warn("Failed to sync location:", await response.text());
                remainingQueue.push(loc);
            }
        } catch (error) {
            console.error("Sync error:", error);
            remainingQueue.push(loc);
        }
    }

    await saveQueue(remainingQueue);
};

// --- Background Task (Android) ---

const sleep = (time: number) => new Promise<void>((resolve) => setTimeout(() => resolve(), time));

const backgroundTask = async (taskDataArguments?: { delay: number }) => {
    const delay = taskDataArguments?.delay || 10000;

    await new Promise<void>(async (resolve) => {
        let subscription: Location.LocationSubscription | null = null;

        try {
            // Start watching position
            subscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: delay,
                    distanceInterval: 10,
                },
                async (location) => {
                    const locData: LocationData = {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                        accuracy: location.coords.accuracy,
                        speed: location.coords.speed,
                        timestamp: location.timestamp,
                    };

                    console.log('[Android Service] Location received:', locData);

                    const state = await NetInfo.fetch();
                    if (state.isConnected) {
                        await queueLocation(locData);
                        await syncLocationQueue();
                    } else {
                        await queueLocation(locData);
                    }
                }
            );

            // Loop to keep service alive
            while (BackgroundService.isRunning()) {
                await sleep(5000);
            }

        } catch (e) {
            console.error(e);
        } finally {
            if (subscription) {
                subscription.remove();
            }
        }
    });
};

const options = {
    taskName: 'Nearu Location Service',
    taskTitle: 'Nearu Running',
    taskDesc: 'Your location is being tracked in the background.',
    taskIcon: {
        name: 'ic_launcher',
        type: 'mipmap',
    },
    color: '#ff00ff',
    linkingURI: 'yourSchemeHere://chat/jane',
    parameters: {
        delay: 10000,
    },
};

// --- Expo Task (iOS) ---

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
        console.error('Background location task error:', error);
        return;
    }
    if (data) {
        const { locations } = data as { locations: Location.LocationObject[] };
        const location = locations[0];
        if (!location) return;

        const locData: LocationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            speed: location.coords.speed,
            timestamp: location.timestamp,
        };

        const state = await NetInfo.fetch();
        if (state.isConnected) {
            await queueLocation(locData);
            await syncLocationQueue();
        } else {
            await queueLocation(locData);
        }
    }
});

// --- Public API ---

export const startBackgroundLocation = async () => {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
        console.warn('Foreground location permission denied');
        return;
    }

    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
        console.warn('Background location permission denied');
    }

    if (Platform.OS === 'android') {
        if (!BackgroundService.isRunning()) {
            try {
                await BackgroundService.start(backgroundTask, options);
                console.log('Android Background Service Started');
            } catch (e) {
                console.error('Error starting background service', e);
            }
        }
    } else {
        // iOS or others
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
            accuracy: Location.Accuracy.High,
            distanceInterval: 10,
            timeInterval: 10000,
            showsBackgroundLocationIndicator: true,
            pausesUpdatesAutomatically: false,
            foregroundService: {
                notificationTitle: 'Location Tracking Active',
                notificationBody: 'Your location is being tracked in the background.',
                notificationColor: '#113C9C',
            },
        });
        console.log('iOS Background location tracking started.');
    }
};

export const stopBackgroundLocation = async () => {
    if (Platform.OS === 'android') {
        await BackgroundService.stop();
    } else {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
        if (isRegistered) {
            await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        }
    }
    console.log('Background location tracking stopped.');
};

export const isBackgroundLocationRunning = async () => {
    if (Platform.OS === 'android') {
        return BackgroundService.isRunning();
    }
    return await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
};
