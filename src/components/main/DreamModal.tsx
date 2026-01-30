import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AnimatedGradientBackground from '../common/AnimatedGradientBackground';
import PlayButton from '../common/PlayButton';
import InterpretationThread from './InterpretationThread';
import { supabase } from '../../lib/supabase';
import { theme, TAG_EMOJIS } from '../../constants/theme';
import { DreamWithMeta, UserProfile, Interpretation, AudioContext, ReactionType } from '../../types/dreams';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.82;
const DISMISS_THRESHOLD = 80;

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
  onEdit: (dream: DreamWithMeta) => void;
  onPlayAudio: (dream: DreamWithMeta, context: AudioContext) => void;
  onReact: (dream: DreamWithMeta, reaction: ReactionType) => void;
  onRemoveReaction: (dream: DreamWithMeta) => void;
  onAddInterpretation: () => void;
  onProfilePress: (profile: UserProfile | null, userId: string) => void;
}

const getAvatarUrl = (profile: UserProfile | null | undefined, fallback: string) => {
  if (profile?.avatar_url?.startsWith('http')) return profile.avatar_url;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    profile?.display_name || profile?.username || fallback
  )}&background=1e293b&color=60a5fa&size=128`;
};

const formatDate = (dateString: string) => {
  const d = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatSec = (s: number | null) => {
  if (!s || s < 0) return '0:00';
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const formatMs = (ms: number) => {
  if (!ms || ms < 0) return '0:00';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
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

// Reactors List Modal
const ReactorsModal = ({
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
                    <Ionicons name="close" size={22} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>

                {loading ? (
                  <ActivityIndicator color={theme.gold} style={{ marginVertical: 40 }} />
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
                          <Text style={styles.reactorGroupLabel}>
                            {REACTIONS[type].label} ({grouped[type]?.length})
                          </Text>
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
                            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
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
  onEdit,
  onPlayAudio,
  onReact,
  onRemoveReaction,
  onAddInterpretation,
  onProfilePress,
}: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [showPicker, setShowPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReactors, setShowReactors] = useState(false);
  const [reactors, setReactors] = useState<Reactor[]>([]);
  const [reactorsLoading, setReactorsLoading] = useState(false);
  const pickerScale = useRef(new Animated.Value(0)).current;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 5 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) {
          translateY.setValue(g.dy);
          opacity.setValue(1 - g.dy / 250);
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_THRESHOLD || g.vy > 0.3) {
          close();
        } else {
          Animated.parallel([
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 10 }),
            Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
          ]).start();
        }
      },
    })
  ).current;

  React.useEffect(() => {
    if (visible) {
      translateY.setValue(SHEET_HEIGHT);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 9, tension: 45 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  React.useEffect(() => {
    if (showPicker) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.spring(pickerScale, { toValue: 1, useNativeDriver: true, friction: 7 }).start();
    } else {
      pickerScale.setValue(0);
    }
  }, [showPicker]);

  const close = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(translateY, { toValue: SHEET_HEIGHT, duration: 220, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      onClose();
      translateY.setValue(SHEET_HEIGHT);
    });
  }, [onClose]);

  const handleReactionTap = () => {
    if (dream?.userReaction) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onRemoveReaction(dream);
    } else {
      setShowPicker(true);
    }
  };

  const handleReactionLongPress = async () => {
    if (!dream) return;
    setShowReactors(true);
    setReactorsLoading(true);

    try {
      const { data, error } = await supabase
        .from('dream_reactions')
        .select('id, user_id, reaction_type')
        .eq('dream_id', dream.id)
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

  const selectReaction = (type: ReactionType) => {
    setShowPicker(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (dream) onReact(dream, type);
  };

  if (!dream) return null;

  const playing = playingId === dream.id && playingContext === 'modal' && audioStatus.playing;
  const active = playingId === dream.id && playingContext === 'modal';
  const mine = dream.user_id === currentUserId;
  const progress = active && audioStatus.duration > 0 ? (audioStatus.currentTime / audioStatus.duration) * 100 : 0;
  const name = mine ? 'You' : dream.authorProfile?.display_name || dream.authorProfile?.username || 'Dreamer';
  const avatar = getAvatarUrl(dream.authorProfile || null, name);
  const canDecipher = dream.interpretation_mode && dream.interpretation_mode !== 'disabled';
  const reaction = dream.userReaction as ReactionType | null;
  const hasReactions = (dream.reactionCount ?? 0) > 0;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <View style={styles.container}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        </Animated.View>

        {/* Sheet with Animated Gradient */}
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]} {...pan.panHandlers}>
          <AnimatedGradientBackground>
            {/* Handle */}
            <View style={styles.handle}>
              <View style={styles.pill} />
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Author */}
              <Pressable
                style={styles.author}
                onPress={() => onProfilePress(dream.authorProfile || null, dream.user_id)}
              >
                <Image source={{ uri: avatar }} style={styles.avatar} />
                <View style={styles.authorInfo}>
                  <Text style={styles.name}>{name}</Text>
                  <Text style={styles.time}>{formatDate(dream.dream_date)}</Text>
                </View>
                {mine && (
                  <TouchableOpacity style={styles.menuBtn} onPress={() => setShowMenu(true)}>
                    <Ionicons name="ellipsis-horizontal" size={18} color={theme.textMuted} />
                  </TouchableOpacity>
                )}
              </Pressable>

              {/* Tag */}
              {dream.dream_tag && (
                <View style={styles.tag}>
                  <Text style={styles.tagIcon}>{TAG_EMOJIS[dream.dream_tag] || '✨'}</Text>
                  <Text style={styles.tagText}>{dream.dream_tag}</Text>
                </View>
              )}

              {/* Content */}
              {dream.title && <Text style={styles.title}>{dream.title}</Text>}
              {dream.content && <Text style={styles.body}>{dream.content}</Text>}

              {/* Audio */}
              {dream.audio_url && (
                <View style={styles.audio}>
                  <PlayButton
                    isPlaying={playing}
                    isLoading={isAudioLoading === dream.id}
                    onPress={() => onPlayAudio(dream, 'modal')}
                    size="medium"
                  />
                  <View style={styles.track}>
                    <View style={styles.bar}>
                      <View style={[styles.fill, { width: `${progress}%` }]} />
                    </View>
                    <View style={styles.times}>
                      <Text style={styles.timeText}>{active ? formatMs(audioStatus.currentTime) : '0:00'}</Text>
                      <Text style={styles.timeText}>{formatSec(dream.audio_duration)}</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionBtn, reaction && styles.actionBtnActive]}
                  onPress={handleReactionTap}
                  onLongPress={hasReactions ? handleReactionLongPress : undefined}
                  delayLongPress={300}
                  activeOpacity={0.7}
                >
                  {reaction ? (
                    <Text style={styles.emoji}>{REACTIONS[reaction].emoji}</Text>
                  ) : (
                    <Ionicons name="heart-outline" size={20} color={theme.textMuted} />
                  )}
                  {hasReactions && (
                    <Text style={[styles.count, reaction && styles.countActive]}>{dream.reactionCount}</Text>
                  )}
                </TouchableOpacity>

                {/* Interpretations - Static icon */}
                {canDecipher && (dream.interpretationCount ?? 0) > 0 && (
                  <View style={styles.stat}>
                    <Ionicons name="chatbubble-outline" size={16} color={theme.textMuted} />
                    <Text style={styles.statNum}>{dream.interpretationCount}</Text>
                  </View>
                )}

                <View style={{ flex: 1 }} />

                {/* Decipher with animated microscope */}
                {canDecipher && !mine && (
                  <TouchableOpacity style={styles.decipher} onPress={onAddInterpretation} activeOpacity={0.8}>
                    <AnimatedMicroscopeIcon />
                    <Text style={styles.decipherText}>Decipher</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Interpretations */}
              {canDecipher && (
                <View style={styles.section}>
                  {interpretationsLoading ? (
                    <ActivityIndicator color={theme.gold} style={{ marginVertical: 20 }} />
                  ) : interpretations.length > 0 ? (
                    <>
                      <Text style={styles.sectionTitle}>{interpretations.length} Interpretations</Text>
                      {interpretations.map((i) => (
                        <InterpretationThread key={i.id} interpretation={i} onProfilePress={onProfilePress} />
                      ))}
                    </>
                  ) : mine ? (
                    <View style={styles.empty}>
                      <Ionicons name="chatbubble-outline" size={24} color={theme.textMuted} />
                      <Text style={styles.emptyText}>Awaiting interpretations</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </ScrollView>

            {/* Reaction Picker */}
            {showPicker && (
              <Pressable style={styles.pickerWrap} onPress={() => setShowPicker(false)}>
                <Animated.View style={[styles.picker, { transform: [{ scale: pickerScale }] }]}>
                  {(Object.keys(REACTIONS) as ReactionType[]).map((t) => (
                    <TouchableOpacity key={t} style={styles.pickerBtn} onPress={() => selectReaction(t)}>
                      <Text style={styles.pickerEmoji}>{REACTIONS[t].emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </Animated.View>
              </Pressable>
            )}
          </AnimatedGradientBackground>
        </Animated.View>

        {/* Reactors Modal */}
        <ReactorsModal
          visible={showReactors}
          onClose={() => setShowReactors(false)}
          reactors={reactors}
          loading={reactorsLoading}
          onProfilePress={onProfilePress}
        />

        {/* Menu */}
        {showMenu && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
            <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
              <View style={[styles.menu, { paddingBottom: insets.bottom + 8 }]}>
                <View style={styles.menuCard}>
                  <TouchableOpacity
                    style={styles.menuRow}
                    onPress={() => {
                      setShowMenu(false);
                      onEdit(dream);
                    }}
                  >
                    <Ionicons name="pencil" size={20} color={theme.textPrimary} />
                    <Text style={styles.menuText}>Edit</Text>
                  </TouchableOpacity>
                  <View style={styles.menuDivider} />
                  <TouchableOpacity
                    style={styles.menuRow}
                    onPress={() => {
                      setShowMenu(false);
                      onDelete(dream.id);
                    }}
                  >
                    <Ionicons name="trash" size={20} color={theme.danger} />
                    <Text style={[styles.menuText, { color: theme.danger }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowMenu(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  handle: { alignItems: 'center', paddingVertical: 12 },
  pill: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  scroll: { flex: 1, paddingHorizontal: 20 },

  author: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  authorInfo: { flex: 1, marginLeft: 12 },
  name: { fontSize: 16, fontWeight: '600', color: theme.textPrimary },
  time: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  menuBtn: { padding: 8 },

  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 16,
    gap: 5,
  },
  tagIcon: { fontSize: 12 },
  tagText: { fontSize: 12, color: theme.textSecondary, textTransform: 'capitalize' },

  title: { fontSize: 24, fontWeight: '700', color: theme.textPrimary, marginBottom: 12, lineHeight: 30 },
  body: { fontSize: 16, color: theme.textSecondary, lineHeight: 24, marginBottom: 20 },

  audio: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
    padding: 12,
    gap: 12,
    marginBottom: 20,
  },
  track: { flex: 1 },
  bar: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: theme.gold },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  timeText: { fontSize: 11, color: theme.textMuted, fontVariant: ['tabular-nums'] },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 20,
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    gap: 6,
  },
  actionBtnActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  emoji: { fontSize: 18 },
  count: { fontSize: 14, fontWeight: '600', color: theme.textMuted },
  countActive: { color: theme.textPrimary },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statNum: { fontSize: 13, color: theme.textMuted },
  decipher: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.gold + '15',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    gap: 6,
  },
  decipherText: { fontSize: 14, fontWeight: '600', color: theme.gold },

  section: { marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.textMuted, marginBottom: 14, letterSpacing: 0.3 },
  empty: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyText: { fontSize: 14, color: theme.textMuted },

  pickerWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  picker: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30,30,30,0.95)',
    borderRadius: 24,
    padding: 8,
    gap: 4,
  },
  pickerBtn: { padding: 12 },
  pickerEmoji: { fontSize: 32 },

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
    maxWidth: 320,
    maxHeight: '70%',
    borderRadius: 24,
    overflow: 'hidden',
  },
  reactorsBlur: {
    overflow: 'hidden',
    borderRadius: 24,
  },
  reactorsContent: {
    backgroundColor: 'rgba(15, 20, 35, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 24,
  },
  reactorsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  reactorsTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  reactorsList: {
    maxHeight: 350,
  },
  reactorsEmpty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  reactorsEmptyText: {
    fontSize: 14,
    color: theme.textMuted,
  },
  reactorGroup: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  reactorGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  reactorGroupEmoji: {
    fontSize: 20,
  },
  reactorGroupLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  reactorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  reactorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  reactorName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: theme.textPrimary,
  },

  // Menu
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  menu: { paddingHorizontal: 10, gap: 8 },
  menuCard: { backgroundColor: 'rgba(44,44,46,0.98)', borderRadius: 14, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18, gap: 12 },
  menuText: { fontSize: 17, color: theme.textPrimary },
  menuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.1)', marginLeft: 50 },
  cancelBtn: { backgroundColor: 'rgba(44,44,46,0.98)', borderRadius: 14, alignItems: 'center', paddingVertical: 16 },
  cancelText: { fontSize: 17, fontWeight: '600', color: theme.primary },
});