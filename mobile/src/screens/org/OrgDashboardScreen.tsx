import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  UserPlus,
  Activity,
  Users,
  Building,
  ShieldAlert,
  Heart,
  HelpCircle,
  Lock,
  Bell,
  BellOff
} from 'lucide-react-native';
import API from '../../lib/api';
import { Theme } from '../../theme';
import { AppHeader } from '../../components/AppHeader';
import { StatCard } from '../../components/StatCard';
import { getNotificationsPreference, handleNotificationToggle } from '../../lib/pushNotifications';

const LockedFeatureOverlay: React.FC<{ title: string; description: string; navigation: any }> = ({ title, description, navigation }) => (
  <View style={{
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: Theme.radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    zIndex: 10,
  }}>
    <View style={{
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#FFF2F2',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
      borderWidth: 1,
      borderColor: '#FFCDD2',
    }}>
      <Lock size={18} color={Theme.colors.primary} />
    </View>
    <Text style={{ fontFamily: Theme.fonts.headline, fontSize: 14, color: Theme.colors.onSurface, textAlign: 'center', marginBottom: 4 }}>
      {title}
    </Text>
    <Text style={{ fontFamily: Theme.fonts.body, fontSize: 11, color: Theme.colors.textMuted, textAlign: 'center', lineHeight: 14, paddingHorizontal: 12, marginBottom: 12 }}>
      {description}
    </Text>
    <TouchableOpacity
      onPress={() => navigation.navigate('Plans', { role: 'org_admin' })}
      style={{
        backgroundColor: Theme.colors.primary,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: Theme.radius.lg,
      }}
    >
      <Text style={{ fontFamily: Theme.fonts.bodyBold, fontSize: 11, color: '#FFF' }}>
        Upgrade to Activate
      </Text>
    </TouchableOpacity>
  </View>
);

