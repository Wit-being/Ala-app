import React from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FeedDreamCard from './FeedDreamCard';
import { theme } from '../../constants/theme';
import { DreamWithMeta, UserProfile, AudioContext } from '../../types/dreams';

interface Props {
  dreams: DreamWithMeta[];
  loading: boolean;
  error: string | null;
  currentUserId?: string;
  playingId: string | null;
  playingContext: AudioContext | null;
  isAudioLoading: string | null;
  audioStatus: any;
  onRefresh: () => void;
  onDreamPress: (dream: DreamWithMeta) => void;
  onPlayAudio: (dream: DreamWithMeta, context: AudioContext) => void;
  onToggleLike: (dream: DreamWithMeta) => void;
  onWowPress: () => void;
  onProfilePress: (profile: UserProfile | null, userId: string) => void;
  onRecordPress: () => void;
}

export default function FeedContent({
  dreams,
  loading,
  error,
  currentUserId,
  playingId,
  playingContext,
  isAudioLoading,
  audioStatus,
  onRefresh,
  onDreamPress,
  onPlayAudio,
  onToggleLike,
  onWowPress,
  onProfilePress,
  onRecordPress,
}: Props) {
  if (loading && dreams.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading dreams...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={48} color={theme.textSubtle} />
        <Text style={styles.stateTitle}>Connection Issue</Text>
        <Text style={styles.stateSubtitle}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (dreams.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="moon-outline" size={48} color={theme.textSubtle} />
        <Text style={styles.stateTitle}>No dreams yet</Text>
        <Text style={styles.stateSubtitle}>Be the first to share</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={onRecordPress}>
          <Text style={styles.primaryBtnText}>Share a Dream</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={dreams}
      renderItem={({ item }) => (
        <FeedDreamCard
          item={item}
          currentUserId={currentUserId}
          playingId={playingId}
          playingContext={playingContext}
          isAudioLoading={isAudioLoading}
          audioStatus={audioStatus}
          onPress={() => onDreamPress(item)}
          onPlayAudio={onPlayAudio}
          onToggleLike={onToggleLike}
          onWowPress={onWowPress}
          onProfilePress={onProfilePress}
        />
      )}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshing={loading}
      onRefresh={onRefresh}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 140,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 16,
    color: theme.textSubtle,
    fontSize: 14,
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  stateSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  primaryBtn: {
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    backgroundColor: theme.primary,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});