import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { OVERLAY_CONFIG } from '../../constants/theme';

interface Props {
  dreamType?: string | null;
  dreamTag?: string | null;
}

export default function DreamOverlay({ dreamType, dreamTag }: Props) {
  if (!dreamType || !dreamTag) return null;
  
  const config = OVERLAY_CONFIG[dreamTag];
  if (!config) return null;
  
  const isNightmare = dreamType === 'nightmare';

  return (
    <View style={styles.overlay} pointerEvents="none">
      <View style={styles.topRight}>
        <Text style={[styles.emoji, isNightmare && styles.emojiNightmare]}>
          {config.emoji}
        </Text>
      </View>
      <View style={styles.bottomLeft}>
        <Text style={[styles.emojiSmall, isNightmare && styles.emojiSmallNightmare]}>
          {config.secondaryEmoji || config.emoji}
        </Text>
      </View>
      <View style={[styles.tint, { backgroundColor: config.tintColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    overflow: 'hidden',
    zIndex: 1,
  },
  topRight: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  bottomLeft: {
    position: 'absolute',
    bottom: -8,
    left: -8,
    transform: [{ rotate: '180deg' }],
  },
  emoji: {
    fontSize: 45,
    opacity: 0.2,
  },
  emojiNightmare: {
    opacity: 0.25,
  },
  emojiSmall: {
    fontSize: 32,
    opacity: 0.12,
  },
  emojiSmallNightmare: {
    opacity: 0.15,
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
  },
});