import React from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity } from 'react-native';
import { ShieldCheck, MessageCircle, Heart, Star, Sparkles } from 'lucide-react-native';
import { Theme } from '../../theme';

interface AboutScreenProps {
  navigation: any;
}

export const AboutScreen: React.FC<AboutScreenProps> = ({ navigation }) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Our Mission</Text>
        <Text style={styles.tagline}>
          To make premium, evidence-based mental health support culturally fluent, warm, and accessible to every Indian.
        </Text>
      </View>

      <View style={styles.cardSection}>
        {/* Core pillar 1 */}
        <View style={styles.card}>
          <View style={[styles.iconCircle, { backgroundColor: Theme.colors.primary + '10' }]}>
            <Sparkles size={22} color={Theme.colors.primary} />
          </View>
          <Text style={styles.cardTitle}>Manas: The Cultural Peer AI</Text>
          <Text style={styles.cardText}>
            Trained to comprehend complex Indian socio-cultural structures, family dynamics, and linguistical nuances. Manas understands Hindi, English, and Hinglish natively, offering warm guidance without clinical coldness.
          </Text>
        </View>

        {/* Core pillar 2 */}
        <View style={styles.card}>
          <View style={[styles.iconCircle, { backgroundColor: Theme.colors.secondaryContainer + '20' }]}>
            <Heart size={22} color={Theme.colors.secondary} />
          </View>
          <Text style={styles.cardTitle}>Evidence-Based CBT</Text>
          <Text style={styles.cardText}>
            Our interactive breathing guides, dynamic thought journals, and cognitive reframing toolsets are rooted in rigorous clinical psychology to help you build resilient daily coping skills.
          </Text>
        </View>

        {/* Core pillar 3 */}
        <View style={styles.card}>
          <View style={[styles.iconCircle, { backgroundColor: Theme.colors.gold + '20' }]}>
            <ShieldCheck size={22} color={Theme.colors.tertiary} />
          </View>
          <Text style={styles.cardTitle}>Strict Ethical Shield</Text>
          <Text style={styles.cardText}>
            Zero-sharing policy on your sensitive journal logs or chat scripts. End-to-end anonymity on corporate dashboards, and direct active monitoring for crisis keywords with instant SOS interventions.
          </Text>
        </View>
      </View>

      <TouchableOpacity 
        onPress={() => navigation.navigate('Plans')} 
        style={styles.ctaBtn}
      >
        <Text style={styles.ctaBtnText}>Explore Subscriptions</Text>
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
  },
  header: {
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
    textAlign: 'center',
  },
  title: {
    paddingTop: 25,
    fontFamily: Theme.fonts.display,
    fontSize: 28,
    color: Theme.colors.primary,
  },
  tagline: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: Theme.spacing.xs,
  },
  cardSection: {
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.lg,
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
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: Theme.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  cardTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.onSurface,
    marginBottom: Theme.spacing.xs - 2,
  },
  cardText: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 18,
  },
  ctaBtn: {
    backgroundColor: Theme.colors.primary,
    height: 52,
    borderRadius: Theme.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaBtnText: {
    color: '#FFF',
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
  },
});
export default AboutScreen;
