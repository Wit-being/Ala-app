import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

interface ActionButton {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'gold';
  icon?: string;
}

interface Props {
  icon?: string;
  emoji?: string;
  title: string;
  subtitle?: string;
  action?: ActionButton;
  secondaryAction?: ActionButton;
  animated?: boolean;
  variant?: 'default' | 'search' | 'error' | 'locked';
  compact?: boolean;
}

export default function EmptyState({
  icon,
  emoji,
  title,
  subtitle,
  action,
  secondaryAction,
  animated = true,
  variant = 'default',
  compact = false,
}: Props) {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      // Subtle floating animation for icon
      const floatAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: -6,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      floatAnimation.start();

      return () => floatAnimation.stop();
    } else {
      scaleAnim.setValue(1);
      opacityAnim.setValue(1);
    }
  }, [animated]);

  const getVariantStyles = () => {
    switch (variant) {
      case 'search':
        return {
          iconBg: theme.glass,
          iconColor: theme.textMuted,
          defaultIcon: 'search-outline',
        };
      case 'error':
        return {
          iconBg: theme.danger + '15',
          iconColor: theme.danger,
          defaultIcon: 'cloud-offline-outline',
        };
      case 'locked':
        return {
          iconBg: theme.glowGold,
          iconColor: theme.gold,
          defaultIcon: 'lock-closed',
        };
      default:
        return {
          iconBg: theme.glowBlue,
          iconColor: theme.primary,
          defaultIcon: 'moon-outline',
        };
    }
  };

  const variantStyles = getVariantStyles();
  const displayIcon = icon || variantStyles.defaultIcon;
  const iconSize = compact ? 80 : 100;
  const iconFontSize = compact ? 36 : 48;

  const renderButton = (button: ActionButton, isSecondary = false) => {
    const getButtonColors = (): [string, string] => {
      if (isSecondary) return [theme.glass, theme.glass];
      switch (button.variant) {
        case 'gold':
          return [theme.gold, '#b8962e'];
        case 'secondary':
          return [theme.glass, theme.glass];
        default:
          return [theme.primary, theme.primaryDark];
      }
    };

    const colors = getButtonColors();
    const isGradient = !isSecondary && button.variant !== 'secondary';

    return (
      <TouchableOpacity
        key={button.label}
        style={[
          styles.button,
          isSecondary && styles.secondaryButton,
          !isGradient && { backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.glassBorder },
        ]}
        onPress={button.onPress}
        activeOpacity={0.8}
      >
        {isGradient ? (
          <LinearGradient colors={colors} style={styles.buttonGradient}>
            {button.icon && (
              <Ionicons name={button.icon as any} size={18} color="#fff" />
            )}
            <Text style={styles.buttonText}>{button.label}</Text>
          </LinearGradient>
        ) : (
          <View style={styles.buttonInner}>
            {button.icon && (
              <Ionicons
                name={button.icon as any}
                size={18}
                color={isSecondary ? theme.textSecondary : theme.textPrimary}
              />
            )}
            <Text
              style={[
                styles.buttonText,
                { color: isSecondary ? theme.textSecondary : theme.textPrimary },
              ]}
            >
              {button.label}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Animated.View
      style={[
        styles.container,
        compact && styles.containerCompact,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {/* Icon/Emoji Container */}
      <Animated.View
        style={[
          styles.iconContainer,
          {
            width: iconSize,
            height: iconSize,
            borderRadius: iconSize / 2,
            backgroundColor: variantStyles.iconBg,
            transform: [{ translateY: floatAnim }],
          },
        ]}
      >
        {emoji ? (
          <Text style={[styles.emoji, { fontSize: iconFontSize }]}>{emoji}</Text>
        ) : (
          <Ionicons
            name={displayIcon as any}
            size={iconFontSize}
            color={variantStyles.iconColor}
          />
        )}
      </Animated.View>

      {/* Title */}
      <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>

      {/* Subtitle */}
      {subtitle && (
        <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>{subtitle}</Text>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <View style={styles.actions}>
          {action && renderButton(action)}
          {secondaryAction && renderButton(secondaryAction, true)}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  containerCompact: {
    paddingVertical: 40,
    flex: 0,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  emoji: {
    textAlign: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  titleCompact: {
    fontSize: 18,
  },
  subtitle: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  subtitleCompact: {
    fontSize: 14,
    marginBottom: 20,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  button: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  secondaryButton: {
    marginTop: 4,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 28,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 28,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});