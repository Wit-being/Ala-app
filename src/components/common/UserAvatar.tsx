import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { BADGES } from '../../constants/badges';

interface Props {
  uri?: string | null;
  name?: string;
  size?: 'xs' | 'small' | 'medium' | 'large' | 'xl';
  showBadge?: boolean;
  badgeIcon?: string;
  badgeColor?: string;
  isFoundingDreamer?: boolean;
  isVerified?: boolean;
  isVerifiedInterpreter?: boolean;
  onPress?: () => void;
  style?: any;
}

const sizeMap = {
  xs: { avatar: 28, badgeIcon: 10 },
  small: { avatar: 36, badgeIcon: 12 },
  medium: { avatar: 48, badgeIcon: 14 },
  large: { avatar: 72, badgeIcon: 18 },
  xl: { avatar: 110, badgeIcon: 22 },
};

export default function UserAvatar({
  uri,
  name = 'User',
  size = 'medium',
  showBadge = false,
  badgeIcon = 'checkmark',
  badgeColor = theme.primary,
  isFoundingDreamer = false,
  isVerified = false,
  isVerifiedInterpreter = false,
  onPress,
  style,
}: Props) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const dimensions = sizeMap[size];

  const getPrimaryBadge = () => {
    if (isFoundingDreamer && BADGES.founding_dreamer) return BADGES.founding_dreamer;
    if (isVerifiedInterpreter && BADGES.verified_interpreter) return BADGES.verified_interpreter;
    if (isVerified && BADGES.verified) return BADGES.verified;
    return null;
  };

  const primaryBadge = getPrimaryBadge();
  const hasSpecialStatus = !!primaryBadge;
  const shouldShowBadge = showBadge || hasSpecialStatus;

  const getBadgeColor = () => {
    if (primaryBadge) return primaryBadge.color;
    return badgeColor;
  };

  const getBadgeIcon = (): string => {
    if (primaryBadge) return primaryBadge.icon;
    return badgeIcon;
  };

  const getAvatarUrl = () => {
    if (uri && (uri.startsWith('http') || uri.startsWith('file'))) return uri;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=60a5fa&size=${dimensions.avatar * 2}`;
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const badgeColorValue = getBadgeColor();

  const avatarContent = (
    <View style={[styles.container, style]}>
      {/* Avatar */}
      <View
        style={[
          styles.avatarWrapper,
          {
            width: dimensions.avatar,
            height: dimensions.avatar,
            borderRadius: dimensions.avatar / 2,
          },
        ]}
      >
        {!imageLoaded && (
          <View
            style={[
              styles.placeholder,
              {
                width: dimensions.avatar,
                height: dimensions.avatar,
                borderRadius: dimensions.avatar / 2,
              },
            ]}
          >
            <Ionicons name="person" size={dimensions.avatar * 0.5} color={theme.textMuted} />
          </View>
        )}

        <Animated.Image
          source={{ uri: getAvatarUrl() }}
          style={[
            styles.avatar,
            {
              width: dimensions.avatar,
              height: dimensions.avatar,
              borderRadius: dimensions.avatar / 2,
              opacity: fadeAnim,
            },
          ]}
          onLoad={handleImageLoad}
        />
      </View>

      {/* Badge - just the icon with color, no circle background */}
      {shouldShowBadge && (
        <View
          style={[
            styles.badgeContainer,
            {
              bottom: size === 'xl' ? 0 : size === 'large' ? -2 : -3,
              right: size === 'xl' ? 0 : size === 'large' ? -2 : -3,
            },
          ]}
        >
          <View style={styles.badgeBackground}>
            <Ionicons
              name={getBadgeIcon() as any}
              size={dimensions.badgeIcon}
              color={badgeColorValue}
            />
          </View>
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {avatarContent}
      </TouchableOpacity>
    );
  }

  return avatarContent;
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrapper: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.glassBorder,
  },
  placeholder: {
    position: 'absolute',
    backgroundColor: theme.glass,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    position: 'absolute',
    backgroundColor: theme.glass,
  },
  badgeContainer: {
    position: 'absolute',
  },
  badgeBackground: {
    backgroundColor: theme.background,
    borderRadius: 10,
    padding: 2,
  },
});