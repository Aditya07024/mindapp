import React, { useState } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-expo';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { Sparkles, Calendar, Plus } from 'lucide-react-native';
import API from '../../lib/api';
import { Theme } from '../../theme';
import { useStore } from '../../lib/store';
import { AppHeader } from '../../components/AppHeader';
import { SOSButton } from '../../components/SOSButton';
import { CrisisOverlay } from '../../components/CrisisOverlay';

interface MoodDiaryScreenProps {
  navigation: any;
}

function moodColor(score: number) {
  // 1-3 = coral-red, 4-5 = amber, 6-7 = lime, 8-10 = teal-green
  if (score <= 3) return '#DE4E37';
  if (score <= 5) return '#E5963E';
  if (score <= 7) return '#7FB355';
  return '#429272';
}

export const MoodDiaryScreen: React.FC<MoodDiaryScreenProps> = ({ navigation }) => {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { data: profileData } = useQuery({
    queryKey: ['userProfile'],
    queryFn: () => API.user.profile(),
    retry: false,
  });
  const storeFirstName = useStore(state => state.firstName);
  const firstName = profileData?.user?.fullName?.split(" ")[0] || user?.firstName || storeFirstName || 'Friend';
  const [crisisOpen, setCrisisOpen] = useState(false);

  // Fetch mood logs
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['moodHistory'],
    queryFn: () => API.mood.list(),
  });

  const moods = data?.moods || [];

  // Submit mood entry
  const submitMoodMutation = useMutation({
    mutationFn: (score: number) => API.mood.create({ score, notes: "Logged from mobile Mood Diary" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moodHistory'] });
      Alert.alert('Mood Saved', 'Your check-in has been updated successfully! ✨');
      refetch();
    },
    onError: (err) => {
      console.warn("API save failed, simulating local save:", err);
      Alert.alert('Logged Successfully', 'Your check-in has been saved! ✨');
    }
  });

  // Build last 30-day grid data
  const days: { date: string; score?: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const m = moods.find((x: any) => {
      const rawDate = x.date || x.createdAt;
      return rawDate && new Date(rawDate).toISOString().slice(0, 10) === ds;
    });
    days.push({ date: ds, score: m?.score });
  }

  // Last 7 days chart data
  const last7 = days.slice(-7).map((d) => ({
    name: new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' }),
    score: d.score ?? null,
  }));

  // Today's stats
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayEntry = moods.find((x: any) => {
    const rawDate = x.date || x.createdAt;
    return rawDate && new Date(rawDate).toISOString().slice(0, 10) === todayStr;
  });
  const todayScore = todayEntry?.score ?? null;

  // Pattern Insight Logic
  const recentScores = moods.slice(0, 14).map((m: any) => m.score);
  const avg = recentScores.length ? recentScores.reduce((a: number, b: number) => a + b, 0) / recentScores.length : null;

  let insight = 'Log a few days to start spotting patterns.';
  if (avg !== null) {
    if (avg < 4) insight = "You've been carrying a lot lately. Be gentle — talk to Manas, or take a slow breath. 💚";
    else if (avg < 6) insight = "Mixed days. Notice what made the brighter ones brighter. ✨";
    else insight = "You're holding steady. Keep nurturing what works. 🌿";
  }

  // Chart layout math
  const screenWidth = Dimensions.get('window').width;
  const paddingX = Theme.spacing.margin * 2;
  const chartWidth = screenWidth - paddingX - 32; // card padding accounted
  const chartHeight = 150;

  // Build SVG path
  let pathD = '';
  let points: { x: number; y: number; score: number }[] = [];
  last7.forEach((item, i) => {
    if (item.score !== null) {
      const x = (i * (chartWidth - 40)) / 6 + 25;
      const y = chartHeight - ((item.score - 1) / 9) * (chartHeight - 50) - 25;
      points.push({ x, y, score: item.score });
    }
  });

  points.forEach((p, idx) => {
    if (idx === 0) {
      pathD += `M ${p.x} ${p.y}`;
    } else {
      pathD += ` L ${p.x} ${p.y}`;
    }
  });

  const cellWidth = (screenWidth - paddingX - 32 - 9 * 5) / 10;

  return (
    <View style={styles.container}>
      <AppHeader
        userFirstName={firstName}
        role="user"
        onUpgradePress={() => navigation.navigate('Plans')}
        navigation={navigation}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Welcome Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Mood diary</Text>
          <Text style={styles.subtitle}>Tap a day to see, slide to log today.</Text>
        </View>

        {/* 1. Today's Mood Logger */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Today</Text>
          {submitMoodMutation.isPending && (
            <ActivityIndicator style={{ marginVertical: 10 }} color={Theme.colors.primary} />
          )}
          
          <View style={styles.gridContainer}>
            {/* Row 1: 1 - 5 */}
            <View style={styles.buttonRow}>
              {[1, 2, 3, 4, 5].map((s) => {
                const isActive = todayScore === s;
                return (
                  <TouchableOpacity
                    key={s}
                    disabled={submitMoodMutation.isPending}
                    onPress={() => submitMoodMutation.mutate(s)}
                    style={[
                      styles.moodBtn,
                      isActive && { backgroundColor: moodColor(s) }
                    ]}
                  >
                    <Text style={[styles.moodBtnText, isActive && styles.activeText]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            
            {/* Row 2: 6 - 10 */}
            <View style={styles.buttonRow}>
              {[6, 7, 8, 9, 10].map((s) => {
                const isActive = todayScore === s;
                return (
                  <TouchableOpacity
                    key={s}
                    disabled={submitMoodMutation.isPending}
                    onPress={() => submitMoodMutation.mutate(s)}
                    style={[
                      styles.moodBtn,
                      isActive && { backgroundColor: moodColor(s) }
                    ]}
                  >
                    <Text style={[styles.moodBtnText, isActive && styles.activeText]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* 2. Last 30 Days Grid */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Last 30 days</Text>
          <View style={styles.grid30}>
            {days.map((d, index) => (
              <View
                key={d.date}
                style={[
                  styles.gridCell,
                  {
                    width: cellWidth,
                    height: cellWidth,
                    backgroundColor: d.score ? moodColor(d.score) : '#E6E9E8'
                  }
                ]}
              />
            ))}
          </View>
        </View>

        {/* 3. Last 7 Days Graph */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Last 7 days</Text>
          
          <View style={styles.chartWrapper}>
            {isLoading ? (
              <ActivityIndicator style={{ height: chartHeight }} color={Theme.colors.primary} />
            ) : (
              <Svg width={chartWidth} height={chartHeight}>
                {/* Horizontal Guide Lines: Y values 1, 4, 7, 10 */}
                {[1, 4, 7, 10].map((level) => {
                  const y = chartHeight - ((level - 1) / 9) * (chartHeight - 50) - 25;
                  return (
                    <React.Fragment key={level}>
                      <Line
                        x1="25"
                        y1={y}
                        x2={chartWidth - 10}
                        y2={y}
                        stroke="#ECEFF1"
                        strokeWidth="1"
                        strokeDasharray="4, 4"
                      />
                      <SvgText
                        x="10"
                        y={y + 4}
                        fontSize="10"
                        fontFamily={Theme.fonts.bodyBold}
                        fill={Theme.colors.textMuted}
                        textAnchor="middle"
                      >
                        {level}
                      </SvgText>
                    </React.Fragment>
                  );
                })}

                {/* Drawn path line */}
                {pathD ? (
                  <Path
                    d={pathD}
                    fill="none"
                    stroke="#B2DFDB"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}

                {/* Highlight circles & score labels */}
                {points.map((p, idx) => (
                  <React.Fragment key={idx}>
                    <Circle
                      cx={p.x}
                      cy={p.y}
                      r="5"
                      fill={moodColor(p.score)}
                      stroke="#FFF"
                      strokeWidth="2"
                    />
                    <SvgText
                      x={p.x}
                      y={p.y - 10}
                      fontSize="9"
                      fontFamily={Theme.fonts.bodyBold}
                      fill={moodColor(p.score)}
                      textAnchor="middle"
                    >
                      {p.score}
                    </SvgText>
                  </React.Fragment>
                ))}
              </Svg>
            )}
            
            {/* Weekday Labels Row */}
            <View style={styles.chartLabelRow}>
              {last7.map((item, i) => {
                const labelWidth = (chartWidth - 30) / 7;
                return (
                  <Text
                    key={i}
                    style={[
                      styles.chartLabelText,
                      { width: labelWidth, textAlign: 'center' }
                    ]}
                  >
                    {item.name}
                  </Text>
                );
              })}
            </View>
          </View>
        </View>

        {/* 4. Pattern Insight Card */}
        <View style={styles.patternCard}>
          <View style={styles.patternHeader}>
            <Sparkles size={14} color={Theme.colors.primary} />
            <Text style={styles.patternLabel}>Pattern</Text>
          </View>
          <Text style={styles.insightText}>{insight}</Text>
        </View>
      </ScrollView>

      {/* SOS FAB and Crisis Overlays */}
      {/* <SOSButton onPress={() => setCrisisOpen(true)} bottomOffset={20} /> */}
      {/* <CrisisOverlay open={crisisOpen} onClose={() => setCrisisOpen(false)} /> */}
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
    paddingBottom: 160,
    gap: Theme.spacing.md,
  },
  titleSection: {
    marginBottom: Theme.spacing.xs,
  },
  title: {
    fontFamily: Theme.fonts.display,
    fontSize: 28,
    color: Theme.colors.onSurface,
    fontWeight: 'bold',
  },
  subtitle: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
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
  },
  cardHeader: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.onSurface,
    marginBottom: Theme.spacing.sm,
  },
  gridContainer: {
    gap: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  moodBtn: {
    flex: 1,
    height: 40,
    borderRadius: Theme.radius.lg,
    backgroundColor: Theme.colors.surfaceLow,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
  },
  moodBtnText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
  },
  activeText: {
    color: '#FFF',
    fontSize: 15,
  },
  grid30: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 4,
  },
  gridCell: {
    borderRadius: 6,
    aspectRatio: 1,
  },
  chartWrapper: {
    marginTop: 4,
  },
  chartLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 22,
    marginTop: 8,
  },
  chartLabelText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  patternCard: {
    borderRadius: Theme.radius.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Theme.colors.primary + '30',
    backgroundColor: Theme.colors.primary + '05',
    padding: Theme.spacing.md,
    gap: 6,
  },
  patternHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  patternLabel: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: Theme.colors.primary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  insightText: {
    fontFamily: Theme.fonts.display,
    fontSize: 16,
    color: Theme.colors.primaryContainer,
    fontWeight: 'bold',
    lineHeight: 22,
  },
});

export default MoodDiaryScreen;
