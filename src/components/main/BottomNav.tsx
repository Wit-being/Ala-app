import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedTellButton from './AnimatedTellButton';
import { theme } from '../../constants/theme';

interface Props {
  onCirclesPress: () => void;
  onTellPress: () => void;
  gradientIndex: number;
}

export default function BottomNav({ onCirclesPress, onTellPress, gradientIndex }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.nav}>
        <TouchableOpacity style={styles.navBtn} onPress={onCirclesPress} activeOpacity={0.7}>
          <View style={styles.navBtnInner}>
            <Ionicons name="people-outline" size={20} color={theme.textPrimary} />
            <Text style={styles.navBtnText}>Circles</Text>
          </View>
        </TouchableOpacity>
        
        <Text style={styles.logoText}>Àlá</Text>
        
        <AnimatedTellButton onPress={onTellPress} gradientIndex={gradientIndex} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  navBtn: {
    flex: 1,
    maxWidth: 120,
  },
  navBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  navBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  logoText: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.gold,
    textShadowColor: 'rgba(212, 175, 55, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
});