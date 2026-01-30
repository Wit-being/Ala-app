import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator,
  ViewStyle,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';

const theme = {
  glass: 'rgba(255, 255, 255, 0.05)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  primary: '#60a5fa',
  gold: '#d4af37',
  textPrimary: '#f1f5f9',
};

interface PillButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'glass' | 'gold';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  style?: ViewStyle;
}

export default function PillButton({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  icon,
  style,
}: PillButtonProps) {
  const sizeConfig = {
    small: { paddingH: 16, paddingV: 10, fontSize: 13 },
    medium: { paddingH: 22, paddingV: 14, fontSize: 14 },
    large: { paddingH: 32, paddingV: 18, fontSize: 16 },
  };

  const config = sizeConfig[size];

  if (variant === 'glass') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.7}
        style={[styles.glassContainer, style]}
      >
        <BlurView intensity={30} tint="dark" style={styles.blurView}>
          <View style={[styles.glassInner, { paddingHorizontal: config.paddingH, paddingVertical: config.paddingV }]}>
            {loading ? (
              <ActivityIndicator size="small" color={theme.textPrimary} />
            ) : (
              <Text style={[styles.glassText, { fontSize: config.fontSize }]}>
                {icon && `${icon} `}{title}
              </Text>
            )}
          </View>
        </BlurView>
      </TouchableOpacity>
    );
  }

  const buttonStyle = variant === 'gold' ? styles.goldButton : styles.primaryButton;
  const shadowStyle = variant === 'gold' ? styles.goldShadow : styles.primaryShadow;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.button,
        buttonStyle,
        shadowStyle,
        { paddingHorizontal: config.paddingH, paddingVertical: config.paddingV },
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#000" />
      ) : (
        <Text style={[styles.buttonText, { fontSize: config.fontSize }]}>
          {icon && `${icon} `}{title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryButton: {
    backgroundColor: theme.primary,
  },
  goldButton: {
    backgroundColor: theme.gold,
  },
  primaryShadow: {
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  goldShadow: {
    shadowColor: theme.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonText: {
    color: '#000',
    fontWeight: '600',
  },
  glassContainer: {
    borderRadius: 50,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  blurView: {
    overflow: 'hidden',
  },
  glassInner: {
    backgroundColor: theme.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassText: {
    color: theme.textPrimary,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});