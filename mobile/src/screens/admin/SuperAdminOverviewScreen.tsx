import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, ShieldCheck, DollarSign, Users, Activity, Heart, ArrowUpRight } from 'lucide-react-native';
import API from '../../lib/api';
import { Theme } from '../../theme';
import { AppHeader } from '../../components/AppHeader';
import { StatCard } from '../../components/StatCard';

interface CrisisFlag {
  _id: string;
  userId: {
    _id: string;
    name: string;
  };
  keyword: string;
  context: string;
  createdAt: string;
}

export const SuperAdminOverviewScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const [crisisFlags, setCrisisFlags] = useState<CrisisFlag[]>([]);

  // Fetch admin stats from dynamic database
  const { data: adminStats, isLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: () => API.admin.stats(),
    retry: false,
  });

  useEffect(() => {
    if (adminStats?.crisisFlags) {
      setCrisisFlags(adminStats.crisisFlags);
    }
  }, [adminStats]);

  const mrr = adminStats?.mrr || 0;
  const userCount = adminStats?.users || adminStats?.totalUsers || 0;
  const activeOrgsCount = adminStats?.totalOrgs || 0;
  const activeTherapistsCount = adminStats?.totalTherapists || 0;

  const handleResolveFlag = (id: string, userName: string) => {
    Alert.alert(
      'Resolve Crisis Flag',
      `Mark emergency outreach for ${userName} as resolved? Physical helpline lists will remain visible.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Resolve', 
          onPress: () => {
            setCrisisFlags(prev => prev.filter(c => c._id !== id));
            Alert.alert('Resolved', 'Crisis flag resolved.');
          } 
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader
        userFirstName="Super Admin"
        role="super_admin"
        navigation={navigation}
      />

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={Theme.colors.error} />
          <Text style={styles.loaderText}>Analyzing platform stats...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header Description */}
          <View style={styles.headerSection}>
            <Text style={styles.sectionHeader}>Supercontrol Overview</Text>
            <Text style={styles.sectionDesc}>Real-time system health metrics, MRR statistics, and safety alerts.</Text>
          </View>

          {/* 2x2 Stats Bento Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard
                title="Monthly Recurring Revenue"
                value={`₹${mrr}`}
                trend={14}
                trendLabel="vs last month"
                icon={<DollarSign size={18} color={Theme.colors.primary} />}
                color={Theme.colors.primary}
              />
              <StatCard
                title="Total Seekers"
                value={userCount.toString()}
                trend={8}
                trendLabel="active accounts"
                icon={<Users size={18} color={Theme.colors.secondary} />}
                color={Theme.colors.secondary}
              />
            </View>
            <View style={styles.statsRow}>
              <StatCard
                title="Verified Organizations"
                value={activeOrgsCount.toString()}
                trend={2}
                trendLabel="wellness sponsors"
                icon={<Activity size={18} color="#D32F2F" />}
                color="#D32F2F"
              />
              <StatCard
                title="Clinical Practitioners"
                value={activeTherapistsCount.toString()}
                trend={5}
                trendLabel="linked specialists"
                icon={<Heart size={18} color="#7B1FA2" />}
                color="#7B1FA2"
              />
            </View>
          </View>

          {/* Active Crisis Alerts Flags */}
          <View style={[styles.card, styles.crisisCard]}>
            <View style={styles.crisisHead}>
              <ShieldAlert size={18} color={Theme.colors.error} />
              <Text style={[styles.sectionHeader, styles.crisisText]}>Active Crisis Alert Flags</Text>
            </View>
            <Text style={styles.sectionDesc}>
              These journal keyword triggers require immediate attention or verification:
            </Text>

            <View style={styles.list}>
              {crisisFlags.map(flag => (
                <View key={flag._id} style={styles.crisisItem}>
                  <View style={styles.crisisMetaRow}>
                    <Text style={styles.crisisUser}>{flag.userId.name}</Text>
                    <View style={styles.keywordBadge}>
                      <Text style={styles.keywordText}>TRIGGER: {flag.keyword.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={styles.contextText}>"{flag.context}"</Text>
                  
                  <TouchableOpacity 
                    onPress={() => handleResolveFlag(flag._id, flag.userId.name)}
                    style={styles.resolveBtn}
                  >
                    <ShieldCheck size={14} color="#FFF" />
                    <Text style={styles.resolveBtnText}>Mark Outreach Resolved</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {crisisFlags.length === 0 && (
                <Text style={styles.emptyText}>Zero active crisis flags. Healthy environment.</Text>
              )}
            </View>
          </View>
        </ScrollView>
      )}
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
  statsGrid: {
    gap: Theme.spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
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
  crisisCard: {
    borderColor: Theme.colors.errorContainer,
    borderWidth: 1.5,
  },
  crisisHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  crisisText: {
    color: Theme.colors.error,
  },
  list: {
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.xs,
  },
  crisisItem: {
    backgroundColor: Theme.colors.errorContainer + '10',
    borderWidth: 1,
    borderColor: Theme.colors.errorContainer + '30',
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.sm,
    gap: 8,
  },
  crisisMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  crisisUser: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  keywordBadge: {
    backgroundColor: Theme.colors.error,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Theme.radius.sm,
  },
  keywordText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 9,
    color: '#FFF',
  },
  contextText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  resolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Theme.colors.error,
    paddingVertical: 8,
    borderRadius: Theme.radius.full,
  },
  resolveBtnText: {
    color: '#FFF',
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
  },
  emptyText: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    paddingVertical: Theme.spacing.xs,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loaderText: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.outline,
  }
});

export default SuperAdminOverviewScreen;
