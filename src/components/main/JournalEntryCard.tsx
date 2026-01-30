import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PlayButton from '../common/PlayButton';
import { theme, TAG_EMOJIS } from '../../constants/theme';
import { DreamWithMeta, AudioContext } from '../../types/dreams';

interface Props {
  item: DreamWithMeta;
  playingId: string | null;
  playingContext: AudioContext | null;
  isAudioLoading: string | null;
  audioStatus: any;
  onPress: () => void;
  onPlayAudio: (dream: DreamWithMeta, context: AudioContext) => void;
}

const formatJournalDate = (dateString: string) => {
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

function JournalEntryCard({
  item,
  playingId,
  playingContext,
  isAudioLoading,
  audioStatus,
  onPress,
  onPlayAudio,
}: Props) {
  const isPlaying = playingId === item.id && playingContext === 'journal' && audioStatus.playing;
  const isThisPlaying = playingId === item.id && playingContext === 'journal';
  const isLoading = isAudioLoading === item.id;
  const hasAudio = !!item.audio_url;
  const hasContent = !!item.content;
  const progressPercent = isThisPlaying && audioStatus.duration > 0
    ? Math.min(100, (audioStatus.currentTime / audioStatus.duration) * 100)
    : 0;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.card, isPlaying && styles.cardActive]}>
        <View style={styles.timeCol}>
          <Text style={styles.dateLabel}>{formatJournalDate(item.dream_date)}</Text>
          <Text style={styles.timeLabel}>{formatTime(item.created_at)}</Text>
          <View style={styles.timeLine} />
        </View>

        <View style={styles.content}>
          <View style={styles.header}>
            {item.title ? (
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            ) : (
              <Text style={styles.titleMuted}>Untitled Dream</Text>
            )}
            <View style={styles.badges}>
              {item.dream_type && item.dream_tag && (
                <View style={styles.tagBadge}>
                  <Text style={styles.tagEmoji}>{TAG_EMOJIS[item.dream_tag] || '✨'}</Text>
                </View>
              )}
              {hasAudio && (
                <View style={styles.badge}>
                  <Ionicons name="mic" size={10} color={theme.primary} />
                </View>
              )}
              <View style={[styles.badge, item.is_public ? styles.badgePublic : styles.badgePrivate]}>
                <Ionicons
                  name={item.is_public ? 'globe-outline' : 'lock-closed'}
                  size={10}
                  color={item.is_public ? theme.primary : theme.gold}
                />
              </View>
            </View>
          </View>

          {hasContent && (
            <Text style={styles.excerpt} numberOfLines={2}>{item.content}</Text>
          )}

          {hasAudio && (
            <View style={styles.audio}>
              <PlayButton
                isPlaying={isPlaying}
                isLoading={isLoading}
                onPress={() => onPlayAudio(item, 'journal')}
                size="small"
              />
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
              </View>
              <Text style={styles.duration}>
                {isThisPlaying ? formatDurationMs(audioStatus.currentTime) : formatDuration(item.audio_duration)}
              </Text>
            </View>
          )}
        </View>

        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} style={styles.chevron} />
      </View>
    </TouchableOpacity>
  );
}

export default React.memo(JournalEntryCard);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.glass,
    borderRadius: 16,
    marginBottom: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  cardActive: {
    borderColor: theme.gold + '50',
    backgroundColor: theme.glowGold,
  },
  timeCol: {
    alignItems: 'center',
    marginRight: 12,
    width: 56,
  },
  dateLabel: {
    fontSize: 10,
    color: theme.textSubtle,
    fontWeight: '600',
    textAlign: 'center',
  },
  timeLabel: {
    fontSize: 11,
    color: theme.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  timeLine: {
    width: 2,
    height: 30,
    backgroundColor: theme.glassBorder,
    marginTop: 8,
    borderRadius: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  titleMuted: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textMuted,
    fontStyle: 'italic',
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    gap: 4,
  },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.glowBlue,
  },
  tagBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  tagEmoji: {
    fontSize: 14,
  },
  badgePublic: {
    backgroundColor: theme.glowBlue,
  },
  badgePrivate: {
    backgroundColor: theme.glowGold,
  },
  excerpt: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  audio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.gold,
  },
  duration: {
    fontSize: 10,
    color: theme.textMuted,
    fontVariant: ['tabular-nums'],
    width: 32,
    textAlign: 'right',
  },
  chevron: {
    marginLeft: 8,
    alignSelf: 'center',
  },
});