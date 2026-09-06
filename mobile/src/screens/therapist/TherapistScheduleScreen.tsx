import React, { useState } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Clock, Lock, CheckCircle, ChevronRight, Briefcase, Award } from 'lucide-react-native';
import { useWorkspaceStore } from '../../lib/workspaceStore';
import API from '../../lib/api';
import { Theme } from '../../theme';
import { AppHeader } from '../../components/AppHeader';

const ALL_24H_SLOTS = [
  '00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
];

const convertTo24Hour = (slotStr: string) => {
  if (!slotStr) return '';
  if (!slotStr.includes('AM') && !slotStr.includes('PM')) {
    return slotStr;
  }
  const [time, modifier] = slotStr.split(' ');
  let [hours, minutes] = time.split(':');
  if (hours === '12') {
    hours = '00';
  }
  if (modifier === 'PM') {
    hours = String(parseInt(hours, 10) + 12);
  }
  return `${hours.padStart(2, '0')}:${minutes}`;
};

const formatSlotDisplay = (slot: string) => {
  if (!slot) return '';
  if (slot.includes('AM') || slot.includes('PM')) {
    return slot;
  }
  const [hourStr, minStr] = slot.split(':');
  const hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(displayHour).padStart(2, '0')}:${minStr} ${ampm}`;
};

export const TherapistScheduleScreen: React.FC<TherapistScheduleScreenProps> = ({ navigation }) => {
  const [activationLoading, setActivationLoading] = useState(false);
  const [availability, setAvailability] = useState<string[]>([]);

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

  const { data: bookingsData, refetch: refetchBookings } = useQuery({
    queryKey: ['therapistBookings'],
    queryFn: () => API.therapist.meBookings(),
    retry: false,
    enabled: isSubscribed,
  });

  React.useEffect(() => {
    if (userProfile?.therapistProfile?.availability) {
      const todayNum = new Date().getDay();
      const todayConfig = userProfile.therapistProfile.availability.find((a: any) => a.day === todayNum);
      if (todayConfig?.slots) {
        setAvailability(todayConfig.slots.map(convertTo24Hour));
      }
    }
  }, [userProfile]);

  const handleToggleSlot = async (slot: string) => {
    if (!isSubscribed) return;
    try {
      let updatedSlots = [];
      if (availability.includes(slot)) {
        updatedSlots = availability.filter(s => s !== slot);
        setAvailability(updatedSlots);
        Alert.alert('Slot Removed', `Removed ${formatSlotDisplay(slot)} from availability.`);
      } else {
        updatedSlots = [...availability, slot];
        setAvailability(updatedSlots);
        Alert.alert('Slot Added', `Added ${formatSlotDisplay(slot)} to availability.`);
      }
      await API.therapist.updateAvailability({
        availability: [{ day: new Date().getDay(), slots: updatedSlots }]
      }).catch(() => null);
    } catch (err) {
      console.warn("Could not save availability:", err);
    }
  };

  const { activeWorkspace, setActiveWorkspace } = useWorkspaceStore();

  const activeBookings = (bookingsData?.bookings || []).filter((b: any) => {
    if (!userProfile?.orgId) return true; // Show all if not affiliated
    if (activeWorkspace === 'corporate') {
      return b.clientOrgId === userProfile.orgId;
    } else {
      return b.clientOrgId !== userProfile.orgId;
    }
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);

  const todaySessions = activeBookings.filter((b: any) => {
    const d = new Date(b.slot);
    return d >= todayStart && d <= todayEnd;
  });

  const monthSessions = activeBookings.filter((b: any) => {
    const d = new Date(b.slot);
    return d >= currentMonthStart;
  });

  const todaySessionsCount = isSubscribed ? todaySessions.length : 0;
  const monthSessionsCount = isSubscribed ? monthSessions.length : 0;
  const totalSessionsCount = isSubscribed ? activeBookings.length : 0;
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

        {/* Dynamic Workspace Switcher (Only if affiliated with an organization) */}
        {userProfile?.orgId && (
          <View style={styles.workspaceCard}>
            <Text style={styles.workspaceLabel}>Practice Workspace</Text>
            <View style={styles.switcherContainer}>
              <TouchableOpacity
                onPress={() => setActiveWorkspace('individual')}
                style={[
                  styles.switcherBtn,
                  activeWorkspace === 'individual' && styles.switcherBtnActive
                ]}
              >
                <Briefcase size={14} color={activeWorkspace === 'individual' ? '#FFF' : Theme.colors.primary} />
                <Text style={[
                  styles.switcherBtnText,
                  activeWorkspace === 'individual' && styles.switcherBtnTextActive
                ]}>
                  Individual Practice
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveWorkspace('corporate')}
                style={[
                  styles.switcherBtn,
                  activeWorkspace === 'corporate' && styles.switcherBtnActive
                ]}
              >
                <Award size={14} color={activeWorkspace === 'corporate' ? '#FFF' : Theme.colors.primary} />
                <Text style={[
                  styles.switcherBtnText,
                  activeWorkspace === 'corporate' && styles.switcherBtnTextActive
                ]}>
                  Corporate Affiliation
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 2 Stats Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{todaySessionsCount}</Text>
            <Text style={styles.statLabel}>Today's sessions</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{monthSessionsCount}</Text>
            <Text style={styles.statLabel}>This month</Text>
          </View>
        </View>

        {isSubscribed ? (
          <View style={styles.actionContainer}>
            {/* Set Weekly Availability */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Clock size={18} color={Theme.colors.primary} />
                <Text style={styles.cardTitle}>Availability Calendar</Text>
              </View>
              <Text style={styles.cardDesc}>Tap slots to open/close them for seeker booking:</Text>
              <View style={styles.slotsGrid}>
                {ALL_24H_SLOTS.map((slot) => {
                  const isSelected = availability.includes(slot);
                  return (
                    <TouchableOpacity
                      key={slot}
                      onPress={() => handleToggleSlot(slot)}
                      style={[styles.slotPill, isSelected && styles.slotPillActive]}
                    >
                      <Text style={[styles.slotText, isSelected && styles.textWhite]}>{formatSlotDisplay(slot)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Bookings Schedule */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Calendar size={18} color={Theme.colors.primary} />
                <Text style={styles.cardTitle}>Upcoming Bookings</Text>
              </View>
              {activeBookings && activeBookings.length > 0 ? (
                activeBookings.map((booking: any) => (
                  <View key={booking._id || booking.id} style={styles.bookingRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.clientName}>{booking.clientName || 'Seeker'}</Text>
                      <Text style={styles.clientTime}>{new Date(booking.slot).toLocaleString()}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity 
                        onPress={() => navigation.navigate('TherapistBrief', { bookingId: booking.id, clientId: booking.clientId, clientName: booking.clientName })}
                        style={styles.briefBtn}
                      >
                        <Text style={styles.briefBtnText}>AI Brief</Text>
                      </TouchableOpacity>
                      {(() => {
                        const slotTime = new Date(booking.slot).getTime();
                        const now = Date.now();
                        const isUpcoming = !isNaN(slotTime) && now < (slotTime - 5 * 60 * 1000);
                        const isExpired = !isNaN(slotTime) && now > (slotTime + 60 * 60 * 1000);

                        if (isExpired) {
                          return (
                            <View style={[styles.briefBtn, { backgroundColor: Theme.colors.surfaceHigh }]}>
                              <Text style={[styles.briefBtnText, { color: Theme.colors.textMuted }]}>Completed</Text>
                            </View>
                          );
                        }

                        if (isUpcoming) {
                          return (
                            <TouchableOpacity 
                              onPress={() => Alert.alert('Session Scheduled', `Meeting window opens at scheduled time (${new Date(booking.slot).toLocaleString()}) and stays open for 1 hour.`)}
                              style={[styles.briefBtn, { backgroundColor: Theme.colors.secondary + '40' }]}
                            >
                              <Text style={[styles.briefBtnText, { color: Theme.colors.onSurface }]}>Scheduled</Text>
                            </TouchableOpacity>
                          );
                        }

                        return (
                          <TouchableOpacity 
                            onPress={() => navigation.navigate('Session', { bookingId: booking.id || booking._id, role: 'therapist' })}
                            style={[styles.briefBtn, { backgroundColor: Theme.colors.primary }]}
                          >
                            <Text style={styles.briefBtnText}>Join Session</Text>
                          </TouchableOpacity>
                        );
                      })()}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No bookings scheduled today.</Text>
              )}
            </View>
          </View>
        ) : (
          /* Subscription Required Barrier Overlay */
          <View style={styles.barrierContainer}>
            <View style={styles.lockBadge}>
              <Lock size={22} color={Theme.colors.primary} />
            </View>
            <Text style={styles.barrierTitle}>Subscription Required</Text>
            <Text style={styles.barrierDesc}>
              As an independent therapist, you need an active subscription to access your schedule, bookings, and profile.
            </Text>

            <View style={styles.barrierActions}>
              <TouchableOpacity
                onPress={() => navigation.navigate('Plans')}
                style={styles.viewPlansBtn}
              >
                <Text style={styles.viewPlansText}>View Subscription Plans</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
  statsRow: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    height: 90,
  },
  statVal: {
    fontFamily: Theme.fonts.display,
    fontSize: 26,
    color: Theme.colors.onSurface,
    fontWeight: '700',
  },
  statLabel: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: Theme.spacing.xs - 4,
    textAlign: 'center',
  },
  actionContainer: {
    gap: Theme.spacing.md,
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
  cardDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginBottom: 6,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotPill: {
    backgroundColor: Theme.colors.surfaceLow,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  slotPillActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  slotText: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
  },
  textWhite: {
    color: '#FFF',
  },
  bookingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceLow,
  },
  clientName: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
    color: Theme.colors.onSurface,
  },
  clientTime: {
    fontFamily: Theme.fonts.body,
    fontSize: 11.5,
    color: Theme.colors.textMuted,
    marginTop: 1,
  },
  briefBtn: {
    backgroundColor: Theme.colors.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Theme.radius.full,
  },
  briefBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: '#FFF',
  },
  emptyText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12.5,
    color: Theme.colors.textMuted,
    paddingVertical: 8,
  },
  barrierContainer: {
    backgroundColor: Theme.colors.primary + '06',
    borderWidth: 1.5,
    borderColor: Theme.colors.primary + '25',
    borderStyle: 'dashed',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.lg,
    alignItems: 'center',
    textAlign: 'center',
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
    elevation: 4,
  },
  lockBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  barrierTitle: {
    fontFamily: Theme.fonts.display,
    fontSize: 18,
    color: Theme.colors.primary,
    textAlign: 'center',
    fontWeight: '700',
  },
  barrierDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
    paddingHorizontal: 8,
  },
  barrierActions: {
    width: '100%',
    gap: 8,
    marginTop: Theme.spacing.md,
  },
  workspaceCard: {
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
    marginHorizontal: Theme.spacing.margin,
    marginBottom: Theme.spacing.md,
    gap: 8,
  },
  workspaceLabel: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12.5,
    color: Theme.colors.onSurfaceVariant,
  },
  switcherContainer: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.surfaceLow,
    borderRadius: Theme.radius.full,
    padding: 3,
    gap: 2,
  },
  switcherBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: Theme.radius.full,
  },
  switcherBtnActive: {
    backgroundColor: Theme.colors.primary,
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 1,
  },
  switcherBtnText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 11.5,
    color: Theme.colors.primary,
  },
  switcherBtnTextActive: {
    color: '#FFF',
  },
  viewPlansBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 12,
    borderRadius: Theme.radius.full,
    alignItems: 'center',
    width: '100%',
  },
  viewPlansText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
    color: '#FFF',
  },
});

export default TherapistScheduleScreen;
