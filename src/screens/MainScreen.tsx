import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Dimensions,
  Alert,
  Modal,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import PagerView from 'react-native-pager-view';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import GlassCard from '../components/GlassCard';
import PillButton from '../components/PillButton';

const { width, height } = Dimensions.get('window');

const theme = {
  background: '#050a15',
  backgroundGradientStart: '#050a15',
  backgroundGradientEnd: '#0a1628',
  glass: 'rgba(255, 255, 255, 0.05)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  primary: '#60a5fa',
  gold: '#d4af37',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textSubtle: '#64748b',
  textMuted: '#475569',
  danger: '#ef4444',
  success: '#10b981',
  glowBlue: 'rgba(96, 165, 250, 0.2)',
  glowGold: 'rgba(212, 175, 55, 0.2)',
};

interface Dream {
  id: string;
  user_id: string;
  title: string | null;
  content: string | null;
  audio_url: string | null;
  is_public: boolean;
  status?: string;
  dream_date: string;
  created_at: string;
  interpretation_mode?: string;
  enable_engagement?: boolean;
}

interface DreamWithMeta extends Dream {
  likeCount?: number;
  interpretationCount?: number;
}

export default function MainScreen({ navigation }: any) {
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState(0);
  const [feedDreams, setFeedDreams] = useState<DreamWithMeta[]>([]);
  const [myDreams, setMyDreams] = useState<DreamWithMeta[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [myDreamsLoading, setMyDreamsLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [myDreamsError, setMyDreamsError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [selectedDream, setSelectedDream] = useState<DreamWithMeta | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const pagerRef = useRef<PagerView>(null);
  const currentAudioUrl = useRef<string | null>(null);

  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  const userAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.email || 'U')}&background=1e293b&color=60a5fa&size=64`;

  useFocusEffect(
    useCallback(() => {
      fetchFeedDreams();
      fetchMyDreams();
      return () => {
        player.pause();
        resetAudioState();
      };
    }, [user?.id])
  );

  useEffect(() => {
    if (status.didJustFinish) {
      resetAudioState();
    }
  }, [status.didJustFinish]);

  const fetchFeedDreams = async () => {
    try {
      setFeedLoading(true);
      setFeedError(null);

      const { data, error } = await supabase
        .from('dreams')
        .select('id, user_id, title, content, audio_url, is_public, dream_date, created_at, status, interpretation_mode, enable_engagement')
        .eq('is_public', true)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch engagement counts
      const dreamsWithMeta = await Promise.all(
        (data || []).map(async (dream) => {
          let likeCount = 0;
          let interpretationCount = 0;

          if (dream.enable_engagement) {
            const { count: likes } = await supabase
              .from('dream_likes')
              .select('*', { count: 'exact', head: true })
              .eq('dream_id', dream.id);
            likeCount = likes || 0;
          }

          if (dream.interpretation_mode && dream.interpretation_mode !== 'disabled') {
            const { count: interpretations } = await supabase
              .from('interpretations')
              .select('*', { count: 'exact', head: true })
              .eq('dream_id', dream.id);
            interpretationCount = interpretations || 0;
          }

          return { ...dream, likeCount, interpretationCount };
        })
      );

      setFeedDreams(dreamsWithMeta);
    } catch (error: any) {
      console.error('Feed error:', error);
      setFeedError(error.message || 'Failed to load dreams');
    } finally {
      setFeedLoading(false);
    }
  };

  const fetchMyDreams = async () => {
    if (!user) return;

    try {
      setMyDreamsLoading(true);
      setMyDreamsError(null);

      const { data, error } = await supabase
        .from('dreams')
        .select('id, user_id, title, content, audio_url, is_public, dream_date, created_at, status, interpretation_mode, enable_engagement')
        .eq('user_id', user.id)
        .order('dream_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      setMyDreams(data || []);
    } catch (error: any) {
      console.error('My dreams error:', error);
      setMyDreamsError(error.message || 'Failed to load your dreams');
    } finally {
      setMyDreamsLoading(false);
    }
  };

  const resetAudioState = () => {
    setPlayingId(null);
    currentAudioUrl.current = null;
    setIsAudioLoading(false);
  };

  const playAudio = async (dream: Dream) => {
    if (!dream.audio_url) return;

    if (playingId === dream.id) {
      if (status.playing) {
        player.pause();
      } else {
        player.play();
      }
      return;
    }

    setIsAudioLoading(true);

    if (playingId) {
      player.pause();
    }

    try {
      let audioUrl = dream.audio_url;

      if (!dream.is_public && dream.user_id === user?.id && !dream.audio_url.startsWith('http')) {
        const { data, error } = await supabase.storage
          .from('ala-audio-private')
          .createSignedUrl(dream.audio_url, 3600);

        if (error) throw error;
        if (data?.signedUrl) {
          audioUrl = data.signedUrl;
        }
      }

      await player.replace({ uri: audioUrl });
      currentAudioUrl.current = audioUrl;
      await player.play();
      setPlayingId(dream.id);
    } catch (error: any) {
      console.error('Audio playback error:', error);
      Alert.alert('Playback Error', 'Unable to play this audio');
      resetAudioState();
    } finally {
      setIsAudioLoading(false);
    }
  };

  const deleteDream = async (dreamId: string) => {
    Alert.alert('Delete Dream', 'Are you sure you want to delete this dream?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('dreams').delete().eq('id', dreamId);

            if (error) throw error;

            setMyDreams((prev) => prev.filter((d) => d.id !== dreamId));
            if (playingId === dreamId) {
              player.pause();
              resetAudioState();
            }
            setModalVisible(false);
          } catch (error) {
            console.error('Delete error:', error);
            Alert.alert('Error', 'Failed to delete dream');
          }
        },
      },
    ]);
  };

  const formatTime = (ms: number) => {
    if (!ms || isNaN(ms) || ms < 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const truncateText = (text: string, lines: number) => {
    const lineArray = text.split('\n').slice(0, lines);
    return lineArray.join('\n');
  };

  const onPageSelected = (e: any) => {
    setActiveTab(e.nativeEvent.position);
  };

  const switchTab = (index: number) => {
    pagerRef.current?.setPage(index);
  };

  const handleCirclesPress = () => {
    Alert.alert('Coming Soon', 'Dream Circles will be available in the next update.');
  };

  // Compact Dream Card (Summary)
  const CompactDreamCard = React.memo(
    ({ item, showDelete = false, onPress }: { item: DreamWithMeta; showDelete?: boolean; onPress: () => void }) => {
      const isPlaying = playingId === item.id && status.playing;
      const isMine = item.user_id === user?.id;
      const hasAudio = !!item.audio_url;
      const hasContent = !!item.content;

      const userName = isMine ? 'You' : 'Dreamer';
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=1e293b&color=60a5fa&size=64`;

      return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
          <View style={[styles.compactCard, isPlaying && styles.compactCardPlaying]}>
            <LinearGradient
              colors={['rgba(96, 165, 250, 0.08)', 'rgba(212, 175, 55, 0.04)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardGradient}
            >
              {/* Header */}
              <View style={styles.compactHeader}>
                <View style={styles.compactUserRow}>
                  <Image source={{ uri: avatarUrl }} style={styles.compactAvatar} />
                  <View style={styles.compactUserInfo}>
                    <Text style={styles.compactUserName}>{userName}</Text>
                    <Text style={styles.compactDate}>{formatDate(item.dream_date)}</Text>
                  </View>
                </View>
                {showDelete && (
                  <View style={[styles.compactBadge, item.is_public ? styles.badgePublic : styles.badgePrivate]}>
                    <Text style={styles.compactBadgeText}>{item.is_public ? 'Public' : 'Private'}</Text>
                  </View>
                )}
              </View>

              {/* Content Preview */}
              <View style={styles.compactContent}>
                {item.title && <Text style={styles.compactTitle}>{item.title}</Text>}

                {hasContent && (
                  <Text style={styles.compactExcerpt} numberOfLines={2}>
                    {item.content}
                  </Text>
                )}

                {hasAudio && !hasContent && (
                  <View style={styles.audioIndicator}>
                    <Ionicons name="musical-notes" size={14} color={theme.primary} />
                    <Text style={styles.audioIndicatorText}>Audio recording</Text>
                  </View>
                )}

                {!hasAudio && !hasContent && (
                  <Text style={styles.compactExcerpt}>No content yet</Text>
                )}
              </View>

              {/* Footer - Engagement */}
              <View style={styles.compactFooter}>
                <View style={styles.engagementPills}>
                  {hasAudio && (
                    <View style={styles.engagementPill}>
                      <Ionicons name="play-circle" size={12} color={theme.primary} />
                      <Text style={styles.engagementText}>Audio</Text>
                    </View>
                  )}

                  {item.enable_engagement && (item.likeCount ?? 0) > 0 && (
                    <View style={styles.engagementPill}>
                      <Ionicons name="heart" size={12} color={theme.danger} />
                      <Text style={styles.engagementText}>{item.likeCount}</Text>
                    </View>
                  )}

                  {(item.interpretationCount ?? 0) > 0 && (
                    <View style={styles.engagementPill}>
                      <Ionicons name="chatbubble" size={12} color={theme.gold} />
                      <Text style={styles.engagementText}>{item.interpretationCount ?? 0}</Text>
                    </View>
                  )}
                </View>

                <Ionicons name="chevron-forward" size={16} color={theme.textSubtle} />
              </View>
            </LinearGradient>
          </View>
        </TouchableOpacity>
      );
    }
  );

  // Full Dream Modal
  const DreamModal = ({ dream, visible, onClose, onDelete }: { dream: DreamWithMeta | null; visible: boolean; onClose: () => void; onDelete?: () => void }) => {
    if (!dream) return null;

    const isPlaying = playingId === dream.id && status.playing;
    const isThisDream = playingId === dream.id;
    const isMine = dream.user_id === user?.id;
    const progressPercent = isThisDream && status.duration > 0 ? Math.min(100, (status.currentTime / status.duration) * 100) : 0;

    const userName = isMine ? 'You' : 'Dreamer';
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=1e293b&color=60a5fa&size=64`;

    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <SafeAreaView style={styles.modalContainer}>
          <LinearGradient colors={[theme.backgroundGradientStart, theme.backgroundGradientEnd]} style={styles.modalGradient}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
                <Ionicons name="chevron-down" size={28} color={theme.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Dream</Text>
              {isMine && (
                <TouchableOpacity onPress={() => onDelete?.()} style={styles.modalDeleteBtn}>
                  <Ionicons name="trash-outline" size={24} color={theme.danger} />
                </TouchableOpacity>
              )}
            </View>

            {/* Modal Content */}
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* User Info */}
              <View style={styles.modalUserRow}>
                <Image source={{ uri: avatarUrl }} style={styles.modalAvatar} />
                <View>
                  <Text style={styles.modalUserName}>{userName}</Text>
                  <Text style={styles.modalDate}>{formatDate(dream.dream_date)}</Text>
                </View>
              </View>

              {/* Title */}
              {dream.title && <Text style={styles.modalTitle}>{dream.title}</Text>}

              {/* Content */}
              {dream.content && <Text style={styles.modalContent}>{dream.content}</Text>}

              {/* Audio Player */}
              {dream.audio_url && (
                <View style={styles.modalAudioSection}>
                  <View style={styles.modalAudioControls}>
                    <PillButton
                      title={isPlaying ? 'Pause' : 'Play'}
                      onPress={() => playAudio(dream)}
                      variant={isPlaying ? 'primary' : 'glass'}
                      size="medium"
                      loading={isAudioLoading && playingId === dream.id}
                    />
                    {isThisDream && (
                      <Text style={styles.modalTimeDisplay}>
                        {formatTime(status.currentTime)} / {formatTime(status.duration)}
                      </Text>
                    )}
                  </View>

                  {isThisDream && (
                    <View style={styles.modalProgressBar}>
                      <View style={[styles.modalProgressFill, { width: `${progressPercent}%` }]} />
                    </View>
                  )}
                </View>
              )}

              {/* Engagement Section */}
              <View style={styles.modalEngagementSection}>
                {dream.enable_engagement && (
                  <TouchableOpacity style={styles.engagementAction}>
                    <Ionicons name="heart-outline" size={20} color={theme.danger} />
                    <Text style={styles.engagementActionText}>{dream.likeCount || 0} Likes</Text>
                  </TouchableOpacity>
                )}

                {(dream.interpretationCount ?? 0) > 0 && dream.interpretation_mode !== 'disabled' && (
                  <TouchableOpacity style={styles.engagementAction}>
                    <Ionicons name="chatbubble-outline" size={20} color={theme.gold} />
                    <Text style={styles.engagementActionText}>{dream.interpretationCount ?? 0} Interpretations</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Interpretations Preview (if enabled) */}
              {dream.interpretation_mode !== 'disabled' && ((dream.interpretationCount ?? 0) > 0) && (
                <View style={styles.interpretationsPreview}>
                  <Text style={styles.interpretationsTitle}>Community Interpretations</Text>
                  <Text style={styles.interpretationsSubtitle}>Tap to view all {dream.interpretationCount ?? 0} interpretations</Text>
                </View>
              )}
            </ScrollView>
          </LinearGradient>
        </SafeAreaView>
      </Modal>
    );
  };

  const FeedContent = () => {
    if (feedLoading) {
      return (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading dreams...</Text>
        </View>
      );
    }

    if (feedError) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={theme.textSubtle} />
          <Text style={styles.errorTitle}>Connection Issue</Text>
          <Text style={styles.errorSubtitle}>{feedError}</Text>
          <PillButton title="Try Again" onPress={fetchFeedDreams} variant="primary" size="medium" style={{ marginTop: 20 }} />
        </View>
      );
    }

    if (feedDreams.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="moon-outline" size={48} color={theme.textSubtle} />
          <Text style={styles.emptyTitle}>No dreams in the feed yet</Text>
          <Text style={styles.emptySubtitle}>Be the first to share a dream with the community</Text>
          <PillButton title="Share a Dream" onPress={() => navigation.navigate('RecordDream')} variant="primary" size="medium" style={{ marginTop: 20 }} />
        </View>
      );
    }

    return (
      <FlatList
        data={feedDreams}
        renderItem={({ item }) => (
          <CompactDreamCard
            item={item}
            onPress={() => {
              setSelectedDream(item);
              setModalVisible(true);
            }}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={feedLoading}
        onRefresh={fetchFeedDreams}
        showsVerticalScrollIndicator={false}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
      />
    );
  };

  const MyDreamsContent = () => {
    if (myDreamsLoading) {
      return (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading your dreams...</Text>
        </View>
      );
    }

    if (myDreamsError) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={theme.textSubtle} />
          <Text style={styles.errorTitle}>Connection Issue</Text>
          <Text style={styles.errorSubtitle}>{myDreamsError}</Text>
          <PillButton title="Try Again" onPress={fetchMyDreams} variant="primary" size="medium" style={{ marginTop: 20 }} />
        </View>
      );
    }

    if (myDreams.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="book-outline" size={48} color={theme.textSubtle} />
          <Text style={styles.emptyTitle}>No dreams recorded yet</Text>
          <Text style={styles.emptySubtitle}>Start capturing your dreams by tapping Record below</Text>
          <PillButton title="Record Your First Dream" onPress={() => navigation.navigate('RecordDream')} variant="primary" size="medium" style={{ marginTop: 20 }} />
        </View>
      );
    }

    return (
      <FlatList
        data={myDreams}
        renderItem={({ item }) => (
          <CompactDreamCard
            item={item}
            showDelete
            onPress={() => {
              setSelectedDream(item);
              setModalVisible(true);
            }}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={myDreamsLoading}
        onRefresh={fetchMyDreams}
        showsVerticalScrollIndicator={false}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
      />
    );
  };

  return (
    <LinearGradient colors={[theme.backgroundGradientStart, theme.backgroundGradientEnd]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* New Header Layout */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
            <Image source={{ uri: userAvatar }} style={styles.headerAvatar} />
          </TouchableOpacity>

          {/* Tab Switcher */}
          <View style={styles.tabContainer}>
            <TouchableOpacity style={styles.tab} onPress={() => switchTab(0)} activeOpacity={0.7}>
              <Text style={[styles.tabText, activeTab === 0 && styles.tabTextActive]}>Feed</Text>
            </TouchableOpacity>

            <View style={styles.tabDivider} />

            <TouchableOpacity style={styles.tab} onPress={() => switchTab(1)} activeOpacity={0.7}>
              <Text style={[styles.tabText, activeTab === 1 && styles.tabTextActive]}>My Dreams</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => Alert.alert('Notifications', 'Coming soon!')} activeOpacity={0.8}>
            <View style={styles.notificationBell}>
              <Ionicons name="notifications-outline" size={24} color={theme.textPrimary} />
              <View style={styles.notificationDot} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Swipeable Pages */}
        <PagerView ref={pagerRef} style={styles.pagerView} initialPage={0} onPageSelected={onPageSelected}>
          <View key="feed" style={styles.page}>
            <FeedContent />
          </View>
          <View key="mine" style={styles.page}>
            <MyDreamsContent />
          </View>
        </PagerView>

        {/* Bottom Nav with Logo */}
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.bottomNavBtn} onPress={handleCirclesPress} activeOpacity={0.8}>
            <LinearGradient colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']} style={styles.bottomNavGradient}>
              <Ionicons name="people-outline" size={20} color={theme.textPrimary} />
              <Text style={styles.bottomNavText}>Circles</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Glowy Logo */}
          <View style={styles.logoContainer}>
            <LinearGradient colors={['rgba(212, 175, 55, 0.3)', 'rgba(212, 175, 55, 0.1)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoGlow}>
              <Text style={styles.logoText}>Àlá</Text>
            </LinearGradient>
          </View>

          <TouchableOpacity style={styles.bottomNavBtn} onPress={() => navigation.navigate('RecordDream')} activeOpacity={0.8}>
            <LinearGradient colors={[theme.primary, '#3b82f6']} style={styles.bottomNavGradient}>
              <Ionicons name="mic" size={20} color="#fff" />
              <Text style={[styles.bottomNavText, { color: '#fff' }]}>Record</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Dream Detail Modal */}
      <DreamModal
        dream={selectedDream}
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setSelectedDream(null);
        }}
        onDelete={() => selectedDream && deleteDream(selectedDream.id)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: theme.glassBorder,
  },
  tabContainer: { flexDirection: 'row', alignItems: 'center' },
  tab: { paddingHorizontal: 12, paddingVertical: 8 },
  tabDivider: { width: 1, height: 16, backgroundColor: theme.glassBorder },
  tabText: { fontSize: 14, fontWeight: '600', color: theme.textMuted },
  tabTextActive: { color: theme.textPrimary },
  notificationBell: { position: 'relative' },
  notificationDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.danger,
  },

  // Pager
  pagerView: { flex: 1 },
  page: { flex: 1 },

  // List
  list: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 100 },

  // Compact Card (3D Effect)
  compactCard: {
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  compactCardPlaying: {
    borderColor: theme.primary,
    shadowColor: theme.primary,
    shadowOpacity: 0.3,
    elevation: 16,
  },
  cardGradient: { padding: 16 },

  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  compactUserRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  compactAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: theme.glass,
  },
  compactUserInfo: { flex: 1 },
  compactUserName: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  compactDate: { fontSize: 12, color: theme.textSubtle, marginTop: 2 },
  compactBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgePublic: { backgroundColor: theme.glowBlue },
  badgePrivate: { backgroundColor: theme.glowGold },
  compactBadgeText: { fontSize: 11, fontWeight: '600', color: theme.textSecondary },

  compactContent: { marginBottom: 10 },
  compactTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 6 },
  compactExcerpt: { fontSize: 13, color: theme.textSecondary, lineHeight: 18 },

  audioIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  audioIndicatorText: { fontSize: 12, color: theme.primary, fontWeight: '500' },

  compactFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  engagementPills: { flexDirection: 'row', gap: 8 },
  engagementPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
  },
  engagementText: { fontSize: 11, color: theme.textSecondary, fontWeight: '500' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: theme.background },
  modalGradient: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.glassBorder,
  },
  modalCloseBtn: { padding: 8 },
  modalDeleteBtn: { padding: 8 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary },

  modalContent: { paddingHorizontal: 20, paddingVertical: 16 },
  modalUserRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  modalAvatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  modalUserName: { fontSize: 16, fontWeight: '600', color: theme.textPrimary },
  modalDate: { fontSize: 13, color: theme.textSubtle, marginTop: 2 },

  modalAudioSection: { marginVertical: 16, paddingHorizontal: 0 },
  modalAudioControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalTimeDisplay: { fontSize: 13, color: theme.textSecondary, fontVariant: ['tabular-nums'], flex: 1 },
  modalProgressBar: { marginTop: 12, height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  modalProgressFill: { height: '100%', backgroundColor: theme.gold, borderRadius: 2 },

  modalEngagementSection: { flexDirection: 'row', gap: 12, marginVertical: 16 },
  engagementAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  engagementActionText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },

  interpretationsPreview: {
    marginVertical: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.glowGold,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  interpretationsTitle: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginBottom: 4 },
  interpretationsSubtitle: { fontSize: 12, color: theme.textSecondary },

  // States
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: theme.textSubtle, fontSize: 14 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  errorTitle: { fontSize: 18, fontWeight: '600', color: theme.textPrimary, marginTop: 12, marginBottom: 8 },
  errorSubtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: theme.textPrimary, marginTop: 12, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center' },

  // Bottom Nav
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 12,
    backgroundColor: `${theme.background}dd`,
    borderTopWidth: 1,
    borderTopColor: theme.glassBorder,
  },
  bottomNavBtn: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.glassBorder,
    maxWidth: '35%',
  },
  bottomNavGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  bottomNavText: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },

  logoContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logoGlow: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.gold,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(212, 175, 55, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
});