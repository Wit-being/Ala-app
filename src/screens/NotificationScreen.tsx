import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Animated,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const theme = {
  background: '#050a15',
  glass: 'rgba(255, 255, 255, 0.06)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  glassBorderLight: 'rgba(255, 255, 255, 0.15)',
  primary: '#60a5fa',
  gold: '#d4af37',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textSubtle: '#64748b',
  textMuted: '#475569',
  danger: '#ef4444',
  purple: '#a78bfa',
  success: '#10b981',
};

// Ambient gradients
const AMBIENT_GRADIENTS: readonly [string, string, string][] = [
  ['#050a15', '#0a1628', '#0f172a'],
  ['#0a0f1a', '#121a2e', '#1a2744'],
  ['#0d0a15', '#1a1428', '#261e3d'],
  ['#0a1210', '#122420', '#1a3530'],
  ['#0a0d14', '#141e2d', '#1e2e45'],
];

const GRADIENT_INTERVAL = 14000;

// Animated Background
const AnimatedGradientBackground = ({ children }: { children: React.ReactNode }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      const next = (currentIndex + 1) % AMBIENT_GRADIENTS.length;
      setNextIndex(next);
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 2000,
        useNativeDriver: true,
      }).start(() => {
        setCurrentIndex(next);
        fadeAnim.setValue(1);
      });
    }, GRADIENT_INTERVAL);
    return () => clearInterval(interval);
  }, [currentIndex]);

  return (
    <View style={styles.gradientContainer}>
      <LinearGradient colors={AMBIENT_GRADIENTS[nextIndex]} style={StyleSheet.absoluteFill} />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
        <LinearGradient colors={AMBIENT_GRADIENTS[currentIndex]} style={StyleSheet.absoluteFill} />
      </Animated.View>
      {children}
    </View>
  );
};

interface Notification {
  id: string;
  type: 'like' | 'interpretation' | 'system' | 'reminder' | 'welcome';
  title: string;
  body: string | null;
  data: any;
  read: boolean;
  created_at: string;
}

const NOTIFICATION_CONFIG: Record<string, { icon: string; color: string }> = {
  like: { icon: 'heart', color: theme.danger },
  interpretation: { icon: 'chatbubble', color: theme.gold },
  system: { icon: 'information-circle', color: theme.primary },
  reminder: { icon: 'moon', color: theme.purple },
  welcome: { icon: 'sparkles', color: theme.gold },
};

export default function NotificationScreen({ navigation }: any) {
  const user = useAuthStore((state) => state.user);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [user?.id])
  );

  const fetchNotifications = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    try {
      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await supabase.from('notifications').delete().eq('id', id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    if (!notification.read) markAsRead(notification.id);

    // Navigate based on notification type
    if (notification.data?.dream_id) {
      // Could navigate to dream detail in the future
      navigation.goBack();
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const NotificationItem = ({ item }: { item: Notification }) => {
    const config = NOTIFICATION_CONFIG[item.type] || NOTIFICATION_CONFIG.system;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
      Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
    };

    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[styles.notificationCard, !item.read && styles.notificationCardUnread]}
          onPress={() => handleNotificationPress(item)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onLongPress={() => deleteNotification(item.id)}
          activeOpacity={1}
        >
          <View style={[styles.iconWrap, { backgroundColor: config.color + '20' }]}>
            <Ionicons name={config.icon as any} size={20} color={config.color} />
          </View>

          <View style={styles.notificationContent}>
            <View style={styles.notificationHeader}>
              <Text style={styles.notificationTitle} numberOfLines={1}>
                {item.title}
              </Text>
              {!item.read && <View style={styles.unreadDot} />}
            </View>
            {item.body && (
              <Text style={styles.notificationBody} numberOfLines={2}>
                {item.body}
              </Text>
            )}
            <Text style={styles.notificationTime}>{formatTime(item.created_at)}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="notifications-outline" size={48} color={theme.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>No notifications yet</Text>
      <Text style={styles.emptySubtitle}>
        When someone interacts with your dreams, you'll see it here
      </Text>
    </View>
  );

  return (
    <AnimatedGradientBackground>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Notifications</Text>

          {unreadCount > 0 ? (
            <TouchableOpacity onPress={markAllAsRead} style={styles.headerBtn}>
              <Ionicons name="checkmark-done" size={22} color={theme.primary} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <View style={styles.unreadBanner}>
            <Text style={styles.unreadBannerText}>
              {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <NotificationItem item={item} />}
            contentContainerStyle={[
              styles.listContent,
              notifications.length === 0 && styles.listContentEmpty,
            ]}
            ListEmptyComponent={EmptyState}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  fetchNotifications();
                }}
                tintColor={theme.primary}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </AnimatedGradientBackground>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
  },

  // Unread Banner
  unreadBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: theme.primary + '15',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.primary + '30',
  },
  unreadBannerText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.primary,
    textAlign: 'center',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  listContentEmpty: {
    flex: 1,
  },

  // Notification Card
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.glass,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  notificationCardUnread: {
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
    borderColor: 'rgba(96, 165, 250, 0.2)',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.primary,
    marginLeft: 8,
  },
  notificationBody: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 12,
    color: theme.textMuted,
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.glass,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});