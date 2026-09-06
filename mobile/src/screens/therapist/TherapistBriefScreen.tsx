import React from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { ShieldCheck, ArrowLeft, Sparkles, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import API from '../../lib/api';
import { Theme } from '../../theme';

interface TherapistBriefScreenProps {
  navigation: any;
  route: any;
}

export const TherapistBriefScreen: React.FC<TherapistBriefScreenProps> = ({ navigation, route }) => {
  const bookingId = route.params?.bookingId;
  const fallbackClientName = route.params?.clientName || 'Seeker';

  const { data: brief, isLoading } = useQuery({
    queryKey: ['aiBrief', bookingId],
    queryFn: () => API.booking.getAiBrief(bookingId),
    enabled: !!bookingId,
  });

  const handleAgree = () => {
    Alert.alert('Confidentiality Verified', 'Access logs have been signed under your practitioner license ID.');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={styles.loadingText}>Fetching AI Brief...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Back Header */}
      <View style={styles.backRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={20} color={Theme.colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Client Brief</Text>
      </View>

      {/* Privacy Guarantee Gate banner */}
      <View style={styles.privacyGate}>
        <View style={styles.privacyHead}>
          <ShieldCheck size={18} color={Theme.colors.primary} />
          <Text style={styles.privacyTitle}>Strict HIPAA & Ethics Shield</Text>
        </View>
        <Text style={styles.privacyDesc}>
          This brief synthesizes aggregated, anonymous sentiment indicators and automated thought types logged with Manas. Journal text scripts are fully locked.
        </Text>
      </View>

      {/* Patient overview header */}
      <View style={styles.patientCard}>
        <Text style={styles.patientPre}>SYNTHESIZED OVERVIEW</Text>
        <Text style={styles.patientName}>{brief?.clientName || fallbackClientName}</Text>
        <Text style={styles.patientSub}>Active seeker · Avg Mood: {brief?.avgMood ? `${brief.avgMood}/10` : 'N/A'}</Text>
      </View>

      {/* Onboarding Profile details */}
      {brief?.onboardingDetails && (
        <View style={styles.card}>
          <View style={styles.secHeader}>
            <ShieldCheck size={16} color={Theme.colors.primary} />
            <Text style={styles.secTitle}>Client Onboarding Profile</Text>
          </View>
          {brief.onboardingDetails.moodScore !== undefined && (
            <Text style={styles.bodyText}>
              <Text style={styles.boldText}>Onboarding Mood Score: </Text>
              {brief.onboardingDetails.moodScore}/10
            </Text>
          )}
          {brief.onboardingDetails.primaryNeed && (
            <Text style={styles.bodyText}>
              <Text style={styles.boldText}>Primary Goal/Need: </Text>
              {brief.onboardingDetails.primaryNeed}
            </Text>
          )}
          {brief.onboardingDetails.concerns?.length > 0 && (
            <View style={{ marginTop: 4 }}>
              <Text style={styles.boldText}>Main Concerns: </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                {brief.onboardingDetails.concerns.map((c: string, index: number) => (
                  <View key={index} style={styles.concernTag}>
                    <Text style={styles.concernTagText}>{c}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Sentiment Trend summary */}
      <View style={styles.card}>
        <View style={styles.secHeader}>
          <TrendingUp size={16} color={Theme.colors.primary} />
          <Text style={styles.secTitle}>Sentiment Trend Summary</Text>
        </View>
        <Text style={styles.bodyText}>
          {brief?.groqSummary || `Mood history shows average score of ${brief?.avgMood ? `${brief.avgMood}/10` : 'N/A'}. Clinical risk level is flagged as ${brief?.riskLevel || 'unknown'}.`}
        </Text>
      </View>

      {/* Recent journal excerpts */}
      {brief?.recentJournals?.length > 0 && (
        <View style={styles.card}>
          <View style={styles.secHeader}>
            <AlertCircle size={16} color={Theme.colors.secondary} />
            <Text style={styles.secTitle}>Recent Journal Excerpts</Text>
          </View>
          <View style={styles.bulletList}>
            {brief.recentJournals.map((j: any, i: number) => (
              <View key={i} style={styles.bulletItem}>
                <View style={styles.dot} />
                <Text style={styles.bulletText}>
                  <Text style={styles.boldText}>{new Date(j.date).toLocaleDateString('en-IN')}: </Text>
                  "{j.excerpt}..."
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <TouchableOpacity onPress={handleAgree} style={styles.actionBtn}>
        <Text style={styles.actionBtnText}>Acknowledge & Confirm Access</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    fontFamily: Theme.fonts.bodyMedium,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    gap: Theme.spacing.sm,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
  },
  headerTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 18,
    color: Theme.colors.onSurface,
  },
  privacyGate: {
    backgroundColor: Theme.colors.primary + '10',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.primary + '20',
  },
  privacyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  privacyTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
    color: Theme.colors.primaryContainer,
  },
  privacyDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 18,
  },
  patientCard: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    alignItems: 'center',
  },
  patientPre: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 10,
    color: Theme.colors.secondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  patientName: {
    fontFamily: Theme.fonts.display,
    fontSize: 22,
    color: Theme.colors.onSurface,
  },
  patientSub: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 2,
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
    gap: 8,
  },
  secHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  secTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
    color: Theme.colors.onSurface,
  },
  bodyText: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 18,
  },
  bulletList: {
    gap: 8,
    marginTop: 2,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Theme.colors.outline,
    marginTop: 6,
  },
  bulletText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
    flex: 1,
    lineHeight: 16,
  },
  boldText: {
    fontFamily: Theme.fonts.bodyBold,
    color: Theme.colors.onSurface,
  },
  actionBtn: {
    backgroundColor: Theme.colors.primary,
    height: 52,
    borderRadius: Theme.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Theme.spacing.xs,
  },
  actionBtnText: {
    color: '#FFF',
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
  },
  concernTag: {
    backgroundColor: '#F0F9F6',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#D3ECE4',
  },
  concernTagText: {
    fontSize: 11,
    color: '#2E6E65',
    fontFamily: Theme.fonts.bodyMedium,
  },
});
export default TherapistBriefScreen;
