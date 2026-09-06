import React, { useEffect, useState } from 'react';
import { StyleSheet, View, LogBox, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ClerkProvider, SignedIn, SignedOut, useAuth } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { ServerOff, RefreshCw, Mail } from 'lucide-react-native';
import {
  registerForPushNotificationsAsync,
  sendTokenToBackend,
  setupNotificationListeners,
} from './src/lib/pushNotifications';

// Complete the browser auth session on redirects
WebBrowser.maybeCompleteAuthSession();

// Brand Fonts Loading
import { 
  useFonts, 
  Sora_400Regular, 
  Sora_600SemiBold, 
  Sora_700Bold 
} from '@expo-google-fonts/sora';
import { 
  PlusJakartaSans_400Regular, 
  PlusJakartaSans_500Medium, 
  PlusJakartaSans_700Bold 
} from '@expo-google-fonts/plus-jakarta-sans';

import { setTokenGetter } from './src/lib/api';
import { API_URL } from './src/lib/store';
import RootNavigator from './src/navigation/RootNavigator';
import LoadingSpinner from './src/components/LoadingSpinner';

// Deep Linking Setup for React Navigation
const prefix = Linking.createURL('/');
const linking = {
  prefixes: [prefix, 'mymindtherapyfriend://'],
  config: {
    screens: {
      Landing: 'landing',
      About: 'about',
      Plans: 'plans',
      Login: 'login',
      ClerkAuth: 'clerk-auth',
      Onboarding: 'onboarding',
      UserTabs: 'user-tabs',
      TherapistTabs: 'therapist-tabs',
      OrgTabs: 'org-tabs',
      AdminTabs: 'admin-tabs',
    },
  },
};

// Ignore non-critical developer warning boxes in simulator view
LogBox.ignoreAllLogs();

// Secure Token Cache for Clerk Auth Sessions using standard AsyncStorage
const tokenCache = {
  async getToken(key: string) {
    try {
      const item = await AsyncStorage.getItem(key);
      if (item) {
        return item;
      }
      return null;
    } catch (err) {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return await AsyncStorage.setItem(key, value);
    } catch (err) {
      return;
    }
  },
};

const queryClient = new QueryClient();

// Clerk Publishable Key provided in environment
const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || 'pk_test_ZmFtb3VzLWNhaW1hbi02NC5jbGVyay5hY2NvdW50cy5kZXYk';

function AuthBridge({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn } = useAuth();

  // Inject active Clerk token getter into our API layer synchronously during render
  setTokenGetter(async () => {
    try {
      return await getToken();
    } catch (err) {
      return null;
    }
  });

  // Register push notifications when user signs in
  useEffect(() => {
    if (!isSignedIn) return;

    let cleanupListeners: (() => void) | undefined;

    const initPush = async () => {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        await sendTokenToBackend(token);
      }

      // Set up foreground + tap listeners
      cleanupListeners = setupNotificationListeners(
        (notification) => {
          // Foreground notification received — could update badge count, etc.
          console.log('[App] Push received:', notification.request.content.title);
        },
        (response) => {
          // User tapped notification — could navigate to relevant screen
          console.log('[App] Push tapped:', response.notification.request.content.data);
        }
      );
    };

    initPush();

    return () => {
      cleanupListeners?.();
    };
  }, [isSignedIn]);

  return <>{children}</>;
}

// Premium Maintenance Screen Component
interface MaintenanceScreenProps {
  onRetry: () => Promise<void>;
}

function MaintenanceScreen({ onRetry }: MaintenanceScreenProps) {
  const [retrying, setRetrying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRetry = async () => {
    setRetrying(true);
    setErrorMsg('');
    try {
      // Simulate brief network buffer for micro-interactive feel
      await new Promise(resolve => setTimeout(resolve, 800));
      await onRetry();
    } catch (err) {
      setErrorMsg('Server is still offline. Please check back later.');
    } finally {
      setRetrying(false);
    }
  };

  const handleMailPress = () => {
    Linking.openURL('mailto:contact@mymindtherapyfriend.com').catch(() => {
      // Fallback
    });
  };

  return (
    <View style={styles.maintenanceContainer}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <ServerOff size={44} color="#E07A5F" />
        </View>
        
        <Text style={styles.title}>System Offline</Text>
        
        <Text style={styles.description}>
          MyMindTherapyFriend is currently undergoing scheduled fine-tuning to improve backend databases. We will be back online shortly.
        </Text>

        <View style={styles.infoBox}>
          <Mail size={20} color="#78716C" style={{ marginRight: 12 }} />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>App is in maintenance</Text>
            <Text style={styles.infoSubtitle}>Please contact support:</Text>
            <TouchableOpacity onPress={handleMailPress} activeOpacity={0.7}>
              <Text style={styles.emailText}>contact@mymindtherapyfriend.com</Text>
            </TouchableOpacity>
          </View>
        </View>

        {errorMsg ? (
          <Text style={styles.errorText}>{errorMsg}</Text>
        ) : null}

        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={handleRetry}
          disabled={retrying}
          activeOpacity={0.9}
        >
          {retrying ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <View style={styles.retryInner}>
              <RefreshCw size={15} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.retryText}>Retry Connection</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Sora_400Regular,
    Sora_600SemiBold,
    Sora_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_700Bold
  });

  const [isServerDown, setIsServerDown] = useState<boolean | null>(null);

  const checkHealth = async () => {
    try {
      // Direct health-check fetch call to the backend
      const response = await fetch(`${API_URL}/api/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        setIsServerDown(false);
      } else {
        setIsServerDown(true);
      }
    } catch (error) {
      // Network connection errors mean server is offline
      setIsServerDown(true);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  if (!fontsLoaded || isServerDown === null) {
    return (
      <View style={styles.splash}>
        <LoadingSpinner message="Verifying secure connection to MyMindTherapyFriend…" />
      </View>
    );
  }

  if (isServerDown) {
    return <MaintenanceScreen onRetry={checkHealth} />;
  }

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <QueryClientProvider client={queryClient}>
        <AuthBridge>
          <NavigationContainer linking={linking}>
            <View style={styles.container}>
              <RootNavigator />
              <StatusBar style="dark" />
            </View>
          </NavigationContainer>
        </AuthBridge>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF9', // Design System warm off-white
  },
  splash: {
    flex: 1,
    backgroundColor: '#FAFAF9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  maintenanceContainer: {
    flex: 1,
    backgroundColor: '#FAFAF9',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F5F5F4',
  },
  iconContainer: {
    backgroundColor: '#FFF2E6',
    padding: 20,
    borderRadius: 99,
    marginBottom: 24,
  },
  title: {
    fontFamily: 'Sora_700Bold',
    fontSize: 22,
    color: '#1C1917',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#78716C',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F5F5F4',
    padding: 16,
    borderRadius: 18,
    width: '100%',
    marginBottom: 20,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 14,
    color: '#1C1917',
    marginBottom: 2,
  },
  infoSubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: '#78716C',
    marginBottom: 6,
  },
  emailText: {
    fontFamily: 'Sora_600SemiBold',
    color: '#E07A5F',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  errorText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#EF4444',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#1C1917',
    paddingVertical: 15,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  retryInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    fontFamily: 'Sora_600SemiBold',
    color: '#FFFFFF',
    fontSize: 14,
  },
});
