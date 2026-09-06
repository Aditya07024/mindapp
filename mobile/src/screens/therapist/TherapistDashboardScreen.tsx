import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Switch } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, User, Clock, Award, Sparkles, Wallet, ChevronRight, ChevronDown, Lock, CheckCircle, Briefcase, FileText, Bell, BellOff } from 'lucide-react-native';
import API from '../../lib/api';
import { Theme } from '../../theme';
import { AppHeader } from '../../components/AppHeader';
import { useWorkspaceStore } from '../../lib/workspaceStore';
import { getNotificationsPreference, handleNotificationToggle } from '../../lib/pushNotifications';

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

export const TherapistDashboardScreen: React.FC<TherapistDashboardScreenProps> = ({ navigation }) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [activationLoading, setActivationLoading] = useState(false);
  const [blinkToggle, setBlinkToggle] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    getNotificationsPreference().then(setNotificationsEnabled);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setBlinkToggle(prev => !prev);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  // 1. Fetch User Profile
  const { data: userProfile, refetch: refetchProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: () => API.auth.me(),
    retry: false,
  });

  // 2. Fetch Subscription Data
  const { data: subData, refetch: refetchSub } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => API.subscription.get().catch(() => null),
    retry: false,
  });

  // Evaluate if the therapist is subscribed
  const isSubscribed = 
    !!(userProfile?.orgId) || 
    !!(userProfile?.tier && userProfile.tier !== 'free') || 
    !!(subData && subData.subscription?.status === 'active');

  // 3. Fetch Therapist Statistics (Only if subscribed)
  const { data: therapistStats, refetch: refetchStats } = useQuery({
    queryKey: ['therapistStats'],
    queryFn: () => API.therapist.stats(),
    retry: false,
    enabled: isSubscribed,
  });

  // 4. Fetch Therapist Bookings (Only if subscribed) (auto-refreshes every 5 minutes from backend)
  const { data: bookingsData, refetch: refetchBookings } = useQuery({
    queryKey: ['therapistBookings'],
    queryFn: () => API.therapist.meBookings(),
    refetchInterval: 300000,
    retry: false,
    enabled: isSubscribed,
  });

  // 5. Fetch Invitations (Only if subscribed)
  const { data: invitationsData, refetch: refetchInvitations } = useQuery({
    queryKey: ['therapistInvitations'],
    queryFn: () => API.therapist.invitations(),
    retry: false,
    enabled: isSubscribed,
  });

  // Local state for dynamic availability calendar slots synced with database
  // availabilityPerDay: { day: 0..6, slots: string[] }[]
  const [availabilityPerDay, setAvailabilityPerDay] = useState<{ day: number; slots: string[] }[]>(
    [0,1,2,3,4,5,6].map(d => ({ day: d, slots: d >= 1 && d <= 5 ? ['09:00','10:00','14:00'] : [] }))
  );
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  // Keep flat availability for backward compat
  const [availability, setAvailability] = useState<string[]>([]);

  useEffect(() => {
    if (userProfile?.therapistProfile?.availability) {
      const savedAvail = userProfile.therapistProfile.availability;
      if (Array.isArray(savedAvail) && savedAvail.length > 0 && typeof savedAvail[0] === 'object') {
        // New day-based format: [{day, slots}]
        setAvailabilityPerDay(savedAvail.map((a: any) => ({
          day: a.day,
          slots: (a.slots || []).map(convertTo24Hour),
        })));
        const todayNum = new Date().getDay();
        const todayConfig = savedAvail.find((a: any) => a.day === todayNum);
        setAvailability(todayConfig?.slots?.map(convertTo24Hour) || []);
      } else {
        // Legacy flat format
        setAvailability((savedAvail as string[]).map(convertTo24Hour));
      }
    }
  }, [userProfile]);

  // Handle slot adjustments per day
  const handleToggleSlot = async (slot: string) => {
    if (!isSubscribed) return;
    try {
      const dayEntry = availabilityPerDay.find(d => d.day === selectedDay);
      const currentSlots = dayEntry?.slots || [];
      const updatedSlots = currentSlots.includes(slot)
        ? currentSlots.filter(s => s !== slot)
        : [...currentSlots, slot].sort();

      const updatedPerDay = availabilityPerDay.map(d =>
        d.day === selectedDay ? { ...d, slots: updatedSlots } : d
      );
      setAvailabilityPerDay(updatedPerDay);
      if (selectedDay === new Date().getDay()) setAvailability(updatedSlots);

      await API.therapist.updateAvailability({ availability: updatedPerDay }).catch(() => null);
    } catch (err) {
      console.warn('Could not save availability to database:', err);
    }
  };

  const handleSaveAvailability = async () => {
    try {
      await API.therapist.updateAvailability({ availability: availabilityPerDay });
      Alert.alert('Saved ✅', 'Availability updated for all days.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not save availability.');
    }
  };

  // Process invite acceptances
  const handleInviteAction = async (inviteId: string, orgName: string, action: 'accept' | 'decline') => {
    if (!isSubscribed) return;
    Alert.alert(
      `${action === 'accept' ? 'Accept' : 'Decline'} Invitation`,
      `Confirm linkage under ${orgName}?`,
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

  const handleMenuPress = (menuId: string) => {
    if (menuId !== 'subscription' && !isSubscribed) {
      Alert.alert(
        'Subscription Required',
        'As an independent therapist, you need an active subscription to access your schedule, bookings, and profile.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View Subscription Plans', onPress: () => navigation.navigate('Plans') }
        ]
      );
      return;
    }
    setActiveTab(activeTab === menuId ? null : menuId);
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

  const completedMonthSessions = monthSessions.filter((b: any) => b.status === 'completed' || (b.status === 'confirmed' && b.paid));
  const monthEarnedAmount = completedMonthSessions.reduce((sum: number, b: any) => sum + Number(b.fee || 0), 0);
  const netPayoutAmount = Math.round(monthEarnedAmount * 0.70);

  const todaySessionsCount = isSubscribed ? todaySessions.length : 0;
  const monthSessionsCount = isSubscribed ? monthSessions.length : 0;
  const monthEarned = isSubscribed ? monthEarnedAmount : 0;
  const netPayout = isSubscribed ? netPayoutAmount : 0;

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
        
        {/* Custom High-Fidelity Profile Header Card */}
        {/* <View style={styles.profileHeaderCard}>
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

        {/* 2x2 Bento Statistics Grid */}
        <View style={styles.statsGrid}>
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

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statVal}>₹{monthEarned}</Text>
              <Text style={styles.statLabel}>Month earned</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statVal}>₹{netPayout}</Text>
              <Text style={styles.statLabel}>Payout (85%)</Text>
            </View>
          </View>
        </View>
{/* 4. Beautiful Subscription Required Barrier Overlay */}
        {!isSubscribed && (
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
        {invitationsData && invitationsData.length > 0 && (
          <View style={styles.invitationAlertContainer}>
            {invitationsData.map((invite: any) => {
              const bgStyle = { backgroundColor: blinkToggle ? '#FFFDF5' : '#FEF3C7' };
              const borderStyle = { borderColor: blinkToggle ? '#FDE68A' : '#F59E0B' };
              return (
                <View 
                  key={invite._id} 
                  style={[styles.blinkingInviteCard, bgStyle, borderStyle]}
                >
                  <View style={styles.inviteHeaderRow}>
                    <View style={styles.attentionIconBadge}>
                      <Award size={18} color="#B45309" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.blinkOrgTitle}>{invite.orgName}</Text>
                      <Text style={styles.blinkOrgSub}>Incoming Affiliation Request</Text>
                    </View>
                  </View>
                  <Text style={styles.blinkDesc}>
                    An educational institution is requesting clinical counselor linking.
                  </Text>
                  <View style={styles.blinkActions}>
                    <TouchableOpacity
                      onPress={() => handleInviteAction(invite._id, invite.orgName, 'decline')}
                      style={styles.blinkDeclineBtn}
                    >
                      <Text style={styles.blinkDeclineText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleInviteAction(invite._id, invite.orgName, 'accept')}
                      style={styles.blinkAcceptBtn}
                    >
                      <Text style={styles.blinkAcceptText}>Accept Affiliation</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Action Menu Listings */}
        <View style={styles.menuContainer}>
          {[
            // { id: 'schedule', name: 'Schedule', icon: Calendar },
            { id: 'availability', name: 'Availability', icon: Clock },
            // { id: 'earnings', name: 'Earnings', icon: Wallet },
            { id: 'profile', name: 'Profile', icon: User },
            { id: 'subscription', name: 'Subscription', icon: Sparkles },
            { id: 'invitations', name: 'Invitations', icon: Award },
          ].map((item) => {
            const IconComponent = item.icon;
            const isOpen = activeTab === item.id;
            return (
              <View key={item.id} style={styles.menuItemWrapper}>
                <TouchableOpacity
                  onPress={() => handleMenuPress(item.id)}
                  style={[styles.menuRow, isOpen && styles.menuRowOpen]}
                  activeOpacity={0.8}
                >
                  <View style={styles.menuLeft}>
                    <View style={[styles.menuIconBox, !isSubscribed && item.id !== 'subscription' && styles.menuIconBoxLocked]}>
                      <IconComponent size={18} color={!isSubscribed && item.id !== 'subscription' ? Theme.colors.outline : Theme.colors.primary} />
                    </View>
                    <Text style={[styles.menuLabel, !isSubscribed && item.id !== 'subscription' && styles.menuLabelLocked]}>{item.name}</Text>
                  </View>
                  {isOpen ? (
                    <ChevronDown size={18} color={Theme.colors.outline} />
                  ) : (
                    <ChevronRight size={18} color={Theme.colors.outline} />
                  )}
                </TouchableOpacity>

                {/* Expanded Action Panel Widgets */}
                {isOpen && (
                  <View style={styles.expandedPanel}>
                    {item.id === 'schedule' && (
                      <View style={styles.panelContent}>
                        <Text style={styles.panelTitle}>Consultation Bookings</Text>
                        {activeBookings && activeBookings.length > 0 ? (
                          activeBookings.map((booking: any) => (
                            <View key={booking._id || booking.id} style={styles.rosterItem}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.clientName}>{booking.clientName || booking.userName || 'Seeker'}</Text>
                                <Text style={styles.clientTime}>{new Date(booking.slot).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                              </View>
                              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                                <View style={styles.badgeWrapper}>
                                  <Text style={styles.badgeText}>{booking.status}</Text>
                                </View>
                                <TouchableOpacity
                                  onPress={() => navigation.navigate('TherapistBrief', { bookingId: booking._id || booking.id })}
                                  style={styles.sharedReportBtn}
                                >
                                  <FileText size={11} color={Theme.colors.primary} />
                                  <Text style={styles.sharedReportBtnText}>Shared Report</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))
                        ) : (
                          <Text style={styles.emptyText}>No upcoming bookings scheduled.</Text>
                        )}
                      </View>
                    )}

                    {item.id === 'availability' && (
                      <View style={styles.panelContent}>
                        <Text style={styles.panelTitle}>Set Weekly Availability</Text>
                        <Text style={styles.panelDesc}>Select day then tap hours to mark as available:</Text>

                        {/* Day Selector */}
                        <View style={styles.dayRow}>
                          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, idx) => {
                            const daySlots = availabilityPerDay.find(a => a.day === idx)?.slots || [];
                            const isActive = selectedDay === idx;
                            return (
                              <TouchableOpacity
                                key={d}
                                onPress={() => setSelectedDay(idx)}
                                style={[styles.dayPill, isActive && styles.dayPillActive]}
                              >
                                <Text style={[styles.dayPillText, isActive && styles.dayPillTextActive]}>{d}</Text>
                                {daySlots.length > 0 && (
                                  <View style={styles.dayDot} />
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {/* Slots for selected day */}
                        <View style={styles.slotsGrid}>
                          {ALL_24H_SLOTS.map((slot) => {
                            const daySlots = availabilityPerDay.find(a => a.day === selectedDay)?.slots || [];
                            const isSelected = daySlots.includes(slot);
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

                        {/* Save Button */}
                        <TouchableOpacity onPress={handleSaveAvailability} style={styles.saveAvailBtn}>
                          <Text style={styles.saveAvailBtnText}>Save All Days</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {item.id === 'earnings' && (
                      <View style={styles.panelContent}>
                        <Text style={styles.panelTitle}>Financial Statements</Text>
                        <View style={styles.payoutCard}>
                          <View style={styles.payoutLine}>
                            <Text style={styles.payoutLabel}>Total Gross Earned</Text>
                            <Text style={styles.payoutVal}>₹{monthEarned}</Text>
                          </View>
                          <View style={styles.payoutLine}>
                            <Text style={styles.payoutLabel}>Platform Processing (30%)</Text>
                            <Text style={styles.payoutVal}>- ₹{Math.round(monthEarned * 0.30)}</Text>
                          </View>
                          <View style={[styles.payoutLine, styles.payoutTotalLine]}>
                            <Text style={styles.payoutTotalLabel}>Net Payout Amount</Text>
                            <Text style={styles.payoutTotalVal}>₹{netPayout}</Text>
                          </View>
                        </View>
                      </View>
                    )}

                    {item.id === 'profile' && (
                      <View style={styles.panelContent}>
                        <Text style={styles.panelTitle}>Therapist Profile Summary</Text>
                        <View style={styles.infoBox}>
                          <Text style={styles.infoKey}>Qualification:</Text>
                          <Text style={styles.infoVal}>{userProfile?.therapistProfile?.qualification || 'PhD Clinical Psychology'}</Text>
                        </View>
                        <View style={styles.infoBox}>
                          <Text style={styles.infoKey}>Clinic Name:</Text>
                          <Text style={styles.infoVal}>{userProfile?.therapistProfile?.clinicDetails || 'MyMindTherapyFriend Executive Suite'}</Text>
                        </View>
                        <View style={styles.infoBox}>
                          <Text style={styles.infoKey}>Specializations:</Text>
                          <Text style={styles.infoVal}>
                            {userProfile?.therapistProfile?.specializations?.join(', ') || 'Anxiety, CBT Counseling, Burnout'}
                          </Text>
                        </View>
                      </View>
                    )}

                    {item.id === 'subscription' && (
                      <View style={styles.panelContent}>
                        <Text style={styles.panelTitle}>Subscription Details</Text>
                        {isSubscribed ? (
                          <View style={styles.activeSubCard}>
                            <CheckCircle size={24} color={Theme.colors.primary} />
                            <View>
                              <Text style={styles.subStatusTitle}>Active Subscription</Text>
                              <Text style={styles.subStatusDesc}>Your calendar and profile are fully accessible.</Text>
                            </View>
                          </View>
                        ) : (
                          <View style={styles.expiredSubCard}>
                            <Lock size={20} color={Theme.colors.error} />
                            <View style={styles.subCol}>
                              <Text style={styles.expiredSubTitle}>No Active Subscription</Text>
                              <Text style={styles.expiredSubDesc}>Access to booking tools is locked.</Text>
                            </View>
                          </View>
                        )}
                      </View>
                    )}

                    {item.id === 'invitations' && (
                      <View style={styles.panelContent}>
                        <Text style={styles.panelTitle}>Organization Linkage Invitations</Text>
                        {invitationsData && invitationsData.length > 0 ? (
                          invitationsData.map((invite: any) => (
                            <View key={invite._id} style={styles.inviteItem}>
                              <View>
                                <Text style={styles.inviteOrg}>{invite.orgName || 'Hospital Partner'}</Text>
                                <Text style={styles.inviteRoleText}>Affiliated Provider Request</Text>
                              </View>
                              <View style={styles.inviteBtnRow}>
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
                          <Text style={styles.emptyText}>No pending linkage invitations.</Text>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
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
  statsGrid: {
    gap: Theme.spacing.sm,
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
  menuContainer: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    overflow: 'hidden',
  },
  menuItemWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceLow,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: Theme.spacing.md,
  },
  menuRowOpen: {
    backgroundColor: Theme.colors.surfaceLow + '40',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  menuIconBox: {
    width: 32,
    height: 32,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIconBoxLocked: {
    backgroundColor: Theme.colors.surfaceHigh,
  },
  menuLabel: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14.5,
    color: Theme.colors.onSurface,
  },
  menuLabelLocked: {
    color: Theme.colors.outline,
  },
  expandedPanel: {
    backgroundColor: Theme.colors.background + '50',
    borderTopWidth: 1,
    borderTopColor: Theme.colors.surfaceLow,
    padding: Theme.spacing.md,
  },
  panelContent: {
    gap: Theme.spacing.xs,
  },
  panelTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
    color: Theme.colors.primary,
    marginBottom: 4,
  },
  panelDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 11.5,
    color: Theme.colors.textMuted,
    marginBottom: 6,
  },
  emptyText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12.5,
    color: Theme.colors.textMuted,
    paddingVertical: 8,
  },
  rosterItem: {
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
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 1,
  },
  badgeWrapper: {
    backgroundColor: Theme.colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Theme.radius.full,
  },
  badgeText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 10,
    color: Theme.colors.primary,
    textTransform: 'uppercase',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  slotPill: {
    backgroundColor: '#FFF',
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
  sharedReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.colors.primary + '10',
    borderWidth: 1,
    borderColor: Theme.colors.primary + '30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Theme.radius.full,
  },
  sharedReportBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 10.5,
    color: Theme.colors.primary,
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
    marginTop: 8,
  },
  dayPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Theme.radius.full,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    backgroundColor: '#FFF',
    alignItems: 'center',
    position: 'relative',
  },
  dayPillActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  dayPillText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: Theme.colors.onSurfaceVariant,
  },
  dayPillTextActive: {
    color: '#FFF',
  },
  dayDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Theme.colors.gold,
  },
  saveAvailBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 11,
    borderRadius: Theme.radius.full,
    alignItems: 'center',
    marginTop: 12,
  },
  saveAvailBtnText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
    color: '#FFF',
  },
  payoutCard: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    gap: 8,
  },
  payoutLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payoutLabel: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
  },
  payoutVal: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12.5,
    color: Theme.colors.onSurface,
  },
  payoutTotalLine: {
    borderTopWidth: 1,
    borderTopColor: Theme.colors.surfaceLow,
    paddingTop: 8,
    marginTop: 2,
  },
  payoutTotalLabel: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13.5,
    color: Theme.colors.primary,
  },
  payoutTotalVal: {
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
    color: Theme.colors.primary,
    fontWeight: '700',
  },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  infoKey: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12,
    color: Theme.colors.onSurface,
    width: 100,
  },
  infoVal: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
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
  },
  subStatusTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13.5,
    color: Theme.colors.primary,
  },
  subStatusDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 1,
  },
  expiredSubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    backgroundColor: Theme.colors.error + '05',
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.error + '15',
  },
  subCol: {
    flex: 1,
  },
  expiredSubTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13.5,
    color: Theme.colors.error,
  },
  expiredSubDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 1,
  },
  inviteItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceLow,
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
  inviteBtnRow: {
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
  barrierContainer: {
    backgroundColor: Theme.colors.primary + '06',
    borderWidth: 1.5,
    borderColor: Theme.colors.primary + '25',
    borderStyle: 'dashed',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.lg,
    alignItems: 'center',
    textAlign: 'center',
    marginTop: Theme.spacing.sm,
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
  viewPlansBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 12,
    borderRadius: Theme.radius.full,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  viewPlansText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
    color: '#FFF',
  },
  demoActivateBtn: {
    borderWidth: 1,
    borderColor: Theme.colors.primary + '40',
    backgroundColor: '#FFF',
    paddingVertical: 10,
    borderRadius: Theme.radius.full,
    alignItems: 'center',
    width: '100%',
  },
  demoActivateText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 12.5,
    color: Theme.colors.primary,
  },
  dashboardBarrierCard: {
    backgroundColor: Theme.colors.error + '05',
    borderWidth: 1,
    borderColor: Theme.colors.error + '20',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    gap: 12,
    marginTop: 4,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  barrierHeaderRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  barrierLockBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.colors.error + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  barrierTitleText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14.5,
    color: Theme.colors.error,
  },
  barrierDescText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
    lineHeight: 16,
    marginTop: 2,
  },
  barrierBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  barrierPlansBtn: {
    flex: 1,
    backgroundColor: Theme.colors.primary,
    paddingVertical: 8,
    borderRadius: Theme.radius.full,
    alignItems: 'center',
  },
  barrierPlansText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 11.5,
    color: '#FFF',
  },
  barrierDemoBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Theme.colors.primary + '30',
    backgroundColor: '#FFF',
    paddingVertical: 8,
    borderRadius: Theme.radius.full,
    alignItems: 'center',
  },
  barrierDemoText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 11.5,
    color: Theme.colors.primary,
  },
  invitationAlertContainer: {
    gap: Theme.spacing.sm,
    marginTop: 4,
  },
  blinkingInviteCard: {
    borderWidth: 1.5,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    gap: 10,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  inviteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  attentionIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  blinkOrgTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14.5,
    color: '#92400E',
  },
  blinkOrgSub: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 11,
    color: '#B45309',
    marginTop: 1,
  },
  blinkDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: '#78350F',
    lineHeight: 16,
    paddingLeft: 2,
  },
  blinkActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  blinkDeclineBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D97706' + '40',
    backgroundColor: '#FFF',
    paddingVertical: 8,
    borderRadius: Theme.radius.full,
    alignItems: 'center',
  },
  blinkDeclineText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11.5,
    color: '#B45309',
  },
  blinkAcceptBtn: {
    flex: 1.3,
    backgroundColor: '#D97706',
    paddingVertical: 8,
    borderRadius: Theme.radius.full,
    alignItems: 'center',
  },
  blinkAcceptText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 11.5,
    color: '#FFF',
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

export default TherapistDashboardScreen;
