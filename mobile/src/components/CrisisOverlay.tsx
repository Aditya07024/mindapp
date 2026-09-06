import React from 'react';
import { View, StyleSheet, Text, Modal, TouchableOpacity, ScrollView, Linking, Platform } from 'react-native';
import { X, Phone, Heart } from 'lucide-react-native';
import { Theme } from '../theme';
import { CRISIS_HELPLINES } from '../lib/crisis';

interface CrisisOverlayProps {
  open: boolean;
  onClose: () => void;
}

export const CrisisOverlay: React.FC<CrisisOverlayProps> = ({ open, onClose }) => {
  
  const handleCall = (phone: string) => {
    // Clean up phone string to get just the first number if multiple
    const cleanNumber = phone.split('/')[0].trim();
    Linking.openURL(`tel:${cleanNumber}`);
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={open}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Heart size={20} color={Theme.colors.crisis} />
              <Text style={styles.title}>You are not alone</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Theme.colors.onSurface} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.description}>
              Please reach out. There are professionals waiting to support you right now. These helplines in India are completely free, confidential, and run 24/7.
            </Text>

            <View style={styles.helplineList}>
              {CRISIS_HELPLINES.map((hl, i) => (
                <View key={i} style={styles.helplineCard}>
                  <View style={styles.helplineInfo}>
                    <Text style={styles.helplineName}>{hl.name}</Text>
                    <Text style={styles.helplineDetail}>Available: {hl.hours}</Text>
                    <Text style={styles.helplinePhone}>{hl.phone}</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => handleCall(hl.phone)} 
                    style={styles.callBtn}
                  >
                    <Phone size={18} color="#FFF" />
                    <Text style={styles.callBtnText}>Call</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={styles.footerCard}>
              <Text style={styles.footerText}>
                If you are in immediate physical danger, please visit the nearest hospital or contact emergency services (112).
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 28, 28, 0.85)', // dark dim backdrop
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.margin,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    overflow: 'hidden',
    borderTopWidth: 6,
    borderTopColor: Theme.colors.crisis,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceHigh,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  title: {
    fontFamily: Theme.fonts.headline,
    fontSize: 20,
    color: Theme.colors.crisis,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: Theme.spacing.md,
  },
  description: {
    fontFamily: Theme.fonts.body,
    fontSize: 15,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 22,
    marginBottom: Theme.spacing.md,
  },
  helplineList: {
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
  },
  helplineCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceLow,
    padding: Theme.spacing.sm,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
  },
  helplineInfo: {
    flex: 1,
    marginRight: Theme.spacing.xs,
  },
  helplineName: {
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
    color: Theme.colors.onSurface,
  },
  helplineDetail: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  helplinePhone: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.primary,
    marginTop: 4,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Theme.radius.full,
  },
  callBtnText: {
    color: '#FFF',
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
  },
  footerCard: {
    backgroundColor: Theme.colors.errorContainer + '40', // 25% opacity errorContainer
    padding: Theme.spacing.sm,
    borderRadius: Theme.radius.default,
    borderWidth: 1,
    borderColor: Theme.colors.errorContainer,
  },
  footerText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.onErrorContainer,
    lineHeight: 18,
    textAlign: 'center',
  },
});
export default CrisisOverlay;
