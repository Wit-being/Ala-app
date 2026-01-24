import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  BackHandler,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const { width, height } = Dimensions.get('window');

// Base theme
const theme = {
  background: '#050a15',
  glass: 'rgba(255, 255, 255, 0.06)',
  glassMedium: 'rgba(255, 255, 255, 0.08)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  glassBorderLight: 'rgba(255, 255, 255, 0.15)',
  primary: '#60a5fa',
  primaryDark: '#3b82f6',
  gold: '#d4af37',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textSubtle: '#64748b',
  textMuted: '#475569',
  danger: '#ef4444',
  success: '#10b981',
  purple: '#a78bfa',
};

// Mood-based gradient palettes
const MOOD_GRADIENTS: { [key: string]: string[] } = {
  default: ['#050a15', '#0a1628', '#0f172a'],
  peaceful: ['#051515', '#0a2828', '#0f3535'],
  exciting: ['#150a05', '#281a0a', '#35250f'],
  scary: ['#150510', '#28081a', '#350a25'],
  confusing: ['#0f0a15', '#1a1028', '#251535'],
  sad: ['#050a15', '#081428', '#0a1a35'],
  happy: ['#15150a', '#28281a', '#353525'],
  weird: ['#150a15', '#281a28', '#352535'],
  vivid: ['#0a1015', '#142028', '#1a3035'],
  custom: ['#100a15', '#1a1428', '#251a35'],
};

type InterpretationMode = 'disabled' | 'public' | 'private' | 'verified_only';

interface MoodOption {
  id: string;
  icon: string;
  label: string;
}

const MOODS: MoodOption[] = [
  { id: 'peaceful', icon: '😌', label: 'Peaceful' },
  { id: 'exciting', icon: '🤩', label: 'Exciting' },
  { id: 'scary', icon: '😨', label: 'Scary' },
  { id: 'confusing', icon: '😕', label: 'Confusing' },
  { id: 'sad', icon: '😢', label: 'Sad' },
  { id: 'happy', icon: '😊', label: 'Happy' },
  { id: 'weird', icon: '🤪', label: 'Weird' },
  { id: 'vivid', icon: '✨', label: 'Vivid' },
  { id: 'custom', icon: '✏️', label: 'Other' },
];

const NUM_BARS = 32;

// Poetic prompts that rotate
const RECORDING_PROMPTS = [
  'Whisper your dream...',
  'What did you see?',
  'Tell us what happened...',
  'Speak your vision...',
  'Share the story...',
];

