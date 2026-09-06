import React, { useState, useRef } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Dimensions, Image, Linking, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, ArrowRight } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../../theme';

import API from '../../lib/api';

interface LandingScreenProps {
  navigation: any;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ navigation }) => {
  const { width } = Dimensions.get('window');
  const insets = useSafeAreaInsets();
  const [hasChecked, setHasChecked] = useState(false);
  const redirectingRef = useRef(false);

  React.useEffect(() => {
    const checkRedirect = async () => {
      if (redirectingRef.current) return;
      redirectingRef.current = true;

      try {
        const token = await AsyncStorage.getItem('jwt_token');
        if (!token) {
          setHasChecked(true);
          return;
        }

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
        } else {
          setHasChecked(true);
        }
      } catch (err) {
        setHasChecked(true);
      }
    };

    checkRedirect();
  }, []);

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
