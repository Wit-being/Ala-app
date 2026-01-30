import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import { AMBIENT_GRADIENTS, ICON_SWAP_INTERVAL } from '../../constants/theme';

interface Props {
  onPress: () => void;
  gradientIndex: number;
}

function AnimatedTellButton({ onPress, gradientIndex }: Props) {
  const [showMic, setShowMic] = useState(true);
  const micOpacity = useRef(new Animated.Value(1)).current;
  const featherOpacity = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      if (showMic) {
        Animated.parallel([
          Animated.timing(micOpacity, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(featherOpacity, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start(() => setShowMic(false));
      } else {
        Animated.parallel([
          Animated.timing(featherOpacity, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(micOpacity, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start(() => setShowMic(true));
      }
    }, ICON_SWAP_INTERVAL);
    return () => clearInterval(interval);
  }, [showMic]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={styles.navBtn}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <LinearGradient
          colors={AMBIENT_GRADIENTS[gradientIndex % AMBIENT_GRADIENTS.length]}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.iconContainer}>
            <Animated.View style={[styles.iconWrap, { opacity: micOpacity }]}>
              <Ionicons name="mic" size={20} color="#fff" />
            </Animated.View>
            <Animated.View style={[styles.iconWrap, styles.iconAbsolute, { opacity: featherOpacity }]}>
              <Feather name="feather" size={20} color="#fff" />
            </Animated.View>
          </View>
          <Text style={styles.text}>Tell</Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

export default React.memo(AnimatedTellButton);

const styles = StyleSheet.create({
  navBtn: {
    flex: 1,
    maxWidth: 120,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  iconContainer: {
    width: 20,
    height: 20,
    position: 'relative',
  },
  iconWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});