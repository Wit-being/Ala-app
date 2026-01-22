import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Dimensions,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
} from 'expo-audio';
import { File } from 'expo-file-system/next';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const { width } = Dimensions.get('window');

// Get status bar height safely
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24);

const theme = {
  primary: '#60a5fa',
  glass: 'rgba(255, 255, 255, 0.1)',
  glassBorder: 'rgba(255, 255, 255, 0.15)',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  danger: '#ef4444',
  success: '#10b981',
  purple: '#8b5cf6',
};

interface DreamPopupProps {
  visible: boolean;
  onDismiss: () => void;
}

function DreamPopup({ visible, onDismiss }: DreamPopupProps) {
  const user = useAuthStore((state) => state.user);
  
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  
  const [isRecording, setIsRecording] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const slideAnim = useRef(new Animated.Value(-200)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Slide in/out animation
  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 9,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -200,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  // Pulse animation when recording
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
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
        Alert.alert('Permission Required', 'Please allow microphone access');
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
      
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.error('Failed to stop recording', err);
      setIsRecording(false);
    }
  };

  const saveDream = async () => {
    if (!audioUri || !user) {
      Alert.alert('Error', 'No recording to save');
      return;
    }

    setSaving(true);

    try {
      const fileName = `${user.id}/${Date.now()}.m4a`;
      const bucket = 'ala-audio-private';

      const file = new File(audioUri);
      
      if (!file.exists) {
        throw new Error('Audio file not found');
      }

      const base64 = await file.base64();

      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, bytes.buffer, {
          contentType: 'audio/m4a',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('dreams')
        .insert({
          user_id: user.id,
          title: 'Morning Dream',
          content: null,
          audio_url: fileName,
          is_public: false,
          dream_date: new Date().toISOString().split('T')[0],
        });

      if (dbError) throw dbError;

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      resetAndClose();
      
    } catch (error: any) {
      console.error('Error saving dream:', error);
      Alert.alert('Error', error.message || 'Failed to save dream');
    } finally {
      setSaving(false);
    }
  };

  const resetAndClose = () => {
    setAudioUri(null);
    setIsRecording(false);
    setRecordingDuration(0);
    onDismiss();
  };

  const handleDismiss = async () => {
    if (isRecording) {
      try {
        await recorder.stop();
      } catch (e) {}
    }
    resetAndClose();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          paddingTop: STATUSBAR_HEIGHT,
        },
      ]}
    >
      <BlurView intensity={80} tint="dark" style={styles.blurContainer}>
        <View style={styles.content}>
          
          {/* Initial State - Quick Record */}
          {!isRecording && !audioUri && (
            <View style={styles.row}>
              <View style={styles.leftSection}>
                <Text style={styles.moonEmoji}>🌙</Text>
                <View style={styles.textContainer}>
                  <Text style={styles.title}>Capture your dream</Text>
                  <Text style={styles.subtitle}>Before it fades away...</Text>
                </View>
              </View>
              
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  onPress={startRecording}
                  style={styles.quickRecordButton}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[theme.purple, '#7c3aed']}
                    style={styles.quickRecordGradient}
                  >
                    <Text style={styles.micIcon}>🎙️</Text>
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={handleDismiss} style={styles.dismissButton}>
                  <Text style={styles.dismissText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Recording State */}
          {isRecording && (
            <View style={styles.recordingRow}>
              <View style={styles.recordingLeft}>
                <Animated.View style={[styles.recordingDot, { transform: [{ scale: pulseAnim }] }]} />
                <Text style={styles.recordingText}>Recording</Text>
                <Text style={styles.timerText}>{formatDuration(recordingDuration)}</Text>
              </View>
              
              <View style={styles.buttonRow}>
                <TouchableOpacity onPress={stopRecording} style={styles.stopButton}>
                  <Text style={styles.stopIcon}>⏹</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDismiss} style={styles.dismissButton}>
                  <Text style={styles.dismissText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Save State */}
          {audioUri && !isRecording && (
            <View style={styles.saveRow}>
              <View style={styles.saveLeft}>
                <View style={styles.checkCircle}>
                  <Text style={styles.checkIcon}>✓</Text>
                </View>
                <Text style={styles.capturedText}>{formatDuration(recordingDuration)}</Text>
              </View>
              
              <View style={styles.saveButtons}>
                <TouchableOpacity
                  onPress={saveDream}
                  disabled={saving}
                  style={styles.saveButton}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveButtonText}>💾 Save</Text>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={() => { setAudioUri(null); setRecordingDuration(0); }}
                  style={styles.reRecordBtn}
                >
                  <Text style={styles.reRecordText}>🔄</Text>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={handleDismiss} style={styles.dismissButton}>
                  <Text style={styles.dismissText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
        </View>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  blurContainer: {
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  content: {
    padding: 14,
  },
  
  // Initial Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  moonEmoji: {
    fontSize: 26,
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickRecordButton: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  quickRecordGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micIcon: {
    fontSize: 18,
  },
  dismissButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.glass,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissText: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },

  // Recording Row
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.danger,
    marginRight: 8,
  },
  recordingText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.danger,
    marginRight: 10,
  },
  timerText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  stopButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopIcon: {
    fontSize: 16,
    color: '#fff',
  },

  // Save Row
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkIcon: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  capturedText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  saveButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveButton: {
    backgroundColor: theme.success,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  reRecordBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.glass,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reRecordText: {
    fontSize: 16,
  },
});

export default DreamPopup;