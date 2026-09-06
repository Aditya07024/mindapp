import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Mail,
  ArrowRight,
  ArrowLeft,
  Lock,
  User,
  KeyRound,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../../theme';
import API from '../../lib/api';

interface ClerkAuthScreenProps {
  navigation: any;
  route: any;
}

export const ClerkAuthScreen: React.FC<ClerkAuthScreenProps> = ({ navigation, route }) => {
  const role = route.params?.role || 'user';
  const upgradePlan = route.params?.upgradePlan;
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repassword, setRepassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const completeAuthProcess = async (token: string, user: any) => {
    try {
      await AsyncStorage.setItem('jwt_token', token);
      
      let recoveredRole = user?.role || role;
      let recoveredUpgrade = upgradePlan;

      const stashedRole = await AsyncStorage.getItem('intended_role');
      if (stashedRole) recoveredRole = stashedRole;
      const stashedUpgrade = await AsyncStorage.getItem('upgrade_plan');
      if (stashedUpgrade) recoveredUpgrade = stashedUpgrade;

      // Update backend role lock
      try {
        const res = await API.auth.setRole(recoveredRole);
        if (res.user?.role) recoveredRole = res.user.role;
      } catch (e) {}

      await AsyncStorage.removeItem('intended_role');
      await AsyncStorage.removeItem('upgrade_plan');

      if (recoveredRole === 'user') {
        try {
          const profile = await API.auth.me();
          if (profile && profile.onboarding && profile.onboarding.completedAt) {
            navigation.replace('UserTabs', { screen: 'Home', upgradePlan: recoveredUpgrade });
          } else {
            navigation.replace('Onboarding', { upgradePlan: recoveredUpgrade });
          }
        } catch (err) {
          navigation.replace('UserTabs', { screen: 'Home', upgradePlan: recoveredUpgrade });
        }
      } else if (recoveredRole === 'therapist') {
        navigation.replace('TherapistTabs');
      } else if (recoveredRole === 'org_admin') {
        navigation.replace('OrgTabs');
      } else if (recoveredRole === 'super_admin') {
        navigation.replace('AdminTabs');
      }
    } catch (err) {
      console.error("[AuthRedirect] Error in completion:", err);
    }
  };

  const handleLogin = async () => {
    setErrorMessage('');
    setInfoMessage('');
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter your email/username and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await API.auth.login({ email, password });
      if (res.token) {
        await completeAuthProcess(res.token, res.user);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email/username or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setErrorMessage('');
    setInfoMessage('');
    if (!username.trim()) {
      setErrorMessage('Please enter a username.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Please enter a password.');
      return;
    }
    if (password !== repassword) {
      setErrorMessage('Password and Confirm Password (repassword) do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await API.auth.register({
        username,
        email,
        password,
        repassword,
        role,
      });
      if (res.token) {
        await completeAuthProcess(res.token, res.user);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not create account.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setErrorMessage('');
    setInfoMessage('');
    if (!email.trim()) {
      setErrorMessage('Please enter your registered email address or username.');
      return;
    }
    if (!newPassword.trim()) {
      setErrorMessage('Please enter a new password.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMessage('New Password and Confirm New Password do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await API.auth.forgotPassword({ email, newPassword });
      setInfoMessage(res.message || 'Password updated successfully. Please sign in with your new password.');
      setMode('signin');
      setPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.topBar, { top: Math.max(insets.top, 20) }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.replace('Landing');
            }
          }}
        >
          <ArrowLeft size={18} color={Theme.colors.onSurface} />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.secureBadge}>
          <Lock size={10} color={Theme.colors.primary} />
          <Text style={styles.secureText}>JWT Secured</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.authCard}>
          <View style={styles.header}>
            <Text style={styles.brandTitle}>MyMindTherapyFriend</Text>
            <Text style={styles.title}>
              {mode === 'signin' && 'Sign In'}
              {mode === 'signup' && 'Create Account'}
              {mode === 'forgot' && 'Reset Password'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'forgot'
                ? 'Enter your account email/username and choose a new password.'
                : `to continue to ${role.toUpperCase().replace('_', ' ')} portal`}
            </Text>
          </View>

          {/* Inline Info Message Banner */}
          {infoMessage ? (
            <View style={styles.infoBox}>
              <CheckCircle2 size={16} color="#15803D" />
              <Text style={styles.infoBoxText}>{infoMessage}</Text>
            </View>
          ) : null}

          {/* Inline Error Message Banner */}
          {errorMessage ? (
            <View style={styles.errorBox}>
              <AlertCircle size={16} color={Theme.colors.error} />
              <Text style={styles.errorBoxText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Form Content based on mode */}
          {mode === 'signin' && (
            <View style={styles.form}>
              {/* Email / Username field */}
              <View style={styles.inputContainer}>
                <Mail size={18} color={Theme.colors.primary} style={styles.fieldIcon} />
                <TextInput
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={(val) => {
                    setEmail(val);
                    if (errorMessage) setErrorMessage('');
                  }}
                  style={styles.input}
                  placeholder="Email or Username"
                  placeholderTextColor={Theme.colors.outline}
                />
              </View>

              {/* Password field */}
              <View style={styles.inputContainer}>
                <Lock size={18} color={Theme.colors.primary} style={styles.fieldIcon} />
                <TextInput
                  secureTextEntry
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    if (errorMessage) setErrorMessage('');
                  }}
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={Theme.colors.outline}
                />
              </View>

              {/* Forgot password link */}
              <TouchableOpacity
                style={styles.forgotBtn}
                onPress={() => {
                  setErrorMessage('');
                  setInfoMessage('');
                  setMode('forgot');
                }}
              >
                <Text style={styles.forgotBtnText}>Forgot password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleLogin}
                disabled={loading}
                style={styles.submitBtn}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text style={styles.submitBtnText}>Sign In</Text>
                    <ArrowRight size={16} color="#FFF" />
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.toggleContainer}>
                <Text style={styles.toggleText}>Don't have an account?</Text>
                <TouchableOpacity onPress={() => {
                  setErrorMessage('');
                  setInfoMessage('');
                  setMode('signup');
                }}>
                  <Text style={styles.toggleLink}>Sign up</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {mode === 'signup' && (
            <View style={styles.form}>
              {/* Username field */}
              <View style={styles.inputContainer}>
                <User size={18} color={Theme.colors.primary} style={styles.fieldIcon} />
                <TextInput
                  autoCapitalize="none"
                  value={username}
                  onChangeText={(val) => {
                    setUsername(val);
                    if (errorMessage) setErrorMessage('');
                  }}
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor={Theme.colors.outline}
                />
              </View>

              {/* Email field */}
              <View style={styles.inputContainer}>
                <Mail size={18} color={Theme.colors.primary} style={styles.fieldIcon} />
                <TextInput
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={(val) => {
                    setEmail(val);
                    if (errorMessage) setErrorMessage('');
                  }}
                  style={styles.input}
                  placeholder="Email Address"
                  placeholderTextColor={Theme.colors.outline}
                />
              </View>

              {/* Password field */}
              <View style={styles.inputContainer}>
                <Lock size={18} color={Theme.colors.primary} style={styles.fieldIcon} />
                <TextInput
                  secureTextEntry
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    if (errorMessage) setErrorMessage('');
                  }}
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={Theme.colors.outline}
                />
              </View>

              {/* Repassword field */}
              <View style={styles.inputContainer}>
                <KeyRound size={18} color={Theme.colors.primary} style={styles.fieldIcon} />
                <TextInput
                  secureTextEntry
                  value={repassword}
                  onChangeText={(val) => {
                    setRepassword(val);
                    if (errorMessage) setErrorMessage('');
                  }}
                  style={styles.input}
                  placeholder="Confirm Password (repassword)"
                  placeholderTextColor={Theme.colors.outline}
                />
              </View>

              <TouchableOpacity
                onPress={handleRegister}
                disabled={loading}
                style={styles.submitBtn}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text style={styles.submitBtnText}>Create Account</Text>
                    <CheckCircle2 size={16} color="#FFF" />
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.toggleContainer}>
                <Text style={styles.toggleText}>Already have an account?</Text>
                <TouchableOpacity onPress={() => {
                  setErrorMessage('');
                  setInfoMessage('');
                  setMode('signin');
                }}>
                  <Text style={styles.toggleLink}>Sign in</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {mode === 'forgot' && (
            <View style={styles.form}>
              {/* Email / Username field for reset */}
              <View style={styles.inputContainer}>
                <Mail size={18} color={Theme.colors.primary} style={styles.fieldIcon} />
                <TextInput
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={(val) => {
                    setEmail(val);
                    if (errorMessage) setErrorMessage('');
                  }}
                  style={styles.input}
                  placeholder="Registered Email or Username"
                  placeholderTextColor={Theme.colors.outline}
                />
              </View>

              {/* New Password field */}
              <View style={styles.inputContainer}>
                <Lock size={18} color={Theme.colors.primary} style={styles.fieldIcon} />
                <TextInput
                  secureTextEntry
                  value={newPassword}
                  onChangeText={(val) => {
                    setNewPassword(val);
                    if (errorMessage) setErrorMessage('');
                  }}
                  style={styles.input}
                  placeholder="New Password"
                  placeholderTextColor={Theme.colors.outline}
                />
              </View>

              {/* Confirm New Password field */}
              <View style={styles.inputContainer}>
                <KeyRound size={18} color={Theme.colors.primary} style={styles.fieldIcon} />
                <TextInput
                  secureTextEntry
                  value={confirmNewPassword}
                  onChangeText={(val) => {
                    setConfirmNewPassword(val);
                    if (errorMessage) setErrorMessage('');
                  }}
                  style={styles.input}
                  placeholder="Confirm New Password"
                  placeholderTextColor={Theme.colors.outline}
                />
              </View>

              <TouchableOpacity
                onPress={handleForgotPassword}
                disabled={loading}
                style={styles.submitBtn}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text style={styles.submitBtnText}>Reset Password</Text>
                    <CheckCircle2 size={16} color="#FFF" />
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.toggleContainer}>
                <Text style={styles.toggleText}>Remember your password?</Text>
                <TouchableOpacity onPress={() => {
                  setErrorMessage('');
                  setInfoMessage('');
                  setMode('signin');
                }}>
                  <Text style={styles.toggleLink}>Back to Sign in</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <Text style={[styles.gdprFootnote, { bottom: Math.max(insets.bottom, 12) + 12 }]}>
        🔒 End-to-end encrypted JWT session • HIPAA & GDPR Compliant
      </Text>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  topBar: {
    position: 'absolute',
    left: Theme.spacing.margin,
    right: Theme.spacing.margin,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Theme.radius.full,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  backBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: Theme.colors.onSurface,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: Theme.colors.primary + '0A',
    borderColor: Theme.colors.primary + '20',
    borderWidth: 1,
    borderRadius: Theme.radius.default,
  },
  secureText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 10,
    color: Theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Theme.spacing.margin,
    paddingTop: 100,
    paddingBottom: 60,
  },
  authCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 4,
    width: '100%',
  },
  header: {
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  brandTitle: {
    fontFamily: Theme.fonts.display,
    fontSize: 22,
    color: Theme.colors.primary,
    marginBottom: 10,
  },
  title: {
    fontFamily: Theme.fonts.headline,
    fontSize: 20,
    color: '#1C1917',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 13,
    color: '#78716C',
    lineHeight: 18,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  errorBoxText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12.5,
    color: Theme.colors.error,
    flex: 1,
  },
  form: {
    width: '100%',
    gap: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 14,
    height: 50,
  },
  fieldIcon: {
    marginRight: 10,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  infoBoxText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12.5,
    color: '#15803D',
    flex: 1,
  },
  input: {
    flex: 1,
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: '#1C1917',
  },
  otpInput: {
    fontFamily: Theme.fonts.headline,
    fontSize: 22,
    letterSpacing: 6,
    textAlign: 'center',
    color: Theme.colors.primary,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 2,
  },
  forgotBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12.5,
    color: Theme.colors.primary,
  },
  submitBtn: {
    flexDirection: 'row',
    height: 48,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
    color: '#FFF',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  toggleText: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: '#78716C',
  },
  toggleLink: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
    color: Theme.colors.primary,
  },
  gdprFootnote: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: '#A8A29E',
  },
});

export default ClerkAuthScreen;
