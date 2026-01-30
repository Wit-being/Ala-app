import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Animated, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayerStatus } from 'expo-audio';
import PlayButton from '../common/PlayButton';
import DreamOverlay from './DreamOverlay';
import ReactionButtons from './ReactionButtons';
import { theme } from '../../constants/theme';
import { DreamWithMeta, UserProfile, AudioContext } from '../../types/dreams';

interface Props {
  item: DreamWithMeta;
  currentUserId?: string;
  playingId: string | null;
  playingContext: AudioContext | null;
  isAudioLoading: string | null;
  audioStatus: any;
  onPress: () => void;
  onPlayAudio: (dream: DreamWithMeta, context: AudioContext) => void;
  onToggleLike: (dream: DreamWithMeta) => void;
  onWowPress: () => void;
  onProfilePress: (profile: UserProfile | null, userId: string) => void;
}

const getAvatarUrl = (profile: UserProfile | null, fallbackName: string) => {
  if (profile?.avatar_url?.startsWith('http')) return profile.avatar_url;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    profile?.display_name || profile?.username || fallbackName
  )}&background=1e293b&color=60a5fa&size=64`;
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

// Animated Eye Icon
const AnimatedEyeIcon = React.memo(() => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    pulseAnimation.start();
    return () => pulseAnimation.stop();
  }, []);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Ionicons name="eye" size={16} color={theme.gold} />
    </Animated.View>
  );
});

// Animated See Interpretations
const AnimatedSeeInterpretations = React.memo(({ count, onPress }: { count: number; onPress: () => void }) => {
  const opacityAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const fadeAnimation = Animated.loop(
      Animated.sequence([
        Animated.delay(1400),
        Animated.timing(opacityAnim, { toValue: 0.15, duration: 500, useNativeDriver: true }),
        Animated.delay(700),
        Animated.timing(opacityAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    fadeAnimation.start();
    return () => fadeAnimation.stop();
  }, []);

  return (
    <TouchableOpacity style={styles.seeInterpretationsBtn} onPress={onPress} activeOpacity={0.7}>
      <Animated.Text style={[styles.seeInterpretationsText, { opacity: opacityAnim }]}>
        See interpretations{count > 0 ? ` (${count})` : ''}
      </Animated.Text>
    </TouchableOpacity>
  );
});

function FeedDreamCard({
  item,
  currentUserId,
  playingId,
  playingContext,
  isAudioLoading,
  audioStatus,
  onPress,
  onPlayAudio,
  onToggleLike,
  onWowPress,
  onProfilePress,
}: Props) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const borderOpacity = useRef(new Animated.Value(0)).current;

  const isPlaying = playingId === item.id && playingContext === 'feed' && audioStatus.playing;
  const isThisPlaying = playingId === item.id && playingContext === 'feed';
  const isLoading = isAudioLoading === item.id;
  const isMine = item.user_id === currentUserId;
  const hasAudio = !!item.audio_url;
  const hasContent = !!item.content;
  const hasOverlay = item.dream_type && item.dream_tag;
  const userName = isMine ? 'You' : item.authorProfile?.display_name || item.authorProfile?.username || 'Dreamer';
  const avatarUrl = getAvatarUrl(item.authorProfile || null, userName);
  const progressPercent = isThisPlaying && audioStatus.duration > 0 
    ? Math.min(100, (audioStatus.currentTime / audioStatus.duration) * 100) 
    : 0;
  const canInterpret = item.interpretation_mode && item.interpretation_mode !== 'disabled';

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }),
      Animated.timing(borderOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }),
      Animated.timing(borderOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
        <Animated.View style={[styles.cardBorder, { opacity: borderOpacity }]} />
        {hasOverlay && <DreamOverlay dreamType={item.dream_type} dreamTag={item.dream_tag} />}

        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <TouchableOpacity
              style={styles.userRow}
              onPress={() => onProfilePress(item.authorProfile || null, item.user_id)}
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
            <View style={styles.audioPlayer}>
              <PlayButton
                isPlaying={isPlaying}
                isLoading={isLoading}
                onPress={() => onPlayAudio(item, 'feed')}
                size="medium"
              />
              <View style={styles.progressWrap}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                </View>
              </View>
              <Text style={styles.durationText}>
                {isThisPlaying ? formatDurationMs(audioStatus.currentTime) : formatDuration(item.audio_duration)}
              </Text>
            </View>
          )}

          <View style={styles.cardFooter}>
            <View style={styles.engagementLeft}>
              {item.enable_engagement && (
                <ReactionButtons
                  isLiked={item.isLiked || false}
                  count={item.likeCount || 0}
                  onStarPress={() => onToggleLike(item)}
                  onWowPress={onWowPress}
                />
              )}
              {(item.interpretationCount ?? 0) > 0 && (
                <View style={styles.threadIndicator}>
                  <Ionicons name="chatbubbles-outline" size={14} color={theme.textSubtle} />
                  <Text style={styles.threadCount}>{item.interpretationCount}</Text>
                </View>
              )}
            </View>

            {canInterpret && (
              isMine ? (
                <AnimatedSeeInterpretations count={item.interpretationCount || 0} onPress={onPress} />
              ) : (
                <TouchableOpacity style={styles.decipherBtn} onPress={onPress} activeOpacity={0.7}>
                  <AnimatedEyeIcon />
                  <Text style={styles.decipherText}>Decipher</Text>
                </TouchableOpacity>
              )
            )}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default React.memo(FeedDreamCard);

const styles = StyleSheet.create({
  card: {
    marginBottom: 20,
    borderRadius: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  cardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  cardContent: {
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
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
    marginBottom: 12,
  },
  progressWrap: {
    flex: 1,
  },
  progressTrack: {
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
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  engagementLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  decipherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  decipherText: {
    fontSize: 13,
    color: theme.gold,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  seeInterpretationsBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  seeInterpretationsText: {
    fontSize: 13,
    color: theme.gold,
    fontWeight: '500',
  },
});