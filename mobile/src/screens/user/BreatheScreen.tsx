import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Animated, Easing, ScrollView } from 'react-native';
import { ArrowLeft, Play, Pause, RefreshCw, Wind, Square, Hand, User, Zap, ChevronRight } from 'lucide-react-native';
import { Theme } from '../../theme';

interface BreatheScreenProps {
  navigation: any;
}

type Phase = { label: string; seconds: number };

interface Exercise {
  id: string;
  title: string;
  desc: string;
  icon: any;
  phases: Phase[];
  cycles: number;
  emergency?: boolean;
}

const EXERCISES: Exercise[] = [
  {
    id: '478',
    title: '4-7-8 Breath',
    desc: 'Calms a racing mind. Best before sleep.',
    icon: Wind,
    phases: [
      { label: 'Inhale', seconds: 4 },
      { label: 'Hold', seconds: 7 },
      { label: 'Exhale', seconds: 8 },
    ],
    cycles: 4,
  },
  {
    id: 'box',
    title: 'Box Breathing',
    desc: 'Used by Navy SEALs. Resets your nervous system.',
    icon: Square,
    phases: [
      { label: 'Inhale', seconds: 4 },
      { label: 'Hold', seconds: 4 },
      { label: 'Exhale', seconds: 4 },
      { label: 'Hold', seconds: 4 },
    ],
    cycles: 5,
  },
  {
    id: 'grounding',
    title: '5-4-3-2-1 Grounding',
    desc: 'Pull yourself back to the present.',
    icon: Hand,
    phases: [
      { label: 'Notice 5 things you SEE', seconds: 15 },
      { label: 'Notice 4 things you can TOUCH', seconds: 12 },
      { label: 'Notice 3 things you HEAR', seconds: 10 },
      { label: 'Notice 2 things you SMELL', seconds: 8 },
      { label: 'Notice 1 thing you TASTE', seconds: 5 },
    ],
    cycles: 1,
  },
  {
    id: 'scan',
    title: 'Body Scan',
    desc: 'Release tension you didn\'t know you held.',
    icon: User,
    phases: [
      { label: 'Soften your forehead', seconds: 8 },
      { label: 'Relax your jaw', seconds: 8 },
      { label: 'Drop your shoulders', seconds: 8 },
      { label: 'Unclench your hands', seconds: 8 },
      { label: 'Feel your feet', seconds: 8 },
    ],
    cycles: 1,
  },
  {
    id: 'emergency',
    title: 'Emergency Calm',
    desc: '3 cycles. For when you need it now.',
    icon: Zap,
    emergency: true,
    phases: [
      { label: 'Inhale slowly', seconds: 4 },
      { label: 'Hold', seconds: 2 },
      { label: 'Long exhale', seconds: 6 },
    ],
    cycles: 3,
  },
];

