import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { SignIn } from '@clerk/clerk-expo/web';
import { Theme } from '../../theme';

import API from '../../lib/api';

interface ClerkAuthScreenProps {
  navigation: any;
  route: any;
}

export const ClerkAuthScreen: React.FC<ClerkAuthScreenProps> = ({ navigation, route }) => {
  const role = route.params?.role || 'user';
  const upgradePlan = route.params?.upgradePlan;

  const { isSignedIn } = useAuth();

  React.useEffect(() => {
    // Save role so that when Google OAuth redirects back to the root URL (LandingScreen),
    // the LandingScreen knows where to route the user.
    if (role && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('mymindtherapyfriend_pending_role', role);
    }
  }, [role]);

  React.useEffect(() => {
    if (isSignedIn) {
      // If already signed in, navigate to appropriate dashboard
      if (role === 'user') {
        API.auth.me()
          .then((profile) => {
            if (profile && profile.onboarding && profile.onboarding.completedAt) {
              navigation.replace('UserTabs', { screen: 'Home', upgradePlan });
            } else {
              navigation.replace('Onboarding');
            }
          })
          .catch((err) => {
            console.error("Failed to fetch user profile for onboarding check:", err);
            // Fallback: avoid locking out user
            navigation.replace('UserTabs', { screen: 'Home', upgradePlan });
          });
      } else if (role === 'therapist') {
        navigation.replace('TherapistTabs');
      } else if (role === 'org_admin') {
        navigation.replace('OrgTabs');
      } else if (role === 'super_admin') {
        navigation.replace('AdminTabs');
      }
    }
  }, [isSignedIn]);

  if (isSignedIn) {
    return (
      <View style={styles.container}>
        <Text style={{ fontFamily: Theme.fonts.body, color: Theme.colors.primary }}>
          Authenticated! Redirecting to Dashboard...
        </Text>
      </View>
    );
  }

  // The prebuilt Clerk SignIn component handles everything automatically.
  // We use routing="virtual" so it doesn't conflict with React Navigation's pathing.
  return (
    <View style={styles.container}>
      <SignIn routing="virtual" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.margin,
  }
});

export default ClerkAuthScreen;
