import React, { useState, useRef } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Dimensions, Image, Linking, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, ArrowRight } from 'lucide-react-native';
import { useAuth } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../../theme';

import API from '../../lib/api';

interface LandingScreenProps {
  navigation: any;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ navigation }) => {
  const { width } = Dimensions.get('window');
  const { isSignedIn, isLoaded } = useAuth();
  const insets = useSafeAreaInsets();

  // Track whether auth check is complete to prevent landing page flash
  const [hasChecked, setHasChecked] = useState(false);
  const redirectingRef = useRef(false);

  // Safety timeout: if Clerk takes too long, show landing UI anyway
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (!hasChecked) {
        console.log('[Landing] Safety timeout reached — showing landing UI');
        setHasChecked(true);
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, [hasChecked]);

  // Handle auto-redirection based on confirmed user profile role from MongoDB
  React.useEffect(() => {
    if (!isLoaded) return; // Wait for Clerk to hydrate

    // If user is NOT signed in, immediately show landing UI
    if (!isSignedIn) {
      setHasChecked(true);
      return;
    }

    // User IS signed in — redirect to their dashboard without showing landing UI
    const checkRedirect = async () => {
      if (redirectingRef.current) return;
      redirectingRef.current = true;

      let stashedIntendedRole: string | null = null;
      try {
        // 1. Retrieve any intended signup role saved from OAuth selection stage
        const intendedRole = await AsyncStorage.getItem('intended_role');
        stashedIntendedRole = intendedRole;
        const savedUpgradePlan = await AsyncStorage.getItem('upgrade_plan');

        if (intendedRole) {
          try {
            // Commit intended role to backend database
            const res = await API.auth.setRole(intendedRole);
            const confirmedRole = res.user?.role || intendedRole;

            // Clear stored credentials
            await AsyncStorage.removeItem('intended_role');
            if (savedUpgradePlan) {
              await AsyncStorage.removeItem('upgrade_plan');
            }

            // Navigate to respective portal
            if (confirmedRole === 'user') {
              const profile = await API.auth.me();
              if (profile && profile.onboarding && profile.onboarding.completedAt) {
                navigation.replace('UserTabs', { screen: 'Home', upgradePlan: savedUpgradePlan });
              } else {
                navigation.replace('Onboarding', { upgradePlan: savedUpgradePlan });
              }
            } else if (confirmedRole === 'therapist') {
              navigation.replace('TherapistTabs');
            } else if (confirmedRole === 'org_admin') {
              navigation.replace('OrgTabs');
            } else if (confirmedRole === 'super_admin') {
              navigation.replace('AdminTabs');
            }
            return;
          } catch (err) {
            console.error("Failed to commit role to backend in autologin:", err);
            // Fallback redirect respecting the intended role so they are not sent to seeker dashboard!
            await AsyncStorage.removeItem('intended_role');
            if (savedUpgradePlan) {
              await AsyncStorage.removeItem('upgrade_plan');
            }
            if (intendedRole === 'user') {
              navigation.replace('UserTabs', { screen: 'Home', upgradePlan: savedUpgradePlan });
            } else if (intendedRole === 'therapist') {
              navigation.replace('TherapistTabs');
            } else if (intendedRole === 'org_admin') {
              navigation.replace('OrgTabs');
            } else if (intendedRole === 'super_admin') {
              navigation.replace('AdminTabs');
            }
            return;
          }
        }

        // 2. Default fallback check if no custom signup role was saved (subsequent opens)
        const profile = await API.auth.me();
        const role = profile?.role || 'user';

if (role === 'user') {
  if (profile?.onboarding?.completedAt) {
    navigation.reset({
      index: 0,
      routes: [{ name: 'UserTabs', params: { screen: 'Home' } }],
    });
  } else {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Onboarding' }],
    });
  }
} else if (role === 'therapist') {
  navigation.reset({
    index: 0,
    routes: [{ name: 'TherapistTabs' }],
  });
} else if (role === 'org_admin') {
  navigation.reset({
    index: 0,
    routes: [{ name: 'OrgTabs' }],
  });
} else if (role === 'super_admin') {
  navigation.reset({
    index: 0,
    routes: [{ name: 'AdminTabs' }],
  });
}
      } catch (err) {
        console.error("Failed to fetch profile on autologin:", err);
        // Recover stashed intended role if any, to prevent wrong portal drops
        const backupRole = stashedIntendedRole || 'user';
        await AsyncStorage.removeItem('intended_role');
        await AsyncStorage.removeItem('upgrade_plan');

        if (backupRole === 'therapist') {
  navigation.reset({
    index: 0,
    routes: [{ name: 'TherapistTabs' }],
  });
} else if (backupRole === 'org_admin') {
  navigation.reset({
    index: 0,
    routes: [{ name: 'OrgTabs' }],
  });
} else if (backupRole === 'super_admin') {
  navigation.reset({
    index: 0,
    routes: [{ name: 'AdminTabs' }],
  });
} else {
  navigation.reset({
    index: 0,
    routes: [{ name: 'UserTabs', params: { screen: 'Home' } }],
  });
}
      }
    };

    checkRedirect();
  }, [isLoaded, isSignedIn, navigation]);

  // Show loading spinner while auth is being checked — prevents the landing page flash
  if (!hasChecked) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) }]}
    >
      {/* Hero Header Gradient */}
      <LinearGradient
        colors={['#E6F0EE', '#F9F5E9']}
        style={styles.heroGradient}
      >
        <View style={styles.heroHeader}>
          <View style={styles.badge}>
            <Heart size={14} color={Theme.colors.secondary} fill={Theme.colors.secondary} />
            <Text style={styles.badgeText}>Reimagined for India</Text>
          </View>
          <Text style={styles.mainTitle}>MyMindTherapyFriend</Text>
          <Text style={styles.tagline}>
            BetterHelp + Headspace, reimagined for India. Warm. Accessible. Culturally fluent.
          </Text>
        </View>
      </LinearGradient>

      {/* Centered Premium Mindfulness Illustration */}
      <View style={styles.illustrationContainer}>
        <Image 
          source={require('../../../assets/wellness_illustration.png')} 
          style={styles.illustrationImage} 
          resizeMode="contain"
        />
        <Text style={styles.innovativeText}>
          Connect with Manas AI for 24/7 empathetic support, or consult with verified therapists matching your language & culture. 🙏
        </Text>
      </View>

      {/* Premium CTA Actions */}
      <View style={styles.actionSection}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('ClerkAuth', { role: 'user' })}
          style={styles.signUpButton}
          activeOpacity={0.85}
        >
          <Text style={styles.signUpText}>For User</Text>
          <ArrowRight size={18} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => navigation.navigate('Login', { hideUser: true })}
          style={styles.signInButton}
          activeOpacity={0.85}
        >
          <Text style={styles.signInText}>For Therapist, Organisation</Text>
        </TouchableOpacity>
      </View>

     <View style={styles.buttonContainer}>
  <TouchableOpacity
    onPress={() => navigation.navigate('About')}
    style={styles.aboutTrigger}
  >
    <Text style={styles.aboutTriggerText}>
      Learn more about our mission
    </Text>
  </TouchableOpacity>

  <TouchableOpacity
    onPress={() => Linking.openURL('https://mymindtherapyfriend.com/')}
    style={styles.aboutTrigger}
  >
    <Text style={styles.aboutTriggerText}>
      Visit Our Website
    </Text>
  </TouchableOpacity>