export const BreatheScreen: React.FC<BreatheScreenProps> = ({ navigation }) => {
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);

  // Player state
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [cycle, setCycle] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const circleScale = useRef(new Animated.Value(1.0)).current;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Set up details for active exercise
  useEffect(() => {
    if (activeExercise) {
      setPhaseIdx(0);
      setCycle(1);
      setSecondsLeft(activeExercise.phases[0].seconds);
      setIsPlaying(false);
      setIsDone(false);
      circleScale.setValue(1.0);
    }
  }, [activeExercise]);

  const getPhaseScale = (idx: number) => {
    if (!activeExercise) return 1.0;
    const label = activeExercise.phases[idx].label.toLowerCase();
    const isInhale = label.includes('inhale') || label.includes('notice');
    const isExhale =
      label.includes('exhale') ||
      label.includes('relax') ||
      label.includes('soften') ||
      label.includes('drop') ||
      label.includes('unclench');
    
    return isInhale ? 2.0 : isExhale ? 0.8 : 1.3;
  };

  const startPhaseAnimation = (durationMs: number) => {
    if (!activeExercise) return;
    const targetScale = getPhaseScale(phaseIdx);

    Animated.timing(circleScale, {
      toValue: targetScale,
      duration: durationMs,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const triggerAnimationForPhase = (idx: number) => {
    if (!activeExercise) return;
    const targetScale = getPhaseScale(idx);
    const duration = activeExercise.phases[idx].seconds * 1000;

    Animated.timing(circleScale, {
      toValue: targetScale,
      duration: duration,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  // Main ticking interval
  useEffect(() => {
    if (!activeExercise || isDone || !isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // Start circle animation for current phase with remaining time
    startPhaseAnimation(secondsLeft * 1000);

    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s > 1) {
          return s - 1;
        }

        // Advance phase
        let nextPhaseIdx = phaseIdx + 1;
        if (nextPhaseIdx < activeExercise.phases.length) {
          setPhaseIdx(nextPhaseIdx);
          const nextSecs = activeExercise.phases[nextPhaseIdx].seconds;
          triggerAnimationForPhase(nextPhaseIdx);
          return nextSecs;
        } else {
          // Advance cycle
          const nextCycle = cycle + 1;
          if (nextCycle <= activeExercise.cycles) {
            setCycle(nextCycle);
            setPhaseIdx(0);
            const firstSecs = activeExercise.phases[0].seconds;
            triggerAnimationForPhase(0);
            return firstSecs;
          } else {
            // Exercise complete
            setIsDone(true);
            setIsPlaying(false);
            if (intervalRef.current) clearInterval(intervalRef.current);
            return 0;
          }
        }
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeExercise, isPlaying, phaseIdx, cycle, isDone]);

  const handleStart = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
    circleScale.stopAnimation();
  };

  const handleReset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsPlaying(false);
    setIsDone(false);
    if (activeExercise) {
      setPhaseIdx(0);
      setCycle(1);
      setSecondsLeft(activeExercise.phases[0].seconds);
    }
    circleScale.setValue(1.0);
  };

  const handleBack = () => {
    if (activeExercise) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setActiveExercise(null);
    } else {
      navigation.goBack();
    }
  };

  // Rendering selection list
  if (!activeExercise) {
    return (
      <View style={styles.container}>
        <View style={styles.backRow}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <ArrowLeft size={20} color={Theme.colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Breathe & Ground</Text>
        </View>

        <ScrollView contentContainerStyle={styles.listContainer}>
          <View style={styles.introHeader}>
            <Text style={styles.introTitle}>Guided Exercises</Text>
            <Text style={styles.introSubtitle}>Choose a practice to calm your mind and body.</Text>
          </View>

          {EXERCISES.map((ex) => {
            const Icon = ex.icon;
            return (
              <TouchableOpacity
                key={ex.id}
                onPress={() => setActiveExercise(ex)}
                style={[
                  styles.exerciseCard,
                  ex.emergency && styles.emergencyCard,
                ]}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.iconCircle,
                    ex.emergency ? styles.iconCircleEmergency : styles.iconCircleNormal,
                  ]}
                >
                  <Icon size={22} color={ex.emergency ? '#FFF' : Theme.colors.primary} />
                </View>

                <View style={styles.cardInfo}>
                  <Text style={[styles.cardTitle, ex.emergency && styles.emergencyText]}>
                    {ex.title}
                  </Text>
                  <Text style={styles.cardDesc}>{ex.desc}</Text>
                </View>

                <ChevronRight size={18} color={ex.emergency ? Theme.colors.error : Theme.colors.outline} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // Rendering Player
  const currentPhase = activeExercise.phases[phaseIdx];
  const isHolding = currentPhase.label.toLowerCase().includes('hold');
  const ringColor = isHolding
    ? Theme.colors.gold + '25'
    : currentPhase.label.toLowerCase().includes('inhale') || currentPhase.label.toLowerCase().includes('notice')
    ? Theme.colors.primary + '30'
    : Theme.colors.secondaryContainer + '30';

  return (
    <View style={styles.container}>
      <View style={styles.backRow}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <ArrowLeft size={20} color={Theme.colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{activeExercise.title}</Text>
      </View>

      <View style={styles.mainArea}>
        {!isDone ? (
          <>
            <Text style={styles.cycleText}>
              Cycle {cycle}/{activeExercise.cycles}
            </Text>

            <View style={styles.circleContainer}>
              <Animated.View
                style={[
                  styles.breathingOuterRing,
                  {
                    transform: [{ scale: circleScale }],
                    backgroundColor: ringColor,
                  },
                ]}
              />

              <View style={styles.breathingCenterBubble}>
                <Text style={styles.timerText}>{secondsLeft}s</Text>
                <Text style={styles.stateLabelText}>
                  {isPlaying ? currentPhase.label.toUpperCase() : 'PAUSED'}
                </Text>
              </View>
            </View>

            <View style={styles.instructionCard}>
              <Text style={styles.instructionTitle}>{currentPhase.label}</Text>
              <Text style={styles.instructionDesc}>
                {isPlaying ? 'Follow the pacing circle...' : 'Tap start to begin'}
              </Text>
            </View>

            <View style={styles.controlRow}>
              {isPlaying ? (
                <TouchableOpacity onPress={handlePause} style={styles.pauseBtn}>
                  <Pause size={22} color={Theme.colors.primary} />
                  <Text style={styles.pauseBtnText}>Pause</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={handleStart} style={styles.startBtn}>
                  <Play size={22} color="#FFF" fill="#FFF" />
                  <Text style={styles.startBtnText}>Start Practice</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
                <RefreshCw size={18} color={Theme.colors.outline} />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.completeContainer}>
            <View style={[styles.iconCircle, styles.iconCircleNormal, { width: 72, height: 72, borderRadius: 36, marginBottom: 20 }]}>
              <Wind size={36} color={Theme.colors.primary} />
            </View>
            <Text style={styles.completeTitle}>Well done.</Text>
            <Text style={styles.completeDesc}>Notice how your body and mind feel right now.</Text>
            
            <TouchableOpacity onPress={handleBack} style={styles.completeBtn}>
              <Text style={styles.completeBtnText}>Close Practice</Text>
            </TouchableOpacity>
          </View>
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
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: Theme.spacing.margin,
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
  listContainer: {
    paddingHorizontal: Theme.spacing.margin,
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.xl,
    gap: 12,
  },
  introHeader: {
    marginBottom: Theme.spacing.xs,
  },
  introTitle: {
    fontFamily: Theme.fonts.display,
    fontSize: 28,
    color: Theme.colors.primary,
  },
  introSubtitle: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.textMuted,
    marginTop: 4,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  emergencyCard: {
    backgroundColor: '#FFF5F5',
    borderColor: Theme.colors.error + '25',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconCircleNormal: {
    backgroundColor: Theme.colors.primary + '10',
  },
  iconCircleEmergency: {
    backgroundColor: Theme.colors.error,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.onSurface,
    marginBottom: 4,
  },
  emergencyText: {
    color: Theme.colors.error,
  },
  cardDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
    lineHeight: 16,
  },
  mainArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.margin,
    gap: Theme.spacing.lg,
  },
  cycleText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: Theme.colors.primary,
    backgroundColor: Theme.colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Theme.radius.full,
  },
  circleContainer: {
    width: 240,
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  breathingOuterRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  breathingCenterBubble: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: Theme.colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  timerText: {
    fontFamily: Theme.fonts.display,
    fontSize: 28,
    color: Theme.colors.onSurface,
  },
  stateLabelText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 9,
    color: Theme.colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 2,
    textAlign: 'center',
  },
  instructionCard: {
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.sm,
  },
  instructionTitle: {
    fontFamily: Theme.fonts.display,
    fontSize: 22,
    color: Theme.colors.primary,
    textAlign: 'center',
  },
  instructionDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  startBtn: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: Theme.radius.full,
    alignItems: 'center',
    gap: 8,
  },
  startBtnText: {
    color: '#FFF',
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
  },
  pauseBtn: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: Theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: Theme.radius.full,
    alignItems: 'center',
    gap: 8,
  },
  pauseBtnText: {
    color: Theme.colors.primary,
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
  },
  resetBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  completeContainer: {
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
  },
  completeTitle: {
    fontFamily: Theme.fonts.display,
    fontSize: 28,
    color: Theme.colors.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  completeDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 15,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  completeBtn: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: Theme.radius.full,
  },
  completeBtnText: {
    color: '#FFF',
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
  },
});

export default BreatheScreen;
