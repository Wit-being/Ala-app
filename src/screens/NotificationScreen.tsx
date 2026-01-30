import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Animated,
  RefreshControl,
  Image,
  Modal,
  Pressable,
  Switch,
  Alert,
  PanResponder,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { theme } from '../constants/theme';
import { AnimatedGradientBackground, LoadingSpinner, EmptyState } from '../components/common';
import DreamModal from '../components/main/DreamModal';
import { DreamWithMeta, UserProfile, Interpretation, ReactionType } from '../types/dreams';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;

interface Notification {
  id: string;
  user_id: string;
  type: string;
  message: string;
  dream_id: string | null;
  actor_id: string | null;
  read: boolean;
  created_at: string;
  actor?: UserProfile;
}

interface NotificationSettings {
  likes: boolean;
  interpretations: boolean;
  follows: boolean;
  system: boolean;
}

interface MuteOption {
  type: 'user' | 'post';
  id: string;
  name: string;
}

interface MutedUser {
  id: string;
  muted_user_id: string;
  profile?: UserProfile;
}

interface MutedPost {
  id: string;
  dream_id: string;
  dream?: { title: string | null };
}

// Settings Modal Component
const SettingsModal = ({
  visible,
  onClose,
  settings,
  onUpdateSettings,
  mutedUsers,
  mutedPosts,
  onUnmuteUser,
  onUnmutePost,
}: {
  visible: boolean;
  onClose: () => void;
  settings: NotificationSettings;
  onUpdateSettings: (key: keyof NotificationSettings, value: boolean) => void;
  mutedUsers: MutedUser[];
  mutedPosts: MutedPost[];
  onUnmuteUser: (id: string) => void;
  onUnmutePost: (id: string) => void;
}) => {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [activeTab, setActiveTab] = useState<'settings' | 'muted'>('settings');

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
      setActiveTab('settings');
    }
  }, [visible]);

  const getAvatarUrl = (profile?: UserProfile) => {
    if (profile?.avatar_url?.startsWith('http')) return profile.avatar_url;
    const name = profile?.display_name || profile?.username || 'U';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=60a5fa&size=64`;
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Animated.View style={[styles.settingsModalContainer, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.settingsModalContent}>
              <View style={styles.settingsModalHeader}>
                <Text style={styles.settingsModalTitle}>Settings</Text>
                <TouchableOpacity onPress={onClose} style={styles.settingsCloseBtn}>
                  <Ionicons name="close" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.tabRow}>
                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === 'settings' && styles.tabBtnActive]}
                  onPress={() => setActiveTab('settings')}
                >
                  <Text style={[styles.tabBtnText, activeTab === 'settings' && styles.tabBtnTextActive]}>
                    Preferences
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === 'muted' && styles.tabBtnActive]}
                  onPress={() => setActiveTab('muted')}
                >
                  <Text style={[styles.tabBtnText, activeTab === 'muted' && styles.tabBtnTextActive]}>
                    Muted
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.settingsBody} showsVerticalScrollIndicator={false}>
                {activeTab === 'settings' ? (
                  <>
                    <View style={styles.settingRow}>
                      <View style={styles.settingIconWrap}>
                        <Ionicons name="sparkles" size={20} color={theme.gold} />
                      </View>
                      <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>Reactions</Text>
                        <Text style={styles.settingDescription}>When someone reacts to your dreams</Text>
                      </View>
                      <Switch
                        value={settings.likes}
                        onValueChange={() => onUpdateSettings('likes', !settings.likes)}
                        trackColor={{ false: theme.glass, true: theme.gold + '60' }}
                        thumbColor={settings.likes ? theme.gold : theme.textMuted}
                      />
                    </View>
                    <View style={styles.settingRow}>
                      <View style={styles.settingIconWrap}>
                        <Ionicons name="eye-outline" size={20} color={theme.gold} />
                      </View>
                      <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>Interpretations</Text>
                        <Text style={styles.settingDescription}>When someone interprets your dreams</Text>
                      </View>
                      <Switch
                        value={settings.interpretations}
                        onValueChange={() => onUpdateSettings('interpretations', !settings.interpretations)}
                        trackColor={{ false: theme.glass, true: theme.gold + '60' }}
                        thumbColor={settings.interpretations ? theme.gold : theme.textMuted}
                      />
                    </View>
                    <View style={styles.settingRow}>
                      <View style={styles.settingIconWrap}>
                        <Ionicons name="person-add-outline" size={20} color={theme.gold} />
                      </View>
                      <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>New Followers</Text>
                        <Text style={styles.settingDescription}>When someone follows you</Text>
                      </View>
                      <Switch
                        value={settings.follows}
                        onValueChange={() => onUpdateSettings('follows', !settings.follows)}
                        trackColor={{ false: theme.glass, true: theme.gold + '60' }}
                        thumbColor={settings.follows ? theme.gold : theme.textMuted}
                      />
                    </View>
                    <View style={styles.settingRow}>
                      <View style={styles.settingIconWrap}>
                        <Ionicons name="information-circle-outline" size={20} color={theme.gold} />
                      </View>
                      <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>System Updates</Text>
                        <Text style={styles.settingDescription}>Important updates and announcements</Text>
                      </View>
                      <Switch
                        value={settings.system}
                        onValueChange={() => onUpdateSettings('system', !settings.system)}
                        trackColor={{ false: theme.glass, true: theme.gold + '60' }}
                        thumbColor={settings.system ? theme.gold : theme.textMuted}
                      />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.mutedSectionTitle}>Muted Users</Text>
                    {mutedUsers.length === 0 ? (
                      <Text style={styles.mutedEmptyText}>No muted users</Text>
                    ) : (
                      mutedUsers.map((item) => (
                        <View key={item.id} style={styles.mutedItem}>
                          <Image source={{ uri: getAvatarUrl(item.profile) }} style={styles.mutedAvatar} />
                          <Text style={styles.mutedName}>
                            {item.profile?.display_name || item.profile?.username || 'User'}
                          </Text>
                          <TouchableOpacity style={styles.unmuteBtn} onPress={() => onUnmuteUser(item.id)}>
                            <Text style={styles.unmuteBtnText}>Unmute</Text>
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                    <Text style={[styles.mutedSectionTitle, { marginTop: 20 }]}>Muted Posts</Text>
                    {mutedPosts.length === 0 ? (
                      <Text style={styles.mutedEmptyText}>No muted posts</Text>
                    ) : (
                      mutedPosts.map((item) => (
                        <View key={item.id} style={styles.mutedItem}>
                          <View style={styles.mutedPostIcon}>
                            <Ionicons name="document-text-outline" size={18} color={theme.textSecondary} />
                          </View>
                          <Text style={styles.mutedName} numberOfLines={1}>
                            {item.dream?.title || 'Untitled Dream'}
                          </Text>
                          <TouchableOpacity style={styles.unmuteBtn} onPress={() => onUnmutePost(item.id)}>
                            <Text style={styles.unmuteBtnText}>Unmute</Text>
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </>
                )}
              </ScrollView>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

// Mute Options Modal
const MuteOptionsModal = ({
  visible,
  onClose,
  options,
  onMute,
}: {
  visible: boolean;
  onClose: () => void;
  options: MuteOption[];
  onMute: (option: MuteOption) => void;
}) => {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Animated.View style={[styles.muteModalContainer, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.muteModalContent}>
              <Text style={styles.muteModalTitle}>Mute Notifications</Text>
              {options.map((option, index) => (
                <TouchableOpacity
                  key={`${option.type}-${option.id}`}
                  style={[styles.muteOption, index === options.length - 1 && styles.muteOptionLast]}
                  onPress={() => onMute(option)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={option.type === 'user' ? 'person-outline' : 'document-text-outline'}
                    size={20}
                    color={theme.textSecondary}
                  />
                  <Text style={styles.muteOptionText}>{option.name}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.muteCancelBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.muteCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

// Swipeable Notification Item
const SwipeableNotificationItem = ({
  item,
  onPress,
  onDelete,
  onShowMuteOptions,
}: {
  item: Notification;
  onPress: () => void;
  onDelete: () => void;
  onShowMuteOptions: () => void;
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [isDeleting, setIsDeleting] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 20,
      onPanResponderGrant: () => {
        Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start();
      },
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(Math.max(-120, Math.min(120, gestureState.dx)));
      },
      onPanResponderRelease: (_, gestureState) => {
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          Animated.timing(translateX, { toValue: -SCREEN_WIDTH, duration: 200, useNativeDriver: true }).start(() => {
            setIsDeleting(true);
            onDelete();
          });
        } else if (gestureState.dx > SWIPE_THRESHOLD) {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          onShowMuteOptions();
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const getAvatarUrl = (actor: UserProfile | undefined) => {
    if (actor?.avatar_url?.startsWith('http')) return actor.avatar_url;
    const name = actor?.display_name || actor?.username || 'U';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=60a5fa&size=64`;
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

  if (isDeleting) return null;

  const deleteOpacity = translateX.interpolate({
    inputRange: [-120, -60, 0],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });
  const muteOpacity = translateX.interpolate({
    inputRange: [0, 60, 120],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.swipeContainer}>
      <Animated.View style={[styles.swipeActionLeft, { opacity: muteOpacity }]}>
        <Ionicons name="notifications-off-outline" size={22} color={theme.textPrimary} />
        <Text style={styles.swipeActionText}>Mute</Text>
      </Animated.View>
      <Animated.View style={[styles.swipeActionRight, { opacity: deleteOpacity }]}>
        <Ionicons name="trash-outline" size={22} color="#fff" />
        <Text style={styles.swipeActionTextDanger}>Delete</Text>
      </Animated.View>
      <Animated.View
        style={[styles.notificationCardWrapper, { transform: [{ translateX }, { scale: scaleAnim }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={[styles.notificationCard, !item.read && styles.notificationCardUnread]}
          onPress={onPress}
          activeOpacity={0.9}
        >
          <Image source={{ uri: getAvatarUrl(item.actor) }} style={styles.actorAvatar} />
          <View style={styles.notificationContent}>
            <View style={styles.notificationHeader}>
              <Text style={styles.notificationMessage} numberOfLines={2}>
                {item.message}
              </Text>
              {!item.read && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.notificationTime}>{formatTime(item.created_at)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export default function NotificationsScreen({ navigation }: any) {
  const user = useAuthStore((state) => state.user);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [muteOptionsVisible, setMuteOptionsVisible] = useState(false);
  const [currentMuteOptions, setCurrentMuteOptions] = useState<MuteOption[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>({
    likes: true,
    interpretations: true,
    follows: true,
    system: true,
  });
  const [mutedUsers, setMutedUsers] = useState<MutedUser[]>([]);
  const [mutedPosts, setMutedPosts] = useState<MutedPost[]>([]);

  // Dream Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDream, setSelectedDream] = useState<DreamWithMeta | null>(null);
  const [interpretations, setInterpretations] = useState<Interpretation[]>([]);
  const [interpretationsLoading, setInterpretationsLoading] = useState(false);
  const [dreamLoading, setDreamLoading] = useState(false);

  // Audio
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
      fetchSettings();
      fetchMutedItems();
      return () => {
        player.pause();
      };
    }, [user?.id])
  );

  const fetchSettings = async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase.from('notification_settings').select('*').eq('user_id', user.id).single();
      if (data) {
        setSettings({
          likes: data.likes ?? true,
          interpretations: data.interpretations ?? true,
          follows: data.follows ?? true,
          system: data.system ?? true,
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const updateSettings = async (key: keyof NotificationSettings, value: boolean) => {
    if (!user?.id) return;
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    try {
      await supabase.from('notification_settings').upsert({
        user_id: user.id,
        ...newSettings,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      setSettings(settings);
    }
  };

  const fetchMutedItems = async () => {
    if (!user?.id) return;
    try {
      const { data: users } = await supabase.from('muted_users').select('id, muted_user_id').eq('user_id', user.id);
      if (users && users.length > 0) {
        const userIds = users.map((u) => u.muted_user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', userIds);
        const profilesMap = (profiles || []).reduce(
          (acc, p) => ({ ...acc, [p.id]: p }),
          {} as Record<string, UserProfile>
        );
        setMutedUsers(users.map((u) => ({ ...u, profile: profilesMap[u.muted_user_id] })));
      } else {
        setMutedUsers([]);
      }

      const { data: posts } = await supabase.from('muted_posts').select('id, dream_id').eq('user_id', user.id);
      if (posts && posts.length > 0) {
        const dreamIds = posts.map((p) => p.dream_id);
        const { data: dreams } = await supabase.from('dreams').select('id, title').in('id', dreamIds);
        const dreamsMap = (dreams || []).reduce(
          (acc, d) => ({ ...acc, [d.id]: d }),
          {} as Record<string, { title: string | null }>
        );
        setMutedPosts(posts.map((p) => ({ ...p, dream: dreamsMap[p.dream_id] })));
      } else {
        setMutedPosts([]);
      }
    } catch (error) {
      console.error('Error fetching muted items:', error);
    }
  };

  const handleUnmuteUser = async (id: string) => {
    try {
      await supabase.from('muted_users').delete().eq('id', id);
      setMutedUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (error) {
      console.error('Error unmuting user:', error);
    }
  };

  const handleUnmutePost = async (id: string) => {
    try {
      await supabase.from('muted_posts').delete().eq('id', id);
      setMutedPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error('Error unmuting post:', error);
    }
  };

  const fetchNotifications = async () => {
    if (!user?.id) return;
    try {
      const { data: notifData, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const actorIds = [...new Set((notifData || []).map((n) => n.actor_id).filter(Boolean))];
      let actorsMap: Record<string, UserProfile> = {};

      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', actorIds);
        if (profiles) {
          actorsMap = profiles.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
        }
      }

      setNotifications(
        (notifData || []).map((n) => ({
          ...n,
          actor: n.actor_id ? actorsMap[n.actor_id] : undefined,
        }))
      );
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

  // Fetch dream and open modal
  const fetchDreamAndOpen = async (dreamId: string) => {
    setDreamLoading(true);
    try {
      const { data: dream, error } = await supabase
        .from('dreams')
        .select('*')
        .eq('id', dreamId)
        .single();

      if (error || !dream) {
        Alert.alert('Error', 'Dream not found');
        return;
      }

      // Fetch author profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, is_public')
        .eq('id', dream.user_id)
        .single();

      // Fetch reaction data
      let reactionCount = 0;
      let userReaction: ReactionType | null = null;

      const { count: reactions } = await supabase
        .from('dream_reactions')
        .select('*', { count: 'exact', head: true })
        .eq('dream_id', dreamId);
      reactionCount = reactions || 0;

      if (user?.id) {
        const { data: userReactionData } = await supabase
          .from('dream_reactions')
          .select('reaction_type')
          .eq('dream_id', dreamId)
          .eq('user_id', user.id)
          .single();
        userReaction = userReactionData?.reaction_type as ReactionType | null;
      }

      // Fetch interpretation count
      let interpretationCount = 0;
      if (dream.interpretation_mode && dream.interpretation_mode !== 'disabled') {
        const { count: ic } = await supabase
          .from('interpretations')
          .select('*', { count: 'exact', head: true })
          .eq('dream_id', dreamId);
        interpretationCount = ic || 0;
      }

      const dreamWithMeta: DreamWithMeta = {
        ...dream,
        authorProfile: profile,
        reactionCount,
        userReaction,
        interpretationCount,
      };

      setSelectedDream(dreamWithMeta);

      // Fetch interpretations
      if (dream.interpretation_mode && dream.interpretation_mode !== 'disabled') {
        fetchInterpretations(dreamId);
      }

      setModalVisible(true);
    } catch (error) {
      console.error('Error fetching dream:', error);
      Alert.alert('Error', 'Failed to load dream');
    } finally {
      setDreamLoading(false);
    }
  };

  const fetchInterpretations = async (dreamId: string) => {
    setInterpretationsLoading(true);
    try {
      const { data, error } = await supabase
        .from('interpretations')
        .select('id, dream_id, user_id, content, created_at, parent_id')
        .eq('dream_id', dreamId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const withAuthors = await Promise.all(
        (data || []).map(async (interp) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url, is_public')
            .eq('id', interp.user_id)
            .single();
          return { ...interp, author: profile ?? undefined };
        })
      );

      const rootInterpretations: Interpretation[] = [];
      const repliesMap: { [key: string]: Interpretation[] } = {};

      withAuthors.forEach((interp) => {
        if (interp.parent_id) {
          if (!repliesMap[interp.parent_id]) repliesMap[interp.parent_id] = [];
          repliesMap[interp.parent_id].push(interp);
        } else {
          rootInterpretations.push({ ...interp, replies: [] });
        }
      });

      rootInterpretations.forEach((interp) => {
        interp.replies = repliesMap[interp.id] || [];
      });

      setInterpretations(rootInterpretations);
    } catch (error) {
      console.error('Error fetching interpretations:', error);
    } finally {
      setInterpretationsLoading(false);
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.read) await markAsRead(notification.id);

    if (notification.dream_id) {
      // Open dream modal directly
      fetchDreamAndOpen(notification.dream_id);
    } else if (notification.actor_id) {
      navigation.navigate('ViewProfile', { userId: notification.actor_id });
    }
  };

  const closeDreamModal = () => {
    setModalVisible(false);
    setTimeout(() => {
      setSelectedDream(null);
      setInterpretations([]);
      player.pause();
      setPlayingId(null);
    }, 300);
  };

  const playAudio = async (dream: DreamWithMeta, context: string) => {
    if (!dream.audio_url) return;

    if (playingId === dream.id) {
      if (status.playing) player.pause();
      else player.play();
      return;
    }

    setIsAudioLoading(dream.id);
    if (playingId) player.pause();
    setPlayingId(dream.id);

    try {
      await player.replace({ uri: dream.audio_url });
      await player.play();
    } catch (error) {
      Alert.alert('Playback Error', 'Unable to play this audio');
      setPlayingId(null);
    } finally {
      setIsAudioLoading(null);
    }
  };

  const handleReact = async (dream: DreamWithMeta, reaction: ReactionType) => {
    if (!user?.id) return;
    try {
      if (dream.userReaction) {
        await supabase.from('dream_reactions').delete().eq('dream_id', dream.id).eq('user_id', user.id);
      }
      await supabase.from('dream_reactions').insert({
        dream_id: dream.id,
        user_id: user.id,
        reaction_type: reaction,
      });

      setSelectedDream((prev) =>
        prev
          ? {
              ...prev,
              userReaction: reaction,
              reactionCount: (prev.reactionCount ?? 0) + (prev.userReaction ? 0 : 1),
            }
          : null
      );
    } catch (error) {
      console.error('Error reacting:', error);
    }
  };

  const handleRemoveReaction = async (dream: DreamWithMeta) => {
    if (!user?.id || !dream.userReaction) return;
    try {
      await supabase.from('dream_reactions').delete().eq('dream_id', dream.id).eq('user_id', user.id);
      setSelectedDream((prev) =>
        prev
          ? {
              ...prev,
              userReaction: null,
              reactionCount: Math.max(0, (prev.reactionCount ?? 1) - 1),
            }
          : null
      );
    } catch (error) {
      console.error('Error removing reaction:', error);
    }
  };

  const showMuteOptions = (notification: Notification) => {
    const options: MuteOption[] = [];
    if (notification.actor_id && notification.actor) {
      options.push({
        type: 'user',
        id: notification.actor_id,
        name: `Mute ${notification.actor.display_name || notification.actor.username || 'this user'}`,
      });
    }
    if (notification.dream_id) {
      options.push({
        type: 'post',
        id: notification.dream_id,
        name: 'Mute notifications from this post',
      });
    }
    if (options.length > 0) {
      setCurrentMuteOptions(options);
      setMuteOptionsVisible(true);
    }
  };

  const handleMute = async (option: MuteOption) => {
    if (!user?.id) return;
    try {
      if (option.type === 'user') {
        await supabase.from('muted_users').upsert({
          user_id: user.id,
          muted_user_id: option.id,
          created_at: new Date().toISOString(),
        });
      } else {
        await supabase.from('muted_posts').upsert({
          user_id: user.id,
          dream_id: option.id,
          created_at: new Date().toISOString(),
        });
      }
      setMuteOptionsVisible(false);
      fetchMutedItems();
      Alert.alert(
        'Muted',
        option.type === 'user'
          ? 'You will no longer receive notifications from this user'
          : 'You will no longer receive notifications from this post'
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to mute. Please try again.');
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AnimatedGradientBackground>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerRight}>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={markAllAsRead} style={styles.headerBtnSmall}>
                <Ionicons name="checkmark-done" size={20} color={theme.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setSettingsVisible(true)} style={styles.headerBtn}>
              <Ionicons name="settings-outline" size={22} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Unread Banner */}
        {unreadCount > 0 && (
          <View style={styles.unreadBanner}>
            <Text style={styles.unreadBannerText}>
              {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {/* Content */}
        {loading || dreamLoading ? (
          <LoadingSpinner variant="moon" text={dreamLoading ? 'Loading dream...' : 'Loading notifications...'} />
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SwipeableNotificationItem
                item={item}
                onPress={() => handleNotificationPress(item)}
                onDelete={() => deleteNotification(item.id)}
                onShowMuteOptions={() => showMuteOptions(item)}
              />
            )}
            contentContainerStyle={[styles.listContent, notifications.length === 0 && styles.listContentEmpty]}
            ListEmptyComponent={
              <EmptyState
                icon="notifications-outline"
                title="No notifications yet"
                subtitle="When someone interacts with your dreams, you'll see it here"
              />
            }
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

      {/* Dream Modal */}
      <DreamModal
        visible={modalVisible}
        dream={selectedDream}
        interpretations={interpretations}
        interpretationsLoading={interpretationsLoading}
        currentUserId={user?.id}
        playingId={playingId}
        playingContext="modal"
        isAudioLoading={isAudioLoading}
        audioStatus={status}
        onClose={closeDreamModal}
        onDelete={() => {}}
        onEdit={() => {}}
        onPlayAudio={playAudio}
        onReact={handleReact}
        onRemoveReaction={handleRemoveReaction}
        onAddInterpretation={() => {}}
        onProfilePress={(profile, userId) => {
          closeDreamModal();
          navigation.navigate('ViewProfile', { userId });
        }}
      />

      {/* Modals */}
      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        mutedUsers={mutedUsers}
        mutedPosts={mutedPosts}
        onUnmuteUser={handleUnmuteUser}
        onUnmutePost={handleUnmutePost}
      />
      <MuteOptionsModal
        visible={muteOptionsVisible}
        onClose={() => setMuteOptionsVisible(false)}
        options={currentMuteOptions}
        onMute={handleMute}
      />
    </AnimatedGradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
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
  headerBtnSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: theme.textPrimary },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  unreadBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: theme.glowGold,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.gold + '30',
  },
  unreadBannerText: { fontSize: 13, fontWeight: '500', color: theme.gold, textAlign: 'center' },
  listContent: { padding: 16, paddingBottom: 40 },
  listContentEmpty: { flex: 1 },
  swipeContainer: { marginBottom: 10, position: 'relative' },
  swipeActionLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 100,
    backgroundColor: theme.purple,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  swipeActionRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 100,
    backgroundColor: theme.danger,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  swipeActionText: { fontSize: 12, fontWeight: '600', color: theme.textPrimary },
  swipeActionTextDanger: { fontSize: 12, fontWeight: '600', color: '#fff' },
  notificationCardWrapper: { backgroundColor: 'transparent' },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.glass,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  notificationCardUnread: {
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  actorAvatar: { width: 42, height: 42, borderRadius: 21, marginRight: 12 },
  notificationContent: { flex: 1 },
  notificationHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  notificationMessage: { fontSize: 14, fontWeight: '500', color: theme.textPrimary, flex: 1, lineHeight: 20 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.gold, marginLeft: 8, marginTop: 6 },
  notificationTime: { fontSize: 12, color: theme.textMuted },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  settingsModalContainer: { width: '100%', maxWidth: 360 },
  settingsModalContent: {
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.glassBorderLight,
    overflow: 'hidden',
    maxHeight: '80%',
  },
  settingsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.glassBorder,
  },
  settingsModalTitle: { fontSize: 18, fontWeight: '600', color: theme.textPrimary },
  settingsCloseBtn: { padding: 4 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.glassBorder },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: theme.gold },
  tabBtnText: { fontSize: 14, fontWeight: '600', color: theme.textMuted },
  tabBtnTextActive: { color: theme.gold },
  settingsBody: { padding: 16, maxHeight: 400 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.glassBorder,
  },
  settingIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.glowGold,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingInfo: { flex: 1, marginRight: 12 },
  settingLabel: { fontSize: 15, fontWeight: '600', color: theme.textPrimary, marginBottom: 2 },
  settingDescription: { fontSize: 12, color: theme.textMuted, lineHeight: 16 },
  mutedSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  mutedEmptyText: { fontSize: 14, color: theme.textMuted, textAlign: 'center', paddingVertical: 16 },
  mutedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.glassBorder,
  },
  mutedAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12 },
  mutedPostIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.glass,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  mutedName: { flex: 1, fontSize: 14, fontWeight: '500', color: theme.textPrimary },
  unmuteBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: theme.glass,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  unmuteBtnText: { fontSize: 12, fontWeight: '600', color: theme.primary },
  muteModalContainer: { width: '100%', maxWidth: 320 },
  muteModalContent: {
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.glassBorderLight,
    padding: 20,
  },
  muteModalTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary, marginBottom: 16, textAlign: 'center' },
  muteOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.glassBorder,
  },
  muteOptionLast: { borderBottomWidth: 0 },
  muteOptionText: { fontSize: 15, color: theme.textPrimary, flex: 1 },
  muteCancelBtn: {
    marginTop: 16,
    paddingVertical: 14,
    backgroundColor: theme.glass,
    borderRadius: 12,
    alignItems: 'center',
  },
  muteCancelText: { fontSize: 15, fontWeight: '600', color: theme.textSecondary },
});