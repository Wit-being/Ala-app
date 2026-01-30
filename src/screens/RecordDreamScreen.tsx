import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { theme } from '../constants/theme';

// Components
import { AnimatedGradientBackground } from '../components/common';
import {
  AudioRecorder,
  AudioPreview,
  DreamTypeSelector,
  VisibilitySelector,
  DatePickerModal,
  SuccessModal,
} from '../components/record';

type InterpretationMode = 'disabled' | 'public' | 'private';
type DreamType = 'dream' | 'nightmare' | null;

const RECORDING_PROMPTS = [
  'Whisper your dream...',
  'What did you see?',
  'Tell us what happened...',
  'Speak your vision...',
  'Share the story...',
];

export default function RecordDreamScreen({ navigation }: any) {
  const user = useAuthStore((state) => state.user);

  // Audio
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(null);

  // Form State - PUBLIC IS NOW DEFAULT
  const [dreamContent, setDreamContent] = useState('');
  const [dreamDate, setDreamDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dreamType, setDreamType] = useState<DreamType>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(true); // DEFAULT: Public
  const [interpretationMode, setInterpretationMode] = useState<InterpretationMode>('public'); // DEFAULT: Open
  const [saving, setSaving] = useState(false);

  // Modals
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [promptIndex] = useState(Math.floor(Math.random() * RECORDING_PROMPTS.length));

  // Extracted title/content
  const extractedTitle = useMemo(() => {
    if (!dreamContent.trim()) return '';
    const lines = dreamContent.split('\n');
    const firstLine = lines[0].trim();
    return firstLine.length <= 60 ? firstLine : firstLine.substring(0, 57) + '...';
  }, [dreamContent]);

  const extractedContent = useMemo(() => {
    if (!dreamContent.trim()) return '';
    const lines = dreamContent.split('\n');
    return lines.length <= 1 ? '' : lines.slice(1).join('\n').trim();
  }, [dreamContent]);

  const hasContent = dreamContent.trim() || audioUri;

  // Safe player pause
  const safelyPausePlayer = useCallback(() => {
    try {
      if (player && playerStatus.playing) player.pause();
    } catch (error) {
      console.log('Player already released');
    }
  }, [player, playerStatus.playing]);

  // Back handler
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => backHandler.remove();
  }, [hasContent]);

  const handleBack = () => {
    if (hasContent) {
      Alert.alert('Discard Dream?', 'Your dream will be lost.', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => { safelyPausePlayer(); navigation.goBack(); }},
      ]);
    } else {
      navigation.goBack();
    }
  };

  // Track duration
  useEffect(() => {
    if (recorderState.isRecording) {
      setRecordingDuration(Math.floor(recorderState.durationMillis / 1000));
    }
  }, [recorderState.durationMillis, recorderState.isRecording]);

  // Reset interpretation mode when going private
  useEffect(() => {
    if (!isPublic) setInterpretationMode('disabled');
    else setInterpretationMode('public'); // Reset to default when public
  }, [isPublic]);

  // Reset tag when dream type changes
  useEffect(() => {
    setSelectedTag(null);
  }, [dreamType]);

  // Cleanup
  useEffect(() => {
    return () => safelyPausePlayer();
  }, [safelyPausePlayer]);

  const startRecording = async () => {
    try {
      const { status } = await AudioModule.requestRecordingPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow microphone access');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      safelyPausePlayer();
      setAudioUri(null);
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setRecordingDuration(0);
    } catch (err) {
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    try {
      await recorder.stop();
      if (recorder.uri) setAudioUri(recorder.uri);
      setIsRecording(false);
    } catch (err) {
      setIsRecording(false);
    }
  };

  const togglePreview = async () => {
    if (!audioUri) return;
    try {
      if (playerStatus.playing) {
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
    if (playerStatus.duration > 0) player.seekTo(position * playerStatus.duration);
  };

  const handleReRecord = () => {
    safelyPausePlayer();
    setAudioUri(null);
    setRecordingDuration(0);
  };

  const saveDream = async (isDraft = false) => {
    if (!hasContent) {
      Alert.alert('Empty Dream', 'Please record or write something.');
      return;
    }

    setSaving(true);
    try {
      let audioUrl = null;
      safelyPausePlayer();

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

        audioUrl = isPublic 
          ? supabase.storage.from(bucket).getPublicUrl(fileName).data.publicUrl 
          : fileName;
      }

      const { error: dbError } = await supabase.from('dreams').insert({
        user_id: user?.id,
        title: extractedTitle || null,
        content: extractedContent || dreamContent.trim() || null,
        audio_url: audioUrl,
        audio_duration: audioUri ? recordingDuration : null,
        is_public: isPublic,
        status: isDraft ? 'draft' : 'published',
        interpretation_mode: isPublic ? interpretationMode : 'disabled',
        enable_engagement: isPublic, // Always enabled when public
        dream_date: dreamDate.toISOString().split('T')[0],
        dream_type: dreamType,
        dream_tag: selectedTag,
      });

      if (dbError) throw dbError;

      setSuccessMessage(
        isDraft ? 'Saved to drafts' : isPublic ? 'Shared with the community' : 'Added to your journal'
      );
      setShowSuccessModal(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const formatDateLabel = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Last Night';
    if (date.toDateString() === yesterday.toDateString()) return 'Night Before';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <AnimatedGradientBackground>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color={theme.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Dream</Text>
          <TouchableOpacity
            onPress={() => saveDream(false)}
            style={[styles.saveBtn, (!hasContent || saving) && styles.saveBtnDisabled]}
            disabled={!hasContent || saving}
          >
            <Text style={[styles.saveText, (!hasContent || saving) && styles.saveTextDisabled]}>
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
            {/* Audio Section */}
            <View style={styles.section}>
              {!audioUri ? (
                <AudioRecorder
                  isRecording={isRecording}
                  recordingDuration={recordingDuration}
                  onStartRecording={startRecording}
                  onStopRecording={stopRecording}
                  prompt={RECORDING_PROMPTS[promptIndex]}
                />
              ) : (
                <AudioPreview
                  duration={recordingDuration}
                  isPlaying={playerStatus.playing}
                  currentTime={playerStatus.currentTime}
                  totalDuration={playerStatus.duration}
                  onTogglePlay={togglePreview}
                  onSeek={seekPreview}
                  onReRecord={handleReRecord}
                />
              )}
            </View>

            {/* Text Editor */}
            <View style={styles.editorSection}>
              <TouchableOpacity style={styles.datePill} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="moon-outline" size={14} color={theme.textSubtle} />
                <Text style={styles.datePillText}>{formatDateLabel(dreamDate)}</Text>
                <Ionicons name="chevron-down" size={14} color={theme.textMuted} />
              </TouchableOpacity>

              {extractedTitle ? (
                <Text style={styles.titlePreview}>{extractedTitle}</Text>
              ) : null}

              <TextInput
                style={[styles.editor, extractedTitle && styles.editorWithTitle]}
                placeholder="Start with a title, then describe your dream..."
                placeholderTextColor={theme.textMuted}
                value={dreamContent}
                onChangeText={setDreamContent}
                multiline
                textAlignVertical="top"
                scrollEnabled={false}
              />

              {!dreamContent && <Text style={styles.hint}>First line becomes the title</Text>}
            </View>

            {/* Dream Type */}
            <DreamTypeSelector
              dreamType={dreamType}
              selectedTag={selectedTag}
              onDreamTypeChange={setDreamType}
              onTagChange={setSelectedTag}
            />

            {/* Visibility - New Clean Design */}
            <VisibilitySelector
              isPublic={isPublic}
              interpretationMode={interpretationMode}
              onPublicChange={setIsPublic}
              onInterpretationModeChange={setInterpretationMode}
            />

            {/* AI Teaser */}
            <View style={styles.aiCard}>
              <Ionicons name="sparkles" size={18} color={theme.gold} />
              <View style={styles.aiText}>
                <Text style={styles.aiTitle}>AI Dream Analysis</Text>
                <Text style={styles.aiDesc}>Unlock deeper meanings</Text>
              </View>
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>Soon</Text>
              </View>
            </View>

            {/* Draft Button */}
            <TouchableOpacity
              style={styles.draftBtn}
              onPress={() => saveDream(true)}
              disabled={saving || !hasContent}
            >
              <Ionicons name="bookmark-outline" size={16} color={theme.textSecondary} />
              <Text style={styles.draftText}>Save as draft</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <DatePickerModal
        visible={showDatePicker}
        selectedDate={dreamDate}
        onClose={() => setShowDatePicker(false)}
        onSelectDate={setDreamDate}
      />

      <SuccessModal
        visible={showSuccessModal}
        message={successMessage}
        onClose={() => { setShowSuccessModal(false); navigation.goBack(); }}
      />
    </AnimatedGradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: { padding: 8 },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: theme.primary,
  },
  saveBtnDisabled: { backgroundColor: theme.glass },
  saveText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  saveTextDisabled: { color: theme.textMuted },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  section: { marginBottom: 24 },
  editorSection: { marginBottom: 24 },
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
  datePillText: { fontSize: 13, color: theme.textSecondary, fontWeight: '500' },
  titlePreview: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  editor: {
    fontSize: 16,
    color: theme.textPrimary,
    lineHeight: 24,
    minHeight: 120,
  },
  editorWithTitle: { fontSize: 15, color: theme.textSecondary },
  hint: { fontSize: 12, color: theme.textMuted, marginTop: 8, fontStyle: 'italic' },
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    marginBottom: 20,
  },
  aiText: { flex: 1 },
  aiTitle: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  aiDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  aiBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
  },
  aiBadgeText: { fontSize: 11, fontWeight: '600', color: theme.gold },
  draftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  draftText: { fontSize: 14, color: theme.textSecondary, fontWeight: '500' },
});