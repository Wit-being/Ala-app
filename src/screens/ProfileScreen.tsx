import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../store/authStore';
import { useAlert } from '../hooks/useAlert';
import { profileService } from '../services/profileService';
import { theme, AMBIENT_GRADIENTS } from '../constants/theme';
import { BADGES } from '../constants/badges';
import { UserProfile, DreamStats } from '../types/profile';

export default function ProfileScreen({ navigation }: any) {
  const user = useAuthStore((state) => state.user);
  const { showAlert } = useAlert();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<DreamStats>({ totalDreams: 0, publicDreams: 0, streak: 0 });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        fetchData();
      }
    }, [user?.id])
  );

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);
    
    try {
      let profileData = await profileService.getProfile(user.id);
      
      if (!profileData) {
        profileData = await profileService.createProfile(user.id, user.email || undefined);
      }
      
      setProfile(profileData);
      
      const statsData = await profileService.getDreamStats(user.id);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const takePhoto = async () => {
    setShowPhotoPicker(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert({
        title: 'Permission Required',
        message: 'Camera access is needed to take photos.',
        type: 'warning',
      });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      uploadAvatar(result.assets[0].uri);
    }
  };

  const pickImage = async () => {
    setShowPhotoPicker(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert({
        title: 'Permission Required',
        message: 'Photo library access is needed to select photos.',
        type: 'warning',
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      uploadAvatar(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri: string) => {
    if (!user?.id) return;
    setUploading(true);
    
    const result = await profileService.uploadAvatar(user.id, uri);
    
    if (result.success && result.url) {
      setProfile((prev) => (prev ? { ...prev, avatar_url: result.url! } : null));
    } else {
      showAlert({
        title: 'Upload Failed',
        message: result.error || 'Failed to upload photo.',
        type: 'error',
      });
    }
    
    setUploading(false);
  };

  const removeAvatar = async () => {
    if (!user?.id) return;
    setShowPhotoPicker(false);
    setUploading(true);
    
    const result = await profileService.removeAvatar(user.id);
    
    if (result.success) {
      setProfile((prev) => (prev ? { ...prev, avatar_url: null } : null));
    } else {
      showAlert({
        title: 'Error',
        message: 'Failed to remove photo.',
        type: 'error',
      });
    }
    
    setUploading(false);
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

  const getMemberText = () => {
    const date = new Date(user?.created_at || profile?.created_at || '');
    const formattedDate = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return hasBadge() ? `Dreaming since ${formattedDate}` : `Joined ${formattedDate}`;
  };

  const renderBadge = (badgeKey: string) => {
    const badge = BADGES[badgeKey as keyof typeof BADGES];
    if (!badge) return null;

    return (
      <View
        key={badgeKey}
        style={[styles.badge, { backgroundColor: badge.color + '20', borderColor: badge.color + '40' }]}
      >
        <Ionicons name={badge.icon as any} size={14} color={badge.color} />
        <Text style={[styles.badgeLabel, { color: badge.color }]}>{badge.label}</Text>
      </View>
    );
  };

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

  const userBadges = getUserBadges();
  const avatarUrl = profileService.getAvatarUrl(profile, user?.email || undefined);
  const displayName = profileService.getDisplayName(profile);

  return (
    <LinearGradient colors={AMBIENT_GRADIENTS[0]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.headerBtn}>
            <Ionicons name="settings-outline" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.profileSection}>
            <TouchableOpacity
              onPress={() => setShowPhotoPicker(true)}
              activeOpacity={0.8}
              style={styles.avatarContainer}
            >
              <View style={[styles.avatarGlow, hasBadge() && { shadowColor: theme.gold }]}>
                {uploading ? (
                  <View style={[styles.avatar, styles.avatarLoading]}>
                    <ActivityIndicator size="large" color={theme.primary} />
                  </View>
                ) : (
                  <Image
                    source={{ uri: avatarUrl }}
                    style={[styles.avatar, hasBadge() && { borderColor: theme.gold }]}
                  />
                )}
              </View>
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>

            <Text style={styles.displayName}>{displayName}</Text>

            {profile?.username && profile?.display_name && (
              <Text style={styles.username}>@{profile.username}</Text>
            )}

            {userBadges.length > 0 && (
              <View style={styles.badgesRow}>
                {userBadges.map((badge) => renderBadge(badge))}
              </View>
            )}

            <Text style={styles.memberSince}>{getMemberText()}</Text>

            {profile?.account_number && profile.account_number <= 50 && (
              <Text style={styles.accountNumber}>Dreamer #{profile.account_number}</Text>
            )}

            {profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.totalDreams}</Text>
              <Text style={styles.statLabel}>Dreams</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: theme.gold }]}>{stats.streak}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.publicDreams}</Text>
              <Text style={styles.statLabel}>Shared</Text>
            </View>
          </View>

          {profile?.is_verified_interpreter && (
            <View style={styles.interpreterCard}>
              <View style={styles.interpreterHeader}>
                <Ionicons name="eye" size={20} color={theme.purple} />
                <Text style={styles.interpreterTitle}>Interpreter</Text>
              </View>
              <View style={styles.interpreterStats}>
                <View style={styles.interpreterStat}>
                  <Text style={styles.interpreterValue}>{profile.total_interpretations}</Text>
                  <Text style={styles.interpreterLabel}>Interpretations</Text>
                </View>
                <View style={styles.interpreterDivider} />
                <View style={styles.interpreterStat}>
                  <Text style={styles.interpreterValue}>
                    {profile.interpreter_rating?.toFixed(1) || '0.0'}
                  </Text>
                  <Text style={styles.interpreterLabel}>Rating</Text>
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <View style={styles.actionIconWrap}>
              <Ionicons name="create-outline" size={22} color={theme.primary} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Edit Profile</Text>
              <Text style={styles.actionSubtitle}>Update your name, bio, and username</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={showPhotoPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoPicker(false)}
      >
        <Pressable style={styles.photoPickerOverlay} onPress={() => setShowPhotoPicker(false)}>
          <Pressable style={styles.photoPickerContainer} onPress={(e) => e.stopPropagation()}>
            <BlurView intensity={40} tint="dark" style={styles.photoPickerBlur}>
              <View style={styles.photoPickerContent}>
                <View style={styles.photoPickerHandle} />
                <Text style={styles.photoPickerTitle}>Profile Photo</Text>

                <TouchableOpacity style={styles.photoPickerOption} onPress={takePhoto}>
                  <View style={[styles.photoPickerIconWrap, { backgroundColor: theme.primary + '20' }]}>
                    <Ionicons name="camera" size={24} color={theme.primary} />
                  </View>
                  <Text style={styles.photoPickerOptionLabel}>Take Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.photoPickerOption} onPress={pickImage}>
                  <View style={[styles.photoPickerIconWrap, { backgroundColor: theme.purple + '20' }]}>
                    <Ionicons name="images" size={24} color={theme.purple} />
                  </View>
                  <Text style={styles.photoPickerOptionLabel}>Choose from Library</Text>
                </TouchableOpacity>

                {profile?.avatar_url && (
                  <TouchableOpacity style={styles.photoPickerOption} onPress={removeAvatar}>
                    <View style={[styles.photoPickerIconWrap, { backgroundColor: theme.danger + '15' }]}>
                      <Ionicons name="trash-outline" size={24} color={theme.danger} />
                    </View>
                    <Text style={[styles.photoPickerOptionLabel, { color: theme.danger }]}>
                      Remove Photo
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.photoPickerCancelBtn}
                  onPress={() => setShowPhotoPicker(false)}
                >
                  <Text style={styles.photoPickerCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

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

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  profileSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarGlow: {
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: theme.glassBorderLight,
  },
  avatarLoading: {
    backgroundColor: theme.glass,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.background,
  },

  displayName: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  username: {
    fontSize: 15,
    color: theme.textSecondary,
    marginBottom: 12,
  },
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  memberSince: {
    fontSize: 13,
    color: theme.textSubtle,
  },
  accountNumber: {
    fontSize: 12,
    color: theme.gold,
    marginTop: 4,
    fontWeight: '600',
  },
  bio: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
    paddingHorizontal: 20,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.glass,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: theme.textSubtle,
    marginTop: 4,
  },

  interpreterCard: {
    backgroundColor: theme.glass,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.purple + '30',
  },
  interpreterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  interpreterTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.purple,
  },
  interpreterStats: {
    flexDirection: 'row',
  },
  interpreterStat: {
    flex: 1,
    alignItems: 'center',
  },
  interpreterValue: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  interpreterLabel: {
    fontSize: 12,
    color: theme.textSubtle,
    marginTop: 4,
  },
  interpreterDivider: {
    width: 1,
    backgroundColor: theme.glassBorder,
    marginHorizontal: 16,
  },

  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.glass,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  actionSubtitle: {
    fontSize: 13,
    color: theme.textMuted,
    marginTop: 2,
  },

  photoPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  photoPickerContainer: {
    marginHorizontal: 12,
    marginBottom: 34,
    borderRadius: 24,
    overflow: 'hidden',
  },
  photoPickerBlur: {
    overflow: 'hidden',
    borderRadius: 24,
  },
  photoPickerContent: {
    backgroundColor: 'rgba(15, 20, 35, 0.95)',
    padding: 20,
    paddingTop: 12,
    borderRadius: 24,
  },
  photoPickerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.glassBorderLight,
    alignSelf: 'center',
    marginBottom: 16,
  },
  photoPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  photoPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.glassBorder,
  },
  photoPickerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  photoPickerOptionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.textPrimary,
  },
  photoPickerCancelBtn: {
    paddingVertical: 16,
    marginTop: 8,
    alignItems: 'center',
  },
  photoPickerCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textSecondary,
  },
});