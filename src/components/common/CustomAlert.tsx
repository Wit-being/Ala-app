import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

type AlertType = 'info' | 'success' | 'warning' | 'error';

interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message?: string;
  type?: AlertType;
  buttons?: AlertButton[];
  onClose: () => void;
}

const alertConfig: Record<AlertType, { icon: string; color: string }> = {
  info: { icon: 'information-circle', color: theme.primary },
  success: { icon: 'checkmark-circle', color: theme.success },
  warning: { icon: 'warning', color: theme.gold },
  error: { icon: 'alert-circle', color: theme.danger },
};

export default function CustomAlert({
  visible,
  title,
  message,
  type = 'info',
  buttons = [{ text: 'OK', style: 'default' }],
  onClose,
}: CustomAlertProps) {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
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
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const handleButtonPress = (button: AlertButton) => {
    button.onPress?.();
    onClose();
  };

  const getButtonStyle = (style?: AlertButton['style']) => {
    switch (style) {
      case 'destructive':
        return { color: theme.danger };
      case 'cancel':
        return { color: theme.textSecondary };
      default:
        return { color: theme.primary };
    }
  };

  const { icon, color } = alertConfig[type];

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View
          style={[
            styles.container,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <BlurView intensity={40} tint="dark" style={styles.blur}>
              <View style={styles.content}>
                <View style={[styles.iconWrap, { backgroundColor: color + '20' }]}>
                  <Ionicons name={icon as any} size={32} color={color} />
                </View>

                <Text style={styles.title}>{title}</Text>

                {message && <Text style={styles.message}>{message}</Text>}

                <View style={styles.buttonRow}>
                  {buttons.map((button, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.button,
                        buttons.length > 1 && index === 0 && styles.buttonBorder,
                      ]}
                      onPress={() => handleButtonPress(button)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.buttonText, getButtonStyle(button.style)]}>
                        {button.text}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </BlurView>
          </Pressable>
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
  container: {
    width: '100%',
    maxWidth: 320,
  },
  blur: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  content: {
    backgroundColor: 'rgba(15, 20, 35, 0.95)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.glassBorderLight,
    padding: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.glassBorder,
    marginHorizontal: -24,
    paddingHorizontal: 24,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonBorder: {
    borderRightWidth: 1,
    borderRightColor: theme.glassBorder,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});