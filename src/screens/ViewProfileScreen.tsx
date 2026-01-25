import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const theme = {
  background: '#050a15',
  glass: 'rgba(255, 255, 255, 0.06)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  glassBorderLight: 'rgba(255, 255, 255, 0.15)',
  primary: '#60a5fa',
  gold: '#d4af37',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textSubtle: '#64748b',
  textMuted: '#475569',
  purple: '#a78bfa',
};

const AMBIENT_GRADIENTS: readonly [string, string, string][] = [
  ['#050a15', '#0a1628', '#0f172a'],
  ['#0a0f1a', '#121a2e', '#1a2744'],
];

interface UserProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_public: boolean;
  created_at: string;
}

interface PublicDream {
  id: string;
  title: string | null;
  content: string | null;
  dream_date: string;
  created_at: string;
}

export default function ViewProfileScreen({ route, navigation }: any) {
  const { userId } = route.params;
  const currentUser = useAuthStore((state) => state.user);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dreams, setDreams] = useState<PublicDream[]>([]);
  const [loading, setLoading] = useState(true);
  const [dreamsLoading, setDreamsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOwnProfile = currentUser?.id === userId;

  useEffect(() => {
    fetchProfile();
    fetchPublicDreams();
  }, [userId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio, is_public, created_at')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (!data.is_public && !isOwnProfile) {
        setError('This profile is private');
        return;
      }

      setProfile(data);
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      setError('Could not load profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchPublicDreams = async () => {
    try {
      setDreamsLoading(true);
      const { data, error } = await supabase
        .from('dreams')
        .select('id, title, content, dream_date, created_at')
        .eq('user_id', userId)
        .eq('is_public', true)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setDreams(data || []);
    } catch (err) {
      console.error('Error fetching dreams:', err);
    } finally {
      setDreamsLoading(false);
    }
  };

  const getAvatarUrl = () => {
    if (profile?.avatar_url) return profile.avatar_url;
    const name = profile?.display_name || profile?.username || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=60a5fa&size=200`;
  };

  const getDisplayName = () => {
    if (profile?.display_name) return profile.display_name;
    if (profile?.username) return `@${profile.username}`;
    return 'Dreamer';
  };

  const memberSince = () => {
    if (!profile?.created_at) return '';
    const date = new Date(profile.created_at);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <LinearGradient colors={AMBIENT_GRADIENTS[0]} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (error || !profile) {
    return (
      <LinearGradient colors={AMBIENT_GRADIENTS[0]} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
              <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profile</Text>
            <View style={{ width: 44 }} />
          </View>
          <View style={styles.center}>
            <Ionicons name="lock-closed" size={48} color={theme.textMuted} />
            <Text style={styles.errorTitle}>{error || 'Profile not found'}</Text>
            <Text style={styles.errorSubtitle}>This profile is not available</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={AMBIENT_GRADIENTS[0]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {profile.username ? `@${profile.username}` : 'Profile'}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile Section */}
          <View style={styles.profileSection}>
            <View style={styles.avatarGlow}>
              <Image source={{ uri: getAvatarUrl() }} style={styles.avatar} />
            </View>

            <Text style={styles.displayName}>{getDisplayName()}</Text>
            {profile.username && profile.display_name && (
              <Text style={styles.username}>@{profile.username}</Text>
            )}

            {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

            <Text style={styles.memberSince}>Dreaming since {memberSince()}</Text>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderColor: theme.primary + '30' }]}>
              <Text style={styles.statValue}>{dreams.length}</Text>
              <Text style={styles.statLabel}>Public Dreams</Text>
            </View>
          </View>

          {/* Public Dreams */}
          {dreams.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Public Dreams</Text>
              {dreams.map((dream) => (
                <View key={dream.id} style={styles.dreamCard}>
                  <View style={styles.dreamHeader}>
                    <Text style={styles.dreamTitle} numberOfLines={1}>
                      {dream.title || 'Untitled Dream'}
                    </Text>
                    <Text style={styles.dreamDate}>{formatDate(dream.dream_date)}</Text>
                  </View>
                  {dream.content && (
                    <Text style={styles.dreamExcerpt} numberOfLines={2}>
                      {dream.content}
                    </Text>
                  )}
                </View>
              ))}
            </>
          )}

          {dreams.length === 0 && !dreamsLoading && (
            <View style={styles.emptyState}>
              <Ionicons name="moon-outline" size={32} color={theme.textMuted} />
              <Text style={styles.emptyText}>No public dreams yet</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },

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
  headerTitle: { fontSize: 18, fontWeight: '600', color: theme.textPrimary },

  content: { padding: 20, paddingBottom: 40 },

  profileSection: { alignItems: 'center', marginBottom: 24 },
  avatarGlow: {
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: theme.glassBorderLight,
  },
  displayName: { fontSize: 22, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  username: { fontSize: 15, color: theme.textSubtle, marginBottom: 12 },
  bio: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  memberSince: { fontSize: 13, color: theme.textMuted },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  statCard: {
    flex: 1,
    backgroundColor: theme.glass,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  statValue: { fontSize: 24, fontWeight: '700', color: theme.textPrimary },
  statLabel: { fontSize: 12, color: theme.textSubtle, marginTop: 4 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },

  dreamCard: {
    backgroundColor: theme.glass,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  dreamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dreamTitle: { fontSize: 15, fontWeight: '600', color: theme.textPrimary, flex: 1 },
  dreamDate: { fontSize: 12, color: theme.textMuted, marginLeft: 8 },
  dreamExcerpt: { fontSize: 14, color: theme.textSecondary, lineHeight: 20 },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: theme.textMuted, marginTop: 12 },

  errorTitle: { fontSize: 18, fontWeight: '600', color: theme.textPrimary, marginTop: 16 },
  errorSubtitle: { fontSize: 14, color: theme.textMuted, marginTop: 4 },
});