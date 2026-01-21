import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

interface Dream {
  id: string;
  title: string | null;
  content: string | null;
  audio_url: string | null;
  is_public: boolean;
  dream_date: string;
  created_at: string;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export default function DreamFeedScreen({ navigation }: any) {
  const user = useAuthStore((state) => state.user);
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  
  const playerRef = useRef<ReturnType<typeof useAudioPlayer> | null>(null);
  const currentAudioUrl = useRef<string | null>(null);

  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  playerRef.current = player;

  // User's avatar for header
  const userAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.email || 'U')}&background=18181b&color=fff&size=64`;

  useEffect(() => {
    fetchPublicDreams();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status.playing) {
      interval = setInterval(() => {
        setPlayingId(prev => prev);
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status.playing]);

  useEffect(() => {
    if (status.currentTime >= status.duration && status.duration > 0 && status.playing) {
      resetAudioState();
    }
  }, [status.currentTime, status.duration, status.playing]);

  const fetchPublicDreams = async () => {
    try {
      setLoading(true);
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
      setDreams(data || []);
    } catch (error: any) {
      console.error('Error fetching public dreams:', error);
      Alert.alert('Error', 'Failed to load public dreams');
    } finally {
      setLoading(false);
    }
  };

  const resetAudioState = () => {
    setPlayingId(null);
    currentAudioUrl.current = null;
    setIsAudioLoading(false);
  };

  const playAudio = async (dream: Dream) => {
    if (!dream.audio_url) {
      Alert.alert('No Audio', 'This dream has no audio recording');
      return;
    }

    setIsAudioLoading(true);

    if (playingId === dream.id) {
      if (status.playing) {
        player.pause();
      } else {
        player.play();
      }
      setIsAudioLoading(false);
      return;
    }

    if (playingId && playingId !== dream.id) {
      player.pause();
      player.remove();
    }

    try {
      let audioUrl = dream.audio_url;
      
      if (!dream.is_public) {
        const { data, error } = await supabase.storage
          .from('ala-audio-private')
          .createSignedUrl(dream.audio_url!, 3600);
        
        if (error) {
          Alert.alert('Error', 'Failed to load audio');
          resetAudioState();
          return;
        }
        if (data?.signedUrl) {
          audioUrl = data.signedUrl;
        }
      }

      if (currentAudioUrl.current !== audioUrl) {
        await player.replace({ uri: audioUrl });
        currentAudioUrl.current = audioUrl;
      }
      
      await player.play();
      setPlayingId(dream.id);

    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to play audio');
      resetAudioState();
    } finally {
      setIsAudioLoading(false);
    }
  };

  const formatTime = (milliseconds: number) => {
    if (!milliseconds || isNaN(milliseconds) || milliseconds < 0) return '0:00';
    const totalSeconds = Math.floor(milliseconds / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const renderDream = ({ item }: { item: Dream }) => {
    const isPlaying = playingId === item.id && status.playing;
    const isThisDream = playingId === item.id;
    const isLoadingThisAudio = isAudioLoading && playingId === item.id;

    const progressPercent = status.duration > 0 
      ? Math.min(100, Math.max(0, (status.currentTime / status.duration) * 100))
      : 0;

    const userName = item.profiles?.display_name || 'Anonymous';
    const avatarUrl = item.profiles?.avatar_url || 
      `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=18181b&color=fff&size=128`;

    return (
      <BlurView intensity={20} tint="dark" style={styles.dreamCard}>
        <View style={styles.cardInner}>
          <View style={styles.userHeader}>
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{userName}</Text>
              <Text style={styles.dreamDate}>{formatDate(item.dream_date)}</Text>
            </View>
          </View>

          <Text style={styles.dreamTitle}>
            {item.title || 'Untitled Dream'}
          </Text>

          {item.content && (
            <Text style={styles.dreamContent} numberOfLines={3}>
              {item.content}
            </Text>
          )}

          {item.audio_url && (
            <View style={styles.audioSection}>
              <TouchableOpacity
                style={[styles.playButton, isPlaying && styles.playingButton]}
                onPress={() => playAudio(item)}
                disabled={isAudioLoading}
                activeOpacity={0.7}
              >
                {isLoadingThisAudio ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.playButtonText}>
                    {isPlaying ? 'Pause' : 'Play'}
                  </Text>
                )}
              </TouchableOpacity>

              {isThisDream && (
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View 
                      style={[styles.progressFill, { width: `${progressPercent}%` }]} 
                    />
                  </View>
                  <Text style={styles.timeText}>
                    {formatTime(status.currentTime)} / {formatTime(status.duration)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </BlurView>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Profile */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>Ala</Text>
          <Text style={styles.subtitle}>{dreams.length} dreams shared</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
          <Image source={{ uri: userAvatar }} style={styles.headerAvatar} />
        </TouchableOpacity>
      </View>

      {dreams.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No dreams yet</Text>
          <Text style={styles.emptySubtext}>
            Be the first to share
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate('RecordDream')}
          >
            <Text style={styles.emptyButtonText}>Record Dream</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={dreams}
          renderItem={renderDream}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={fetchPublicDreams}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating Record Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('RecordDream')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  dreamCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardInner: {
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: '#1a1a1a',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  dreamDate: {
    fontSize: 13,
    color: '#666',
    marginTop: 1,
  },
  dreamTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  dreamContent: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
    marginBottom: 12,
  },
  audioSection: {
    marginTop: 4,
  },
  playButton: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  playingButton: {
    backgroundColor: '#e5e5e5',
  },
  playButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  progressContainer: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#D4AF37',
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    minWidth: 70,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#666',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  emptyButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 28,
    fontWeight: '300',
    color: '#000',
    marginTop: -2,
  },
});