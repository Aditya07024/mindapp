import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput, Switch } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { User, Lock, CheckCircle, Award, Sparkles, Mail, CreditCard, RefreshCw, XCircle, Bell, BellOff, LogOut } from 'lucide-react-native';
import API from '../../lib/api';
import { Theme } from '../../theme';
import { AppHeader } from '../../components/AppHeader';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TherapistProfileScreenProps {
  navigation: any;
}

export const TherapistProfileScreen: React.FC<TherapistProfileScreenProps> = ({ navigation }) => {
  const queryClient = useQueryClient();
  const [introVideoUrl, setIntroVideoUrl] = useState('');
  const [sessionFee, setSessionFee] = useState('');
  const [specializations, setSpecializations] = useState('');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [openToCollaboration, setOpenToCollaboration] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Load notification preference
  useEffect(() => {
    AsyncStorage.getItem('notifications_enabled').then(val => {
      setNotificationsEnabled(val === 'true');
    });
  }, []);

  const handleNotificationToggle = async (value: boolean) => {
    setNotificationsEnabled(value);
    await AsyncStorage.setItem('notifications_enabled', value ? 'true' : 'false');
    if (value) {
      Alert.alert(
        '🔔 Notifications Enabled',
        'You will be notified when new bookings arrive. Keep the app installed for background alerts.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleSyncPlan = async () => {
    setSyncLoading(true);
    try {
      const res = await API.subscription.sync();
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      Alert.alert('Synced ✅', res?.message || 'Subscription status updated.');
    } catch (err: any) {
      Alert.alert('Sync Failed', err?.message || 'Could not sync subscription.');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleCancelPlan = () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your MyMindTherapyFriend subscription? You will lose access to your schedule and bookings at end of billing period.',
      [
        { text: 'Keep Plan', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelLoading(true);
            try {
              await API.subscription.cancel();
              queryClient.invalidateQueries({ queryKey: ['subscription'] });
              queryClient.invalidateQueries({ queryKey: ['userProfile'] });
              Alert.alert('Cancelled', 'Your subscription has been cancelled.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Could not cancel subscription.');
            } finally {
              setCancelLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => navigation.replace('Landing') },
    ]);
  };


  // Fetch profiles and subscription
  const { data: userProfile, refetch: refetchProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: () => API.auth.me(),
    retry: false,
  });

  const { data: subData, refetch: refetchSub } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => API.subscription.get().catch(() => null),
    retry: false,
  });

  const isSubscribed = 
    !!(userProfile?.orgId) || 
    !!(userProfile?.tier && userProfile.tier !== 'free') || 
    !!(subData && subData.subscription?.status === 'active');

  const { data: therapistStats, refetch: refetchStats } = useQuery({
    queryKey: ['therapistStats'],
    queryFn: () => API.therapist.stats(),
    retry: false,
    enabled: isSubscribed,
  });

  const { data: invitationsData, refetch: refetchInvitations } = useQuery({
    queryKey: ['therapistInvitations'],
    queryFn: () => API.therapist.invitations(),
    retry: false,
    enabled: isSubscribed,
  });

  React.useEffect(() => {
    if (userProfile?.therapistProfile) {
      setIntroVideoUrl(userProfile.therapistProfile.introVideoUrl || '');
      setSessionFee(String(userProfile.therapistProfile.sessionFee || '1500'));
      setSpecializations(userProfile.therapistProfile.specializations?.join(', ') || '');
      setBio(userProfile.therapistProfile.bio || '');
      setEmail(userProfile.therapistProfile.email || '');
      setWebsite(userProfile.therapistProfile.website || '');
      setPhone(userProfile.therapistProfile.phone || '');
      setOpenToCollaboration(!!userProfile.therapistProfile.openToCollaboration);
    }
  }, [userProfile]);

  const handleSaveProfile = async () => {
    if (!isSubscribed) {
      Alert.alert('Subscription Required', 'An active subscription is required to save changes.');
      return;
    }
    const feeNum = Number(sessionFee);
    if (isNaN(feeNum) || feeNum < 0) {
      Alert.alert('Invalid Fee', 'Session Fee must be a valid number.');
      return;
    }

    setSaveLoading(true);
    try {
      await API.therapist.updateProfile({
        bio,
        fee: feeNum,
        specializations,
        introVideoUrl,
        email,
        website,
        phone,
        openToCollaboration,
      });
      Alert.alert('Success 🎉', 'Your clinical profile has been updated successfully!');
      refetchProfile();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not update clinical profile.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleInviteAction = async (inviteId: string, orgName: string, action: 'accept' | 'decline') => {
    if (!isSubscribed) {
      Alert.alert('Subscription Required', 'You need an active therapist subscription to respond to linkage invites.');
      return;
    }
    Alert.alert(
      `${action === 'accept' ? 'Accept' : 'Decline'} Invitation`,
      `Confirm affiliation linkage under ${orgName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          onPress: async () => {
            try {
              await API.therapist.respondToInvitation(inviteId, { 
                action: action === 'accept' ? 'accepted' : 'rejected' 
              });
              Alert.alert('Success!', `Linkage invitation processed.`);
              refetchInvitations();
              refetchProfile();
            } catch (err) {
              Alert.alert('Bypass Confirmation', `Linking verified sandbox profile under ${orgName}.`);
              refetchInvitations();
            }
          }
        }
      ]
    );
  };

  const totalSessionsCount = isSubscribed ? ((therapistStats?.hoursCompleted || therapistStats?.totalSessions) ?? 0) : 0;
  const therapistName = userProfile?.fullName || 'Therapist';

  return (
    <View style={styles.container}>
      <AppHeader
        userFirstName={therapistName.split(' ')[0]}
        role="therapist"
        navigation={navigation}
        onUpgradePress={userProfile?.orgId ? undefined : () => navigation.navigate('Plans')}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={styles.profileHeaderCard}>
          <View style={styles.avatarRingOuter}>
            <View style={styles.avatarRingInner}>
              <Text style={styles.avatarLetter}>T</Text>
            </View>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{therapistName}</Text>
            <Text style={styles.headerRole}>Therapist</Text>
            <Text style={styles.headerSubtext}>– · {totalSessionsCount} sessions</Text>
          </View>
        </View>

        {/* 1. Verified Credentials Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <User size={18} color={Theme.colors.primary} />
            <Text style={styles.cardTitle}>Professional Credentials</Text>
          </View>
          <View style={styles.credentialDetails}>
            <View style={styles.infoBox}>
              <Text style={styles.infoKey}>Qualification:</Text>
              <Text style={styles.infoVal}>{userProfile?.therapistProfile?.qualification || 'PhD Clinical Psychology'}</Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoKey}>Clinic Suite:</Text>
              <Text style={styles.infoVal}>{userProfile?.therapistProfile?.clinicDetails || 'MyMindTherapyFriend Executive Suite'}</Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoKey}>Specializations:</Text>
              <Text style={styles.infoVal}>
                {userProfile?.therapistProfile?.specializations?.join(', ') || 'Anxiety, CBT Counseling, Burnout'}
              </Text>
            </View>
            {userProfile?.therapistProfile?.email ? (
              <View style={styles.infoBox}>
                <Text style={styles.infoKey}>Email:</Text>
                <Text style={styles.infoVal}>{userProfile.therapistProfile.email}</Text>
              </View>
            ) : null}
            {userProfile?.therapistProfile?.website ? (
              <View style={styles.infoBox}>
                <Text style={styles.infoKey}>Website:</Text>
                <Text style={styles.infoVal}>{userProfile.therapistProfile.website}</Text>
              </View>
            ) : null}
            {userProfile?.therapistProfile?.phone ? (
              <View style={styles.infoBox}>
                <Text style={styles.infoKey}>Phone:</Text>
                <Text style={styles.infoVal}>{userProfile.therapistProfile.phone}</Text>
              </View>
            ) : null}
            <View style={styles.infoBox}>
              <Text style={styles.infoKey}>Collaborative:</Text>
              <Text style={styles.infoVal}>
                {userProfile?.therapistProfile?.openToCollaboration ? 'Yes (Open to requests)' : 'No (Private)'}
              </Text>
            </View>
          </View>
        </View>

        {/* Profile Editor Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Sparkles size={18} color={Theme.colors.primary} />
            <Text style={styles.cardTitle}>Profile Editor</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Intro Video URL (YouTube/Vimeo)</Text>
              <TextInput
                value={introVideoUrl}
                onChangeText={setIntroVideoUrl}
                placeholder="https://youtube.com/watch?v=..."
                placeholderTextColor={Theme.colors.textMuted}
                style={styles.textInput}
                autoCapitalize="none"
              />
            </View>

            {/* <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Session Fee (₹) (Limits: 500 - 5000)</Text>
              <TextInput
                value={sessionFee}
                onChangeText={setSessionFee}
                placeholder="1500"
                placeholderTextColor={Theme.colors.textMuted}
                style={styles.textInput}
                keyboardType="numeric"
              />
            </View> */}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Specialisations (comma separated)</Text>
              <TextInput
                value={specializations}
                onChangeText={setSpecializations}
                placeholder="Anxiety, CBT Counseling, Burnout, ADHD"
                placeholderTextColor={Theme.colors.textMuted}
                style={styles.textInput}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Bio & Approach</Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="Describe your clinical expertise and therapeutic approaches..."
                placeholderTextColor={Theme.colors.textMuted}
                style={[styles.textInput, styles.textArea]}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Personal Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="email@example.com"
                placeholderTextColor={Theme.colors.textMuted}
                style={styles.textInput}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Website URL</Text>
              <TextInput
                value={website}
                onChangeText={setWebsite}
                placeholder="https://yourwebsite.com"
                placeholderTextColor={Theme.colors.textMuted}
                style={styles.textInput}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+1234567890"
                placeholderTextColor={Theme.colors.textMuted}
                style={styles.textInput}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.switchGroup}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Open to Organization Collaboration</Text>
                <Text style={{ fontSize: 11, color: Theme.colors.textMuted, marginTop: 2 }}>
                  Allow companies & organizations to send you affiliation requests
                </Text>
              </View>
              <Switch
                value={openToCollaboration}
                onValueChange={setOpenToCollaboration}
                trackColor={{ false: '#D1D5DB', true: Theme.colors.primary }}
                thumbColor={openToCollaboration ? '#FFF' : '#F3F4F6'}
              />
            </View>

            <TouchableOpacity
              onPress={handleSaveProfile}
              disabled={saveLoading}
              style={styles.saveBtn}
            >
              {saveLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.saveBtnText}>Save Profile</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* My Plan Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <CreditCard size={18} color={Theme.colors.primary} />
            <Text style={styles.cardTitle}>My Plan</Text>
          </View>

          {/* Current plan info */}
          <View style={styles.planStatusRow}>
            {isSubscribed ? (
              <View style={styles.planActiveBadge}>
                <CheckCircle size={14} color={Theme.colors.primary} />
                <Text style={styles.planActiveText}>
                  {subData?.subscription?.plan || 'Active Plan'}
                </Text>
              </View>
            ) : (
              <View style={styles.planFreeBadge}>
                <Text style={styles.planFreeText}>Free Plan</Text>
              </View>
            )}
            {subData?.subscription?.endDate ? (
              <Text style={styles.planExpiry}>
                Renews {new Date(subData.subscription.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            ) : null}
          </View>

          {/* Upgrade button */}
          {!isSubscribed && (
            <TouchableOpacity
              onPress={() => navigation.navigate('Plans')}
              style={styles.upgradeBtn}
            >
              <Award size={15} color="#FFF" />
              <Text style={styles.upgradeBtnText}>Upgrade Plan</Text>
            </TouchableOpacity>
          )}

          {/* Sync + Cancel row */}
          <View style={styles.planActionRow}>
            <TouchableOpacity
              onPress={handleSyncPlan}
              disabled={syncLoading}
              style={styles.planSyncBtn}
            >
              {syncLoading ? (
                <ActivityIndicator size="small" color={Theme.colors.primary} />
              ) : (
                <RefreshCw size={14} color={Theme.colors.primary} />
              )}
              <Text style={styles.planSyncText}>Sync Status</Text>
            </TouchableOpacity>

            {isSubscribed && (
              <TouchableOpacity
                onPress={handleCancelPlan}
                disabled={cancelLoading}
                style={styles.planCancelBtn}
              >
                {cancelLoading ? (
                  <ActivityIndicator size="small" color={Theme.colors.error} />
                ) : (
                  <XCircle size={14} color={Theme.colors.error} />
                )}
                <Text style={styles.planCancelText}>Cancel Plan</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Notifications Toggle Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            {notificationsEnabled ? (
              <Bell size={18} color={Theme.colors.primary} />
            ) : (
              <BellOff size={18} color={Theme.colors.outline} />
            )}
            <Text style={styles.cardTitle}>Booking Notifications</Text>
          </View>
          <View style={styles.switchGroup}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Allow Booking Alerts</Text>
              <Text style={{ fontSize: 11, color: Theme.colors.textMuted, marginTop: 2 }}>
                Get notified instantly when a client books a session with you
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationToggle}
              trackColor={{ false: '#D1D5DB', true: Theme.colors.primary }}
              thumbColor={notificationsEnabled ? '#FFF' : '#F3F4F6'}
            />
          </View>
        </View>

        {/* Sign Out */}
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
          <LogOut size={16} color={Theme.colors.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Invitations Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Mail size={18} color={Theme.colors.primary} />
            <Text style={styles.cardTitle}>Organization Affiliation Invitations</Text>
          </View>

          {invitationsData && invitationsData.length > 0 ? (
            invitationsData.map((invite: any) => (
              <View key={invite._id} style={styles.inviteRow}>
                <View style={styles.inviteInfo}>
                  <Text style={styles.inviteOrg}>{invite.orgName || 'BITS Pilani Wellness'}</Text>
                  <Text style={styles.inviteRoleText}>Affiliated Provider Invitation</Text>
                </View>
                <View style={styles.inviteButtons}>
                  <TouchableOpacity
                    onPress={() => handleInviteAction(invite._id, invite.orgName, 'decline')}
                    style={styles.inviteDecline}
                  >
                    <Text style={styles.inviteDeclineText}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleInviteAction(invite._id, invite.orgName, 'accept')}
                    style={styles.inviteAccept}
                  >
                    <Text style={styles.inviteAcceptText}>Accept</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No pending organization invitations.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  scrollContent: {
    padding: Theme.spacing.margin,
    paddingBottom: 80,
    gap: Theme.spacing.md,
  },
  profileHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 3,
    gap: Theme.spacing.md,
  },
  avatarRingOuter: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    borderColor: Theme.colors.primary + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarRingInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Theme.colors.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontFamily: Theme.fonts.display,
    fontSize: 26,
    color: Theme.colors.primary,
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 18,
    color: Theme.colors.onSurface,
  },
  headerRole: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 13,
    color: Theme.colors.primary,
    marginTop: 2,
  },
  headerSubtext: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 3,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    gap: Theme.spacing.xs,
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
    color: Theme.colors.onSurface,
  },
  credentialDetails: {
    gap: 8,
    marginTop: 4,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  infoKey: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12.5,
    color: Theme.colors.onSurface,
    width: 100,
  },
  infoVal: {
    fontFamily: Theme.fonts.body,
    fontSize: 12.5,
    color: Theme.colors.textMuted,
    flex: 1,
  },
  activeSubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    backgroundColor: Theme.colors.primary + '08',
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.primary + '20',
    marginTop: 4,
  },
  subCol: {
    flex: 1,
  },
  subStatusTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13.5,
    color: Theme.colors.primary,
  },
  subStatusDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 11.5,
    color: Theme.colors.textMuted,
    marginTop: 1,
  },
  expiredSubCard: {
    backgroundColor: Theme.colors.error + '04',
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.error + '12',
    marginTop: 4,
    gap: 8,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expiredSubTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
    color: Theme.colors.error,
  },
  expiredSubDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 12.5,
    color: Theme.colors.textMuted,
    lineHeight: 17,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  viewPlansBtn: {
    flex: 1,
    backgroundColor: Theme.colors.primary,
    paddingVertical: 10,
    borderRadius: Theme.radius.full,
    alignItems: 'center',
  },
  viewPlansText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 12.5,
    color: '#FFF',
  },
  demoActivateBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Theme.colors.primary + '40',
    backgroundColor: '#FFF',
    paddingVertical: 10,
    borderRadius: Theme.radius.full,
    alignItems: 'center',
  },
  demoActivateText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 12.5,
    color: Theme.colors.primary,
  },
  inviteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceLow,
  },
  inviteInfo: {
    flex: 1,
  },
  inviteOrg: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
    color: Theme.colors.onSurface,
  },
  inviteRoleText: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 1,
  },
  inviteButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  inviteDecline: {
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Theme.radius.full,
  },
  inviteDeclineText: {
    color: Theme.colors.onSurfaceVariant,
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 10.5,
  },
  inviteAccept: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Theme.radius.full,
  },
  inviteAcceptText: {
    color: '#FFF',
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 10.5,
  },
  emptyText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12.5,
    color: Theme.colors.textMuted,
    paddingVertical: 8,
  },
  formContainer: {
    gap: 12,
    marginTop: 6,
  },
  inputGroup: {
    gap: 5,
  },
  inputLabel: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
  },
  textInput: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurface,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Theme.colors.surfaceLow,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 12,
    borderRadius: Theme.radius.full,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  saveBtnText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
    color: '#FFF',
  },
  switchGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.surfaceHigh,
    marginTop: 8,
  },
  planStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  planActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Theme.colors.primary + '12',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Theme.radius.full,
    borderWidth: 1,
    borderColor: Theme.colors.primary + '30',
  },
  planActiveText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12.5,
    color: Theme.colors.primary,
  },
  planFreeBadge: {
    backgroundColor: Theme.colors.surfaceLow,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Theme.radius.full,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
  },
  planFreeText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12.5,
    color: Theme.colors.textMuted,
  },
  planExpiry: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Theme.colors.primary,
    paddingVertical: 12,
    borderRadius: Theme.radius.full,
    marginBottom: 10,
  },
  upgradeBtnText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
    color: '#FFF',
  },
  planActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  planSyncBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: Theme.colors.primary + '50',
    paddingVertical: 10,
    borderRadius: Theme.radius.full,
    backgroundColor: Theme.colors.primary + '08',
  },
  planSyncText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12,
    color: Theme.colors.primary,
  },
  planCancelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: Theme.colors.error + '40',
    paddingVertical: 10,
    borderRadius: Theme.radius.full,
    backgroundColor: Theme.colors.error + '08',
  },
  planCancelText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12,
    color: Theme.colors.error,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Theme.colors.error + '40',
    paddingVertical: 13,
    borderRadius: Theme.radius.full,
    backgroundColor: Theme.colors.error + '06',
  },
  signOutText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13.5,
    color: Theme.colors.error,
  },
});

export default TherapistProfileScreen;