export const OrgDashboardScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [coverMemberFees, setCoverMemberFees] = useState(false);

  useEffect(() => {
    getNotificationsPreference().then(setNotificationsEnabled);
  }, []);

  // 1. Query live database dashboard stats
  const { data: statsData, isLoading: isStatsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['org-stats'],
    queryFn: () => API.org.stats(),
    retry: false
  });

  // 2. Query live organization seat info
  const { data: orgInfoData, isLoading: isOrgLoading } = useQuery({
    queryKey: ['org-info'],
    queryFn: () => API.org.me(),
    retry: false
  });

  useEffect(() => {
    if (orgInfoData?.organization?.coverMemberTherapyFees !== undefined) {
      setCoverMemberFees(orgInfoData.organization.coverMemberTherapyFees);
    }
  }, [orgInfoData]);

  const handleToggleCoverFees = async (val: boolean) => {
    setCoverMemberFees(val);
    try {
      await API.org.updateSettings({ coverMemberTherapyFees: val });
      Alert.alert(
        'Policy Saved',
        val
          ? 'Member therapy fee coverage is ENABLED. Organization members will book linked therapists for free.'
          : 'Member therapy fee coverage is DISABLED. Members will pay standard fees.'
      );
    } catch (err: any) {
      setCoverMemberFees(!val);
      Alert.alert('Error', err.message || 'Failed to update policy setting.');
    }
  };

  // 3. Query active subscription status
  const { data: subData, isLoading: isSubLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => API.subscription.get().catch(() => null),
    retry: false
  });

  const isSubscribed = subData?.subscription?.status === 'active';

  const handleSendInvite = async () => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid member email address.');
      return;
    }

    setLoading(true);
    try {
      await API.org.invite({ email });
      Alert.alert(
        'Seat Allocated!',
        `We have successfully emailed a MyMindTherapyFriend connection invite link to ${email}.`,
        [{ text: 'Excellent', onPress: () => { setEmail(''); refetchStats(); } }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Invitation failed to dispatch.');
    } finally {
      setLoading(false);
    }
  };

  const metrics = statsData?.metrics;
  const avgTeamMood = metrics?.avgTeamMood ? parseFloat(metrics.avgTeamMood).toFixed(1) : '—';
  const activeMembers = metrics?.activeUsers ?? 0;
  const totalRegistered = metrics?.totalUsers ?? 0;
  const engagementRate = metrics?.engagement ?? 0;
  const crisisAlerts = metrics?.crisisAlerts ?? 0;

  const seatsUsed = totalRegistered;
  const seatsTotal = orgInfoData?.organization?.seats || 100;
  const fillPercent = seatsTotal > 0 ? Math.round((seatsUsed / seatsTotal) * 100) : 0;

  const departments = statsData?.departments || [];

  return (
    <View style={styles.container}>
      <AppHeader
        userFirstName="BITS Wellness"
        role="org_admin"
        navigation={navigation}
      />

      {isStatsLoading || isOrgLoading || isSubLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loaderText}>Fetching workplace metrics from database...</Text>
        </View>
      ) : !isSubscribed ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: Theme.spacing.margin }}>
          <View style={styles.barrierContainer}>
            <View style={styles.lockBadge}>
              <Lock size={22} color={Theme.colors.primary} />
            </View>
            <Text style={styles.barrierTitle}>Corporate Plan Required</Text>
            <Text style={styles.barrierDesc}>
              As an organization or wellness sponsor, you need an active subscription plan to activate employee wellness seats, link network practitioners, and track collective health metrics.
            </Text>

            <View style={styles.barrierActions}>
              <TouchableOpacity
                onPress={() => navigation.navigate('Plans', { role: 'org_admin' })}
                style={styles.viewPlansBtn}
              >
                <Text style={styles.viewPlansText}>View Subscription Plans</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Notification Toggle Card */}
          <View style={styles.notificationCard}>
            <View style={styles.notificationLeft}>
              <View style={[styles.notificationIconBox, notificationsEnabled ? styles.notificationActiveIcon : styles.notificationInactiveIcon]}>
                {notificationsEnabled ? (
                  <Bell size={18} color={Theme.colors.primary} />
                ) : (
                  <BellOff size={18} color={Theme.colors.outline} />
                )}
              </View>
              <View>
                <Text style={styles.notificationTitle}>Alerts & Notifications</Text>
                <Text style={styles.notificationDesc}>
                  {notificationsEnabled ? 'Instant updates are turned on' : 'Notifications are paused'}
                </Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={(val) => handleNotificationToggle(val, setNotificationsEnabled)}
              trackColor={{ false: '#E0E0E0', true: Theme.colors.primary + '50' }}
              thumbColor={notificationsEnabled ? Theme.colors.primary : '#F5F5F5'}
            />
          </View>

          {/* Member Therapy Fee Policy Toggle Card */}
          <View style={styles.notificationCard}>
            <View style={styles.notificationLeft}>
              <View style={[styles.notificationIconBox, coverMemberFees ? styles.notificationActiveIcon : styles.notificationInactiveIcon]}>
                <Heart size={18} color={coverMemberFees ? Theme.colors.primary : Theme.colors.outline} />
              </View>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.notificationTitle}>Cover Member Therapy Fees</Text>
                <Text style={styles.notificationDesc}>
                  {coverMemberFees ? 'Free appointments for members with linked therapists' : 'Members pay standard fees for therapists'}
                </Text>
              </View>
            </View>
            <Switch
              value={coverMemberFees}
              onValueChange={handleToggleCoverFees}
              trackColor={{ false: '#E0E0E0', true: Theme.colors.primary + '50' }}
              thumbColor={coverMemberFees ? Theme.colors.primary : '#F5F5F5'}
            />
          </View>

          {/* Bento Grid Stats */}
          <View style={{ position: 'relative' }}>
            <View style={styles.statsGrid}>
              <StatCard
                title="Team Wellness Index"
                value={`${avgTeamMood} / 10`}
                trend={parseFloat(avgTeamMood) >= 6.0 ? 1 : -1}
                trendLabel={parseFloat(avgTeamMood) >= 6.0 ? 'Optimal Zone' : 'Needs Support'}
                icon={<Activity size={18} color={Theme.colors.primary} />}
                color={Theme.colors.primary}
              />
              <StatCard
                title="Active Members"
                value={activeMembers.toString()}
                trend={engagementRate}
                trendLabel={`${engagementRate}% Monthly Engagement`}
                icon={<Users size={18} color={Theme.colors.secondary} />}
                color={Theme.colors.secondary}
              />
            </View>
            {subData?.config?.enableAnalytics === false && (
              <LockedFeatureOverlay 
                title="Wellness Analytics Locked" 
                description="Your current corporate tier does not include mood analytics or tracking." 
                navigation={navigation}
              />
            )}
          </View>

          {/* Seat Allocation tracker & Invite Form */}
          <View style={{ position: 'relative' }}>
            <View style={styles.card}>
              <Text style={styles.sectionHeader}>Seat Allocation Tracker</Text>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>
                  <Text style={styles.boldText}>{seatsUsed}</Text> of {seatsTotal} Corporate Seats Filled
                </Text>
                <Text style={styles.progressPercent}>{fillPercent}%</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${Math.min(fillPercent, 100)}%` }]} />
              </View>
            </View>

            {/* Invite Member Form */}
            <View style={[styles.card, { marginTop: Theme.spacing.sm }]}>
              <Text style={styles.sectionHeader}>Allocate Seats & Invite Members</Text>
              <Text style={styles.sectionDesc}>Enter an institutional or company email to allocate a subscription seat:</Text>
              
              <View style={styles.inviteForm}>
                <TextInput
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="e.g. student@bits-pilani.ac.in"
                  placeholderTextColor={Theme.colors.outline}
                  value={email}
                  onChangeText={setEmail}
                  style={styles.inviteInput}
                />
                <TouchableOpacity 
                  onPress={handleSendInvite} 
                  disabled={loading}
                  style={styles.inviteBtn}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <UserPlus size={16} color="#FFF" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
            {subData?.config?.enableRosterManagement === false && (
              <LockedFeatureOverlay 
                title="Employee Roster Locked" 
                description="Upgrade to allocate institutional seats and invite employees." 
                navigation={navigation}
              />
            )}
          </View>

          {/* Department breakdown Index */}
          <View style={{ position: 'relative' }}>
            <View style={styles.card}>
              <View style={styles.chartHeader}>
                <Building size={18} color={Theme.colors.primary} />
                <Text style={styles.sectionHeader}>Institutional Department Wellness</Text>
              </View>
              <Text style={styles.sectionDesc}>
                Real-time wellness averages aggregated across corporate division registers:
              </Text>

              {departments.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <HelpCircle size={28} color={Theme.colors.outline} />
                  <Text style={styles.emptyText}>No department logs recorded yet.</Text>
                </View>
              ) : (
                <View style={styles.departmentsList}>
                  {departments.map((dept: any) => (
                    <View key={dept.id} style={styles.deptCard}>
                      <View style={styles.deptMainRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.deptName}>{dept.name}</Text>
                          <Text style={styles.deptSub}>
                            {dept.members} Member(s) · {dept.sessions} Session(s)
                          </Text>
                        </View>
                        <View style={styles.moodBadge}>
                          <Text style={styles.moodBadgeVal}>{dept.avgMood} / 10</Text>
                        </View>
                      </View>

                      {dept.burnoutRisk && (
                        <View style={styles.burnoutAlert}>
                          <ShieldAlert size={12} color="#D32F2F" />
                          <Text style={styles.burnoutText}>Warning: Low Mood (Burnout Risk)</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
            {subData?.config?.enableAnalytics === false && (
              <LockedFeatureOverlay 
                title="Department breakdown Locked" 
                description="Your current corporate tier does not include department wellness charts." 
                navigation={navigation}
              />
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12
  },
  loaderText: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.outline
  },
  scrollContent: {
    padding: Theme.spacing.margin,
    paddingBottom: 60,
    gap: Theme.spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionHeader: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.onSurface,
  },
  sectionDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
    marginBottom: Theme.spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: Theme.spacing.xs,
    marginBottom: 6,
  },
  progressLabel: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
  },
  boldText: {
    fontFamily: Theme.fonts.headline,
    color: Theme.colors.onSurface,
  },
  progressPercent: {
    fontFamily: Theme.fonts.display,
    fontSize: 14,
    color: Theme.colors.primary,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: Theme.colors.surfaceLow,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Theme.colors.primary,
  },
  inviteForm: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  inviteInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: Theme.fonts.body,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceLow,
  },
  inviteBtn: {
    width: 48,
    height: 48,
    borderRadius: Theme.radius.lg,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6
  },
  emptyText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.outline
  },
  departmentsList: {
    gap: 10,
    marginTop: Theme.spacing.xs,
  },
  deptCard: {
    backgroundColor: Theme.colors.surfaceLow,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    padding: 12,
    gap: 6
  },
  deptMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  deptName: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
    color: Theme.colors.onSurface
  },
  deptSub: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.outline,
    marginTop: 2
  },
  moodBadge: {
    backgroundColor: '#E6F4F1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  moodBadgeVal: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12,
    color: Theme.colors.primary
  },
  burnoutAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#FFCDD2',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
    marginTop: 2
  },
  burnoutText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 10,
    color: '#D32F2F'
  },
  barrierContainer: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.lg,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    alignItems: 'center',
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    marginTop: 20,
  },
  lockBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  barrierTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 18,
    color: Theme.colors.onSurface,
    textAlign: 'center',
    marginBottom: 8,
  },
  barrierDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  barrierActions: {
    width: '100%',
    alignItems: 'center',
  },
  viewPlansBtn: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Theme.radius.lg,
  },
  viewPlansText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: '#FFF',
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: Theme.spacing.xs,
  },
  notificationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  notificationIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationActiveIcon: {
    backgroundColor: Theme.colors.primary + '12',
  },
  notificationInactiveIcon: {
    backgroundColor: Theme.colors.surfaceLow,
  },
  notificationTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14.5,
    color: Theme.colors.onSurface,
  },
  notificationDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 11.5,
    color: Theme.colors.textMuted,
    marginTop: 1,
  },
});

export default OrgDashboardScreen;
