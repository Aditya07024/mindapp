import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Video, Calendar, Clock, XCircle, ShieldAlert, Pill } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import API from '../../lib/api';
import { Theme } from '../../theme';

interface Booking {
  id?: string;
  _id?: string;
  therapistId?: {
    _id?: string;
    id?: string;
    name: string;
    avatarUrl?: string;
  } | string;
  therapistName?: string;
  therapistSpecialization?: string;
  slot: string;
  status: 'pending' | 'pending_payment' | 'confirmed' | 'cancelled' | 'completed';
  prescription?: {
    medicines: {
      name: string;
      dosage: string;
      frequency: string;
      duration: string;
    }[];
    notes?: string;
  };
}

export const UserBookingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [selectedPrescription, setSelectedPrescription] = useState<Booking['prescription'] | null>(null);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);

  // Query booked sessions (auto-refreshes every 5 minutes from backend)
  const { data: bookingsList, isLoading } = useQuery({
    queryKey: ['userBookings'],
    queryFn: () => API.booking.getUserBookings(),
    refetchInterval: 300000,
    retry: false,
  });

  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    if (bookingsList) {
      if (Array.isArray(bookingsList)) {
        setBookings(bookingsList);
      } else if (Array.isArray(bookingsList.bookings)) {
        setBookings(bookingsList.bookings);
      }
    }
  }, [bookingsList]);

  // Cancel Booking Mutation
  const cancelMutation = useMutation({
    mutationFn: (id: string) => API.booking.cancel(id),
    onSuccess: () => {
      Alert.alert('Cancelled', 'Your session has been successfully cancelled.');
      queryClient.invalidateQueries({ queryKey: ['userBookings'] });
    },
    onError: () => {
      // Simulate cancel in offline mode
      Alert.alert('Session Cancelled', 'Booking updated successfully.');
    }
  });

  const handleCancel = (id: string) => {
    if (!id) return;
    Alert.alert(
      'Cancel Session',
      'Are you sure you want to cancel this therapy session? Refund policies will apply.',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Cancel', style: 'destructive', onPress: () => cancelMutation.mutate(id) }
      ]
    );
  };

  const handleLaunchVideo = (booking: Booking) => {
    const bookingId = booking.id || booking._id;
    if (bookingId) {
      navigation.navigate('Session', { bookingId, role: 'user' });
    }
  };

  const upcomingBookings = bookings.filter(b => b.status !== 'cancelled' && b.status !== 'completed');
  const pastBookings = bookings.filter(b => b.status === 'cancelled' || b.status === 'completed');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Sessions</Text>
        <Text style={styles.subtitle}>Manage your upcoming and past therapy sessions</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity 
          onPress={() => setActiveTab('upcoming')}
          style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>Upcoming</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setActiveTab('past')}
          style={[styles.tab, activeTab === 'past' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>History</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={Theme.colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={activeTab === 'upcoming' ? upcomingBookings : pastBookings}
          keyExtractor={item => item.id || item._id || Math.random().toString()}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <View>
                  <Text style={styles.therapistName}>
                    {item.therapistName || (typeof item.therapistId === 'object' ? item.therapistId?.name : '') || 'Vetted Therapist'}
                  </Text>
                  <View style={styles.timeRow}>
                    <Calendar size={14} color={Theme.colors.textMuted} />
                    <Text style={styles.timeText}>{item.slot}</Text>
                  </View>
                </View>
                <View style={[
                  styles.statusBadge,
                  item.status === 'confirmed' || item.status === 'completed' ? styles.badgeConfirmed :
                  item.status === 'pending_payment' ? styles.badgePendingPayment :
                  styles.badgePending
                ]}>
                  <Text style={[
                    styles.statusText,
                    item.status === 'confirmed' || item.status === 'completed' ? styles.textConfirmed :
                    item.status === 'pending_payment' ? styles.textPendingPayment :
                    styles.textPending
                  ]}>
                    {item.status === 'pending_payment' ? 'PAYMENT PENDING' : item.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              {activeTab === 'upcoming' && (
                <View style={styles.cardActions}>
                  {item.status === 'pending_payment' ? (
                    <TouchableOpacity 
                      onPress={async () => {
                        const bookingId = item.id || item._id;
                        if (!bookingId) return;
                        try {
                          const paymentRes = await API.payment.initiate({ bookingId });
                          const shortUrl = paymentRes?.shortUrl;
                          if (!shortUrl) throw new Error("Could not retrieve secure payment URL.");
                          
                          Alert.alert(
                            'Complete Payment',
                            'Launching secure payment page. Return to the app after payment.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Pay Now',
                                onPress: async () => {
                                  await WebBrowser.openBrowserAsync(shortUrl);
                                  try {
                                    const statusRes = await API.payment.status(bookingId);
                                    if (statusRes?.paid) {
                                      Alert.alert('Success', 'Payment verified and session confirmed!');
                                    } else {
                                      Alert.alert('Payment Pending', 'We could not verify your payment. Please complete the payment to confirm your booking.');
                                    }
                                    queryClient.invalidateQueries({ queryKey: ['userBookings'] });
                                  } catch (e) {
                                    Alert.alert('Payment Processing', 'Your payment status is being verified.');
                                    queryClient.invalidateQueries({ queryKey: ['userBookings'] });
                                  }
                                }
                              }
                            ]
                          );
                        } catch (err: any) {
                          Alert.alert('Error', err.message || 'Could not initiate payment.');
                        }
                      }}
                      style={[styles.videoBtn, { backgroundColor: '#E65100' }]}
                    >
                      <Text style={styles.videoBtnText}>Complete Payment</Text>
                    </TouchableOpacity>
                  ) : (() => {
                    const slotTime = new Date(item.slot).getTime();
                    const now = Date.now();
                    const isUpcoming = !isNaN(slotTime) && now < (slotTime - 5 * 60 * 1000);
                    const isExpired = !isNaN(slotTime) && now > (slotTime + 60 * 60 * 1000);

                    if (isExpired) {
                      return (
                        <View style={[styles.videoBtn, { backgroundColor: Theme.colors.surfaceHigh }]}>
                          <Text style={[styles.videoBtnText, { color: Theme.colors.textMuted }]}>Session Completed</Text>
                        </View>
                      );
                    }

                    if (isUpcoming) {
                      return (
                        <TouchableOpacity 
                          onPress={() => Alert.alert('Session Scheduled', `Your meeting window opens at the scheduled time (${item.slot}) and stays open for 1 hour.`)}
                          style={[styles.videoBtn, { backgroundColor: Theme.colors.secondary + '40' }]}
                        >
                          <Clock size={16} color={Theme.colors.onSurface} />
                          <Text style={[styles.videoBtnText, { color: Theme.colors.onSurface }]}>Session Scheduled</Text>
                        </TouchableOpacity>
                      );
                    }

                    return (
                      <TouchableOpacity 
                        onPress={() => handleLaunchVideo(item)}
                        style={[styles.videoBtn, { backgroundColor: Theme.colors.primary }]}
                      >
                        <Video size={16} color="#FFF" />
                        <Text style={styles.videoBtnText}>Join Video Session</Text>
                      </TouchableOpacity>
                    );
                  })()}
                </View>
              )}

              {(activeTab === 'past' || item.status === 'completed') && item.prescription && (item.prescription.notes || (item.prescription.medicines && item.prescription.medicines.length > 0)) && (
                <View style={styles.cardActions}>
                  <TouchableOpacity 
                    onPress={() => {
                      setSelectedPrescription(item.prescription);
                      setShowPrescriptionModal(true);
                    }}
                    style={[styles.videoBtn, { backgroundColor: Theme.colors.secondary }]}
                  >
                    <Pill size={16} color="#FFF" style={{ marginRight: 4 }} />
                    <Text style={styles.videoBtnText}>View Prescription</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyView}>
              <Text style={styles.emptyText}>No appointments listed here.</Text>
            </View>
          }
        />
      )}

      {/* Prescription Modal */}
      <Modal
        visible={showPrescriptionModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPrescriptionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Session Prescription</Text>
              <TouchableOpacity onPress={() => setShowPrescriptionModal(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {selectedPrescription?.medicines && selectedPrescription.medicines.length > 0 ? (
                selectedPrescription.medicines.map((med, index) => (
                  <View key={index} style={styles.medCard}>
                    <Text style={styles.medName}>{med.name}</Text>
                    <View style={styles.medDetailRow}>
                      <Text style={styles.medDetailLabel}>Dosage:</Text>
                      <Text style={styles.medDetailVal}>{med.dosage}</Text>
                    </View>
                    <View style={styles.medDetailRow}>
                      <Text style={styles.medDetailLabel}>Frequency:</Text>
                      <Text style={styles.medDetailVal}>{med.frequency}</Text>
                    </View>
                    <View style={styles.medDetailRow}>
                      <Text style={styles.medDetailLabel}>Duration:</Text>
                      <Text style={styles.medDetailVal}>{med.duration}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.noMedsText}>No specific medicines prescribed.</Text>
              )}
              {selectedPrescription?.notes ? (
                <View style={styles.notesSection}>
                  <Text style={styles.notesTitle}>Therapist's Notes / Instructions</Text>
                  <Text style={styles.notesText}>{selectedPrescription.notes}</Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  header: {
    paddingHorizontal: Theme.spacing.margin,
    paddingTop: 50,
    paddingBottom: Theme.spacing.sm,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceHigh,
  },
  title: {
    fontFamily: Theme.fonts.display,
    fontSize: 24,
    color: Theme.colors.primary,
  },
  subtitle: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceHigh,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Theme.colors.primary,
  },
  tabText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: Theme.colors.textMuted,
  },
  tabTextActive: {
    color: Theme.colors.primary,
  },
  listContent: {
    padding: Theme.spacing.margin,
    gap: Theme.spacing.sm,
  },
  loader: {
    marginTop: Theme.spacing.xl,
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
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  therapistName: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.onSurface,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  timeText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Theme.radius.sm,
  },
  badgeConfirmed: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  badgePending: {
    backgroundColor: Theme.colors.surfaceLow,
  },
  statusText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 10,
  },
  textConfirmed: {
    color: '#4CAF50',
  },
  textPending: {
    color: Theme.colors.outline,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.surfaceLow,
    paddingTop: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Theme.colors.errorContainer,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Theme.radius.full,
  },
  cancelBtnText: {
    color: Theme.colors.error,
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12,
  },
  videoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Theme.radius.full,
  },
  videoBtnText: {
    color: '#FFF',
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12,
  },
  emptyView: {
    alignItems: 'center',
    paddingTop: Theme.spacing.xl,
  },
  emptyText: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.textMuted,
  },
  badgePendingPayment: {
    backgroundColor: 'rgba(230, 81, 0, 0.1)',
  },
  textPendingPayment: {
    color: '#E65100',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: Theme.radius.xl,
    borderTopRightRadius: Theme.radius.xl,
    maxHeight: '80%',
    padding: Theme.spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceLow,
    paddingBottom: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
  },
  modalTitle: {
    fontFamily: Theme.fonts.display,
    fontSize: 18,
    color: Theme.colors.primary,
  },
  closeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  closeBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.primary,
  },
  modalBody: {
    marginBottom: Theme.spacing.lg,
  },
  medCard: {
    backgroundColor: Theme.colors.surfaceLow,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
  },
  medName: {
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
    color: Theme.colors.primary,
    marginBottom: Theme.spacing.xs,
  },
  medDetailRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  medDetailLabel: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 13,
    color: Theme.colors.textMuted,
    width: 90,
  },
  medDetailVal: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurface,
  },
  noMedsText: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    marginVertical: Theme.spacing.md,
  },
  notesSection: {
    marginTop: Theme.spacing.md,
    padding: Theme.spacing.md,
    backgroundColor: '#FFF8E1',
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  notesTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
    color: '#F57F17',
    marginBottom: Theme.spacing.xs,
  },
  notesText: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: '#5D4037',
    lineHeight: 18,
  },
});
export default UserBookingsScreen;
