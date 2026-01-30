import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  feature: string;
}

export default function ComingSoonModal({ visible, onClose, feature }: Props) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View
          style={[
            styles.content,
            { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <LinearGradient
            colors={[theme.backgroundGradientStart, theme.backgroundGradientEnd]}
            style={styles.gradient}
          >
            <View style={styles.iconWrap}>
              <LinearGradient colors={[theme.gold + '40', theme.gold + '10']} style={styles.iconBg}>
                <Ionicons name="sparkles" size={32} color={theme.gold} />
              </LinearGradient>
            </View>
            <Text style={styles.title}>Coming Soon</Text>
            <Text style={styles.feature}>{feature}</Text>
            <Text style={styles.desc}>We're crafting something special. Stay tuned!</Text>
            <TouchableOpacity style={styles.btn} onPress={onClose}>
              <LinearGradient colors={[theme.gold, '#b8962e']} style={styles.btnGradient}>
                <Text style={styles.btnText}>Got it</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  content: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  gradient: {
    padding: 32,
    alignItems: 'center',
  },
  iconWrap: {
    marginBottom: 20,
  },
  iconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  feature: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.gold,
    marginBottom: 12,
  },
  desc: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  btn: {
    borderRadius: 20,
    overflow: 'hidden',
    width: '100%',
  },
  btnGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});