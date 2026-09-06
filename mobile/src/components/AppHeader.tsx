import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Image, Modal, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeartHandshake, LogOut, X, Bell, Sparkles, Wallet, FileText } from 'lucide-react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useNavigation } from '@react-navigation/native';
import { Theme } from '../theme';

interface AppHeaderProps {
  userFirstName?: string;
  role?: string;
  onUpgradePress?: () => void;
  onProfilePress?: () => void;
  userImageUrl?: string;
  navigation?: any;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  userFirstName = 'Friend',
  role = 'user',
  onUpgradePress,
  onProfilePress,
  userImageUrl,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const fallbackNavigation = useNavigation();
  const activeNavigation = navigation || fallbackNavigation;
  const [modalVisible, setModalVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { signOut } = useAuth();
  const { user } = useUser();

  React.useEffect(() => {
    let active = true;
    const fetchUnread = async () => {
      try {
        const API = require('../lib/api').default;
        const res = await API.notification.list();
        if (active && res && Array.isArray(res.notifications)) {
          const count = res.notifications.filter((n: any) => !n.read).length;
          setUnreadCount(count);
        }
      } catch (err) {
        // Silent catch for dev/unauthenticated states
      }
    };

    fetchUnread();
    // Poll every 15 seconds to keep unread badges perfectly synced
    const interval = setInterval(fetchUnread, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.log("Clerk signOut note (already signed out or dev reload):", err);
    } finally {
      setModalVisible(false);
      if (navigation) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Landing' }],
        });
      }
    }
  };

  const finalAvatarUrl = userImageUrl || user?.imageUrl;
  const emailAddress = user?.primaryEmailAddress?.emailAddress || 'MyMindTherapyFriend Member';
  const displayName = user?.fullName || userFirstName;

  return (
    <View style={[styles.headerContainer, { paddingTop: insets.top + 8 }]}>
      <View style={styles.leftSection}>
        <View style={styles.logoCircle}>
          <Image source={require('../../assets/logo.png')} style={{ width: 26, height: 26 }} resizeMode="contain" />
        </View>
        <View>
          <Text style={styles.brandTitle}>MyMindTherapyFriend</Text>
          {role !== 'user' && (
            <Text style={styles.roleBadge}>{role.toUpperCase().replace('_', ' ')}</Text>
          )}
        </View>
      </View>

      <View style={styles.rightSection}>
        {/* {(role === 'user' || role === 'therapist' || role === 'org_admin') && (
          <TouchableOpacity 
            onPress={onUpgradePress || (() => {
              if (navigation) {
                navigation.navigate('Plans');
              }
            })} 
            style={styles.upgradeBtn}
          >
            <Text style={styles.upgradeText}>
              {role === 'org_admin' ? 'Subscription' : 'Upgrade'}
            </Text>
          </TouchableOpacity>
        )} */}

        <TouchableOpacity
          onPress={() => {
            if (navigation) {
              navigation.navigate('Notifications');
            }
          }}
          style={styles.notificationBtn}
        >
          <Bell size={22} color={Theme.colors.onSurfaceVariant} />
          {unreadCount > 0 && (
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={onProfilePress || (() => setModalVisible(true))} 
          style={styles.avatarBorder}
        >
          {finalAvatarUrl ? (
            <Image source={{ uri: finalAvatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>
                {displayName.substring(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Profile Details & Sign Out Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <TouchableOpacity 
            style={styles.modalContent}
            activeOpacity={1}
          >
            {/* Close Button */}
            <TouchableOpacity 
              onPress={() => setModalVisible(false)}
              style={styles.closeBtn}
            >
              <X size={18} color={Theme.colors.onSurfaceVariant} />
            </TouchableOpacity>

            {/* Profile Info */}
            <View style={styles.modalHeader}>
              <View style={styles.modalAvatarBorder}>
                {finalAvatarUrl ? (
                  <Image source={{ uri: finalAvatarUrl }} style={styles.modalAvatarImage} />
                ) : (
                  <View style={styles.modalAvatarFallback}>
                    <Text style={styles.modalAvatarText}>
                      {displayName.substring(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.modalName}>{displayName}</Text>
              <Text style={styles.modalEmail}>{emailAddress}</Text>
              <View style={styles.roleTag}>
                <Text style={styles.roleTagText}>{role.toUpperCase().replace('_', ' ')}</Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              {role === 'user' && (
                <>
                  <TouchableOpacity 
                    style={styles.upgradeActionBtn}
                    onPress={() => {
                      setModalVisible(false);
                      activeNavigation.navigate('Plans');
                    }}
                  >
                    <Sparkles size={18} color="#FFF" />
                    <Text style={styles.upgradeActionText}>Upgrade Plan</Text>
                  </TouchableOpacity>

                  {/* <TouchableOpacity 
                    style={[styles.upgradeActionBtn, { backgroundColor: Theme.colors.primaryContainer }]}
                    onPress={() => {
                      setModalVisible(false);
                      activeNavigation.navigate('Wallet');
                    }}
                  >
                    <Wallet size={18} color="#FFF" />
                    <Text style={styles.upgradeActionText}>My Wallet</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.upgradeActionBtn, { backgroundColor: Theme.colors.secondary }]}
                    onPress={() => {
                      setModalVisible(false);
                      activeNavigation.navigate('Reports');
                    }}
                  >
                    <FileText size={18} color="#FFF" />
                    <Text style={styles.upgradeActionText}>Wellness Reports</Text>
                  </TouchableOpacity> */}
                </>
              )}

              <TouchableOpacity 
                style={styles.logoutActionBtn}
                onPress={handleSignOut}
              >
                <LogOut size={18} color={Theme.colors.error} />
                <Text style={styles.logoutActionText}>Sign Out</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.cancelActionBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelActionText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.margin,
    paddingBottom: Theme.spacing.xs,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceHigh,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  logoCircle: {
    width: 36,
    height: 36,
    borderRadius: Theme.radius.full,
    backgroundColor: Theme.colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    fontFamily: Theme.fonts.display,
    fontSize: 18,
    color: Theme.colors.primary,
    letterSpacing: -0.5,
  },
  roleBadge: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 9,
    color: Theme.colors.secondary,
    letterSpacing: 0.5,
    marginTop: -2,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  upgradeBtn: {
    backgroundColor: Theme.colors.secondaryContainer + '20',
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.base + 2,
    borderRadius: Theme.radius.full,
    borderWidth: 1,
    borderColor: Theme.colors.secondaryContainer + '40',
  },
  upgradeText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12,
    color: Theme.colors.secondary,
  },
  avatarBorder: {
    width: 38,
    height: 38,
    borderRadius: Theme.radius.full,
    borderWidth: 2,
    borderColor: Theme.colors.primary,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.margin,
  },
  modalContent: {
    backgroundColor: '#FFF',
    width: '90%',
    maxWidth: 340,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md + 4,
    alignItems: 'center',
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: Theme.spacing.sm,
    right: Theme.spacing.sm,
    padding: 8,
    borderRadius: Theme.radius.full,
    backgroundColor: Theme.colors.surfaceLow,
  },
  modalHeader: {
    alignItems: 'center',
    marginTop: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
  },
  modalAvatarBorder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: Theme.colors.primary,
    overflow: 'hidden',
    marginBottom: Theme.spacing.sm,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  modalAvatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  modalAvatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAvatarText: {
    color: '#FFF',
    fontFamily: Theme.fonts.headline,
    fontSize: 28,
  },
  modalName: {
    fontFamily: Theme.fonts.display,
    fontSize: 20,
    color: Theme.colors.onSurface,
    textAlign: 'center',
  },
  modalEmail: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  roleTag: {
    backgroundColor: Theme.colors.primary + '12',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Theme.radius.full,
    marginTop: Theme.spacing.xs,
  },
  roleTagText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 10,
    color: Theme.colors.primary,
    letterSpacing: 0.5,
  },
  modalActions: {
    width: '100%',
    gap: Theme.spacing.sm,
  },
  logoutActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF2F2',
    height: 48,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.error + '25',
  },
  logoutActionText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
    color: Theme.colors.error,
  },
  upgradeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Theme.colors.primary,
    height: 48,
    borderRadius: Theme.radius.lg,
    elevation: 2,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  upgradeActionText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
    color: '#FFF',
  },
  cancelActionBtn: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Theme.radius.lg,
    backgroundColor: Theme.colors.surfaceLow,
  },
  cancelActionText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
  },
  notificationBtn: {
    padding: Theme.spacing.xs,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: Theme.colors.error,
    borderRadius: Theme.radius.full,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontFamily: Theme.fonts.bodyBold,
    lineHeight: 10,
  },
});

export default AppHeader;
