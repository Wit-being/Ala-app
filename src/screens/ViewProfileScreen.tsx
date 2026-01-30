import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useSocialStore } from '../store/socialStore';
import { socialService } from '../services/socialService';
import { useAlert } from '../hooks/useAlert';
import { theme } from '../constants/theme';
import { BADGES } from '../constants/badges';
import {
  AnimatedGradientBackground,
  LoadingSpinner,
  EmptyState,
  UserAvatar,
} from '../components/common';
import { UserProfile, PublicDream } from '../types/profile';
import { UserRelationshipStatus } from '../types/social';

export default function ViewProfileScreen({ navigation, route }: any) {
  const { userId } = route.params;
  const currentUser = useAuthStore((state) => state.user);
  const { blockUser } = useSocialStore();
  const { showAlert } = useAlert();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [publicDreams, setPublicDreams] = useState<PublicDream[]>([]);
  const [loading, setLoading] = useState(true);
  const [relationship, setRelationship] = useState<UserRelationshipStatus>({
    isFollowing: false,
    isFollowedBy: false,
    isBlocked: false,
    isBlockedBy: false,
    isMuted: false,
  });
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const contentOpacity = useRef(new Animated.Value(0)).current;
  const isOwnProfile = currentUser?.id === userId;

  useFocusEffect(
    useCallback(() => {
      if (userId) fetchProfileData();
    }, [userId])
  );

  useEffect(() => {
    if (!loading && profile) {
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, profile]);

  const fetchProfileData = async () => {
    setLoading(true);
    contentOpacity.setValue(0);

    try {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(profileData);

      if (currentUser?.id && !isOwnProfile) {
        const relationshipStatus = await socialService.getRelationshipStatus(
          currentUser.id,
          userId
        );
        setRelationship(relationshipStatus);
      }

      const [followers, following] = await Promise.all([
        socialService.getFollowerCount(userId),
        socialService.getFollowingCount(userId),
      ]);
      setFollowerCount(followers);
      setFollowingCount(following);

      if (profileData?.is_public) {
        const { data: dreams } = await supabase
          .from('dreams')
          .select('id, title, content, dream_date, created_at')
          .eq('user_id', userId)
          .eq('is_public', true)
          .order('dream_date', { ascending: false })
          .limit(10);
        setPublicDreams(dreams || []);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      showAlert({
        title: 'Error',
        message: 'Could not load this profile.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!currentUser?.id || actionLoading) return;
    setActionLoading(true);
    try {
      if (relationship.isFollowing) {
        const result = await socialService.unfollowUser(currentUser.id, userId);
        if (result.success) {
          setRelationship((prev) => ({ ...prev, isFollowing: false }));
          setFollowerCount((prev) => Math.max(0, prev - 1));
        }
      } else {
        const result = await socialService.followUser(currentUser.id, userId);
        if (result.success) {
          setRelationship((prev) => ({ ...prev, isFollowing: true }));
          setFollowerCount((prev) => prev + 1);
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
      setActionLoading(false);
    }
  };

  const handleBlock = () => {
    setShowMenu(false);
    const displayName =
      profile?.display_name || profile?.username || 'this user';
    showAlert({
      title: 'Block User',
      message: `${displayName} won't be able to see your profile or dreams.`,
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            if (!currentUser?.id) return;
            setActionLoading(true);
            const success = await blockUser(currentUser.id, userId);
            setActionLoading(false);
            if (success) {
              setRelationship((prev) => ({
                ...prev,
                isBlocked: true,
                isFollowing: false,
              }));
              showAlert({
                title: 'User Blocked',
                message: `You have blocked ${displayName}.`,
                type: 'success',
              });
            }
          },
        },
      ],
    });
  };

  const handleMute = async () => {
    setShowMenu(false);
    if (!currentUser?.id) return;
    setActionLoading(true);
    try {
      if (relationship.isMuted) {
        const result = await socialService.unmuteUser(currentUser.id, userId);
        if (result.success)
          setRelationship((prev) => ({ ...prev, isMuted: false }));
      } else {
        const result = await socialService.muteUser(currentUser.id, userId);
        if (result.success) {
          setRelationship((prev) => ({ ...prev, isMuted: true }));
          showAlert({
            title: 'User Muted',
            message: "You won't see their dreams in your feed.",
            type: 'info',
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
      setActionLoading(false);
    }
  };

  const getDisplayName = () =>
    profile?.display_name ||
    (profile?.username ? `@${profile.username}` : 'Anonymous Dreamer');

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

  const getPrimaryBadge = () => {
    if (profile?.is_founding_dreamer) return BADGES.founding_dreamer;
    if (profile?.is_verified_interpreter) return BADGES.verified_interpreter;
    if (profile?.is_verified) return BADGES.verified;
    return null;
  };

  const primaryBadge = getPrimaryBadge();

  const Header = () => (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.headerBtn}
      >
        <BlurView intensity={20} tint="dark" style={styles.headerBtnBlur}>
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </BlurView>
      </TouchableOpacity>
      {profile?.username && (
        <Text style={styles.headerUsername}>@{profile.username}</Text>
      )}
      {!isOwnProfile && profile ? (
        <TouchableOpacity
          onPress={() => setShowMenu(true)}
          style={styles.headerBtn}
        >
          <BlurView intensity={20} tint="dark" style={styles.headerBtnBlur}>
            <Ionicons
              name="ellipsis-horizontal"
              size={22}
              color={theme.textPrimary}
            />
          </BlurView>
        </TouchableOpacity>
      ) : (
        <View style={{ width: 44 }} />
      )}
    </View>
  );

  if (relationship.isBlockedBy) {
    return (
      <AnimatedGradientBackground>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <Header />
          <EmptyState
            variant="locked"
            title="Profile Unavailable"
            subtitle="This profile is not available to you."
          />
        </SafeAreaView>
      </AnimatedGradientBackground>
    );
  }

  if (loading) {
    return (
      <AnimatedGradientBackground>
        <SafeAreaView style={styles.safeArea}>
          <LoadingSpinner variant="moon" text="Loading profile..." />
        </SafeAreaView>
      </AnimatedGradientBackground>
    );
  }

  if (!profile) {
    return (
      <AnimatedGradientBackground>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <Header />
          <EmptyState
            icon="person-outline"
            title="User Not Found"
            subtitle="This dreamer doesn't exist or has been removed."
          />
        </SafeAreaView>
      </AnimatedGradientBackground>
    );
  }

  return (
    <AnimatedGradientBackground>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[styles.profileSection, { opacity: contentOpacity }]}
          >
            <UserAvatar
              uri={profile.avatar_url}
              name={profile.display_name || profile.username || 'User'}
              size="xl"
              isFoundingDreamer={profile.is_founding_dreamer}
              isVerified={profile.is_verified}
              isVerifiedInterpreter={profile.is_verified_interpreter}
            />

            <Text style={styles.displayName}>{getDisplayName()}</Text>

            {primaryBadge && (
              <View
                style={[
                  styles.primaryBadge,
                  { backgroundColor: primaryBadge.color + '15' },
                ]}
              >
                <Ionicons
                  name={primaryBadge.icon as any}
                  size={14}
                  color={primaryBadge.color}
                />
                <Text
                  style={[styles.primaryBadgeText, { color: primaryBadge.color }]}
                >
                  {primaryBadge.label}
                </Text>
              </View>
            )}

            {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

            <View style={styles.statsRow}>
              <TouchableOpacity
                style={styles.stat}
                onPress={() =>
                  navigation.push('UserList', {
                    userId,
                    type: 'followers',
                    username: profile.username,
                  })
                }
              >
                <Text style={styles.statValue}>{followerCount}</Text>
                <Text style={styles.statLabel}> Followers</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.stat}
                onPress={() =>
                  navigation.push('UserList', {
                    userId,
                    type: 'following',
                    username: profile.username,
                  })
                }
              >
                <Text style={styles.statValue}>{followingCount}</Text>
                <Text style={styles.statLabel}> Following</Text>
              </TouchableOpacity>
            </View>

            {!isOwnProfile && !relationship.isBlocked && (
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[
                    styles.followBtn,
                    relationship.isFollowing && styles.followingBtn,
                  ]}
                  onPress={handleFollow}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <LoadingSpinner
                      size="small"
                      color={
                        relationship.isFollowing ? theme.textPrimary : '#fff'
                      }
                    />
                  ) : (
                    <>
                      <Ionicons
                        name={relationship.isFollowing ? 'checkmark' : 'person-add'}
                        size={18}
                        color={
                          relationship.isFollowing ? theme.textPrimary : '#fff'
                        }
                      />
                      <Text
                        style={[
                          styles.followBtnText,
                          relationship.isFollowing && styles.followingBtnText,
                        ]}
                      >
                        {relationship.isFollowing ? 'Following' : 'Follow'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                {relationship.isFollowedBy && !relationship.isFollowing && (
                  <View style={styles.followsYouBadge}>
                    <Text style={styles.followsYouText}>Follows you</Text>
                  </View>
                )}
              </View>
            )}

            {relationship.isBlocked && (
              <View style={styles.blockedBanner}>
                <Ionicons name="ban" size={16} color={theme.danger} />
                <Text style={styles.blockedBannerText}>
                  You have blocked this user
                </Text>
              </View>
            )}

            {relationship.isMuted && !relationship.isBlocked && (
              <View style={styles.mutedBanner}>
                <Ionicons name="volume-mute" size={14} color={theme.textMuted} />
                <Text style={styles.mutedBannerText}>Muted</Text>
              </View>
            )}
          </Animated.View>

          {profile.is_public &&
            publicDreams.length > 0 &&
            !relationship.isBlocked && (
              <Animated.View
                style={[styles.dreamsSection, { opacity: contentOpacity }]}
              >
                <View style={styles.sectionHeader}>
                  <Ionicons
                    name="moon-outline"
                    size={18}
                    color={theme.textSecondary}
                  />
                  <Text style={styles.sectionTitle}>Recent Dreams</Text>
                </View>
                {publicDreams.map((dream) => (
                  <TouchableOpacity
                    key={dream.id}
                    style={styles.dreamCard}
                    onPress={() =>
                      navigation.navigate('Main', { openDreamId: dream.id })
                    }
                  >
                    <View style={styles.dreamDate}>
                      <Text style={styles.dreamDateText}>
                        {formatDate(dream.dream_date)}
                      </Text>
                    </View>
                    <View style={styles.dreamContent}>
                      {dream.title && (
                        <Text style={styles.dreamTitle} numberOfLines={1}>
                          {dream.title}
                        </Text>
                      )}
                      {dream.content && (
                        <Text style={styles.dreamExcerpt} numberOfLines={2}>
                          {dream.content}
                        </Text>
                      )}
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={theme.textMuted}
                    />
                  </TouchableOpacity>
                ))}
              </Animated.View>
            )}

          {!profile.is_public && !isOwnProfile && (
            <EmptyState
              compact
              variant="locked"
              title="Private Profile"
              subtitle="This dreamer keeps their dreams private."
            />
          )}

          {profile.is_public &&
            publicDreams.length === 0 &&
            !relationship.isBlocked && (
              <EmptyState
                compact
                icon="moon-outline"
                title="No Dreams Yet"
                subtitle="This dreamer hasn't shared any dreams yet."
              />
            )}
        </ScrollView>
      </SafeAreaView>

      <ProfileMenuModal
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        profile={profile}
        relationship={relationship}
        onMute={handleMute}
        onBlock={handleBlock}
        onReport={() => {
          setShowMenu(false);
          showAlert({
            title: 'Report User',
            message: 'This feature is coming soon.',
            type: 'info',
          });
        }}
      />
    </AnimatedGradientBackground>
  );
}

const ProfileMenuModal = ({
  visible,
  onClose,
  profile,
  relationship,
  onMute,
  onBlock,
  onReport,
}: {
  visible: boolean;
  onClose: () => void;
  profile: UserProfile;
  relationship: UserRelationshipStatus;
  onMute: () => void;
  onBlock: () => void;
  onReport: () => void;
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.menuOverlay} onPress={onClose}>
        <Pressable
          style={styles.menuContainer}
          onPress={(e) => e.stopPropagation()}
        >
          <BlurView intensity={60} tint="dark" style={styles.menuBlur}>
            <View style={styles.menuContent}>
              <View style={styles.menuHandle} />

              <View style={styles.menuUserInfo}>
                <UserAvatar
                  uri={profile.avatar_url}
                  name={profile.display_name || profile.username || 'User'}
                  size="medium"
                  isFoundingDreamer={profile.is_founding_dreamer}
                  isVerified={profile.is_verified}
                  isVerifiedInterpreter={profile.is_verified_interpreter}
                />
                <View>
                  <Text style={styles.menuUserName}>
                    {profile.display_name || profile.username || 'User'}
                  </Text>
                  {profile.username && (
                    <Text style={styles.menuUserHandle}>
                      @{profile.username}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.menuDivider} />

              {relationship.isFollowing && (
                <TouchableOpacity style={styles.menuOption} onPress={onMute}>
                  <View
                    style={[
                      styles.menuIconWrap,
                      relationship.isMuted && {
                        backgroundColor: theme.primary + '20',
                      },
                    ]}
                  >
                    <Ionicons
                      name={relationship.isMuted ? 'volume-high' : 'volume-mute'}
                      size={20}
                      color={
                        relationship.isMuted ? theme.primary : theme.textSecondary
                      }
                    />
                  </View>
                  <View style={styles.menuOptionContent}>
                    <Text style={styles.menuOptionText}>
                      {relationship.isMuted ? 'Unmute' : 'Mute'}
                    </Text>
                    <Text style={styles.menuOptionSubtext}>
                      {relationship.isMuted
                        ? 'See their dreams in your feed again'
                        : "Hide their dreams from your feed"}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.menuOption} onPress={onBlock}>
                <View
                  style={[
                    styles.menuIconWrap,
                    { backgroundColor: theme.danger + '15' },
                  ]}
                >
                  <Ionicons name="ban" size={20} color={theme.danger} />
                </View>
                <View style={styles.menuOptionContent}>
                  <Text style={[styles.menuOptionText, { color: theme.danger }]}>
                    Block
                  </Text>
                  <Text style={styles.menuOptionSubtext}>
                    They won't see your profile or dreams
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuOption} onPress={onReport}>
                <View style={styles.menuIconWrap}>
                  <Ionicons
                    name="flag-outline"
                    size={20}
                    color={theme.textSecondary}
                  />
                </View>
                <View style={styles.menuOptionContent}>
                  <Text style={styles.menuOptionText}>Report</Text>
                  <Text style={styles.menuOptionSubtext}>
                    Report inappropriate behavior
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuCancelBtn} onPress={onClose}>
                <Text style={styles.menuCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
    borderRadius: 22,
    overflow: 'hidden',
  },
  headerBtnBlur: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerUsername: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  content: {
    paddingBottom: 40,
  },

  // Profile Section
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  displayName: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    marginTop: 16,
  },

  // Primary Badge
  primaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
  },
  primaryBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },

  bio: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 12,
    paddingHorizontal: 16,
  },

  // Stats - Twitter style
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  statLabel: {
    fontSize: 15,
    color: theme.textSecondary,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 28,
    backgroundColor: theme.primary,
    borderRadius: 24,
    minWidth: 130,
  },
  followingBtn: {
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  followBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  followingBtnText: {
    color: theme.textPrimary,
  },
  followsYouBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: theme.glass,
    borderRadius: 12,
  },
  followsYouText: {
    fontSize: 12,
    color: theme.textMuted,
    fontWeight: '500',
  },

  // Banners
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: theme.danger + '15',
    borderRadius: 14,
    marginTop: 16,
  },
  blockedBannerText: {
    fontSize: 14,
    color: theme.danger,
    fontWeight: '500',
  },
  mutedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: theme.glass,
    borderRadius: 12,
    marginTop: 12,
  },
  mutedBannerText: {
    fontSize: 13,
    color: theme.textMuted,
  },

  // Dreams Section
  dreamsSection: {
    marginTop: 8,
    marginHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  dreamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.glass,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  dreamDate: {
    width: 50,
    alignItems: 'center',
    marginRight: 14,
  },
  dreamDateText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.primary,
    textAlign: 'center',
  },
  dreamContent: {
    flex: 1,
  },
  dreamTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  dreamExcerpt: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
  },

  // Menu Modal
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    marginHorizontal: 10,
    marginBottom: 34,
    borderRadius: 28,
    overflow: 'hidden',
  },
  menuBlur: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  menuContent: {
    backgroundColor: 'rgba(20,25,40,0.92)',
    borderRadius: 28,
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 6,
  },
  menuHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  menuUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 16,
    gap: 14,
  },
  menuUserName: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  menuUserHandle: {
    fontSize: 14,
    color: theme.textMuted,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 18,
    marginBottom: 8,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    marginHorizontal: 6,
    marginBottom: 4,
  },
  menuIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.glass,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuOptionContent: {
    flex: 1,
  },
  menuOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.textPrimary,
  },
  menuOptionSubtext: {
    fontSize: 13,
    color: theme.textMuted,
    marginTop: 2,
  },
  menuCancelBtn: {
    paddingVertical: 16,
    marginTop: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 18,
  },
  menuCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textSecondary,
  },
});