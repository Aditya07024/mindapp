import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import { CheckCircle } from 'lucide-react-native';
import API from '../../lib/api';
import { Theme } from '../../theme';
import { PlanCard, PlanData } from '../../components/PlanCard';

interface PlansScreenProps {
  navigation: any;
}

export const PlansScreen: React.FC<PlansScreenProps> = ({ navigation }) => {
  const { isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [cancellingPending, setCancellingPending] = useState(false);
  const [plans, setPlans] = useState<PlanData[]>([
    {
      id: 'free',
      name: 'Free',
      price: 0,
      interval: 'month',
      features: [
        '300 AI messages/day limit',
        '1 therapist recommendation in 15 days',
        'Clinical therapy evaluation in 15 days',
        'CBT journal (3 entries/week limit)',
        'All breathing exercises',
        'Mood calendar (7-day limit)',
        'Crisis line 24/7 support'
      ],
      audience: 'user',
      highlighted: false,
    },
    {
      id: 'mann_shanti',
      name: 'Apna Mann',
      price: 199,
      interval: 'month',
      features: [
        '1000 messages/day limit',
        '3 therapist recommendations every week',
        'Weekly therapist clinical evaluation',
        'CBT journal (15 entries in 15 days)',
        '25-day mood calendar',
        'Priority booking + instant access',
        'Buy 1 booking, get 2 free bookings'
      ],
      audience: 'user',
      highlighted: true,
    },
    {
      id: 'apna_therapist',
      name: 'Mann Shanti',
      price: 499,
      interval: 'month',
      features: [
        'Unlimited messages/day',
        '1 therapist recommendation/day',
        'Weekly therapist clinical evaluation',
        'Unlimited journal entries',
        '10% therapist discount',
        'Buy 2 bookings, get 5 free bookings',
        'Unlimited mood calendar/monthly'
      ],
      audience: 'user',
      highlighted: false,
    }
  ]);

  const { data: userProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: () => API.auth.me().catch(() => null),
    retry: false,
  });

  const { data: remotePlans, isLoading } = useQuery({
    queryKey: ['plansList'],
    queryFn: () => API.plan.getAll(),
    retry: false,
  });

  const { data: subscriptionData, isLoading: isSubscriptionLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => API.subscription.get().catch(() => null),
    retry: false,
    enabled: !!isSignedIn,
  });

  useEffect(() => {
    if (remotePlans) {
      const planList = Array.isArray(remotePlans) 
        ? remotePlans 
        : (remotePlans.plans && Array.isArray(remotePlans.plans) ? remotePlans.plans : []);
      if (planList.length > 0) {
        const mappedRemotePlans = planList.map((p: any) => ({
          id: p._id,
          name: p.name,
          price: p.price,
          interval: 'month',
          features: p.features || [],
          audience: p.audience,
          highlighted: p.name === 'Apna Mann',
        }));

        setPlans([
          {
            id: 'free',
            name: 'Free',
            price: 0,
            interval: 'month',
            features: [
              '300 AI messages/day limit',
              '1 therapist recommendation in 15 days',
              'CBT journal (3 entries/week limit)',
              'All breathing exercises',
              'Mood calendar (7-day limit)',
              'Crisis line 24/7 support'
            ],
            audience: 'user',
            highlighted: false,
          },
          ...mappedRemotePlans
        ]);
      }
    }
  }, [remotePlans]);

  const role = userProfile?.role || 'user';
  const orgId = userProfile?.orgId;

  // Filter plans list based on audience role
  const filteredPlans = plans.filter(plan => {
    if (role === 'org_admin') {
      return plan.audience === 'organization';
    } else if (role === 'therapist') {
      return plan.audience === 'therapist';
    } else {
      return plan.audience === 'user';
    }
  });

  const currentTier = subscriptionData?.tier ?? 'free';
  const hasPendingSub = subscriptionData?.subscription?.status === 'pending';
  const pendingPlanName = hasPendingSub ? subscriptionData?.subscription?.plan : null;

  // ── Standalone cancel handler (NOT inside Alert callback) ──
  const doCancelPending = async () => {
    console.log('[CancelPending] Starting cancel...');
    setCancellingPending(true);
    try {
      const res = await API.subscription.cancel();
      console.log('[CancelPending] API response:', JSON.stringify(res));
      Alert.alert('Cancelled', 'Pending subscription cancelled.');
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    } catch (err: any) {
      console.error('[CancelPending] Error:', err);
      Alert.alert('Error', err?.message || 'Failed to cancel.');
    } finally {
      setCancellingPending(false);
    }
  };

  // ── Standalone upgrade handler (NOT inside Alert callback) ──
  const doUpgrade = async (plan: PlanData) => {
    console.log('[Upgrade] Starting upgrade for plan:', JSON.stringify(plan, null, 2));
    setCheckoutLoading(true);
    try {
      const payload = { tier: (plan.id || plan._id || '') as string };
      console.log('[Upgrade] Sending upgrade request payload:', JSON.stringify(payload));

      const res = await API.subscription.upgrade(payload);
      console.log('[Upgrade] Received response:', JSON.stringify(res, null, 2));

      const shortUrl = res?.shortUrl;
      console.log('[Upgrade] Extracted shortUrl:', shortUrl);

      if (!shortUrl) {
        console.error('[Upgrade] Error: No shortUrl found in response!');
        throw new Error('Could not retrieve secure payment URL.');
      }

      setCheckoutLoading(false);

      // Open Razorpay Gateway in browser directly
      console.log('[Upgrade] Launching browser for shortUrl:', shortUrl);
      await WebBrowser.openBrowserAsync(shortUrl);

      // Auto-sync status when they return to the app
      try {
        setCheckoutLoading(true);
        console.log('[Upgrade] Syncing subscription status after browser session...');
        const syncRes = await API.subscription.sync();
        console.log('[Upgrade] Sync status response:', JSON.stringify(syncRes, null, 2));
        if (syncRes.status === 'active') {
          Alert.alert('Subscription Activated!', 'Your payment was verified. Premium features are now unlocked!');
        } else {
          Alert.alert(
            'Payment Processing',
            'Your payment is being processed. If you already completed the payment, click "Sync Status" on the plans page to update.'
          );
        }
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
        queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      } catch (syncErr) {
        console.warn('[Upgrade] Auto-sync on return failed:', syncErr);
        Alert.alert(
          'Payment Processing',
          'Your payment is being verified securely by Razorpay. Once done, click "Sync Status" to activate.'
        );
      } finally {
        setCheckoutLoading(false);
      }
    } catch (err: any) {
      console.error('[Upgrade] Error caught:', err);
      Alert.alert(
        'Checkout Error',
        err?.message || 'We could not initiate the checkout gateway at this moment. Please check your network connection.'
      );
      setCheckoutLoading(false);
    }
  };

  const handleSelectPlan = (plan: PlanData) => {
    console.log('[handleSelectPlan] Tapped plan:', plan.name, 'id:', plan.id || plan._id);
    console.log('[handleSelectPlan] isSignedIn:', isSignedIn, 'hasPendingSub:', hasPendingSub, 'currentTier:', currentTier);

    if (plan.price === 0) {
      Alert.alert('Free Activated', 'You are currently on the Free Tier!');
      return;
    }

    if (hasPendingSub) {
      Alert.alert(
        'Payment Pending',
        'You already have a subscription payment pending. Please sync status or click "Cancel Pending" at the top of the page to choose another plan.'
      );
      return;
    }

    const isPlanActive = currentTier === plan.id || currentTier === plan._id || currentTier === plan.name;
    if (isPlanActive) {
      Alert.alert('Plan Active', 'You are already subscribed to this plan!');
      return;
    }
    
    if (!isSignedIn) {
      // For non-signed-in users, just navigate directly to login
      navigation.navigate('Login', { role: 'user', upgradePlan: plan.id || plan._id });
      return;
    }

    // Directly start upgrade — no Alert confirmation (Alert callbacks are broken on this device)
    console.log('[handleSelectPlan] Calling doUpgrade directly for:', plan.name);
    doUpgrade(plan);
  };

  // Corporate affiliate therapists are fully sponsored by their organizations
  if (role === 'therapist' && orgId) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <View style={styles.sponsoredCard}>
          <CheckCircle size={48} color={Theme.colors.primary} style={styles.sponsoredIcon} />
          <Text style={styles.sponsoredTitle}>Corporate Sponsored Workspace</Text>
          <Text style={styles.sponsoredDesc}>
            Your therapist profile is affiliated with an active organization. Subscription fees and premium seats are fully funded directly by your organization.
          </Text>
          <Text style={styles.sponsoredSub}>
            No individual subscription payment is required!
          </Text>
          
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Simple, Transparent Pricing</Text>
        <Text style={styles.subtitle}>Choose a tier aligned with your professional mental well-being goals.</Text>
      </View>

      {hasPendingSub && (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingTitle}>Payment Confirmation Pending</Text>
          <Text style={styles.pendingDesc}>
            You have a pending subscription for "{pendingPlanName}". If you already paid, sync status below. Otherwise, cancel it to try again or select another plan.
          </Text>
          <View style={styles.pendingActions}>
            <TouchableOpacity 
              onPress={async () => {
                console.log('[SyncStatus] Tapped');
                try {
                  setCheckoutLoading(true);
                  const res = await API.subscription.sync();
                  console.log('[SyncStatus] Response:', JSON.stringify(res));
                  Alert.alert("Sync Status", res.message || "Synced successfully!");
                  queryClient.invalidateQueries({ queryKey: ['subscription'] });
                  queryClient.invalidateQueries({ queryKey: ['userProfile'] });
                } catch (err: any) {
                  console.error('[SyncStatus] Error:', err);
                  Alert.alert("Sync Failed", err.message || "Failed to sync status.");
                } finally {
                  setCheckoutLoading(false);
                }
              }}
              style={[styles.actionBtn, styles.syncBtn]}
            >
              <Text style={styles.actionBtnText}>Sync Status</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => {
                console.log('[CancelPending] Tapped — calling cancel directly');
                doCancelPending();
              }}
              style={[styles.actionBtn, styles.cancelBtn]}
              disabled={cancellingPending}
            >
              <Text style={[styles.actionBtnText, styles.cancelBtnText]}>
                {cancellingPending ? 'Cancelling...' : 'Cancel Pending'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {(isLoading || (isSignedIn && isSubscriptionLoading)) && (
        <ActivityIndicator size="large" color={Theme.colors.primary} style={styles.loader} />
      )}

      {checkoutLoading && (
        <ActivityIndicator size="large" color={Theme.colors.secondary} style={styles.loader} />
      )}

      <View style={styles.cardsWrapper}>
        {filteredPlans.length > 0 ? (
          filteredPlans.map((plan, idx) => {
            const isPlanActive = currentTier === plan.id || currentTier === plan._id || currentTier === plan.name;
            const isPending = hasPendingSub && 
              (pendingPlanName === plan.id || 
               pendingPlanName === plan._id || 
               pendingPlanName === plan.name);
            return (
              <PlanCard
                key={plan.id || plan._id || idx.toString()}
                plan={plan}
                isActive={isPlanActive}
                btnLabel={isPending ? 'Payment Pending' : undefined}
                onPress={() => handleSelectPlan(plan)}
              />
            );
          })
        ) : (
          <View style={styles.emptyPlansCard}>
            <Text style={styles.emptyPlansText}>No plans available for your role at this time.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.margin,
  },
  content: {
    padding: Theme.spacing.margin,
    paddingBottom: Theme.spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
    textAlign: 'center',
  },
  title: {
    paddingTop: Theme.spacing.lg,
    fontFamily: Theme.fonts.display,
    fontSize: 26,
    color: Theme.colors.primary,
  },
  subtitle: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: Theme.spacing.xs - 2,
    lineHeight: 20,
  },
  loader: {
    marginVertical: Theme.spacing.md,
  },
  cardsWrapper: {
    marginTop: Theme.spacing.xs,
  },
  sponsoredCard: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.lg,
    alignItems: 'center',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 4,
    width: '100%',
    maxWidth: 340,
  },
  sponsoredIcon: {
    marginBottom: Theme.spacing.md,
  },
  sponsoredTitle: {
    fontFamily: Theme.fonts.display,
    fontSize: 20,
    color: Theme.colors.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
  },
  sponsoredDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 13.5,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Theme.spacing.md,
  },
  sponsoredSub: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12.5,
    color: Theme.colors.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.lg,
  },
  backBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: Theme.spacing.lg,
    borderRadius: Theme.radius.full,
    width: '100%',
    alignItems: 'center',
  },
  backBtnText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13.5,
    color: '#FFF',
  },
  emptyPlansCard: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
  },
  emptyPlansText: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 13.5,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
  },
  pendingBanner: {
    backgroundColor: '#FFF9E6',
    borderWidth: 1,
    borderColor: '#FFE0B2',
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  pendingTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
    color: '#E65100',
    marginBottom: Theme.spacing.xs - 2,
  },
  pendingDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 12.5,
    color: '#EF6C00',
    lineHeight: 18,
    marginBottom: Theme.spacing.md,
  },
  pendingActions: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  actionBtn: {
    flex: 1,
    height: 38,
    borderRadius: Theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncBtn: {
    backgroundColor: '#E65100',
  },
  cancelBtn: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  actionBtnText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
    color: '#FFF',
  },
  cancelBtnText: {
    color: '#E65100',
  },
});

export default PlansScreen;
