import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TextInput, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { ArrowLeft, BookOpen, Sparkles, Check, AlertTriangle } from 'lucide-react-native';
import API from '../../lib/api';
import { Theme } from '../../theme';

interface CBTJournalScreenProps {
  navigation: any;
}

export const CBTJournalScreen: React.FC<CBTJournalScreenProps> = ({ navigation }) => {
  const [todayPrompt, setTodayPrompt] = useState('What thought has been on a loop today?');
  const [situation, setSituation] = useState('');
  const [thought, setThought] = useState('');
  const [feeling, setFeeling] = useState('');
  const [reframed, setReframed] = useState('');
  const [selectedDistortions, setSelectedDistortions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [tier, setTier] = useState('free');
  const [weekEntries, setWeekEntries] = useState(0);
  const [limitHit, setLimitHit] = useState(false);
  const [checkingLimit, setCheckingLimit] = useState(true);

  useEffect(() => {
    let active = true;
    API.journal.prompt()
      .then((res: any) => {
        if (active && res && res.prompt) {
          setTodayPrompt(res.prompt);
        }
      })
      .catch((err: any) => {
        console.warn("Failed to fetch random prompt from backend:", err);
      });

    Promise.all([
      API.subscription.get().catch(() => ({ tier: 'free' })),
      API.journal.list().catch(() => ({ entries: [] }))
    ]).then(([subRes, journalRes]: any) => {
      if (!active) return;
      const userTier = subRes?.tier ?? 'free';
      const journalsList = journalRes?.entries ?? [];
      
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentCount = journalsList.filter((j: any) => {
        const d = j.createdAt || j.date;
        return d && new Date(d) >= oneWeekAgo;
      }).length;
      
      setTier(userTier);
      setWeekEntries(recentCount);
      setLimitHit(userTier === 'free' && recentCount >= 3);
      setCheckingLimit(false);
    }).catch(err => {
      console.warn("Failed to load limit status:", err);
      if (active) setCheckingLimit(false);
    });

    return () => { active = false; };
  }, []);

  const distortionsList = [
    { id: 'all_or_nothing', label: 'All-or-Nothing', desc: 'Thinking in black-and-white' },
    { id: 'catastrophizing', label: 'Catastrophizing', desc: 'Expecting the absolute worst outcome' },
    { id: 'mind_reading', label: 'Mind Reading', desc: 'Assuming you know what others think' },
    { id: 'emotional_reasoning', label: 'Emotional Reasoning', desc: 'Taking feelings as absolute truth' },
    { id: 'overgeneralization', label: 'Overgeneralization', desc: 'Applying one negative event to all context' },
  ];

  const handleToggleDistortion = (id: string) => {
    if (selectedDistortions.includes(id)) {
      setSelectedDistortions(selectedDistortions.filter(x => x !== id));
    } else {
      setSelectedDistortions([...selectedDistortions, id]);
    }
  };

  const showAlert = (title: string, message: string, buttonText: string = 'OK', onPress?: () => void) => {
    if (Platform.OS === 'web') {
      alert(`${title}\n\n${message}`);
      if (onPress) onPress();
    } else {
      Alert.alert(title, message, [{ text: buttonText, onPress }]);
    }
  };

  const handleSave = async () => {
    if (!situation.trim()) {
      showAlert('Situation Required', 'Please describe what happened.');
      return;
    }
    if (!thought.trim()) {
      showAlert('Thought Required', 'Please write your automated negative thought.');
      return;
    }
    if (!feeling.trim()) {
      showAlert('Feeling Required', 'Please record your emotional feeling (e.g. anxious, sad).');
      return;
    }
    if (!reframed.trim()) {
      showAlert('Reframed Narrative Required', 'Please try reframing the thought objectively.');
      return;
    }

    setLoading(true);
    try {
      await API.journal.create({
        prompt: todayPrompt,
        situation,
        thought,
        feeling,
        reframe: reframed,
      });

      showAlert(
        'Reframed & Saved!',
        'Excellent cognitive restructuring. Practice this skill daily to build emotional resilience.',
        'Great',
        () => navigation.goBack()
      );
    } catch (err: any) {
      console.warn("Failed to save journal to backend:", err);
      showAlert(
        'Error',
        err.message || 'Failed to save thought sheet to server. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };


  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header back button */}
      <View style={styles.backRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={20} color={Theme.colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thought Journal</Text>
      </View>

      {/* Intro info box */}
      <View style={styles.infoBox}>
        <Sparkles size={16} color={Theme.colors.primary} />
        <Text style={styles.infoText}>
          Use cognitive restructuring to challenge distressing automated thoughts and reframe them logically.
        </Text>
      </View>

      {/* Limit warning banner */}
      {limitHit && (
        <View style={styles.limitBanner}>
          <AlertTriangle size={18} color="#DE4E37" style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.limitBannerTitle}>Weekly Limit Reached</Text>
            <Text style={styles.limitBannerText}>
              You've used your {weekEntries} / 3 free journal entries for this week. Please upgrade to unlock unlimited journaling and AI insights.
            </Text>
          </View>
        </View>
      )}

      {/* Today Prompt Section */}
      <View style={styles.promptCard}>
        <Text style={styles.promptSub}>TODAY'S PROMPT</Text>
        <Text style={styles.promptTitle}>{todayPrompt}</Text>
      </View>

      {/* Step 1: Situation */}
      <View style={styles.section}>
        <Text style={styles.secNum}>STEP 1</Text>
        <Text style={styles.secTitle}>The Situation</Text>
        <Text style={styles.secDesc}>
          What happened? Describe the trigger event objectively.
        </Text>
        <TextInput
          multiline
          numberOfLines={2}
          value={situation}
          onChangeText={setSituation}
          editable={!limitHit}
          placeholder={limitHit ? "Journaling is locked" : "e.g. 'Receiving a brief feedback email from my project supervisor...'"}
          placeholderTextColor={Theme.colors.outline}
          style={[styles.textInput, { height: 60 }, limitHit && { opacity: 0.6 }]}
        />
      </View>

      {/* Step 2: Automated Negative Thought */}
      <View style={styles.section}>
        <Text style={styles.secNum}>STEP 2</Text>
        <Text style={styles.secTitle}>Automated Negative Thought</Text>
        <Text style={styles.secDesc}>
          What absolute, distressing thought went through your mind?
        </Text>
        <TextInput
          multiline
          numberOfLines={3}
          value={thought}
          onChangeText={setThought}
          editable={!limitHit}
          placeholder={limitHit ? "Journaling is locked" : "e.g. 'I will stumble during this team presentation, and everyone will think I am incompetent…'"}
          placeholderTextColor={Theme.colors.outline}
          style={[styles.textInput, { height: 75 }, limitHit && { opacity: 0.6 }]}
        />
      </View>

      {/* Step 3: Cognitive Distortions */}
      <View style={styles.section}>
        <Text style={styles.secNum}>STEP 3</Text>
        <Text style={styles.secTitle}>Identify Cognitive Distortions</Text>
        <Text style={styles.secDesc}>
          Which emotional traps or biases are active in this thought? (Select multiple)
        </Text>

        <View style={styles.distortionsGrid}>
          {distortionsList.map(dist => {
            const active = selectedDistortions.includes(dist.id);
            return (
              <TouchableOpacity
                key={dist.id}
                disabled={limitHit}
                onPress={() => handleToggleDistortion(dist.id)}
                style={[
                  styles.distCard,
                  active && styles.distCardActive,
                  limitHit && { opacity: 0.6 }
                ]}
              >
                <View style={styles.distCardLeft}>
                  <Text style={styles.distLabel}>{dist.label}</Text>
                  <Text style={styles.distDesc}>{dist.desc}</Text>
                </View>
                {active && (
                  <View style={styles.checkIndicator}>
                    <Check size={12} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Step 4: Emotional Feeling */}
      <View style={styles.section}>
        <Text style={styles.secNum}>STEP 4</Text>
        <Text style={styles.secTitle}>Emotional Feeling</Text>
        <Text style={styles.secDesc}>
          What emotion did you experience, and how intensely?
        </Text>
        <TextInput
          value={feeling}
          onChangeText={setFeeling}
          editable={!limitHit}
          placeholder={limitHit ? "Journaling is locked" : "e.g. 'Anxious and insecure (8/10)'"}
          placeholderTextColor={Theme.colors.outline}
          style={[styles.textInput, limitHit && { opacity: 0.6 }]}
        />
      </View>

      {/* Step 5: Logical Reframing */}
      <View style={styles.section}>
        <Text style={styles.secNum}>STEP 5</Text>
        <Text style={styles.secTitle}>Objective Fact-Based Reframe</Text>
        <Text style={styles.secDesc}>
          Now challenge that thought. What would a supportive, neutral observer say is the realistic truth?
        </Text>
        <TextInput
          multiline
          numberOfLines={3}
          value={reframed}
          onChangeText={setReframed}
          editable={!limitHit}
          placeholder={limitHit ? "Journaling is locked" : "e.g. 'I may feel nervous, but I have prepared my slides thoroughly. Stumbling slightly is normal, and it does not make me incompetent.'"}
          placeholderTextColor={Theme.colors.outline}
          style={[styles.textInput, { height: 75 }, limitHit && { opacity: 0.6 }]}
        />
      </View>

      {/* Action btn */}
      {limitHit ? (
        <TouchableOpacity 
          onPress={() => navigation.navigate('Plans')} 
          style={[styles.saveBtn, { backgroundColor: Theme.colors.secondary }]}
        >
          <Sparkles size={18} color="#FFF" />
          <Text style={styles.saveBtnText}>Upgrade to Unlimited Journaling</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity 
          onPress={handleSave} 
          disabled={loading || checkingLimit}
          style={styles.saveBtn}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <BookOpen size={18} color="#FFF" />
              <Text style={styles.saveBtnText}>Record Thought Sheet</Text>
            </>
          )}
        </TouchableOpacity>
      )}
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.primary + '10',
    padding: Theme.spacing.sm,
    borderRadius: Theme.radius.lg,
    gap: 8,
  },
  infoText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.primaryContainer,
    flex: 1,
    lineHeight: 16,
  },
  promptCard: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    gap: 4,
  },
  promptSub: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 9,
    color: Theme.colors.primary,
    letterSpacing: 0.5,
  },
  promptTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.onSurface,
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    gap: 6,
  },
  secNum: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 10,
    color: Theme.colors.secondary,
    letterSpacing: 0.5,
  },
  secTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.onSurface,
  },
  secDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
    lineHeight: 16,
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    backgroundColor: Theme.colors.surfaceLow,
    padding: 12,
    fontSize: 14,
    fontFamily: Theme.fonts.body,
    color: Theme.colors.onSurface,
    textAlignVertical: 'top',
  },
  distortionsGrid: {
    gap: 8,
    marginTop: 4,
  },
  distCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.sm,
    backgroundColor: Theme.colors.surfaceLow,
  },
  distCardActive: {
    borderColor: Theme.colors.primary,
    borderWidth: 1.5,
    backgroundColor: Theme.colors.primary + '05',
  },
  distCardLeft: {
    flex: 1,
    marginRight: Theme.spacing.xs,
  },
  distLabel: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
    color: Theme.colors.onSurface,
  },
  distDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  checkIndicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtn: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.primary,
    height: 52,
    borderRadius: Theme.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  saveBtnText: {
    color: '#FFF',
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
  },
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FDF2F2',
    borderColor: '#F8D7DA',
    borderWidth: 1,
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.lg,
    gap: 12,
  },
  limitBannerTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
    color: '#842029',
    fontWeight: 'bold',
  },
  limitBannerText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: '#842029',
    lineHeight: 16,
    marginTop: 2,
  },
});
export default CBTJournalScreen;
