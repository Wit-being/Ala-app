import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

interface Props {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  text?: string;
  variant?: 'default' | 'moon' | 'dots';
  fullScreen?: boolean;
}

export default function LoadingSpinner({
  size = 'medium',
  color = theme.primary,
  text,
  variant = 'default',
  fullScreen = false,
}: Props) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  const sizes = {
    small: { spinner: 24, icon: 16, text: 12 },
    medium: { spinner: 40, icon: 24, text: 14 },
    large: { spinner: 64, icon: 36, text: 16 },
  };

  const { spinner, icon, text: textSize } = sizes[size];

  useEffect(() => {
    if (variant === 'default' || variant === 'moon') {
      const spinAnimation = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      spinAnimation.start();

      if (variant === 'moon') {
        const pulseAnimation = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.1,
              duration: 800,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 800,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        );
        pulseAnimation.start();
        return () => {
          spinAnimation.stop();
          pulseAnimation.stop();
        };
      }

      return () => spinAnimation.stop();
    }

    if (variant === 'dots') {
      const createDotAnimation = (anim: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 1,
              duration: 300,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 300,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.delay(600 - delay),
          ])
        );

      const anim1 = createDotAnimation(dot1Anim, 0);
      const anim2 = createDotAnimation(dot2Anim, 150);
      const anim3 = createDotAnimation(dot3Anim, 300);

      anim1.start();
      anim2.start();
      anim3.start();

      return () => {
        anim1.stop();
        anim2.stop();
        anim3.stop();
      };
    }
  }, [variant]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const renderSpinner = () => {
    if (variant === 'dots') {
      const dotSize = size === 'small' ? 6 : size === 'medium' ? 8 : 12;
      return (
        <View style={styles.dotsContainer}>
          {[dot1Anim, dot2Anim, dot3Anim].map((anim, index) => (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                {
                  width: dotSize,
                  height: dotSize,
                  borderRadius: dotSize / 2,
                  backgroundColor: color,
                  transform: [
                    {
                      translateY: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -dotSize],
                      }),
                    },
                  ],
                  opacity: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.4, 1],
                  }),
                },
              ]}
            />
          ))}
        </View>
      );
    }

    if (variant === 'moon') {
      return (
        <Animated.View
          style={[
            styles.moonContainer,
            {
              width: spinner,
              height: spinner,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="moon" size={icon} color={theme.gold} />
          </Animated.View>
          <View style={[styles.moonGlow, { backgroundColor: theme.gold + '20' }]} />
        </Animated.View>
      );
    }

    return (
      <Animated.View
        style={[
          styles.spinnerContainer,
          {
            width: spinner,
            height: spinner,
            borderRadius: spinner / 2,
            transform: [{ rotate: spin }],
          },
        ]}
      >
        <View
          style={[
            styles.spinnerTrack,
            {
              width: spinner,
              height: spinner,
              borderRadius: spinner / 2,
              borderWidth: size === 'small' ? 2 : 3,
            },
          ]}
        />
        <View
          style={[
            styles.spinnerFill,
            {
              width: spinner,
              height: spinner,
              borderRadius: spinner / 2,
              borderWidth: size === 'small' ? 2 : 3,
              borderTopColor: color,
            },
          ]}
        />
      </Animated.View>
    );
  };

  const content = (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      {renderSpinner()}
      {text && (
        <Text style={[styles.text, { fontSize: textSize, marginTop: size === 'small' ? 8 : 12 }]}>
          {text}
        </Text>
      )}
    </View>
  );

  if (fullScreen) {
    return (
      <View style={styles.fullScreenWrapper}>
        <LinearGradient
          colors={[theme.backgroundGradientStart, theme.backgroundGradientEnd]}
          style={StyleSheet.absoluteFill}
        />
        {content}
      </View>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenWrapper: {
    flex: 1,
  },
  fullScreen: {
    flex: 1,
  },
  spinnerContainer: {
    position: 'relative',
  },
  spinnerTrack: {
    position: 'absolute',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  spinnerFill: {
    position: 'absolute',
    borderColor: 'transparent',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {},
  moonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  moonGlow: {
    position: 'absolute',
    width: '150%',
    height: '150%',
    borderRadius: 100,
    zIndex: -1,
  },
  text: {
    color: theme.textSecondary,
    fontWeight: '500',
  },
});