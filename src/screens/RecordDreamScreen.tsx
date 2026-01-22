import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, AudioModule, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import GlassCard from '../components/GlassCard';
import PillButton from '../components/PillButton';

const theme = {
  background: '#050a15',
  backgroundGradientStart: '#050a15',
  backgroundGradientEnd: '#0a1628',
  glass: 'rgba(255, 255, 255, 0.05)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  primary: '#60a5fa',
  gold: '#d4af37',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textSubtle: '#64748b',
  danger: '#ef4444',
  success: '#10b981',
  inputBg: 'rgba(255, 255, 255, 0.05)',
  inputBorder: 'rgba(255, 255, 255, 0.1)',
};

type InterpretationMode = 'disabled' | 'public' | 'private' | 'verified_only';

export default function RecordDreamScreen({ navigation }: any) {
  const user = useAuthStore((state) => state.user);
  
  // Audio Recorder Setup
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  
  // Audio Player for Preview
  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  
  const [dreamText, setDreamText] = useState('');
  const [dreamTitle, setDreamTitle] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [interpretationMode, setInterpretationMode] = useState<InterpretationMode>('disabled');
  const [enableEngagement, setEnableEngagement] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation loop
  useEffect(() => {
    let animation: Animated.CompositeAnimation;
    if (isRecording) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
    }
    
    return () => {
      if (animation) animation.stop();
    };
  }, [isRecording]);

  // Track Duration
  useEffect(() => {
    if (recorderState.isRecording) {
      setRecordingDuration(Math.floor(recorderState.durationMillis / 1000));
    }
  }, [recorderState.durationMillis]);

  // Reset logic when switching to private
  useEffect(() => {
    if (!isPublic) {
      setInterpretationMode('disabled');
      setEnableEngagement(false);
    }
  }, [isPublic]);

  // Monitor preview playback
  useEffect(() => {
    if (playerStatus.playing) {
      setIsPreviewPlaying(true);
    } else {
      setIsPreviewPlaying(false);
    }
  }, [playerStatus.playing]);

  // Auto-stop preview when finished
  useEffect(() => {
    if (playerStatus.didJustFinish) {
      setIsPreviewPlaying(false);
    }
  }, [playerStatus.didJustFinish]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      player.pause();
    };
  }, []);

  const startRecording = async () => {
    try {
      const { status } = await AudioModule.requestRecordingPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow microphone access to record dreams');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // Stop preview if playing
      if (isPreviewPlaying) {
        player.pause();
      }

      // Clear previous recording if exists
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
      if (uri) {
        setAudioUri(uri);
      }
      setIsRecording(false);
    } catch (err) {
      console.error('Failed to stop recording', err);
      Alert.alert('Error', 'Failed to stop recording');
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
      Alert.alert('Error', 'Unable to play preview');
    }
  };

  const saveDream = async (isDraft = false) => {
    if (!dreamText.trim() && !audioUri) {
      Alert.alert('Empty Dream', 'Please record audio or write a description before saving.');
      return;
    }

    setSaving(true);

    try {
      let audioUrl = null;

      // Stop preview if playing
      if (isPreviewPlaying) {
        player.pause();
      }

      // 1. Upload Audio if exists
      if (audioUri) {
        const fileExt = audioUri.split('.').pop() || 'm4a';
        const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
        const bucket = isPublic ? 'ala-audio' : 'ala-audio-private';

        // Robust FormData Upload (Works natively in RN without atob/Buffer)
        const formData = new FormData();
        formData.append('file', {
          uri: audioUri,
          name: fileName,
          type: `audio/${fileExt}`,
        } as any);

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fileName, formData, {
            contentType: `audio/${fileExt}`,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Get the URL
        if (isPublic) {
          const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(fileName);
          audioUrl = urlData.publicUrl;
        } else {
          // For private buckets, we store the path and sign it on read
          audioUrl = fileName;
        }
      }

      // 2. Insert into Database
      const { error: dbError } = await supabase
        .from('dreams')
        .insert({
          user_id: user?.id,
          title: dreamTitle.trim() || null,
          content: dreamText.trim() || null,
          audio_url: audioUrl,
          is_public: isPublic,
          status: isDraft ? 'draft' : 'published',
          interpretation_mode: isPublic ? interpretationMode : 'disabled',
          enable_engagement: isPublic ? enableEngagement : false,
          dream_date: new Date().toISOString().split('T')[0],
        });

      if (dbError) throw dbError;

      const message = isDraft 
        ? 'Dream saved as draft!' 
        : (isPublic ? 'Dream published successfully!' : 'Dream saved privately!');
      
      Alert.alert('Success ✨', message, [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);

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

  return (
    <LinearGradient
      colors={[theme.backgroundGradientStart, theme.backgroundGradientEnd]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Record Dream</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Recording Section */}
          <GlassCard style={styles.recordSection}>
            {!isRecording && !audioUri && (
              <View style={styles.recordReady}>
                <TouchableOpacity
                  style={styles.recordButton}
                  onPress={startRecording}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[theme.primary, '#3b82f6']}
                    style={styles.recordButtonGradient}
                  >
                    <Ionicons name="mic" size={48} color="white" />
                  </LinearGradient>
                </TouchableOpacity>
                <Text style={styles.recordHint}>Tap to start recording</Text>
                <Text style={styles.maxTimeHint}>Maximum: 5 minutes</Text>
              </View>
            )}

            {isRecording && (
              <View style={styles.recordingActive}>
                <View style={styles.pulseContainer}>
                  <Animated.View 
                    style={[styles.pulsingRing, { transform: [{ scale: pulseAnim }] }]} 
                  />
                  <View style={styles.recordingDot}>
                    <Ionicons name="stop" size={20} color="white" />
                  </View>
                </View>
                <Text style={styles.recordingLabel}>Recording...</Text>
                <Text style={styles.timer}>{formatDuration(recordingDuration)}</Text>
                <PillButton
                  title="Stop Recording"
                  onPress={stopRecording}
                  variant="glass"
                  size="large"
                  style={{ marginTop: 24 }}
                />
              </View>
            )}

            {audioUri && !isRecording && (
              <View style={styles.recordingComplete}>
                <View style={styles.checkmark}>
                  <Ionicons name="checkmark" size={36} color="white" />
                </View>
                <Text style={styles.completeLabel}>Recording Complete</Text>
                <Text style={styles.completeDuration}>{formatDuration(recordingDuration)}</Text>
                
                {/* Preview Controls */}
                <View style={styles.previewSection}>
                  <TouchableOpacity 
                    style={styles.previewBtn}
                    onPress={togglePreview}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={isPreviewPlaying ? "pause" : "play"} 
                      size={20} 
                      color={theme.primary} 
                    />
                    <Text style={styles.previewBtnText}>
                      {isPreviewPlaying ? 'Pause' : 'Preview'}
                    </Text>
                  </TouchableOpacity>

                  {isPreviewPlaying && (
                    <Text style={styles.previewTime}>
                      {formatPlayerTime(playerStatus.currentTime)} / {formatPlayerTime(playerStatus.duration)}
                    </Text>
                  )}
                </View>

                <PillButton
                  title="Re-record"
                  onPress={() => {
                    if (isPreviewPlaying) player.pause();
                    setAudioUri(null);
                    setRecordingDuration(0);
                  }}
                  variant="glass"
                  size="medium"
                  style={{ marginTop: 12 }}
                />
              </View>
            )}
          </GlassCard>

          {/* Form */}
          <View style={styles.formSection}>
            <Text style={styles.label}>Title (optional)</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Give your dream a title..."
                placeholderTextColor={theme.textSubtle}
                value={dreamTitle}
                onChangeText={setDreamTitle}
              />
            </View>

            <Text style={styles.label}>Description (optional)</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe your dream..."
                placeholderTextColor={theme.textSubtle}
                value={dreamText}
                onChangeText={setDreamText}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            {/* Privacy */}
            <Text style={styles.label}>Visibility</Text>
            <View style={styles.privacyButtons}>
              <TouchableOpacity
                style={[styles.privacyButton, !isPublic && styles.privacyButtonActive]}
                onPress={() => setIsPublic(false)}
              >
                <Ionicons name="lock-closed" size={20} color={!isPublic ? theme.primary : theme.textSubtle} />
                <Text style={[styles.privacyText, !isPublic && styles.privacyTextActive]}>Private</Text>
                <Text style={styles.privacyDesc}>Only you</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.privacyButton, isPublic && styles.privacyButtonActive]}
                onPress={() => setIsPublic(true)}
              >
                <Ionicons name="globe" size={20} color={isPublic ? theme.primary : theme.textSubtle} />
                <Text style={[styles.privacyText, isPublic && styles.privacyTextActive]}>Public</Text>
                <Text style={styles.privacyDesc}>Everyone</Text>
              </TouchableOpacity>
            </View>

            {/* AI Interpretation Section */}
            <View style={styles.aiSection}>
              <View style={styles.aiHeader}>
                <Ionicons name="sparkles" size={18} color={theme.gold} />
                <Text style={styles.aiTitle}>AI Interpretation</Text>
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonText}>Coming Soon</Text>
                </View>
              </View>
              <Text style={styles.aiDescription}>
                Get AI-powered insights about your dreams
              </Text>
            </View>

            {/* Community Interpretation (only for public dreams) */}
            {isPublic && (
              <>
                <Text style={styles.label}>Community Interpretation</Text>
                <View style={styles.interpretationModes}>
                  <TouchableOpacity
                    style={[styles.modeButton, interpretationMode === 'disabled' && styles.modeButtonActive]}
                    onPress={() => setInterpretationMode('disabled')}
                  >
                    <Ionicons name="ban" size={16} color={interpretationMode === 'disabled' ? theme.primary : theme.textSubtle} />
                    <Text style={[styles.modeText, interpretationMode === 'disabled' && styles.modeTextActive]}>Off</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modeButton, interpretationMode === 'public' && styles.modeButtonActive]}
                    onPress={() => setInterpretationMode('public')}
                  >
                    <Ionicons name="people" size={16} color={interpretationMode === 'public' ? theme.primary : theme.textSubtle} />
                    <Text style={[styles.modeText, interpretationMode === 'public' && styles.modeTextActive]}>Public</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modeButton, interpretationMode === 'private' && styles.modeButtonActive]}
                    onPress={() => setInterpretationMode('private')}
                  >
                    <Ionicons name="eye-off" size={16} color={interpretationMode === 'private' ? theme.primary : theme.textSubtle} />
                    <Text style={[styles.modeText, interpretationMode === 'private' && styles.modeTextActive]}>Private</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modeButton, interpretationMode === 'verified_only' && styles.modeButtonActive]}
                    onPress={() => setInterpretationMode('verified_only')}
                  >
                    <Ionicons name="shield-checkmark" size={16} color={interpretationMode === 'verified_only' ? theme.primary : theme.textSubtle} />
                    <Text style={[styles.modeText, interpretationMode === 'verified_only' && styles.modeTextActive]}>Verified</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.modeDescription}>
                  {interpretationMode === 'disabled' && 'No community interpretations allowed'}
                  {interpretationMode === 'public' && 'Anyone can interpret, all interpretations visible'}
                  {interpretationMode === 'private' && 'Anyone can interpret, only you see them'}
                  {interpretationMode === 'verified_only' && 'Only verified interpreters can interpret'}
                </Text>

                {/* Engagement Toggle */}
                <View style={styles.engagementSection}>
                  <TouchableOpacity
                    style={styles.engagementToggle}
                    onPress={() => setEnableEngagement(!enableEngagement)}
                  >
                    <View style={styles.engagementLeft}>
                      <Ionicons name="heart" size={18} color={enableEngagement ? theme.primary : theme.textSubtle} />
                      <Text style={[styles.engagementText, enableEngagement && styles.engagementTextActive]}>
                        Enable Likes
                      </Text>
                    </View>
                    <View style={[styles.toggleSwitch, enableEngagement && styles.toggleSwitchActive]}>
                      <View style={[styles.toggleThumb, enableEngagement && styles.toggleThumbActive]} />
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.engagementDesc}>
                    Allow others to like your dream
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Save Actions */}
          <View style={styles.actions}>
            <PillButton
              title={saving ? 'Publishing...' : 'Publish Dream'}
              onPress={() => saveDream(false)}
              variant="primary"
              size="large"
              loading={saving}
              disabled={saving}
              style={styles.saveButton}
            />
            
            <PillButton
              title="Save as Draft"
              onPress={() => saveDream(true)}
              variant="glass"
              size="large"
              disabled={saving}
              style={{ ...styles.saveButton, marginTop: 12 }}
            />
            
            <TouchableOpacity 
              style={styles.cancelBtn}
              onPress={() => navigation.goBack()}
              disabled={saving}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: theme.textPrimary, fontSize: 18, fontWeight: '600' },
  content: { padding: 20, paddingBottom: 60 },
  recordSection: { marginBottom: 24, minHeight: 240 },
  recordReady: { alignItems: 'center', paddingVertical: 30 },
  recordButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  recordButtonGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  recordHint: { fontSize: 17, color: theme.textPrimary, fontWeight: '500' },
  maxTimeHint: { fontSize: 13, color: theme.textSubtle, marginTop: 6 },
  recordingActive: { alignItems: 'center', paddingVertical: 20 },
  pulseContainer: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  pulsingRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  recordingDot: { 
    width: 32, 
    height: 32, 
    borderRadius: 8, 
    backgroundColor: theme.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingLabel: { fontSize: 18, color: theme.danger, fontWeight: '600', marginBottom: 8 },
  timer: { fontSize: 52, color: theme.textPrimary, fontWeight: '700', fontVariant: ['tabular-nums'] },
  recordingComplete: { alignItems: 'center', paddingVertical: 24 },
  checkmark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  completeLabel: { fontSize: 18, color: theme.success, fontWeight: '600' },
  completeDuration: { fontSize: 36, color: theme.textPrimary, fontWeight: '700', marginTop: 4, marginBottom: 16 },
  previewSection: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  previewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 },
  previewBtnText: { color: theme.primary, fontWeight: '600', fontSize: 16 },
  previewTime: { fontSize: 13, color: theme.textSecondary, fontVariant: ['tabular-nums'] },
  formSection: { marginBottom: 24 },
  label: { fontSize: 14, color: theme.textSecondary, marginBottom: 10, marginLeft: 4, fontWeight: '500' },
  inputWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.inputBorder,
    backgroundColor: theme.inputBg,
    marginBottom: 20,
  },
  input: { padding: 16, fontSize: 16, color: theme.textPrimary },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  privacyButtons: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  privacyButton: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  privacyButtonActive: { borderColor: theme.primary, backgroundColor: 'rgba(96, 165, 250, 0.1)' },
  privacyText: { fontSize: 15, fontWeight: '600', color: theme.textSecondary, marginBottom: 4, marginTop: 6 },
  privacyTextActive: { color: theme.primary },
  privacyDesc: { fontSize: 11, color: theme.textSubtle },
  aiSection: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  aiHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  aiTitle: { fontSize: 15, fontWeight: '600', color: theme.textPrimary, marginLeft: 8, flex: 1 },
  comingSoonBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  comingSoonText: { fontSize: 11, color: theme.gold, fontWeight: '500' },
  aiDescription: { fontSize: 13, color: theme.textSecondary },
  interpretationModes: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  modeButton: {
    flex: 1,
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  modeButtonActive: { borderColor: theme.primary, backgroundColor: 'rgba(96, 165, 250, 0.1)' },
  modeText: { fontSize: 10, fontWeight: '500', color: theme.textSubtle, marginTop: 3 },
  modeTextActive: { color: theme.primary },
  modeDescription: { fontSize: 12, color: theme.textSubtle, marginBottom: 16, textAlign: 'center' },
  engagementSection: { marginBottom: 16 },
  engagementToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingVertical: 6,
  },
  engagementLeft: { flexDirection: 'row', alignItems: 'center' },
  engagementText: { fontSize: 15, color: theme.textSecondary, marginLeft: 8, fontWeight: '500' },
  engagementTextActive: { color: theme.primary },
  engagementDesc: { fontSize: 12, color: theme.textSubtle },
  toggleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.glass,
    justifyContent: 'center',
    padding: 2,
  },
  toggleSwitchActive: { backgroundColor: theme.primary },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  actions: { marginTop: 8, alignItems: 'center' },
  saveButton: { width: '100%' },
  cancelBtn: { marginTop: 16, paddingVertical: 12 },
  cancelText: { color: theme.textSubtle, fontSize: 16, fontWeight: '500' },
});