</View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F9F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 12,
  },
  container: {
    flex: 1,
    backgroundColor: '#F9F5E9',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    // paddingBottom: Theme.spacing.xl,
  },
  heroGradient: {
    // marginTop: Theme.spacing.sm,
    paddingTop: Theme.spacing.xl,
    paddingBottom: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.margin,
    alignItems: 'center',
  },
  heroHeader: {
    paddingTop: Theme.spacing.sm,
    alignItems: 'center',
    textAlign: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Theme.colors.secondaryContainer + '20',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Theme.radius.full,
    marginBottom: Theme.spacing.sm,
  },
  badgeText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: Theme.colors.secondary,
    letterSpacing: 0.5,
  },
  logoImage: {
    width: 72,
    height: 72,
    borderRadius: 18,
    marginBottom: Theme.spacing.sm,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  mainTitle: {
    fontFamily: Theme.fonts.display,
    fontSize: 31,
    color: Theme.colors.primary,
    letterSpacing: -1,
    textAlign: 'center',
  },
  buttonContainer: {
    // marginTop: Theme.spacing.lg,
    gap: 10,
  },
  tagline: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 15,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.xs,
  },
  illustrationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.margin,
  },
  illustrationImage: {
    width: Dimensions.get('window').width * 0.72,
    height: Dimensions.get('window').width * 0.72,
  },
  innovativeText: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.sm,
  },
  actionSection: {
    paddingHorizontal: Theme.spacing.margin,
    // marginTop: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  signUpButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.primary,
    paddingVertical: 16,
    borderRadius: Theme.radius.lg,
    gap: 8,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  signUpText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 16,
    color: '#FFF',
  },
  signInButton: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: Theme.colors.surfaceHigh,
    paddingVertical: 16,
    borderRadius: Theme.radius.lg,
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  signInText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 16,
    color: Theme.colors.primary,
  },
  aboutTrigger: {
    alignSelf: 'center',
    paddingVertical: 0,
  },
  aboutTriggerText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
    color: Theme.colors.primary,
    textDecorationLine: 'underline',
  },
});
export default LandingScreen;
