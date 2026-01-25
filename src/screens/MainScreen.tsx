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
  Easing,
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

const AMBIENT_GRADIENTS: readonly [string, string, string][] = [
  ['#050a15', '#0a1628', '#0f172a'],
  ['#0a0f1a', '#121a2e', '#1a2744'],
  ['#0d0a15', '#1a1428', '#261e3d'],
  ['#0a1210', '#122420', '#1a3530'],
  ['#100a0a', '#201414', '#301e1e'],
  ['#0a0d14', '#141e2d', '#1e2e45'],
];

const GRADIENT_INTERVAL = 14000;

// Animated Glowing Star Component
const GlowingStar = () => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.7)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.3,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.7,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();
    return () => pulseAnimation.stop();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.glowingStar,
        {
          transform: [{ scale: scaleAnim }, { rotate: spin }],
          opacity: opacityAnim,
        },
      ]}
    >
      <Ionicons name="sparkles" size={12} color={theme.gold} />
    </Animated.View>
  );
};

// Animated Background Component
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
      <LinearGradient
        colors={AMBIENT_GRADIENTS[nextIndex]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={AMBIENT_GRADIENTS[currentIndex]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>
      {children}
    </View>
  );
};

// Custom Coming Soon Modal
const ComingSoonModal = ({ 
  visible, 
  onClose, 
  feature 
}: { 
  visible: boolean; 
  onClose: () => void; 
  feature: string;
}) => {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.comingSoonOverlay} onPress={onClose}>
        <Animated.View
          style={[
            styles.comingSoonContent,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={[theme.backgroundGradientStart, theme.backgroundGradientEnd]}
            style={styles.comingSoonGradient}
          >
            <View style={styles.comingSoonIconWrap}>
              <LinearGradient
                colors={[theme.gold + '40', theme.gold + '10']}
                style={styles.comingSoonIconBg}
              >
                <Ionicons name="sparkles" size={32} color={theme.gold} />
              </LinearGradient>
            </View>
            <Text style={styles.comingSoonTitle}>Coming Soon</Text>
            <Text style={styles.comingSoonFeature}>{feature}</Text>
            <Text style={styles.comingSoonDesc}>
              We're crafting something special. Stay tuned for updates!
            </Text>
            <TouchableOpacity style={styles.comingSoonBtn} onPress={onClose}>
              <LinearGradient
                colors={[theme.gold, '#b8962e']}
                style={styles.comingSoonBtnGradient}
              >
                <Text style={styles.comingSoonBtnText}>Got it</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </Modal>
  );
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
  isLiked?: boolean;
  authorProfile?: UserProfile | null;
}

interface UserProfile {
  id: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  is_public?: boolean;
}

interface DreamSection {
  title: string;
  data: DreamWithMeta[];
}

interface Interpretation {
  id: string;
  dream_id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id?: string | null;
  author?: UserProfile;
  replies?: Interpretation[];
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
  
  // User profile
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  // Notifications
  const [hasNotifications, setHasNotifications] = useState(false);
  
  // Coming Soon Modal
  const [comingSoonVisible, setComingSoonVisible] = useState(false);
  const [comingSoonFeature, setComingSoonFeature] = useState('');
  
