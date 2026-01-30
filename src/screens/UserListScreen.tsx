import React, { useState, useEffect } from 'react';
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
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useSocialStore } from '../store/socialStore';
import { socialService } from '../services/socialService';
import { useAlert } from '../hooks/useAlert';
import { theme, AMBIENT_GRADIENTS } from '../constants/theme';
import { BADGES } from '../constants/badges';

interface UserItem {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_founding_dreamer: boolean;
  is_verified: boolean;
  is_verified_interpreter: boolean;
  isFollowing?: boolean;
}

type ListType = 'followers' | 'following';

export default function UserListScreen({ navigation, route }: any) {
  const { userId, type, username } = route.params as {
    userId: string;
    type: ListType;
    username?: string;
  };

  const currentUser = useAuthStore((state) => state.user);
  const { isUserBlocked } = useSocialStore();
  const { showAlert } = useAlert();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const isOwnList = currentUser?.id === userId;

  useEffect(() => {
    fetchUsers();
  }, [userId, type]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let userIds: string[] = [];

      if (type === 'followers') {
        const { data } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', userId);
        userIds = data?.map((f) => f.follower_id) || [];
      } else {
        const { data } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', userId);
        userIds = data?.map((f) => f.following_id) || [];
      }

      if (userIds.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, is_founding_dreamer, is_verified, is_verified_interpreter')
        .in('id', userIds);

      // Check follow status for each user if viewing own list
      let usersWithStatus: UserItem[] = profiles || [];

      if (currentUser?.id) {
        const followChecks = await Promise.all(
          usersWithStatus.map(async (user) => {
            if (user.id === currentUser.id) return { ...user, isFollowing: false };
            const isFollowing = await socialService.isFollowing(currentUser.id, user.id);
            return { ...user, isFollowing };
          })
        );
        usersWithStatus = followChecks;
      }

      // Filter out blocked users
      usersWithStatus = usersWithStatus.filter((user) => !isUserBlocked(user.id));

      setUsers(usersWithStatus);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async (targetUser: UserItem) => {
    if (!currentUser?.id || actionLoadingId) return;

    setActionLoadingId(targetUser.id);
    try {
      if (targetUser.isFollowing) {
        const result = await socialService.unfollowUser(currentUser.id, targetUser.id);
        if (result.success) {
          setUsers((prev) =>
            prev.map((u) => (u.id === targetUser.id ? { ...u, isFollowing: false } : u))
          );
        }
      } else {
        const result = await socialService.followUser(currentUser.id, targetUser.id);
        if (result.success) {
          setUsers((prev) =>
            prev.map((u) => (u.id === targetUser.id ? { ...u, isFollowing: true } : u))
          );
        } else if (result.error) {
          showAlert({
            title: 'Cannot Follow',
            message: result.error,
            type: 'error',
          });
        }
      }
    } catch (error) {
      showAlert({
        title: 'Error',
        message: 'Something went wrong.',
        type: 'error',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const getAvatarUrl = (user: UserItem) => {
    if (user.avatar_url) return user.avatar_url;
    const name = user.display_name || user.username || 'U';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=60a5fa&size=80`;
  };

  const getDisplayName = (user: UserItem) => {
    return user.display_name || user.username || 'Anonymous';
  };

  const hasBadge = (user: UserItem) => {
    return user.is_founding_dreamer || user.is_verified || user.is_verified_interpreter;
  };

  const getPrimaryBadge = (user: UserItem) => {
    if (user.is_founding_dreamer) return BADGES.founding_dreamer;
    if (user.is_verified_interpreter) return BADGES.verified_interpreter;
    if (user.is_verified) return BADGES.verified;
    return null;
  };

  const renderUser = ({ item }: { item: UserItem }) => {
    const isCurrentUser = item.id === currentUser?.id;
    const badge = getPrimaryBadge(item);

    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={() => {
          if (isCurrentUser) {
            navigation.navigate('Profile');
          } else {
            navigation.push('ViewProfile', { userId: item.id });
          }
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.avatarWrap, hasBadge(item) && { borderColor: theme.gold }]}>
          <Image source={{ uri: getAvatarUrl(item) }} style={styles.avatar} />
        </View>

        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.displayName} numberOfLines={1}>
              {getDisplayName(item)}
            </Text>
            {badge && (
              <Ionicons
                name={badge.icon as any}
                size={14}
                color={badge.color}
                style={styles.badgeIcon}
              />
            )}
          </View>
          {item.username && (
            <Text style={styles.username} numberOfLines={1}>
              @{item.username}
            </Text>
          )}
        </View>

        {!isCurrentUser && (
          <TouchableOpacity
            style={[styles.followBtn, item.isFollowing && styles.followingBtn]}
            onPress={() => handleFollowToggle(item)}
            disabled={actionLoadingId === item.id}
          >
            {actionLoadingId === item.id ? (
              <ActivityIndicator size="small" color={item.isFollowing ? theme.textPrimary : '#fff'} />
            ) : (
              <Text style={[styles.followBtnText, item.isFollowing && styles.followingBtnText]}>
                {item.isFollowing ? 'Following' : 'Follow'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons
          name={type === 'followers' ? 'people-outline' : 'person-add-outline'}
          size={48}
          color={theme.textMuted}
        />
      </View>
      <Text style={styles.emptyTitle}>
        {type === 'followers' ? 'No Followers Yet' : 'Not Following Anyone'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {type === 'followers'
          ? isOwnList
            ? 'Share your dreams to connect with other dreamers.'
            : 'This user has no followers yet.'
          : isOwnList
          ? 'Find dreamers to follow and see their dreams in your feed.'
          : 'This user is not following anyone yet.'}
      </Text>
    </View>
  );

  const title = type === 'followers' ? 'Followers' : 'Following';

  return (
    <LinearGradient colors={AMBIENT_GRADIENTS[0]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{title}</Text>
            {username && <Text style={styles.headerSubtitle}>@{username}</Text>}
          </View>
          <View style={styles.headerBtnPlaceholder} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            renderItem={renderUser}
            contentContainerStyle={[
              styles.listContent,
              users.length === 0 && styles.listContentEmpty,
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
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: theme.textMuted,
    marginTop: 2,
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
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  avatarWrap: {
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    flexShrink: 1,
  },
  badgeIcon: {
    marginLeft: 6,
  },
  username: {
    fontSize: 14,
    color: theme.textMuted,
    marginTop: 2,
  },

  followBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: theme.primary,
    borderRadius: 18,
    minWidth: 90,
    alignItems: 'center',
  },
  followingBtn: {
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  followBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  followingBtnText: {
    color: theme.textPrimary,
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