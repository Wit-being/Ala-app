import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

const theme = {
  background: '#050a15',
  backgroundGradientStart: '#050a15',
  backgroundGradientEnd: '#0a1628',
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
  glowGold: 'rgba(212, 175, 55, 0.15)',
};

interface UserProfile {
  id: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  is_public?: boolean;
}

interface Dream {
  id: string;
  user_id: string;
  title: string | null;
  content: string | null;
  audio_url: string | null;
  audio_duration: number | null;
  is_public: boolean;
  dream_date: string;
  created_at: string;
  interpretation_mode?: string;
  enable_engagement?: boolean;
  dream_type?: string | null;
  dream_tag?: string | null;
  likeCount?: number;
  interpretationCount?: number;
  isLiked?: boolean;
  authorProfile?: UserProfile | null;
}

interface Interpretation {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  author?: UserProfile;
}

interface Reactor {
  id: string;
  user_id: string;
  created_at: string;
  profile?: UserProfile;
}

const UserListModal = ({
  visible,
  onClose,
  title,
  users,
  loading,
  onUserPress,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  users: (Reactor | Interpretation)[];
  loading: boolean;
  onUserPress: (userId: string, isPublic: boolean) => void;
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

  const getAvatarUrl = (profile?: UserProfile) => {
    if (profile?.avatar_url?.startsWith('http')) return profile.avatar_url;
    const name = profile?.display_name || profile?.username || 'U';
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

  if (!visible) return null;

  const isInterpretation = (item: Reactor | Interpretation): item is Interpretation => 'content' in item;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Animated.View style={[styles.userListModalContainer, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.userListModalContent}>
              <View style={styles.userListModalHeader}>
                <Text style={styles.userListModalTitle}>{title}</Text>
                <TouchableOpacity onPress={onClose} style={styles.userListCloseBtn}>
                  <Ionicons name="close" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>
              {loading ? (
                <View style={styles.userListLoading}>
                  <ActivityIndicator size="large" color={theme.gold} />
                </View>
              ) : users.length === 0 ? (
                <View style={styles.userListEmpty}>
                  <Text style={styles.userListEmptyText}>No one yet</Text>
                </View>
              ) : (
                <FlatList
                  data={users}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => {
                    const profile = isInterpretation(item) ? item.author : item.profile;
                    const isPublic = profile?.is_public !== false;
                    return (
                      <TouchableOpacity style={styles.userListItem} onPress={() => onUserPress(item.user_id, isPublic)} activeOpacity={0.7}>
                        <Image source={{ uri: getAvatarUrl(profile) }} style={styles.userListAvatar} />
                        <View style={styles.userListInfo}>
                          <View style={styles.userListNameRow}>
                            <Text style={styles.userListName}>{profile?.display_name || profile?.username || 'Anonymous'}</Text>
                            {!isPublic && <Ionicons name="lock-closed" size={12} color={theme.textMuted} style={{ marginLeft: 4 }} />}
                          </View>
                          {isInterpretation(item) && <Text style={styles.userListContent} numberOfLines={2}>{item.content}</Text>}
                          <Text style={styles.userListTime}>{formatTime(item.created_at)}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                      </TouchableOpacity>
                    );
                  }}
                  style={styles.userListScroll}
                  contentContainerStyle={styles.userListScrollContent}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

export default function DreamDetailScreen({ navigation, route }: any) {
  const { dreamId } = route.params;
  const user = useAuthStore((state) => state.user);
  const [dream, setDream] = useState<Dream | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [reactors, setReactors] = useState<Reactor[]>([]);
  const [interpretations, setInterpretations] = useState<Interpretation[]>([]);
  const [reactorsLoading, setReactorsLoading] = useState(false);
  const [interpretationsLoading, setInterpretationsLoading] = useState(false);
  const [reactorsModalVisible, setReactorsModalVisible] = useState(false);
  const [interpretationsModalVisible, setInterpretationsModalVisible] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    fetchDream();
    fetchUserProfile();
    return () => {
      isMountedRef.current = false;
      try {
        if (player && typeof player.pause === 'function') {
          player.pause();
        }
      } catch (e) {}
    };
  }, [dreamId]);

  useEffect(() => {
    if (status && isMountedRef.current) {
      setIsPlaying(status.playing || false);
      if (status.duration > 0) {
        setAudioProgress((status.currentTime / status.duration) * 100);
        setCurrentTime(status.currentTime);
      }
    }
  }, [status]);

  const fetchUserProfile = async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase.from('profiles').select('id, username, display_name, avatar_url, is_public').eq('id', user.id).single();
      if (data && isMountedRef.current) setUserProfile(data);
    } catch (error) {}
  };

  const fetchDream = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('dreams').select('*').eq('id', dreamId).single();
      if (error) throw error;

      const { data: authorProfile } = await supabase.from('profiles').select('id, username, display_name, avatar_url, is_public').eq('id', data.user_id).single();

      let likeCount = 0;
      let isLiked = false;
      let interpretationCount = 0;

      if (data.enable_engagement) {
        const { count } = await supabase.from('dream_likes').select('*', { count: 'exact', head: true }).eq('dream_id', dreamId);
        likeCount = count || 0;
        if (user?.id) {
          const { data: userLike } = await supabase.from('dream_likes').select('id').eq('dream_id', dreamId).eq('user_id', user.id).single();
          isLiked = !!userLike;
        }
      }

      if (data.interpretation_mode && data.interpretation_mode !== 'disabled') {
        const { count } = await supabase.from('interpretations').select('*', { count: 'exact', head: true }).eq('dream_id', dreamId);
        interpretationCount = count || 0;
      }

      if (isMountedRef.current) {
        setDream({ ...data, authorProfile, likeCount, isLiked, interpretationCount });
      }
    } catch (error) {
      Alert.alert('Error', 'Could not load this dream');
      navigation.goBack();
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const fetchReactors = async () => {
    if (!dreamId) return;
    setReactorsLoading(true);
    try {
      const { data } = await supabase.from('dream_likes').select('id, user_id, created_at').eq('dream_id', dreamId).order('created_at', { ascending: false });
      const userIds = data?.map((r) => r.user_id) || [];
      let profilesMap: Record<string, UserProfile> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, username, display_name, avatar_url, is_public').in('id', userIds);
        if (profiles) profilesMap = profiles.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
      }
      if (isMountedRef.current) setReactors((data || []).map((r) => ({ ...r, profile: profilesMap[r.user_id] })));
    } catch (error) {}
    finally { if (isMountedRef.current) setReactorsLoading(false); }
  };

  const fetchInterpretations = async () => {
    if (!dreamId) return;
    setInterpretationsLoading(true);
    try {
      const { data } = await supabase.from('interpretations').select('id, user_id, content, created_at').eq('dream_id', dreamId).order('created_at', { ascending: false });
      const userIds = data?.map((i) => i.user_id) || [];
      let profilesMap: Record<string, UserProfile> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, username, display_name, avatar_url, is_public').in('id', userIds);
        if (profiles) profilesMap = profiles.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
      }
      if (isMountedRef.current) setInterpretations((data || []).map((i) => ({ ...i, author: profilesMap[i.user_id] })));
    } catch (error) {}
    finally { if (isMountedRef.current) setInterpretationsLoading(false); }
  };

  const handleShowReactors = () => {
    setReactorsModalVisible(true);
    fetchReactors();
  };

  const handleShowInterpretations = () => {
    setInterpretationsModalVisible(true);
    fetchInterpretations();
  };

  const handleUserPress = (userId: string, isPublic: boolean) => {
    if (!isPublic && userId !== user?.id) {
      Alert.alert('Private Profile', 'This user has a private profile');
      return;
    }
    setReactorsModalVisible(false);
    setInterpretationsModalVisible(false);
    navigation.navigate('ViewProfile', { userId });
  };

  const toggleLike = async () => {
    if (!user?.id || !dream?.enable_engagement) return;
    try {
      if (dream.isLiked) {
        await supabase.from('dream_likes').delete().eq('dream_id', dream.id).eq('user_id', user.id);
        setDream((prev) => prev ? { ...prev, isLiked: false, likeCount: (prev.likeCount || 1) - 1 } : null);
      } else {
        await supabase.from('dream_likes').insert({ dream_id: dream.id, user_id: user.id });
        if (dream.user_id !== user.id) {
          const { data: existingNotif } = await supabase.from('notifications').select('id').eq('dream_id', dream.id).eq('actor_id', user.id).eq('type', 'like').single();
          if (!existingNotif) {
            const displayName = userProfile?.display_name || userProfile?.username || 'Someone';
            await supabase.from('notifications').insert({
              user_id: dream.user_id,
              type: 'like',
              message: `${displayName} reacted to your dream${dream.title ? ` "${dream.title}"` : ''}`,
              dream_id: dream.id,
              actor_id: user.id,
              read: false,
            });
          }
        }
        setDream((prev) => prev ? { ...prev, isLiked: true, likeCount: (prev.likeCount || 0) + 1 } : null);
      }
    } catch (error) {}
  };

  const playAudio = async () => {
    if (!dream?.audio_url || typeof dream.audio_url !== 'string') return;

    if (isPlaying) {
      try {
        player.pause();
      } catch (e) {}
      return;
    }

    setIsAudioLoading(true);
    try {
      let audioUrl = dream.audio_url;
      if (!dream.is_public && dream.user_id === user?.id && !audioUrl.startsWith('http')) {
        const { data, error } = await supabase.storage.from('ala-audio-private').createSignedUrl(audioUrl, 3600);
        if (error || !data?.signedUrl) {
          setIsAudioLoading(false);
          return;
        }
        audioUrl = data.signedUrl;
      }
      if (typeof audioUrl === 'string' && audioUrl.length > 0) {
        await player.replace({ uri: audioUrl });
        await player.play();
      }
    } catch (error) {
      Alert.alert('Error', 'Could not play audio');
    } finally {
      if (isMountedRef.current) setIsAudioLoading(false);
    }
  };

  const getAvatarUrl = (profile: UserProfile | null | undefined) => {
    if (profile?.avatar_url?.startsWith('http')) return profile.avatar_url;
    const name = profile?.display_name || profile?.username || 'U';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=60a5fa&size=64`;
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const formatDurationMs = (ms: number) => {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    return `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const formatTime = (dateString: string) => new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const isMine = dream?.user_id === user?.id;
  const canInterpret = dream?.interpretation_mode && dream.interpretation_mode !== 'disabled';

  if (loading) {
    return (
      <LinearGradient colors={[theme.backgroundGradientStart, theme.backgroundGradientEnd]} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.gold} />
      </LinearGradient>
    );
  }

  if (!dream) {
    return (
      <LinearGradient colors={[theme.backgroundGradientStart, theme.backgroundGradientEnd]} style={styles.loadingContainer}>
        <Text style={styles.errorText}>Dream not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[theme.backgroundGradientStart, theme.backgroundGradientEnd]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Dream</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.authorRow} onPress={() => handleUserPress(dream.user_id, dream.authorProfile?.is_public !== false)} activeOpacity={0.7}>
            <Image source={{ uri: getAvatarUrl(dream.authorProfile) }} style={styles.authorAvatar} />
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>{isMine ? 'You' : dream.authorProfile?.display_name || dream.authorProfile?.username || 'Anonymous'}</Text>
              <Text style={styles.dreamDate}>{formatDate(dream.dream_date)} at {formatTime(dream.created_at)}</Text>
            </View>
          </TouchableOpacity>

          {dream.title && <Text style={styles.dreamTitle}>{dream.title}</Text>}
          {dream.content && <Text style={styles.dreamContent}>{dream.content}</Text>}

          {dream.audio_url && (
            <View style={styles.audioPlayer}>
              <TouchableOpacity style={[styles.playBtn, isPlaying && styles.playBtnActive]} onPress={playAudio} activeOpacity={0.7}>
                {isAudioLoading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color="#fff" />}
              </TouchableOpacity>
              <View style={styles.audioInfo}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${audioProgress}%` }]} />
                </View>
                <View style={styles.timeRow}>
                  <Text style={styles.timeText}>{formatDurationMs(currentTime)}</Text>
                  <Text style={styles.timeText}>{formatDuration(dream.audio_duration)}</Text>
                </View>
              </View>
            </View>
          )}

          {dream.enable_engagement && (
            <View style={styles.engagementRow}>
              <TouchableOpacity style={styles.reactionBtn} onPress={toggleLike} activeOpacity={0.7}>
                <Text style={[styles.reactionEmoji, dream.isLiked && styles.reactionEmojiActive]}>💫</Text>
                <Text style={[styles.reactionCount, dream.isLiked && styles.reactionCountActive]}>{dream.likeCount || 0}</Text>
              </TouchableOpacity>

              {(dream.likeCount || 0) > 0 && (
                <TouchableOpacity style={styles.viewUsersBtn} onPress={handleShowReactors} activeOpacity={0.7}>
                  <Feather name="users" size={14} color={theme.textSubtle} />
                  <Text style={styles.viewUsersText}>View reactions</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {canInterpret && (
            <View style={styles.interpretationsSection}>
              <View style={styles.interpretationsHeader}>
                <Feather name="eye" size={18} color={theme.gold} />
                <Text style={styles.interpretationsTitle}>Interpretations</Text>
                <Text style={styles.interpretationsCount}>{dream.interpretationCount || 0}</Text>
              </View>
              {(dream.interpretationCount || 0) > 0 ? (
                <TouchableOpacity style={styles.viewInterpretationsBtn} onPress={handleShowInterpretations} activeOpacity={0.7}>
                  <Text style={styles.viewInterpretationsText}>View all interpretations</Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.gold} />
                </TouchableOpacity>
              ) : (
                <Text style={styles.noInterpretationsText}>No interpretations yet</Text>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <UserListModal visible={reactorsModalVisible} onClose={() => setReactorsModalVisible(false)} title="Reactions" users={reactors} loading={reactorsLoading} onUserPress={handleUserPress} />
      <UserListModal visible={interpretationsModalVisible} onClose={() => setInterpretationsModalVisible(false)} title="Interpretations" users={interpretations} loading={interpretationsLoading} onUserPress={handleUserPress} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: theme.textSecondary, marginBottom: 16 },
  backButton: { paddingVertical: 12, paddingHorizontal: 24, backgroundColor: theme.glass, borderRadius: 12 },
  backButtonText: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.glassBorder },
  headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.glassBorder, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: theme.textPrimary },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  authorAvatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  authorInfo: { flex: 1 },
  authorName: { fontSize: 16, fontWeight: '600', color: theme.textPrimary },
  dreamDate: { fontSize: 13, color: theme.textSubtle, marginTop: 2 },
  dreamTitle: { fontSize: 24, fontWeight: '700', color: theme.textPrimary, marginBottom: 16 },
  dreamContent: { fontSize: 16, color: theme.textSecondary, lineHeight: 26, marginBottom: 24 },
  audioPlayer: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, backgroundColor: theme.glass, borderRadius: 20, borderWidth: 1, borderColor: theme.glassBorder, marginBottom: 24 },
  playBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  playBtnActive: { backgroundColor: theme.primary },
  audioInfo: { flex: 1 },
  progressTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: theme.gold },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timeText: { fontSize: 12, color: theme.textSubtle, fontVariant: ['tabular-nums'] },
  engagementRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  reactionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reactionEmoji: { fontSize: 24, opacity: 0.6 },
  reactionEmojiActive: { opacity: 1 },
  reactionCount: { fontSize: 15, fontWeight: '600', color: theme.textMuted },
  reactionCountActive: { color: theme.gold },
  viewUsersBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  viewUsersText: { fontSize: 13, color: theme.textSubtle },
  interpretationsSection: { backgroundColor: theme.glass, borderRadius: 20, borderWidth: 1, borderColor: theme.glassBorder, padding: 16 },
  interpretationsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  interpretationsTitle: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, flex: 1 },
  interpretationsCount: { fontSize: 14, fontWeight: '600', color: theme.gold },
  viewInterpretationsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: theme.glowGold, borderRadius: 12 },
  viewInterpretationsText: { fontSize: 14, fontWeight: '600', color: theme.gold },
  noInterpretationsText: { fontSize: 14, color: theme.textMuted, textAlign: 'center', paddingVertical: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  userListModalContainer: { width: '100%', maxWidth: 400, maxHeight: '80%' },
  userListModalContent: { backgroundColor: 'rgba(15, 23, 42, 0.98)', borderRadius: 24, borderWidth: 1, borderColor: theme.glassBorderLight, overflow: 'hidden' },
  userListModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: theme.glassBorder },
  userListModalTitle: { fontSize: 18, fontWeight: '600', color: theme.textPrimary },
  userListCloseBtn: { padding: 4 },
  userListLoading: { padding: 40, alignItems: 'center' },
  userListEmpty: { padding: 40, alignItems: 'center' },
  userListEmptyText: { fontSize: 14, color: theme.textMuted },
  userListScroll: { maxHeight: 400 },
  userListScrollContent: { padding: 8 },
  userListItem: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: theme.glass, borderRadius: 12, marginBottom: 8 },
  userListAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  userListInfo: { flex: 1 },
  userListNameRow: { flexDirection: 'row', alignItems: 'center' },
  userListName: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  userListContent: { fontSize: 13, color: theme.textSecondary, marginTop: 4, lineHeight: 18 },
  userListTime: { fontSize: 11, color: theme.textMuted, marginTop: 4 },
});