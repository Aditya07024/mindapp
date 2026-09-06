import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus,
  Users,
  Search,
  CheckCircle,
  Clock,
  Trash2,
  Award,
  Shield,
  FileText,
  ExternalLink
} from 'lucide-react-native';
import API from '../../lib/api';
import { Theme } from '../../theme';
import { AppHeader } from '../../components/AppHeader';

export const OrgTherapistsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'pending' | 'invite' | 'sent'>('pending');
  const [extSearch, setExtSearch] = useState('');
  const [extTherapists, setExtTherapists] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Subscription check query
  const { data: subData, isLoading: isSubLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => API.subscription.get().catch(() => null),
    retry: false
  });

  const isSubscribed = subData?.subscription?.status === 'active';
  const hasAffiliationFeature = subData?.config?.enableTherapistAffiliation !== false;

  // Queries
  const { data: pendingData, isLoading: isPendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ['org-pending-therapists'],
    queryFn: () => API.org.pendingTherapists(),
    retry: false
  });

  const { data: invitationsData, refetch: refetchInvitations } = useQuery({
    queryKey: ['org-invitations'],
    queryFn: () => API.org.invitations(),
    retry: false
  });

  // Mutations
  const inviteMutation = useMutation({
    mutationFn: (therapistId: string) => API.org.inviteTherapist({ therapistId }),
    onSuccess: () => {
      Alert.alert('Success', 'Invitation sent successfully!');
      refetchInvitations();
      // Clear or update local search status
      setExtTherapists(prev => prev.map(t => t.id === inviteMutation.variables ? { ...t, alreadyInvited: true } : t));
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to send invitation');
    }
  });

  const cancelInviteMutation = useMutation({
    mutationFn: (id: string) => API.org.cancelInvitation(id),
    onSuccess: () => {
      Alert.alert('Cancelled', 'Invitation successfully cancelled.');
      refetchInvitations();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to cancel invitation');
    }
  });

  useEffect(() => {
    if (activeTab === 'invite') {
      handleSearchExternal();
    }
  }, [activeTab, invitationsData]);

  const handleVerifyTherapist = async (id: string, verified: boolean) => {
    setActionLoading(id);
    try {
      await API.org.verifyTherapist(id, { verified });
      Alert.alert(
        verified ? 'Approved' : 'Rejected',
        `Therapist has been successfully ${verified ? 'approved' : 'rejected'}.`
      );
      refetchPending();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSearchExternal = async (queryText = extSearch) => {
    setIsSearching(true);
    try {
      const res = await API.therapist.list({ 
        search: queryText.trim() || undefined,
        openToCollaboration: true 
      });
      
      const invitedIds = (invitationsData?.invitations || []).map((inv: any) => 
        typeof inv.therapistId === 'object' ? inv.therapistId?._id || inv.therapistId?.id : inv.therapistId
      );
      
      const mapped = (res.therapists || []).map((t: any) => ({
        ...t,
        alreadyInvited: invitedIds.includes(t.id || t._id)
      }));
      
      setExtTherapists(mapped);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleOpenDoc = (url: string) => {
    if (url) {
      Linking.openURL(url).catch(() => Alert.alert('Error', 'Cannot open document URL'));
    } else {
      Alert.alert('Not Available', 'Document link is not set.');
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        userFirstName="BITS Wellness"
        role="org_admin"
        navigation={navigation}
      />

      {/* Tabs segment */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => setActiveTab('pending')}
          style={[styles.tabButton, activeTab === 'pending' && styles.activeTabButton]}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>Pending</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('invite')}
          style={[styles.tabButton, activeTab === 'invite' && styles.activeTabButton]}
        >
          <Text style={[styles.tabText, activeTab === 'invite' && styles.activeTabText]}>Invite New</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('sent')}
          style={[styles.tabButton, activeTab === 'sent' && styles.activeTabButton]}
        >
          <Text style={[styles.tabText, activeTab === 'sent' && styles.activeTabText]}>Sent Invites</Text>
        </TouchableOpacity>
      </View>

      {isSubLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
        </View>
      ) : !isSubscribed || !hasAffiliationFeature ? (
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
              <Shield size={24} color={Theme.colors.primary} />
            </View>
            <Text style={{ fontFamily: Theme.fonts.headline, fontSize: 18, color: Theme.colors.onSurface, textAlign: 'center', marginBottom: 8 }}>
              {!isSubscribed ? 'Corporate Plan Required' : 'Affiliation Network Locked'}
            </Text>
            <Text style={{ fontFamily: Theme.fonts.body, fontSize: 13, color: Theme.colors.textMuted, textAlign: 'center', lineHeight: 18, paddingHorizontal: 16, marginBottom: 20 }}>
              {!isSubscribed 
                ? 'As an organization or wellness sponsor, you need an active subscription plan to activate employee wellness seats and link network practitioners.'
                : 'Your current subscription plan tier does not include the independent therapist affiliation network feature. Upgrade to link external certified practitioners.'}
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
                {!isSubscribed ? 'View Subscription Plans' : 'Upgrade Plan'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {activeTab === 'pending' && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Pending Affiliations</Text>
              <Text style={styles.sectionDesc}>
                Review and approve independent therapists seeking to link with your organization.
              </Text>

              {isPendingLoading ? (
                <ActivityIndicator color={Theme.colors.primary} style={{ marginTop: 24 }} />
              ) : !pendingData?.therapists || pendingData.therapists.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Clock size={40} color={Theme.colors.outline} />
                  <Text style={styles.emptyText}>No pending therapists at this time.</Text>
                </View>
              ) : (
                pendingData.therapists.map((t: any) => (
                  <View key={t.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View>
                        <Text style={styles.therapistName}>{t.name}</Text>
                        <Text style={styles.therapistEmail}>{t.email}</Text>
                      </View>
                      <View style={styles.badgePending}>
                        <Text style={styles.badgePendingText}>PENDING</Text>
                      </View>
                    </View>

                    <View style={styles.detailsList}>
                      <View style={styles.detailRow}>
                        <Award size={14} color={Theme.colors.primary} />
                        <Text style={styles.detailText}>
                          <Text style={styles.boldText}>Qualification: </Text>
                          {t.qualification || 'N/A'}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Award size={14} color={Theme.colors.secondary} />
                        <Text style={styles.detailText}>
                          <Text style={styles.boldText}>Experience: </Text>
                          {t.experienceYears || '0'} years
                        </Text>
                      </View>
                      {t.specializations && t.specializations.length > 0 && (
                        <View style={styles.detailRow}>
                          <Award size={14} color={Theme.colors.outline} />
                          <Text style={styles.detailText} numberOfLines={2}>
                            <Text style={styles.boldText}>Specialisations: </Text>
                            {t.specializations.join(', ')}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Documents Row */}
                    <View style={styles.docsRow}>
                      {t.documents?.degreeUrl && (
                        <TouchableOpacity
                          style={styles.docButton}
                          onPress={() => handleOpenDoc(t.documents.degreeUrl)}
                        >
                          <FileText size={12} color={Theme.colors.primary} />
                          <Text style={styles.docButtonText}>Degree</Text>
                          <ExternalLink size={10} color={Theme.colors.primary} />
                        </TouchableOpacity>
                      )}
                      {t.documents?.licenseUrl && (
                        <TouchableOpacity
                          style={styles.docButton}
                          onPress={() => handleOpenDoc(t.documents.licenseUrl)}
                        >
                          <FileText size={12} color={Theme.colors.primary} />
                          <Text style={styles.docButtonText}>License</Text>
                          <ExternalLink size={10} color={Theme.colors.primary} />
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        disabled={actionLoading !== null}
                        onPress={() => handleVerifyTherapist(t.id, true)}
                        style={[styles.btnApprove, actionLoading === t.id && styles.btnDisabled]}
                      >
                        {actionLoading === t.id ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <Text style={styles.btnApproveText}>Verify & Approve</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        disabled={actionLoading !== null}
                        onPress={() => handleVerifyTherapist(t.id, false)}
                        style={[styles.btnReject, actionLoading === t.id && styles.btnDisabled]}
                      >
                        <Text style={styles.btnRejectText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {activeTab === 'invite' && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Invite Independent Therapists</Text>
              <Text style={styles.sectionDesc}>
                Search for external certified practitioners on MyMindTherapyFriend and link them to your network.
              </Text>

              <View style={styles.searchBar}>
                <TextInput
                  placeholder="Search by name, specialisation, or degree..."
                  placeholderTextColor={Theme.colors.outline}
                  value={extSearch}
                  onChangeText={setExtSearch}
                  style={styles.searchInput}
                />
                <TouchableOpacity
                  onPress={handleSearchExternal}
                  disabled={isSearching}
                  style={styles.searchBtn}
                >
                  {isSearching ? <ActivityIndicator color="#FFF" /> : <Search size={18} color="#FFF" />}
                </TouchableOpacity>
              </View>

              {extTherapists.length > 0 ? (
                <View style={styles.resultsContainer}>
                  <Text style={styles.resultsTitle}>Search Results</Text>
                  {extTherapists.map((t: any) => {
                    const isAlreadyLinked = !!t.orgId;
                    const isInvited = t.alreadyInvited;

                    return (
                      <View key={t.id} style={styles.resultCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.resultName}>{t.name}</Text>
                          <Text style={styles.resultDesc}>
                            {t.qualification} · {t.experienceYears} yrs exp
                          </Text>
                        </View>
                        <TouchableOpacity
                          disabled={inviteMutation.isPending || isAlreadyLinked || isInvited}
                          onPress={() => inviteMutation.mutate(t.id)}
                          style={[
                            styles.inviteBtn,
                            (isAlreadyLinked || isInvited) && styles.inviteBtnDisabled
                          ]}
                        >
                          <Text style={styles.inviteBtnText}>
                            {isAlreadyLinked ? 'Linked' : isInvited ? 'Invited' : 'Send Invite'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              ) : (
                extSearch.trim() !== '' && !isSearching && (
                  <Text style={styles.noResultsText}>No therapists found matching "{extSearch}"</Text>
                )
              )}
            </View>
          )}

          {activeTab === 'sent' && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Sent Invitations</Text>
              <Text style={styles.sectionDesc}>
                Track pending, accepted, or rejected invitation requests dispatched to external practitioners.
              </Text>

              {!invitationsData?.invitations || invitationsData.invitations.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Clock size={40} color={Theme.colors.outline} />
                  <Text style={styles.emptyText}>No sent invitations found.</Text>
                </View>
              ) : (
                invitationsData.invitations.map((inv: any) => {
                  const status = inv.status || 'pending';
                  const therapistName = inv.therapistId?.fullName || inv.therapistId?.name || 'Therapist';

                  return (
                    <View key={inv._id} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View>
                          <Text style={styles.therapistName}>{therapistName}</Text>
                          <Text style={styles.therapistEmail}>
                            Sent: {new Date(inv.createdAt).toLocaleDateString()}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.badgeStatus,
                            status === 'accepted' ? styles.badgeAccepted :
                            status === 'rejected' ? styles.badgeRejected : styles.badgePending
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeStatusText,
                              status === 'accepted' ? styles.badgeAcceptedText :
                              status === 'rejected' ? styles.badgeRejectedText : styles.badgePendingText
                            ]}
                          >
                            {status.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      {status === 'pending' && (
                        <TouchableOpacity
                          disabled={cancelInviteMutation.isPending}
                          onPress={() => cancelInviteMutation.mutate(inv._id)}
                          style={styles.btnCancelInvite}
                        >
                          <Trash2 size={14} color="#FF6B6B" />
                          <Text style={styles.btnCancelInviteText}>Cancel Invitation</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceHigh,
    paddingHorizontal: 8
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  activeTabButton: {
    borderBottomColor: Theme.colors.primary
  },
  tabText: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 13,
    color: Theme.colors.outline
  },
  activeTabText: {
    fontFamily: Theme.fonts.headline,
    color: Theme.colors.primary
  },
  scrollContent: {
    padding: Theme.spacing.margin,
    paddingBottom: 60,
    gap: Theme.spacing.md
  },
  section: {
    gap: Theme.spacing.xs
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
    lineHeight: 16,
    marginBottom: Theme.spacing.sm
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
    color: Theme.colors.outline
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: Theme.spacing.sm,
    gap: Theme.spacing.sm
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  therapistName: {
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
    color: Theme.colors.onSurface
  },
  therapistEmail: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.outline,
    marginTop: 1
  },
  badgePending: {
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  badgePendingText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 10,
    color: '#856404'
  },
  badgeStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  badgeStatusText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 10
  },
  badgeAccepted: {
    backgroundColor: '#D4EDDA'
  },
  badgeAcceptedText: {
    color: '#155724'
  },
  badgeRejected: {
    backgroundColor: '#F8D7DA'
  },
  badgeRejectedText: {
    color: '#721C24'
  },
  detailsList: {
    gap: 6
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  detailText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant
  },
  boldText: {
    fontFamily: Theme.fonts.headline
  },
  docsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2
  },
  docButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceLow,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh
  },
  docButtonText: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 11,
    color: Theme.colors.primary
  },
  actionRow: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.surfaceHigh,
    paddingTop: Theme.spacing.sm,
    marginTop: 2
  },
  btnApprove: {
    flex: 2,
    height: 38,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.lg,
    justifyContent: 'center',
    alignItems: 'center'
  },
  btnApproveText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 12,
    color: '#FFF'
  },
  btnReject: {
    flex: 1,
    height: 38,
    backgroundColor: '#FFF5F5',
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: '#FFE3E3',
    justifyContent: 'center',
    alignItems: 'center'
  },
  btnRejectText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 12,
    color: '#FF6B6B'
  },
  btnDisabled: {
    opacity: 0.7
  },
  searchBar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4
  },
  searchInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: Theme.fonts.body,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceLow
  },
  searchBtn: {
    width: 48,
    height: 48,
    borderRadius: Theme.radius.lg,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center'
  },
  resultsContainer: {
    marginTop: Theme.spacing.md,
    gap: Theme.spacing.sm
  },
  resultsTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 12,
    color: Theme.colors.outline,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  resultCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh
  },
  resultName: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
    color: Theme.colors.onSurface
  },
  resultDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 2
  },
  inviteBtn: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  inviteBtnDisabled: {
    borderColor: Theme.colors.surfaceHigh,
    backgroundColor: Theme.colors.surfaceLow
  },
  inviteBtnText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 11,
    color: Theme.colors.primary
  },
  noResultsText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 20
  },
  btnCancelInvite: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFE3E3',
    borderRadius: Theme.radius.lg,
    paddingVertical: 10,
    gap: 6,
    marginTop: 4
  },
  btnCancelInviteText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 12,
    color: '#FF6B6B'
  }
});

export default OrgTherapistsScreen;
