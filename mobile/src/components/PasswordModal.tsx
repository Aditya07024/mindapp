import React, { useState } from 'react';
import { View, StyleSheet, Text, Modal, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Lock, Eye, EyeOff } from 'lucide-react-native';
import { Theme } from '../theme';
import { API_URL } from '../lib/store';

interface PasswordModalProps {
  open: boolean;
  onSuccess: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({
  open,
  onSuccess,
  onCancel,
  title = 'Confidential Dashboard',
  description = 'Please enter the access code to view the Super Admin control panel.',
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!password) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/verify-password-public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setPassword('');
        onSuccess();
      } else {
        Alert.alert('Access Denied', 'Invalid access code. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Could not reach the server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={open}
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <View style={styles.lockIconContainer}>
            <Lock size={28} color={Theme.colors.secondary} />
          </View>
          
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          <View style={styles.inputWrapper}>
            <TextInput
              secureTextEntry={!showPassword}
              placeholder="Enter access code…"
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              placeholderTextColor={Theme.colors.outline}
              autoFocus
              onSubmitEditing={handleSubmit}
              returnKeyType="done"
            />
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)} 
              style={styles.eyeBtn}
            >
              {showPassword ? (
                <EyeOff size={20} color={Theme.colors.outline} />
              ) : (
                <Eye size={20} color={Theme.colors.outline} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity onPress={onCancel} style={[styles.btn, styles.cancelBtn]} disabled={loading}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={handleSubmit} 
              disabled={!password || loading}
              style={[styles.btn, styles.submitBtn, (!password || loading) && styles.disabledBtn]}
            >
              {loading
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Text style={styles.submitText}>Submit</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 28, 28, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.margin,
  },
  container: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  lockIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Theme.colors.secondaryContainer + '1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  title: {
    fontFamily: Theme.fonts.headline,
    fontSize: 20,
    color: Theme.colors.onSurface,
    textAlign: 'center',
    marginBottom: Theme.spacing.xs,
  },
  description: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.xs,
  },
  inputWrapper: {
    width: '100%',
    position: 'relative',
    marginBottom: Theme.spacing.md,
  },
  input: {
    width: '100%',
    height: 52,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    paddingHorizontal: Theme.spacing.sm,
    fontSize: 16,
    fontFamily: Theme.fonts.body,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceLow,
  },
  eyeBtn: {
    position: 'absolute',
    right: 16,
    top: 16,
    zIndex: 10,
  },
  btnRow: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    width: '100%',
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: Theme.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: Theme.colors.surfaceHigh,
  },
  cancelText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
  },
  submitBtn: {
    backgroundColor: Theme.colors.primary,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  submitText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
    color: '#FFF',
  },
});
export default PasswordModal;
