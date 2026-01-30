import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { theme, AMBIENT_GRADIENTS } from '../constants/theme';
import { BADGES, BADGE_CATEGORIES } from '../constants/badges';
import { BadgeKey } from '../types/badges';

interface UserBadgeStatus {
  key: BadgeKey;
  earned: boolean;
  earnedAt?: string;
  progress?: number;
  target?: number;
}

export default function AllBadgesScreen({ navigation }: any) {
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [badgeStatuses, setBadgeStatuses] = useState<Record<string, UserBadgeStatus>>({});

  useEffect(() => {
    fetchBadgeStatuses();
  }, [user?.id]);

  const fetchBadgeStatuses = async () => {
    if (!user?.id) return;

    try {
      // Fetch profile for status badges
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_founding_dreamer, is_verified, is_verified_interpreter')
        .eq('id', user.id)
        .single();

      // Fetch dream counts
      const { count: totalDreams } = await supabase
        .from('dreams')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const { count: publicDreams } = await supabase
        .from('dreams')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_public', true);

      // Fetch following count
      const { count: followingCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', user.id);

      // Fetch interpretations given
      const { count: interpretationsGiven } = await supabase
        .from('interpretations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Fetch reactions received
      const { data: userDreams } = await supabase
        .from('dreams')
        .select('id')
        .eq('user_id', user.id);

      let reactionsReceived = 0;
      if (userDreams && userDreams.length > 0) {
        const dreamIds = userDreams.map((d) => d.id);
        const { count } = await supabase
          .from('reactions')
          .select('*', { count: 'exact', head: true })
          .in('dream_id', dreamIds);
        reactionsReceived = count || 0;
      }

      // Calculate streak
      const { data: dreams } = await supabase
        .from('dreams')
        .select('dream_date')
        .eq('user_id', user.id);

      let streak = 0;
      if (dreams && dreams.length > 0) {
        const sortedDates = [...new Set(dreams.map((d) => d.dream_date.split('T')[0]))].sort().reverse();
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        if (sortedDates[0] === today || sortedDates[0] === yesterday) {
          streak = 1;
          for (let i = 1; i < sortedDates.length; i++) {
            const prevDate = new Date(sortedDates[i - 1]);
            const currDate = new Date(sortedDates[i]);
            const diffDays = Math.floor((prevDate.getTime() - currDate.getTime()) / 86400000);
            if (diffDays === 1) streak++;
            else break;
          }
        }
      }

      // Build badge statuses
      const statuses: Record<string, UserBadgeStatus> = {};

      // Status badges
      statuses.founding_dreamer = {
        key: 'founding_dreamer',
        earned: profile?.is_founding_dreamer || false,
      };
      statuses.verified = {
        key: 'verified',
        earned: profile?.is_verified || false,
      };
      statuses.verified_interpreter = {
        key: 'verified_interpreter',
        earned: profile?.is_verified_interpreter || false,
      };

      // Milestone badges
      statuses.first_dream = {
        key: 'first_dream',
        earned: (publicDreams || 0) >= 1,
        progress: publicDreams || 0,
        target: 1,
      };
      statuses.night_owl = {
        key: 'night_owl',
        earned: (publicDreams || 0) >= 10,
        progress: publicDreams || 0,
        target: 10,
      };
      statuses.prolific_dreamer = {
        key: 'prolific_dreamer',
        earned: (publicDreams || 0) >= 50,
        progress: publicDreams || 0,
        target: 50,
      };
      statuses.dream_century = {
        key: 'dream_century',
        earned: (publicDreams || 0) >= 100,
        progress: publicDreams || 0,
        target: 100,
      };
      statuses.consistent_dreamer = {
        key: 'consistent_dreamer',
        earned: streak >= 7,
        progress: streak,
        target: 7,
      };
      statuses.dream_journaler = {
        key: 'dream_journaler',
        earned: streak >= 30,
        progress: streak,
        target: 30,
      };

      // Engagement badges
      statuses.friendly_dreamer = {
        key: 'friendly_dreamer',
        earned: (followingCount || 0) >= 10,
        progress: followingCount || 0,
        target: 10,
      };
      statuses.social_butterfly = {
        key: 'social_butterfly',
        earned: (followingCount || 0) >= 50,
        progress: followingCount || 0,
        target: 50,
      };
      statuses.helpful_soul = {
        key: 'helpful_soul',
        earned: (interpretationsGiven || 0) >= 10,
        progress: interpretationsGiven || 0,
        target: 10,
      };
      statuses.beloved_dreamer = {
        key: 'beloved_dreamer',
        earned: reactionsReceived >= 50,
        progress: reactionsReceived,
        target: 50,
      };
      statuses.conversation_starter = {
        key: 'conversation_starter',
        earned: false, // TODO: Implement comments count
        progress: 0,
        target: 25,
      };

      setBadgeStatuses(statuses);
    } catch (error) {
      console.error('Error fetching badge statuses:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBadgesByCategory = (category: string) => {
    return Object.values(BADGES).filter((badge) => badge.category === category);
  };

  const renderBadgeCard = (badgeKey: BadgeKey) => {
    const badge = BADGES[badgeKey];
    const status = badgeStatuses[badgeKey];
    if (!badge) return null;

    const isEarned = status?.earned || false;
    const progress = status?.progress || 0;
    const target = status?.target || 0;
    const progressPercent = target > 0 ? Math.min((progress / target) * 100, 100) : 0;

    return (
      <View
        key={badgeKey}
        style={[
          styles.badgeCard,
          isEarned && styles.badgeCardEarned,
          isEarned && { borderColor: badge.color + '40' },
        ]}
      >
        <View
          style={[
            styles.badgeIconWrap,
            { backgroundColor: isEarned ? badge.color + '20' : theme.glass },
          ]}
        >
          <Ionicons
            name={badge.icon as any}
            size={24}
            color={isEarned ? badge.color : theme.textMuted}
          />
        </View>

        <View style={styles.badgeInfo}>
          <Text style={[styles.badgeLabel, isEarned && { color: badge.color }]}>
            {badge.label}
          </Text>
          <Text style={styles.badgeDescription}>{badge.description}</Text>

          {!isEarned && target > 0 && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progressPercent}%`, backgroundColor: badge.color },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {progress}/{target}
              </Text>
            </View>
          )}
        </View>

        {isEarned && (
          <View style={[styles.earnedBadge, { backgroundColor: badge.color }]}>
            <Ionicons name="checkmark" size={12} color="#fff" />
          </View>
        )}
      </View>
    );
  };

  const earnedCount = Object.values(badgeStatuses).filter((s) => s.earned).length;
  const totalCount = Object.keys(BADGES).length;

  if (loading) {
    return (
      <LinearGradient colors={AMBIENT_GRADIENTS[0]} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
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
          <Text style={styles.headerTitle}>Badges</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryIconWrap}>
              <Ionicons name="ribbon" size={28} color={theme.gold} />
            </View>
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryCount}>
                {earnedCount} of {totalCount}
              </Text>
              <Text style={styles.summaryLabel}>Badges Earned</Text>
            </View>
            <View style={styles.summaryProgress}>
              <View style={styles.summaryProgressBar}>
                <View
                  style={[
                    styles.summaryProgressFill,
                    { width: `${(earnedCount / totalCount) * 100}%` },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* Status Badges */}
          <Text style={styles.sectionTitle}>{BADGE_CATEGORIES.status.label}</Text>
          <Text style={styles.sectionDescription}>{BADGE_CATEGORIES.status.description}</Text>
          {getBadgesByCategory('status').map((badge) => renderBadgeCard(badge.key as BadgeKey))}

          {/* Milestone Badges */}
          <Text style={styles.sectionTitle}>{BADGE_CATEGORIES.milestone.label}</Text>
          <Text style={styles.sectionDescription}>{BADGE_CATEGORIES.milestone.description}</Text>
          {getBadgesByCategory('milestone').map((badge) => renderBadgeCard(badge.key as BadgeKey))}

          {/* Engagement Badges */}
          <Text style={styles.sectionTitle}>{BADGE_CATEGORIES.engagement.label}</Text>
          <Text style={styles.sectionDescription}>{BADGE_CATEGORIES.engagement.description}</Text>
          {getBadgesByCategory('engagement').map((badge) => renderBadgeCard(badge.key as BadgeKey))}
        </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.glowGold,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.gold + '30',
  },
  summaryIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.gold + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  summaryInfo: {
    flex: 1,
  },
  summaryCount: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.gold,
  },
  summaryLabel: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  summaryProgress: {
    width: 60,
  },
  summaryProgressBar: {
    height: 6,
    backgroundColor: theme.glass,
    borderRadius: 3,
    overflow: 'hidden',
  },
  summaryProgressFill: {
    height: '100%',
    backgroundColor: theme.gold,
    borderRadius: 3,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 4,
    marginTop: 8,
  },
  sectionDescription: {
    fontSize: 13,
    color: theme.textMuted,
    marginBottom: 14,
  },

  badgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.glass,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  badgeCardEarned: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  badgeIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  badgeInfo: {
    flex: 1,
  },
  badgeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  badgeDescription: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 2,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: theme.glassBorder,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    color: theme.textMuted,
    minWidth: 36,
    textAlign: 'right',
  },
  earnedBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
