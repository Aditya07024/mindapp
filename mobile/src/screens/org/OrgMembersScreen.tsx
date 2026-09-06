import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  ChevronRight,
  TrendingUp,
  Calendar,
  BookOpen,
  X,
  ShieldAlert,
  Smile,
  Lock
} from 'lucide-react-native';
import API from '../../lib/api';
import { Theme } from '../../theme';
import { AppHeader } from '../../components/AppHeader';

export const OrgMembersScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Subscription check query
  const { data: subData, isLoading: isSubLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => API.subscription.get().catch(() => null),
    retry: false
  });

  const isSubscribed = subData?.subscription?.status === 'active';

  // Query org members
  const { data: membersData, isLoading: isListLoading } = useQuery({
    queryKey: ['org-members'],
    queryFn: () => API.org.members(),
    retry: false
  });

  // Query specific member detail
  const { data: detailData, isLoading: isDetailLoading } = useQuery({
    queryKey: ['org-member-detail', selectedMember?.id],
    queryFn: () => API.org.userDataForOrg(selectedMember.id),
    enabled: !!selectedMember?.id,
    retry: false
  });

  const handleOpenMember = (member: any) => {
    setSelectedMember(member);
    setModalVisible(true);
  };

  const getMoodEmoji = (score: number) => {
    if (score >= 8) return '😁';
    if (score >= 6) return '🙂';
    if (score >= 4) return '😐';
    return '😢';
  };

  return (
    <View style={styles.container}>
      <AppHeader
        userFirstName="BITS Wellness"
        role="org_admin"
        navigation={navigation}
      />

      {isSubLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
        </View>
      ) : !isSubscribed ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: Theme.spacing.margin }}>
          <View style={{
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
          }}>
            <View style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: '#FFF2F2',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16,
              borderWidth: 1,
              borderColor: '#FFCDD2',
            }}>
              <Lock size={24} color={Theme.colors.primary} />
            </View>
            <Text style={{ fontFamily: Theme.fonts.headline, fontSize: 18, color: Theme.colors.onSurface, textAlign: 'center', marginBottom: 8 }}>
              Corporate Plan Required
            </Text>
            <Text style={{ fontFamily: Theme.fonts.body, fontSize: 13, color: Theme.colors.textMuted, textAlign: 'center', lineHeight: 18, paddingHorizontal: 16, marginBottom: 20 }}>
              As an organization or wellness sponsor, you need an active subscription plan to activate employee wellness seats, link network practitioners, and track collective health metrics.
            </Text>

            <TouchableOpacity
              onPress={() => navigation.navigate('Plans', { role: 'org_admin' })}
              style={{
                backgroundColor: Theme.colors.primary,
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: Theme.radius.lg,
              }}
            >
              <Text style={{ fontFamily: Theme.fonts.bodyBold, fontSize: 13, color: '#FFF' }}>
                View Subscription Plans
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerSection}>
            <Text style={styles.sectionHeader}>Verified Roster Directory</Text>
            <Text style={styles.sectionDesc}>
              View active subscription seats allocated. Standard data privacy restrictions filter individual journaling texts to protect anonymity.
            </Text>
          </View>

          {isListLoading ? (
            <ActivityIndicator color={Theme.colors.primary} style={{ marginTop: 24 }} />
          ) : !membersData?.members || membersData.members.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Users size={40} color={Theme.colors.outline} />
              <Text style={styles.emptyText}>No verified members found in your workspace.</Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {membersData.members.map((m: any) => (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => handleOpenMember(m)}
                  style={styles.memberRow}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {m.name ? m.name.charAt(0).toUpperCase() : 'U'}
                    </Text>
                  </View>

                  <View style={styles.memberInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.memberName}>{m.name || 'Unnamed Member'}</Text>
                      {m.role === 'therapist' ? (
                        <View style={styles.badgeTherapist}>
                          <Text style={styles.badgeTherapistText}>Therapist</Text>
                        </View>
                      ) : (
                        <View style={styles.badgeEmployee}>
                          <Text style={styles.badgeEmployeeText}>Employee</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.memberSub}>
                      {m.email || m.phoneMasked || 'No address'} · {m.department || 'General'}
                    </Text>
                  </View>

                  <ChevronRight size={16} color={Theme.colors.outline} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Member Details Modal Sheet */}
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
              <View>
                <Text style={styles.modalTitle}>{selectedMember?.name || 'Member Details'}</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedMember?.role === 'therapist' ? 'Affiliated Provider' : 'Verified Employee'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color={Theme.colors.onSurface} />
              </TouchableOpacity>
            </View>

            {isDetailLoading ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={Theme.colors.primary} />
                <Text style={styles.loaderText}>Fetching clinical engagement stats...</Text>
              </View>
            ) : detailData ? (
              <ScrollView contentContainerStyle={styles.modalScroll}>
                {/* Micro Bento Grid Stats */}
                <View style={styles.grid}>
                  <View style={styles.gridCard}>
                    <TrendingUp size={20} color={Theme.colors.primary} />
                    <Text style={styles.gridVal}>{detailData.wellness?.avgMood ?? '—'}</Text>
                    <Text style={styles.gridLabel}>Avg Mood (10)</Text>
                  </View>
                  <View style={styles.gridCard}>
                    <Calendar size={20} color={Theme.colors.secondary} />
                    <Text style={styles.gridVal}>{detailData.wellness?.sessionCount ?? 0}</Text>
                    <Text style={styles.gridLabel}>Clinical Sessions</Text>
                  </View>
                  <View style={styles.gridCard}>
                    <BookOpen size={20} color={Theme.colors.outline} />
                    <Text style={styles.gridVal}>{detailData.wellness?.journalCount ?? 0}</Text>
                    <Text style={styles.gridLabel}>Journals Logs</Text>
                  </View>
                </View>

                {/* Privacy Banner */}
                <View style={styles.privacyBanner}>
                  <ShieldAlert size={14} color="#856404" />
                  <Text style={styles.privacyText}>
                    Individual journal contents are fully encrypted for patient privacy. Only quantitative scores and high-level trends are visible.
                  </Text>
                </View>

                {/* Mood Check-ins */}
                <View style={styles.moodSection}>
                  <Text style={styles.sectionHeader}>Recent Mood Check-ins</Text>
                  {!detailData.wellness?.moodHistory || detailData.wellness.moodHistory.length === 0 ? (
                    <Text style={styles.noHistoryText}>No mood check-ins logged recently.</Text>
                  ) : (
                    detailData.wellness.moodHistory.slice(0, 5).map((m: any, i: number) => (
                      <View key={i} style={styles.historyRow}>
                        <View style={styles.emojiCircle}>
                          <Text style={styles.emojiVal}>{getMoodEmoji(m.score)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.historyNote}>{m.note || 'No note provided'}</Text>
                          <Text style={styles.historyDate}>
                            {new Date(m.createdAt).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </Text>
                        </View>
                        <Text style={styles.historyScore}>{m.score}/10</Text>
                      </View>
                    ))
                  )}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.errorContainer}>
                <ShieldAlert size={36} color={Theme.colors.outline} />
                <Text style={styles.errorText}>Could not load wellness logs for this member.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  scrollContent: {
    padding: Theme.spacing.margin,
    paddingBottom: 60,
    gap: Theme.spacing.md
  },
  headerSection: {
    gap: 4
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    gap: 8
  },
  emptyText: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.outline,
    textAlign: 'center',
    paddingHorizontal: 20
  },
  listContainer: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    overflow: 'hidden'
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceHigh
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E6F4F1',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
    color: Theme.colors.primary
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
    gap: 2
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  memberName: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
    color: Theme.colors.onSurface
  },
  memberSub: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.textMuted
  },
  badgeTherapist: {
    backgroundColor: '#E6F4F1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  badgeTherapistText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 9,
    color: Theme.colors.primary
  },
  badgeEmployee: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  badgeEmployeeText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 9,
    color: Theme.colors.outline
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    paddingBottom: 24
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceHigh
  },
  modalTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 18,
    color: Theme.colors.onSurface
  },
  modalSubtitle: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.outline,
    marginTop: 2
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.colors.surfaceLow,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalScroll: {
    padding: 20,
    gap: 20
  },
  grid: {
    flexDirection: 'row',
    gap: 8
  },
  gridCard: {
    flex: 1,
    backgroundColor: Theme.colors.surfaceLow,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    padding: 12,
    alignItems: 'center',
    gap: 4
  },
  gridVal: {
    fontFamily: Theme.fonts.display,
    fontSize: 22,
    color: Theme.colors.onSurface,
    marginTop: 2
  },
  gridLabel: {
    fontFamily: Theme.fonts.body,
    fontSize: 10,
    color: Theme.colors.outline,
    textAlign: 'center'
  },
  privacyBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFE082',
    borderRadius: Theme.radius.lg,
    padding: 12,
    gap: 8
  },
  privacyText: {
    flex: 1,
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: '#856404',
    lineHeight: 15
  },
  moodSection: {
    gap: 12
  },
  noHistoryText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 10
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceHigh
  },
  emojiCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.surfaceLow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh
  },
  emojiVal: {
    fontSize: 18
  },
  historyNote: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 13,
    color: Theme.colors.onSurface
  },
  historyDate: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 2
  },
  historyScore: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
    color: Theme.colors.primary
  },
  loaderContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 12
  },
  loaderText: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.outline
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 12
  },
  errorText: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.outline,
    textAlign: 'center'
  }
});

export default OrgMembersScreen;