  // Audio state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingContext, setPlayingContext] = useState<AudioContext | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState<string | null>(null);
  
  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDream, setSelectedDream] = useState<DreamWithMeta | null>(null);
  const [interpretations, setInterpretations] = useState<Interpretation[]>([]);
  const [interpretationsLoading, setInterpretationsLoading] = useState(false);
  
  // Journal filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const pagerRef = useRef<PagerView>(null);
  const currentAudioUrl = useRef<string | null>(null);

  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  // Fetch user profile
  const fetchUserProfile = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, is_public')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  // Check for notifications
  const checkNotifications = async () => {
    if (!user?.id) return;
    
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);
      
      if (!error) {
        setHasNotifications((count || 0) > 0);
      }
    } catch (error) {
      console.error('Error checking notifications:', error);
    }
  };

  // Get user avatar URL
  const getUserAvatarUrl = () => {
    if (userProfile?.avatar_url) {
      // If it's a Supabase storage URL
      if (userProfile.avatar_url.startsWith('http')) {
        return userProfile.avatar_url;
      }
      // Generate signed URL for private storage
      return userProfile.avatar_url;
    }
    // Fallback to generated avatar
    const displayName = userProfile?.display_name || userProfile?.username || user?.email || 'U';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1e293b&color=60a5fa&size=128`;
  };

  useFocusEffect(
    useCallback(() => {
      fetchUserProfile();
      checkNotifications();
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
          let isLiked = false;
          let authorProfile: UserProfile | null = null;

          // Fetch author profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url, is_public')
            .eq('id', dream.user_id)
            .single();
          
          authorProfile = profile;

          if (dream.enable_engagement) {
            const { count: likes } = await supabase
              .from('dream_likes')
              .select('*', { count: 'exact', head: true })
              .eq('dream_id', dream.id);
            likeCount = likes || 0;

            // Check if current user liked
            if (user?.id) {
              const { data: userLike } = await supabase
                .from('dream_likes')
                .select('id')
                .eq('dream_id', dream.id)
                .eq('user_id', user.id)
                .single();
              isLiked = !!userLike;
            }
          }

          if (dream.interpretation_mode && dream.interpretation_mode !== 'disabled') {
            const { count: interpretations } = await supabase
              .from('interpretations')
              .select('*', { count: 'exact', head: true })
              .eq('dream_id', dream.id);
            interpretationCount = interpretations || 0;
          }

          return { ...dream, likeCount, interpretationCount, isLiked, authorProfile };
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

  // Fetch interpretations for a dream (threaded)
  const fetchInterpretations = async (dreamId: string) => {
    setInterpretationsLoading(true);
    try {
      const { data, error } = await supabase
        .from('interpretations')
        .select('id, dream_id, user_id, content, created_at, parent_id')
        .eq('dream_id', dreamId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch author profiles
      const withAuthors = await Promise.all(
        (data || []).map(async (interp) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url, is_public')
            .eq('id', interp.user_id)
            .single();
          // If profile is null, set author as undefined
          return { ...interp, author: profile ?? undefined };
        })
      );

      // Build thread structure
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

      // Attach replies to parents
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

  // Like/unlike a dream
  const toggleLike = async (dream: DreamWithMeta) => {
    if (!user?.id || !dream.enable_engagement) return;

    try {
      if (dream.isLiked) {
        await supabase
          .from('dream_likes')
          .delete()
          .eq('dream_id', dream.id)
          .eq('user_id', user.id);

        setFeedDreams((prev) =>
          prev.map((d) =>
            d.id === dream.id
              ? { ...d, isLiked: false, likeCount: (d.likeCount || 1) - 1 }
              : d
          )
        );
      } else {
        await supabase
          .from('dream_likes')
          .insert({ dream_id: dream.id, user_id: user.id });

        setFeedDreams((prev) =>
          prev.map((d) =>
            d.id === dream.id
              ? { ...d, isLiked: true, likeCount: (d.likeCount || 0) + 1 }
              : d
          )
        );
      }

      // Update selected dream if modal is open
      if (selectedDream?.id === dream.id) {
        setSelectedDream((prev) =>
          prev
            ? {
                ...prev,
                isLiked: !prev.isLiked,
                likeCount: prev.isLiked
                  ? (prev.likeCount || 1) - 1
                  : (prev.likeCount || 0) + 1,
              }
            : null
        );
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const resetAudioState = () => {
    setPlayingId(null);
    setPlayingContext(null);
    currentAudioUrl.current = null;
    setIsAudioLoading(null);
  };

  const playAudio = async (dream: Dream, context: AudioContext) => {
    if (!dream.audio_url) return;

    if (playingId === dream.id && playingContext === context) {
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

  const openDreamModal = useCallback((dream: DreamWithMeta) => {
    setSelectedDream(dream);
    if (dream.interpretation_mode && dream.interpretation_mode !== 'disabled') {
      fetchInterpretations(dream.id);
    }
    requestAnimationFrame(() => {
      setModalVisible(true);
    });
  }, []);

  const closeDreamModal = useCallback(() => {
    setModalVisible(false);
    setTimeout(() => {
      setSelectedDream(null);
      setInterpretations([]);
    }, 300);
  }, []);

  const showComingSoon = (feature: string) => {
    setComingSoonFeature(feature);
    setComingSoonVisible(true);
  };

  const navigateToProfile = (profile: UserProfile | null, userId: string) => {
    if (!profile?.is_public && userId !== user?.id) {
      showComingSoon('Private Profile');
      return;
    }
    navigation.navigate('ViewProfile', { userId });
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
    showComingSoon('Dream Circles');
  };

  const isPlayingInContext = (dreamId: string, context: AudioContext) => {
    return playingId === dreamId && playingContext === context && status.playing;
  };

  const isThisDreamInContext = (dreamId: string, context: AudioContext) => {
    return playingId === dreamId && playingContext === context;
  };

  const getAvatarUrl = (profile: UserProfile | null, fallbackName: string) => {
    if (profile?.avatar_url && profile.avatar_url.startsWith('http')) {
      return profile.avatar_url;
    }
    const name = profile?.display_name || profile?.username || fallbackName;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=60a5fa&size=64`;
  };

  // Animated Star Like Button
  const StarLikeButton = ({ isLiked, count, onPress, disabled }: { isLiked: boolean; count: number; onPress: () => void; disabled?: boolean }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const fillAnim = useRef(new Animated.Value(isLiked ? 1 : 0)).current;

    useEffect(() => {
      Animated.timing(fillAnim, {
        toValue: isLiked ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }, [isLiked]);

    const handlePress = () => {
      if (disabled) return;
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.3,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
      onPress();
    };

    const starColor = fillAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [theme.textMuted, theme.gold],
    });

    return (
      <TouchableOpacity
        style={styles.starLikeBtn}
        onPress={handlePress}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Ionicons
            name={isLiked ? 'star' : 'star-outline'}
            size={18}
            color={isLiked ? theme.gold : theme.textMuted}
          />
        </Animated.View>
        {count > 0 && <Text style={[styles.starCount, isLiked && styles.starCountActive]}>{count}</Text>}
      </TouchableOpacity>
    );
  };

  // Feed Dream Card with transparent design
  const FeedDreamCard = React.memo(({ item, onPress }: { item: DreamWithMeta; onPress: () => void }) => {
    const [isPressed, setIsPressed] = useState(false);
    const isPlaying = isPlayingInContext(item.id, 'feed');
    const isThisPlaying = isThisDreamInContext(item.id, 'feed');
    const isLoading = isAudioLoading === item.id;
    const isMine = item.user_id === user?.id;
    const hasAudio = !!item.audio_url;
    const hasContent = !!item.content;

    const userName = isMine ? 'You' : item.authorProfile?.display_name || item.authorProfile?.username || 'Dreamer';
    const avatarUrl = getAvatarUrl(item.authorProfile || null, userName);

    const progressPercent = isThisPlaying && status.duration > 0
      ? Math.min(100, (status.currentTime / status.duration) * 100)
      : 0;

    const scaleAnim = useRef(new Animated.Value(1)).current;
    const borderOpacity = useRef(new Animated.Value(0)).current;

    const handlePressIn = () => {
      setIsPressed(true);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }),
        Animated.timing(borderOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    };

    const handlePressOut = () => {
      setIsPressed(false);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }),
        Animated.timing(borderOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    };

    const canInterpret = item.interpretation_mode && item.interpretation_mode !== 'disabled';

    return (
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View
          style={[
            styles.feedCardTransparent,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Border that shows on press */}
          <Animated.View
            style={[
              styles.feedCardBorder,
              { opacity: borderOpacity },
            ]}
          />

          <View style={styles.feedCardContent}>
            <View style={styles.feedCardHeader}>
              <TouchableOpacity
                style={styles.userRow}
                onPress={() => navigateToProfile(item.authorProfile || null, item.user_id)}
                activeOpacity={0.7}
              >
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                <View>
                  <Text style={styles.userName}>{userName}</Text>
                  <Text style={styles.dateText}>{formatDate(item.dream_date)}</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.cardBody}>
              {item.title && <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>}
              {hasContent && <Text style={styles.cardExcerpt} numberOfLines={2}>{item.content}</Text>}
              {!hasContent && !hasAudio && <Text style={styles.cardExcerptMuted}>No content yet</Text>}
            </View>

            {hasAudio && (
              <View style={styles.audioPlayerTransparent}>
                <TouchableOpacity
                  style={[styles.playBtnTransparent, isPlaying && styles.playBtnActive]}
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
                  <View style={styles.progressTrackTransparent}>
                    <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                  </View>
                </View>
                <Text style={styles.durationText}>
                  {isThisPlaying ? formatDuration(status.currentTime) : formatDuration(status.duration || 0)}
                </Text>
              </View>
            )}

            <View style={styles.cardFooterTransparent}>
              <View style={styles.engagementRow}>
                {/* Star Like Button */}
                {item.enable_engagement && (
                  <StarLikeButton
                    isLiked={item.isLiked || false}
                    count={item.likeCount || 0}
                    onPress={() => toggleLike(item)}
                  />
                )}

                {/* Interpret Button */}
                {canInterpret && (
                  <TouchableOpacity
                    style={styles.interpretBtn}
                    onPress={onPress}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="pencil-outline" size={14} color={theme.gold} />
                    <Text style={styles.interpretText}>interpret</Text>
                  </TouchableOpacity>
                )}
              </View>

              {(item.interpretationCount ?? 0) > 0 && (
                <View style={styles.threadIndicator}>
                  <Ionicons name="chatbubbles-outline" size={14} color={theme.textSubtle} />
                  <Text style={styles.threadCount}>{item.interpretationCount}</Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      </Pressable>
    );
  });

  // Journal Entry Card
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
          <View style={styles.journalTimeCol}>
            <Text style={styles.journalDateLabel}>{formatJournalDate(item.dream_date)}</Text>
            <Text style={styles.journalTimeLabel}>{formatTime(item.created_at)}</Text>
            <View style={styles.journalTimeLine} />
          </View>

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

  // Interpretation Thread Item
  const InterpretationThread = ({ interpretation, depth = 0 }: { interpretation: Interpretation; depth?: number }) => {
    const avatarUrl = getAvatarUrl(interpretation.author || null, 'User');
    const displayName = interpretation.author?.display_name || interpretation.author?.username || 'Anonymous';

    return (
      <View style={[styles.threadItem, { marginLeft: depth * 16 }]}>
        {depth > 0 && <View style={styles.threadLine} />}
        <LinearGradient
          colors={depth === 0 
            ? ['rgba(212, 175, 55, 0.1)', 'rgba(212, 175, 55, 0.02)']
            : ['rgba(96, 165, 250, 0.08)', 'rgba(96, 165, 250, 0.02)']}
          style={styles.threadContent}
        >
          <TouchableOpacity
            style={styles.threadHeader}
            onPress={() => navigateToProfile(interpretation.author || null, interpretation.user_id)}
            activeOpacity={0.7}
          >
            <Image source={{ uri: avatarUrl }} style={styles.threadAvatar} />
            <View style={styles.threadMeta}>
              <Text style={styles.threadAuthor}>{displayName}</Text>
              <Text style={styles.threadTime}>{formatDate(interpretation.created_at)}</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.threadText}>{interpretation.content}</Text>
        </LinearGradient>
        {interpretation.replies?.map((reply) => (
          <InterpretationThread key={reply.id} interpretation={reply} depth={depth + 1} />
        ))}
      </View>
    );
  };

  // Dream Modal
  const DreamModal = useMemo(() => {
    if (!selectedDream) return null;

    const dream = selectedDream;
    const isPlaying = isPlayingInContext(dream.id, 'modal');
    const isThisDream = isThisDreamInContext(dream.id, 'modal');
    const isMine = dream.user_id === user?.id;
    const progressPercent = isThisDream && status.duration > 0
      ? Math.min(100, (status.currentTime / status.duration) * 100)
      : 0;

    const userName = isMine ? 'You' : dream.authorProfile?.display_name || dream.authorProfile?.username || 'Dreamer';
    const avatarUrl = getAvatarUrl(dream.authorProfile || null, userName);

    const canInterpret = dream.interpretation_mode && dream.interpretation_mode !== 'disabled';
    const showThread = canInterpret && interpretations.length > 0;

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
                <TouchableOpacity
                  style={styles.modalUser}
                  onPress={() => navigateToProfile(dream.authorProfile || null, dream.user_id)}
                  activeOpacity={0.7}
                >
                  <Image source={{ uri: avatarUrl }} style={styles.modalAvatar} />
                  <View>
                    <Text style={styles.modalUserName}>{userName}</Text>
                    <Text style={styles.modalDate}>{formatFullDate(dream.dream_date)} • {formatTime(dream.created_at)}</Text>
                  </View>
                </TouchableOpacity>

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

                {(dream.enable_engagement || canInterpret) && (
                  <View style={styles.modalEngagement}>
                    {dream.enable_engagement && (
                      <TouchableOpacity
                        style={[styles.modalEngageBtn, dream.isLiked && styles.modalEngageBtnActive]}
                        onPress={() => toggleLike(dream)}
                      >
                        <Ionicons
                          name={dream.isLiked ? 'star' : 'star-outline'}
                          size={22}
                          color={dream.isLiked ? theme.gold : theme.textMuted}
                        />
                        <Text style={[styles.modalEngageText, dream.isLiked && styles.modalEngageTextActive]}>
                          {dream.likeCount || 0}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {canInterpret && (
                      <TouchableOpacity
                        style={styles.modalEngageBtn}
                        onPress={() => showComingSoon('Add Interpretation')}
                      >
                        <Ionicons name="pencil-outline" size={22} color={theme.gold} />
                        <Text style={styles.modalEngageText}>Interpret</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Thread Section */}
                {showThread && (
                  <View style={styles.threadSection}>
                    <View style={styles.threadSectionHeader}>
                      <Ionicons name="chatbubbles" size={18} color={theme.gold} />
                      <Text style={styles.threadSectionTitle}>Interpretations</Text>
                      <Text style={styles.threadSectionCount}>{interpretations.length}</Text>
                    </View>
                    {interpretationsLoading ? (
                      <ActivityIndicator size="small" color={theme.gold} style={{ marginTop: 16 }} />
                    ) : (
                      interpretations.map((interp) => (
                        <InterpretationThread key={interp.id} interpretation={interp} />
                      ))
                    )}
                  </View>
                )}
              </ScrollView>
            </LinearGradient>
          </SafeAreaView>
        </View>
      </Modal>
    );
  }, [selectedDream, modalVisible, playingId, playingContext, status, isAudioLoading, interpretations, interpretationsLoading]);

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
        <View style={styles.statsRow}>
          <StatsCard icon="book" label="Total" value={journalStats.total} color={theme.primary} />
          <StatsCard icon="flame" label="Streak" value={`${journalStats.streak}d`} color={theme.gold} />
          <StatsCard icon="calendar" label="This Month" value={journalStats.thisMonth} color={theme.purple} />
        </View>

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
    <AnimatedGradientBackground>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
            <Image source={{ uri: getUserAvatarUrl() }} style={styles.headerAvatar} />
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

          {/* Notification icon with animated star */}
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.notificationBtn}>
            <Ionicons name="notifications-outline" size={22} color={theme.textPrimary} />
            {hasNotifications && <GlowingStar />}
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
      <ComingSoonModal
        visible={comingSoonVisible}
        onClose={() => setComingSoonVisible(false)}
        feature={comingSoonFeature}
      />
    </AnimatedGradientBackground>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  safeArea: { flex: 1 },

  // Glowing Star
  glowingStar: {
    position: 'absolute',
    top: -4,
    right: -4,
  },

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
  notificationBtn: {
    position: 'relative',
    padding: 4,
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

  // Transparent Feed Card
  feedCardTransparent: {
    marginBottom: 20,
    borderRadius: 20,
    position: 'relative',
  },
  feedCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  feedCardContent: {
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
  audioPlayerTransparent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
    marginBottom: 12,
  },
  playBtnTransparent: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtnActive: {
    backgroundColor: theme.primary,
  },
  progressWrap: {
    flex: 1,
  },
  progressTrackTransparent: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
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
  cardFooterTransparent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  
  // Star Like Button
  starLikeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  starCount: {
    fontSize: 13,
    color: theme.textMuted,
    fontWeight: '500',
  },
  starCountActive: {
    color: theme.gold,
  },

  // Interpret Button
  interpretBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  interpretText: {
    fontSize: 12,
    color: theme.gold,
    fontWeight: '500',
    fontStyle: 'italic',
  },

  threadIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  threadCount: {
    fontSize: 12,
    color: theme.textSubtle,
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
    marginBottom: 24,
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
  modalEngageBtnActive: {
    backgroundColor: theme.glowGold,
    borderColor: theme.gold + '30',
  },
  modalEngageText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  modalEngageTextActive: {
    color: theme.gold,
  },

  // Thread Section
  threadSection: {
    marginTop: 8,
  },
  threadSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.glassBorder,
  },
  threadSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    flex: 1,
  },
  threadSectionCount: {
    fontSize: 14,
    color: theme.gold,
    fontWeight: '600',
  },
  threadItem: {
    marginBottom: 12,
    position: 'relative',
  },
  threadLine: {
    position: 'absolute',
    left: -12,
    top: 20,
    bottom: 0,
    width: 2,
    backgroundColor: theme.glassBorder,
    borderRadius: 1,
  },
  threadContent: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  threadAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  threadMeta: {
    flex: 1,
  },
  threadAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  threadTime: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 1,
  },
  threadText: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },

  // Coming Soon Modal
  comingSoonOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  comingSoonContent: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  comingSoonGradient: {
    padding: 32,
    alignItems: 'center',
  },
  comingSoonIconWrap: {
    marginBottom: 20,
  },
  comingSoonIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  comingSoonTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  comingSoonFeature: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.gold,
    marginBottom: 12,
  },
  comingSoonDesc: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  comingSoonBtn: {
    borderRadius: 20,
    overflow: 'hidden',
    width: '100%',
  },
  comingSoonBtnGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  comingSoonBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});