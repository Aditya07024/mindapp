import React from 'react';
import { View, StyleSheet, Text, Image, TouchableOpacity } from 'react-native';
import { Star, ShieldCheck } from 'lucide-react-native';
import { Theme } from '../theme';

export interface TherapistData {
  _id: string;
  id?: string;
  userId?: string;
  name: string;
  specialties?: string[];
  specializations?: string[];
  experience?: number;
  experienceYears?: number;
  hourlyRate?: number;
  sessionFee?: number;
  rating?: number;
  verified?: boolean;
  avatarUrl?: string;
  bio?: string;
  introVideoUrl?: string;
  languages?: string[];
  specialty?: string;
  gender?: string;
  city?: string;
  state?: string;
}

interface TherapistCardProps {
  therapist: TherapistData;
  onPress: () => void;
  onBookPress?: () => void;
}

export const TherapistCard: React.FC<TherapistCardProps> = ({
  therapist,
  onPress,
  onBookPress,
}) => {
  const specs = therapist.specialties && therapist.specialties.length > 0
    ? therapist.specialties.slice(0, 2).join(', ')
    : 'Mental Health Counselor';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.card}>
      <View style={styles.contentRow}>
        <View style={styles.avatarContainer}>
          {therapist.avatarUrl ? (
            <Image source={{ uri: therapist.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>
                {therapist.name.substring(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
          {therapist.verified && (
            <View style={styles.verifyBadge}>
              <ShieldCheck size={12} color="#FFF" />
            </View>
          )}
        </View>

        <View style={styles.infoSection}>
          <View style={styles.nameRow}>
            <Text style={styles.nameText} numberOfLines={1}>
              {therapist.name}
            </Text>
            <View style={styles.ratingRow}>
              <Star size={14} color={Theme.colors.gold} fill={Theme.colors.gold} />
              <Text style={styles.ratingText}>{therapist.rating?.toFixed(1) || '5.0'}</Text>
            </View>
          </View>

          <Text style={styles.specialtyText} numberOfLines={1}>
            {specs}
          </Text>

          <Text style={styles.expText}>
            {therapist.experience || 3}+ years experience
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Hourly Session</Text>
            <Text style={styles.priceValue}>
              ₹{therapist.sessionFee || therapist.hourlyRate || 1500}
            </Text>
          </View>
        </View>
      </View>

      {onBookPress && (
        <TouchableOpacity onPress={onBookPress} style={styles.bookBtn}>
          <Text style={styles.bookBtnText}>Book Session</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    marginBottom: Theme.spacing.sm,
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  contentRow: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  avatarContainer: {
    position: 'relative',
    width: 70,
    height: 70,
    borderRadius: Theme.radius.lg,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: Theme.colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    color: '#FFF',
    fontFamily: Theme.fonts.headline,
    fontSize: 24,
  },
  verifyBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: Theme.colors.primary,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFF',
  },
  infoSection: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  nameText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.onSurface,
    flex: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Theme.colors.surfaceLow,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Theme.radius.sm,
  },
  ratingText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: Theme.colors.onSurface,
  },
  specialtyText: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 13,
    color: Theme.colors.primaryContainer,
    marginTop: 2,
  },
  expText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.surfaceLow,
    paddingTop: Theme.spacing.xs - 2,
  },
  priceLabel: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  priceValue: {
    fontFamily: Theme.fonts.display,
    fontSize: 15,
    color: Theme.colors.secondary,
  },
  bookBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 10,
    borderRadius: Theme.radius.full,
    alignItems: 'center',
    marginTop: Theme.spacing.sm,
  },
  bookBtnText: {
    color: '#FFF',
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
  },
});
export default TherapistCard;
