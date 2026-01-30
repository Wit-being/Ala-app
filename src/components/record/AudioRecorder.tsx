import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

const NUM_BARS = 32;

interface Props {
  isRecording: boolean;
  recordingDuration: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  prompt: string;
}

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function AudioRecorder({
  isRecording,
  recordingDuration,
  onStartRecording,
  onStopRecording,
  prompt,
}: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnims = useRef(Array.from({ length: NUM_BARS }, () => new Animated.Value(0.3))).current;

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

  // Idle State
  if (!isRecording) {
    return (
      <View style={styles.recordIdle}>
        <TouchableOpacity onPress={onStartRecording} activeOpacity={0.8} style={styles.recordBtnWrapper}>
          <View style={styles.recordBtnOuter}>
            <LinearGradient colors={[theme.primary, theme.primaryDark]} style={styles.recordBtn}>
              <Ionicons name="mic" size={32} color="#fff" />
            </LinearGradient>
          </View>
        </TouchableOpacity>
        <Text style={styles.recordPrompt}>{prompt}</Text>
        <Text style={styles.recordSubPrompt}>or write it below</Text>
      </View>
    );
  }

  // Recording State
  return (
    <View style={styles.recordingActive}>
      <View style={styles.waveformContainer}>
        {waveAnims.map((anim, i) => {
          const isCenter = Math.abs(i - NUM_BARS / 2) < NUM_BARS / 4;
          return (
            <Animated.View
              key={i}
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
        })}
      </View>

      <Text style={styles.recordingTimer}>{formatDuration(recordingDuration)}</Text>

      <TouchableOpacity onPress={onStopRecording} style={styles.stopBtnWrapper}>
        <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
        <View style={styles.stopBtn}>
          <View style={styles.stopBtnInner} />
        </View>
      </TouchableOpacity>

      <Text style={styles.recordingHint}>Tap to stop</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
});