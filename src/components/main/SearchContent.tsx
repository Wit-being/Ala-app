import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import debounce from 'lodash.debounce';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useSocialStore } from '../../store/socialStore';
import { socialService } from '../../services/socialService';
import { theme } from '../../constants/theme';
import { BADGES } from '../../constants/badges';

interface UserResult {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_founding_dreamer: boolean;
  is_verified: boolean;
  is_verified_interpreter: boolean;
  isFollowing?: boolean;
}

interface Props {
  navigation: any;
}

export default function SearchContent({ navigation }: Props) {
  const currentUser = useAuthStore((state) => state.user);
  const { isUserBlocked } = useSocialStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const searchUsers = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      const cleanQuery = searchQuery.trim().toLowerCase();

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio, is_founding_dreamer, is_verified, is_verified_interpreter')
        .or(`username.ilike.%${cleanQuery}%,display_name.ilike.%${cleanQuery}%`)
        .neq('id', currentUser?.id || '')
        .limit(20);

      if (error) throw error;

      let usersWithStatus: UserResult[] = data || [];
      usersWithStatus = usersWithStatus.filter((user) => !isUserBlocked(user.id));

      if (currentUser?.id) {
        const withFollowStatus = await Promise.all(
          usersWithStatus.map(async (user) => {
            const isFollowing = await socialService.isFollowing(currentUser.id, user.id);
            return { ...user, isFollowing };
          })
        );
        usersWithStatus = withFollowStatus;
      }

      setResults(usersWithStatus);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = useCallback(
    debounce((q: string) => searchUsers(q), 400),
    [currentUser?.id]
  );

  const handleQueryChange = (text: string) => {
    setQuery(text);
    debouncedSearch(text);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
  };

  const handleFollowToggle = async (targetUser: UserResult) => {
    if (!currentUser?.id || actionLoadingId) return;

    setActionLoadingId(targetUser.id);
    try {
      if (targetUser.isFollowing) {
        const result = await socialService.unfollowUser(currentUser.id, targetUser.id);
        if (result.success) {
          setResults((prev) =>
            prev.map((u) => (u.id === targetUser.id ? { ...u, isFollowing: false } : u))
          );
        }
      } else {
        const result = await socialService.followUser(currentUser.id, targetUser.id);
        if (result.success) {
          setResults((prev) =>
            prev.map((u) => (u.id === targetUser.id ? { ...u, isFollowing: true } : u))
          );
        }
      }
    } catch (error) {
      console.error('Follow error:', error);
    } finally {
      setActionLoadingId(null);
    }
  };

  const getAvatarUrl = (user: UserResult) => {
    if (user.avatar_url) return user.avatar_url;
    const name = user.display_name || user.username || 'U';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=60a5fa&size=80`;
  };

  const getDisplayName = (user: UserResult) => {
    return user.display_name || user.username || 'Anonymous';
  };

  const getPrimaryBadge = (user: UserResult) => {
    if (user.is_founding_dreamer) return BADGES.founding_dreamer;
    if (user.is_verified_interpreter) return BADGES.verified_interpreter;
    if (user.is_verified) return BADGES.verified;
    return null;
  };

  const renderUser = ({ item }: { item: UserResult }) => {
    const badge = getPrimaryBadge(item);

    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={() => {
          Keyboard.dismiss();
          navigation.navigate('ViewProfile', { userId: item.id });
        }}
        activeOpacity={0.7}
      >
        <Image source={{ uri: getAvatarUrl(item) }} style={styles.avatar} />

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
          {item.bio && (
            <Text style={styles.bio} numberOfLines={1}>
              {item.bio}
            </Text>
          )}
        </View>

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
      </TouchableOpacity>
    );
  };

  const EmptyState = () => {
    if (!hasSearched) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="search" size={48} color={theme.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>Find Dreamers</Text>
          <Text style={styles.emptySubtitle}>
            Search by username or display name to connect with other dreamers.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconWrap}>
          <Ionicons name="person-outline" size={48} color={theme.textMuted} />
        </View>
        <Text style={styles.emptyTitle}>No Results</Text>
        <Text style={styles.emptySubtitle}>
          We couldn't find anyone matching "{query}". Try a different search.
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search" size={20} color={theme.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search dreamers..."
            placeholderTextColor={theme.textMuted}
            value={query}
            onChangeText={handleQueryChange}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          contentContainerStyle={[
            styles.listContent,
            results.length === 0 && styles.listContentEmpty,
          ]}
          ListEmptyComponent={EmptyState}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.glass,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.textPrimary,
    paddingVertical: 14,
  },
  clearBtn: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 140,
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
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
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
  bio: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 4,
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