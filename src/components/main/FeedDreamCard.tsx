import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import PlayButton from '../common/PlayButton';
import DreamOverlay from './DreamOverlay';
import { supabase } from '../../lib/supabase';
import { theme } from '../../constants/theme';
import { DreamWithMeta, UserProfile, AudioContext, ReactionType } from '../../types/dreams';

const REACTIONS = {
  scary: { emoji: '😱', label: 'Scary' },
  sweet: { emoji: '🥰', label: 'Sweet' },
  divine: { emoji: '✨', label: 'Divine' },
} as const;

interface Reactor {
  id: string;
  user_id: string;
  reaction_type: ReactionType;
  profile?: UserProfile;
}

interface Props {
  item: DreamWithMeta;
  currentUserId?: string;
  playingId: string | null;
  playingContext: AudioContext | null;
  isAudioLoading: string | null;
  audioStatus: any;
  onPress: () => void;
  onPlayAudio: (dream: DreamWithMeta, context: AudioContext) => void;
  onReact: (dream: DreamWithMeta, reaction: ReactionType) => void;
  onRemoveReaction: (dream: DreamWithMeta) => void;
  onProfilePress: (profile: UserProfile | null, userId: string) => void;
}

const getAvatarUrl = (profile: UserProfile | null | undefined, fallbackName: string) => {
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

// Animated Microscope Icon
const AnimatedMicroscopeIcon = React.memo(() => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(rotateAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1.1, duration: 600, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(rotateAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-5deg', '5deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate }, { scale: scaleAnim }] }}>
      <MaterialCommunityIcons name="microscope" size={16} color={theme.gold} />
    </Animated.View>
  );
});

