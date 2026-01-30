import React, { useRef } from 'react';
import { Pressable, Animated, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

interface Props {
  isPlaying: boolean;
  isLoading: boolean;
  onPress: () => void;
  size?: 'small' | 'medium' | 'large';
}

const dimensions = {
  small: { container: 28, icon: 14 },
  medium: { container: 40, icon: 18 },
  large: { container: 56, icon: 28 },
};

export default function PlayButton({ isPlaying, isLoading, onPress, size = 'medium' }: Props) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const { container, icon } = dimensions[size];

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.85,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Animated.View
        style={[
          styles.base,
          {
            width: container,
            height: container,
            borderRadius: container / 2,
            transform: [{ scale: scaleAnim }],
          },
          isPlaying && styles.active,
        ]}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={icon} color="#fff" />
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  active: {
    backgroundColor: theme.primary,
  },
});