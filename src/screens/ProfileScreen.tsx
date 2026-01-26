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
  KeyboardAvoidingView,
  Platform,
  Switch,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useFeedback } from '../providers/FeedbackProvider';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DISMISS_THRESHOLD = 120;

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

const AMBIENT_GRADIENTS: readonly [string, string, string][] = [
  ['#050a15', '#0a1628', '#0f172a'],
  ['#0a0f1a', '#121a2e', '#1a2744'],
  ['#0d0a15', '#1a1428', '#261e3d'],
  ['#0a1210', '#122420', '#1a3530'],
  ['#100a0a', '#201414', '#301e1e'],
  ['#0a0d14', '#141e2d', '#1e2e45'],
];

const GRADIENT_INTERVAL = 14000;

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
      <LinearGradient colors={AMBIENT_GRADIENTS[nextIndex]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
        <LinearGradient colors={AMBIENT_GRADIENTS[currentIndex]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      </Animated.View>
      {children}
    </View>
  );
};

interface Profile {
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
  username_changed_at: string | null;
  account_number: number | null;
  created_at: string;
}

interface DreamStats {
  totalDreams: number;
  publicDreams: number;
  streak: number;
}

export default function ProfileScreen({ navigation }: any) {
  const user = useAuthStore((state) => state.user);
  const { openFeedback } = useFeedback();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<DreamStats>({ totalDreams: 0, publicDreams: 0, streak: 0 });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBadgeInfo, setShowBadgeInfo] = useState<string | null>(null);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  // Settings modal animation
  const settingsTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const settingsBackdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchProfile();
    fetchStats();
  }, [user?.id]);

  // Settings modal animation
  useEffect(() => {
    if (showSettings) {
      Animated.parallel([
        Animated.spring(settingsTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 25,
          stiffness: 200,
        }),
        Animated.timing(settingsBackdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showSettings]);

  const closeSettingsModal = () => {
    Animated.parallel([
      Animated.timing(settingsTranslateY, {
        toValue: SCREEN_HEIGHT,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(settingsBackdropOpacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowSettings(false);
    });
  };

  const settingsPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 15 && Math.abs(gestureState.dx) < Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          settingsTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > DISMISS_THRESHOLD || gestureState.vy > 0.5) {
          closeSettingsModal();
        } else {
          Animated.spring(settingsTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 25,
          }).start();
        }
      },
    })
  ).current;

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
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            username: null,
            display_name: user.email?.split('@')[0] || null,
            avatar_url: null,
            is_public: true,
          })
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

  const canChangeUsername = () => {
    if (!profile?.username) return true;
    if (!profile?.username_changed_at) return true;
    
    const lastChanged = new Date(profile.username_changed_at);
    const now = new Date();
    const daysSinceChange = Math.floor((now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24));
    
    return daysSinceChange >= 14;
  };

  const daysUntilUsernameChange = () => {
    if (!profile?.username_changed_at) return 0;
    
    const lastChanged = new Date(profile.username_changed_at);
    const now = new Date();
    const daysSinceChange = Math.floor((now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24));
    
    return Math.max(0, 14 - daysSinceChange);
  };

  const getAvatarUrl = () => {
    if (profile?.avatar_url) return profile.avatar_url;
    const name = profile?.display_name || profile?.username || user?.email || 'Dreamer';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=60a5fa&size=200`;
  };

  const getDisplayName = () => {
    if (profile?.username) return `@${profile.username}`;
    if (profile?.display_name) return profile.display_name;
    return 'Anonymous Dreamer';
  };

  const getMemberText = () => {
    const date = new Date(user?.created_at || profile?.created_at || '');
    const formattedDate = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    if (hasBadge()) {
      return `Conscious before ${formattedDate}`;
    }
    return `Dreaming since ${formattedDate}`;
  };

  const toggleProfileVisibility = async () => {
    if (!user?.id || !profile) return;
    
    setTogglingVisibility(true);
    try {
      const newVisibility = !profile.is_public;
      const { error } = await supabase
        .from('profiles')
        .update({ is_public: newVisibility })
        .eq('id', user.id);

      if (error) throw error;
      
      setProfile((prev) => prev ? { ...prev, is_public: newVisibility } : null);
    } catch (error: any) {
      console.error('Error toggling visibility:', error);
      Alert.alert('Error', 'Failed to update profile visibility');
    } finally {
      setTogglingVisibility(false);
    }
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
      const formData = new FormData();
      formData.append('file', { uri, name: fileName, type: `image/${fileExt}` } as any);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, formData, { contentType: `image/${fileExt}`, upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);

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
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);

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
    return !data;
  };

  const saveUsername = async () => {
    if (!canChangeUsername()) {
      const days = daysUntilUsernameChange();
      setUsernameError(`You can change your username in ${days} day${days !== 1 ? 's' : ''}`);
      return;
    }

    const validationError = validateUsername(newUsername);
    if (validationError) {
      setUsernameError(validationError);
      return;
    }

    setSavingUsername(true);
    setUsernameError('');

    try {
      const isAvailable = await checkUsernameAvailable(newUsername);
      if (!isAvailable) {
        setUsernameError('This username is already taken');
        setSavingUsername(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          username: newUsername.toLowerCase(),
          username_changed_at: new Date().toISOString()
        })
        .eq('id', user?.id);

      if (updateError) throw updateError;

      setProfile((prev) => (prev ? { 
        ...prev, 
        username: newUsername.toLowerCase(),
        username_changed_at: new Date().toISOString()
      } : null));
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
        onPress: async () => await supabase.auth.signOut(),
      },
    ]);
  };

  const openUsernameModal = () => {
    if (!canChangeUsername()) {
      const days = daysUntilUsernameChange();
      Alert.alert(
        'Username Locked',
        `You can change your username again in ${days} day${days !== 1 ? 's' : ''}.`,
        [{ text: 'OK' }]
      );
      return;
    }
    setNewUsername(profile?.username || '');
    setUsernameError('');
    setShowUsernameModal(true);
  };

  const closeUsernameModal = () => {
    setShowUsernameModal(false);
    setNewUsername('');
    setUsernameError('');
  };

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
      <AnimatedGradientBackground>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
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
                  <Image source={{ uri: getAvatarUrl() }} style={[
                    styles.avatar,
                    hasBadge() && { borderColor: theme.gold }
                  ]} />
                )}
              </View>
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>

            {userBadges.length > 0 && (
              <View style={styles.badgesRow}>
                {userBadges.map((badge) => renderBadge(badge, 'large'))}
              </View>
            )}

            <TouchableOpacity onPress={openUsernameModal} style={styles.usernameContainer}>
              <Text style={styles.displayName}>{getDisplayName()}</Text>
              <View style={styles.editIconWrap}>
                <Ionicons name="pencil" size={12} color={theme.textMuted} />
              </View>
            </TouchableOpacity>

            <Text style={[styles.memberSince, hasBadge() && { color: theme.gold }]}>
              {getMemberText()}
            </Text>
            
            {profile?.account_number && profile.account_number <= 50 && (
              <Text style={styles.accountNumber}>Dreamer #{profile.account_number}</Text>
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderColor: theme.primary + '30' }]}>
              <View style={[styles.statIconWrap, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="book" size={18} color={theme.primary} />
              </View>
              <Text style={styles.statValue}>{stats.totalDreams}</Text>
              <Text style={styles.statLabel}>Dreams</Text>
            </View>
            <View style={[styles.statCard, { borderColor: theme.gold + '30' }]}>
              <View style={[styles.statIconWrap, { backgroundColor: theme.gold + '20' }]}>
                <Ionicons name="flame" size={18} color={theme.gold} />
              </View>
              <Text style={styles.statValue}>{stats.streak}d</Text>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
            <View style={[styles.statCard, { borderColor: theme.purple + '30' }]}>
              <View style={[styles.statIconWrap, { backgroundColor: theme.purple + '20' }]}>
                <Ionicons name="globe" size={18} color={theme.purple} />
              </View>
              <Text style={styles.statValue}>{stats.publicDreams}</Text>
              <Text style={styles.statLabel}>Shared</Text>
            </View>
          </View>

          {profile?.is_verified_interpreter && (
            <>
              <Text style={styles.sectionTitle}>Interpreter Stats</Text>
              <View style={styles.interpreterCard}>
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
            </>
          )}

          {/* Coming Soon */}
          <Text style={styles.sectionTitle}>Coming Soon</Text>
          {[
            { icon: '🌙', title: 'Dream Circles', desc: 'Share dreams with close friends' },
            { icon: '✨', title: 'AI Dream Analysis', desc: 'Discover patterns in your dreams' },
            { icon: '🔮', title: 'Lucid Training', desc: 'Learn to control your dreams' },
          ].map((item, index) => (
            <View key={index} style={styles.comingSoonCard}>
              <View style={styles.comingSoonRow}>
                <Text style={styles.comingSoonIcon}>{item.icon}</Text>
                <View style={styles.comingSoonText}>
                  <Text style={styles.comingSoonTitle}>{item.title}</Text>
                  <Text style={styles.comingSoonDesc}>{item.desc}</Text>
                </View>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={theme.danger} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      {/* Photo Picker Modal - Swipeable */}
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
                <TouchableOpacity
                  style={styles.photoPickerCancelBtn}
                  onPress={() => setShowPhotoPicker(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.photoPickerCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Username Modal */}
      <Modal
        visible={showUsernameModal}
        transparent
        animationType="fade"
        onRequestClose={closeUsernameModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalOverlay} onPress={closeUsernameModal}>
            <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContent}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>Choose Your Username</Text>
                <Text style={styles.modalSubtitle}>This is how others will see you.</Text>

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
                  <Text style={styles.usernameHint}>
                    3-20 characters • Letters, numbers, underscores
                    {profile?.username && '\n• Can be changed every 14 days'}
                  </Text>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={closeUsernameModal}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalSaveBtn,
                      (!newUsername.trim() || savingUsername) && styles.modalSaveBtnDisabled,
                    ]}
                    onPress={saveUsername}
                    disabled={!newUsername.trim() || savingUsername}
                  >
                    {savingUsername ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.modalSaveText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

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

      {/* Settings Modal - Swipeable */}
      <Modal
        visible={showSettings}
        transparent
        animationType="none"
        onRequestClose={closeSettingsModal}
      >
        <View style={styles.settingsModalOverlay}>
          <Animated.View 
            style={[styles.settingsBackdrop, { opacity: settingsBackdropOpacity }]}
          >
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeSettingsModal} />
          </Animated.View>

          <Animated.View 
            style={[
              styles.settingsModalWrap,
              { transform: [{ translateY: settingsTranslateY }] }
            ]}
          >
            {/* Swipe Handle Area */}
            <View {...settingsPanResponder.panHandlers} style={styles.settingsHandleArea}>
              <View style={styles.settingsHandle} />
            </View>

            <LinearGradient colors={AMBIENT_GRADIENTS[0]} style={styles.settingsModalBg}>
              <View style={styles.settingsHeader}>
                <View style={{ width: 44 }} />
                <Text style={styles.settingsTitle}>Settings</Text>
                <TouchableOpacity onPress={closeSettingsModal} style={styles.settingsCloseBtn}>
                  <Ionicons name="close" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.settingsScroll}
                contentContainerStyle={styles.settingsScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.settingsSectionTitle}>Account</Text>
                <View style={styles.settingsCard}>
                  <TouchableOpacity
                    style={styles.settingsRow}
                    onPress={() => {
                      closeSettingsModal();
                      setTimeout(openUsernameModal, 350);
                    }}
                  >
                    <View style={styles.settingsIconWrap}>
                      <Ionicons name="person-outline" size={18} color={theme.textSecondary} />
                    </View>
                    <View style={styles.settingsTextWrap}>
                      <Text style={styles.settingsLabel}>Username</Text>
                      <Text style={styles.settingsValue}>
                        {profile?.username ? `@${profile.username}` : 'Not set'}
                        {profile?.username && !canChangeUsername() && 
                          ` • Locked for ${daysUntilUsernameChange()}d`
                        }
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                  </TouchableOpacity>
                  <View style={styles.settingsDivider} />
                  <View style={styles.settingsRow}>
                    <View style={styles.settingsIconWrap}>
                      <Ionicons name="mail-outline" size={18} color={theme.textSecondary} />
                    </View>
                    <View style={styles.settingsTextWrap}>
                      <Text style={styles.settingsLabel}>Email</Text>
                      <Text style={styles.settingsValue}>{user?.email || ''}</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.settingsSectionTitle}>Privacy</Text>
                <View style={styles.settingsCard}>
                  <View style={styles.settingsRow}>
                    <View style={styles.settingsIconWrap}>
                      <Ionicons name="eye-outline" size={18} color={theme.textSecondary} />
                    </View>
                    <View style={styles.settingsTextWrap}>
                      <Text style={styles.settingsLabel}>Profile Visibility</Text>
                      <Text style={styles.settingsValue}>
                        {profile?.is_public ? 'Public' : 'Private'}
                      </Text>
                    </View>
                    {togglingVisibility ? (
                      <ActivityIndicator size="small" color={theme.primary} />
                    ) : (
                      <Switch
                        value={profile?.is_public || false}
                        onValueChange={toggleProfileVisibility}
                        trackColor={{ false: theme.glass, true: theme.primary + '60' }}
                        thumbColor={profile?.is_public ? theme.primary : theme.textMuted}
                      />
                    )}
                  </View>
                </View>

                {userBadges.length > 0 && (
                  <>
                    <Text style={styles.settingsSectionTitle}>Your Badges</Text>
                    <View style={styles.settingsCard}>
                      {userBadges.map((badgeKey, index) => {
                        const badge = BADGES[badgeKey as keyof typeof BADGES];
                        return (
                          <React.Fragment key={badgeKey}>
                            {index > 0 && <View style={styles.settingsDivider} />}
                            <TouchableOpacity
                              style={styles.settingsRow}
                              onPress={() => {
                                closeSettingsModal();
                                setTimeout(() => setShowBadgeInfo(badgeKey), 350);
                              }}
                            >
                              <View style={[styles.settingsIconWrap, { backgroundColor: badge.color + '20' }]}>
                                <Text style={{ fontSize: 18 }}>{badge.icon}</Text>
                              </View>
                              <View style={styles.settingsTextWrap}>
                                <Text style={[styles.settingsLabel, { color: badge.color }]}>
                                  {badge.label}
                                </Text>
                                <Text style={styles.settingsValue}>{badge.description}</Text>
                              </View>
                            </TouchableOpacity>
                          </React.Fragment>
                        );
                      })}
                    </View>
                  </>
                )}

                {/* Support Section with Feedback */}
                <Text style={styles.settingsSectionTitle}>Support</Text>
                <View style={styles.settingsCard}>
                  <TouchableOpacity
                    style={styles.settingsRow}
                    onPress={() => {
                      closeSettingsModal();
                      setTimeout(openFeedback, 350);
                    }}
                  >
                    <View style={[styles.settingsIconWrap, { backgroundColor: theme.gold + '20' }]}>
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.gold} />
                    </View>
                    <View style={styles.settingsTextWrap}>
                      <Text style={styles.settingsLabel}>Send Feedback</Text>
                      <Text style={styles.settingsValue}>Or shake your device anytime 📳</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.settingsSectionTitle}>Preferences</Text>
                <View style={styles.settingsCard}>
                  <TouchableOpacity
                    style={styles.settingsRow}
                    onPress={() => Alert.alert('Coming Soon', 'This setting will be available soon.')}
                  >
                    <View style={styles.settingsIconWrap}>
                      <Ionicons name="moon-outline" size={18} color={theme.textSecondary} />
                    </View>
                    <View style={styles.settingsTextWrap}>
                      <Text style={styles.settingsLabel}>Default Dream Visibility</Text>
                      <Text style={styles.settingsValue}>Private</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.appInfo}>
                  <Text style={styles.appName}>Àlá</Text>
                  <Text style={styles.appVersion}>Version 1.0.0</Text>
                  {profile?.account_number && (
                    <Text style={styles.accountNumberSmall}>Account #{profile.account_number}</Text>
                  )}
                </View>
              </ScrollView>
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>
    </AnimatedGradientBackground>
  );
}

const styles = StyleSheet.create({
  gradientContainer: { flex: 1 },
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
  headerTitle: { fontSize: 18, fontWeight: '600', color: theme.textPrimary },

  content: { padding: 20, paddingBottom: 40 },

  profileSection: { alignItems: 'center', marginBottom: 24 },
  avatarContainer: { position: 'relative', marginBottom: 16 },
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
  badgeSmall: { paddingHorizontal: 8, paddingVertical: 4 },
  badgeLarge: { paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  badgeIconSmall: { fontSize: 14 },
  badgeIconLarge: { fontSize: 16 },
  badgeLabel: { fontSize: 12, fontWeight: '600' },

  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  displayName: { fontSize: 22, fontWeight: '700', color: theme.textPrimary },
  editIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.glass,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  memberSince: { fontSize: 13, color: theme.textSubtle },
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
  statValue: { fontSize: 20, fontWeight: '700', color: theme.textPrimary },
  statLabel: { fontSize: 11, color: theme.textSubtle, marginTop: 2 },

  interpreterCard: {
    flexDirection: 'row',
    backgroundColor: theme.glass,
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: theme.purple + '30',
  },
  interpreterStat: { flex: 1, alignItems: 'center' },
  interpreterValue: { fontSize: 24, fontWeight: '700', color: theme.purple },
  interpreterLabel: { fontSize: 12, color: theme.textSubtle, marginTop: 4 },
  interpreterDivider: { width: 1, backgroundColor: theme.glassBorder, marginHorizontal: 16 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },

  comingSoonCard: {
    backgroundColor: theme.glass,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  comingSoonRow: { flexDirection: 'row', alignItems: 'center' },
  comingSoonIcon: { fontSize: 28, marginRight: 14, width: 36, textAlign: 'center' },
  comingSoonText: { flex: 1 },
  comingSoonTitle: { fontSize: 15, fontWeight: '600', color: theme.textPrimary, marginBottom: 2 },
  comingSoonDesc: { fontSize: 13, color: theme.textSecondary },

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
  logoutText: { fontSize: 15, fontWeight: '600', color: theme.danger },

  // Photo Picker
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
  photoPickerBlur: { overflow: 'hidden', borderRadius: 24 },
  photoPickerContent: {
    backgroundColor: 'rgba(15, 20, 35, 0.9)',
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
  photoPickerOptions: { flexDirection: 'row', gap: 12, marginBottom: 16 },
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
  photoPickerOptionDesc: { fontSize: 12, color: theme.textMuted },
  photoPickerRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    marginBottom: 12,
  },
  photoPickerRemoveText: { fontSize: 14, fontWeight: '600', color: theme.danger },
  photoPickerCancelBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: theme.glass,
    alignItems: 'center',
  },
  photoPickerCancelText: { fontSize: 15, fontWeight: '600', color: theme.textSecondary },

  // Username Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: { borderRadius: 24, overflow: 'hidden' },
  modalContent: {
    backgroundColor: 'rgba(15, 20, 35, 0.95)',
    padding: 24,
    paddingTop: 12,
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
  usernamePrefix: { fontSize: 18, color: theme.textMuted, marginRight: 2 },
  usernameInput: { flex: 1, fontSize: 18, color: theme.textPrimary, paddingVertical: 14 },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    marginLeft: 4,
  },
  usernameError: { fontSize: 13, color: theme.danger },
  usernameHint: { fontSize: 12, color: theme.textMuted, marginTop: 10, marginLeft: 4, lineHeight: 18 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: theme.glass,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: theme.textSecondary },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: theme.primary,
    alignItems: 'center',
  },
  modalSaveBtnDisabled: { backgroundColor: theme.glass },
  modalSaveText: { fontSize: 15, fontWeight: '600', color: '#fff' },

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
  badgeModalIcon: { fontSize: 48, marginBottom: 16 },
  badgeModalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
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
  badgeModalCloseText: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },

  // Settings Modal - Swipeable
  settingsModalOverlay: { flex: 1 },
  settingsBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  settingsModalWrap: {
    flex: 1,
    marginTop: 60,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  settingsHandleArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: 'transparent',
  },
  settingsHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  settingsModalBg: { flex: 1, paddingTop: 20 },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.glassBorder,
  },
  settingsCloseBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  settingsTitle: { fontSize: 18, fontWeight: '600', color: theme.textPrimary },
  settingsScroll: { flex: 1 },
  settingsScrollContent: { padding: 20, paddingBottom: 40 },
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
  settingsRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  settingsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.glassMedium,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsTextWrap: { flex: 1 },
  settingsLabel: { fontSize: 15, fontWeight: '500', color: theme.textPrimary },
  settingsValue: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  settingsDivider: { height: 1, backgroundColor: theme.glassBorder, marginLeft: 62 },
  appInfo: {
    alignItems: 'center',
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.glassBorder,
  },
  appName: { fontSize: 28, fontWeight: '700', color: theme.gold },
  appVersion: { fontSize: 12, color: theme.textMuted, marginTop: 4 },
  accountNumberSmall: { fontSize: 11, color: theme.textMuted, marginTop: 8 },
});