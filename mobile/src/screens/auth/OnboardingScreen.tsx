import React, { useState } from 'react';
import { View, StyleSheet, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore, Concern, NeedType } from '../../lib/store';
import { Theme } from '../../theme';
import { ArrowRight, Check } from 'lucide-react-native';
import API from '../../lib/api';

interface OnboardingScreenProps {
  navigation: any;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const completeOnboarding = useStore(state => state.completeOnboarding);

  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState('');
  const [mood, setMood] = useState<number | null>(null);
  const [selectedConcerns, setSelectedConcerns] = useState<Concern[]>([]);
  const [need, setNeed] = useState<NeedType | null>(null);
  const [loading, setLoading] = useState(false);

  const concernsList: { key: Concern; label: string; emoji: string }[] = [
    { key: 'work', label: 'Work Burnout', emoji: '💼' },
    { key: 'family', label: 'Family Relations', emoji: '🏡' },
    { key: 'relationships', label: 'Relationships', emoji: '❤️' },
    { key: 'loneliness', label: 'Loneliness', emoji: '👥' },
    { key: 'health', label: 'Health Concerns', emoji: '🌱' },
    { key: 'money', label: 'Financial Stress', emoji: '💰' },
  ];

  const needsList: { key: NeedType; label: string; desc: string }[] = [
    { key: 'talk', label: 'Talk / Listen', desc: 'Empathic dialogue with Manas or verified therapists.' },
    { key: 'tools', label: 'Evidence tools', desc: 'CBT journal sheets, breathing practices, tracking.' },
    { key: 'express', label: 'Self expression', desc: 'Daily writing prompt, patterns & wellness analytics.' },
  ];

