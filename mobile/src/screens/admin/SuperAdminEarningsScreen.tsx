import React, { useState } from 'react';
import {
  View, StyleSheet, Text, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet, TrendingUp, DollarSign, ChevronDown, ChevronUp, CheckCircle, Banknote } from 'lucide-react-native';
import API from '../../lib/api';
import { Theme } from '../../theme';
import { AppHeader } from '../../components/AppHeader';

interface SuperAdminEarningsScreenProps { navigation?: any; }

export const SuperAdminEarningsScreen: React.FC<SuperAdminEarningsScreenProps> = ({ navigation }) => {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data: therapistData, isLoading } = useQuery({
    queryKey: ['admin-therapist-earnings'],
    queryFn: () => API.admin.pendingTherapists(),
    retry: false,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['admin-therapist-earnings'] });
    setRefreshing(false);
  };

  const therapists: any[] = (therapistData?.therapists ?? []).filter((t: any) =>
    !search || t.name?.toLowerCase().includes(search.toLowerCase()) || t.email?.toLowerCase().includes(search.toLowerCase())
  );

  const totalGross = therapists.reduce((s: number, t: any) => s + (t.grossEarnings ?? 0), 0);
  const totalCommission = therapists.reduce((s: number, t: any) => s + (t.platformCommission ?? 0), 0);
  const totalPayout = therapists.reduce((s: number, t: any) => s + (t.totalPayout ?? 0), 0);
  const totalSessions = therapists.reduce((s: number, t: any) => s + (t.sessionsGiven ?? 0), 0);

  const handleMarkPaid = (therapistId: string, name: string, amount: number) => {
    Alert.prompt(
      'Confirm Payout',
      `Enter admin password to mark ₹${Math.round(amount * 0.70).toLocaleString('en-IN')} payout for ${name}:`,
      async (password) => {
        if (!password) return;
        try {
          await API.admin.markTherapistPaid(therapistId, { password });
          Alert.alert('✅ Done', `Payout recorded for ${name}.`);
          queryClient.invalidateQueries({ queryKey: ['admin-therapist-earnings'] });
        } catch (err: any) {
          Alert.alert('Error', err?.message || 'Could not mark as paid.');
        }
      },
      'secure-text'
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader userFirstName="Admin" role="super_admin" navigation={navigation} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />}
      >
        <Text style={styles.pageTitle}>Booking Earnings</Text>
        <Text style={styles.pageDesc}>Per-therapist booking revenue — tap a card to see individual bookings</Text>

        {/* Platform-wide totals */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { borderColor: '#3b82f630' }]}>
            <DollarSign size={18} color="#3b82f6" />
            <Text style={[styles.statVal, { color: '#3b82f6' }]}>₹{totalGross.toLocaleString('en-IN')}</Text>
            <Text style={styles.statLabel}>Total Gross</Text>
            <Text style={styles.statSub}>{totalSessions} paid sessions</Text>
          </View>
          <View style={[styles.statCard, { borderColor: '#ef444430' }]}>
            <Wallet size={18} color="#ef4444" />
            <Text style={[styles.statVal, { color: '#ef4444' }]}>₹{totalCommission.toLocaleString('en-IN')}</Text>
            <Text style={styles.statLabel}>Platform (30%)</Text>
            <Text style={styles.statSub}>Commission retained</Text>
          </View>
          <View style={[styles.statCard, { borderColor: '#10b98130' }]}>
            <TrendingUp size={18} color="#10b981" />
            <Text style={[styles.statVal, { color: '#10b981' }]}>₹{totalPayout.toLocaleString('en-IN')}</Text>
            <Text style={styles.statLabel}>Payout Due (70%)</Text>
            <Text style={styles.statSub}>To therapists</Text>
          </View>
        </View>

        {/* Loading state */}
        {isLoading && <ActivityIndicator color={Theme.colors.primary} style={{ marginTop: 32 }} />}

        {/* Per-therapist cards */}
        {!isLoading && therapists.map((t: any) => {
          const isExpanded = expandedId === String(t.id);
          const bookings: any[] = t.bookingDetails ?? [];

          return (
            <View key={String(t.id)} style={styles.therapistCard}>
              {/* Summary row */}
              <TouchableOpacity
                onPress={() => setExpandedId(isExpanded ? null : String(t.id))}
                style={styles.cardHeader}
                activeOpacity={0.7}
              >
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{t.name?.charAt(0) ?? 'T'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.therapistName}>{t.name}</Text>
                  <Text style={styles.therapistSub}>{t.email || 'No email'} · {t.sessionsGiven} paid sessions</Text>
                  <Text style={styles.upiText}>
                    UPI: {t.upiId || t.upi || t.paymentDetails?.upiId || 'Not Provided'}
                  </Text>
                </View>
                {isExpanded ? <ChevronUp size={18} color={Theme.colors.textMuted} /> : <ChevronDown size={18} color={Theme.colors.textMuted} />}
              </TouchableOpacity>

              {/* Earnings row */}
              <View style={styles.earningsRow}>
                <View style={styles.earningItem}>
                  <Text style={styles.earningLabel}>Gross</Text>
                  <Text style={styles.earningValWhite}>₹{(t.grossEarnings ?? 0).toLocaleString('en-IN')}</Text>
                </View>
                <View style={styles.earningDivider} />
                <View style={styles.earningItem}>
                  <Text style={styles.earningLabel}>Fee (30%)</Text>
                  <Text style={[styles.earningValWhite, { color: '#ef4444' }]}>-₹{(t.platformCommission ?? 0).toLocaleString('en-IN')}</Text>
                </View>
                <View style={styles.earningDivider} />
                <View style={styles.earningItem}>
                  <Text style={styles.earningLabel}>Payout</Text>
                  <Text style={[styles.earningValWhite, { color: '#10b981' }]}>₹{(t.totalPayout ?? 0).toLocaleString('en-IN')}</Text>
                </View>
              </View>
              <View style={styles.upiContainer}>
                <Text style={styles.upiLabel}>Payout UPI ID</Text>
                <Text style={styles.upiValue}>
                  {t.upiId || t.upi || t.paymentDetails?.upiId || 'Not Provided'}
                </Text>
              </View>

              {/* Mark paid button */}
              {(t.totalPayout ?? 0) > 0 && (
                <TouchableOpacity
                  style={styles.markPaidBtn}
                  onPress={() => handleMarkPaid(String(t.id), t.name, t.grossEarnings)}
                >
                  <Banknote size={14} color="#10b981" />
                  <Text style={styles.markPaidText}>Mark Paid</Text>
                </TouchableOpacity>
              )}

              {/* Expanded booking list */}
              {isExpanded && (
                <View style={styles.bookingList}>
                  <Text style={styles.bookingListTitle}>All Bookings ({bookings.length})</Text>
                  {bookings.length === 0 ? (
                    <Text style={styles.emptyText}>No bookings yet.</Text>
                  ) : (
                    bookings.map((b: any) => {
                      const isEarned = b.status === 'completed' || (b.status === 'confirmed' && b.paid);
                      return (
                        <View key={String(b.id)} style={styles.bookingRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.bookingId}>#{String(b.id).slice(-6)}</Text>
                            <Text style={styles.bookingDate}>
                              {b.date ? new Date(b.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                            </Text>
                          </View>
                          <View style={styles.bookingRight}>
                            <Text style={styles.bookingFee}>₹{(b.fee ?? 0).toLocaleString('en-IN')}</Text>
                            <View style={[styles.statusBadge, {
                              backgroundColor:
                                b.status === 'completed' ? '#dbeafe' :
                                b.status === 'confirmed' ? '#dcfce7' :
                                b.status === 'cancelled' ? '#fee2e2' : '#f1f5f9'
                            }]}>
                              <Text style={[styles.statusText, {
                                color:
                                  b.status === 'completed' ? '#1d4ed8' :
                                  b.status === 'confirmed' ? '#15803d' :
                                  b.status === 'cancelled' ? '#dc2626' : '#64748b'
                              }]}>{b.status.toUpperCase()}</Text>
                            </View>
                            {isEarned && (
                              <Text style={styles.bookingPayout}>₹{Math.round((b.fee ?? 0) * 0.7).toLocaleString('en-IN')}</Text>
                            )}
                          </View>
                        </View>
                      );
                    })
                  )}
                  {/* Booking totals footer */}
                  {bookings.length > 0 && (
                    <View style={styles.bookingFooter}>
                      <Text style={styles.bookingFooterLabel}>Total ({t.sessionsGiven} paid)</Text>
                      <Text style={styles.bookingFooterGross}>₹{(t.grossEarnings ?? 0).toLocaleString('en-IN')}</Text>
                      <Text style={styles.bookingFooterPayout}>→ ₹{(t.totalPayout ?? 0).toLocaleString('en-IN')}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}

        {!isLoading && therapists.length === 0 && (
          <Text style={styles.emptyText}>No therapists with bookings found.</Text>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  scrollContent: { padding: Theme.spacing.margin, paddingBottom: 80, gap: Theme.spacing.md },
  pageTitle: { fontFamily: Theme.fonts.display, fontSize: 22, fontWeight: '800', color: Theme.colors.onSurface },
  pageDesc: { fontFamily: Theme.fonts.body, fontSize: 12, color: Theme.colors.textMuted, marginTop: 2 },

  statsGrid: { flexDirection: 'row', gap: Theme.spacing.sm },
  statCard: {
    flex: 1, backgroundColor: '#FFF', borderRadius: Theme.radius.xl, padding: 12,
    borderWidth: 1.5, alignItems: 'center', gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  statVal: { fontFamily: Theme.fonts.display, fontSize: 15, fontWeight: '800', color: Theme.colors.onSurface, marginTop: 2 },
  statLabel: { fontFamily: Theme.fonts.bodyBold, fontSize: 10, color: Theme.colors.textMuted, textAlign: 'center' },
  statSub: { fontFamily: Theme.fonts.body, fontSize: 9, color: Theme.colors.outline, textAlign: 'center' },

  therapistCard: {
    backgroundColor: '#FFF', borderRadius: Theme.radius.xl, borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Theme.spacing.md },
  avatarCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Theme.colors.primaryContainer + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: Theme.fonts.display, fontSize: 16, fontWeight: '800', color: Theme.colors.primary },
  therapistName: { fontFamily: Theme.fonts.headline, fontSize: 14, color: Theme.colors.onSurface },
  therapistSub: { fontFamily: Theme.fonts.body, fontSize: 11, color: Theme.colors.textMuted, marginTop: 1 },

  earningsRow: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: Theme.colors.surfaceLow,
    paddingVertical: 10, paddingHorizontal: Theme.spacing.md,
  },
  earningItem: { flex: 1, alignItems: 'center' },
  earningDivider: { width: 1, backgroundColor: Theme.colors.surfaceLow },
  earningLabel: { fontFamily: Theme.fonts.body, fontSize: 10, color: Theme.colors.textMuted },
  earningValWhite: { fontFamily: Theme.fonts.display, fontSize: 13, fontWeight: '700', color: Theme.colors.onSurface, marginTop: 2 },

  markPaidBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, margin: 12, marginTop: 0,
    backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0',
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: Theme.radius.full, alignSelf: 'flex-start',
  },
  markPaidText: { fontFamily: Theme.fonts.bodyBold, fontSize: 12, color: '#10b981' },

  bookingList: { borderTopWidth: 1, borderTopColor: Theme.colors.surfaceLow, padding: Theme.spacing.md, gap: 0 },
  bookingListTitle: { fontFamily: Theme.fonts.headline, fontSize: 12, color: Theme.colors.textMuted, marginBottom: 8 },

  bookingRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: Theme.colors.surfaceLow,
  },
  bookingId: { fontFamily: 'monospace', fontSize: 11, color: Theme.colors.outline },
  bookingDate: { fontFamily: Theme.fonts.body, fontSize: 11, color: Theme.colors.textMuted, marginTop: 2 },
  bookingRight: { alignItems: 'flex-end', gap: 3 },
  bookingFee: { fontFamily: Theme.fonts.bodyBold, fontSize: 13, color: Theme.colors.onSurface },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99 },
  statusText: { fontFamily: Theme.fonts.bodyBold, fontSize: 9 },
  bookingPayout: { fontFamily: Theme.fonts.bodyBold, fontSize: 11, color: '#10b981' },

  bookingFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 10, paddingTop: 10, borderTopWidth: 1.5, borderTopColor: Theme.colors.surfaceHigh,
  },
  bookingFooterLabel: { fontFamily: Theme.fonts.headline, fontSize: 12, color: Theme.colors.onSurface, flex: 1 },
  bookingFooterGross: { fontFamily: Theme.fonts.display, fontSize: 13, fontWeight: '700', color: Theme.colors.onSurface },
  bookingFooterPayout: { fontFamily: Theme.fonts.display, fontSize: 13, fontWeight: '700', color: '#10b981', marginLeft: 8 },

  upiText: {
    fontFamily: Theme.fonts.body,
    fontSize: 10,
    color: '#10b981',
    marginTop: 3,
  },
  upiContainer: {
    marginHorizontal: Theme.spacing.md,
    marginBottom: 10,
    padding: 10,
    borderRadius: Theme.radius.lg,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  upiLabel: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 10,
    color: '#065f46',
  },
  upiValue: {
    fontFamily: Theme.fonts.display,
    fontSize: 12,
    color: '#047857',
    marginTop: 2,
  },

  emptyText: { fontFamily: Theme.fonts.body, fontSize: 13, color: Theme.colors.textMuted, textAlign: 'center', paddingVertical: 16 },
});

export default SuperAdminEarningsScreen;
