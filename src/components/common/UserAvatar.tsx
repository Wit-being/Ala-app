import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

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
  xs: { avatar: 28, badge: 12, badgeIcon: 6, borderWidth: 1.5 },
  small: { avatar: 36, badge: 14, badgeIcon: 8, borderWidth: 2 },
  medium: { avatar: 48, badge: 18, badgeIcon: 10, borderWidth: 2 },
  large: { avatar: 72, badge: 24, badgeIcon: 12, borderWidth: 2.5 },
  xl: { avatar: 110, badge: 28, badgeIcon: 14, borderWidth: 3 },
};

export default function UserAvatar({
  uri,
  name = 'User',
  size = 'medium',
  showBadge = false,
  badgeIcon = 'checkmark',
  badgeColor = theme.gold,
  isFoundingDreamer = false,
  isVerified = false,
  isVerifiedInterpreter = false,
  onPress,
  style,
}: Props) {
  const dimensions = sizeMap[size];
  
  const hasSpecialStatus = isFoundingDreamer || isVerified || isVerifiedInterpreter;
  const shouldShowBadge = showBadge || hasSpecialStatus;
  
  // Determine badge color based on status
  const getBadgeColor = () => {
    if (isFoundingDreamer) return theme.gold;
    if (isVerifiedInterpreter) return theme.purple;
    if (isVerified) return theme.primary;
    return badgeColor;
  };

  // Determine badge icon based on status
  const getBadgeIcon = () => {
    if (isFoundingDreamer) return 'star';
    if (isVerifiedInterpreter) return 'eye';
    if (isVerified) return 'checkmark';
    return badgeIcon;
  };

  const getAvatarUrl = () => {
    if (uri?.startsWith('http')) return uri;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=60a5fa&size=${dimensions.avatar * 2}`;
  };

  const avatarContent = (
    <View style={[styles.container, style]}>
      {/* Glow effect for special users */}
      {hasSpecialStatus && (
        <View
          style={[
            styles.glow,
            {
              width: dimensions.avatar + 8,
              height: dimensions.avatar + 8,
              borderRadius: (dimensions.avatar + 8) / 2,
              backgroundColor: getBadgeColor() + '20',
              shadowColor: getBadgeColor(),
            },
          ]}
        />
      )}
      
      {/* Avatar Image */}
      <View
        style={[
          styles.avatarWrapper,
          {
            width: dimensions.avatar,
            height: dimensions.avatar,
            borderRadius: dimensions.avatar / 2,
            borderWidth: hasSpecialStatus ? dimensions.borderWidth : 0,
            borderColor: hasSpecialStatus ? getBadgeColor() : 'transparent',
          },
        ]}
      >
        <Image
          source={{ uri: getAvatarUrl() }}
          style={[
            styles.avatar,
            {
              width: dimensions.avatar - (hasSpecialStatus ? dimensions.borderWidth * 2 : 0),
              height: dimensions.avatar - (hasSpecialStatus ? dimensions.borderWidth * 2 : 0),
              borderRadius: (dimensions.avatar - (hasSpecialStatus ? dimensions.borderWidth * 2 : 0)) / 2,
            },
          ]}
        />
      </View>

      {/* Badge */}
      {shouldShowBadge && (
        <View
          style={[
            styles.badge,
            {
              width: dimensions.badge,
              height: dimensions.badge,
              borderRadius: dimensions.badge / 2,
              backgroundColor: getBadgeColor(),
              borderWidth: size === 'xs' || size === 'small' ? 1.5 : 2,
            },
          ]}
        >
          <Ionicons
            name={getBadgeIcon() as any}
            size={dimensions.badgeIcon}
            color="#fff"
          />
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
  glow: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarWrapper: {
    overflow: 'hidden',
  },
  avatar: {
    backgroundColor: theme.glass,
  },
  badge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
});