export default function RecordDreamScreen({ navigation }: any) {
  const user = useAuthStore((state) => state.user);

  // Audio Recorder
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  // Audio Player
  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // Form State - Medium-style single editor
  const [dreamContent, setDreamContent] = useState('');
  const [dreamDate, setDreamDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [customMood, setCustomMood] = useState('');
  const [showCustomMoodInput, setShowCustomMoodInput] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [interpretationMode, setInterpretationMode] = useState<InterpretationMode>('disabled');
  const [enableEngagement, setEnableEngagement] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnims = useRef(Array.from({ length: NUM_BARS }, () => new Animated.Value(0.3))).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const gradientAnim = useRef(new Animated.Value(0)).current;

  // Random prompt
  const [promptIndex] = useState(Math.floor(Math.random() * RECORDING_PROMPTS.length));

  // Extract title from content (Medium-style)
  const extractedTitle = useMemo(() => {
    if (!dreamContent.trim()) return '';
    const lines = dreamContent.split('\n');
    const firstLine = lines[0].trim();
    // If first line is short enough, use it as title
    if (firstLine.length <= 60) return firstLine;
    // Otherwise, take first 60 chars and add ellipsis
    return firstLine.substring(0, 57) + '...';
  }, [dreamContent]);

  const extractedContent = useMemo(() => {
    if (!dreamContent.trim()) return '';
    const lines = dreamContent.split('\n');
    if (lines.length <= 1) return '';
    return lines.slice(1).join('\n').trim();
  }, [dreamContent]);

  const hasContent = dreamContent.trim() || audioUri;

  // Mood-based gradient colors
  const currentGradient = useMemo(() => {
    const moodKey = selectedMood || 'default';
    return MOOD_GRADIENTS[moodKey] || MOOD_GRADIENTS.default;
  }, [selectedMood]);

  // Animate gradient change
  useEffect(() => {
    Animated.timing(gradientAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: false,
    }).start(() => gradientAnim.setValue(0));
  }, [selectedMood]);

  // Handle back with confirmation
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => backHandler.remove();
  }, [hasContent]);

  const handleBack = () => {
    if (hasContent) {
      Alert.alert('Discard Dream?', 'Your dream will be lost. Are you sure?', [
        { text: 'Keep Editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            player.pause();
            navigation.goBack();
          },
        },
      ]);
    } else {
      navigation.goBack();
    }
  };

  // Pulse animation
  useEffect(() => {
    let animation: Animated.CompositeAnimation;
    if (isRecording) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.5, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => animation?.stop();
  }, [isRecording]);

  // Waveform animation
  useEffect(() => {
    let animations: Animated.CompositeAnimation[] = [];
    if (isRecording) {
      waveAnims.forEach((anim, index) => {
        const delay = index * 30;
        const animation = Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 0.4 + Math.random() * 0.6,
              duration: 200 + Math.random() * 300,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.2 + Math.random() * 0.2,
              duration: 200 + Math.random() * 300,
              useNativeDriver: true,
            }),
          ])
        );
        animation.start();
        animations.push(animation);
      });
    } else {
      waveAnims.forEach((anim) => {
        Animated.timing(anim, { toValue: 0.3, duration: 300, useNativeDriver: true }).start();
      });
    }
    return () => animations.forEach((a) => a.stop());
  }, [isRecording]);

  // Track duration
  useEffect(() => {
    if (recorderState.isRecording) {
      setRecordingDuration(Math.floor(recorderState.durationMillis / 1000));
    }
  }, [recorderState.durationMillis]);

  // Reset options when private
  useEffect(() => {
    if (!isPublic) {
      setInterpretationMode('disabled');
      setEnableEngagement(false);
    }
  }, [isPublic]);

  // Monitor playback
  useEffect(() => {
    setIsPreviewPlaying(playerStatus.playing);
  }, [playerStatus.playing]);

  useEffect(() => {
    if (playerStatus.didJustFinish) setIsPreviewPlaying(false);
  }, [playerStatus.didJustFinish]);

  // Progress animation
  useEffect(() => {
    if (playerStatus.duration > 0) {
      const progress = playerStatus.currentTime / playerStatus.duration;
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 100,
        useNativeDriver: false,
      }).start();
    }
  }, [playerStatus.currentTime, playerStatus.duration]);

  useEffect(() => {
    return () => player.pause();
  }, []);

  const startRecording = async () => {
    try {
      const { status } = await AudioModule.requestRecordingPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow microphone access to record dreams');
        return;
      }

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (isPreviewPlaying) player.pause();
      setAudioUri(null);

      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setRecordingDuration(0);
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (uri) setAudioUri(uri);
      setIsRecording(false);
    } catch (err) {
      console.error('Failed to stop recording', err);
      setIsRecording(false);
    }
  };

  const togglePreview = async () => {
    if (!audioUri) return;
    try {
      if (isPreviewPlaying) {
        player.pause();
      } else {
        await player.replace({ uri: audioUri });
        await player.play();
      }
    } catch (err) {
      console.error('Preview error:', err);
    }
  };

  const seekPreview = (position: number) => {
    if (playerStatus.duration > 0) {
      player.seekTo(position * playerStatus.duration);
    }
  };

  const saveDream = async (isDraft = false) => {
    if (!dreamContent.trim() && !audioUri) {
      Alert.alert('Empty Dream', 'Please record or write something before saving.');
      return;
    }

    setSaving(true);

    try {
      let audioUrl = null;
      if (isPreviewPlaying) player.pause();

      if (audioUri) {
        const fileExt = audioUri.split('.').pop() || 'm4a';
        const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
        const bucket = isPublic ? 'ala-audio' : 'ala-audio-private';

        const formData = new FormData();
        formData.append('file', { uri: audioUri, name: fileName, type: `audio/${fileExt}` } as any);

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fileName, formData, { contentType: `audio/${fileExt}`, upsert: false });

        if (uploadError) throw uploadError;

        if (isPublic) {
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
          audioUrl = urlData.publicUrl;
        } else {
          audioUrl = fileName;
        }
      }

      const moodValue = selectedMood === 'custom' ? customMood.trim() || 'custom' : selectedMood;

      const { error: dbError } = await supabase.from('dreams').insert({
        user_id: user?.id,
        title: extractedTitle || null,
        content: extractedContent || dreamContent.trim() || null,
        audio_url: audioUrl,
        is_public: isPublic,
        status: isDraft ? 'draft' : 'published',
        interpretation_mode: isPublic ? interpretationMode : 'disabled',
        enable_engagement: isPublic ? enableEngagement : false,
        dream_date: dreamDate.toISOString().split('T')[0],
        mood: moodValue,
      });

      if (dbError) throw dbError;

      const message = isDraft
        ? 'Saved to drafts'
        : isPublic
        ? 'Shared with the community'
        : 'Added to your journal';

      Alert.alert('Dream Captured ✨', message, [{ text: 'Done', onPress: () => navigation.goBack() }]);
    } catch (error: any) {
      console.error('Error saving dream:', error);
      Alert.alert('Error', error.message || 'Failed to save dream');
    } finally {
      setSaving(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPlayerTime = (ms: number) => {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDateLabel = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Last Night';
    if (date.toDateString() === yesterday.toDateString()) return 'Night Before';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const selectMood = (moodId: string) => {
    if (moodId === 'custom') {
      setSelectedMood('custom');
      setShowCustomMoodInput(true);
    } else {
      setSelectedMood(selectedMood === moodId ? null : moodId);
      setShowCustomMoodInput(false);
      setCustomMood('');
    }
  };

  // Waveform Bar
  const WaveformBar = ({ anim, index }: { anim: Animated.Value; index: number }) => {
    const isCenter = Math.abs(index - NUM_BARS / 2) < NUM_BARS / 4;
    return (
      <Animated.View
        style={[
          styles.waveBar,
          {
            transform: [{ scaleY: anim }],
            opacity: isCenter ? 1 : 0.6,
            backgroundColor: isCenter ? theme.primary : theme.textSubtle,
          },
        ]}
      />
    );
  };

  // Custom Date Picker Modal
  const DatePickerModal = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const quickDates = [
      { label: 'Last Night', date: today },
      { label: 'Night Before', date: yesterday },
      { label: '2 Days Ago', date: twoDaysAgo },
    ];

    return (
      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <Pressable style={styles.dateModalOverlay} onPress={() => setShowDatePicker(false)}>
          <Pressable style={styles.dateModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dateModalHeader}>
              <Text style={styles.dateModalTitle}>When did you dream this?</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.dateModalClose}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.quickDates}>
              {quickDates.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.quickDateBtn,
                    dreamDate.toDateString() === item.date.toDateString() && styles.quickDateBtnActive,
                  ]}
                  onPress={() => {
                    setDreamDate(item.date);
                    setShowDatePicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.quickDateText,
                      dreamDate.toDateString() === item.date.toDateString() && styles.quickDateTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text style={styles.quickDateSub}>
                    {item.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.dateModalDivider}>
              <View style={styles.dateModalDividerLine} />
              <Text style={styles.dateModalDividerText}>or pick a date</Text>
              <View style={styles.dateModalDividerLine} />
            </View>

            {/* Simple date selector for older dates */}
            <View style={styles.olderDateSection}>
              <Text style={styles.olderDateHint}>For dreams older than 2 days</Text>
              <TouchableOpacity
                style={styles.olderDateBtn}
                onPress={() => {
                  // For MVP, we'll use a simple approach
                  // In production, you'd use a proper calendar component
                  Alert.alert(
                    'Select Date',
                    'For MVP, dreams can be logged from the last 3 nights. Full calendar coming soon!',
                    [{ text: 'OK' }]
                  );
                }}
              >
                <Ionicons name="calendar-outline" size={20} color={theme.textSecondary} />
                <Text style={styles.olderDateBtnText}>Choose from Calendar</Text>
                <View style={styles.comingSoonPill}>
                  <Text style={styles.comingSoonPillText}>Soon</Text>
                </View>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  // Custom Mood Input Modal
  const CustomMoodModal = () => (
    <Modal visible={showCustomMoodInput} transparent animationType="fade" onRequestClose={() => setShowCustomMoodInput(false)}>
      <Pressable style={styles.dateModalOverlay} onPress={() => setShowCustomMoodInput(false)}>
        <Pressable style={styles.customMoodContent} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.customMoodTitle}>How did this dream feel?</Text>
          <TextInput
            style={styles.customMoodInput}
            placeholder="Describe the feeling..."
            placeholderTextColor={theme.textMuted}
            value={customMood}
            onChangeText={setCustomMood}
            autoFocus
            maxLength={30}
          />
          <View style={styles.customMoodActions}>
            <TouchableOpacity
              style={styles.customMoodCancel}
              onPress={() => {
                setShowCustomMoodInput(false);
                setSelectedMood(null);
                setCustomMood('');
              }}
            >
              <Text style={styles.customMoodCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.customMoodSave, !customMood.trim() && styles.customMoodSaveDisabled]}
              onPress={() => {
                if (customMood.trim()) {
                  setShowCustomMoodInput(false);
                }
              }}
              disabled={!customMood.trim()}
            >
              <Text style={styles.customMoodSaveText}>Done</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  return (
    <LinearGradient colors={currentGradient as any} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color={theme.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => saveDream(false)}
            style={[styles.headerSaveBtn, (!hasContent || saving) && styles.headerSaveBtnDisabled]}
            disabled={!hasContent || saving}
          >
            <Text style={[styles.headerSaveText, (!hasContent || saving) && styles.headerSaveTextDisabled]}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Recording Section */}
            <View style={styles.recordSection}>
              {/* Idle */}
              {!isRecording && !audioUri && (
                <View style={styles.recordIdle}>
                  <TouchableOpacity onPress={startRecording} activeOpacity={0.8} style={styles.recordBtnWrapper}>
                    <View style={styles.recordBtnOuter}>
                      <LinearGradient colors={[theme.primary, theme.primaryDark]} style={styles.recordBtn}>
                        <Ionicons name="mic" size={32} color="#fff" />
                      </LinearGradient>
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.recordPrompt}>{RECORDING_PROMPTS[promptIndex]}</Text>
                  <Text style={styles.recordSubPrompt}>or write it below</Text>
                </View>
              )}

              {/* Recording */}
              {isRecording && (
                <View style={styles.recordingActive}>
                  {/* Waveform */}
                  <View style={styles.waveformContainer}>
                    {waveAnims.map((anim, i) => (
                      <WaveformBar key={i} anim={anim} index={i} />
                    ))}
                  </View>

                  {/* Timer */}
                  <Text style={styles.recordingTimer}>{formatDuration(recordingDuration)}</Text>

                  {/* Stop Button */}
                  <TouchableOpacity onPress={stopRecording} style={styles.stopBtnWrapper}>
                    <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
                    <View style={styles.stopBtn}>
                      <View style={styles.stopBtnInner} />
                    </View>
                  </TouchableOpacity>

                  <Text style={styles.recordingHint}>Tap to stop</Text>
                </View>
              )}

              {/* Preview */}
              {audioUri && !isRecording && (
                <View style={styles.previewState}>
                  <View style={styles.previewTop}>
                    <View style={styles.previewCheck}>
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    </View>
                    <Text style={styles.previewLabel}>{formatDuration(recordingDuration)} recorded</Text>
                  </View>

                  {/* Player */}
                  <View style={styles.playerContainer}>
                    <TouchableOpacity onPress={togglePreview} style={styles.playPauseBtn}>
                      <Ionicons name={isPreviewPlaying ? 'pause' : 'play'} size={22} color="#fff" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.progressBarTouch}
                      activeOpacity={1}
                      onPress={(e) => {
                        const x = e.nativeEvent.locationX;
                        const barWidth = width - 180;
                        seekPreview(Math.max(0, Math.min(1, x / barWidth)));
                      }}
                    >
                      <View style={styles.progressBarBg}>
                        <Animated.View
                          style={[
                            styles.progressBarFill,
                            {
                              width: progressAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', '100%'],
                              }),
                            },
                          ]}
                        />
                      </View>
                    </TouchableOpacity>

                    <Text style={styles.playerTime}>
                      {formatPlayerTime(playerStatus.currentTime)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      if (isPreviewPlaying) player.pause();
                      setAudioUri(null);
                      setRecordingDuration(0);
                    }}
                    style={styles.reRecordBtn}
                  >
                    <Ionicons name="refresh" size={16} color={theme.primary} />
                    <Text style={styles.reRecordText}>Record again</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Medium-style Editor */}
            <View style={styles.editorSection}>
              {/* Date pill */}
              <TouchableOpacity style={styles.datePill} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="moon-outline" size={14} color={theme.textSubtle} />
                <Text style={styles.datePillText}>{formatDateLabel(dreamDate)}</Text>
                <Ionicons name="chevron-down" size={14} color={theme.textMuted} />
              </TouchableOpacity>

              {/* Title preview (if content exists) */}
              {extractedTitle && (
                <Text style={styles.titlePreview}>{extractedTitle}</Text>
              )}

              {/* Main editor */}
              <TextInput
                style={[styles.dreamEditor, extractedTitle ? styles.dreamEditorWithTitle : null]}
                placeholder="Start with a title, then describe your dream..."
                placeholderTextColor={theme.textMuted}
                value={dreamContent}
                onChangeText={setDreamContent}
                multiline
                textAlignVertical="top"
                scrollEnabled={false}
              />

              {/* Formatting hint */}
              {!dreamContent && (
                <Text style={styles.editorHint}>
                  First line becomes the title
                </Text>
              )}
            </View>

            {/* Mood Section */}
            <View style={styles.moodSection}>
              <Text style={styles.sectionLabel}>The dream felt...</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.moodScroll}
              >
                {MOODS.map((mood) => {
                  const isSelected = selectedMood === mood.id;
                  const displayLabel = mood.id === 'custom' && customMood ? customMood : mood.label;
                  
                  return (
                    <TouchableOpacity
                      key={mood.id}
                      style={[styles.moodChip, isSelected && styles.moodChipActive]}
                      onPress={() => selectMood(mood.id)}
                    >
                      <Text style={styles.moodEmoji}>{mood.icon}</Text>
                      <Text style={[styles.moodLabel, isSelected && styles.moodLabelActive]}>
                        {displayLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Visibility */}
            <View style={styles.visibilitySection}>
              <TouchableOpacity
                style={[styles.visibilityCard, !isPublic && styles.visibilityCardActive]}
                onPress={() => setIsPublic(false)}
              >
                <View style={[styles.visibilityIcon, !isPublic && styles.visibilityIconActiveGold]}>
                  <Ionicons name="journal" size={20} color={!isPublic ? theme.gold : theme.textMuted} />
                </View>
                <View style={styles.visibilityInfo}>
                  <Text style={[styles.visibilityTitle, !isPublic && styles.visibilityTitleActiveGold]}>
                    Private Journal
                  </Text>
                  <Text style={styles.visibilityDesc}>Only you can see this</Text>
                </View>
                {!isPublic && <Ionicons name="checkmark-circle" size={22} color={theme.gold} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.visibilityCard, isPublic && styles.visibilityCardActiveBlue]}
                onPress={() => setIsPublic(true)}
              >
                <View style={[styles.visibilityIcon, isPublic && styles.visibilityIconActiveBlue]}>
                  <Ionicons name="globe" size={20} color={isPublic ? theme.primary : theme.textMuted} />
                </View>
                <View style={styles.visibilityInfo}>
                  <Text style={[styles.visibilityTitle, isPublic && styles.visibilityTitleActive]}>
                    Share with Community
                  </Text>
                  <Text style={styles.visibilityDesc}>Let others interpret</Text>
                </View>
                {isPublic && <Ionicons name="checkmark-circle" size={22} color={theme.primary} />}
              </TouchableOpacity>
            </View>

            {/* Advanced Options */}
            {isPublic && (
              <>
                <TouchableOpacity
                  style={styles.advancedToggle}
                  onPress={() => setShowAdvanced(!showAdvanced)}
                >
                  <Text style={styles.advancedToggleText}>Sharing options</Text>
                  <Ionicons
                    name={showAdvanced ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={theme.textMuted}
                  />
                </TouchableOpacity>

                {showAdvanced && (
                  <View style={styles.advancedContent}>
                    {/* Interpretations */}
                    <View style={styles.optionGroup}>
                      <Text style={styles.optionTitle}>Community Interpretations</Text>
                      <View style={styles.interpretationRow}>
                        {[
                          { id: 'disabled', label: 'Off', icon: 'close-circle-outline' },
                          { id: 'public', label: 'Public', icon: 'chatbubbles-outline' },
                          { id: 'private', label: 'Private', icon: 'eye-off-outline' },
                        ].map((mode) => (
                          <TouchableOpacity
                            key={mode.id}
                            style={[
                              styles.interpOption,
                              interpretationMode === mode.id && styles.interpOptionActive,
                            ]}
                            onPress={() => setInterpretationMode(mode.id as InterpretationMode)}
                          >
                            <Ionicons
                              name={mode.icon as any}
                              size={16}
                              color={interpretationMode === mode.id ? theme.primary : theme.textSubtle}
                            />
                            <Text
                              style={[
                                styles.interpLabel,
                                interpretationMode === mode.id && styles.interpLabelActive,
                              ]}
                            >
                              {mode.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Likes */}
                    <TouchableOpacity
                      style={styles.likesToggle}
                      onPress={() => setEnableEngagement(!enableEngagement)}
                    >
                      <View style={styles.likesInfo}>
                        <Ionicons
                          name={enableEngagement ? 'heart' : 'heart-outline'}
                          size={18}
                          color={enableEngagement ? theme.danger : theme.textSubtle}
                        />
                        <Text style={[styles.likesText, enableEngagement && styles.likesTextActive]}>
                          Allow likes
                        </Text>
                      </View>
                      <View style={[styles.toggleTrack, enableEngagement && styles.toggleTrackActive]}>
                        <View style={[styles.toggleThumb, enableEngagement && styles.toggleThumbActive]} />
                      </View>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            {/* AI Section */}
            <View style={styles.aiCard}>
              <View style={styles.aiCardInner}>
                <Ionicons name="sparkles" size={18} color={theme.gold} />
                <View style={styles.aiCardText}>
                  <Text style={styles.aiCardTitle}>AI Dream Analysis</Text>
                  <Text style={styles.aiCardDesc}>Unlock deeper meanings</Text>
                </View>
                <View style={styles.aiCardBadge}>
                  <Text style={styles.aiCardBadgeText}>Soon</Text>
                </View>
              </View>
            </View>

            {/* Draft Button */}
            <TouchableOpacity
              style={styles.draftBtn}
              onPress={() => saveDream(true)}
              disabled={saving || !hasContent}
            >
              <Ionicons name="bookmark-outline" size={16} color={theme.textSecondary} />
              <Text style={styles.draftBtnText}>Save as draft</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <DatePickerModal />
      <CustomMoodModal />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: {
    padding: 8,
  },
  headerSaveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.primary,
  },
  headerSaveBtnDisabled: {
    backgroundColor: theme.glass,
  },
  headerSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  headerSaveTextDisabled: {
    color: theme.textMuted,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Recording
  recordSection: {
    marginBottom: 24,
  },
  recordIdle: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  recordBtnWrapper: {},
  recordBtnOuter: {
    padding: 4,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  recordBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordPrompt: {
    fontSize: 18,
    fontWeight: '500',
    color: theme.textPrimary,
    marginTop: 20,
  },
  recordSubPrompt: {
    fontSize: 14,
    color: theme.textMuted,
    marginTop: 6,
  },

  // Recording Active
  recordingActive: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    gap: 2,
    marginBottom: 20,
  },
  waveBar: {
    width: 3,
    height: 40,
    borderRadius: 1.5,
  },
  recordingTimer: {
    fontSize: 48,
    fontWeight: '700',
    color: theme.textPrimary,
    fontVariant: ['tabular-nums'],
    marginBottom: 24,
  },
  stopBtnWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  stopBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopBtnInner: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: theme.danger,
  },
  recordingHint: {
    fontSize: 13,
    color: theme.textMuted,
    marginTop: 16,
  },

  // Preview
  previewState: {
    backgroundColor: theme.glass,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  previewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  previewCheck: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  previewLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.textPrimary,
  },
  playerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playPauseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBarTouch: {
    flex: 1,
    height: 32,
    justifyContent: 'center',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.gold,
  },
  playerTime: {
    fontSize: 12,
    color: theme.textSubtle,
    fontVariant: ['tabular-nums'],
    width: 40,
  },
  reRecordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 14,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.glassBorder,
  },
  reRecordText: {
    fontSize: 14,
    color: theme.primary,
    fontWeight: '500',
  },

  // Editor
  editorSection: {
    marginBottom: 24,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    marginBottom: 16,
  },
  datePillText: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  titlePreview: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  dreamEditor: {
    fontSize: 17,
    color: theme.textPrimary,
    lineHeight: 26,
    minHeight: 150,
  },
  dreamEditorWithTitle: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  editorHint: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 8,
    fontStyle: 'italic',
  },

  // Mood
  moodSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 12,
  },
  moodScroll: {
    gap: 8,
  },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  moodChipActive: {
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    borderColor: theme.primary,
  },
  moodEmoji: {
    fontSize: 16,
  },
  moodLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  moodLabelActive: {
    color: theme.primary,
  },

  // Visibility
  visibilitySection: {
    gap: 10,
    marginBottom: 20,
  },
  visibilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  visibilityCardActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  visibilityCardActiveBlue: {
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  visibilityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.glass,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  visibilityIconActiveGold: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  visibilityIconActiveBlue: {
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
  },
  visibilityInfo: {
    flex: 1,
  },
  visibilityTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  visibilityTitleActive: {
    color: theme.primary,
  },
  visibilityTitleActiveGold: {
    color: theme.gold,
  },
  visibilityDesc: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 2,
  },

  // Advanced
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  advancedToggleText: {
    fontSize: 14,
    color: theme.textSubtle,
    fontWeight: '500',
  },
  advancedContent: {
    backgroundColor: theme.glass,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    marginBottom: 16,
    gap: 16,
  },
  optionGroup: {},
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 10,
  },
  interpretationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  interpOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  interpOptionActive: {
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    borderColor: theme.primary,
  },
  interpLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.textSubtle,
  },
  interpLabelActive: {
    color: theme.primary,
  },
  likesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.glassBorder,
  },
  likesInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  likesText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  likesTextActive: {
    color: theme.textPrimary,
  },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.glass,
    padding: 2,
    justifyContent: 'center',
  },
  toggleTrackActive: {
    backgroundColor: theme.primary,
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },

  // AI Card
  aiCard: {
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    marginBottom: 20,
  },
  aiCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  aiCardText: {
    flex: 1,
  },
  aiCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  aiCardDesc: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  aiCardBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
  },
  aiCardBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.gold,
  },

  // Draft
  draftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  draftBtnText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '500',
  },

  // Date Modal
  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  dateModalContent: {
    backgroundColor: theme.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    borderBottomWidth: 0,
  },
  dateModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  dateModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  dateModalClose: {
    padding: 4,
  },
  quickDates: {
    gap: 10,
  },
  quickDateBtn: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  quickDateBtnActive: {
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    borderColor: theme.primary,
  },
  quickDateText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  quickDateTextActive: {
    color: theme.primary,
  },
  quickDateSub: {
    fontSize: 13,
    color: theme.textMuted,
    marginTop: 4,
  },
  dateModalDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dateModalDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.glassBorder,
  },
  dateModalDividerText: {
    fontSize: 12,
    color: theme.textMuted,
  },
  olderDateSection: {},
  olderDateHint: {
    fontSize: 12,
    color: theme.textMuted,
    marginBottom: 10,
  },
  olderDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  olderDateBtnText: {
    flex: 1,
    fontSize: 14,
    color: theme.textSecondary,
  },
  comingSoonPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: theme.glass,
  },
  comingSoonPillText: {
    fontSize: 10,
    color: theme.textMuted,
    fontWeight: '500',
  },

  // Custom Mood Modal
  customMoodContent: {
    backgroundColor: theme.background,
    marginHorizontal: 20,
    marginTop: 'auto',
    marginBottom: 'auto',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  customMoodTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  customMoodInput: {
    backgroundColor: theme.glass,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.textPrimary,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    marginBottom: 20,
    textAlign: 'center',
  },
  customMoodActions: {
    flexDirection: 'row',
    gap: 12,
  },
  customMoodCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: theme.glass,
    alignItems: 'center',
  },
  customMoodCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  customMoodSave: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: theme.primary,
    alignItems: 'center',
  },
  customMoodSaveDisabled: {
    backgroundColor: theme.glass,
  },
  customMoodSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});