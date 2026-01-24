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
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import PagerView from 'react-native-pager-view';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

const { width, height } = Dimensions.get('window');

const theme = {
  background: '#050a15',
  backgroundGradientStart: '#050a15',
  backgroundGradientEnd: '#0a1628',
  glass: 'rgba(255, 255, 255, 0.06)',
  glassMedium: 'rgba(255, 255, 255, 0.08)',
  glassStrong: 'rgba(255, 255, 255, 0.12)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  glassBorderLight: 'rgba(255, 255, 255, 0.15)',
  primary: '#60a5fa',
  gold: '#d4af37',
  goldLight: '#e6c55a',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textSubtle: '#64748b',
  textMuted: '#475569',
  danger: '#ef4444',
  success: '#10b981',
  glowBlue: 'rgba(96, 165, 250, 0.15)',
  glowGold: 'rgba(212, 175, 55, 0.15)',
  shadowDark: 'rgba(0, 0, 0, 0.5)',
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
  const [isAudioLoading, setIsAudioLoading] = useState<string | null>(null);
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
    setIsAudioLoading(null);
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

    setIsAudioLoading(dream.id);

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
      setIsAudioLoading(null);
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

  const formatDuration = (ms: number) => {
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

  const onPageSelected = (e: any) => {
    setActiveTab(e.nativeEvent.position);
  };

  const switchTab = (index: number) => {
    pagerRef.current?.setPage(index);
  };

  const handleCirclesPress = () => {
    Alert.alert('Coming Soon', 'Dream Circles will be available in the next update.');
  };

  // Dream Card Component
  const DreamCard = React.memo(
    ({ item, showStatus = false, onPress }: { item: DreamWithMeta; showStatus?: boolean; onPress: () => void }) => {
      const isPlaying = playingId === item.id && status.playing;
      const isThisPlaying = playingId === item.id;
      const isLoading = isAudioLoading === item.id;
      const isMine = item.user_id === user?.id;
      const hasAudio = !!item.audio_url;
      const hasContent = !!item.content;

      const userName = isMine ? 'You' : 'Dreamer';
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=1e293b&color=60a5fa&size=64`;

      const progressPercent = isThisPlaying && status.duration > 0
        ? Math.min(100, (status.currentTime / status.duration) * 100)
        : 0;

      const scaleAnim = useRef(new Animated.Value(1)).current;

      const handlePressIn = () => {
        Animated.spring(scaleAnim, {
          toValue: 0.97,
          useNativeDriver: true,
        }).start();
      };

      const handlePressOut = () => {
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 3,
          useNativeDriver: true,
        }).start();
      };

      return (
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
            <View style={styles.cardHighlight} />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardInner}
            >
              {/* Header */}
              <View style={styles.cardHeader}>
                <View style={styles.userRow}>
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                  <View>
                    <Text style={styles.userName}>{userName}</Text>
                    <Text style={styles.dateText}>{formatDate(item.dream_date)}</Text>
                  </View>
                </View>

                {showStatus && (
                  <View style={styles.statusBadge}>
                    <View style={[styles.statusDot, item.is_public ? styles.statusPublic : styles.statusPrivate]} />
                    <Text style={styles.statusText}>{item.is_public ? 'Public' : 'Private'}</Text>
                  </View>
                )}
              </View>

              {/* Content */}
              <View style={styles.cardBody}>
                {item.title && (
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                )}
                {hasContent && (
                  <Text style={styles.cardExcerpt} numberOfLines={2}>{item.content}</Text>
                )}
                {!hasContent && !hasAudio && (
                  <Text style={styles.cardExcerptMuted}>No content yet</Text>
                )}
              </View>

              {/* Audio Player */}
              {hasAudio && (
                <View style={styles.audioPlayer}>
                  <TouchableOpacity
                    style={[styles.playBtn, isPlaying && styles.playBtnActive]}
                    onPress={() => playAudio(item)}
                    activeOpacity={0.7}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color="#fff" />
                    )}
                  </TouchableOpacity>

                  <View style={styles.progressWrap}>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                    </View>
                  </View>

                  <Text style={styles.durationText}>
                    {isThisPlaying ? formatDuration(status.currentTime) : formatDuration(status.duration || 0)}
                  </Text>
                </View>
              )}

              {/* Footer */}
              <View style={styles.cardFooter}>
                <View style={styles.engagementRow}>
                  {item.enable_engagement && (item.likeCount ?? 0) > 0 && (
                    <View style={styles.engagementItem}>
                      <Ionicons name="heart" size={14} color={theme.danger} />
                      <Text style={styles.engagementCount}>{item.likeCount}</Text>
                    </View>
                  )}
                  {(item.interpretationCount ?? 0) > 0 && (
                    <View style={styles.engagementItem}>
                      <Ionicons name="chatbubble" size={14} color={theme.gold} />
                      <Text style={styles.engagementCount}>{item.interpretationCount}</Text>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </View>
            </LinearGradient>
          </Animated.View>
        </Pressable>
      );
    }
  );

  // Modal Component
  const DreamModal = () => {
    if (!selectedDream) return null;

    const dream = selectedDream;
    const isPlaying = playingId === dream.id && status.playing;
    const isThisDream = playingId === dream.id;
    const isMine = dream.user_id === user?.id;
    const progressPercent = isThisDream && status.duration > 0
      ? Math.min(100, (status.currentTime / status.duration) * 100)
      : 0;

    const userName = isMine ? 'You' : 'Dreamer';
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=1e293b&color=60a5fa&size=64`;

    return (
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.modalWrap}>
          <LinearGradient colors={[theme.backgroundGradientStart, theme.backgroundGradientEnd]} style={styles.modalBg}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalClose}>
                <Ionicons name="chevron-down" size={28} color={theme.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.modalHeaderText}>Dream</Text>
              {isMine ? (
                <TouchableOpacity onPress={() => deleteDream(dream.id)} style={styles.modalClose}>
                  <Ionicons name="trash-outline" size={24} color={theme.danger} />
                </TouchableOpacity>
              ) : (
                <View style={{ width: 40 }} />
              )}
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              <View style={styles.modalUser}>
                <Image source={{ uri: avatarUrl }} style={styles.modalAvatar} />
                <View>
                  <Text style={styles.modalUserName}>{userName}</Text>
                  <Text style={styles.modalDate}>{formatDate(dream.dream_date)}</Text>
                </View>
              </View>

              {dream.title && <Text style={styles.modalTitle}>{dream.title}</Text>}
              {dream.content && <Text style={styles.modalContent}>{dream.content}</Text>}

              {dream.audio_url && (
                <View style={styles.modalAudio}>
                  <TouchableOpacity
                    style={[styles.modalPlayBtn, isPlaying && styles.modalPlayBtnActive]}
                    onPress={() => playAudio(dream)}
                  >
                    {isAudioLoading === dream.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color="#fff" />
                    )}
                  </TouchableOpacity>

                  <View style={styles.modalAudioInfo}>
                    <View style={styles.modalProgressTrack}>
                      <View style={[styles.modalProgressFill, { width: `${progressPercent}%` }]} />
                    </View>
                    <View style={styles.modalTimeRow}>
                      <Text style={styles.modalTimeText}>{isThisDream ? formatDuration(status.currentTime) : '0:00'}</Text>
                      <Text style={styles.modalTimeText}>{formatDuration(status.duration || 0)}</Text>
                    </View>
                  </View>
                </View>
              )}

              {(dream.enable_engagement || dream.interpretation_mode !== 'disabled') && (
                <View style={styles.modalEngagement}>
                  {dream.enable_engagement && (
                    <View style={styles.modalEngageBtn}>
                      <Ionicons name="heart-outline" size={22} color={theme.danger} />
                      <Text style={styles.modalEngageText}>{dream.likeCount || 0}</Text>
                    </View>
                  )}
                  {dream.interpretation_mode !== 'disabled' && (
                    <View style={styles.modalEngageBtn}>
                      <Ionicons name="chatbubble-outline" size={22} color={theme.gold} />
                      <Text style={styles.modalEngageText}>{dream.interpretationCount || 0}</Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </LinearGradient>
        </SafeAreaView>
      </Modal>
    );
  };

  const renderFeed = () => {
    if (feedLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading dreams...</Text>
        </View>
      );
    }

    if (feedError) {
      return (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={theme.textSubtle} />
          <Text style={styles.stateTitle}>Connection Issue</Text>
          <Text style={styles.stateSubtitle}>{feedError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchFeedDreams}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (feedDreams.length === 0) {
      return (
        <View style={styles.center}>
          <Ionicons name="moon-outline" size={48} color={theme.textSubtle} />
          <Text style={styles.stateTitle}>No dreams yet</Text>
          <Text style={styles.stateSubtitle}>Be the first to share</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('RecordDream')}>
            <Text style={styles.primaryBtnText}>Share a Dream</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={feedDreams}
        renderItem={({ item }) => (
          <DreamCard item={item} onPress={() => { setSelectedDream(item); setModalVisible(true); }} />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={feedLoading}
        onRefresh={fetchFeedDreams}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const renderMyDreams = () => {
    if (myDreamsLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading your dreams...</Text>
        </View>
      );
    }

    if (myDreamsError) {
      return (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={theme.textSubtle} />
          <Text style={styles.stateTitle}>Connection Issue</Text>
          <Text style={styles.stateSubtitle}>{myDreamsError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchMyDreams}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (myDreams.length === 0) {
      return (
        <View style={styles.center}>
          <Ionicons name="book-outline" size={48} color={theme.textSubtle} />
          <Text style={styles.stateTitle}>No dreams recorded</Text>
          <Text style={styles.stateSubtitle}>Start capturing your dreams</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('RecordDream')}>
            <Text style={styles.primaryBtnText}>Record First Dream</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={myDreams}
        renderItem={({ item }) => (
          <DreamCard item={item} showStatus onPress={() => { setSelectedDream(item); setModalVisible(true); }} />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={myDreamsLoading}
        onRefresh={fetchMyDreams}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  return (
    <LinearGradient colors={[theme.backgroundGradientStart, theme.backgroundGradientEnd]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
            <Image source={{ uri: userAvatar }} style={styles.headerAvatar} />
          </TouchableOpacity>

          <View style={styles.tabRow}>
            <TouchableOpacity style={styles.tab} onPress={() => switchTab(0)}>
              <Text style={[styles.tabText, activeTab === 0 && styles.tabActive]}>Feed</Text>
              {activeTab === 0 && <View style={styles.tabDot} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.tab} onPress={() => switchTab(1)}>
              <Text style={[styles.tabText, activeTab === 1 && styles.tabActive]}>My Dreams</Text>
              {activeTab === 1 && <View style={styles.tabDot} />}
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => Alert.alert('Notifications', 'Coming soon!')}>
            <View style={styles.bellWrap}>
              <Ionicons name="notifications-outline" size={22} color={theme.textPrimary} />
              <View style={styles.bellDot} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Pages */}
        <PagerView ref={pagerRef} style={styles.pager} initialPage={0} onPageSelected={onPageSelected}>
          <View key="feed" style={styles.page}>{renderFeed()}</View>
          <View key="mine" style={styles.page}>{renderMyDreams()}</View>
        </PagerView>

        {/* Bottom Nav - Glassmorphism */}
        <View style={styles.bottomNavContainer}>
          <View style={styles.bottomNav}>
            <TouchableOpacity style={styles.navBtn} onPress={handleCirclesPress} activeOpacity={0.7}>
              <View style={styles.navBtnInner}>
                <Ionicons name="people-outline" size={20} color={theme.textPrimary} />
                <Text style={styles.navBtnText}>Circles</Text>
              </View>
            </TouchableOpacity>

            {/* Logo - just text, no pill */}
            <Text style={styles.logoText}>Àlá</Text>

            <TouchableOpacity style={styles.navBtn} onPress={() => navigation.navigate('RecordDream')} activeOpacity={0.7}>
              <View style={[styles.navBtnInner, styles.navBtnRecord]}>
                <Ionicons name="mic" size={20} color="#fff" />
                <Text style={[styles.navBtnText, { color: '#fff' }]}>Record</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <DreamModal />
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
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  tab: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textMuted,
  },
  tabActive: {
    color: theme.textPrimary,
  },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.primary,
    marginTop: 4,
  },
  bellWrap: {
    position: 'relative',
  },
  bellDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.danger,
  },

  // Pager
  pager: { flex: 1 },
  page: { flex: 1 },

  // List
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 140,
  },

  // Card
  card: {
    marginBottom: 16,
    borderRadius: 24,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
  cardHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    zIndex: 1,
  },
  cardInner: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  dateText: {
    fontSize: 12,
    color: theme.textSubtle,
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPublic: {
    backgroundColor: theme.primary,
  },
  statusPrivate: {
    backgroundColor: theme.gold,
  },
  statusText: {
    fontSize: 11,
    color: theme.textSubtle,
    fontWeight: '500',
  },

  cardBody: {
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  cardExcerpt: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  cardExcerptMuted: {
    fontSize: 14,
    color: theme.textMuted,
    fontStyle: 'italic',
  },

  // Audio Player on card
  audioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 16,
    marginBottom: 12,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtnActive: {
    backgroundColor: theme.primary,
  },
  progressWrap: {
    flex: 1,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.gold,
  },
  durationText: {
    fontSize: 12,
    color: theme.textSubtle,
    fontVariant: ['tabular-nums'],
    minWidth: 36,
    textAlign: 'right',
  },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  engagementRow: {
    flexDirection: 'row',
    gap: 16,
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  engagementCount: {
    fontSize: 13,
    color: theme.textSubtle,
    fontWeight: '500',
  },

  // Bottom Nav
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  navBtn: {
    flex: 1,
    maxWidth: 120,
  },
  navBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  navBtnRecord: {
    backgroundColor: theme.primary,
  },
  navBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  logoText: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.gold,
    textShadowColor: 'rgba(212, 175, 55, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },

  // States
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 16,
    color: theme.textSubtle,
    fontSize: 14,
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  stateSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  primaryBtn: {
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    backgroundColor: theme.primary,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  // Modal
  modalWrap: {
    flex: 1,
    backgroundColor: theme.background,
  },
  modalBg: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.glassBorder,
  },
  modalClose: {
    padding: 8,
  },
  modalHeaderText: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  modalUser: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  modalUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  modalDate: {
    fontSize: 13,
    color: theme.textSubtle,
    marginTop: 2,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 16,
  },
  modalContent: {
    fontSize: 16,
    color: theme.textSecondary,
    lineHeight: 26,
    marginBottom: 24,
  },
  modalAudio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    backgroundColor: theme.glass,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    marginBottom: 24,
  },
  modalPlayBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalPlayBtnActive: {
    backgroundColor: theme.primary,
  },
  modalAudioInfo: {
    flex: 1,
  },
  modalProgressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  modalProgressFill: {
    height: '100%',
    backgroundColor: theme.gold,
  },
  modalTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalTimeText: {
    fontSize: 12,
    color: theme.textSubtle,
    fontVariant: ['tabular-nums'],
  },
  modalEngagement: {
    flexDirection: 'row',
    gap: 12,
  },
  modalEngageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  modalEngageText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
  },
});