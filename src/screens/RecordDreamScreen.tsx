import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, AudioModule, setAudioModeAsync } from 'expo-audio';
import { File } from 'expo-file-system/next';
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

export default function RecordDreamScreen({ navigation }: any) {
  const user = useAuthStore((state) => state.user);
  
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  
  const [dreamText, setDreamText] = useState('');
  const [dreamTitle, setDreamTitle] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
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
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  // Update duration
  useEffect(() => {
    if (recorderState.isRecording) {
      setRecordingDuration(Math.floor(recorderState.durationMillis / 1000));
    }
  }, [recorderState.durationMillis]);

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

  const saveDream = async () => {
    if (!dreamText && !audioUri) {
      Alert.alert('Missing Content', 'Please record audio or write your dream');
      return;
    }

    setSaving(true);

    try {
      let audioUrl = null;

      if (audioUri) {
        const fileName = `${user?.id}/${Date.now()}.m4a`;
        const bucket = isPublic ? 'ala-audio' : 'ala-audio-private';

        // Use NEW File API from expo-file-system/next
        const file = new File(audioUri);
        
        // Check if file exists
        if (!file.exists) {
          throw new Error('Audio file not found');
        }

        // Read as base64 using the new API
        const base64 = await file.base64();

        // Convert base64 to Uint8Array
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fileName, bytes.buffer, {
            contentType: 'audio/m4a',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Get URL
        if (isPublic) {
          const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(fileName);
          audioUrl = urlData.publicUrl;
        } else {
          audioUrl = fileName;
        }
      }

      // Save to database
      const { error: dbError } = await supabase
        .from('dreams')
        .insert({
          user_id: user?.id,
          title: dreamTitle.trim() || null,
          content: dreamText.trim() || null,
          audio_url: audioUrl,
          is_public: isPublic,
          dream_date: new Date().toISOString().split('T')[0],
        });

      if (dbError) throw dbError;

      Alert.alert(
        'Dream Saved! ✨',
        isPublic ? 'Your dream has been shared.' : 'Your dream has been saved privately.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );

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

  return (
    <LinearGradient
      colors={[theme.backgroundGradientStart, theme.backgroundGradientEnd]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Record Dream</Text>
          <View style={{ width: 60 }} />
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
                    <Text style={styles.recordIcon}>●</Text>
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
                  <View style={styles.recordingDot} />
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
                  <Text style={styles.checkmarkIcon}>✓</Text>
                </View>
                <Text style={styles.completeLabel}>Recording Complete</Text>
                <Text style={styles.completeDuration}>{formatDuration(recordingDuration)}</Text>
                <PillButton
                  title="Re-record"
                  onPress={() => {
                    setAudioUri(null);
                    setRecordingDuration(0);
                  }}
                  variant="glass"
                  size="medium"
                  style={{ marginTop: 16 }}
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
                <Text style={styles.privacyIcon}>🔒</Text>
                <Text style={[styles.privacyText, !isPublic && styles.privacyTextActive]}>Private</Text>
                <Text style={styles.privacyDesc}>Only you can see</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.privacyButton, isPublic && styles.privacyButtonActive]}
                onPress={() => setIsPublic(true)}
              >
                <Text style={styles.privacyIcon}>🌍</Text>
                <Text style={[styles.privacyText, isPublic && styles.privacyTextActive]}>Public</Text>
                <Text style={styles.privacyDesc}>Share with everyone</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Save */}
          <View style={styles.actions}>
            <PillButton
              title={saving ? 'Saving...' : 'Save Dream'}
              onPress={saveDream}
              variant="primary"
              size="large"
              loading={saving}
              disabled={saving || (!dreamText.trim() && !audioUri)}
              style={styles.saveButton}
            />
            
            <TouchableOpacity 
              style={styles.cancelBtn}
              onPress={() => navigation.goBack()}
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
  backButton: { color: theme.primary, fontSize: 16, fontWeight: '500' },
  headerTitle: { color: theme.textPrimary, fontSize: 18, fontWeight: '600' },
  content: { padding: 20, paddingBottom: 40 },
  recordSection: { marginBottom: 24, minHeight: 240 },
  recordReady: { alignItems: 'center', paddingVertical: 30 },
  recordButton: {
    width: 110,
    height: 110,
    borderRadius: 55,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  recordButtonGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  recordIcon: { fontSize: 44, color: '#fff' },
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
  recordingDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.danger },
  recordingLabel: { fontSize: 18, color: theme.danger, fontWeight: '600', marginBottom: 8 },
  timer: { fontSize: 52, color: theme.textPrimary, fontWeight: '700', fontVariant: ['tabular-nums'] },
  recordingComplete: { alignItems: 'center', paddingVertical: 24 },
  checkmark: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: theme.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkmarkIcon: { fontSize: 36, color: '#fff', fontWeight: '700' },
  completeLabel: { fontSize: 18, color: theme.success, fontWeight: '600' },
  completeDuration: { fontSize: 36, color: theme.textPrimary, fontWeight: '700', marginTop: 4 },
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
  privacyButtons: { flexDirection: 'row', gap: 12 },
  privacyButton: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    backgroundColor: theme.glass,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  privacyButtonActive: { borderColor: theme.primary, backgroundColor: 'rgba(96, 165, 250, 0.1)' },
  privacyIcon: { fontSize: 28, marginBottom: 8 },
  privacyText: { fontSize: 16, fontWeight: '600', color: theme.textSecondary, marginBottom: 4 },
  privacyTextActive: { color: theme.primary },
  privacyDesc: { fontSize: 12, color: theme.textSubtle },
  actions: { marginTop: 8, alignItems: 'center' },
  saveButton: { width: '100%' },
  cancelBtn: { marginTop: 16, paddingVertical: 12 },
  cancelText: { color: theme.textSubtle, fontSize: 16, fontWeight: '500' },
});