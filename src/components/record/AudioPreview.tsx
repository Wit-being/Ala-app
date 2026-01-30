import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

const { width } = Dimensions.get('window');

interface Props {
  duration: number;
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
  onTogglePlay: () => void;
  onSeek: (position: number) => void;
  onReRecord: () => void;
}

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

export default function AudioPreview({
  duration,
  isPlaying,
  currentTime,
  totalDuration,
  onTogglePlay,
  onSeek,
  onReRecord,
}: Props) {
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (totalDuration > 0) {
      const progress = currentTime / totalDuration;
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 100,
        useNativeDriver: false,
      }).start();
    }
  }, [currentTime, totalDuration]);

  const handleSeek = (e: any) => {
    const x = e.nativeEvent.locationX;
    const barWidth = width - 180;
    onSeek(Math.max(0, Math.min(1, x / barWidth)));
  };

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <View style={styles.checkIcon}>
          <Ionicons name="checkmark" size={20} color="#fff" />
        </View>
        <Text style={styles.label}>{formatDuration(duration)} recorded</Text>
      </View>

      <View style={styles.playerContainer}>
        <TouchableOpacity onPress={onTogglePlay} style={styles.playPauseBtn}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.progressBarTouch} activeOpacity={1} onPress={handleSeek}>
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

        <Text style={styles.playerTime}>{formatPlayerTime(currentTime)}</Text>
      </View>

      <TouchableOpacity onPress={onReRecord} style={styles.reRecordBtn}>
        <Ionicons name="refresh" size={16} color={theme.primary} />
        <Text style={styles.reRecordText}>Record again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.glass,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  label: {
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
});