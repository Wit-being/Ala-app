import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
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

// Badge configuration
const BADGES = {
  founding_dreamer: {
    icon: '🌟',
    label: 'Founding Dreamer',
    color: theme.gold,
    description: 'One of the first 50 dreamers',
  },
  verified_interpreter: {
    icon: '🔮',
    label: 'Verified Interpreter',
    color: theme.purple,
    description: 'Highly rated dream interpreter',
  },
  verified: {
    icon: '✓',
    label: 'Verified',
    color: theme.primary,
    description: 'Verified account',
  },
};

interface UserProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_public: boolean;
  is_founding_dreamer: boolean;
  is_verified_interpreter: boolean;
  is_verified: boolean;
  interpreter_rating: number;
  total_interpretations: number;
  account_number: number | null;
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
  const [showBadgeInfo, setShowBadgeInfo] = useState<string | null>(null);

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
        .select('*')
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

  // Check if user has any badge
  const hasBadge = () => {
    return profile?.is_founding_dreamer || profile?.is_verified_interpreter || profile?.is_verified;
  };

  // Get user badges
  const getUserBadges = () => {
    const badges: string[] = [];
    if (profile?.is_founding_dreamer) badges.push('founding_dreamer');
    if (profile?.is_verified_interpreter) badges.push('verified_interpreter');
    if (profile?.is_verified) badges.push('verified');
    return badges;
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

  // Dynamic member text based on badges
  const getMemberText = () => {
    if (!profile?.created_at) return '';
    const date = new Date(profile.created_at);
    const formattedDate = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    if (hasBadge()) {
      return `Conscious before ${formattedDate}`;
    }
    return `Dreaming since ${formattedDate}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Render badge component
  const renderBadge = (badgeKey: string, size: 'small' | 'large' = 'small') => {
    const badge = BADGES[badgeKey as keyof typeof BADGES];
    if (!badge) return null;

    const isSmall = size === 'small';
    
    return (
      <TouchableOpacity
        key={badgeKey}
        onPress={() => setShowBadgeInfo(badgeKey)}
        style={[
          styles.badge,
          { backgroundColor: badge.color + '20', borderColor: badge.color + '40' },
          isSmall ? styles.badgeSmall : styles.badgeLarge,
        ]}
      >
        <Text style={isSmall ? styles.badgeIconSmall : styles.badgeIconLarge}>{badge.icon}</Text>
        {!isSmall && <Text style={[styles.badgeLabel, { color: badge.color }]}>{badge.label}</Text>}
      </TouchableOpacity>
    );
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

  const userBadges = getUserBadges();

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
            <View style={[
              styles.avatarGlow,
              hasBadge() && { shadowColor: theme.gold }
            ]}>
              <Image 
                source={{ uri: getAvatarUrl() }} 
                style={[
                  styles.avatar,
                  hasBadge() && { borderColor: theme.gold }
                ]} 
              />
            </View>

            {/* Badges Row */}
            {userBadges.length > 0 && (
              <View style={styles.badgesRow}>
                {userBadges.map((badge) => renderBadge(badge, 'large'))}
              </View>
            )}

            <Text style={styles.displayName}>{getDisplayName()}</Text>
            {profile.username && profile.display_name && (
              <Text style={styles.username}>@{profile.username}</Text>
            )}

            {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

            <Text style={[
              styles.memberSince,
              hasBadge() && { color: theme.gold }
            ]}>
              {getMemberText()}
            </Text>
            
            {profile.account_number && profile.account_number <= 50 && (
              <Text style={styles.accountNumber}>Dreamer #{profile.account_number}</Text>
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderColor: theme.primary + '30' }]}>
              <Text style={styles.statValue}>{dreams.length}</Text>
              <Text style={styles.statLabel}>Public Dreams</Text>
            </View>
            {profile.is_verified_interpreter && (
              <View style={[styles.statCard, { borderColor: theme.purple + '30' }]}>
                <Text style={[styles.statValue, { color: theme.purple }]}>
                  {profile.interpreter_rating?.toFixed(1) || '0.0'}
                </Text>
                <Text style={styles.statLabel}>Interpreter Rating</Text>
              </View>
            )}
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

      {/* Badge Info Modal */}
      <Modal
        visible={!!showBadgeInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBadgeInfo(null)}
      >
        <Pressable style={styles.badgeModalOverlay} onPress={() => setShowBadgeInfo(null)}>
          <View style={styles.badgeModalContent}>
            {showBadgeInfo && BADGES[showBadgeInfo as keyof typeof BADGES] && (
              <>
                <Text style={styles.badgeModalIcon}>
                  {BADGES[showBadgeInfo as keyof typeof BADGES].icon}
                </Text>
                <Text style={[
                  styles.badgeModalTitle,
                  { color: BADGES[showBadgeInfo as keyof typeof BADGES].color }
                ]}>
                  {BADGES[showBadgeInfo as keyof typeof BADGES].label}
                </Text>
                <Text style={styles.badgeModalDesc}>
                  {BADGES[showBadgeInfo as keyof typeof BADGES].description}
                </Text>
                <TouchableOpacity
                  style={styles.badgeModalClose}
                  onPress={() => setShowBadgeInfo(null)}
                >
                  <Text style={styles.badgeModalCloseText}>Got it</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Pressable>
      </Modal>
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

  // Badges
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeLarge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  badgeIconSmall: {
    fontSize: 14,
  },
  badgeIconLarge: {
    fontSize: 16,
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: '600',
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
  accountNumber: { 
    fontSize: 11, 
    color: theme.gold, 
    marginTop: 4,
    fontWeight: '600',
  },

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

  // Badge Info Modal
  badgeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  badgeModalContent: {
    backgroundColor: 'rgba(15, 20, 35, 0.95)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.glassBorder,
    width: '100%',
    maxWidth: 300,
  },
  badgeModalIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  badgeModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  badgeModalDesc: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  badgeModalClose: {
    backgroundColor: theme.glass,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  badgeModalCloseText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
});