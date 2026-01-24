import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  Pressable,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const { width } = Dimensions.get('window');

const theme = {
  background: '#050a15',
  glass: 'rgba(255, 255, 255, 0.06)',
  glassMedium: 'rgba(255, 255, 255, 0.08)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  glassBorderLight: 'rgba(255, 255, 255, 0.15)',
  primary: '#60a5fa',
  primaryDark: '#3b82f6',
  gold: '#d4af37',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textSubtle: '#64748b',
  textMuted: '#475569',
  danger: '#ef4444',
  success: '#10b981',
  purple: '#a78bfa',
};

// Ambient gradients
const AMBIENT_GRADIENTS: readonly [string, string, string][] = [
  ['#050a15', '#0a1628', '#0f172a'],
  ['#0a0f1a', '#121a2e', '#1a2744'],
  ['#0d0a15', '#1a1428', '#261e3d'],
  ['#0a1210', '#122420', '#1a3530'],
  ['#100a0a', '#201414', '#301e1e'],
  ['#0a0d14', '#141e2d', '#1e2e45'],
];

const GRADIENT_INTERVAL = 14000;

// Animated Background
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

interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface DreamStats {
  totalDreams: number;
  publicDreams: number;
  streak: number;
}

export default function ProfileScreen({ navigation }: any) {
  const user = useAuthStore((state) => state.user);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<DreamStats>({ totalDreams: 0, publicDreams: 0, streak: 0 });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Photo picker modal
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);

  // Edit username modal
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);

  // Settings modal
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchStats();
  }, [user?.id]);

  const fetchProfile = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setProfile(data);
      } else {
        // Create profile if doesn't exist
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({ id: user.id, username: null, avatar_url: null })
          .select()
          .single();

        if (createError) throw createError;
        setProfile(newProfile);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!user?.id) return;

    try {
      const { data: dreams, error } = await supabase
        .from('dreams')
        .select('dream_date, is_public')
        .eq('user_id', user.id);

      if (error) throw error;

      const totalDreams = dreams?.length || 0;
      const publicDreams = dreams?.filter((d) => d.is_public).length || 0;

      // Calculate streak
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

      setStats({ totalDreams, publicDreams, streak });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const getAvatarUrl = () => {
    if (profile?.avatar_url) {
      return profile.avatar_url;
    }
    const name = profile?.username || user?.email || 'Dreamer';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=60a5fa&size=200`;
  };

  const getDisplayName = () => {
    return profile?.username ? `@${profile.username}` : 'Anonymous Dreamer';
  };

  const takePhoto = async () => {
    setShowPhotoPicker(false);

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to take photos.');
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
      Alert.alert('Permission Required', 'Photo library access is needed to select photos.');
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

    try {
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Create form data for upload
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: fileName,
        type: `image/${fileExt}`,
      } as any);

      // Upload to storage
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, formData, {
        contentType: `image/${fileExt}`,
        upsert: true,
      });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);

      // Add cache buster to force refresh
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Update profile
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id);

      if (updateError) throw updateError;

      setProfile((prev) => (prev ? { ...prev, avatar_url: avatarUrl } : null));
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Error', error.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    if (!user?.id) return;

    setShowPhotoPicker(false);

    try {
      setUploading(true);

      // Update profile to remove avatar
      const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);

      if (error) throw error;

      setProfile((prev) => (prev ? { ...prev, avatar_url: null } : null));
    } catch (error: any) {
      Alert.alert('Error', 'Failed to remove photo');
    } finally {
      setUploading(false);
    }
  };

  const validateUsername = (username: string): string | null => {
    if (!username.trim()) return 'Username cannot be empty';
    if (username.length < 3) return 'Username must be at least 3 characters';
    if (username.length > 20) return 'Username must be 20 characters or less';
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Only letters, numbers, and underscores allowed';
    return null;
  };

  const checkUsernameAvailable = async (username: string): Promise<boolean> => {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.toLowerCase())
      .neq('id', user?.id || '')
      .single();

    return !data; // Available if no data found
  };

  const saveUsername = async () => {
    const validationError = validateUsername(newUsername);
    if (validationError) {
      setUsernameError(validationError);
      return;
    }

    setSavingUsername(true);
    setUsernameError('');

    try {
      // Check if username is taken
      const isAvailable = await checkUsernameAvailable(newUsername);

      if (!isAvailable) {
        setUsernameError('This username is already taken');
        setSavingUsername(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ username: newUsername.toLowerCase() })
        .eq('id', user?.id);

      if (updateError) throw updateError;

      setProfile((prev) => (prev ? { ...prev, username: newUsername.toLowerCase() } : null));
      setShowUsernameModal(false);
      setNewUsername('');
    } catch (error: any) {
      console.error('Save username error:', error);
      setUsernameError(error.message || 'Failed to save username');
    } finally {
      setSavingUsername(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  const memberSince = () => {
    const date = new Date(user?.created_at || profile?.created_at || '');
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Stats Card Component
  const StatCard = ({ icon, value, label, color }: { icon: string; value: string | number; label: string; color: string }) => (
    <View style={[styles.statCard, { borderColor: color + '30' }]}>
      <View style={[styles.statIconWrap, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  // Settings Row Component
  const SettingsRow = ({
    icon,
    label,
    value,
    onPress,
    showArrow = true,
    danger = false,
  }: {
    icon: string;
    label: string;
    value?: string;
    onPress?: () => void;
    showArrow?: boolean;
    danger?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.settingsRow}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={[styles.settingsIconWrap, danger && { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
        <Ionicons name={icon as any} size={18} color={danger ? theme.danger : theme.textSecondary} />
      </View>
      <View style={styles.settingsTextWrap}>
        <Text style={[styles.settingsLabel, danger && { color: theme.danger }]}>{label}</Text>
        {value && <Text style={styles.settingsValue}>{value}</Text>}
      </View>
      {showArrow && onPress && <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />}
    </TouchableOpacity>
  );

  // Photo Picker Modal - Glassmorphism style
  const PhotoPickerModal = () => (
    <Modal visible={showPhotoPicker} transparent animationType="fade" onRequestClose={() => setShowPhotoPicker(false)}>
      <Pressable style={styles.photoPickerOverlay} onPress={() => setShowPhotoPicker(false)}>
        <Pressable style={styles.photoPickerContainer} onPress={(e) => e.stopPropagation()}>
          <BlurView intensity={40} tint="dark" style={styles.photoPickerBlur}>
            <View style={styles.photoPickerContent}>
              <View style={styles.photoPickerHandle} />

              <Text style={styles.photoPickerTitle}>Profile Photo</Text>
              <Text style={styles.photoPickerSubtitle}>Choose how you want to add your photo</Text>

              <View style={styles.photoPickerOptions}>
                <TouchableOpacity style={styles.photoPickerOption} onPress={takePhoto} activeOpacity={0.7}>
                  <View style={[styles.photoPickerIconWrap, { backgroundColor: theme.primary + '20' }]}>
                    <Ionicons name="camera" size={26} color={theme.primary} />
                  </View>
                  <Text style={styles.photoPickerOptionLabel}>Take Photo</Text>
                  <Text style={styles.photoPickerOptionDesc}>Use your camera</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.photoPickerOption} onPress={pickImage} activeOpacity={0.7}>
                  <View style={[styles.photoPickerIconWrap, { backgroundColor: theme.purple + '20' }]}>
                    <Ionicons name="images" size={26} color={theme.purple} />
                  </View>
                  <Text style={styles.photoPickerOptionLabel}>Choose Photo</Text>
                  <Text style={styles.photoPickerOptionDesc}>From your library</Text>
                </TouchableOpacity>
              </View>

              {profile?.avatar_url && (
                <TouchableOpacity style={styles.photoPickerRemoveBtn} onPress={removeAvatar} activeOpacity={0.7}>
                  <Ionicons name="trash-outline" size={18} color={theme.danger} />
                  <Text style={styles.photoPickerRemoveText}>Remove Current Photo</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.photoPickerCancelBtn} onPress={() => setShowPhotoPicker(false)} activeOpacity={0.7}>
                <Text style={styles.photoPickerCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // Username Edit Modal
  const UsernameModal = () => (
    <Modal visible={showUsernameModal} transparent animationType="fade" onRequestClose={() => setShowUsernameModal(false)}>
      <Pressable style={styles.modalOverlay} onPress={() => setShowUsernameModal(false)}>
        <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
          <BlurView intensity={40} tint="dark" style={styles.modalBlur}>
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />

              <Text style={styles.modalTitle}>Choose Your Username</Text>
              <Text style={styles.modalSubtitle}>This is how others will see you. You can change it anytime as long as it's not taken.</Text>

              <View style={styles.usernameInputWrap}>
                <Text style={styles.usernamePrefix}>@</Text>
                <TextInput
                  style={styles.usernameInput}
                  placeholder="username"
                  placeholderTextColor={theme.textMuted}
                  value={newUsername}
                  onChangeText={(text) => {
                    setNewUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                    setUsernameError('');
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                  autoFocus
                />
              </View>

              {usernameError ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={14} color={theme.danger} />
                  <Text style={styles.usernameError}>{usernameError}</Text>
                </View>
              ) : (
                <Text style={styles.usernameHint}>3-20 characters • Letters, numbers, underscores only</Text>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => {
                    setShowUsernameModal(false);
                    setNewUsername('');
                    setUsernameError('');
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveBtn, (!newUsername.trim() || savingUsername) && styles.modalSaveBtnDisabled]}
                  onPress={saveUsername}
                  disabled={!newUsername.trim() || savingUsername}
                >
                  {savingUsername ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalSaveText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // Settings Modal
  const SettingsModal = () => (
    <Modal visible={showSettings} transparent animationType="slide" onRequestClose={() => setShowSettings(false)}>
      <View style={styles.settingsModalOverlay}>
        <SafeAreaView style={styles.settingsModalWrap}>
          <LinearGradient colors={AMBIENT_GRADIENTS[0]} style={styles.settingsModalBg}>
            {/* Header */}
            <View style={styles.settingsHeader}>
              <TouchableOpacity onPress={() => setShowSettings(false)} style={styles.settingsCloseBtn}>
                <Ionicons name="chevron-down" size={28} color={theme.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.settingsTitle}>Settings</Text>
              <View style={{ width: 44 }} />
            </View>

            <ScrollView style={styles.settingsScroll} contentContainerStyle={styles.settingsScrollContent} showsVerticalScrollIndicator={false}>
              {/* Account Section */}
              <Text style={styles.settingsSectionTitle}>Account</Text>
              <View style={styles.settingsCard}>
                <SettingsRow
                  icon="person-outline"
                  label="Username"
                  value={profile?.username ? `@${profile.username}` : 'Not set'}
                  onPress={() => {
                    setShowSettings(false);
                    setTimeout(() => {
                      setNewUsername(profile?.username || '');
                      setShowUsernameModal(true);
                    }, 300);
                  }}
                />
                <View style={styles.settingsDivider} />
                <SettingsRow icon="mail-outline" label="Email" value={user?.email || ''} showArrow={false} />
              </View>

              {/* Preferences Section */}
              <Text style={styles.settingsSectionTitle}>Preferences</Text>
              <View style={styles.settingsCard}>
                <SettingsRow
                  icon="eye-outline"
                  label="Default Dream Visibility"
                  value="Private"
                  onPress={() => Alert.alert('Coming Soon', 'This setting will be available soon.')}
                />
                <View style={styles.settingsDivider} />
                <SettingsRow
                  icon="notifications-outline"
                  label="Notifications"
                  value="On"
                  onPress={() => Alert.alert('Coming Soon', 'Notification settings coming soon.')}
                />
              </View>

              {/* Privacy Section */}
              <Text style={styles.settingsSectionTitle}>Privacy</Text>
              <View style={styles.settingsCard}>
                <SettingsRow
                  icon="shield-checkmark-outline"
                  label="Profile Visibility"
                  value="Community"
                  onPress={() => Alert.alert('Coming Soon', 'Privacy settings coming soon.')}
                />
              </View>

              {/* Support Section */}
              <Text style={styles.settingsSectionTitle}>Support</Text>
              <View style={styles.settingsCard}>
                <SettingsRow icon="help-circle-outline" label="Help & FAQ" onPress={() => Alert.alert('Help', 'Support documentation coming soon.')} />
                <View style={styles.settingsDivider} />
                <SettingsRow
                  icon="document-text-outline"
                  label="Terms of Service"
                  onPress={() => Alert.alert('Terms', 'Terms of Service will open in browser.')}
                />
                <View style={styles.settingsDivider} />
                <SettingsRow
                  icon="lock-closed-outline"
                  label="Privacy Policy"
                  onPress={() => Alert.alert('Privacy', 'Privacy Policy will open in browser.')}
                />
              </View>

              {/* Danger Zone */}
              <Text style={styles.settingsSectionTitle}>Danger Zone</Text>
              <View style={styles.settingsCard}>
                <SettingsRow
                  icon="trash-outline"
                  label="Delete Account"
                  danger
                  onPress={() => {
                    Alert.alert(
                      'Delete Account',
                      'This will permanently delete your account and all your dreams. This action cannot be undone.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => Alert.alert('Contact Support', 'Please contact support to delete your account.'),
                        },
                      ]
                    );
                  }}
                />
              </View>

              {/* App Info */}
              <View style={styles.appInfo}>
                <Text style={styles.appName}>Àlá</Text>
                <Text style={styles.appVersion}>Version 1.0.0 (MVP)</Text>
                <Text style={styles.appTagline}>Dream. Share. Discover.</Text>
              </View>
            </ScrollView>
          </LinearGradient>
        </SafeAreaView>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <AnimatedGradientBackground>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        </SafeAreaView>
      </AnimatedGradientBackground>
    );
  }

  return (
    <AnimatedGradientBackground>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.headerBtn}>
            <Ionicons name="settings-outline" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile Section */}
          <View style={styles.profileSection}>
            {/* Avatar */}
            <TouchableOpacity onPress={() => setShowPhotoPicker(true)} activeOpacity={0.8} style={styles.avatarContainer}>
              <View style={styles.avatarGlow}>
                {uploading ? (
                  <View style={[styles.avatar, styles.avatarLoading]}>
                    <ActivityIndicator size="large" color={theme.primary} />
                  </View>
                ) : (
                  <Image source={{ uri: getAvatarUrl() }} style={styles.avatar} />
                )}
              </View>
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>

            {/* Username */}
            <TouchableOpacity
              onPress={() => {
                setNewUsername(profile?.username || '');
                setShowUsernameModal(true);
              }}
              style={styles.usernameContainer}
            >
              <Text style={styles.displayName}>{getDisplayName()}</Text>
              <View style={styles.editIconWrap}>
                <Ionicons name="pencil" size={12} color={theme.textMuted} />
              </View>
            </TouchableOpacity>

            <Text style={styles.memberSince}>Dreaming since {memberSince()}</Text>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <StatCard icon="book" value={stats.totalDreams} label="Dreams" color={theme.primary} />
            <StatCard icon="flame" value={`${stats.streak}d`} label="Streak" color={theme.gold} />
            <StatCard icon="globe" value={stats.publicDreams} label="Shared" color={theme.purple} />
          </View>

          {/* Coming Soon */}
          <Text style={styles.sectionTitle}>Coming Soon</Text>
          <View style={styles.comingSoonCard}>
            <View style={styles.comingSoonRow}>
              <Text style={styles.comingSoonIcon}>🌙</Text>
              <View style={styles.comingSoonText}>
                <Text style={styles.comingSoonTitle}>Dream Circles</Text>
                <Text style={styles.comingSoonDesc}>Share dreams with close friends</Text>
              </View>
            </View>
          </View>

          <View style={styles.comingSoonCard}>
            <View style={styles.comingSoonRow}>
              <Text style={styles.comingSoonIcon}>✨</Text>
              <View style={styles.comingSoonText}>
                <Text style={styles.comingSoonTitle}>AI Dream Analysis</Text>
                <Text style={styles.comingSoonDesc}>Discover patterns in your dreams</Text>
              </View>
            </View>
          </View>

          <View style={styles.comingSoonCard}>
            <View style={styles.comingSoonRow}>
              <Text style={styles.comingSoonIcon}>🔮</Text>
              <View style={styles.comingSoonText}>
                <Text style={styles.comingSoonTitle}>Lucid Training</Text>
                <Text style={styles.comingSoonDesc}>Learn to control your dreams</Text>
              </View>
            </View>
          </View>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={theme.danger} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      <PhotoPickerModal />
      <UsernameModal />
      <SettingsModal />
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

  // Profile Section
  profileSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarGlow: {
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
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
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.background,
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  editIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.glass,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  memberSince: {
    fontSize: 13,
    color: theme.textSubtle,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.glass,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: theme.textSubtle,
    marginTop: 2,
  },

  // Section Title
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },

  // Coming Soon
  comingSoonCard: {
    backgroundColor: theme.glass,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  comingSoonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  comingSoonIcon: {
    fontSize: 28,
    marginRight: 14,
    width: 36,
    textAlign: 'center',
  },
  comingSoonText: {
    flex: 1,
  },
  comingSoonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  comingSoonDesc: {
    fontSize: 13,
    color: theme.textSecondary,
  },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.danger,
  },

  // Photo Picker Modal
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
    backgroundColor: 'rgba(15, 20, 35, 0.85)',
    padding: 20,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: theme.glassBorder,
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
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  photoPickerSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  photoPickerOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  photoPickerOption: {
    flex: 1,
    backgroundColor: theme.glass,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  photoPickerIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoPickerOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  photoPickerOptionDesc: {
    fontSize: 12,
    color: theme.textMuted,
  },
  photoPickerRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    marginBottom: 12,
  },
  photoPickerRemoveText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.danger,
  },
  photoPickerCancelBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: theme.glass,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  photoPickerCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
  },

  // Username Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  modalBlur: {
    overflow: 'hidden',
    borderRadius: 24,
  },
  modalContent: {
    backgroundColor: 'rgba(15, 20, 35, 0.85)',
    padding: 24,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    borderRadius: 24,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.glassBorderLight,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  usernameInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.glass,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    paddingHorizontal: 16,
  },
  usernamePrefix: {
    fontSize: 18,
    color: theme.textMuted,
    marginRight: 2,
  },
  usernameInput: {
    flex: 1,
    fontSize: 18,
    color: theme.textPrimary,
    paddingVertical: 14,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    marginLeft: 4,
  },
  usernameError: {
    fontSize: 13,
    color: theme.danger,
  },
  usernameHint: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 10,
    marginLeft: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: theme.glass,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: theme.primary,
    alignItems: 'center',
  },
  modalSaveBtnDisabled: {
    backgroundColor: theme.glass,
  },
  modalSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  // Settings Modal
  settingsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  settingsModalWrap: {
    flex: 1,
    marginTop: 40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  settingsModalBg: {
    flex: 1,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.glassBorder,
  },
  settingsCloseBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  settingsScroll: {
    flex: 1,
  },
  settingsScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  settingsSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 16,
    marginLeft: 4,
  },
  settingsCard: {
    backgroundColor: theme.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  settingsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.glassMedium,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsTextWrap: {
    flex: 1,
  },
  settingsLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.textPrimary,
  },
  settingsValue: {
    fontSize: 13,
    color: theme.textMuted,
    marginTop: 2,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: theme.glassBorder,
    marginLeft: 62,
  },

  // App Info
  appInfo: {
    alignItems: 'center',
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.glassBorder,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.gold,
    textShadowColor: 'rgba(212, 175, 55, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  appVersion: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 4,
  },
  appTagline: {
    fontSize: 13,
    color: theme.textSubtle,
    marginTop: 8,
    fontStyle: 'italic',
  },
});