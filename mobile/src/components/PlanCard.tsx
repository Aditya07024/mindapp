import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Check } from 'lucide-react-native';
import { Theme } from '../theme';

export interface PlanData {
  _id?: string;
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year' | 'one-time';
  durationMonths?: number;
  features: string[];
  audience: string;
  highlighted?: boolean;
}

interface PlanCardProps {
  plan: PlanData;
  isActive?: boolean;
  onPress: () => void;
  btnLabel?: string;
}

export const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  isActive = false,
  onPress,
  btnLabel,
}) => {
  const isHighlighted = plan.highlighted || plan.name.toLowerCase().includes('shanti');

  return (
    <View style={[
      styles.card,
      isHighlighted && styles.cardHighlighted,
      isActive && styles.cardActive
    ]}>
      {isHighlighted && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularText}>MOST POPULAR</Text>
        </View>
      )}

      {isActive && (
        <View style={styles.activeBadge}>
          <Text style={styles.activeBadgeText}>✓ ACTIVE</Text>
        </View>
      )}

      {btnLabel === 'Payment Pending' && (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingBadgeText}>PAYMENT PENDING</Text>
        </View>
      )}

      <Text style={[styles.name, isHighlighted && styles.textWhite]}>
        {plan.name}
      </Text>

      <View style={styles.priceRow}>
        <Text style={[styles.currency, isHighlighted && styles.textWhite]}>₹</Text>
        <Text style={[styles.price, isHighlighted && styles.textWhite]}>
          {plan.price}
        </Text>
        <Text style={[styles.interval, isHighlighted && styles.textWhiteMuted]}>
          /{plan.durationMonths && plan.durationMonths > 1
            ? `${plan.durationMonths} mo`
            : plan.interval === 'one-time'
            ? 'session'
            : plan.interval === 'year'
            ? 'yr'
            : 'mo'}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.featuresList}>
        {plan.features.map((feature, idx) => (
          <View key={idx} style={styles.featureItem}>
            <Check 
              size={16} 
              color={isHighlighted ? Theme.colors.gold : Theme.colors.primary} 
            />
            <Text style={[
              styles.featureText, 
              isHighlighted && styles.textWhite,
              { flex: 1 }
            ]}>
              {feature}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        onPress={onPress}
        disabled={isActive || btnLabel === 'Payment Pending'}
        style={[
          styles.actionBtn,
          isHighlighted ? styles.actionBtnHighlighted : styles.actionBtnNormal,
          isActive && styles.actionBtnActive,
          btnLabel === 'Payment Pending' && styles.actionBtnPending
        ]}
      >
        <Text style={[
          styles.actionBtnText,
          isHighlighted && styles.textPrimaryColor,
          isActive && styles.textWhite,
          btnLabel === 'Payment Pending' && styles.textPending
        ]}>
          {isActive ? 'Current Plan' : btnLabel || (plan.price === 0 ? 'Start Free' : 'Upgrade Now')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    marginBottom: Theme.spacing.md,
    position: 'relative',
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  cardHighlighted: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
    shadowColor: Theme.colors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 5,
  },
  cardActive: {
    borderColor: Theme.colors.gold,
    borderWidth: 2.5,
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    backgroundColor: Theme.colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Theme.radius.full,
  },
  popularText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 9,
    color: Theme.colors.onTertiaryContainer || '#271900',
    letterSpacing: 1,
  },
  name: {
    fontFamily: Theme.fonts.display,
    fontSize: 20,
    color: Theme.colors.onSurface,
    textAlign: 'center',
    marginTop: Theme.spacing.xs,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
    marginTop: Theme.spacing.xs,
  },
  currency: {
    fontFamily: Theme.fonts.display,
    fontSize: 20,
    color: Theme.colors.primary,
    marginRight: 2,
  },
  price: {
    fontFamily: Theme.fonts.display,
    fontSize: 36,
    color: Theme.colors.onSurface,
  },
  interval: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.textMuted,
    marginLeft: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Theme.colors.surfaceHigh,
    marginVertical: Theme.spacing.sm,
    opacity: 0.5,
  },
  featuresList: {
    gap: Theme.spacing.xs + 2,
    marginBottom: Theme.spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  featureText: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
  },
  actionBtn: {
    paddingVertical: 12,
    borderRadius: Theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnNormal: {
    backgroundColor: Theme.colors.primaryContainer,
  },
  actionBtnHighlighted: {
    backgroundColor: Theme.colors.gold,
  },
  actionBtnActive: {
    backgroundColor: Theme.colors.surfaceDim,
  },
  actionBtnText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
    color: '#FFF',
  },
  textWhite: {
    color: '#FFF',
  },
  textWhiteMuted: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  textPrimaryColor: {
    color: Theme.colors.primary,
  },
  textOutlineColor: {
    color: Theme.colors.primary,
  },
  activeBadge: {
    position: 'absolute',
    top: -12,
    right: 16,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.radius.full,
  },
  activeBadgeText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 9,
    color: '#FFF',
    letterSpacing: 0.5,
  },
  pendingBadge: {
    position: 'absolute',
    top: -12,
    right: 16,
    backgroundColor: '#FF9800',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.radius.full,
  },
  pendingBadgeText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 9,
    color: '#FFF',
    letterSpacing: 0.5,
  },
  actionBtnPending: {
    backgroundColor: '#FFE0B2',
  },
  textPending: {
    color: '#B66000',
  },
});
export default PlanCard;
