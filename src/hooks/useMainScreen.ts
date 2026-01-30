import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Alert } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import {
  Dream,
  DreamWithMeta,
  UserProfile,
  Interpretation,
  AudioContext,
  DreamSection,
  JournalStats,
} from '../types/dreams';

export function useMainScreen() {
  const user = useAuthStore((state) => state.user);
  
  // Feed & Journal State
  const [feedDreams, setFeedDreams] = useState<DreamWithMeta[]>([]);
  const [myDreams, setMyDreams] = useState<DreamWithMeta[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [myDreamsLoading, setMyDreamsLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [myDreamsError, setMyDreamsError] = useState<string | null>(null);
  
  // User State
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [hasNotifications, setHasNotifications] = useState(false);
  
  // Audio State
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingContext, setPlayingContext] = useState<AudioContext | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState<string | null>(null);
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDream, setSelectedDream] = useState<DreamWithMeta | null>(null);
  const [interpretations, setInterpretations] = useState<Interpretation[]>([]);
  const [interpretationsLoading, setInterpretationsLoading] = useState(false);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  
  // Delete State
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [dreamToDelete, setDreamToDelete] = useState<string | null>(null);
  
  // Coming Soon State
  const [comingSoonVisible, setComingSoonVisible] = useState(false);
  const [comingSoonFeature, setComingSoonFeature] = useState('');
  
  // Gradient State
  const [currentGradientIndex, setCurrentGradientIndex] = useState(0);
  
  // Audio Player
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const currentAudioUrl = useRef<string | null>(null);
  const pendingPlayRef = useRef<{ dreamId: string; context: AudioContext } | null>(null);

  // Reset audio when finished
  useEffect(() => {
    if (status.didJustFinish) resetAudioState();
  }, [status.didJustFinish]);

  // Computed: Journal Stats
  const journalStats = useMemo((): JournalStats => {
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
          const diffDays = Math.floor(
            (new Date(sortedDates[i - 1]).getTime() - new Date(sortedDates[i]).getTime()) / 86400000
          );
          if (diffDays === 1) streak++;
          else break;
        }
      }
    }

    const months = [...new Set(myDreams.map((d) => {
      const date = new Date(d.dream_date);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }))].sort().reverse();

    return { total: myDreams.length, thisMonth: dreamsThisMonth, streak, months };
  }, [myDreams]);

  // Computed: Grouped Dreams for Journal
  const groupedDreams = useMemo((): DreamSection[] => {
    let filtered = myDreams;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((d) =>
        d.title?.toLowerCase().includes(query) || d.content?.toLowerCase().includes(query)
      );
    }
    
    if (selectedMonth) {
      filtered = filtered.filter((d) => {
        const date = new Date(d.dream_date);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` === selectedMonth;
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
      
      if (dreamDateStr === today) todayDreams.push(dream);
      else if (dreamDateStr === yesterday) yesterdayDreams.push(dream);
      else if (dreamDate >= weekAgo) thisWeekDreams.push(dream);
      else if (dreamDate >= monthStart) thisMonthDreams.push(dream);
      else {
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
      .forEach((month) => sections.push({ title: month, data: olderByMonth[month] }));

    return sections;
  }, [myDreams, searchQuery, selectedMonth]);

  // Fetch Functions
  const fetchUserProfile = useCallback(async () => {
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
  }, [user?.id]);

  const checkNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);
      if (!error) setHasNotifications((count || 0) > 0);
    } catch (error) {
      console.error('Error checking notifications:', error);
    }
  }, [user?.id]);

  const fetchFeedDreams = useCallback(async () => {
    try {
      setFeedLoading(true);
      setFeedError(null);
      
      const { data, error } = await supabase
        .from('dreams')
        .select('id, user_id, title, content, audio_url, audio_duration, is_public, dream_date, created_at, status, interpretation_mode, enable_engagement, dream_type, dream_tag')
        .eq('is_public', true)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const dreamsWithMeta = await Promise.all(
        (data || []).map(async (dream) => {
          let likeCount = 0, interpretationCount = 0, isLiked = false;
          let authorProfile: UserProfile | null = null;

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
            const { count: ic } = await supabase
              .from('interpretations')
              .select('*', { count: 'exact', head: true })
              .eq('dream_id', dream.id);
            interpretationCount = ic || 0;
          }

          return { ...dream, likeCount, interpretationCount, isLiked, authorProfile };
        })
      );

      setFeedDreams(dreamsWithMeta);
    } catch (error: any) {
      setFeedError(error.message || 'Failed to load dreams');
    } finally {
      setFeedLoading(false);
    }
  }, [user?.id]);

  const fetchMyDreams = useCallback(async () => {
    if (!user) return;
    try {
      setMyDreamsLoading(true);
      setMyDreamsError(null);
      
      const { data, error } = await supabase
        .from('dreams')
        .select('id, user_id, title, content, audio_url, audio_duration, is_public, dream_date, created_at, status, interpretation_mode, enable_engagement, dream_type, dream_tag')
        .eq('user_id', user.id)
        .order('dream_date', { ascending: false })
        .limit(100);

      if (error) throw error;
      setMyDreams(data || []);
    } catch (error: any) {
      setMyDreamsError(error.message || 'Failed to load your dreams');
    } finally {
      setMyDreamsLoading(false);
    }
  }, [user?.id]);

  const fetchInterpretations = useCallback(async (dreamId: string) => {
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
  }, []);

  // Notification Helper
  const createNotification = useCallback(async (
    recipientId: string,
    type: string,
    dreamId: string,
    dreamTitle: string | null
  ) => {
    if (!user?.id || recipientId === user.id) return;
    try {
      const displayName = userProfile?.display_name || userProfile?.username || 'Someone';
      let message = '';
      
      if (type === 'like') {
        message = `${displayName} reacted to your dream${dreamTitle ? ` "${dreamTitle}"` : ''}`;
      } else if (type === 'interpretation') {
        message = `${displayName} interpreted your dream${dreamTitle ? ` "${dreamTitle}"` : ''}`;
      } else {
        message = `${displayName} interacted with your dream`;
      }

      await supabase.from('notifications').insert({
        user_id: recipientId,
        type,
        message,
        dream_id: dreamId,
        actor_id: user.id,
        read: false,
      });
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }, [user?.id, userProfile]);

  // Like Toggle
  const toggleLike = useCallback(async (dream: DreamWithMeta) => {
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
            d.id === dream.id ? { ...d, isLiked: false, likeCount: (d.likeCount || 1) - 1 } : d
          )
        );
      } else {
        await supabase.from('dream_likes').insert({ dream_id: dream.id, user_id: user.id });
        
        if (dream.user_id !== user.id) {
          await createNotification(dream.user_id, 'like', dream.id, dream.title);
        }
        
        setFeedDreams((prev) =>
          prev.map((d) =>
            d.id === dream.id ? { ...d, isLiked: true, likeCount: (d.likeCount || 0) + 1 } : d
          )
        );
      }

      if (selectedDream?.id === dream.id) {
        setSelectedDream((prev) =>
          prev
            ? {
                ...prev,
                isLiked: !prev.isLiked,
                likeCount: prev.isLiked ? (prev.likeCount || 1) - 1 : (prev.likeCount || 0) + 1,
              }
            : null
        );
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  }, [user?.id, selectedDream, createNotification]);

  // Audio Functions
  const resetAudioState = useCallback(() => {
    setPlayingId(null);
    setPlayingContext(null);
    currentAudioUrl.current = null;
    setIsAudioLoading(null);
    pendingPlayRef.current = null;
  }, []);

  const playAudio = useCallback(async (dream: Dream, context: AudioContext) => {
    if (!dream.audio_url) return;
    
    if (playingId === dream.id && playingContext === context) {
      if (status.playing) player.pause();
      else player.play();
      return;
    }

    setIsAudioLoading(dream.id);
    pendingPlayRef.current = { dreamId: dream.id, context };
    if (playingId) player.pause();
    setPlayingId(dream.id);
    setPlayingContext(context);

    try {
      let audioUrl = dream.audio_url;
      
      if (!dream.is_public && dream.user_id === user?.id && !dream.audio_url.startsWith('http')) {
        const { data, error } = await supabase.storage
          .from('ala-audio-private')
          .createSignedUrl(dream.audio_url, 3600);
        if (error) throw error;
        if (data?.signedUrl) audioUrl = data.signedUrl;
      }
      
      if (pendingPlayRef.current?.dreamId === dream.id) {
        await player.replace({ uri: audioUrl });
        currentAudioUrl.current = audioUrl;
        await player.play();
      }
    } catch (error: any) {
      Alert.alert('Playback Error', 'Unable to play this audio');
      resetAudioState();
    } finally {
      if (pendingPlayRef.current?.dreamId === dream.id) {
        setIsAudioLoading(null);
        pendingPlayRef.current = null;
      }
    }
  }, [playingId, playingContext, status.playing, player, user?.id, resetAudioState]);

  // Modal Functions
  const openDreamModal = useCallback((dream: DreamWithMeta) => {
    setSelectedDream(dream);
    if (dream.interpretation_mode && dream.interpretation_mode !== 'disabled') {
      fetchInterpretations(dream.id);
    }
    requestAnimationFrame(() => setModalVisible(true));
  }, [fetchInterpretations]);

  const closeDreamModal = useCallback(() => {
    setModalVisible(false);
    setTimeout(() => {
      setSelectedDream(null);
      setInterpretations([]);
    }, 300);
  }, []);

  // Delete Functions
  const showDeleteConfirmation = useCallback((dreamId: string) => {
    setDreamToDelete(dreamId);
    setDeleteModalVisible(true);
  }, []);

  const confirmDeleteDream = useCallback(async () => {
    if (!dreamToDelete) return;
    try {
      const { error } = await supabase.from('dreams').delete().eq('id', dreamToDelete);
      if (error) throw error;
      
      setMyDreams((prev) => prev.filter((d) => d.id !== dreamToDelete));
      
      if (playingId === dreamToDelete) {
        player.pause();
        resetAudioState();
      }
      
      setModalVisible(false);
      setSelectedDream(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to delete dream');
    } finally {
      setDeleteModalVisible(false);
      setDreamToDelete(null);
    }
  }, [dreamToDelete, playingId, player, resetAudioState]);

  const cancelDelete = useCallback(() => {
    setDeleteModalVisible(false);
    setDreamToDelete(null);
  }, []);

  // Coming Soon
  const showComingSoon = useCallback((feature: string) => {
    setComingSoonFeature(feature);
    setComingSoonVisible(true);
  }, []);

  const hideComingSoon = useCallback(() => {
    setComingSoonVisible(false);
  }, []);

  // Helper Functions
  const getUserAvatarUrl = useCallback(() => {
    if (userProfile?.avatar_url?.startsWith('http')) return userProfile.avatar_url;
    const displayName = userProfile?.display_name || userProfile?.username || user?.email || 'U';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1e293b&color=60a5fa&size=128`;
  }, [userProfile, user?.email]);

  return {
    // User
    user,
    userProfile,
    hasNotifications,
    getUserAvatarUrl,
    
    // Feed
    feedDreams,
    feedLoading,
    feedError,
    fetchFeedDreams,
    
    // Journal
    myDreams,
    myDreamsLoading,
    myDreamsError,
    fetchMyDreams,
    journalStats,
    groupedDreams,
    searchQuery,
    setSearchQuery,
    selectedMonth,
    setSelectedMonth,
    
    // Audio
    player,
    status,
    playingId,
    playingContext,
    isAudioLoading,
    playAudio,
    resetAudioState,
    
    // Modal
    modalVisible,
    selectedDream,
    interpretations,
    interpretationsLoading,
    openDreamModal,
    closeDreamModal,
    
    // Delete
    deleteModalVisible,
    showDeleteConfirmation,
    confirmDeleteDream,
    cancelDelete,
    
    // Like
    toggleLike,
    
    // Coming Soon
    comingSoonVisible,
    comingSoonFeature,
    showComingSoon,
    hideComingSoon,
    
    // Gradient
    currentGradientIndex,
    setCurrentGradientIndex,
    
    // Init
    fetchUserProfile,
    checkNotifications,
  };
}