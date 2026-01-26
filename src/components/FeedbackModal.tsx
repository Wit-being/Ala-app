import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Keyboard,
  Image,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DISMISS_THRESHOLD = 150;

const theme = {
  glass: 'rgba(255, 255, 255, 0.06)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  glassBorderLight: 'rgba(255, 255, 255, 0.15)',
  primary: '#60a5fa',
  gold: '#d4af37',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#475569',
  danger: '#ef4444',
  success: '#10b981',
};

const FEEDBACK_TYPES = [
  { id: 'bug', icon: 'bug-outline', label: 'Bug', color: theme.danger },
  { id: 'feature', icon: 'bulb-outline', label: 'Idea', color: theme.gold },
  { id: 'general', icon: 'chatbubble-outline', label: 'Other', color: theme.primary },
];

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  screenshotUri: string | null;
}

export default function FeedbackModal({ visible, onClose, screenshotUri }: FeedbackModalProps) {
  const user = useAuthStore((state) => state.user);
  const [feedbackType, setFeedbackType] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [includeAccount, setIncludeAccount] = useState(true);
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setFeedbackType(null);
      setMessage('');
      setSent(false);
      setIncludeAccount(true);
      setIncludeScreenshot(true);
      
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 25,
          stiffness: 200,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 10,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) translateY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > DISMISS_THRESHOLD || gestureState.vy > 0.5) {
          closeModal();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 25 }).start();
        }
      },
    })
  ).current;

  const closeModal = () => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 300, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const getDeviceInfo = () => `${Device.modelName || 'Unknown'} | ${Platform.OS} ${Platform.Version}`;

  const uploadScreenshot = async (): Promise<string | null> => {
    if (!screenshotUri || !includeScreenshot) return null;
    try {
      const base64 = await FileSystem.readAsStringAsync(screenshotUri, {
        encoding: "base64",
      });
      const fileName = `feedback/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
      
      const { error } = await supabase.storage
        .from('feedback-screenshots')
        .upload(fileName, decode(base64), { contentType: 'image/jpeg' });

      if (error) return null;

      const { data } = supabase.storage.from('feedback-screenshots').getPublicUrl(fileName);
      return data.publicUrl;
    } catch {
      return null;
    }
  };

  const sendFeedback = async () => {
    if (!feedbackType || !message.trim()) {
      Alert.alert('Missing Info', 'Please select a type and write your message.');
      return;
    }

    setSending(true);
    try {
      const screenshotUrl = await uploadScreenshot();
      const { error } = await supabase.from('feedback').insert({
        user_id: includeAccount ? user?.id : null,
        type: feedbackType,
        message: message.trim(),
        app_version: '1.0.0',
        device_info: getDeviceInfo(),
        screenshot_url: screenshotUrl,
      });

      if (error) throw error;
      setSent(true);
      setTimeout(closeModal, 2000);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to send feedback. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={closeModal}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeModal} />
        </Animated.View>

        <Animated.View
          style={[styles.modalContainer, { transform: [{ translateY }] }]}
          {...panResponder.panHandlers}
        >
          <BlurView intensity={50} tint="dark" style={styles.blurView}>
            <View style={styles.content}>
              <View style={styles.handle} />

              {sent ? (
                <View style={styles.successContainer}>
                  <Text style={styles.successEmoji}>✨</Text>
                  <Text style={styles.successTitle}>Thank You!</Text>
                  <Text style={styles.successText}>We read every message.</Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">
                  <Text style={styles.title}>Feedback</Text>

                  {/* Screenshot - Compact */}
                  {screenshotUri && (
                    <TouchableOpacity 
                      style={styles.screenshotRow}
                      onPress={() => setIncludeScreenshot(!includeScreenshot)}
                      activeOpacity={0.7}
                    >
                      <Image 
                        source={{ uri: screenshotUri }} 
                        style={[styles.screenshotThumb, !includeScreenshot && styles.screenshotExcluded]}
                      />
                      <Text style={styles.screenshotText}>
                        {includeScreenshot ? 'Screenshot attached' : 'Screenshot excluded'}
                      </Text>
                      <Ionicons 
                        name={includeScreenshot ? "checkmark-circle" : "close-circle"} 
                        size={20} 
                        color={includeScreenshot ? theme.success : theme.danger} 
                      />
                    </TouchableOpacity>
                  )}

                  {/* Type Selection - Minimal */}
                  <View style={styles.typeRow}>
                    {FEEDBACK_TYPES.map((type) => (
                      <TouchableOpacity
                        key={type.id}
                        style={[
                          styles.typeChip,
                          feedbackType === type.id && { backgroundColor: type.color + '25' },
                        ]}
                        onPress={() => setFeedbackType(type.id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={type.icon as any}
                          size={18}
                          color={feedbackType === type.id ? type.color : theme.textMuted}
                        />
                        <Text style={[
                          styles.typeChipText,
                          feedbackType === type.id && { color: type.color },
                        ]}>
                          {type.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Message Input */}
                  <TextInput
                    style={styles.input}
                    placeholder="What's on your mind?"
                    placeholderTextColor={theme.textMuted}
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    textAlignVertical="top"
                    maxLength={1000}
                  />

                  {/* Privacy - Inline */}
                  <TouchableOpacity 
                    style={styles.privacyRow}
                    onPress={() => setIncludeAccount(!includeAccount)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={includeAccount ? "person-circle" : "person-circle-outline"} 
                      size={20} 
                      color={includeAccount ? theme.primary : theme.textMuted} 
                    />
                    <Text style={styles.privacyText}>
                      {includeAccount ? 'Sending as you' : 'Sending anonymously'}
                    </Text>
                    <Text style={styles.privacyToggleText}>
                      {includeAccount ? 'Go anonymous' : 'Include me'}
                    </Text>
                  </TouchableOpacity>

                  {/* Actions */}
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.sendBtn,
                        (!feedbackType || !message.trim() || sending) && styles.sendBtnDisabled,
                      ]}
                      onPress={sendFeedback}
                      disabled={!feedbackType || !message.trim() || sending}
                    >
                      {sending ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.sendText}>Send</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </View>
          </BlurView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  blurView: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  content: {
    backgroundColor: 'rgba(12, 17, 30, 0.92)',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.glassBorderLight,
    alignSelf: 'center',
    marginBottom: 16,
  },

  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 16,
  },

  // Screenshot - Compact row
  screenshotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingVertical: 8,
  },
  screenshotThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: theme.glass,
  },
  screenshotExcluded: {
    opacity: 0.4,
  },
  screenshotText: {
    flex: 1,
    fontSize: 14,
    color: theme.textSecondary,
  },

  // Type Selection - Chip style
  typeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: theme.glass,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textMuted,
  },

  // Input - Clean
  input: {
    backgroundColor: theme.glass,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: theme.textPrimary,
    minHeight: 100,
    maxHeight: 150,
    marginBottom: 12,
    lineHeight: 21,
  },

  // Privacy - Inline row
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingVertical: 4,
  },
  privacyText: {
    flex: 1,
    fontSize: 13,
    color: theme.textSecondary,
  },
  privacyToggleText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.primary,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: theme.glass,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  sendBtn: {
    flex: 1.5,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: theme.primary,
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: theme.glass,
  },
  sendText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  // Success
  successContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  successEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 6,
  },
  successText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
});