  const handleNext = () => {
    if (step === 1) {
      if (!firstName.trim()) {
        Alert.alert('First Name Required', 'Please enter your first name so we can address you warmly.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (mood === null) {
        Alert.alert('Mood Check-in', 'How are you feeling today? Tap an emoji to check-in.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (selectedConcerns.length === 0) {
        Alert.alert('Select Concerns', 'Please select at least one concern that brought you to MyMindTherapyFriend.');
        return;
      }
      setStep(4);
    } else if (step === 4) {
      if (!need) {
        Alert.alert('Select Needs', 'What is your primary focus for this session? Choose one.');
        return;
      }
      
      setLoading(true);
      API.auth.updateProfile({ "Full name": firstName })
        .then(() => {
          return API.auth.updateOnboarding({
            moodScore: mood,
            concerns: selectedConcerns,
            primaryNeed: need,
            completed: true
          });
        })
        .then(() => {
          // Save to global Zustand store for legacy states
          completeOnboarding({
            firstName,
            mood: mood || 4,
            concerns: selectedConcerns,
            need,
          });
          setLoading(false);
navigation.reset({
  index: 0,
  routes: [
    {
      name: 'UserTabs',
      params: { screen: 'Home' },
    },
  ],
});        })
        .catch((err: any) => {
          setLoading(false);
          Alert.alert('Onboarding Sync Failed', err.message || 'We could not save your data to the server.');
        });
    }
  };

  const toggleConcern = (concern: Concern) => {
    if (selectedConcerns.includes(concern)) {
      setSelectedConcerns(selectedConcerns.filter(c => c !== concern));
    } else {
      setSelectedConcerns([...selectedConcerns, concern]);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Let's start with your name</Text>
            <Text style={styles.stepDesc}>What should our companion, Manas, call you?</Text>
            
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Your first name…"
              style={styles.nameInput}
              placeholderTextColor={Theme.colors.outline}
              autoFocus
            />
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>How are you feeling right now, {firstName}?</Text>
            <Text style={styles.stepDesc}>Select the emotional state matching your mood today:</Text>
            
            <View style={styles.moodGrid}>
              {[
                { val: 1, label: 'Low', emoji: '😞' },
                { val: 2, label: 'Heavy', emoji: '😟' },
                { val: 3, label: 'Unstable', emoji: '😕' },
                { val: 4, label: 'Neutral', emoji: '😐' },
                { val: 5, label: 'Calm', emoji: '🙂' },
                { val: 6, label: 'Good', emoji: '😊' },
                { val: 7, label: 'Joyful', emoji: '🥰' },
              ].map(m => (
                <TouchableOpacity
                  key={m.val}
                  onPress={() => setMood(m.val)}
                  style={[
                    styles.moodBtn,
                    mood === m.val && styles.moodBtnActive
                  ]}
                >
                  <Text style={styles.moodEmoji}>{m.emoji}</Text>
                  <Text style={styles.moodLabel}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>What's currently on your mind?</Text>
            <Text style={styles.stepDesc}>Select any areas that might be causing you stress (Choose multiple):</Text>
            
            <View style={styles.grid}>
              {concernsList.map(c => {
                const active = selectedConcerns.includes(c.key);
                return (
                  <TouchableOpacity
                    key={c.key}
                    onPress={() => toggleConcern(c.key)}
                    style={[
                      styles.concernBtn,
                      active && styles.concernBtnActive
                    ]}
                  >
                    <Text style={styles.concernEmoji}>{c.emoji}</Text>
                    <Text style={[styles.concernLabel, active && styles.textWhite]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      case 4:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>What is your main goal today?</Text>
            <Text style={styles.stepDesc}>We will personalize your home feed based on your focus:</Text>
            
            <View style={styles.needsList}>
              {needsList.map(n => {
                const active = need === n.key;
                return (
                  <TouchableOpacity
                    key={n.key}
                    onPress={() => setNeed(n.key)}
                    style={[
                      styles.needCard,
                      active && styles.needCardActive
                    ]}
                  >
                    <View style={styles.needCardLeft}>
                      <Text style={styles.needCardTitle}>{n.label}</Text>
                      <Text style={styles.needCardDesc}>{n.desc}</Text>
                    </View>
                    {active && (
                      <View style={styles.needCheck}>
                        <Check size={14} color="#FFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* Progress indicators */}
      <View style={styles.progressRow}>
        {[1, 2, 3, 4].map(s => (
          <View 
            key={s} 
            style={[
              styles.progressBar,
              s <= step ? styles.progressActive : styles.progressInactive
            ]} 
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 84 }]}>
        {renderStep()}
      </ScrollView>

      <View style={[styles.footer, { bottom: Math.max(insets.bottom, 16) + 16 }]}>
        <TouchableOpacity onPress={handleNext} disabled={loading} style={styles.nextBtn}>
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Text style={styles.nextText}>
                {step === 4 ? 'Complete Onboarding' : 'Continue'}
              </Text>
              <ArrowRight size={18} color="#FFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: Theme.spacing.margin,
    paddingTop: 60,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  progressActive: {
    backgroundColor: Theme.colors.primary,
  },
  progressInactive: {
    backgroundColor: Theme.colors.surfaceHigh,
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.margin,
    paddingTop: Theme.spacing.md,
    paddingBottom: 100,
  },
  stepContainer: {
    width: '100%',
  },
  stepTitle: {
    fontFamily: Theme.fonts.display,
    fontSize: 26,
    color: Theme.colors.primary,
    marginBottom: Theme.spacing.xs,
  },
  stepDesc: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 20,
    marginBottom: Theme.spacing.md,
  },
  nameInput: {
    width: '100%',
    height: 56,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    paddingHorizontal: Theme.spacing.sm,
    fontSize: 18,
    fontFamily: Theme.fonts.body,
    color: Theme.colors.onSurface,
    backgroundColor: '#FFF',
    marginTop: Theme.spacing.xs,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.xs,
    justifyContent: 'center',
    marginTop: Theme.spacing.xs,
  },
  moodBtn: {
    width: '28%',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    paddingVertical: Theme.spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  moodBtnActive: {
    backgroundColor: Theme.colors.secondaryContainer + '20',
    borderColor: Theme.colors.secondary,
    borderWidth: 1.5,
  },
  moodEmoji: {
    fontSize: 28,
  },
  moodLabel: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 11,
    color: Theme.colors.onSurface,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.xs,
  },
  concernBtn: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.sm,
  },
  concernBtnActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  concernEmoji: {
    fontSize: 18,
  },
  concernLabel: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 13,
    color: Theme.colors.onSurface,
  },
  textWhite: {
    color: '#FFF',
  },
  needsList: {
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.xs,
  },
  needCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
  },
  needCardActive: {
    borderColor: Theme.colors.primary,
    borderWidth: 1.5,
    backgroundColor: Theme.colors.primary + '05',
  },
  needCardLeft: {
    flex: 1,
    marginRight: Theme.spacing.xs,
  },
  needCardTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
    color: Theme.colors.onSurface,
  },
  needCardDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  needCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: Theme.spacing.margin,
    right: Theme.spacing.margin,
  },
  nextBtn: {
    flexDirection: 'row',
    height: 52,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  nextText: {
    color: '#FFF',
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
  },
});
export default OnboardingScreen;
