/**
 * pushNotifications.ts — Expo Push Notification registration & listeners
 * Handles permission request, token retrieval, and foreground/background notification handling.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from './api';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,   // Show banner even when app is open
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowInForeground: true,
  }),
});

/**
 * Request push notification permissions and get the Expo push token.
 * Returns the token string or null if permissions denied / not a physical device.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notifications not supported/needed on web
  if (Platform.OS === 'web') {
    console.log('[Push] Web platform detected — skipping push registration');
    return null;
  }

  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log('[Push] Not a physical device — skipping push registration');
    return null;
  }

  try {
    // Check existing permission status
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowDisplayInCarPlay: true,
          allowCriticalAlerts: true,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Permission not granted for push notifications');
      return null;
    }

    // Get the Expo push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const token = tokenData.data;
    console.log('[Push] Registered Expo push token:', token);

    // Set up Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'MyMindTherapyFriend',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2E6E65',
        sound: 'default',
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    return token;
  } catch (err) {
    console.error('[Push] Failed to register for push notifications:', err);
    return null;
  }
}

/**
 * Send the push token to the backend so it can send notifications to this device.
 */
export async function sendTokenToBackend(token: string): Promise<void> {
  try {
    await API.auth.registerPushToken(token);
    console.log('[Push] Token sent to backend successfully');
  } catch (err) {
    console.error('[Push] Failed to send token to backend:', err);
  }
}

/**
 * Set up notification listeners for foreground and tap-to-open events.
 * Returns a cleanup function to remove the listeners.
 */
export function setupNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationTapped?: (response: Notifications.NotificationResponse) => void
): () => void {
  // Listener for notifications received while app is in foreground
  const receivedSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log('[Push] Notification received in foreground:', notification.request.content.title);
      onNotificationReceived?.(notification);
    }
  );

  // Listener for when user taps on a notification (foreground or background)
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      console.log('[Push] Notification tapped:', response.notification.request.content.title);
      onNotificationTapped?.(response);
    }
  );

  // Return cleanup function
  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}

/**
 * Check if the system has granted notifications permission.
 */
export async function checkNotificationPermissionStatus(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    console.error('[Push] Error checking permissions status:', err);
    return false;
  }
}

/**
 * Synchronize and get the notification preference status (combines storage and system permission)
 */
export async function getNotificationsPreference(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const storageVal = await AsyncStorage.getItem('notifications_enabled');
    const isStorageEnabled = storageVal === 'true';
    const hasSystemPermission = await checkNotificationPermissionStatus();
    
    if (isStorageEnabled && !hasSystemPermission) {
      await AsyncStorage.setItem('notifications_enabled', 'false');
      return false;
    }
    return isStorageEnabled && hasSystemPermission;
  } catch (err) {
    console.error('[Push] Error getting notifications preference:', err);
    return false;
  }
}

/**
 * Handle toggling the notification settings.
 * If enabling and permission is denied in system settings, it redirects the user to system settings.
 */
export async function handleNotificationToggle(
  enable: boolean,
  setNotificationsEnabledState: (val: boolean) => void
): Promise<void> {
  if (Platform.OS === 'web') {
    Alert.alert('Not Supported', 'Push notifications are not supported on web.');
    setNotificationsEnabledState(false);
    return;
  }

  if (enable) {
    try {
      const { status: currentStatus } = await Notifications.getPermissionsAsync();

      if (currentStatus === 'denied') {
        Alert.alert(
          'Notifications Off',
          'You have disabled notifications in system settings. Please enable them in settings first.',
          [
            { 
              text: 'Cancel', 
              style: 'cancel', 
              onPress: () => setNotificationsEnabledState(false) 
            },
            { 
              text: 'Go to Settings', 
              onPress: () => {
                Linking.openSettings();
                setNotificationsEnabledState(false);
              } 
            }
          ]
        );
        return;
      }

      let finalStatus: any = currentStatus;
      if (currentStatus === 'undetermined') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert('Permission Denied', 'Notifications permission was not granted.');
        setNotificationsEnabledState(false);
        return;
      }

      // If granted, save preference and register push token
      setNotificationsEnabledState(true);
      await AsyncStorage.setItem('notifications_enabled', 'true');
      
      const token = await registerForPushNotificationsAsync();
      if (token) {
        await sendTokenToBackend(token);
      }
      Alert.alert('Notifications Enabled', 'You will now receive push notification alerts.');
    } catch (err) {
      console.error('[Push] Error enabling notifications:', err);
      setNotificationsEnabledState(false);
    }
  } else {
    try {
      setNotificationsEnabledState(false);
      await AsyncStorage.setItem('notifications_enabled', 'false');
      Alert.alert('Notifications Disabled', 'Push notifications have been disabled.');
    } catch (err) {
      console.error('[Push] Error disabling notifications:', err);
    }
  }
}
