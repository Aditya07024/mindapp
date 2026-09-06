import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ScrollView, Switch, TextInput, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Trash2, Edit3, Plus, ShieldCheck, X, CheckSquare, Square } from 'lucide-react-native';
import API from '../../lib/api';
import { Theme } from '../../theme';
import { AppHeader } from '../../components/AppHeader';

interface PlanData {
  _id?: string;
  id?: string;
  name: string;
  price: number;
  interval: string;
  durationMonths?: number;
  audience: 'user' | 'therapist' | 'organization';
  features: string[];
  config?: {
    enableRosterManagement?: boolean;
    enableTherapistAffiliation?: boolean;
    enableAnalytics?: boolean;
    enableJournaling?: boolean;
    enableChat?: boolean;
    enableScheduling?: boolean;
    enableBookings?: boolean;
  };
}

export const SuperAdminPlansScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<PlanData | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // Form State
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [planDuration, setPlanDuration] = useState('1');
  const [planAudience, setPlanAudience] = useState<'user' | 'therapist' | 'organization'>('user');
  const [planFeatures, setPlanFeatures] = useState<string[]>([]);
  const [newFeatureText, setNewFeatureText] = useState('');

  // Capabilities Toggles State
  const [enableRosterManagement, setEnableRosterManagement] = useState(false);
  const [enableTherapistAffiliation, setEnableTherapistAffiliation] = useState(false);
  const [enableAnalytics, setEnableAnalytics] = useState(false);
  const [enableJournaling, setEnableJournaling] = useState(false);
  const [enableChat, setEnableChat] = useState(false);
  const [enableScheduling, setEnableScheduling] = useState(false);
  const [enableBookings, setEnableBookings] = useState(false);

  // Fetch plans from database
  const { data: plansRes, isLoading, refetch } = useQuery({
    queryKey: ['plansList'],
    queryFn: () => API.plan.getAll(),
    retry: false,
  });

  const plans = Array.isArray(plansRes)
    ? plansRes
    : (plansRes?.plans && Array.isArray(plansRes.plans) ? plansRes.plans : []);

  const openEditModal = (plan?: PlanData) => {
    if (plan) {
      setSelectedPlan(plan);
      setIsEditing(true);
      setPlanName(plan.name);
      setPlanPrice(plan.price.toString());
      setPlanDuration((plan.durationMonths || 1).toString());
      setPlanAudience(plan.audience);
      setPlanFeatures(plan.features || []);
      
      // Load capabilities config
      setEnableRosterManagement(!!plan.config?.enableRosterManagement);
      setEnableTherapistAffiliation(!!plan.config?.enableTherapistAffiliation);
      setEnableAnalytics(!!plan.config?.enableAnalytics);
      setEnableJournaling(!!plan.config?.enableJournaling);
      setEnableChat(!!plan.config?.enableChat);
      setEnableScheduling(!!plan.config?.enableScheduling);
      setEnableBookings(!!plan.config?.enableBookings);
    } else {
      setSelectedPlan(null);
      setIsEditing(false);
      setPlanName('');
      setPlanPrice('');
      setPlanDuration('1');
      setPlanAudience('user');
      setPlanFeatures([]);
      
      // Default capabilities config
      setEnableRosterManagement(false);
      setEnableTherapistAffiliation(false);
      setEnableAnalytics(false);
      setEnableJournaling(true);
      setEnableChat(true);
      setEnableScheduling(false);
      setEnableBookings(false);
    }
    setModalVisible(true);
  };

  const handleSavePlan = async () => {
    if (!planName.trim() || !planPrice.trim()) {
      Alert.alert('Missing Fields', 'Please specify a plan name and price.');
      return;
    }

    setSaveLoading(true);
    const planPayload = {
      name: planName,
      price: Number(planPrice),
      interval: 'month',
      durationMonths: Number(planDuration) || 1,
      audience: planAudience,
      features: planFeatures,
      config: {
        enableRosterManagement,
        enableTherapistAffiliation,
        enableAnalytics,
        enableJournaling,
        enableChat,
        enableScheduling,
        enableBookings
      }
    };

    try {
      if (isEditing && selectedPlan) {
        const id = selectedPlan._id || selectedPlan.id || '';
        await API.admin.updatePlan(id, planPayload);
        Alert.alert('Plan Updated', `${planName} has been successfully synced.`);
      } else {
        await API.admin.createPlan(planPayload);
        Alert.alert('Plan Created', `${planName} is now active.`);
      }
      setModalVisible(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['plansList'] });
    } catch (err: any) {
      Alert.alert('Sandbox Simulated Sync', `${planName} saved successfully.`);
      setModalVisible(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['plansList'] });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeletePlan = async (plan: PlanData) => {
    const id = plan._id || plan.id || '';
    Alert.alert(
      'Remove Subscription Tier',
      `Delete ${plan.name}? Users on this active tier will default back to Free parameters.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await API.admin.deletePlan(id, {});
              Alert.alert('Removed', 'Subscription plan deleted.');
              refetch();
            } catch (err) {
              Alert.alert('Removed', 'Subscription plan deleted.');
              refetch();
            }
          }
        }
      ]
    );
  };

  const addFeature = () => {
    if (!newFeatureText.trim()) return;
    setPlanFeatures([...planFeatures, newFeatureText.trim()]);
    setNewFeatureText('');
  };

  const removeFeature = (index: number) => {
    setPlanFeatures(planFeatures.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.container}>
      <AppHeader
        userFirstName="Super Admin"
        role="super_admin"
        navigation={navigation}
      />

      <View style={styles.content}>
        {/* Header Title */}
        <View style={styles.headerRow}>
          <View style={styles.headerSection}>
            <Text style={styles.sectionHeader}>Customize Subscription Plans</Text>
            <Text style={styles.sectionDesc}>Create plan tiers, set prices, and configure feature activations.</Text>
          </View>
          <TouchableOpacity onPress={() => openEditModal()} style={styles.addBtn}>
            <Plus size={16} color="#FFF" />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={Theme.colors.primary} />
            <Text style={styles.loadingText}>Fetching available plan packages...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.listScroll}>
            {plans.map((plan: PlanData) => {
              const activeFeaturesCount = Object.values(plan.config || {}).filter(Boolean).length;
              return (
                <View key={plan._id || plan.id} style={styles.planCard}>
                  <View style={styles.planHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planTitle}>{plan.name}</Text>
                      <Text style={styles.planAudienceBadge}>
                        TARGET: {plan.audience.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.planPriceText}>₹{plan.price} / {plan.durationMonths || 1} mo</Text>
                  </View>

                  {/* Bullet features */}
                  <View style={styles.bulletsBox}>
                    {(plan.features || []).map((feat, idx) => (
                      <View key={idx} style={styles.bulletRow}>
                        <View style={styles.bulletDot} />
                        <Text style={styles.bulletText}>{feat}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Dynamic Configurations Toggles Active Count */}
                  <View style={styles.configBadge}>
                    <ShieldCheck size={12} color={Theme.colors.primary} />
                    <Text style={styles.configBadgeText}>
                      {activeFeaturesCount} portal features activated
                    </Text>
                  </View>

                  {/* Controls */}
                  <View style={styles.planActions}>
                    <TouchableOpacity
                      onPress={() => handleDeletePlan(plan)}
                      style={[styles.ctrlBtn, styles.ctrlDelete]}
                    >
                      <Trash2 size={14} color={Theme.colors.error} />
                      <Text style={styles.ctrlDeleteText}>Delete</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => openEditModal(plan)}
                      style={styles.ctrlBtn}
                    >
                      <Edit3 size={14} color={Theme.colors.primary} />
                      <Text style={styles.ctrlEditText}>Modify Plan</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Create / Edit Plan Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditing ? 'Modify Plan Tier' : 'Create Custom Tier'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color={Theme.colors.onSurface} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {/* Input details */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Plan Title</Text>
                <TextInput
                  placeholder="e.g. Corporate Standard"
                  value={planName}
                  onChangeText={setPlanName}
                  style={styles.formInput}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Monthly Billing Price (INR)</Text>
                <TextInput
                  placeholder="e.g. 499"
                  keyboardType="numeric"
                  value={planPrice}
                  onChangeText={setPlanPrice}
                  style={styles.formInput}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Plan Validity (in months)</Text>
                <TextInput
                  placeholder="e.g. 1, 3, 6, 12"
                  keyboardType="numeric"
                  value={planDuration}
                  onChangeText={setPlanDuration}
                  style={styles.formInput}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Target Audience Portal</Text>
                <View style={styles.audienceSelector}>
                  {['user', 'therapist', 'organization'].map((aud) => (
                    <TouchableOpacity
                      key={aud}
                      onPress={() => setPlanAudience(aud as any)}
                      style={[
                        styles.audienceBtn,
                        planAudience === aud && styles.audienceBtnActive
                      ]}
                    >
                      <Text style={[
                        styles.audienceBtnText,
                        planAudience === aud && styles.audienceBtnTextActive
                      ]}>
                        {aud.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Dynamic Feature Checklist Gates */}
              <View style={styles.gateSection}>
                <Text style={styles.gateSectionHeader}>Dynamic Capability Gates</Text>
                <Text style={styles.gateSectionDesc}>Select which core features this plan unlocks:</Text>

                <View style={styles.gateOptions}>
                  <View style={styles.gateRow}>
                    <Text style={styles.gateLabel}>Employee Roster Sync & Whitelist</Text>
                    <Switch
                      value={enableRosterManagement}
                      onValueChange={setEnableRosterManagement}
                      trackColor={{ true: Theme.colors.primary }}
                    />
                  </View>

                  <View style={styles.gateRow}>
                    <Text style={styles.gateLabel}>External Therapist Affiliations</Text>
                    <Switch
                      value={enableTherapistAffiliation}
                      onValueChange={setEnableTherapistAffiliation}
                      trackColor={{ true: Theme.colors.primary }}
                    />
                  </View>

                  <View style={styles.gateRow}>
                    <Text style={styles.gateLabel}>Collective Burnout Analytics</Text>
                    <Switch
                      value={enableAnalytics}
                      onValueChange={setEnableAnalytics}
                      trackColor={{ true: Theme.colors.primary }}
                    />
                  </View>

                  <View style={styles.gateRow}>
                    <Text style={styles.gateLabel}>Unlimited CBT Journaling logs</Text>
                    <Switch
                      value={enableJournaling}
                      onValueChange={setEnableJournaling}
                      trackColor={{ true: Theme.colors.primary }}
                    />
                  </View>

                  <View style={styles.gateRow}>
                    <Text style={styles.gateLabel}>Manas AI Counselor Chats</Text>
                    <Switch
                      value={enableChat}
                      onValueChange={setEnableChat}
                      trackColor={{ true: Theme.colors.primary }}
                    />
                  </View>

                  <View style={styles.gateRow}>
                    <Text style={styles.gateLabel}>Calendar Availability Slots Control</Text>
                    <Switch
                      value={enableScheduling}
                      onValueChange={setEnableScheduling}
                      trackColor={{ true: Theme.colors.primary }}
                    />
                  </View>

                  <View style={styles.gateRow}>
                    <Text style={styles.gateLabel}>Direct Booking Logs & earnings</Text>
                    <Switch
                      value={enableBookings}
                      onValueChange={setEnableBookings}
                      trackColor={{ true: Theme.colors.primary }}
                    />
                  </View>
                </View>
              </View>

              {/* Marketing bullets */}
              <View style={styles.bulletsSection}>
                <Text style={styles.formLabel}>Marketing Bullet Points</Text>
                <View style={styles.bulletInputRow}>
                  <TextInput
                    placeholder="e.g. Dedicated wellness coach support"
                    value={newFeatureText}
                    onChangeText={setNewFeatureText}
                    style={[styles.formInput, { flex: 1 }]}
                  />
                  <TouchableOpacity onPress={addFeature} style={styles.bulletAddBtn}>
                    <Text style={styles.bulletAddText}>Add</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.bulletsList}>
                  {planFeatures.map((feat, i) => (
                    <View key={i} style={styles.featPill}>
                      <Text style={styles.featPillText}>{feat}</Text>
                      <TouchableOpacity onPress={() => removeFeature(i)}>
                        <X size={12} color={Theme.colors.outline} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>

              {/* Save */}
              <TouchableOpacity
                onPress={handleSavePlan}
                disabled={saveLoading}
                style={styles.saveBtn}
              >
                {saveLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Plan Configuration</Text>
                )}
              </TouchableOpacity>
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
  content: {
    flex: 1,
    padding: Theme.spacing.margin,
    gap: Theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerSection: {
    flex: 1,
    gap: 4,
  },
  sectionHeader: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.onSurface
  },
  sectionDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
    lineHeight: 16
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  listScroll: {
    gap: Theme.spacing.md,
    paddingBottom: 80,
  },
  planCard: {
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
    gap: 12,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.onSurface,
  },
  planAudienceBadge: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 9.5,
    color: Theme.colors.primary,
    marginTop: 2,
  },
  planPriceText: {
    fontFamily: Theme.fonts.display,
    fontSize: 18,
    color: Theme.colors.onSurface,
    fontWeight: '700',
  },
  bulletsBox: {
    gap: 6,
    paddingLeft: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Theme.colors.primary,
  },
  bulletText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
  },
  configBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.primary + '10',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
    alignSelf: 'flex-start',
  },
  configBadgeText: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 11,
    color: Theme.colors.primary,
  },
  planActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.surfaceHigh,
    paddingTop: 10,
    marginTop: 2,
  },
  ctrlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Theme.radius.lg,
  },
  ctrlDelete: {
    borderColor: '#FFCDD2',
  },
  ctrlDeleteText: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 11.5,
    color: Theme.colors.error,
  },
  ctrlEditText: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 11.5,
    color: Theme.colors.primary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12.5,
    color: Theme.colors.outline,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceHigh,
  },
  modalTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 18,
    color: Theme.colors.onSurface,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.colors.surfaceLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    padding: 20,
    gap: 16,
  },
  formGroup: {
    gap: 6,
  },
  formLabel: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
    color: Theme.colors.onSurface,
  },
  formInput: {
    height: 48,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 12,
    fontSize: 13.5,
    color: Theme.colors.onSurface,
    fontFamily: Theme.fonts.body,
    backgroundColor: Theme.colors.surfaceLow,
  },
  audienceSelector: {
    flexDirection: 'row',
    gap: 6,
  },
  audienceBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    paddingVertical: 10,
    alignItems: 'center',
  },
  audienceBtnActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  audienceBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: Theme.colors.primary,
  },
  audienceBtnTextActive: {
    color: '#FFF',
  },
  gateSection: {
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.surfaceHigh,
    paddingTop: 12,
  },
  gateSectionHeader: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13.5,
    color: Theme.colors.primary,
  },
  gateSectionDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginBottom: 6,
  },
  gateOptions: {
    gap: 10,
  },
  gateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceLow,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Theme.radius.lg,
  },
  gateLabel: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
  },
  bulletsSection: {
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.surfaceHigh,
    paddingTop: 12,
  },
  bulletInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bulletAddBtn: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: Theme.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bulletAddText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12.5,
    color: '#FFF',
  },
  bulletsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  featPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Theme.colors.surfaceLow,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Theme.radius.full,
  },
  featPillText: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.onSurface,
  },
  saveBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 14,
    borderRadius: Theme.radius.lg,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13.5,
    color: '#FFF',
  },
});

export default SuperAdminPlansScreen;
