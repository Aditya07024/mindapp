import React, { useState } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity } from 'react-native';
import { User, Briefcase, Award, ShieldAlert, ChevronRight } from 'lucide-react-native';
import { Theme } from '../../theme';
import { PasswordModal } from '../../components/PasswordModal';

interface LoginScreenProps {
  navigation: any;
  route: any;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation, route }) => {
  const [gateOpen, setGateOpen] = useState(false);
  const selectedUpgrade = route.params?.upgradePlan;
  const hideUser = route.params?.hideUser;

  const handleRoleSelect = (role: string) => {
    if (role === 'super_admin') {
      setGateOpen(true);
    } else {
      navigation.navigate('ClerkAuth', { role, upgradePlan: selectedUpgrade });
    }
  };

  const handleAdminSuccess = () => {
    setGateOpen(false);
    navigation.navigate('ClerkAuth', { role: 'super_admin' });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Designed For Every Mind</Text>
        <Text style={styles.subtitle}>{"One Platform.\nMultiple Wellness Experiences."}</Text>
        <Text style={styles.description}>
          Whether you need emotional support, therapy tools, organisation wellness insights, or platform administration — MyMindTherapyFriend adapts to your role beautifully.
        </Text>
      </View>

      <View style={styles.cardList}>
        {/* User Card */}
        {!hideUser && (
          <TouchableOpacity 
            onPress={() => handleRoleSelect('user')} 
            style={styles.card}
            activeOpacity={0.9}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: Theme.colors.primaryContainer + '15' }]}>
                <User size={22} color={Theme.colors.primaryContainer} />
              </View>
              <Text style={styles.cardName}>For Patient/User</Text>
            </View>
            <Text style={styles.cardDesc}>For people: Chat with AI, use mood tools, and book real therapists</Text>
            <View style={styles.enterPortalBtn}>
              <Text style={styles.enterPortalText}>Enter Portal</Text>
              <ChevronRight size={14} color={Theme.colors.primary} />
            </View>
          </TouchableOpacity>
        )}

        {/* Therapist Card */}
        <TouchableOpacity 
          onPress={() => handleRoleSelect('therapist')} 
          style={styles.card}
          activeOpacity={0.9}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: Theme.colors.secondaryContainer + '20' }]}>
              <Briefcase size={22} color={Theme.colors.secondary} />
            </View>
            <Text style={styles.cardName}>Sign in for Therapist</Text>
          </View>
          <Text style={styles.cardDesc}>Sign in for therapists: Manage client bookings, read notes, and do video calls</Text>
          <View style={[styles.enterPortalBtn, styles.therapistEnterPortalBtn]}>
            <Text style={[styles.enterPortalText, styles.therapistEnterPortalText]}>Enter Portal</Text>
            <ChevronRight size={14} color={Theme.colors.secondary} />
          </View>
        </TouchableOpacity>

        {/* Org Admin Card */}
        <TouchableOpacity 
          onPress={() => handleRoleSelect('org_admin')} 
          style={styles.card}
          activeOpacity={0.9}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: Theme.colors.gold + '20' }]}>
              <Award size={22} color={Theme.colors.tertiary} />
            </View>
            <Text style={styles.cardName}>Organisation Admin</Text>
          </View>
          <Text style={styles.cardDesc}>Anonymous team wellness analytics, seat management</Text>
          <View style={[styles.enterPortalBtn, styles.orgEnterPortalBtn]}>
            <Text style={[styles.enterPortalText, styles.orgEnterPortalText]}>Enter Portal</Text>
            <ChevronRight size={14} color={Theme.colors.gold} />
          </View>
        </TouchableOpacity>

        {/* Super Admin Card */}
        {/* <TouchableOpacity 
          onPress={() => handleRoleSelect('super_admin')} 
          style={[styles.card, styles.adminCard]}
          activeOpacity={0.9}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: Theme.colors.errorContainer + '30' }]}>
              <ShieldAlert size={22} color={Theme.colors.error} />
            </View>
            <Text style={[styles.cardName, styles.adminText]}>Super Admin</Text>
          </View>
          <Text style={styles.cardDesc}>Ops dashboard, therapist verification, platform analytics</Text>
          <View style={[styles.enterPortalBtn, styles.adminEnterPortalBtn]}>
            <Text style={[styles.enterPortalText, styles.adminEnterPortalText]}>Enter Portal</Text>
            <ChevronRight size={14} color={Theme.colors.error} />
          </View>
        </TouchableOpacity> */}
      </View>

      <PasswordModal
        open={gateOpen}
        onSuccess={handleAdminSuccess}
        onCancel={() => setGateOpen(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Theme.spacing.margin,
    paddingTop: Theme.spacing.xl + 10,
    paddingBottom: Theme.spacing.xl + 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
    textAlign: 'center',
  },
  title: {
    fontFamily: Theme.fonts.display,
    fontSize: 26,
    color: Theme.colors.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.xs,
  },
  subtitle: {
    fontFamily: Theme.fonts.display,
    fontSize: 18,
    color: Theme.colors.onSurface,
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
    lineHeight: 24,
  },
  description: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Theme.spacing.xs,
  },
  cardList: {
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.xs,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  adminCard: {
    borderColor: Theme.colors.errorContainer,
    borderWidth: 1.5,
  },
  adminText: {
    color: Theme.colors.error,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginBottom: 6,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: Theme.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardName: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.onSurface,
    flex: 1,
  },
  cardDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 12.5,
    color: Theme.colors.textMuted,
    lineHeight: 17,
    paddingLeft: 4,
  },
  enterPortalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.colors.primary + '12',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Theme.radius.full,
    alignSelf: 'flex-end',
    marginTop: Theme.spacing.xs,
  },
  enterPortalText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 12,
    color: Theme.colors.primary,
  },
  therapistEnterPortalBtn: {
    backgroundColor: Theme.colors.secondary + '12',
  },
  therapistEnterPortalText: {
    color: Theme.colors.secondary,
  },
  orgEnterPortalBtn: {
    backgroundColor: Theme.colors.gold + '15',
  },
  orgEnterPortalText: {
    color: Theme.colors.tertiary,
  },
  adminEnterPortalBtn: {
    backgroundColor: Theme.colors.error + '12',
  },
  adminEnterPortalText: {
    color: Theme.colors.error,
  },
});

export default LoginScreen;
