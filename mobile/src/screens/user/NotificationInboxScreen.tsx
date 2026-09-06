import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Bell,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Info,
  Check,
  Trash2,
} from 'lucide-react-native';
import API from '../../lib/api';
import { Theme } from '../../theme';

interface NotificationItem {
  _id: string;
  title: string;
  body: string;
  type: 'booking' | 'approval' | 'crisis_alert' | 'system' | 'general';
  read: boolean;
  metadata?: any;
  createdAt: string;
}

export const NotificationInboxScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await API.notification.list();
      if (res && Array.isArray(res.notifications)) {
        setNotifications(res.notifications);
      }
    } catch (err) {
      console.warn('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      // Optimistically update UI
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      await API.notification.markRead(id);
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      // Optimistically update UI
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      await API.notification.markAllRead();
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const getIcon = (type: string, read: boolean) => {
    const size = 20;
    const color = read ? Theme.colors.onSurfaceVariant : Theme.colors.primary;

    switch (type) {
      case 'booking':
        return (
          <View style={[styles.iconWrapper, { backgroundColor: Theme.colors.primary + '15' }]}>
            <Calendar size={size} color={Theme.colors.primary} />
          </View>
        );
      case 'approval':
        return (
          <View style={[styles.iconWrapper, { backgroundColor: Theme.colors.secondary + '15' }]}>
            <CheckCircle size={size} color={Theme.colors.secondary} />
          </View>
        );
      case 'crisis_alert':
        return (
          <View style={[styles.iconWrapper, { backgroundColor: Theme.colors.error + '15' }]}>
            <AlertTriangle size={size} color={Theme.colors.error} />
          </View>
        );
      default:
        return (
          <View style={[styles.iconWrapper, { backgroundColor: Theme.colors.surfaceHigh }]}>
            <Info size={size} color={Theme.colors.onSurfaceVariant} />
          </View>
        );
    }
  };

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const timeFormatted = new Date(item.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          if (!item.read) {
            handleMarkAsRead(item._id);
          }
        }}
        style={[
          styles.notificationCard,
          !item.read && styles.unreadCard,
        ]}
      >
        <View style={styles.cardHeader}>
          {getIcon(item.type, item.read)}
          <View style={styles.contentContainer}>
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.notificationTitle,
                  !item.read && styles.unreadTitle,
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              {!item.read && <View style={styles.unreadIndicatorDot} />}
            </View>
            <Text style={styles.notificationBody}>{item.body}</Text>
            <Text style={styles.timeText}>{timeFormatted}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const totalUnread = notifications.filter((n) => !n.read).length;

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      
      {/* Premium Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={22} color={Theme.colors.onSurface} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            {totalUnread > 0 && (
              <Text style={styles.subtitleText}>{totalUnread} new alert{totalUnread > 1 ? 's' : ''}</Text>
            )}
          </View>
        </View>

        {totalUnread > 0 && (
          <TouchableOpacity
            onPress={handleMarkAllRead}
            style={styles.markAllBtn}
          >
            <Check size={16} color={Theme.colors.primary} />
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main List Area */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loadingText}>Gathering your inbox alerts...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Bell size={40} color={Theme.colors.primary} style={{ opacity: 0.6 }} />
          </View>
          <Text style={styles.emptyTitle}>Your MyMindTherapyFriend is quiet</Text>
          <Text style={styles.emptyDesc}>
            All caught up! Dynamic alerts related to therapists, booking confirmations, subscription payments, and clinical updates will display here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchNotifications();
          }}
          contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom, Theme.spacing.margin) }]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF9', // Corporate warm elegant cream off-white
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.margin,
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceHigh,
    backgroundColor: '#FFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Theme.radius.full,
    backgroundColor: Theme.colors.surfaceLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Theme.fonts.display,
    color: Theme.colors.onSurface,
  },
  subtitleText: {
    fontSize: 12,
    fontFamily: Theme.fonts.bodyBold,
    color: Theme.colors.primary,
    marginTop: -2,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Theme.radius.full,
    backgroundColor: Theme.colors.primary + '12',
  },
  markAllText: {
    fontSize: 12,
    fontFamily: Theme.fonts.bodyBold,
    color: Theme.colors.primary,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Theme.spacing.sm,
    fontFamily: Theme.fonts.body,
    color: Theme.colors.textMuted,
    fontSize: 14,
  },
  listContent: {
    padding: Theme.spacing.margin,
    gap: Theme.spacing.sm,
  },
  notificationCard: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  unreadCard: {
    borderColor: Theme.colors.primary + '30',
    backgroundColor: Theme.colors.primary + '05', // Subtle brand backdrop for unread
  },
  cardHeader: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: Theme.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 15,
    fontFamily: Theme.fonts.headline,
    color: Theme.colors.onSurfaceVariant,
    flex: 1,
  },
  unreadTitle: {
    color: Theme.colors.onSurface,
    fontFamily: Theme.fonts.display, // Bold-prominent weight for unread titles
  },
  unreadIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Theme.colors.primary,
    marginLeft: 8,
  },
  notificationBody: {
    fontSize: 13,
    fontFamily: Theme.fonts.body,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 18,
    marginBottom: Theme.spacing.xs,
  },
  timeText: {
    fontSize: 11,
    fontFamily: Theme.fonts.body,
    color: Theme.colors.textMuted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Theme.colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.display,
    color: Theme.colors.onSurface,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: Theme.fonts.body,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default NotificationInboxScreen;
