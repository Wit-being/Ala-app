import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../constants/theme';
import { Interpretation, UserProfile } from '../../types/dreams';

interface Props {
  interpretation: Interpretation;
  depth?: number;
  onProfilePress: (profile: UserProfile | null, userId: string) => void;
}

const getAvatarUrl = (profile: UserProfile | undefined | null, fallbackName: string) => {
  if (profile?.avatar_url?.startsWith('http')) return profile.avatar_url;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    profile?.display_name || profile?.username || fallbackName
  )}&background=1e293b&color=60a5fa&size=64`;
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function InterpretationThread({ interpretation, depth = 0, onProfilePress }: Props) {
  const avatarUrl = getAvatarUrl(interpretation.author, 'User');
  const displayName = interpretation.author?.display_name || interpretation.author?.username || 'Anonymous';

  return (
    <View style={[styles.item, { marginLeft: depth * 16 }]}>
      {depth > 0 && <View style={styles.line} />}
      <LinearGradient
        colors={
          depth === 0
            ? ['rgba(212, 175, 55, 0.1)', 'rgba(212, 175, 55, 0.02)']
            : ['rgba(96, 165, 250, 0.08)', 'rgba(96, 165, 250, 0.02)']
        }
        style={styles.content}
      >
        <TouchableOpacity
          style={styles.header}
          onPress={() => onProfilePress(interpretation.author || null, interpretation.user_id)}
          activeOpacity={0.7}
        >
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          <View style={styles.meta}>
            <Text style={styles.author}>{displayName}</Text>
            <Text style={styles.time}>{formatDate(interpretation.created_at)}</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.text}>{interpretation.content}</Text>
      </LinearGradient>
      {interpretation.replies?.map((reply) => (
        <InterpretationThread
          key={reply.id}
          interpretation={reply}
          depth={depth + 1}
          onProfilePress={onProfilePress}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    marginBottom: 12,
    position: 'relative',
  },
  line: {
    position: 'absolute',
    left: -12,
    top: 20,
    bottom: 0,
    width: 2,
    backgroundColor: theme.glassBorder,
    borderRadius: 1,
  },
  content: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  meta: {
    flex: 1,
  },
  author: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  time: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 1,
  },
  text: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
});