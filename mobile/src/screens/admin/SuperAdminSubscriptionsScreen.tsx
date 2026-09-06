import React, { useState } from 'react';
import { View, StyleSheet, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Search, DollarSign, Calendar, RefreshCcw, Sparkles, Building, Award, CheckCircle } from 'lucide-react-native';
import API from '../../lib/api';
import { Theme } from '../../theme';
import { AppHeader } from '../../components/AppHeader';

export const SuperAdminSubscriptionsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'cancelled'>('all');
  const [audienceFilter, setAudienceFilter] = useState<'all' | 'user' | 'therapist' | 'organization'>('all');

  // Fetch all active system-wide subscriptions from database
  const { data: subscriptionRes, isLoading } = useQuery({
    queryKey: ['adminSubscriptions'],
    queryFn: () => API.subscription.admin.all().catch(() => null),
    retry: false
  });

  const subsList = Array.isArray(subscriptionRes)
    ? subscriptionRes
    : (subscriptionRes?.subscriptions && Array.isArray(subscriptionRes.subscriptions) ? subscriptionRes.subscriptions : []);

  // Filter based on search queries and selected pills
  const filteredSubs = subsList.filter((s: any) => {
    const subscriberName = s.userId?.fullName || s.orgId?.name || 'Unnamed Subscriber';
    const email = s.userId?.email || s.orgId?.officialEmail || '';
    const tier = s.planId?.name || s.plan || '';
    const role = s.userId?.role || (s.orgId ? 'org_admin' : 'user');
    const status = s.status || 'active';

    const matchesSearch = subscriberName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tier.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || status.toLowerCase() === statusFilter;

    let matchesAudience = true;
    if (audienceFilter === 'therapist') {
      matchesAudience = role === 'therapist';
    } else if (audienceFilter === 'organization') {
      matchesAudience = role === 'org_admin' || !!s.orgId;
    } else if (audienceFilter === 'user') {
      matchesAudience = role === 'user';
    }

    return matchesSearch && matchesStatus && matchesAudience;
  });

  // Dynamic billing stats from database
  const activeSubsCount = subsList.filter((s: any) => s.status === 'active').length;
  const pendingSubsCount = subsList.filter((s: any) => s.status === 'pending').length;
  const cancelledSubsCount = subsList.filter((s: any) => s.status === 'cancelled').length;
  const cumulativeMRR = subsList
    .filter((s: any) => s.status === 'active')
    .reduce((sum: number, s: any) => sum + Number(s.planId?.price || 0), 0);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return '#E8F5E9';
      case 'cancelled':
        return '#FFEBEE';
      default:
        return '#FFF3E0';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return '#2E7D32';
      case 'cancelled':
        return '#C62828';
      default:
        return '#EF6C00';
    }
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
        <View style={styles.headerSection}>
          <Text style={styles.sectionHeader}>Billing & Subscriptions</Text>
          <Text style={styles.sectionDesc}>Track subscriber enrollment, recurring revenue, and renew logs.</Text>
        </View>

        {/* Dynamic Billing Overview Cards */}
        <View style={styles.overviewGrid}>
          <View style={styles.overviewCard}>
            <Text style={styles.overviewVal}>₹{cumulativeMRR}</Text>
            <Text style={styles.overviewLabel}>Active MRR</Text>
          </View>
          <View style={styles.overviewCard}>
            <Text style={styles.overviewVal}>{activeSubsCount}</Text>
            <Text style={styles.overviewLabel}>Active</Text>
          </View>
          <View style={styles.overviewCard}>
            <Text style={styles.overviewVal}>{pendingSubsCount}</Text>
            <Text style={styles.overviewLabel}>Pending</Text>
          </View>
          <View style={styles.overviewCard}>
            <Text style={styles.overviewVal}>{cancelledSubsCount}</Text>
            <Text style={styles.overviewLabel}>Cancelled</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={16} color={Theme.colors.outline} />
          <TextInput
            placeholder="Search by subscriber, email, or tier..."
            placeholderTextColor={Theme.colors.outline}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
        </View>

        {/* Dynamic Filters Segmented Control */}
        <View style={styles.filterSection}>
          <View style={styles.filterRow}>
            <Text style={styles.filterRowLabel}>Status:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRowScroll}>
              {(['all', 'active', 'pending', 'cancelled'] as const).map((status) => (
                <TouchableOpacity
                  key={status}
                  onPress={() => setStatusFilter(status)}
                  style={[
                    styles.filterPill,
                    statusFilter === status && styles.filterPillActive
                  ]}
                >
                  <Text style={[
                    styles.filterPillText,
                    statusFilter === status && styles.filterPillTextActive
                  ]}>
                    {status.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterRowLabel}>Role:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRowScroll}>
              {(['all', 'user', 'therapist', 'organization'] as const).map((aud) => (
                <TouchableOpacity
                  key={aud}
                  onPress={() => setAudienceFilter(aud)}
                  style={[
                    styles.filterPill,
                    audienceFilter === aud && styles.filterPillActive
                  ]}
                >
                  <Text style={[
                    styles.filterPillText,
                    audienceFilter === aud && styles.filterPillTextActive
                  ]}>
                    {aud === 'user' ? 'SEEKER' : aud.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={Theme.colors.primary} />
            <Text style={styles.loadingText}>Structuring billing registers...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.listScroll}>
            {filteredSubs.length > 0 ? (
              filteredSubs.map((s: any) => {
                const subName = s.userId?.fullName || s.orgId?.name || 'mymindtherapyfriend User';
                const subEmail = s.userId?.email || s.orgId?.officialEmail || 'Not Provided';
                const price = s.planId?.price || 0;
                const renewDate = s.endDate ? new Date(s.endDate).toLocaleDateString() : 'N/A';
                const isOrg = s.userId?.role === 'org_admin' || !!s.orgId;
                const isTherapist = s.userId?.role === 'therapist';

                return (
                  <View key={s._id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={[styles.avatar, isOrg && styles.avatarOrg, isTherapist && styles.avatarTherapist]}>
                        {isOrg ? (
                          <Building size={16} color={Theme.colors.primary} />
                        ) : isTherapist ? (
                          <Award size={16} color="#7B1FA2" />
                        ) : (
                          <Sparkles size={16} color={Theme.colors.secondary} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>{subName}</Text>
                        <Text style={styles.cardSub}>{subEmail}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(s.status || 'active') }]}>
                        <Text style={[styles.statusText, { color: getStatusTextColor(s.status || 'active') }]}>
                          {(s.status || 'ACTIVE').toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    {/* Pricing Info Boxes */}
                    <View style={styles.detailsBox}>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Subscription Tier:</Text>
                        <Text style={styles.detailValue}>{(s.planId?.name || s.plan || 'Mann Shanti').toUpperCase()}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Monthly Price:</Text>
                        <Text style={styles.detailValue}>₹{price}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Next Renewal:</Text>
                        <Text style={styles.detailValue}>{renewDate}</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyContainer}>
                <CheckCircle size={36} color={Theme.colors.outline} />
                <Text style={styles.emptyText}>No matching subscription registries found.</Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
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
  overviewGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    alignItems: 'center',
    gap: 2,
  },
  overviewVal: {
    fontFamily: Theme.fonts.display,
    fontSize: 18,
    color: Theme.colors.onSurface,
    fontWeight: '700',
  },
  overviewLabel: {
    fontFamily: Theme.fonts.body,
    fontSize: 10.5,
    color: Theme.colors.textMuted,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Theme.colors.onSurface,
    fontFamily: Theme.fonts.body,
  },
  listScroll: {
    gap: Theme.spacing.md,
    paddingBottom: 80,
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
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOrg: {
    backgroundColor: Theme.colors.primary + '10',
  },
  avatarTherapist: {
    backgroundColor: '#F3E5F5',
  },
  cardTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  cardSub: {
    fontFamily: Theme.fonts.body,
    fontSize: 11.5,
    color: Theme.colors.textMuted,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Theme.radius.sm,
  },
  statusText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 9,
  },
  detailsBox: {
    backgroundColor: Theme.colors.surfaceLow,
    borderRadius: Theme.radius.lg,
    padding: 10,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontFamily: Theme.fonts.body,
    fontSize: 11.5,
    color: Theme.colors.outline,
  },
  detailValue: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 12,
    color: Theme.colors.onSurface,
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    gap: 8,
    marginTop: 10,
  },
  emptyText: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.outline,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  filterSection: {
    gap: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    padding: 10,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterRowLabel: {
    fontFamily: Theme.fonts.headline,
    fontSize: 11,
    color: Theme.colors.outline,
    width: 50,
  },
  filterRowScroll: {
    gap: 6,
    alignItems: 'center',
  },
  filterPill: {
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: Theme.colors.surfaceLow,
  },
  filterPillActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  filterPillText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 9.5,
    color: Theme.colors.outline,
  },
  filterPillTextActive: {
    color: '#FFF',
  },
});

export default SuperAdminSubscriptionsScreen;
