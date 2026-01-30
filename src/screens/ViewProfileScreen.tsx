import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  Modal,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useSocialStore } from '../store/socialStore';
import { socialService } from '../services/socialService';
import { useAlert } from '../hooks/useAlert';
import { theme, AMBIENT_GRADIENTS, GRADIENT_INTERVAL } from '../constants/theme';
import { BADGES } from '../constants/badges';
import { UserProfile, PublicDream } from '../types/profile';
import { UserRelationshipStatus } from '../types/social';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AnimatedGradientBackground = ({ children }: { children: React.ReactNode }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      const next = (currentIndex + 1) % AMBIENT_GRADIENTS.length;
      setNextIndex(next);
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 2000,
        useNativeDriver: true,
      }).start(() => {
        setCurrentIndex(next);
        fadeAnim.setValue(1);
      });
    }, GRADIENT_INTERVAL);
    return () => clearInterval(interval);
  }, [currentIndex]);

  return (
    <View style={styles.gradientContainer}>
      <LinearGradient
        colors={AMBIENT_GRADIENTS[nextIndex]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={AMBIENT_GRADIENTS[currentIndex]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>
      {children}
    </View>
  );
};

export default function ViewProfileScreen({ navigation, route }: any) {
  const { userId } = route.params;
  const currentUser = useAuthStore((state) => state.user);
  const { isUserBlocked, blockUser } = useSocialStore();
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

  // Animations
  const scrollY = useRef(new Animated.Value(0)).current;
  const avatarScale = useRef(new Animated.Value(0.8)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  const isOwnProfile = currentUser?.id === userId;

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        fetchProfileData();
      }
    }, [userId])
  );

  useEffect(() => {
    if (!loading && profile) {
      Animated.parallel([
        Animated.spring(avatarScale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading, profile]);

  const fetchProfileData = async () => {
    setLoading(true);
    avatarScale.setValue(0.8);
    contentOpacity.setValue(0);

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
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

      if (profileData?.is_public && !relationship.isBlockedBy) {
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
        message: 'Something went wrong. Please try again.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlock = () => {
    setShowMenu(false);
    const displayName = profile?.display_name || profile?.username || 'this user';

    showAlert({
      title: 'Block User',
      message: `${displayName} won't be able to see your profile or dreams, and you won't see theirs. They won't be notified.`,
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
            } else {
              showAlert({
                title: 'Error',
                message: 'Failed to block user.',
                type: 'error',
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
        if (result.success) {
          setRelationship((prev) => ({ ...prev, isMuted: false }));
        }
      } else {
        const result = await socialService.muteUser(currentUser.id, userId);
        if (result.success) {
          setRelationship((prev) => ({ ...prev, isMuted: true }));
          showAlert({
            title: 'User Muted',
            message: "You won't see their dreams in your feed, but you'll still follow them.",
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

  const handleReport = () => {
    setShowMenu(false);
    showAlert({
      title: 'Report User',
      message: 'This feature is coming soon. For urgent issues, please contact support.',
      type: 'info',
    });
  };

  const getAvatarUrl = () => {
    if (profile?.avatar_url) return profile.avatar_url;
    const name = profile?.display_name || profile?.username || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=60a5fa&size=200`;
  };

  const getDisplayName = () => {
    if (profile?.display_name) return profile.display_name;
    if (profile?.username) return `@${profile.username}`;
    return 'Anonymous Dreamer';
  };

  const hasBadge = () => {
    return profile?.is_founding_dreamer || profile?.is_verified_interpreter || profile?.is_verified;
  };

  const getUserBadges = () => {
    const badges: string[] = [];
    if (profile?.is_founding_dreamer) badges.push('founding_dreamer');
    if (profile?.is_verified_interpreter) badges.push('verified_interpreter');
    if (profile?.is_verified) badges.push('verified');
    return badges;
  };

  const renderBadge = (badgeKey: string) => {
    const badge = BADGES[badgeKey];
    if (!badge) return null;

    return (
      <View
        key={badgeKey}
        style={[styles.badge, { backgroundColor: badge.color + '15', borderColor: badge.color + '30' }]}
      >
        <Ionicons name={badge.icon as any} size={12} color={badge.color} />
        <Text style={[styles.badgeLabel, { color: badge.color }]}>{badge.label}</Text>
      </View>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Blocked by this user state
  if (relationship.isBlockedBy) {
    return (
      <AnimatedGradientBackground>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
              <BlurView intensity={20} tint="dark" style={styles.headerBtnBlur}>
                <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
              </BlurView>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profile</Text>
            <View style={styles.headerBtnPlaceholder} />
          </View>
          <View style={styles.blockedContainer}>
            <View style={styles.blockedIconWrap}>
              <Ionicons name="lock-closed" size={40} color={theme.textMuted} />
            </View>
            <Text style={styles.blockedTitle}>Profile Unavailable</Text>
            <Text style={styles.blockedSubtitle}>This profile is not available to you.</Text>
          </View>
        </SafeAreaView>
      </AnimatedGradientBackground>
    );
  }

  // Loading state
  if (loading) {
    return (
      <AnimatedGradientBackground>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        </SafeAreaView>
      </AnimatedGradientBackground>
    );
  }

  // Not found state
  if (!profile) {
    return (
      <AnimatedGradientBackground>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
              <BlurView intensity={20} tint="dark" style={styles.headerBtnBlur}>
                <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
              </BlurView>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profile</Text>
            <View style={styles.headerBtnPlaceholder} />
          </View>
          <View style={styles.blockedContainer}>
            <View style={styles.blockedIconWrap}>
              <Ionicons name="person-outline" size={40} color={theme.textMuted} />
            </View>
            <Text style={styles.blockedTitle}>User Not Found</Text>
            <Text style={styles.blockedSubtitle}>This dreamer doesn't exist or has been removed.</Text>
          </View>
        </SafeAreaView>
      </AnimatedGradientBackground>
    );
  }

  const userBadges = getUserBadges();

  return (
    <AnimatedGradientBackground>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <BlurView intensity={20} tint="dark" style={styles.headerBtnBlur}>
              <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
            </BlurView>
          </TouchableOpacity>
          
          {profile.username && (
            <Text style={styles.headerUsername}>@{profile.username}</Text>
          )}
          
          {!isOwnProfile ? (
            <TouchableOpacity onPress={() => setShowMenu(true)} style={styles.headerBtn}>
              <BlurView intensity={20} tint="dark" style={styles.headerBtnBlur}>
                <Ionicons name="ellipsis-horizontal" size={22} color={theme.textPrimary} />
              </BlurView>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerBtnPlaceholder} />
          )}
        </View>

        <Animated.ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        >
          {/* Profile Card */}
          <View style={styles.profileCard}>
            {/* Avatar */}
            <Animated.View
              style={[
                styles.avatarContainer,
                { transform: [{ scale: avatarScale }] },
              ]}
            >
              <View style={[styles.avatarGlow, hasBadge() && styles.avatarGlowGold]}>
                <Image
                  source={{ uri: getAvatarUrl() }}
                  style={[styles.avatar, hasBadge() && styles.avatarGoldBorder]}
                />
              </View>
              {hasBadge() && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </View>
              )}
            </Animated.View>

            {/* Name & Username */}
            <Animated.View style={[styles.nameContainer, { opacity: contentOpacity }]}>
              <Text style={styles.displayName}>{getDisplayName()}</Text>
              
              {profile.username && profile.display_name && (
                <Text style={styles.username}>@{profile.username}</Text>
              )}
            </Animated.View>

            {/* Badges */}
            {userBadges.length > 0 && (
              <Animated.View style={[styles.badgesRow, { opacity: contentOpacity }]}>
                {userBadges.map((badge) => renderBadge(badge))}
              </Animated.View>
            )}

            {/* Bio */}
            {profile.bio && (
              <Animated.Text style={[styles.bio, { opacity: contentOpacity }]}>
                {profile.bio}
              </Animated.Text>
            )}

            {/* Stats */}
            <Animated.View style={[styles.statsContainer, { opacity: contentOpacity }]}>
              <TouchableOpacity
                style={styles.statItem}
                onPress={() =>
                  navigation.push('UserList', {
                    userId,
                    type: 'followers',
                    username: profile?.username,
                  })
                }
                activeOpacity={0.7}
              >
                <Text style={styles.statValue}>{followerCount}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </TouchableOpacity>

              <View style={styles.statDivider} />

              <TouchableOpacity
                style={styles.statItem}
                onPress={() =>
                  navigation.push('UserList', {
                    userId,
                    type: 'following',
                    username: profile?.username,
                  })
                }
                activeOpacity={0.7}
              >
                <Text style={styles.statValue}>{followingCount}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Action Buttons */}
            {!isOwnProfile && !relationship.isBlocked && (
              <Animated.View style={[styles.actionsContainer, { opacity: contentOpacity }]}>
                <TouchableOpacity
                  style={[styles.followBtn, relationship.isFollowing && styles.followingBtn]}
                  onPress={handleFollow}
                  disabled={actionLoading}
                  activeOpacity={0.8}
                >
                  {actionLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={relationship.isFollowing ? theme.textPrimary : '#fff'}
                    />
                  ) : (
                    <>
                      <Ionicons
                        name={relationship.isFollowing ? 'checkmark' : 'person-add'}
                        size={18}
                        color={relationship.isFollowing ? theme.textPrimary : '#fff'}
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
              </Animated.View>
            )}

            {/* Blocked Banner */}
            {relationship.isBlocked && (
              <View style={styles.blockedBanner}>
                <Ionicons name="ban" size={16} color={theme.danger} />
                <Text style={styles.blockedBannerText}>You have blocked this user</Text>
              </View>
            )}

            {/* Muted indicator */}
            {relationship.isMuted && !relationship.isBlocked && (
              <View style={styles.mutedBanner}>
                <Ionicons name="volume-mute" size={14} color={theme.textMuted} />
                <Text style={styles.mutedBannerText}>Muted</Text>
              </View>
            )}
          </View>

          {/* Dreams Section */}
          {profile.is_public && publicDreams.length > 0 && !relationship.isBlocked && (
            <Animated.View style={[styles.dreamsSection, { opacity: contentOpacity }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="moon-outline" size={18} color={theme.textSecondary} />
                <Text style={styles.sectionTitle}>Recent Dreams</Text>
              </View>

              {publicDreams.map((dream, index) => (
                <TouchableOpacity
                  key={dream.id}
                  style={[
                    styles.dreamCard,
                    index === publicDreams.length - 1 && styles.dreamCardLast,
                  ]}
                  onPress={() => navigation.navigate('DreamDetail', { dreamId: dream.id })}
                  activeOpacity={0.7}
                >
                  <View style={styles.dreamDateWrap}>
                    <Text style={styles.dreamDate}>{formatDate(dream.dream_date)}</Text>
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
                  <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                </TouchableOpacity>
              ))}
            </Animated.View>
          )}

          {/* Private Profile Notice */}
          {!profile.is_public && !isOwnProfile && (
            <View style={styles.privateNotice}>
              <View style={styles.privateIconWrap}>
                <Ionicons name="lock-closed" size={28} color={theme.textMuted} />
              </View>
              <Text style={styles.privateTitle}>Private Profile</Text>
              <Text style={styles.privateSubtitle}>
                This dreamer keeps their dreams private.
              </Text>
            </View>
          )}

          {/* No Dreams Notice */}
          {profile.is_public && publicDreams.length === 0 && !relationship.isBlocked && (
            <View style={styles.privateNotice}>
              <View style={styles.privateIconWrap}>
                <Ionicons name="moon-outline" size={28} color={theme.textMuted} />
              </View>
              <Text style={styles.privateTitle}>No Dreams Yet</Text>
              <Text style={styles.privateSubtitle}>
                This dreamer hasn't shared any dreams yet.
              </Text>
            </View>
          )}
        </Animated.ScrollView>
      </SafeAreaView>

      {/* More Options Menu */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <Pressable style={styles.menuContainer} onPress={(e) => e.stopPropagation()}>
            <BlurView intensity={60} tint="dark" style={styles.menuBlur}>
              <View style={styles.menuContent}>
                <View style={styles.menuHandle} />

                {/* User info in menu */}
                <View style={styles.menuUserInfo}>
                  <Image source={{ uri: getAvatarUrl() }} style={styles.menuAvatar} />
                  <View>
                    <Text style={styles.menuUserName}>{getDisplayName()}</Text>
                    {profile.username && (
                      <Text style={styles.menuUserHandle}>@{profile.username}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.menuDivider} />

                {relationship.isFollowing && (
                  <TouchableOpacity style={styles.menuOption} onPress={handleMute}>
                    <View
                      style={[
                        styles.menuIconWrap,
                        relationship.isMuted && { backgroundColor: theme.primary + '20' },
                      ]}
                    >
                      <Ionicons
                        name={relationship.isMuted ? 'volume-high' : 'volume-mute'}
                        size={20}
                        color={relationship.isMuted ? theme.primary : theme.textSecondary}
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

                <TouchableOpacity style={styles.menuOption} onPress={handleBlock}>
                  <View style={[styles.menuIconWrap, { backgroundColor: theme.danger + '15' }]}>
                    <Ionicons name="ban" size={20} color={theme.danger} />
                  </View>
                  <View style={styles.menuOptionContent}>
                    <Text style={[styles.menuOptionText, { color: theme.danger }]}>Block</Text>
                    <Text style={styles.menuOptionSubtext}>
                      They won't see your profile or dreams
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuOption} onPress={handleReport}>
                  <View style={styles.menuIconWrap}>
                    <Ionicons name="flag-outline" size={20} color={theme.textSecondary} />
                  </View>
                  <View style={styles.menuOptionContent}>
                    <Text style={styles.menuOptionText}>Report</Text>
                    <Text style={styles.menuOptionSubtext}>Report inappropriate behavior</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuCancelBtn} onPress={() => setShowMenu(false)}>
                  <Text style={styles.menuCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </Pressable>
        </Pressable>
      </Modal>
    </AnimatedGradientBackground>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    color: theme.textMuted,
  },

  // Header
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
  headerBtnPlaceholder: {
    width: 44,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  headerUsername: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
  },

  content: {
    paddingBottom: 40,
  },

  // Profile Card
  profileCard: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },

  avatarContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  avatarGlow: {
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  avatarGlowGold: {
    shadowColor: theme.gold,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  avatarGoldBorder: {
    borderColor: theme.gold,
    borderWidth: 3,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.gold,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.background,
    shadowColor: theme.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },

  nameContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  displayName: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.textPrimary,
    letterSpacing: -0.5,
  },
  username: {
    fontSize: 15,
    color: theme.textSecondary,
    marginTop: 4,
  },

  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 5,
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: '600',
  },

  bio: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 16,
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  statLabel: {
    fontSize: 13,
    color: theme.textMuted,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Actions
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    backgroundColor: theme.primary,
    borderRadius: 28,
    minWidth: 140,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  followingBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowOpacity: 0,
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
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    borderWidth: 1,
    borderColor: theme.danger + '25',
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
    backgroundColor: 'rgba(255,255,255,0.05)',
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  dreamCardLast: {
    marginBottom: 0,
  },
  dreamDateWrap: {
    width: 50,
    alignItems: 'center',
    marginRight: 14,
  },
  dreamDate: {
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

  // Private/Empty Notice
  privateNotice: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 40,
    marginTop: 16,
  },
  privateIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  privateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  privateSubtitle: {
    fontSize: 14,
    color: theme.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Blocked Container
  blockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  blockedIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  blockedTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  blockedSubtitle: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Menu Modal
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
    backgroundColor: 'rgba(20, 25, 40, 0.92)',
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
  menuAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    backgroundColor: 'rgba(255,255,255,0.08)',
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