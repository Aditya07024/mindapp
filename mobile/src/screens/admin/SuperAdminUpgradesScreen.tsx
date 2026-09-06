import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ScrollView, Switch, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, ShieldCheck, User, Building, Search, Calendar, ChevronRight, Zap } from 'lucide-react-native';
import API from '../../lib/api';
import { Theme } from '../../theme';
import { AppHeader } from '../../components/AppHeader';

export const SuperAdminUpgradesScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const queryClient = useQueryClient();
  const [targetType, setTargetType] = useState<'user' | 'organization'>('user');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [planId, setPlanId] = useState('');
  const [planName, setPlanName] = useState('');
  const [duration, setDuration] = useState<'1m' | '6m' | '1y' | 'lifetime'>('1m');

  // Custom configuration toggles
  const [customConfig, setCustomConfig] = useState({
    dailyChatLimit: 300 as number | null,
    hasPriorityBooking: false,
    therapistDiscount: 0,
    hasUnlimitedJournal: false,
    enableChat: true,
    enableTherapistAccess: true,
    enableJournaling: true,
    enableMoodCheck: true,
    enableBreathe: true,
    enableScheduling: false,
    enableBookings: false,
    enableEarnings: false,
    enableProfileControl: false,
    enableRosterManagement: false,
    enableTherapistAffiliation: false,
    enableAnalytics: false
  });

  // Fetch upgrade targets
  const { data: targets, isLoading: targetsLoading } = useQuery({
    queryKey: ['upgradeTargets'],
    queryFn: () => API.admin.listUsersAndOrgs(),
    retry: false,
  });

  // Fetch plans list
  const { data: plansRes, isLoading: plansLoading } = useQuery({
    queryKey: ['plansList'],
    queryFn: () => API.plan.getAll(),
    retry: false,
  });

  const plans = Array.isArray(plansRes)
    ? plansRes
    : (plansRes?.plans && Array.isArray(plansRes.plans) ? plansRes.plans : []);

  // Filter list of users / orgs based on query
  const filteredUsers = (targets?.users || []).filter((u: any) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.phone && u.phone.includes(searchQuery))
  );

  const filteredOrgs = (targets?.organizations || []).filter((o: any) =>
    o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (o.email && o.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Upgrade mutation
  const upgradeMutation = useMutation({
    mutationFn: (payload: any) => API.admin.manualUpgrade(payload),
    onSuccess: () => {
      Alert.alert('Upgrade Applied', 'The user/organization has been upgraded successfully.');
      setSelectedTargetId('');
      setPlanId('');
      setPlanName('');
      queryClient.invalidateQueries({ queryKey: ['upgradeTargets'] });
      queryClient.invalidateQueries({ queryKey: ['adminSubscriptions'] });
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to apply manual upgrade.');
    }
  });

  const handleApplyUpgrade = () => {
    if (!selectedTargetId) {
      Alert.alert('Selection Required', 'Please select a user or organization to upgrade.');
      return;
    }
    if (!planId) {
      Alert.alert('Plan Required', 'Please select a standard plan or customize configuration.');
      return;
    }

    let computedEndDate = new Date();
    if (duration === '1m') computedEndDate.setMonth(computedEndDate.getMonth() + 1);
    else if (duration === '6m') computedEndDate.setMonth(computedEndDate.getMonth() + 6);
    else if (duration === '1y') computedEndDate.setFullYear(computedEndDate.getFullYear() + 1);
    else if (duration === 'lifetime') computedEndDate.setFullYear(computedEndDate.getFullYear() + 10);

    const payload = {
      targetType,
      targetId: selectedTargetId,
      planId,
      customConfig: planId === 'custom' ? customConfig : undefined,
      customPlanName: planId === 'custom' ? planName : undefined,
      endDate: computedEndDate.toISOString(),
    };

    Alert.alert(
      'Confirm Plan Upgrade',
      `Upgrade ${
        targetType === 'user'
          ? (targets?.users?.find((u: any) => u.id === selectedTargetId)?.name || 'Selected User')
          : (targets?.organizations?.find((o: any) => o.id === selectedTargetId)?.name || 'Selected Organization')
      } to ${planId === 'custom' ? planName || 'Custom config' : plans.find((p: any) => p._id === planId)?.name || planId}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upgrade', style: 'default', onPress: () => upgradeMutation.mutate(payload) }
      ]
    );
  };

  const getSelectedTargetName = () => {
    if (!selectedTargetId) return 'None';
    if (targetType === 'user') {
      return targets?.users?.find((u: any) => u.id === selectedTargetId)?.name || 'Selected User';
    }
    return targets?.organizations?.find((o: any) => o.id === selectedTargetId)?.name || 'Selected Org';
  };

  const selectPlanPreset = (val: string) => {
    setPlanId(val);
    if (val === 'custom') {
      setPlanName('Custom Admin Plan');
    } else {
      const matchedPlan = plans.find((p: any) => p._id === val);
      if (matchedPlan) {
        setPlanName(matchedPlan.name);
        setCustomConfig(matchedPlan.config || customConfig);
      } else if (val === 'mann_shanti') {
        setPlanName('Mann Shanti');
        setCustomConfig({
          dailyChatLimit: 100,
          hasPriorityBooking: false,
          therapistDiscount: 0,
          hasUnlimitedJournal: false,
          enableChat: true,
          enableTherapistAccess: true,
          enableJournaling: true,
          enableMoodCheck: true,
          enableBreathe: true,
          enableScheduling: false,
          enableBookings: false,
          enableEarnings: false,
          enableProfileControl: false,
          enableRosterManagement: false,
          enableTherapistAffiliation: false,
          enableAnalytics: false
        });
      } else if (val === 'apna_therapist') {
        setPlanName('Apna Therapist');
        setCustomConfig({
          dailyChatLimit: null,
          hasPriorityBooking: true,
          therapistDiscount: 15,
          hasUnlimitedJournal: true,
          enableChat: true,
          enableTherapistAccess: true,
          enableJournaling: true,
          enableMoodCheck: true,
          enableBreathe: true,
          enableScheduling: false,
          enableBookings: false,
          enableEarnings: false,
          enableProfileControl: false,
          enableRosterManagement: false,
          enableTherapistAffiliation: false,
          enableAnalytics: false
        });
      }
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        userFirstName="Super Admin"
        role="super_admin"
        navigation={navigation}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header section */}
        <View style={styles.headerSection}>
          <Text style={styles.sectionHeader}>Manual Subscription Upgrades</Text>
          <Text style={styles.sectionDesc}>Directly override platform tiers or customize precise parameters for any user or organization.</Text>
        </View>

        {/* 1. Target Type Toggle */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Select Recipient Category</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              onPress={() => { setTargetType('user'); setSelectedTargetId(''); }}
              style={[styles.toggleBtn, targetType === 'user' && styles.toggleBtnActive]}
            >
              <User size={16} color={targetType === 'user' ? '#FFF' : Theme.colors.primary} />
              <Text style={[styles.toggleBtnText, targetType === 'user' && styles.toggleBtnTextActive]}>Seeker / Therapist</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setTargetType('organization'); setSelectedTargetId(''); }}
              style={[styles.toggleBtn, targetType === 'organization' && styles.toggleBtnActive]}
            >
              <Building size={16} color={targetType === 'organization' ? '#FFF' : Theme.colors.primary} />
              <Text style={[styles.toggleBtnText, targetType === 'organization' && styles.toggleBtnTextActive]}>Organization</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. Choose Target List */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Find Target Account</Text>
          <View style={styles.searchBar}>
            <Search size={16} color={Theme.colors.outline} />
            <TextInput
              placeholder={`Search by name, email or mobile...`}
              placeholderTextColor={Theme.colors.outline}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />
          </View>

          {targetsLoading ? (
            <ActivityIndicator size="small" color={Theme.colors.primary} style={{ marginVertical: 12 }} />
          ) : (
            <View style={styles.targetsList}>
              {targetType === 'user' ? (
                filteredUsers.slice(0, 10).map((u: any) => (
                  <TouchableOpacity
                    key={u.id}
                    onPress={() => setSelectedTargetId(u.id)}
                    style={[styles.targetItem, selectedTargetId === u.id && styles.targetItemActive]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.targetName, selectedTargetId === u.id && styles.targetTextActive]}>{u.name}</Text>
                      <Text style={styles.targetMeta}>{u.phone || 'No phone'} · Role: {u.role}</Text>
                    </View>
                    <Text style={styles.tierBadge}>{(u.tier || 'free').toUpperCase()}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                filteredOrgs.slice(0, 10).map((o: any) => (
                  <TouchableOpacity
                    key={o.id}
                    onPress={() => setSelectedTargetId(o.id)}
                    style={[styles.targetItem, selectedTargetId === o.id && styles.targetItemActive]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.targetName, selectedTargetId === o.id && styles.targetTextActive]}>{o.name}</Text>
                      <Text style={styles.targetMeta}>{o.email || 'No email'}</Text>
                    </View>
                    <Text style={styles.tierBadge}>{(o.status || 'pending').toUpperCase()}</Text>
                  </TouchableOpacity>
                ))
              )}
              {((targetType === 'user' ? filteredUsers : filteredOrgs).length === 0) && (
                <Text style={styles.emptyText}>No matching accounts found.</Text>
              )}
            </View>
          )}
        </View>

        {/* 3. Choose Plan */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Select Subscription Plan Preset</Text>
          <View style={styles.presetOptions}>
            <TouchableOpacity
              onPress={() => selectPlanPreset('mann_shanti')}
              style={[styles.presetBtn, planId === 'mann_shanti' && styles.presetBtnActive]}
            >
              <Text style={[styles.presetBtnText, planId === 'mann_shanti' && styles.presetBtnTextActive]}>Mann Shanti</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => selectPlanPreset('apna_therapist')}
              style={[styles.presetBtn, planId === 'apna_therapist' && styles.presetBtnActive]}
            >
              <Text style={[styles.presetBtnText, planId === 'apna_therapist' && styles.presetBtnTextActive]}>Apna Therapist</Text>
            </TouchableOpacity>

            {plans.map((p: any) => (
              <TouchableOpacity
                key={p._id}
                onPress={() => selectPlanPreset(p._id)}
                style={[styles.presetBtn, planId === p._id && styles.presetBtnActive]}
              >
                <Text style={[styles.presetBtnText, planId === p._id && styles.presetBtnTextActive]}>{p.name}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={() => selectPlanPreset('custom')}
              style={[styles.presetBtn, planId === 'custom' && styles.presetBtnActive]}
            >
              <Text style={[styles.presetBtnText, planId === 'custom' && styles.presetBtnTextActive]}>🛠 Custom Config</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 4. Custom Configuration Feature Gates */}
        {planId === 'custom' && (
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Customize Config Parameters</Text>
            <View style={{ gap: 8 }}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Custom Plan Title</Text>
                <TextInput
                  value={planName}
                  onChangeText={setPlanName}
                  placeholder="e.g. Special VIP Plan"
                  style={styles.textInput}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Unlimited daily message limit (Manas AI)</Text>
                <Switch
                  value={customConfig.dailyChatLimit === null}
                  onValueChange={(val) => setCustomConfig(prev => ({ ...prev, dailyChatLimit: val ? null : 300 }))}
                  trackColor={{ true: Theme.colors.primary }}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Priority therapist booking access</Text>
                <Switch
                  value={customConfig.hasPriorityBooking}
                  onValueChange={(val) => setCustomConfig(prev => ({ ...prev, hasPriorityBooking: val }))}
                  trackColor={{ true: Theme.colors.primary }}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Unlimited CBT journaling logs</Text>
                <Switch
                  value={customConfig.hasUnlimitedJournal}
                  onValueChange={(val) => setCustomConfig(prev => ({ ...prev, hasUnlimitedJournal: val }))}
                  trackColor={{ true: Theme.colors.primary }}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Enable Corporate Analytics module</Text>
                <Switch
                  value={customConfig.enableAnalytics}
                  onValueChange={(val) => setCustomConfig(prev => ({ ...prev, enableAnalytics: val }))}
                  trackColor={{ true: Theme.colors.primary }}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Enable Organization Roster controls</Text>
                <Switch
                  value={customConfig.enableRosterManagement}
                  onValueChange={(val) => setCustomConfig(prev => ({ ...prev, enableRosterManagement: val }))}
                  trackColor={{ true: Theme.colors.primary }}
                />
              </View>
            </View>
          </View>
        )}

        {/* 5. Upgrade Duration */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Set Duration Period</Text>
          <View style={styles.durationRow}>
            {(['1m', '6m', '1y', 'lifetime'] as const).map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => setDuration(d)}
                style={[styles.durationBtn, duration === d && styles.durationBtnActive]}
              >
                <Text style={[styles.durationText, duration === d && styles.durationTextActive]}>
                  {d === '1m' ? '1 Month' : d === '6m' ? '6 Mon' : d === '1y' ? '1 Year' : 'Lifetime'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 6. Preview & Save */}
        <View style={styles.previewBox}>
          <Text style={styles.previewTitle}>Upgrade Summary</Text>
          <View style={styles.previewGrid}>
            <View style={styles.previewItem}>
              <Text style={styles.previewLabel}>RECIPIENT</Text>
              <Text style={styles.previewValue}>{getSelectedTargetName()}</Text>
            </View>
            <View style={styles.previewItem}>
              <Text style={styles.previewLabel}>ASSIGNED PLAN</Text>
              <Text style={styles.previewValue}>{planId ? (planId === 'custom' ? planName : planId.toUpperCase()) : 'Not Selected'}</Text>
            </View>
            <View style={styles.previewItem}>
              <Text style={styles.previewLabel}>DURATION</Text>
              <Text style={styles.previewValue}>
                {duration === '1m' && '30 Days'}
                {duration === '6m' && '180 Days'}
                {duration === '1y' && '365 Days'}
                {duration === 'lifetime' && 'Lifetime Access (10 Yrs)'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleApplyUpgrade}
            disabled={upgradeMutation.isPending}
            style={styles.applyBtn}
          >
            {upgradeMutation.isPending ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <View style={styles.applyBtnContent}>
                <Zap size={16} color="#FFF" />
                <Text style={styles.applyBtnText}>APPLY MANUAL OVERRIDE</Text>
              </View>
            )}
          </TouchableOpacity>
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
  headerSection: {
    gap: 4,
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
    lineHeight: 16,
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
    gap: Theme.spacing.sm,
  },
  cardHeader: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
    color: Theme.colors.onSurface,
    marginBottom: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    paddingVertical: 10,
    backgroundColor: Theme.colors.surfaceLow,
  },
  toggleBtnActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  toggleBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: Theme.colors.primary,
  },
  toggleBtnTextActive: {
    color: '#FFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceLow,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Theme.colors.onSurface,
    fontFamily: Theme.fonts.body,
  },
  targetsList: {
    gap: 8,
    marginTop: 4,
  },
  targetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceLow,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    padding: 10,
  },
  targetItemActive: {
    backgroundColor: Theme.colors.primary + '10',
    borderColor: Theme.colors.primary,
  },
  targetName: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
    color: Theme.colors.onSurface,
  },
  targetTextActive: {
    color: Theme.colors.primary,
  },
  targetMeta: {
    fontFamily: Theme.fonts.body,
    fontSize: 10.5,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  tierBadge: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 9,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    color: Theme.colors.outline,
    overflow: 'hidden',
  },
  presetOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetBtn: {
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    backgroundColor: Theme.colors.surfaceLow,
    borderRadius: Theme.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  presetBtnActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  presetBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 10.5,
    color: Theme.colors.primary,
  },
  presetBtnTextActive: {
    color: '#FFF',
  },
  durationRow: {
    flexDirection: 'row',
    gap: 6,
  },
  durationBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    backgroundColor: Theme.colors.surfaceLow,
    borderRadius: Theme.radius.lg,
    paddingVertical: 8,
    alignItems: 'center',
  },
  durationBtnActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  durationText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: Theme.colors.primary,
  },
  durationTextActive: {
    color: '#FFF',
  },
  inputGroup: {
    gap: 4,
    marginBottom: 4,
  },
  inputLabel: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11.5,
    color: Theme.colors.onSurface,
  },
  textInput: {
    height: 40,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 10,
    fontSize: 13,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceLow,
    fontFamily: Theme.fonts.body,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceLow,
    padding: 8,
    borderRadius: Theme.radius.lg,
  },
  switchLabel: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
    flex: 1,
  },
  previewBox: {
    backgroundColor: Theme.colors.primary + '08',
    borderColor: Theme.colors.primary + '20',
    borderWidth: 1.5,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    gap: 12,
    marginTop: 6,
  },
  previewTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
    color: Theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewGrid: {
    gap: 8,
  },
  previewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 9.5,
    color: Theme.colors.outline,
  },
  previewValue: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12,
    color: Theme.colors.onSurface,
  },
  applyBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.lg,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 4,
  },
  applyBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  applyBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12,
    color: '#FFF',
    letterSpacing: 0.5,
  },
  emptyText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.outline,
    textAlign: 'center',
    paddingVertical: 12,
  },
});

export default SuperAdminUpgradesScreen;
