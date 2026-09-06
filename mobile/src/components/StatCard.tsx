import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { TrendingUp, TrendingDown } from 'lucide-react-native';
import { Theme } from '../theme';

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: number; // e.g. +12 or -5
  trendLabel?: string; // e.g. "vs last month"
  icon: React.ReactNode;
  color?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  trend,
  trendLabel,
  icon,
  color = Theme.colors.primary,
}) => {
  const isPositive = trend && trend >= 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
          {icon}
        </View>
      </View>

      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>

      {trend !== undefined && (
        <View style={styles.trendRow}>
          <View style={[styles.trendBadge, { backgroundColor: isPositive ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)' }]}>
            {isPositive ? (
              <TrendingUp size={12} color="#4CAF50" />
            ) : (
              <TrendingDown size={12} color="#F44336" />
            )}
            <Text style={[styles.trendText, { color: isPositive ? '#4CAF50' : '#F44336' }]}>
              {isPositive ? `+${trend}%` : `${trend}%`}
            </Text>
          </View>
          {trendLabel && <Text style={styles.trendLabel}>{trendLabel}</Text>}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.sm + 4,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    flex: 1,
    minWidth: 140,
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.xs,
    gap: Theme.spacing.xs,
  },
  title: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
    flex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: Theme.radius.default,
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    fontFamily: Theme.fonts.display,
    fontSize: 24,
    color: Theme.colors.onSurface,
    marginBottom: Theme.spacing.xs - 2,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Theme.radius.sm,
  },
  trendText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 10,
  },
  trendLabel: {
    fontFamily: Theme.fonts.body,
    fontSize: 10,
    color: Theme.colors.textMuted,
  },
});
export default StatCard;
