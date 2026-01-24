import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  TextInput,
  SectionList,
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
  primaryDark: '#3b82f6',
  gold: '#d4af37',
  goldLight: '#e6c55a',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textSubtle: '#64748b',
  textMuted: '#475569',
  danger: '#ef4444',
  success: '#10b981',
  purple: '#a78bfa',
  glowBlue: 'rgba(96, 165, 250, 0.15)',
  glowGold: 'rgba(212, 175, 55, 0.15)',
  glowPurple: 'rgba(167, 139, 250, 0.15)',
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

interface DreamSection {
  title: string;
  data: DreamWithMeta[];
}

type AudioContext = 'feed' | 'journal' | 'modal';

export default function MainScreen({ navigation }: any) {
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState(0);
  const [feedDreams, setFeedDreams] = useState<DreamWithMeta[]>([]);
  const [myDreams, setMyDreams] = useState<DreamWithMeta[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [myDreamsLoading, setMyDreamsLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [myDreamsError, setMyDreamsError] = useState<string | null>(null);
  
  // Audio state with context tracking
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingContext, setPlayingContext] = useState<AudioContext | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState<string | null>(null);
  
  // Modal state - use refs for stability
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDream, setSelectedDream] = useState<DreamWithMeta | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

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

  // Calculate journal stats
  const journalStats = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const dreamsThisMonth = myDreams.filter((d) => {
      const date = new Date(d.dream_date);
      return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
    }).length;

    let streak = 0;
    const sortedDates = [...new Set(myDreams.map((d) => d.dream_date.split('T')[0]))].sort().reverse();

    if (sortedDates.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      if (sortedDates[0] === today || sortedDates[0] === yesterday) {
        streak = 1;
        for (let i = 1; i < sortedDates.length; i++) {
          const prevDate = new Date(sortedDates[i - 1]);
          const currDate = new Date(sortedDates[i]);
          const diffDays = Math.floor((prevDate.getTime() - currDate.getTime()) / 86400000);
          if (diffDays === 1) {
            streak++;
          } else {
            break;
          }
        }
      }
    }

    const months = [...new Set(myDreams.map((d) => {
      const date = new Date(d.dream_date);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }))].sort().reverse();

    return { total: myDreams.length, thisMonth: dreamsThisMonth, streak, months };
  }, [myDreams]);

  // Group dreams by time period
  const groupedDreams = useMemo(() => {
    let filtered = myDreams;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) => d.title?.toLowerCase().includes(query) || d.content?.toLowerCase().includes(query)
      );
    }

    if (selectedMonth) {
      filtered = filtered.filter((d) => {
        const date = new Date(d.dream_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return monthKey === selectedMonth;
      });
    }

    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now.getTime() - 86400000).toDateString();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const sections: DreamSection[] = [];
    const todayDreams: DreamWithMeta[] = [];
    const yesterdayDreams: DreamWithMeta[] = [];
    const thisWeekDreams: DreamWithMeta[] = [];
    const thisMonthDreams: DreamWithMeta[] = [];
    const olderByMonth: { [key: string]: DreamWithMeta[] } = {};

    filtered.forEach((dream) => {
      const dreamDate = new Date(dream.dream_date);
      const dreamDateStr = dreamDate.toDateString();

      if (dreamDateStr === today) {
        todayDreams.push(dream);
      } else if (dreamDateStr === yesterday) {
        yesterdayDreams.push(dream);
      } else if (dreamDate >= weekAgo) {
        thisWeekDreams.push(dream);
      } else if (dreamDate >= monthStart) {
        thisMonthDreams.push(dream);
      } else {
        const monthKey = dreamDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        if (!olderByMonth[monthKey]) olderByMonth[monthKey] = [];
        olderByMonth[monthKey].push(dream);
      }
    });

    if (todayDreams.length > 0) sections.push({ title: 'Today', data: todayDreams });
    if (yesterdayDreams.length > 0) sections.push({ title: 'Yesterday', data: yesterdayDreams });
    if (thisWeekDreams.length > 0) sections.push({ title: 'This Week', data: thisWeekDreams });
    if (thisMonthDreams.length > 0) sections.push({ title: 'Earlier This Month', data: thisMonthDreams });

    Object.keys(olderByMonth)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .forEach((month) => {
        sections.push({ title: month, data: olderByMonth[month] });
      });

    return sections;
  }, [myDreams, searchQuery, selectedMonth]);

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
        .limit(100);

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
    setPlayingContext(null);
    currentAudioUrl.current = null;
    setIsAudioLoading(null);
  };

  // Audio player with context isolation
  const playAudio = async (dream: Dream, context: AudioContext) => {
    if (!dream.audio_url) return;

    // If same dream AND same context, toggle play/pause
    if (playingId === dream.id && playingContext === context) {
      if (status.playing) {
        player.pause();
      } else {
        player.play();
      }
      return;
    }

    setIsAudioLoading(dream.id);

    // Stop any current playback
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
        if (data?.signedUrl) audioUrl = data.signedUrl;
      }

      await player.replace({ uri: audioUrl });
      currentAudioUrl.current = audioUrl;
      await player.play();
      setPlayingId(dream.id);
      setPlayingContext(context);
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
            setSelectedDream(null);
          } catch (error) {
            console.error('Delete error:', error);
            Alert.alert('Error', 'Failed to delete dream');
          }
        },
      },
    ]);
  };

  // Open modal without flicker
  const openDreamModal = useCallback((dream: DreamWithMeta) => {
    setSelectedDream(dream);
    // Small delay to prevent flicker
    requestAnimationFrame(() => {
      setModalVisible(true);
    });
  }, []);

  const closeDreamModal = useCallback(() => {
    setModalVisible(false);
    // Delay clearing dream to allow animation
    setTimeout(() => {
      setSelectedDream(null);
    }, 300);
  }, []);

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

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatFullDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatJournalDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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

  // Check if audio is playing for specific dream AND context
  const isPlayingInContext = (dreamId: string, context: AudioContext) => {
    return playingId === dreamId && playingContext === context && status.playing;
  };

  const isThisDreamInContext = (dreamId: string, context: AudioContext) => {
    return playingId === dreamId && playingContext === context;
  };

  // Feed Dream Card
  const FeedDreamCard = React.memo(({ item, onPress }: { item: DreamWithMeta; onPress: () => void }) => {
    const isPlaying = isPlayingInContext(item.id, 'feed');
    const isThisPlaying = isThisDreamInContext(item.id, 'feed');
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
      Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
    };

    return (
      <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <Animated.View style={[styles.feedCard, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.cardHighlight} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardInner}
          >
            <View style={styles.feedCardHeader}>
              <View style={styles.userRow}>
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                <View>
                  <Text style={styles.userName}>{userName}</Text>
                  <Text style={styles.dateText}>{formatDate(item.dream_date)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.cardBody}>
              {item.title && <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>}
              {hasContent && <Text style={styles.cardExcerpt} numberOfLines={2}>{item.content}</Text>}
              {!hasContent && !hasAudio && <Text style={styles.cardExcerptMuted}>No content yet</Text>}
            </View>

            {hasAudio && (
              <View style={styles.audioPlayer}>
                <TouchableOpacity
                  style={[styles.playBtn, isPlaying && styles.playBtnActive]}
                  onPress={() => playAudio(item, 'feed')}
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
  });

  // Journal Entry Card with date + time
  const JournalEntryCard = React.memo(({ item, onPress }: { item: DreamWithMeta; onPress: () => void }) => {
    const isPlaying = isPlayingInContext(item.id, 'journal');
    const isThisPlaying = isThisDreamInContext(item.id, 'journal');
    const isLoading = isAudioLoading === item.id;
    const hasAudio = !!item.audio_url;
    const hasContent = !!item.content;

    const progressPercent = isThisPlaying && status.duration > 0
      ? Math.min(100, (status.currentTime / status.duration) * 100)
      : 0;

    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.journalCard, isPlaying && styles.journalCardActive]}>
          {/* Date & Time Column */}
          <View style={styles.journalTimeCol}>
            <Text style={styles.journalDateLabel}>{formatJournalDate(item.dream_date)}</Text>
            <Text style={styles.journalTimeLabel}>{formatTime(item.created_at)}</Text>
            <View style={styles.journalTimeLine} />
          </View>

          {/* Content */}
          <View style={styles.journalContent}>
            <View style={styles.journalHeader}>
              {item.title ? (
                <Text style={styles.journalTitle} numberOfLines={1}>{item.title}</Text>
              ) : (
                <Text style={styles.journalTitleMuted}>Untitled Dream</Text>
              )}

              <View style={styles.journalBadges}>
                {hasAudio && (
                  <View style={styles.journalBadge}>
                    <Ionicons name="mic" size={10} color={theme.primary} />
                  </View>
                )}
                <View style={[styles.journalBadge, item.is_public ? styles.badgePublic : styles.badgePrivate]}>
                  <Ionicons
                    name={item.is_public ? 'globe-outline' : 'lock-closed'}
                    size={10}
                    color={item.is_public ? theme.primary : theme.gold}
                  />
                </View>
              </View>
            </View>

            {hasContent && (
              <Text style={styles.journalExcerpt} numberOfLines={2}>{item.content}</Text>
            )}

            {hasAudio && (
              <View style={styles.journalAudio}>
                <TouchableOpacity
                  style={[styles.journalPlayBtn, isPlaying && styles.journalPlayBtnActive]}
                  onPress={() => playAudio(item, 'journal')}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={theme.textPrimary} />
                  ) : (
                    <Ionicons name={isPlaying ? 'pause' : 'play'} size={14} color={theme.textPrimary} />
                  )}
                </TouchableOpacity>
                <View style={styles.journalProgressTrack}>
                  <View style={[styles.journalProgressFill, { width: `${progressPercent}%` }]} />
                </View>
                <Text style={styles.journalDuration}>
                  {isThisPlaying ? formatDuration(status.currentTime) : formatDuration(status.duration || 0)}
                </Text>
              </View>
            )}
          </View>

          <Ionicons name="chevron-forward" size={16} color={theme.textMuted} style={styles.journalChevron} />
        </View>
      </TouchableOpacity>
    );
  });

  // Stats Card
  const StatsCard = ({ icon, label, value, color }: { icon: string; label: string; value: number | string; color: string }) => (
    <View style={[styles.statCard, { borderColor: color + '30' }]}>
      <View style={[styles.statIconWrap, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  // Dream Modal - Stable, no flicker
  const DreamModal = useMemo(() => {
    if (!selectedDream) return null;

    const dream = selectedDream;
    const isPlaying = isPlayingInContext(dream.id, 'modal');
    const isThisDream = isThisDreamInContext(dream.id, 'modal');
    const isMine = dream.user_id === user?.id;
    const progressPercent = isThisDream && status.duration > 0
      ? Math.min(100, (status.currentTime / status.duration) * 100)
      : 0;

    const userName = isMine ? 'You' : 'Dreamer';
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=1e293b&color=60a5fa&size=64`;

    return (
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeDreamModal}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalWrap}>
            <LinearGradient colors={[theme.backgroundGradientStart, theme.backgroundGradientEnd]} style={styles.modalBg}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={closeDreamModal} style={styles.modalClose}>
                  <Ionicons name="chevron-down" size={28} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.modalHeaderText}>Dream</Text>
                {isMine ? (
                  <TouchableOpacity onPress={() => deleteDream(dream.id)} style={styles.modalClose}>
                    <Ionicons name="trash-outline" size={24} color={theme.danger} />
                  </TouchableOpacity>
                ) : (
                  <View style={{ width: 44 }} />
                )}
              </View>

              <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.modalUser}>
                  <Image source={{ uri: avatarUrl }} style={styles.modalAvatar} />
                  <View>
                    <Text style={styles.modalUserName}>{userName}</Text>
                    <Text style={styles.modalDate}>{formatFullDate(dream.dream_date)} • {formatTime(dream.created_at)}</Text>
                  </View>
                </View>

                {dream.title && <Text style={styles.modalTitle}>{dream.title}</Text>}
                {dream.content && <Text style={styles.modalContentText}>{dream.content}</Text>}

                {dream.audio_url && (
                  <View style={styles.modalAudio}>
                    <TouchableOpacity
                      style={[styles.modalPlayBtn, isPlaying && styles.modalPlayBtnActive]}
                      onPress={() => playAudio(dream, 'modal')}
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
        </View>
      </Modal>
    );
  }, [selectedDream, modalVisible, playingId, playingContext, status, isAudioLoading]);

  // Feed Content
  const FeedContent = () => {
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
        renderItem={({ item }) => <FeedDreamCard item={item} onPress={() => openDreamModal(item)} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.feedList}
        refreshing={feedLoading}
        onRefresh={fetchFeedDreams}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  // Journal Content
  const JournalContent = () => {
    if (myDreamsLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.gold} />
          <Text style={styles.loadingText}>Loading your journal...</Text>
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
        <ScrollView style={styles.journalScrollEmpty} contentContainerStyle={styles.emptyJournal}>
          <View style={styles.emptyJournalIcon}>
            <Ionicons name="book-outline" size={64} color={theme.gold} />
          </View>
          <Text style={styles.emptyJournalTitle}>Your Dream Journal</Text>
          <Text style={styles.emptyJournalText}>
            Start capturing your dreams to unlock insights about your subconscious mind.
            Recording dreams regularly can help you remember them better and discover patterns.
          </Text>

          <View style={styles.emptyBenefits}>
            <View style={styles.benefitItem}>
              <Ionicons name="sparkles" size={20} color={theme.gold} />
              <Text style={styles.benefitText}>Improve dream recall</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="analytics-outline" size={20} color={theme.primary} />
              <Text style={styles.benefitText}>Discover patterns</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="bulb-outline" size={20} color={theme.purple} />
              <Text style={styles.benefitText}>Gain insights</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.emptyRecordBtn} onPress={() => navigation.navigate('RecordDream')}>
            <LinearGradient colors={[theme.gold, '#b8962e']} style={styles.emptyRecordGradient}>
              <Ionicons name="mic" size={20} color="#fff" />
              <Text style={styles.emptyRecordText}>Record Your First Dream</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    return (
      <View style={styles.journalContainer}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <StatsCard icon="book" label="Total" value={journalStats.total} color={theme.primary} />
          <StatsCard icon="flame" label="Streak" value={`${journalStats.streak}d`} color={theme.gold} />
          <StatsCard icon="calendar" label="This Month" value={journalStats.thisMonth} color={theme.purple} />
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={theme.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your dreams..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Month Filter */}
        {journalStats.months.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthFilter} contentContainerStyle={styles.monthFilterContent}>
            <TouchableOpacity
              style={[styles.monthPill, !selectedMonth && styles.monthPillActive]}
              onPress={() => setSelectedMonth(null)}
            >
              <Text style={[styles.monthPillText, !selectedMonth && styles.monthPillTextActive]}>All</Text>
            </TouchableOpacity>
            {journalStats.months.slice(0, 6).map((month) => {
              const [year, m] = month.split('-');
              const label = new Date(parseInt(year), parseInt(m) - 1).toLocaleDateString('en-US', { month: 'short' });
              return (
                <TouchableOpacity
                  key={month}
                  style={[styles.monthPill, selectedMonth === month && styles.monthPillActive]}
                  onPress={() => setSelectedMonth(selectedMonth === month ? null : month)}
                >
                  <Text style={[styles.monthPillText, selectedMonth === month && styles.monthPillTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Section List */}
        {groupedDreams.length === 0 ? (
          <View style={styles.noResults}>
            <Ionicons name="search-outline" size={32} color={theme.textMuted} />
            <Text style={styles.noResultsText}>No dreams found</Text>
          </View>
        ) : (
          <SectionList
            sections={groupedDreams}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <JournalEntryCard item={item} onPress={() => openDreamModal(item)} />}
            renderSectionHeader={({ section: { title } }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{title}</Text>
              </View>
            )}
            contentContainerStyle={styles.journalList}
            stickySectionHeadersEnabled={false}
            refreshing={myDreamsLoading}
            onRefresh={fetchMyDreams}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
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
              <Text style={[styles.tabText, activeTab === 1 && styles.tabActiveGold]}>Journal</Text>
              {activeTab === 1 && <View style={[styles.tabDot, styles.tabDotGold]} />}
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
          <View key="feed" style={styles.page}>{FeedContent()}</View>
          <View key="journal" style={styles.page}>{JournalContent()}</View>
        </PagerView>

        {/* Bottom Nav */}
        <View style={styles.bottomNavContainer}>
          <View style={styles.bottomNav}>
            <TouchableOpacity style={styles.navBtn} onPress={handleCirclesPress} activeOpacity={0.7}>
              <View style={styles.navBtnInner}>
                <Ionicons name="people-outline" size={20} color={theme.textPrimary} />
                <Text style={styles.navBtnText}>Circles</Text>
              </View>
            </TouchableOpacity>

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

      {DreamModal}
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
    gap: 28,
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
  tabActiveGold: {
    color: theme.gold,
  },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.primary,
    marginTop: 4,
  },
  tabDotGold: {
    backgroundColor: theme.gold,
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

  // Feed
  feedList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 140,
  },
  feedCard: {
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
  feedCardHeader: {
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

  // Journal
  journalContainer: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.glass,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: theme.textSubtle,
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.glass,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.textPrimary,
    marginLeft: 8,
  },
  monthFilter: {
    marginTop: 12,
    maxHeight: 36,
  },
  monthFilterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  monthPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  monthPillActive: {
    backgroundColor: theme.glowGold,
    borderColor: theme.gold + '50',
  },
  monthPillText: {
    fontSize: 13,
    color: theme.textSubtle,
    fontWeight: '500',
  },
  monthPillTextActive: {
    color: theme.gold,
  },
  journalList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 140,
  },
  sectionHeader: {
    paddingVertical: 8,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  journalCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.glass,
    borderRadius: 16,
    marginBottom: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  journalCardActive: {
    borderColor: theme.gold + '50',
    backgroundColor: theme.glowGold,
  },
  journalTimeCol: {
    alignItems: 'center',
    marginRight: 12,
    width: 56,
  },
  journalDateLabel: {
    fontSize: 10,
    color: theme.textSubtle,
    fontWeight: '600',
    textAlign: 'center',
  },
  journalTimeLabel: {
    fontSize: 11,
    color: theme.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  journalTimeLine: {
    width: 2,
    height: 30,
    backgroundColor: theme.glassBorder,
    marginTop: 8,
    borderRadius: 1,
  },
  journalContent: {
    flex: 1,
  },
  journalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  journalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  journalTitleMuted: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textMuted,
    fontStyle: 'italic',
    flex: 1,
  },
  journalBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  journalBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.glowBlue,
  },
  badgePublic: {
    backgroundColor: theme.glowBlue,
  },
  badgePrivate: {
    backgroundColor: theme.glowGold,
  },
  journalExcerpt: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  journalAudio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  journalPlayBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  journalPlayBtnActive: {
    backgroundColor: theme.gold,
  },
  journalProgressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  journalProgressFill: {
    height: '100%',
    backgroundColor: theme.gold,
  },
  journalDuration: {
    fontSize: 10,
    color: theme.textMuted,
    fontVariant: ['tabular-nums'],
    width: 32,
    textAlign: 'right',
  },
  journalChevron: {
    marginLeft: 8,
    alignSelf: 'center',
  },
  noResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  noResultsText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.textMuted,
  },

  // Empty Journal
  journalScrollEmpty: {
    flex: 1,
  },
  emptyJournal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 100,
  },
  emptyJournalIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.glowGold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyJournalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 12,
  },
  emptyJournalText: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyBenefits: {
    width: '100%',
    gap: 12,
    marginBottom: 32,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.glass,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  benefitText: {
    fontSize: 14,
    color: theme.textPrimary,
    fontWeight: '500',
  },
  emptyRecordBtn: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  emptyRecordGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  emptyRecordText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalWrap: {
    flex: 1,
    marginTop: 40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
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
    width: 44,
    alignItems: 'center',
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
  modalContentText: {
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