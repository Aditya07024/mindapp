import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Image, Alert, Switch, Linking } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Flame, Star, Compass, BookOpen, Search, Calendar, MessageSquare, AlertCircle, LogOut, Sparkles, Wallet, FileText, Bell, BellOff, MessageCircle, ChevronRight } from 'lucide-react-native';
import API from '../../lib/api';
import { Theme } from '../../theme';
import { useStore } from '../../lib/store';
import { AppHeader } from '../../components/AppHeader';
import { SOSButton } from '../../components/SOSButton';
import { CrisisOverlay } from '../../components/CrisisOverlay';
import { getNotificationsPreference, handleNotificationToggle } from '../../lib/pushNotifications';

interface DashboardScreenProps {
  navigation: any;
}
import { useAuth, useUser } from '@clerk/clerk-expo';

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const { signOut } = useAuth();
  const { user } = useUser();
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [crisisOpen, setCrisisOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    getNotificationsPreference().then(setNotificationsEnabled);
  }, []);

  // Fetch stats from backend API
  const { data: userStats } = useQuery({
    queryKey: ['userDashboardStats'],
    queryFn: () => API.user.stats(),
    retry: false,
  });

  // Fetch user profile from backend API for tier
  const { data: profileData } = useQuery({
    queryKey: ['userProfile'],
    queryFn: () => API.user.profile(),
    retry: false,
  });

  const storeFirstName = useStore(state => state.firstName);
  const firstName = profileData?.user?.fullName?.split(" ")[0] || user?.firstName || storeFirstName || 'Friend';

  // Fetch bookings dynamically
  const { data: bookingsData } = useQuery({
    queryKey: ['userBookings'],
    queryFn: () => API.booking.getUserBookings(),
    retry: false,
  });

  // Fetch daily journal prompt
  const { data: promptData } = useQuery({
    queryKey: ['dailyCbtPrompt'],
    queryFn: () => API.journal.prompt(),
    retry: false,
  });

  const streak = userStats?.streak ?? 0;
  const tierRaw = profileData?.user?.tier || 'free';
  const tier = tierRaw === 'apna_therapist' ? 'Apna Therapist' : tierRaw === 'mann_shanti' ? 'Mann Shanti' : 'Free Tier';

  const dailyPrompt = promptData?.prompt || "What is one thought you had today that felt absolute, but might actually have nuance?";

  // Find closest upcoming session
  const bookings = bookingsData?.bookings || [];
  const upcomingBooking = bookings
    .filter((b: any) => (b.status === 'confirmed' || b.status === 'pending') && new Date(b.slot) > new Date())
    .sort((a: any, b: any) => new Date(a.slot).getTime() - new Date(b.slot).getTime())[0];

  const formatSlotTime = (slotStr: string) => {
    const d = new Date(slotStr);
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleMoodSelect = async (moodVal: number) => {
    setSelectedMood(moodVal);
    try {
      await API.mood.create({ score: moodVal, notes: "Logged from user dashboard" });
      Alert.alert('Mood Saved', 'Thank you for checking in. We have updated your daily pattern logs.');
    } catch (e) {
      console.warn("Failed to post mood to backend, saving locally:", e);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        userFirstName={firstName}
        role="user"
        onUpgradePress={() => navigation.navigate('Plans')}
        navigation={navigation}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Streak & Greeting */}
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greetText}>Good morning, {firstName}</Text>
            <Text style={styles.subGreetText}>Here is your daily check-in.</Text>
          </View>

          <View style={styles.streakBadge}>
            <Flame size={16} color={Theme.colors.gold} fill={Theme.colors.gold} />
            <Text style={styles.streakText}>{streak} Day Streak</Text>
            <View style={styles.verticalDivider} />
            <Text style={styles.tierText}>{tier}</Text>
          </View>
        </View>

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

        {/* Manas Chat Hero Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Manas is here</Text>
          <Text style={styles.heroDesc}>
            I noticed you've had a busy week. Would you like to do a quick 5-minute breathing exercise together?
          </Text>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Chat')} 
            style={styles.heroBtn}
          >
            <Text style={styles.heroBtnText}>Start Chat</Text>
          </TouchableOpacity>
        </View>

        {/* Today's Mood Selector */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How are you feeling today?</Text>
          <View style={styles.moodEmojiRow}>
            {[
              { val: 1, emoji: '😞' },
              { val: 2, emoji: '😟' },
              { val: 3, emoji: '😕' },
              { val: 4, emoji: '😐' },
              { val: 5, emoji: '🙂' },
              { val: 6, emoji: '😊' },
              { val: 7, emoji: '🥰' },
            ].map(item => (
              <TouchableOpacity
                key={item.val}
                onPress={() => handleMoodSelect(item.val)}
                style={[
                  styles.moodEmojiBtn,
                  selectedMood === item.val && styles.moodEmojiActive
                ]}
              >
                <Text style={styles.emojiText}>{item.emoji}</Text>
                {selectedMood === item.val && <View style={styles.activeDot} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Actions Grid */}
        <View style={styles.quickGrid}>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Breathe')}
            style={styles.quickBtn}
          >
            <View style={[styles.quickIconBox, { backgroundColor: Theme.colors.primary + '10' }]}>
              <Compass size={22} color={Theme.colors.primary} />
            </View>
            <Text style={styles.quickLabel}>Breathe</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => navigation.navigate('Journal')}
            style={styles.quickBtn}
          >
            <View style={[styles.quickIconBox, { backgroundColor: Theme.colors.primary + '10' }]}>
              <BookOpen size={22} color={Theme.colors.primary} />
            </View>
            <Text style={styles.quickLabel}>CBT Journal</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => navigation.navigate('Therapists')}
            style={styles.quickBtn}
          >
            <View style={[styles.quickIconBox, { backgroundColor: Theme.colors.primary + '10' }]}>
              <Search size={22} color={Theme.colors.primary} />
            </View>
            <Text style={styles.quickLabel}>Find Therapist</Text>
          </TouchableOpacity>
        </View>

        {/* Wallet & Reports Row */}
        <View style={styles.quickGrid}>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Wallet')}
            style={styles.quickBtn}
          >
            <View style={[styles.quickIconBox, { backgroundColor: Theme.colors.primary + '10' }]}>
              <Wallet size={22} color={Theme.colors.primary} />
            </View>
            <Text style={styles.quickLabel}>My Wallet</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => navigation.navigate('Reports')}
            style={styles.quickBtn}
          >
            <View style={[styles.quickIconBox, { backgroundColor: Theme.colors.primary + '10' }]}>
              <FileText size={22} color={Theme.colors.primary} />
            </View>
            <Text style={styles.quickLabel}>Reports</Text>
          </TouchableOpacity>
        </View>

        {/* Upcoming Session */}
        {upcomingBooking ? (
          <View style={[styles.card, styles.sessionBorder]}>
            <View style={styles.sessionHeader}>
              <Text style={styles.sessionPre}>UPCOMING SESSION</Text>
              <View style={[styles.timerBadge, upcomingBooking.status === 'pending' && { backgroundColor: Theme.colors.surfaceHigh }]}>
                <Text style={[styles.timerText, upcomingBooking.status === 'pending' && { color: Theme.colors.onSurfaceVariant }]}>
                  {upcomingBooking.status.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.therapistRow}>
              <View style={[styles.therapistAvatar, { backgroundColor: Theme.colors.primaryContainer + '20', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ fontSize: 20 }}>🧑‍⚕️</Text>
              </View>
              <View>
                <Text style={styles.therapistName}>{upcomingBooking.therapistName}</Text>
                <Text style={styles.therapistSpecialty}>
                  {upcomingBooking.therapistSpecialization || 'Clinical Psychologist'} • {formatSlotTime(upcomingBooking.slot)}
                </Text>
              </View>
            </View>

            <TouchableOpacity 
              onPress={() => navigation.navigate('Session', { bookingId: upcomingBooking._id || upcomingBooking.id, role: 'user' })}
              style={styles.joinBtn}
            >
              <Text style={styles.joinText}>Join Session</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.card, styles.emptySessionCard]}>
            <View style={styles.emptySessionIconBox}>
              <Calendar size={24} color={Theme.colors.primary} />
            </View>
            <Text style={styles.emptySessionTitle}>No upcoming therapy sessions</Text>
            <Text style={styles.emptySessionDesc}>
              Connect with one of our verified Indian mental health practitioners today.
            </Text>
            <TouchableOpacity 
              onPress={() => navigation.navigate('Therapists')}
              style={styles.bookSessionBtn}
            >
              <Text style={styles.bookSessionText}>Book a Session</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Today's Journal Prompt */}
        <View style={[styles.card, styles.promptCard]}>
          <Text style={styles.promptHeader}>TODAY'S PROMPT</Text>
          <Text style={styles.promptText}>
            {dailyPrompt}
          </Text>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Journal')}
            style={styles.writeTrigger}
          >
            <Text style={styles.writeTriggerText}>Write in Journal</Text>
            <BookOpen size={14} color={Theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Message Counters */}
        <TouchableOpacity 
            onPress={() => navigation.navigate('Chat')} 
          >
        <View style={styles.messageCounterCard}>
          <View style={styles.msgLeft}>
            <View style={styles.msgIconBox}>
              <MessageSquare size={20} color={Theme.colors.onSurfaceVariant} />
            </View>
            <Text style={styles.msgText}>Conversations with Manas</Text>
          </View>
          <View style={styles.counterBadge}>
            <Text style={styles.counterText}>{userStats?.chatCount ?? 0}</Text>
          </View>
        </View>
        </TouchableOpacity>

        {/* WhatsApp Community Group Card */}
        <View style={styles.whatsappCard}>
          <View style={styles.whatsappHeader}>
            <View style={styles.whatsappIconBox}>
              <MessageCircle size={22} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.whatsappTitle}>MyMindFriend Community</Text>
              <Text style={styles.whatsappSubtitle}>
                Connect with peers, share experiences & get daily support in our official WhatsApp group.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.whatsappBtn}
            onPress={() => Linking.openURL('https://chat.whatsapp.com/CbMYSt00R0KDEdiEsp9IeL')}
            activeOpacity={0.8}
          >
            <Text style={styles.whatsappBtnText}>Join WhatsApp Group</Text>
            <ChevronRight size={16} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity 
          style={styles.logoutBtn}
          onPress={() => {
            signOut().then(() => {
              navigation.replace('Landing');
            });
          }}
        >
          <LogOut size={20} color={Theme.colors.error} />
          <Text style={styles.logoutBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* SOS FAB and Modal */}
      <SOSButton onPress={() => setCrisisOpen(true)} bottomOffset={20} />
      <CrisisOverlay open={crisisOpen} onClose={() => setCrisisOpen(false)} />
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
    paddingBottom: 120,
    gap: Theme.spacing.md,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: Theme.spacing.xs,
  },
  greetText: {
    fontFamily: Theme.fonts.display,
    fontSize: 24,
    color: Theme.colors.onSurface,
  },
  subGreetText: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Theme.colors.surfaceLow,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Theme.radius.full,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
  },
  streakText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12,
    color: Theme.colors.onSurface,
  },
  verticalDivider: {
    width: 1,
    height: 12,
    backgroundColor: Theme.colors.outlineVariant,
  },
  tierText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: Theme.colors.primary,
    backgroundColor: Theme.colors.primary + '15',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Theme.radius.sm,
  },
  heroCard: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 15,
    elevation: 4,
  },
  heroTitle: {
    fontFamily: Theme.fonts.display,
    fontSize: 22,
    color: '#FFF',
    marginBottom: Theme.spacing.xs,
  },
  heroDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
    marginBottom: Theme.spacing.md,
  },
  heroBtn: {
    backgroundColor: '#FFF',
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Theme.radius.full,
  },
  heroBtnText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
    color: Theme.colors.primary,
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
  cardTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.onSurface,
    marginBottom: Theme.spacing.sm,
  },
  moodEmojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
  },
  moodEmojiBtn: {
    width: 38,
    height: 38,
    borderRadius: Theme.radius.default,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceLow,
  },
  moodEmojiActive: {
    backgroundColor: Theme.colors.secondaryContainer + '30',
    borderColor: Theme.colors.secondary,
    borderWidth: 1,
  },
  emojiText: {
    fontSize: 22,
  },
  activeDot: {
    position: 'absolute',
    bottom: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Theme.colors.secondary,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    paddingVertical: Theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  quickIconBox: {
    width: 44,
    height: 44,
    borderRadius: Theme.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickLabel: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: Theme.colors.onSurface,
  },
  sessionBorder: {
    borderTopWidth: 4,
    borderTopColor: Theme.colors.primary,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  sessionPre: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: Theme.colors.textMuted,
    letterSpacing: 0.5,
  },
  timerBadge: {
    backgroundColor: Theme.colors.errorContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Theme.radius.sm,
  },
  timerText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 10,
    color: Theme.colors.onErrorContainer,
  },
  therapistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
  },
  therapistAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  therapistName: {
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
    color: Theme.colors.onSurface,
  },
  therapistSpecialty: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
  },
  joinBtn: {
    backgroundColor: Theme.colors.primary,
    height: 44,
    borderRadius: Theme.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinText: {
    color: '#FFF',
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
  },
  emptySessionCard: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Theme.colors.surfaceHigh,
  },
  emptySessionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.xs,
  },
  emptySessionTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
    color: Theme.colors.onSurface,
    marginBottom: 4,
  },
  emptySessionDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Theme.spacing.md,
    lineHeight: 16,
    marginBottom: Theme.spacing.sm,
  },
  bookSessionBtn: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Theme.radius.full,
  },
  bookSessionText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 12,
    color: '#FFF',
  },
  promptCard: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Theme.colors.primary + '30',
  },
  promptHeader: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: Theme.colors.primary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  promptText: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurface,
    lineHeight: 20,
    marginBottom: Theme.spacing.sm,
  },
  writeTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  writeTriggerText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: Theme.colors.primary,
  },
  messageCounterCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.sm + 4,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
  },
  msgLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  msgIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.surfaceLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  msgText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  counterBadge: {
    backgroundColor: Theme.colors.secondary,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterText: {
    color: '#FFF',
    fontFamily: Theme.fonts.headline,
    fontSize: 11,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    backgroundColor: Theme.colors.error + '15',
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radius.lg,
    marginTop: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.error + '30',
  },
  logoutBtnText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
    color: Theme.colors.error,
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
  whatsappCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    gap: 12,
  },
  whatsappHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  whatsappIconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  whatsappTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
    color: '#1B5E20',
  },
  whatsappSubtitle: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: '#2E7D32',
    lineHeight: 17,
    marginTop: 2,
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2E7D32',
    borderRadius: Theme.radius.lg,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  whatsappBtnText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13.5,
    color: '#FFF',
  },
});
export default DashboardScreen;
