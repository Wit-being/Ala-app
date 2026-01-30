import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import PlayButton from '../common/PlayButton';
import InterpretationThread from './InterpretationThread';
import { theme, TAG_EMOJIS } from '../../constants/theme';
import { DreamWithMeta, UserProfile, Interpretation, AudioContext } from '../../types/dreams';

interface Props {
  visible: boolean;
  dream: DreamWithMeta | null;
  interpretations: Interpretation[];
  interpretationsLoading: boolean;
  currentUserId?: string;
  playingId: string | null;
  playingContext: AudioContext | null;
  isAudioLoading: string | null;
  audioStatus: any;
  onClose: () => void;
  onDelete: (dreamId: string) => void;
  onPlayAudio: (dream: DreamWithMeta, context: AudioContext) => void;
  onToggleLike: (dream: DreamWithMeta) => void;
  onWowPress: () => void;
  onAddInterpretation: () => void;
  onProfilePress: (profile: UserProfile | null, userId: string) => void;
}

const getAvatarUrl = (profile: UserProfile | null, fallbackName: string) => {
  if (profile?.avatar_url?.startsWith('http')) return profile.avatar_url;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    profile?.display_name || profile?.username || fallbackName
  )}&background=1e293b&color=60a5fa&size=64`;
};

const formatFullDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const formatTime = (dateString: string) => {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const formatDuration = (seconds: number | null | undefined) => {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
};

const formatDurationMs = (ms: number) => {
  if (!ms || isNaN(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, '0')}`;
};

export default function DreamModal({
  visible,
  dream,
  interpretations,
  interpretationsLoading,
  currentUserId,
  playingId,
  playingContext,
  isAudioLoading,
  audioStatus,
  onClose,
  onDelete,
  onPlayAudio,
  onToggleLike,
  onWowPress,
  onAddInterpretation,
  onProfilePress,
}: Props) {
  if (!dream) return null;

  const isPlaying = playingId === dream.id && playingContext === 'modal' && audioStatus.playing;
  const isThisDream = playingId === dream.id && playingContext === 'modal';
  const isMine = dream.user_id === currentUserId;
  const progressPercent = isThisDream && audioStatus.duration > 0
    ? Math.min(100, (audioStatus.currentTime / audioStatus.duration) * 100)
    : 0;
  const userName = isMine ? 'You' : dream.authorProfile?.display_name || dream.authorProfile?.username || 'Dreamer';
  const avatarUrl = getAvatarUrl(dream.authorProfile || null, userName);
  const canInterpret = dream.interpretation_mode && dream.interpretation_mode !== 'disabled';
  const showThread = canInterpret && interpretations.length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.wrap}>
          <LinearGradient
            colors={[theme.backgroundGradientStart, theme.backgroundGradientEnd]}
            style={styles.bg}
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="chevron-down" size={28} color={theme.textPrimary} />
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                <Text style={styles.headerText}>Dream</Text>
                {dream.dream_type && dream.dream_tag && (
                  <View style={styles.tagBadge}>
                    <Text style={styles.tagEmoji}>{TAG_EMOJIS[dream.dream_tag] || '✨'}</Text>
                  </View>
                )}
              </View>
              {isMine ? (
                <TouchableOpacity onPress={() => onDelete(dream.id)} style={styles.closeBtn}>
                  <Ionicons name="trash-outline" size={24} color={theme.danger} />
                </TouchableOpacity>
              ) : (
                <View style={{ width: 44 }} />
              )}
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* User Info */}
              <TouchableOpacity
                style={styles.user}
                onPress={() => onProfilePress(dream.authorProfile || null, dream.user_id)}
                activeOpacity={0.7}
              >
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                <View>
                  <Text style={styles.userName}>{userName}</Text>
                  <Text style={styles.date}>
                    {formatFullDate(dream.dream_date)} • {formatTime(dream.created_at)}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Content */}
              {dream.title && <Text style={styles.title}>{dream.title}</Text>}
              {dream.content && <Text style={styles.contentText}>{dream.content}</Text>}

              {/* Audio Player */}
              {dream.audio_url && (
                <View style={styles.audio}>
                  <PlayButton
                    isPlaying={isPlaying}
                    isLoading={isAudioLoading === dream.id}
                    onPress={() => onPlayAudio(dream, 'modal')}
                    size="large"
                  />
                  <View style={styles.audioInfo}>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                    </View>
                    <View style={styles.timeRow}>
                      <Text style={styles.timeText}>
                        {isThisDream ? formatDurationMs(audioStatus.currentTime) : '0:00'}
                      </Text>
                      <Text style={styles.timeText}>{formatDuration(dream.audio_duration)}</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Engagement Buttons */}
              {(dream.enable_engagement || canInterpret) && (
                <View style={styles.engagement}>
                  {dream.enable_engagement && (
                    <>
                      <TouchableOpacity
                        style={[styles.engageBtn, dream.isLiked && styles.engageBtnActive]}
                        onPress={() => onToggleLike(dream)}
                      >
                        <Text style={styles.reactionEmoji}>💫</Text>
                        <Text style={[styles.engageText, dream.isLiked && styles.engageTextActive]}>
                          {dream.likeCount || 0}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.engageBtn} onPress={onWowPress}>
                        <Text style={styles.wowText}>wow</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {canInterpret && !isMine && (
                    <TouchableOpacity style={styles.engageBtn} onPress={onAddInterpretation}>
                      <Feather name="eye" size={20} color={theme.gold} />
                      <Text style={styles.engageText}>Decipher</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Interpretations Thread */}
              {showThread && (
                <View style={styles.threadSection}>
                  <View style={styles.threadHeader}>
                    <Feather name="eye" size={18} color={theme.gold} />
                    <Text style={styles.threadTitle}>Interpretations</Text>
                    <Text style={styles.threadCount}>{interpretations.length}</Text>
                  </View>
                  {interpretationsLoading ? (
                    <ActivityIndicator size="small" color={theme.gold} style={{ marginTop: 16 }} />
                  ) : (
                    interpretations.map((interp) => (
                      <InterpretationThread
                        key={interp.id}
                        interpretation={interp}
                        onProfilePress={onProfilePress}
                      />
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
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  wrap: {
    flex: 1,
    marginTop: 40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  bg: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.glassBorder,
  },
  closeBtn: {
    padding: 8,
    width: 44,
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerText: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  tagBadge: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagEmoji: {
    fontSize: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  user: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  date: {
    fontSize: 13,
    color: theme.textSubtle,
    marginTop: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 16,
  },
  contentText: {
    fontSize: 16,
    color: theme.textSecondary,
    lineHeight: 26,
    marginBottom: 24,
  },
  audio: {
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
  audioInfo: {
    flex: 1,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.gold,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 12,
    color: theme.textSubtle,
    fontVariant: ['tabular-nums'],
  },
  engagement: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  engageBtn: {
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
  engageBtnActive: {
    backgroundColor: theme.glowGold,
    borderColor: theme.gold + '30',
  },
  engageText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  engageTextActive: {
    color: theme.gold,
  },
  reactionEmoji: {
    fontSize: 22,
  },
  wowText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
    fontStyle: 'italic',
  },
  threadSection: {
    marginTop: 8,
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.glassBorder,
  },
  threadTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    flex: 1,
  },
  threadCount: {
    fontSize: 14,
    color: theme.gold,
    fontWeight: '600',
  },
});