import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useSocialStore } from '../store/socialStore';
import { useAlert } from '../hooks/useAlert';
import { theme, AMBIENT_GRADIENTS } from '../constants/theme';
import { BlockedUser } from '../types/social';

export default function BlockedUsersScreen({ navigation }: any) {
  const user = useAuthStore((state) => state.user);
  const { blockedUsers, isLoading, fetchBlockedUsers, unblockUser } = useSocialStore();
  const { showAlert } = useAlert();
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchBlockedUsers(user.id);
    }
  }, [user?.id]);

  const handleUnblock = (blockedUser: BlockedUser) => {
    const displayName =
      blockedUser.profile?.display_name || blockedUser.profile?.username || 'this user';

    showAlert({
      title: 'Unblock User',
      message: `Are you sure you want to unblock ${displayName}? They will be able to see your profile and dreams again.`,
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'default',
          onPress: async () => {
            if (!user?.id) return;
            setUnblockingId(blockedUser.blocked_user_id);
            const success = await unblockUser(user.id, blockedUser.blocked_user_id);
            setUnblockingId(null);
            if (!success) {
              showAlert({
                title: 'Error',
                message: 'Failed to unblock user. Please try again.',
                type: 'error',
              });
            }
          },
        },
      ],
    });
  };

  const getAvatarUrl = (profile: BlockedUser['profile']) => {
    if (profile?.avatar_url) return profile.avatar_url;
    const name = profile?.display_name || profile?.username || 'U';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=60a5fa&size=80`;
  };

  const renderItem = ({ item }: { item: BlockedUser }) => {
    const isUnblocking = unblockingId === item.blocked_user_id;

    return (
      <View style={styles.userCard}>
        <Image source={{ uri: getAvatarUrl(item.profile) }} style={styles.avatar} />
        <View style={styles.userInfo}>
          <Text style={styles.displayName}>
            {item.profile?.display_name || item.profile?.username || 'Unknown User'}
          </Text>
          {item.profile?.username && (
            <Text style={styles.username}>@{item.profile.username}</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.unblockBtn}
          onPress={() => handleUnblock(item)}
          disabled={isUnblocking}
        >
          {isUnblocking ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Text style={styles.unblockBtnText}>Unblock</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="ban-outline" size={48} color={theme.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>No Blocked Users</Text>
      <Text style={styles.emptySubtitle}>
        When you block someone, they won't be able to see your profile or dreams, and you won't
        see theirs.
      </Text>
    </View>
  );

  return (
    <LinearGradient colors={AMBIENT_GRADIENTS[0]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Blocked Users</Text>
          <View style={styles.headerBtnPlaceholder} />
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <FlatList
            data={blockedUsers}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={[
              styles.listContent,
              blockedUsers.length === 0 && styles.listContentEmpty,
            ]}
            ListEmptyComponent={EmptyState}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnPlaceholder: {
    width: 44,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  listContentEmpty: {
    flex: 1,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.glass,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  username: {
    fontSize: 14,
    color: theme.textMuted,
    marginTop: 2,
  },
  unblockBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: theme.glass,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.primary + '40',
    minWidth: 80,
    alignItems: 'center',
  },
  unblockBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.glass,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});