import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { theme } from '../../constants/theme';

interface Props {
  isLiked: boolean;
  count: number;
  onStarPress: () => void;
  onWowPress: () => void;
  disabled?: boolean;
}

export default function ReactionButtons({ isLiked, count, onStarPress, onWowPress, disabled }: Props) {
  const starScaleAnim = useRef(new Animated.Value(1)).current;
  const wowScaleAnim = useRef(new Animated.Value(1)).current;

  const handleStarPress = () => {
    if (disabled) return;
    Animated.sequence([
      Animated.timing(starScaleAnim, { toValue: 1.4, duration: 100, useNativeDriver: true }),
      Animated.timing(starScaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onStarPress();
  };

  const handleWowPress = () => {
    if (disabled) return;
    Animated.sequence([
      Animated.timing(wowScaleAnim, { toValue: 1.4, duration: 100, useNativeDriver: true }),
      Animated.timing(wowScaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onWowPress();
  };

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.btn}
        onPress={handleStarPress}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <Animated.View style={{ transform: [{ scale: starScaleAnim }] }}>
          <Text style={[styles.emoji, isLiked && styles.emojiActive]}>💫</Text>
        </Animated.View>
        {count > 0 && (
          <Text style={[styles.count, isLiked && styles.countActive]}>{count}</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.btn}
        onPress={handleWowPress}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <Animated.View style={{ transform: [{ scale: wowScaleAnim }] }}>
          <Text style={styles.wowText}>wow</Text>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  emoji: {
    fontSize: 18,
    opacity: 0.6,
  },
  emojiActive: {
    opacity: 1,
  },
  count: {
    fontSize: 13,
    color: theme.textMuted,
    fontWeight: '500',
  },
  countActive: {
    color: theme.gold,
  },
  wowText: {
    fontSize: 13,
    color: theme.textMuted,
    fontWeight: '600',
    fontStyle: 'italic',
  },
});