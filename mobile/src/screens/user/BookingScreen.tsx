import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useQuery } from '@tanstack/react-query';
import { Calendar as CalendarIcon, Clock, CreditCard, ChevronRight } from 'lucide-react-native';
import API from '../../lib/api';

import { Theme } from '../../theme';
import { TherapistData } from '../../components/TherapistCard';

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

interface BookingScreenProps {
  navigation: any;
  route: any;
}

export const BookingScreen: React.FC<BookingScreenProps> = ({ navigation, route }) => {
  const therapist: TherapistData = route.params?.therapist;

  const therapistId = therapist?.id || therapist?._id;

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [loading, setLoading] = useState(false);

  // Generate next 7 days for the calendar date picker
  const [days, setDays] = useState<{ dateStr: string; dayName: string; dayNum: number }[]>([]);

  useEffect(() => {
    const list = [];
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dayVal = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${dayVal}`;
      list.push({
        dateStr,
        dayName: weekdays[d.getDay()],
        dayNum: d.getDate(),
      });
    }
    setDays(list);
    // Auto select first day
    if (list.length > 0) setSelectedDate(list[0].dateStr);
  }, []);

  // Fetch slot availability from backend API
  const { data: remoteSlots, isLoading: slotsLoading } = useQuery({
    queryKey: ['availability', therapistId, selectedDate],
    queryFn: () => API.therapist.availability(therapistId, { date: selectedDate }),
    enabled: !!therapistId && !!selectedDate,
    retry: false,
  });

  const todayStr = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();
  const isToday = selectedDate === todayStr;

  const slots = (remoteSlots?.openSlots || []).filter((s: string) => {
    if (!isToday) return true;
    const [hours, minutes] = s.split(':');
    const now = new Date();
    const slotTime = new Date();
    slotTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    return slotTime > now;
  });

    const handleBooking = async () => {
      if (!selectedSlot) {
        Alert.alert('Slot Required', 'Please select an hour slot to book your session.');
        return;
      }

      const [hours, minutes] = selectedSlot.split(':');
      const dateTime = new Date(selectedDate);
      dateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

      console.log("[Booking] Initiating booking for slot:", dateTime.toISOString(), "with therapist:", therapistId);
      setLoading(true);
      try {
        // 1. Create booking in backend
        const bookingPayload = {
          therapistId: therapistId,
          slot: dateTime.toISOString(),
        };
        console.log("[Booking] Sending booking payload:", JSON.stringify(bookingPayload));
        const bookingRes = await API.booking.create(bookingPayload);
        console.log("[Booking] Booking response received:", JSON.stringify(bookingRes, null, 2));

        const bookingId = bookingRes?.booking?.id || bookingRes?.booking?._id || bookingRes?.id || bookingRes?._id;
        console.log("[Booking] Resolved bookingId:", bookingId);

        if (!bookingId) {
          console.error("[Booking] Error: No bookingId resolved!");
          throw new Error("Could not retrieve secure booking ID.");
        }

        // Check if booking is free (covered by organization benefits or active plan)
        const isFreeOrPaid = bookingRes?.booking?.payment?.paid || bookingRes?.booking?.payment?.amount === 0 || bookingRes?.booking?.status === 'confirmed';
        if (isFreeOrPaid) {
          setLoading(false);
          Alert.alert('Session Confirmed!', 'Your booking has been confirmed under your organization benefits.');
          navigation.replace('UserTabs', { screen: 'Bookings' });
          return;
        }

        // 2. Initiate Razorpay Payment Link (returns short_url — hosted Razorpay page)
        console.log("[Booking] Initiating payment link for bookingId:", bookingId);
        const paymentRes = await API.payment.initiate({ bookingId });
        console.log("[Booking] Payment link response received:", JSON.stringify(paymentRes, null, 2));
        const shortUrl = paymentRes?.shortUrl;
        console.log("[Booking] Extracted shortUrl:", shortUrl);

        if (!shortUrl) {
          console.error("[Booking] Error: No shortUrl found in payment link response!");
          throw new Error("Could not retrieve secure payment URL from Razorpay.");
        }

        // 3. Open Razorpay hosted page directly in the browser (NO Alert wrapper — avoids async-in-Alert bug)
        setLoading(false);
        console.log("[Booking] Launching browser for shortUrl:", shortUrl);
        await WebBrowser.openBrowserAsync(shortUrl);

        // 4. After browser closes, verify & confirm booking
        try {
          setLoading(true);
          console.log("[Booking] Checking payment status...");
          const statusRes = await API.payment.status(bookingId);
          console.log("[Booking] Payment status response:", JSON.stringify(statusRes, null, 2));

          if (statusRes?.paid) {
            Alert.alert('Session Confirmed!', 'Your booking has been confirmed successfully.');
            navigation.replace('UserTabs', { screen: 'Bookings' });
          } else {
            Alert.alert(
              'Payment Pending',
              'We could not verify your payment. Please complete the payment to confirm your booking.',
              [{ text: 'OK', onPress: () => navigation.replace('UserTabs', { screen: 'Bookings' }) }]
            );
          }
        } catch (verifyErr) {
          // Booking status check failed
          console.warn("[Booking] Payment status check failed:", verifyErr);
          Alert.alert(
            'Booking Registered',
            'Your payment status is being verified. Please check the Bookings tab for updates.',
            [{ text: 'OK', onPress: () => navigation.replace('UserTabs', { screen: 'Bookings' }) }]
          );
        } finally {
          setLoading(false);
        }

      } catch (err: any) {
        console.error("[Booking] Booking flow failed with error:", err);
        if (err instanceof Error) {
          console.error("[Booking] Error details:", err.name, "|", err.message, "|", err.stack);
        }
        Alert.alert(
          'Payment Error',
          err?.message || 'Could not initiate payment. Please check your connection and try again.',
          [{ text: 'OK' }]
        );
      } finally {
        setLoading(false);
      }
    };


  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Book Appointment</Text>
        <Text style={styles.subtitle}>With {therapist?.name}</Text>
      </View>

      {/* Date Picker Picker */}
      <View style={styles.section}>
        <View style={styles.secTitleRow}>
          <CalendarIcon size={16} color={Theme.colors.primary} />
          <Text style={styles.secTitle}>Select Date</Text>
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateRow}>
          {days.map(d => {
            const active = selectedDate === d.dateStr;
            return (
              <TouchableOpacity
                key={d.dateStr}
                onPress={() => {
                  setSelectedDate(d.dateStr);
                  setSelectedSlot('');
                }}
                style={[
                  styles.dateBtn,
                  active && styles.dateBtnActive
                ]}
              >
                <Text style={[styles.dayName, active && styles.textWhite]}>{d.dayName}</Text>
                <Text style={[styles.dayNum, active && styles.textWhite]}>{d.dayNum}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Time Slot Picker */}
      <View style={styles.section}>
        <View style={styles.secTitleRow}>
          <Clock size={16} color={Theme.colors.primary} />
          <Text style={styles.secTitle}>Select Hour</Text>
        </View>

        {slotsLoading ? (
          <ActivityIndicator size="small" color={Theme.colors.primary} />
        ) : (
          <View style={styles.slotsGrid}>
            {slots.map((s: string) => {
              const active = selectedSlot === s;
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => setSelectedSlot(s)}
                  style={[
                    styles.slotBtn,
                    active && styles.slotBtnActive
                  ]}
                >
                  <Text style={[styles.slotText, active && styles.textWhite]}>{formatSlotDisplay(s)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Total panel */}
      <View style={styles.totalCard}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Hourly Session</Text>
          <Text style={styles.totalPrice}>₹{therapist?.sessionFee || therapist?.hourlyRate || 1500}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Platform Fee</Text>
          <Text style={styles.totalPrice}>₹0</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabelBold}>Total Amount</Text>
          <Text style={styles.totalPriceBold}>₹{therapist?.sessionFee || therapist?.hourlyRate || 1500}</Text>
        </View>
      </View>

      {/* Proceed payment button */}
      <TouchableOpacity 
        onPress={handleBooking} 
        disabled={loading}
        style={styles.payBtn}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <CreditCard size={18} color="#FFF" />
            <Text style={styles.payBtnText}>Proceed to Checkout</Text>
            <ChevronRight size={16} color="#FFF" />
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    padding: Theme.spacing.margin,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.md,
  },
  header: {
    paddingTop: 40,
    marginBottom: Theme.spacing.xs,
  },
  title: {
    fontFamily: Theme.fonts.display,
    fontSize: 24,
    color: Theme.colors.primary,
  },
  subtitle: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  section: {
    gap: Theme.spacing.sm,
  },
  secTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  secTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
    color: Theme.colors.onSurface,
  },
  dateRow: {
    flexDirection: 'row',
  },
  dateBtn: {
    width: 60,
    height: 70,
    borderRadius: Theme.radius.lg,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    gap: 4,
  },
  dateBtnActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  dayName: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  dayNum: {
    fontFamily: Theme.fonts.display,
    fontSize: 16,
    color: Theme.colors.onSurface,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.xs,
  },
  slotBtn: {
    width: '31%',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    paddingVertical: Theme.spacing.sm,
    alignItems: 'center',
  },
  slotBtnActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  slotText: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 12,
    color: Theme.colors.onSurface,
  },
  totalCard: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    gap: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
  },
  totalPrice: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  divider: {
    height: 1,
    backgroundColor: Theme.colors.surfaceLow,
    marginVertical: 4,
  },
  totalLabelBold: {
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
    color: Theme.colors.onSurface,
  },
  totalPriceBold: {
    fontFamily: Theme.fonts.display,
    fontSize: 18,
    color: Theme.colors.secondary,
  },
  payBtn: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.primary,
    height: 52,
    borderRadius: Theme.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  payBtnText: {
    color: '#FFF',
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
  },
  textWhite: {
    color: '#FFF',
  },
});
export default BookingScreen;
