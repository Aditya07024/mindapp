import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  Switch
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Wallet, Lock, TrendingUp, Grid, Settings2, BarChart2 } from 'lucide-react-native';
import Svg, { Path, Rect, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import API from '../../lib/api';
import { Theme } from '../../theme';
import { AppHeader } from '../../components/AppHeader';

interface TherapistEarningsScreenProps {
  navigation: any;
}

export const TherapistEarningsScreen: React.FC<TherapistEarningsScreenProps> = ({ navigation }) => {
  // Chart customizations state
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('line');
  const [themeColor, setThemeColor] = useState<'teal' | 'emerald' | 'indigo' | 'violet' | 'rose'>('teal');
  const [metric, setMetric] = useState<'gross' | 'net'>('net');
  const [showGrid, setShowGrid] = useState(true);
  const [timeLimit, setTimeLimit] = useState<3 | 6 | 12>(6);
  const [selectedPoint, setSelectedPoint] = useState<{ month: string; value: number } | null>(null);

  // Fetch profiles and subscription
  const { data: userProfile, refetch: refetchProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: () => API.auth.me(),
    retry: false,
  });

  const { data: subData, refetch: refetchSub } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => API.subscription.get().catch(() => null),
    retry: false,
  });

  const isSubscribed =
    !!(userProfile?.orgId) ||
    !!(userProfile?.tier && userProfile.tier !== 'free') ||
    !!(subData && subData.subscription?.status === 'active');

  const { data: therapistStats, refetch: refetchStats } = useQuery({
    queryKey: ['therapistStats'],
    queryFn: () => API.therapist.stats(),
    retry: false,
    enabled: isSubscribed,
  });

  // Query live bookings to parse monthly stats
  const { data: bookingsData } = useQuery({
    queryKey: ['therapistBookingsData'],
    queryFn: () => API.therapist.meBookings(),
    retry: false,
    enabled: isSubscribed,
  });

  const monthEarned = isSubscribed ? (therapistStats?.stats?.monthEarned ?? 0) : 0;
  const totalEarned = isSubscribed ? (therapistStats?.stats?.totalEarned ?? 0) : 0;
  const netPayout = Math.round(monthEarned * 0.70);
  const totalSessionsCount = isSubscribed ? (therapistStats?.stats?.completedSessions ?? 0) : 0;
  const therapistName = userProfile?.fullName || 'Therapist';

  // 1. Build revenue chart dataset (merge mock data with actual database records)
  const mockRevenue: Record<string, number> = {
    '2025-11': 16500,
    '2025-12': 18000,
    '2026-01': 24000,
    '2026-02': 19500,
    '2026-03': 32000,
    '2026-04': 28500,
    '2026-05': monthEarned || 38000,
  };

  const dbRevenue = bookingsData?.revenueByMonth || {};
  const mergedRevenue = { ...mockRevenue, ...dbRevenue };

  // Sort and filter dataset based on selected time limit (3, 6, or 12 months)
  const sortedMonths = Object.keys(mergedRevenue).sort();
  const filteredMonths = sortedMonths.slice(-timeLimit);
  
  const chartData = filteredMonths.map(month => {
    const rawVal = mergedRevenue[month];
    const value = metric === 'net' ? Math.round(rawVal * 0.70) : rawVal;
    
    // Format month label (e.g. 2026-05 -> May)
    const [year, m] = month.split('-');
    const date = new Date(Number(year), Number(m) - 1, 1);
    const label = date.toLocaleString('default', { month: 'short' });
    
    return { month, label, value };
  });

  // Color Mapping Configurations
  const colorMap = {
    teal: { hex: '#0F766E', grad1: '#0F766E', grad2: '#2DD4BF' },
    emerald: { hex: '#047857', grad1: '#047857', grad2: '#34D399' },
    indigo: { hex: '#4338CA', grad1: '#4338CA', grad2: '#818CF8' },
    violet: { hex: '#6D28D9', grad1: '#6D28D9', grad2: '#A78BFA' },
    rose: { hex: '#BE123C', grad1: '#BE123C', grad2: '#F43F5E' },
  };

  const selectedColors = colorMap[themeColor] || colorMap.teal;

  // Render SVG Chart components dynamically
  const renderSVGChart = () => {
    if (chartData.length === 0) return null;

    const screenWidth = Dimensions.get('window').width;
    const chartWidth = screenWidth - 64; // Margin padding
    const chartHeight = 180;
    const padLeft = 45;
    const padRight = 15;
    const padTop = 20;
    const padBottom = 25;

    const drawWidth = chartWidth - padLeft - padRight;
    const drawHeight = chartHeight - padTop - padBottom;

    // Calculate Y Scale limit
    const values = chartData.map(d => d.value);
    const maxVal = Math.max(...values);
    const yMax = maxVal > 0 ? Math.ceil(maxVal * 1.15 / 5000) * 5000 : 10000;

    // Generate drawing coordinates
    const points = chartData.map((d, index) => {
      const x = padLeft + (index * (drawWidth / (chartData.length - 1 || 1)));
      const y = padTop + drawHeight - ((d.value / yMax) * drawHeight);
      return { x, y, data: d };
    });

    // Build Line SVG path
    let linePathStr = '';
    if (points.length > 0) {
      linePathStr = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        linePathStr += ` L ${points[i].x} ${points[i].y}`;
      }
    }

    // Build Area SVG path (closed path)
    const areaPathStr = linePathStr 
      ? `${linePathStr} L ${points[points.length - 1].x} ${padTop + drawHeight} L ${points[0].x} ${padTop + drawHeight} Z`
      : '';

    // Y Axis horizontal Grid Lines
    const gridTicks = [0, yMax / 2, yMax];

    return (
      <View style={styles.chartCanvasContainer}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={selectedColors.grad1} stopOpacity="0.45" />
              <Stop offset="100%" stopColor={selectedColors.grad2} stopOpacity="0.01" />
            </LinearGradient>
          </Defs>

          {/* Draw Gridlines */}
          {showGrid && gridTicks.map((tick, idx) => {
            const y = padTop + drawHeight - ((tick / yMax) * drawHeight);
            return (
              <React.Fragment key={idx}>
                <Line 
                  x1={padLeft} 
                  y1={y} 
                  x2={chartWidth - padRight} 
                  y2={y} 
                  stroke={Theme.colors.surfaceHigh} 
                  strokeWidth="1" 
                  strokeDasharray="4 4" 
                />
                <SvgText 
                  x={padLeft - 8} 
                  y={y + 4} 
                  fontSize="9.5" 
                  fontFamily={Theme.fonts.body} 
                  fill={Theme.colors.outline} 
                  textAnchor="end"
                >
                  {`₹${Math.round(tick / 1000)}k`}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* Render Area Chart Layer */}
          {chartType === 'area' && areaPathStr && (
            <Path d={areaPathStr} fill="url(#chartGrad)" />
          )}

          {/* Render Line Chart Layer */}
          {(chartType === 'line' || chartType === 'area') && linePathStr && (
            <Path 
              d={linePathStr} 
              fill="none" 
              stroke={selectedColors.hex} 
              strokeWidth="3.2" 
            />
          )}

          {/* Render Bar Chart Layer */}
          {chartType === 'bar' && points.map((p, idx) => {
            const barW = Math.max(12, drawWidth / (chartData.length * 2.2));
            const barH = padTop + drawHeight - p.y;
            return (
              <Rect
                key={idx}
                x={p.x - barW / 2}
                y={p.y}
                width={barW}
                height={barH}
                fill={selectedColors.hex}
                rx="3.5"
              />
            );
          })}

          {/* Draw X-Axis labels */}
          {points.map((p, idx) => (
            <SvgText
              key={idx}
              x={p.x}
              y={chartHeight - 4}
              fontSize="9.5"
              fontFamily={Theme.fonts.bodyBold}
              fill={Theme.colors.outline}
              textAnchor="middle"
            >
              {p.data.label}
            </SvgText>
          ))}

          {/* Render Interactive Nodes */}
          {points.map((p, idx) => (
            <Circle
              key={idx}
              cx={p.x}
              cy={p.y}
              r={selectedPoint?.month === p.data.month ? "6" : "4.5"}
              fill={selectedPoint?.month === p.data.month ? Theme.colors.gold : selectedColors.hex}
              stroke="#FFF"
              strokeWidth="1.5"
              onPress={() => setSelectedPoint(p.data)}
            />
          ))}
        </Svg>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader
        userFirstName={therapistName.split(' ')[0]}
        role="therapist"
        navigation={navigation}
        onUpgradePress={userProfile?.orgId ? undefined : () => navigation.navigate('Plans')}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={styles.profileHeaderCard}>
          <View style={styles.avatarRingOuter}>
            <View style={styles.avatarRingInner}>
              <Text style={styles.avatarLetter}>T</Text>
            </View>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{therapistName}</Text>
            <Text style={styles.headerRole}>Therapist</Text>
            <Text style={styles.headerSubtext}>– · {totalSessionsCount} sessions</Text>
          </View>
        </View>

        {/* 2 Stats Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>₹{totalEarned.toLocaleString('en-IN')}</Text>
            <Text style={styles.statLabel}>Total earned</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>₹{monthEarned.toLocaleString('en-IN')}</Text>
            <Text style={styles.statLabel}>This month</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>₹{netPayout.toLocaleString('en-IN')}</Text>
            <Text style={styles.statLabel}>Payout (70%)</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{totalSessionsCount}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
        </View>

        {isSubscribed ? (
          <View style={styles.actionContainer}>
            {/* 1. Customizable interactive revenue analytics chart */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <TrendingUp size={18} color={Theme.colors.primary} />
                <Text style={styles.cardTitle}>Revenue Analytics & Statistics</Text>
              </View>
              <Text style={styles.cardDesc}>Tweak parameters to trace payout variations:</Text>

              {/* Render dynamic Svg chart */}
              {renderSVGChart()}

              {/* Dynamic Interactive Tooltip Panel */}
              {selectedPoint && (
                <View style={styles.tooltipPanel}>
                  <Text style={styles.tooltipTitle}>{selectedPoint.month} Summary</Text>
                  <Text style={styles.tooltipVal}>
                    {metric === 'net' ? 'Net Payout (85%):' : 'Gross Revenue:'} 
                    <Text style={{ color: selectedColors.hex, fontFamily: Theme.fonts.headline }}> ₹{selectedPoint.value.toLocaleString()}</Text>
                  </Text>
                </View>
              )}

              {/* Chart Controls Toggles */}
              <View style={styles.controlHeaderRow}>
                <Settings2 size={14} color={Theme.colors.outline} />
                <Text style={styles.controlSectionTitle}>Customize Report Graph</Text>
              </View>

              {/* Parameter 1: Chart Type */}
              <Text style={styles.controlLabel}>Chart Representation</Text>
              <View style={styles.selectorRow}>
                {(['line', 'area', 'bar'] as const).map(type => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setChartType(type)}
                    style={[styles.selectorBtn, chartType === type && styles.selectorBtnActive]}
                  >
                    <Text style={[styles.selectorBtnText, chartType === type && styles.selectorBtnTextActive]}>
                      {type.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Parameter 2: Theme Color */}
              <Text style={styles.controlLabel}>Graph Highlight Palette</Text>
              <View style={styles.selectorRow}>
                {(['teal', 'emerald', 'indigo', 'violet', 'rose'] as const).map(color => {
                  const hexColor = colorMap[color].hex;
                  const isActive = themeColor === color;
                  return (
                    <TouchableOpacity
                      key={color}
                      onPress={() => setThemeColor(color)}
                      style={[
                        styles.colorSwatchBtn, 
                        { backgroundColor: hexColor },
                        isActive && styles.colorSwatchActive
                      ]}
                    />
                  );
                })}
              </View>

              {/* Parameter 3: Gridlines & Metric toggles */}
              <View style={styles.toggleSectionRow}>
                <View style={styles.toggleField}>
                  <Grid size={15} color={Theme.colors.outline} style={{ marginRight: 6 }} />
                  <Text style={styles.toggleLabelText}>Grid Lines</Text>
                  <Switch
                    value={showGrid}
                    onValueChange={setShowGrid}
                    trackColor={{ true: Theme.colors.primary }}
                  />
                </View>
                <View style={styles.toggleField}>
                  <BarChart2 size={15} color={Theme.colors.outline} style={{ marginRight: 6 }} />
                  <Text style={styles.toggleLabelText}>Gross Sum</Text>
                  <Switch
                    value={metric === 'gross'}
                    onValueChange={(val) => setMetric(val ? 'gross' : 'net')}
                    trackColor={{ true: Theme.colors.primary }}
                  />
                </View>
              </View>

              {/* Parameter 4: Time Range Select */}
              <Text style={styles.controlLabel}>Report Period Range</Text>
              <View style={styles.selectorRow}>
                {([3, 6, 12] as const).map(range => (
                  <TouchableOpacity
                    key={range}
                    onPress={() => setTimeLimit(range)}
                    style={[styles.selectorBtn, timeLimit === range && styles.selectorBtnActive]}
                  >
                    <Text style={[styles.selectorBtnText, timeLimit === range && styles.selectorBtnTextActive]}>
                      {`${range} MONTHS`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Financial ledger statement */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Wallet size={18} color={Theme.colors.primary} />
                <Text style={styles.cardTitle}>Payout Summary Statement</Text>
              </View>
              <Text style={styles.cardDesc}>Below is the breakdown of your consultation earnings:</Text>

              <View style={styles.ledgerCard}>
                <View style={styles.ledgerLine}>
                  <Text style={styles.ledgerLabel}>Total Gross Earned (All Time)</Text>
                  <Text style={styles.ledgerVal}>₹{totalEarned.toLocaleString('en-IN')}</Text>
                </View>
                <View style={styles.ledgerLine}>
                  <Text style={styles.ledgerLabel}>This Month Gross</Text>
                  <Text style={styles.ledgerVal}>₹{monthEarned.toLocaleString('en-IN')}</Text>
                </View>
                <View style={styles.ledgerLine}>
                  <Text style={styles.ledgerLabel}>Platform Service Share (30%)</Text>
                  <Text style={styles.ledgerVal}>- ₹{Math.round(monthEarned * 0.30).toLocaleString('en-IN')}</Text>
                </View>
                <View style={[styles.ledgerLine, styles.ledgerTotalLine]}>
                  <Text style={styles.ledgerTotalLabel}>Net Payout This Month</Text>
                  <Text style={styles.ledgerTotalVal}>₹{netPayout.toLocaleString('en-IN')}</Text>
                </View>
              </View>

              <View style={styles.helpBox}>
                <Text style={styles.helpText}>
                  * Payouts are safely processed and automatically dispatched to your registered bank account on the 1st of every month.
                </Text>
              </View>
            </View>
          </View>
        ) : (
          /* Subscription Required Barrier Overlay */
          <View style={styles.barrierContainer}>
            <View style={styles.lockBadge}>
              <Lock size={22} color={Theme.colors.primary} />
            </View>
            <Text style={styles.barrierTitle}>Subscription Required</Text>
            <Text style={styles.barrierDesc}>
              As an independent therapist, you need an active subscription to access your schedule, bookings, and profile.
            </Text>

            <View style={styles.barrierActions}>
              <TouchableOpacity
                onPress={() => navigation.navigate('Plans')}
                style={styles.viewPlansBtn}
              >
                <Text style={styles.viewPlansText}>View Subscription Plans</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
  profileHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 3,
    gap: Theme.spacing.md,
  },
  avatarRingOuter: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    borderColor: Theme.colors.primary + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarRingInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Theme.colors.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontFamily: Theme.fonts.display,
    fontSize: 26,
    color: Theme.colors.primary,
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 18,
    color: Theme.colors.onSurface,
  },
  headerRole: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 13,
    color: Theme.colors.primary,
    marginTop: 2,
  },
  headerSubtext: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 3,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    height: 90,
  },
  statVal: {
    fontFamily: Theme.fonts.display,
    fontSize: 26,
    color: Theme.colors.onSurface,
    fontWeight: '700',
  },
  statLabel: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: Theme.spacing.xs - 4,
    textAlign: 'center',
  },
  actionContainer: {
    gap: Theme.spacing.md,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    gap: Theme.spacing.xs,
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
    color: Theme.colors.onSurface,
  },
  cardDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginBottom: 6,
  },
  chartCanvasContainer: {
    alignItems: 'center',
    marginVertical: 10,
    backgroundColor: Theme.colors.surfaceLow + '40',
    borderRadius: Theme.radius.lg,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
  },
  tooltipPanel: {
    backgroundColor: Theme.colors.surfaceLow,
    borderColor: Theme.colors.surfaceHigh,
    borderWidth: 1,
    borderRadius: Theme.radius.lg,
    padding: 10,
    marginVertical: 4,
  },
  tooltipTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 11.5,
    color: Theme.colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  tooltipVal: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurface,
    marginTop: 2,
  },
  controlHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.surfaceHigh,
    paddingTop: 12,
  },
  controlSectionTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 12.5,
    color: Theme.colors.onSurfaceVariant,
  },
  controlLabel: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: Theme.colors.outline,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 4,
  },
  selectorBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.full,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceLow,
  },
  selectorBtnActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  selectorBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 9.5,
    color: Theme.colors.primary,
  },
  selectorBtnTextActive: {
    color: '#FFF',
  },
  colorSwatchBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: Theme.colors.gold,
  },
  toggleSectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginVertical: 6,
  },
  toggleField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceLow,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  toggleLabelText: {
    fontFamily: Theme.fonts.body,
    fontSize: 11.5,
    color: Theme.colors.onSurfaceVariant,
    flex: 1,
  },
  ledgerCard: {
    backgroundColor: Theme.colors.background + '50',
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    gap: 8,
  },
  ledgerLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ledgerLabel: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
  },
  ledgerVal: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12.5,
    color: Theme.colors.onSurface,
  },
  ledgerTotalLine: {
    borderTopWidth: 1,
    borderTopColor: Theme.colors.surfaceLow,
    paddingTop: 8,
    marginTop: 2,
  },
  ledgerTotalLabel: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13.5,
    color: Theme.colors.primary,
  },
  ledgerTotalVal: {
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
    color: Theme.colors.primary,
    fontWeight: '700',
  },
  helpBox: {
    marginTop: 4,
  },
  helpText: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.textMuted,
    lineHeight: 15,
  },
  barrierContainer: {
    backgroundColor: Theme.colors.primary + '06',
    borderWidth: 1.5,
    borderColor: Theme.colors.primary + '25',
    borderStyle: 'dashed',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.lg,
    alignItems: 'center',
    textAlign: 'center',
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
    elevation: 4,
  },
  lockBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  barrierTitle: {
    fontFamily: Theme.fonts.display,
    fontSize: 18,
    color: Theme.colors.primary,
    textAlign: 'center',
    fontWeight: '700',
  },
  barrierDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
    paddingHorizontal: 8,
  },
  barrierActions: {
    width: '100%',
    gap: 8,
    marginTop: Theme.spacing.md,
  },
  viewPlansBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 12,
    borderRadius: Theme.radius.full,
    alignItems: 'center',
    width: '100%',
  },
  viewPlansText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
    color: '#FFF',
  },
});

export default TherapistEarningsScreen;