// Reactors Mini Modal
const ReactorsMiniModal = ({
  visible,
  onClose,
  reactors,
  loading,
  onProfilePress,
}: {
  visible: boolean;
  onClose: () => void;
  reactors: Reactor[];
  loading: boolean;
  onProfilePress: (profile: UserProfile | null, userId: string) => void;
}) => {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const grouped = React.useMemo(() => {
    const groups: { [key in ReactionType]?: Reactor[] } = {};
    reactors.forEach((r) => {
      if (!groups[r.reaction_type]) groups[r.reaction_type] = [];
      groups[r.reaction_type]!.push(r);
    });
    return groups;
  }, [reactors]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.reactorsOverlay} onPress={onClose}>
        <Animated.View
          style={[styles.reactorsContainer, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <BlurView intensity={80} tint="dark" style={styles.reactorsBlur}>
              <View style={styles.reactorsContent}>
                <View style={styles.reactorsHeader}>
                  <Text style={styles.reactorsTitle}>Reactions</Text>
                  <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={20} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>

                {loading ? (
                  <ActivityIndicator color={theme.gold} style={{ marginVertical: 30 }} />
                ) : reactors.length === 0 ? (
                  <View style={styles.reactorsEmpty}>
                    <Text style={styles.reactorsEmptyText}>No reactions yet</Text>
                  </View>
                ) : (
                  <ScrollView style={styles.reactorsList} showsVerticalScrollIndicator={false}>
                    {(Object.keys(grouped) as ReactionType[]).map((type) => (
                      <View key={type} style={styles.reactorGroup}>
                        <View style={styles.reactorGroupHeader}>
                          <Text style={styles.reactorGroupEmoji}>{REACTIONS[type].emoji}</Text>
                          <Text style={styles.reactorGroupCount}>{grouped[type]?.length}</Text>
                        </View>
                        {grouped[type]?.map((reactor) => (
                          <TouchableOpacity
                            key={reactor.id}
                            style={styles.reactorItem}
                            onPress={() => {
                              onClose();
                              onProfilePress(reactor.profile || null, reactor.user_id);
                            }}
                            activeOpacity={0.7}
                          >
                            <Image
                              source={{ uri: getAvatarUrl(reactor.profile, 'U') }}
                              style={styles.reactorAvatar}
                            />
                            <Text style={styles.reactorName} numberOfLines={1}>
                              {reactor.profile?.display_name || reactor.profile?.username || 'Dreamer'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            </BlurView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

function FeedDreamCard({
  item,
  currentUserId,
  playingId,
  playingContext,
  isAudioLoading,
  audioStatus,
  onPress,
  onPlayAudio,
  onReact,
  onRemoveReaction,
  onProfilePress,
}: Props) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const borderOpacity = useRef(new Animated.Value(0)).current;
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showReactors, setShowReactors] = useState(false);
  const [reactors, setReactors] = useState<Reactor[]>([]);
  const [reactorsLoading, setReactorsLoading] = useState(false);
  const pickerAnim = useRef(new Animated.Value(0)).current;

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
  const userReaction = item.userReaction as ReactionType | null;
  const hasReactions = (item.reactionCount ?? 0) > 0;

  React.useEffect(() => {
    if (showReactionPicker) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.spring(pickerAnim, { toValue: 1, useNativeDriver: true, friction: 7 }).start();
    } else {
      pickerAnim.setValue(0);
    }
  }, [showReactionPicker]);

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

  const handleReactionTap = () => {
    if (userReaction) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onRemoveReaction(item);
    } else {
      setShowReactionPicker(true);
    }
  };

  const handleReactionLongPress = async () => {
    setShowReactors(true);
    setReactorsLoading(true);

    try {
      const { data, error } = await supabase
        .from('dream_reactions')
        .select('id, user_id, reaction_type')
        .eq('dream_id', item.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((r) => r.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', userIds);

        const profilesMap = (profiles || []).reduce(
          (acc, p) => ({ ...acc, [p.id]: p }),
          {} as Record<string, UserProfile>
        );

        setReactors(
          data.map((r) => ({
            ...r,
            reaction_type: r.reaction_type as ReactionType,
            profile: profilesMap[r.user_id],
          }))
        );
      } else {
        setReactors([]);
      }
    } catch (error) {
      console.error('Error fetching reactors:', error);
      setReactors([]);
    } finally {
      setReactorsLoading(false);
    }
  };

  const handleSelectReaction = (type: ReactionType) => {
    setShowReactionPicker(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onReact(item, type);
  };

  return (
    <>
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
              <View style={styles.footerLeft}>
                {/* Reaction Button */}
                <TouchableOpacity
                  onPress={handleReactionTap}
                  onLongPress={hasReactions ? handleReactionLongPress : undefined}
                  delayLongPress={300}
                  style={styles.reactionButton}
                  activeOpacity={0.7}
                >
                  {userReaction ? (
                    <Text style={styles.reactionEmoji}>{REACTIONS[userReaction].emoji}</Text>
                  ) : (
                    <View style={styles.addReactionCircle}>
                      <Ionicons name="heart-outline" size={16} color={theme.textSubtle} />
                    </View>
                  )}
                  {hasReactions && (
                    <Text style={[styles.reactionCount, userReaction && styles.reactionCountActive]}>
                      {item.reactionCount}
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Interpretation Count - Static, no animation */}
                {(item.interpretationCount ?? 0) > 0 && (
                  <View style={styles.threadIndicator}>
                    <Ionicons name="chatbubble-outline" size={14} color={theme.textSubtle} />
                    <Text style={styles.threadCount}>{item.interpretationCount}</Text>
                  </View>
                )}
              </View>

              {/* Decipher with animated microscope */}
              {canInterpret && !isMine && (
                <TouchableOpacity style={styles.decipherBtn} onPress={onPress} activeOpacity={0.7}>
                  <AnimatedMicroscopeIcon />
                  <Text style={styles.decipherText}>Decipher</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animated.View>
      </Pressable>

      {/* Reaction Picker Modal */}
      <Modal
        visible={showReactionPicker}
        transparent
        animationType="none"
        onRequestClose={() => setShowReactionPicker(false)}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setShowReactionPicker(false)}>
          <Animated.View style={[styles.pickerContainer, { transform: [{ scale: pickerAnim }] }]}>
            <BlurView intensity={80} tint="dark" style={styles.pickerBlur}>
              {(Object.keys(REACTIONS) as ReactionType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => handleSelectReaction(type)}
                  style={styles.pickerOption}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pickerEmoji}>{REACTIONS[type].emoji}</Text>
                </TouchableOpacity>
              ))}
            </BlurView>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* Reactors List Modal */}
      <ReactorsMiniModal
        visible={showReactors}
        onClose={() => setShowReactors(false)}
        reactors={reactors}
        loading={reactorsLoading}
        onProfilePress={onProfilePress}
      />
    </>
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
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  reactionEmoji: {
    fontSize: 20,
  },
  addReactionCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionCount: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  reactionCountActive: {
    color: theme.textPrimary,
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

  // Picker Modal
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  pickerBlur: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
  },
  pickerOption: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 26,
  },
  pickerEmoji: {
    fontSize: 32,
  },

  // Reactors Modal
  reactorsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  reactorsContainer: {
    width: '100%',
    maxWidth: 280,
    maxHeight: '60%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  reactorsBlur: {
    overflow: 'hidden',
    borderRadius: 20,
  },
  reactorsContent: {
    backgroundColor: 'rgba(15, 20, 35, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  reactorsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  reactorsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  reactorsList: {
    maxHeight: 280,
  },
  reactorsEmpty: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  reactorsEmptyText: {
    fontSize: 13,
    color: theme.textMuted,
  },
  reactorGroup: {
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  reactorGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  reactorGroupEmoji: {
    fontSize: 16,
  },
  reactorGroupCount: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textMuted,
  },
  reactorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  reactorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  reactorName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: theme.textPrimary,
  },
});