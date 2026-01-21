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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useFocusEffect } from '@react-navigation/native';
import PagerView from 'react-native-pager-view';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import GlassCard from '../components/GlassCard';
import PillButton from '../components/PillButton';

const { width } = Dimensions.get('window');

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
  danger: '#ef4444',
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
  dream_date: string;
  created_at: string;
  profiles?: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export default function MainScreen({ navigation }: any) {
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState(0);
  const [feedDreams, setFeedDreams] = useState<Dream[]>([]);
  const [myDreams, setMyDreams] = useState<Dream[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [myDreamsLoading, setMyDreamsLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [myDreamsError, setMyDreamsError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  
  const pagerRef = useRef<PagerView>(null);
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;
  const currentAudioUrl = useRef<string | null>(null);
  
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  const userAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.email || 'U')}&background=1e293b&color=60a5fa&size=64`;

  // Fetch data when screen focuses
  useFocusEffect(
    useCallback(() => {
      fetchFeedDreams();
      fetchMyDreams();
      return () => {
        player.pause();
        resetAudioState();
      };
    }, [])
  );

  // Handle audio completion
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
        .select(`
          *,
          profiles!dreams_user_id_fkey (
            display_name,
            avatar_url
          )
        `)
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFeedDreams(data || []);
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
        .select('*')
        .eq('user_id', user.id)
        .order('dream_date', { ascending: false });

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

    // Toggle play/pause for same dream
    if (playingId === dream.id) {
      if (status.playing) {
        player.pause();
      } else {
        player.play();
      }
      return;
    }

    setIsAudioLoading(true);

    // Stop current audio
    if (playingId) {
      player.pause();
    }

    try {
      let audioUrl = dream.audio_url;
      
      // Get signed URL for private dreams
      if (!dream.is_public && dream.user_id === user?.id) {
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
      console.error('Audio error:', error);
      resetAudioState();
    } finally {
      setIsAudioLoading(false);
    }
  };

  const deleteDream = async (dreamId: string) => {
    try {
      await supabase.from('dreams').delete().eq('id', dreamId);
      setMyDreams(prev => prev.filter(d => d.id !== dreamId));
      if (playingId === dreamId) {
        player.pause();
        resetAudioState();
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
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

  // Handle page change from swipe
  const onPageSelected = (e: any) => {
    const position = e.nativeEvent.position;
    setActiveTab(position);
    Animated.spring(tabIndicatorAnim, {
      toValue: position,
      useNativeDriver: true,
      tension: 68,
      friction: 12,
    }).start();
  };

  // Handle tab press
  const switchTab = (index: number) => {
    pagerRef.current?.setPage(index);
  };

  // Tab indicator animation
  const tabIndicatorTranslate = tabIndicatorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 84],
  });

  // Error State Component
  const ErrorState = ({ message, onRetry, type }: { message: string; onRetry: () => void; type: 'feed' | 'mine' }) => (
    <View style={styles.stateContainer}>
      <Text style={styles.stateIcon}>⚠️</Text>
      <Text style={styles.stateTitle}>Connection Issue</Text>
      <Text style={styles.stateSubtitle}>{message}</Text>
      <View style={styles.stateActions}>
        <PillButton title="Try Again" onPress={onRetry} variant="primary" size="medium" />
        {type === 'feed' && (
          <PillButton 
            title="Invite Friends" 
            onPress={() => {}} 
            variant="glass" 
            size="medium"
            style={{ marginTop: 12 }}
          />
        )}
      </View>
    </View>
  );

  // Empty State Component
  const EmptyState = ({ type }: { type: 'feed' | 'mine' }) => (
    <View style={styles.stateContainer}>
      <Text style={styles.stateIcon}>{type === 'feed' ? '🌙' : '💭'}</Text>
      <Text style={styles.stateTitle}>
        {type === 'feed' ? 'No dreams in the feed yet' : 'No dreams recorded yet'}
      </Text>
      <Text style={styles.stateSubtitle}>
        {type === 'feed' 
          ? 'Be the first to share a dream with the community' 
          : 'Start capturing your dreams by tapping Record below'}
      </Text>
      <View style={styles.stateActions}>
        <PillButton 
          title={type === 'feed' ? 'Share a Dream' : 'Record Your First Dream'} 
          onPress={() => navigation.navigate('RecordDream')} 
          variant="primary" 
          size="medium"
          icon="●"
        />
        {type === 'feed' && (
          <PillButton 
            title="Invite Friends" 
            onPress={() => {}} 
            variant="glass" 
            size="medium"
            style={{ marginTop: 12 }}
          />
        )}
      </View>
    </View>
  );

  // Dream Card Component
  const DreamCard = ({ item, showDelete = false }: { item: Dream; showDelete?: boolean }) => {
    const isPlaying = playingId === item.id && status.playing;
    const isThisDream = playingId === item.id;
    const isLoadingThis = isAudioLoading && !playingId;
    const isMine = item.user_id === user?.id;

    const progressPercent = isThisDream && status.duration > 0 
      ? Math.min(100, (status.currentTime / status.duration) * 100)
      : 0;

    const userName = item.profiles?.display_name || (isMine ? 'You' : 'Dreamer');
    const avatarUrl = item.profiles?.avatar_url || 
      `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=1e293b&color=60a5fa&size=64`;

    return (
      <GlassCard style={styles.dreamCard} glow={isPlaying ? 'blue' : 'none'}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.userRow}>
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{userName}</Text>
              <Text style={styles.dreamDate}>{formatDate(item.dream_date)}</Text>
            </View>
          </View>
          {showDelete && (
            <View style={[styles.badge, item.is_public ? styles.badgePublic : styles.badgePrivate]}>
              <Text style={styles.badgeText}>{item.is_public ? 'Public' : 'Private'}</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <Text style={styles.dreamTitle}>{item.title || 'Untitled Dream'}</Text>
        {item.content && (
          <Text style={styles.dreamContent} numberOfLines={3}>{item.content}</Text>
        )}

        {/* Audio Player */}
        {item.audio_url && (
          <View style={styles.audioSection}>
            <View style={styles.audioControls}>
              <PillButton
                title={isPlaying ? 'Pause' : 'Play'}
                icon={isPlaying ? '❚❚' : '▶'}
                onPress={() => playAudio(item)}
                variant={isPlaying ? 'primary' : 'glass'}
                size="small"
                loading={isLoadingThis && playingId === item.id}
              />
              
              {isThisDream && (
                <Text style={styles.timeDisplay}>
                  {formatTime(status.currentTime)} / {formatTime(status.duration)}
                </Text>
              )}
              
              {showDelete && (
                <TouchableOpacity 
                  onPress={() => deleteDream(item.id)} 
                  style={styles.deleteBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>

            {isThisDream && (
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
              </View>
            )}
          </View>
        )}

        {/* Delete button when no audio */}
        {!item.audio_url && showDelete && (
          <TouchableOpacity 
            onPress={() => deleteDream(item.id)} 
            style={styles.deleteBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        )}
      </GlassCard>
    );
  };

  // Feed Content
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
      return <ErrorState message={feedError} onRetry={fetchFeedDreams} type="feed" />;
    }

    if (feedDreams.length === 0) {
      return <EmptyState type="feed" />;
    }

    return (
      <FlatList
        data={feedDreams}
        renderItem={({ item }) => <DreamCard item={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={feedLoading}
        onRefresh={fetchFeedDreams}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  // My Dreams Content
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
      return <ErrorState message={myDreamsError} onRetry={fetchMyDreams} type="mine" />;
    }

    if (myDreams.length === 0) {
      return <EmptyState type="mine" />;
    }

    return (
      <FlatList
        data={myDreams}
        renderItem={({ item }) => <DreamCard item={item} showDelete />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={myDreamsLoading}
        onRefresh={fetchMyDreams}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  return (
    <LinearGradient
      colors={[theme.backgroundGradientStart, theme.backgroundGradientEnd]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>Àlá</Text>
          
          {/* Swipeable Pill Tabs */}
          <View style={styles.tabContainer}>
            <BlurView intensity={40} tint="dark" style={styles.tabBlur}>
              <View style={styles.tabInner}>
                {/* Animated Indicator */}
                <Animated.View 
                  style={[
                    styles.tabIndicator,
                    { transform: [{ translateX: tabIndicatorTranslate }] }
                  ]} 
                />
                
                <TouchableOpacity
                  style={styles.tab}
                  onPress={() => switchTab(0)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabText, activeTab === 0 && styles.tabTextActive]}>
                    Feed
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.tab}
                  onPress={() => switchTab(1)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabText, activeTab === 1 && styles.tabTextActive]}>
                    My Dreams
                  </Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </View>

          {/* Profile Avatar */}
          <TouchableOpacity 
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.8}
          >
            <Image source={{ uri: userAvatar }} style={styles.profileAvatar} />
          </TouchableOpacity>
        </View>

        {/* Swipeable Pages */}
        <PagerView
          ref={pagerRef}
          style={styles.pagerView}
          initialPage={0}
          onPageSelected={onPageSelected}
        >
          <View key="feed" style={styles.page}>
            <FeedContent />
          </View>
          <View key="mine" style={styles.page}>
            <MyDreamsContent />
          </View>
        </PagerView>

        {/* Floating Buttons */}
        <View style={styles.floatingButtons}>
          <PillButton
            title="Circles"
            icon="+"
            onPress={() => {}}
            variant="glass"
            size="medium"
          />
          <PillButton
            title="Record"
            icon="●"
            onPress={() => navigation.navigate('RecordDream')}
            variant="primary"
            size="large"
          />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  logo: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.textPrimary,
    letterSpacing: -1,
  },
  tabContainer: {
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  tabBlur: {
    overflow: 'hidden',
  },
  tabInner: {
    flexDirection: 'row',
    backgroundColor: theme.glass,
    position: 'relative',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    left: 0,
    width: 76,
    height: 36,
    backgroundColor: 'rgba(96, 165, 250, 0.25)',
    borderRadius: 20,
  },
  tab: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    zIndex: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSubtle,
  },
  tabTextActive: {
    color: theme.primary,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: theme.glassBorder,
  },
  pagerView: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    paddingTop: 8,
  },
  dreamCard: {
    marginBottom: 16,
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
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: theme.glass,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  dreamDate: {
    fontSize: 13,
    color: theme.textSubtle,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgePublic: {
    backgroundColor: theme.glowBlue,
  },
  badgePrivate: {
    backgroundColor: theme.glowGold,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  dreamTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  dreamContent: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 21,
    marginBottom: 12,
  },
  audioSection: {
    marginTop: 8,
  },
  audioControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeDisplay: {
    fontSize: 13,
    color: theme.textSecondary,
    fontVariant: ['tabular-nums'],
    flex: 1,
  },
  deleteBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  deleteText: {
    fontSize: 14,
    color: theme.danger,
    fontWeight: '500',
  },
  progressBar: {
    marginTop: 14,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.gold,
    borderRadius: 2,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: theme.textSubtle,
    fontSize: 14,
  },
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  stateIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  stateTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  stateSubtitle: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  stateActions: {
    alignItems: 'center',
  },
  floatingButtons: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});