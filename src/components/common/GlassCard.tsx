import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

const theme = {
  glass: 'rgba(255, 255, 255, 0.05)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  primary: '#60a5fa',
  gold: '#d4af37',
};

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  glow?: 'blue' | 'gold' | 'none';
}

export default function GlassCard({ 
  children, 
  style, 
  intensity = 25,
  glow = 'none' 
}: GlassCardProps) {
  const glowStyle = glow === 'blue' 
    ? styles.glowBlue 
    : glow === 'gold' 
    ? styles.glowGold 
    : null;

  return (
    <View style={[styles.container, glowStyle, style]}>
      <BlurView intensity={intensity} tint="dark" style={styles.blur}>
        <View style={styles.inner}>
          {children}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  blur: {
    overflow: 'hidden',
  },
  inner: {
    backgroundColor: theme.glass,
    padding: 16,
  },
  glowBlue: {
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  glowGold: {
    shadowColor: theme.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
});