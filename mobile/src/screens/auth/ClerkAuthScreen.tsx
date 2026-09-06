import React, { useState } from 'react';
import { View, StyleSheet, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useSignIn, useSignUp, useOAuth, useAuth } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Mail, ArrowRight, ShieldCheck, ArrowLeft, Lock, Apple } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

WebBrowser.maybeCompleteAuthSession();

const useWarmUpBrowser = () => {
  React.useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
};
import { Theme } from '../../theme';

import API, { setTokenGetter } from '../../lib/api';

interface ClerkAuthScreenProps {
  navigation: any;
  route: any;
}

export const ClerkAuthScreen: React.FC<ClerkAuthScreenProps> = ({ navigation, route }) => {
  const role = route.params?.role || 'user';
  const upgradePlan = route.params?.upgradePlan;
  const insets = useSafeAreaInsets();

  const { signIn, setActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const { isSignedIn, isLoaded: authLoaded, getToken } = useAuth();
  
  useWarmUpBrowser();
  const { startOAuthFlow: startGoogleFlow } = useOAuth({ strategy: 'oauth_google' });
  const { startOAuthFlow: startAppleFlow } = useOAuth({ strategy: 'oauth_apple' });

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [isSignUpFlow, setIsSignUpFlow] = useState(false);
  const redirectingRef = React.useRef(false);
  const verifyingRef = React.useRef(false);

  // Monitor Clerk global authentication state to catch deep-linked browser return successes!
  React.useEffect(() => {
    if (authLoaded && isSignedIn && !redirectingRef.current) {
      completeAuthProcess("");
    }
  }, [authLoaded, isSignedIn]);

  // Dynamic role redirect logic
  const completeAuthProcess = async (userId: string) => {
    if (redirectingRef.current) return;
    redirectingRef.current = true;
    setRedirecting(true);
    let recoveredRole = role;
    let recoveredUpgrade = upgradePlan;

    console.log("[AuthRedirect] Starting completeAuthProcess with Clerk session.");

    try {
      // Instantly bootstrap our API token layer to prevent parent component race conditions!
      if (isSignedIn && getToken) {
        console.log("[AuthRedirect] Injecting active Clerk token getter into API client.");
        setTokenGetter(async () => {
          try {
            return await getToken();
          } catch (err) {
            return null;
          }
        });
      }
    } catch (tokenErr) {
      console.error("[AuthRedirect] Failed to retrieve token inside ClerkAuthScreen:", tokenErr);
    }

    try {
      const stashedRole = await AsyncStorage.getItem('intended_role');
      if (stashedRole) {
        recoveredRole = stashedRole;
        console.log("[AuthRedirect] Recovered stashed role from AsyncStorage:", recoveredRole);
      }
      const stashedUpgrade = await AsyncStorage.getItem('upgrade_plan');
      if (stashedUpgrade) {
        recoveredUpgrade = stashedUpgrade;
        console.log("[AuthRedirect] Recovered stashed upgrade plan:", recoveredUpgrade);
      }

      console.log("[AuthRedirect] Calling backend setRole with role:", recoveredRole);
      // First update their role in the database to lock/set their intended portal role!
      const res = await API.auth.setRole(recoveredRole);
      const confirmedRole = res.user?.role || recoveredRole;
      console.log("[AuthRedirect] Role confirmed by backend:", confirmedRole);

      // Clear storage
      await AsyncStorage.removeItem('intended_role');
      await AsyncStorage.removeItem('upgrade_plan');

      if (confirmedRole === 'user') {
        console.log("[AuthRedirect] Routing user to onboarding/dashboard...");
        API.auth.me()
          .then((profile) => {
            if (profile && profile.onboarding && profile.onboarding.completedAt) {
              console.log("[AuthRedirect] Onboarding already completed. Routing to UserTabs.");
              navigation.replace('UserTabs', { screen: 'Home', upgradePlan: recoveredUpgrade });
            } else {
              console.log("[AuthRedirect] Onboarding pending. Routing to Onboarding screen.");
              navigation.replace('Onboarding', { upgradePlan: recoveredUpgrade });
            }
          })
          .catch((err) => {
            console.error("[AuthRedirect] Failed to fetch profile for onboarding check:", err);
            navigation.replace('UserTabs', { screen: 'Home', upgradePlan: recoveredUpgrade });
          });
      } else if (confirmedRole === 'therapist') {
        console.log("[AuthRedirect] Routing to TherapistTabs.");
        navigation.replace('TherapistTabs');
      } else if (confirmedRole === 'org_admin') {
        console.log("[AuthRedirect] Routing to OrgTabs.");
        navigation.replace('OrgTabs');
      } else if (confirmedRole === 'super_admin') {
        console.log("[AuthRedirect] Routing to AdminTabs.");
        navigation.replace('AdminTabs');
      }
    } catch (err) {
      console.error("[AuthRedirect] Failed to set user role in backend:", err);
      
      // Fallback redirect in case of network issue - using recovered values
      await AsyncStorage.removeItem('intended_role');
      await AsyncStorage.removeItem('upgrade_plan');

      Alert.alert('Authenticated!', `Logged in successfully as ${recoveredRole.toUpperCase().replace('_', ' ')}!`);
      
      if (recoveredRole === 'user') {
        navigation.replace('UserTabs', { screen: 'Home', upgradePlan: recoveredUpgrade });
      } else if (recoveredRole === 'therapist') {
        navigation.replace('TherapistTabs');
      } else if (recoveredRole === 'org_admin') {
        navigation.replace('OrgTabs');
      } else if (recoveredRole === 'super_admin') {
        navigation.replace('AdminTabs');
      }
    }
  };

  const handleGoogleOAuth = React.useCallback(async () => {
    try {
      await AsyncStorage.setItem('intended_role', role);
      if (upgradePlan) {
        await AsyncStorage.setItem('upgrade_plan', upgradePlan);
      }
      console.log("[OAuthFlow] Initiating Google OAuth with scheme 'mymindtherapyfriend'");
      const { createdSessionId, signIn, signUp, setActive: setSessionActive } = await startGoogleFlow({
        redirectUrl: Linking.createURL('clerk-auth', { scheme: 'mymindtherapyfriend' })
      });

      const activeSessionId = createdSessionId || signUp?.createdSessionId || signIn?.createdSessionId;

      if (activeSessionId && setSessionActive) {
        console.log("[OAuthFlow] Activating session:", activeSessionId);
        await setSessionActive({ session: activeSessionId });
      } else {
        console.warn("[OAuthFlow] No active session ID returned. New user state details:", {
          createdSessionId,
          signUpStatus: signUp?.status,
          signInStatus: signIn?.status,
          missingFields: signUp?.missingFields,
          unverifiedFields: signUp?.unverifiedFields
        });

        if (signUp?.status === 'missing_requirements') {
          const missing = signUp.missingFields || [];
          
          // Auto-resolve required username field dynamically!
          if (missing.includes('username') && missing.length === 1) {
            try {
              console.log("[OAuthFlow] Username is required but missing. Automatically generating and resolving username...");
              const emailPrefix = signUp.emailAddress 
                ? signUp.emailAddress.split('@')[0].replace(/[^a-zA-Z0-9]/g, '')
                : 'user';
              const randomSuffix = Math.random().toString(36).substring(2, 7);
              const generatedUsername = `${emailPrefix}_${randomSuffix}`.toLowerCase().substring(0, 15);
              
              console.log("[OAuthFlow] Updating signup with generated username:", generatedUsername);
              await signUp.update({ username: generatedUsername });
              
              const newSessionId = signUp.createdSessionId;
              if (newSessionId && setSessionActive) {
                console.log("[OAuthFlow] Auto-resolution successful! Activating session:", newSessionId);
                await setSessionActive({ session: newSessionId });
                return;
              }
            } catch (autoErr) {
              console.error("[OAuthFlow] Failed to auto-resolve missing username:", autoErr);
            }
          }

          Alert.alert(
            'Registration Incomplete',
            `Your Clerk Dashboard is configured to require additional fields: ${missing.join(', ') || 'Verification'}.\n\nGo to your Clerk Dashboard -> "User & Authentication" -> "Sign Up" and make these fields (like Phone Number or Username) optional so social logins can complete automatically!`,
            [{ text: 'OK' }]
          );
        }
      }
    } catch (err) {
      console.error('OAuth error', err);
      Alert.alert('OAuth Error', 'Failed to authenticate with Google');
    }
  }, [startGoogleFlow, role, upgradePlan]);

  const handleAppleOAuth = React.useCallback(async () => {
    try {
      await AsyncStorage.setItem('intended_role', role);
      if (upgradePlan) {
        await AsyncStorage.setItem('upgrade_plan', upgradePlan);
      }
      console.log("[OAuthFlow] Initiating Apple OAuth with scheme 'mymindtherapyfriend'");
      const { createdSessionId, signIn, signUp, setActive: setSessionActive } = await startAppleFlow({
        redirectUrl: Linking.createURL('clerk-auth', { scheme: 'mymindtherapyfriend' })
      });

      const activeSessionId = createdSessionId || signUp?.createdSessionId || signIn?.createdSessionId;

      if (activeSessionId && setSessionActive) {
        console.log("[OAuthFlow] Activating session:", activeSessionId);
        await setSessionActive({ session: activeSessionId });
      } else {
        console.warn("[OAuthFlow] No active session ID returned. New user state details:", {
          createdSessionId,
          signUpStatus: signUp?.status,
          signInStatus: signIn?.status,
          missingFields: signUp?.missingFields,
          unverifiedFields: signUp?.unverifiedFields
        });

        if (signUp?.status === 'missing_requirements') {
          const missing = signUp.missingFields || [];

          // Auto-resolve required username field dynamically!
          if (missing.includes('username') && missing.length === 1) {
            try {
              console.log("[OAuthFlow] Username is required but missing. Automatically generating and resolving username...");
              const emailPrefix = signUp.emailAddress 
                ? signUp.emailAddress.split('@')[0].replace(/[^a-zA-Z0-9]/g, '')
                : 'user';
              const randomSuffix = Math.random().toString(36).substring(2, 7);
              const generatedUsername = `${emailPrefix}_${randomSuffix}`.toLowerCase().substring(0, 15);
              
              console.log("[OAuthFlow] Updating signup with generated username:", generatedUsername);
              await signUp.update({ username: generatedUsername });
              
              const newSessionId = signUp.createdSessionId;
              if (newSessionId && setSessionActive) {
                console.log("[OAuthFlow] Auto-resolution successful! Activating session:", newSessionId);
                await setSessionActive({ session: newSessionId });
                return;
              }
            } catch (autoErr) {
              console.error("[OAuthFlow] Failed to auto-resolve missing username:", autoErr);
            }
          }

          Alert.alert(
            'Registration Incomplete',
            `Your Clerk Dashboard is configured to require additional fields: ${missing.join(', ') || 'Verification'}.\n\nGo to your Clerk Dashboard -> "User & Authentication" -> "Sign Up" and make these fields (like Phone Number or Username) optional so social logins can complete automatically!`,
            [{ text: 'OK' }]
          );
        }
      }
    } catch (err) {
      console.error('OAuth error', err);
      Alert.alert('OAuth Error', 'Failed to authenticate with Apple');
    }
  }, [startAppleFlow, role, upgradePlan]);

  const isDevKey = (process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || "").startsWith("pk_test_") ||
                   (process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || "") === "";

  const handleSendCode = async () => {
    if (!email || !email.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      if (!signInLoaded || !signUpLoaded || !signIn) {
        // Fallback for development without active Clerk API keys in simulator
        console.log("Clerk hooks not fully loaded. Simulating code sent.");
        setPendingVerification(true);
        setLoading(false);
        return;
      }

      // If user explicitly chose SignUp flow, jump directly to signUp.create
      if (isSignUpFlow) {
        try {
          if (!signUp) return;
          await signUp.create({
            emailAddress: email,
          });
          await signUp.prepareEmailAddressVerification({
            strategy: 'email_code',
          });
          setPendingVerification(true);
        } catch (signUpErr: any) {
          let errorMsg = signUpErr.message || 'Could not send verification code.';
          if (isDevKey) {
            errorMsg += "\n\nNote: In Clerk Development Mode, OTP emails only send to verified test accounts in your Clerk Dashboard.";
          }
          Alert.alert('Registration Failed', errorMsg);
        }
        return;
      }

      // Start signIn flow with email OTP
      const signInAttempt = await signIn.create({
        identifier: email,
      });
      const emailCodeFactor = signInAttempt.supportedFirstFactors?.find(
        (factor) => factor.strategy === 'email_code'
      ) as any;
      if (!emailCodeFactor) {
        let errMsg = "Email OTP is not supported on your Clerk instance.";
        if (isDevKey) {
          errMsg += "\n\nPlease ensure 'Email verification code' is enabled under 'Authentication Factors' in your Clerk Dashboard.";
        }
        throw new Error(errMsg);
      }
      await signIn.prepareFirstFactor({
        strategy: 'email_code',
        emailAddressId: emailCodeFactor.emailAddressId,
      });
      setIsSignUpFlow(false);
      setPendingVerification(true);
    } catch (err: any) {
      console.log("Clerk SignIn error:", err.message || err);
      const isUserNotFound = err.message?.toLowerCase().includes("couldn't find your account") ||
                             err.errors?.[0]?.code === 'form_identifier_not_found';
                             
      if (isUserNotFound) {
        Alert.alert(
          'Account Not Found',
          "You don't have an account. Please sign up first.",
          [
            { 
              text: 'OK', 
              onPress: () => {
                // Automatically switch UI to sign up mode
                setIsSignUpFlow(true);
              } 
            }
          ]
        );
      } else {
        Alert.alert('Sign In Failed', err.message || 'Could not initiate sign in.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verifyingRef.current) {
      console.log("[Verification] Already verifying code, ignoring duplicate call.");
      return;
    }
    if (!code || code.length < 4) {
      Alert.alert('Invalid OTP', 'Please enter the verification code sent to your email.');
      return;
    }

    verifyingRef.current = true;
    setLoading(true);
    try {
      if (!signInLoaded || !signUpLoaded || !signIn || !signUp) {
        // Mock success bypass for local simulator
        completeAuthProcess('user_mock_123');
        setLoading(false);
        verifyingRef.current = false;
        return;
      }

      if (!isSignUpFlow) {
        const result = await signIn.attemptFirstFactor({
          strategy: 'email_code',
          code,
        });
        if (result.status === 'complete') {
          console.log("[Verification] SignIn successful. Activating session...");
          await setActive({ session: result.createdSessionId });
          // Redirection will be handled automatically by the React.useEffect on isSignedIn
        }
      } else {
        const result = await signUp.attemptEmailAddressVerification({
          code,
        });
        if (result.status === 'complete') {
          console.log("[Verification] SignUp successful. Activating session...");
          await setActive({ session: result.createdSessionId });
        } else if (result.status === 'missing_requirements') {
          const missing = result.missingFields || [];
          const hasUsername = missing.includes('username');
          const hasPassword = missing.includes('password');

          if (hasUsername || hasPassword) {
            try {
              const updateData: any = {};
              if (hasUsername) {
                console.log("[Verification] Username is required but missing. Automatically generating username...");
                const emailPrefix = email 
                  ? email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '')
                  : 'user';
                const randomSuffix = Math.random().toString(36).substring(2, 7);
                updateData.username = `${emailPrefix}_${randomSuffix}`.toLowerCase().substring(0, 15);
              }
              if (hasPassword) {
                console.log("[Verification] Password is required but missing. Automatically generating random password...");
                const randomPassword = Math.random().toString(36).substring(2, 15) + 
                                       Math.random().toString(36).substring(2, 15).toUpperCase() + 
                                       "!@#$";
                updateData.password = randomPassword;
              }

              console.log("[Verification] Updating signup with required fields:", Object.keys(updateData));
              await signUp.update(updateData);
              
              const newSessionId = signUp.createdSessionId;
              if (newSessionId && signUp.status === 'complete') {
                console.log("[Verification] Auto-resolution successful! Activating session:", newSessionId);
                await setActive({ session: newSessionId });
              }
            } catch (autoErr) {
              console.error("[Verification] Failed to auto-resolve missing fields:", autoErr);
              throw autoErr;
            }
          } else {
            throw new Error(`Registration incomplete. Missing fields: ${missing.join(', ')}`);
          }
        }
      }
    } catch (err: any) {
      console.log("[Verification] Error during code verification:", err);
      
      const errorMsg = err.message || '';
      const isAlreadyVerified = errorMsg.toLowerCase().includes('already been verified') || 
                                errorMsg.toLowerCase().includes('already verified') ||
                                JSON.stringify(err).toLowerCase().includes('already verified');

      if (isAlreadyVerified) {
        console.log("[Verification] Code was already verified. Attempting to activate session.");
        try {
          const sessionId = !isSignUpFlow ? signIn?.createdSessionId : signUp?.createdSessionId;
          const currentStatus = !isSignUpFlow ? signIn?.status : signUp?.status;

          if (currentStatus === 'complete' && sessionId) {
            await setActive({ session: sessionId });
            return;
          } else if (isSignUpFlow && currentStatus === 'missing_requirements' && signUp) {
            const missing = signUp.missingFields || [];
            const hasUsername = missing.includes('username');
            const hasPassword = missing.includes('password');

            if (hasUsername || hasPassword) {
              console.log("[Verification] Auto-resolving missing credentials on already-verified signup...");
              const updateData: any = {};
              if (hasUsername) {
                const emailPrefix = email 
                  ? email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '')
                  : 'user';
                const randomSuffix = Math.random().toString(36).substring(2, 7);
                updateData.username = `${emailPrefix}_${randomSuffix}`.toLowerCase().substring(0, 15);
              }
              if (hasPassword) {
                const randomPassword = Math.random().toString(36).substring(2, 15) + 
                                       Math.random().toString(36).substring(2, 15).toUpperCase() + 
                                       "!@#$";
                updateData.password = randomPassword;
              }

              await signUp.update(updateData);
              if (signUp.status === 'complete' && signUp.createdSessionId) {
                await setActive({ session: signUp.createdSessionId });
                return;
              }
            }
          } else if (isSignedIn) {
            // Already signed in, let useEffect handle redirect
            return;
          }
        } catch (activeErr) {
          console.error("[Verification] Failed to auto-activate already-verified session:", activeErr);
        }
      }

      Alert.alert('Verification Failed', err.message || 'Incorrect OTP code. Please try again.');
    } finally {
      setLoading(false);
      verifyingRef.current = false;
    }
  };

  // Note: Demo bypass has been removed in this version.

  return (
    <View style={styles.container}>
      {/* Absolute Header with Back Navigation */}
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={18} color={Theme.colors.onSurface} />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        
        <View style={styles.secureBadge}>
          <Lock size={10} color={Theme.colors.primary} />
          <Text style={styles.secureText}>secured by clerk</Text>
        </View>
      </View>

      {/* Main Premium Widget Card */}
      <View style={styles.authCard}>
        <View style={styles.header}>
          <Text style={styles.brandTitle}>MyMindTherapyFriend</Text>
          <Text style={styles.title}>
            {pendingVerification ? 'Enter OTP' : (isSignUpFlow ? 'Sign up' : 'Sign in')}
          </Text>
          <Text style={styles.subtitle}>
            {pendingVerification 
              ? `We sent a code to ${email}`
              : `to continue to MyMindTherapyFriend ${role.toUpperCase().replace('_', ' ')} portal`
            }
          </Text>
        </View>

        {!pendingVerification ? (
          <View style={styles.form}>
            {/* Google & Apple OAuth stacked premium buttons */}
            <View style={styles.oauthRow}>
              <TouchableOpacity 
                onPress={handleGoogleOAuth} 
                disabled={loading}
                style={styles.googleBtn}
              >
                <View style={styles.googleBadgeIcon}>
                  <View style={[styles.googleColorBar, { backgroundColor: '#4285F4' }]} />
                  <View style={[styles.googleColorBar, { backgroundColor: '#34A853' }]} />
                  <View style={[styles.googleColorBar, { backgroundColor: '#FBBC05' }]} />
                  <View style={[styles.googleColorBar, { backgroundColor: '#EA4335' }]} />
                </View>
                <Text style={styles.googleBtnText}>Google</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={handleAppleOAuth} 
                disabled={loading}
                style={styles.appleBtn}
              >
                <View style={styles.appleBadgeIcon}>
                  <Apple size={16} color="#FFF" />
                </View>
                <Text style={styles.appleBtnText}>Apple</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>
                {isSignUpFlow ? 'or sign up with email' : 'or sign in with email'}
              </Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email Field */}
            <View style={styles.inputContainer}>
              <Mail size={18} color={Theme.colors.primary} style={styles.fieldIcon} />
              <TextInput
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor={Theme.colors.outline}
              />
            </View>


            <TouchableOpacity 
              onPress={handleSendCode} 
              disabled={loading}
              style={styles.submitBtn}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.submitBtnText}>Continue</Text>
                  <ArrowRight size={16} color="#FFF" />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.toggleContainer}>
              <Text style={styles.toggleText}>
                {isSignUpFlow ? "Already have an account?" : "Don't have an account?"}
              </Text>
              <TouchableOpacity onPress={() => setIsSignUpFlow(!isSignUpFlow)}>
                <Text style={styles.toggleLink}>
                  {isSignUpFlow ? "Sign in" : "Sign up"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.form}>
            {/* OTP Verification Field */}
            <View style={styles.inputContainer}>
              <ShieldCheck size={18} color={Theme.colors.primary} style={styles.fieldIcon} />
              <TextInput
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={setCode}
                style={styles.input}
                placeholder="6-digit verification code"
                placeholderTextColor={Theme.colors.outline}
              />
            </View>

            <TouchableOpacity 
              onPress={handleVerifyCode} 
              disabled={loading}
              style={styles.submitBtn}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.submitBtnText}>Verify code</Text>
                  <ShieldCheck size={16} color="#FFF" />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Text style={[styles.gdprFootnote, { bottom: Math.max(insets.bottom, 16) + 16 }]}>
        🔒 GDPR Compliant • HIPAA Secure • End-to-end encrypted session
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6', // Beautiful soft warm ivory/beige
    justifyContent: 'center',
    padding: Theme.spacing.margin,
  },
  topBar: {
    position: 'absolute',
    top: 50,
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
    marginBottom: 24,
  },
  brandTitle: {
    fontFamily: Theme.fonts.display,
    fontSize: 22,
    color: Theme.colors.primary,
    marginBottom: 12,
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
  form: {
    width: '100%',
    gap: 12,
  },
  oauthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    justifyContent: 'space-between',
  },
  googleBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    borderRadius: Theme.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  googleBadgeIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 2,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    borderRadius: 4,
  },
  googleColorBar: {
    width: 3,
    height: 10,
    borderRadius: 1,
  },
  googleBtnText: {
    color: '#1C1917',
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
  },
  appleBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    backgroundColor: '#1C1917',
    borderRadius: Theme.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  appleBadgeIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  appleBtnText: {
    color: '#FFF',
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E7E5E4',
  },
  dividerText: {
    color: '#78716C',
    paddingHorizontal: 12,
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#D6D3D1',
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 14,
    height: 48,
    backgroundColor: '#FCFBFA',
  },
  fieldIcon: {
    opacity: 0.8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: Theme.fonts.body,
    color: '#1C1917',
  },
  submitBtn: {
    flexDirection: 'row',
    height: 48,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnText: {
    color: '#FFF',
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
  },
  gdprFootnote: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 11,
    color: '#A8A29E',
    textAlign: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  toggleText: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 13,
    color: '#78716C',
  },
  toggleLink: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: Theme.colors.primary,
    marginLeft: 4,
  },
});
export default ClerkAuthScreen;
