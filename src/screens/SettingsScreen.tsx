import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useSocialStore } from '../store/socialStore';
import { useFeedback } from '../providers/FeedbackProvider';
import { useAlert } from '../hooks/useAlert';
import { theme } from '../constants/theme';
import { BADGES } from '../constants/badges';
import { AnimatedGradientBackground, LoadingSpinner } from '../components/common';

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
  account_number: number | null;
}

export default function SettingsScreen({ navigation }: any) {
  const user = useAuthStore((state) => state.user);
  const { blockedUsers } = useSocialStore();
  const { openFeedback } = useFeedback();
  const { showAlert } = useAlert();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [user?.id]);

  const fetchProfile = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (error && error.code !== 'PGRST116') throw error;
      if (data) setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleProfileVisibility = async () => {
    if (!user?.id || !profile) return;
    setTogglingVisibility(true);
    try {
      const newVisibility = !profile.is_public;
      const { error } = await supabase.from('profiles').update({ is_public: newVisibility }).eq('id', user.id);
      if (error) throw error;
      setProfile((prev) => (prev ? { ...prev, is_public: newVisibility } : null));
    } catch (error: any) {
      showAlert({ title: 'Error', message: 'Failed to update profile visibility.', type: 'error' });
    } finally {
      setTogglingVisibility(false);
    }
  };

  const handleLogout = () => {
    showAlert({
      title: 'Log Out',
      message: 'Are you sure you want to log out?',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: async () => await supabase.auth.signOut() },
      ],
    });
  };

  const handleDeleteAccount = () => {
    showAlert({
      title: 'Delete Account',
      message: 'This action cannot be undone. All your dreams, data, and account information will be permanently deleted.',
      type: 'error',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            showAlert({ title: 'Coming Soon', message: 'Account deletion will be available in a future update.', type: 'info' });
          },
        },
      ],
    });
  };

  const getUserBadges = () => {
    const badges: string[] = [];
    if (profile?.is_founding_dreamer) badges.push('founding_dreamer');
    if (profile?.is_verified_interpreter) badges.push('verified_interpreter');
    if (profile?.is_verified) badges.push('verified');
    return badges;
  };

  const userBadges = getUserBadges();

  if (loading) {
    return (
      <AnimatedGradientBackground>
        <SafeAreaView style={styles.safeArea}>
          <LoadingSpinner variant="moon" text="Loading settings..." />
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
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.headerBtnPlaceholder} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Account Section */}
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('EditProfile')}>
              <View style={styles.rowIconWrap}>
                <Ionicons name="person-outline" size={20} color={theme.textSecondary} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>Edit Profile</Text>
                <Text style={styles.rowValue}>{profile?.username ? `@${profile.username}` : 'Set up your profile'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={styles.rowIconWrap}>
                <Ionicons name="mail-outline" size={20} color={theme.textSecondary} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>Email</Text>
                <Text style={styles.rowValue}>{user?.email || 'Not set'}</Text>
              </View>
            </View>
          </View>

          {/* Privacy & Safety Section */}
          <Text style={styles.sectionTitle}>Privacy & Safety</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowIconWrap}>
                <Ionicons name="eye-outline" size={20} color={theme.textSecondary} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>Public Profile</Text>
                <Text style={styles.rowValue}>
                  {profile?.is_public ? 'Anyone can see your profile' : 'Only you can see your profile'}
                </Text>
              </View>
              {togglingVisibility ? (
                <LoadingSpinner size="small" />
              ) : (
                <Switch
                  value={profile?.is_public || false}
                  onValueChange={toggleProfileVisibility}
                  trackColor={{ false: theme.glass, true: theme.primary + '60' }}
                  thumbColor={profile?.is_public ? theme.primary : theme.textMuted}
                />
              )}
            </View>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('BlockedUsers')}>
              <View style={styles.rowIconWrap}>
                <Ionicons name="ban-outline" size={20} color={theme.textSecondary} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>Blocked Users</Text>
                <Text style={styles.rowValue}>
                  {blockedUsers.length === 0 ? 'No blocked users' : `${blockedUsers.length} blocked`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Badges Section */}
          {userBadges.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Your Badges</Text>
              <View style={styles.card}>
                {userBadges.map((badgeKey, index) => {
                  const badge = BADGES[badgeKey];
                  if (!badge) return null;
                  return (
                    <React.Fragment key={badgeKey}>
                      {index > 0 && <View style={styles.divider} />}
                      <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('AllBadges')}>
                        <View style={[styles.rowIconWrap, { backgroundColor: badge.color + '20' }]}>
                          <Ionicons name={badge.icon as any} size={20} color={badge.color} />
                        </View>
                        <View style={styles.rowContent}>
                          <Text style={[styles.rowLabel, { color: badge.color }]}>{badge.label}</Text>
                          <Text style={styles.rowValue}>{badge.description}</Text>
                        </View>
                      </TouchableOpacity>
                    </React.Fragment>
                  );
                })}
              </View>
            </>
          )}

          <TouchableOpacity style={styles.allBadgesBtn} onPress={() => navigation.navigate('AllBadges')}>
            <Ionicons name="ribbon-outline" size={20} color={theme.primary} />
            <Text style={styles.allBadgesBtnText}>View All Badges</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </TouchableOpacity>

          {/* Support Section */}
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={openFeedback}>
              <View style={[styles.rowIconWrap, { backgroundColor: theme.gold + '20' }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={theme.gold} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>Send Feedback</Text>
                <Text style={styles.rowValue}>Or shake your device anytime</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://yourapp.com/help')}>
              <View style={styles.rowIconWrap}>
                <Ionicons name="help-circle-outline" size={20} color={theme.textSecondary} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>Help Center</Text>
                <Text style={styles.rowValue}>FAQs and support</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Legal Section */}
          <Text style={styles.sectionTitle}>Legal</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://yourapp.com/terms')}>
              <View style={styles.rowIconWrap}>
                <Ionicons name="document-text-outline" size={20} color={theme.textSecondary} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>Terms of Service</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://yourapp.com/privacy')}>
              <View style={styles.rowIconWrap}>
                <Ionicons name="shield-outline" size={20} color={theme.textSecondary} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>Privacy Policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Danger Zone */}
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={handleLogout}>
              <View style={[styles.rowIconWrap, { backgroundColor: theme.danger + '15' }]}>
                <Ionicons name="log-out-outline" size={20} color={theme.danger} />
              </View>
              <View style={styles.rowContent}>
                <Text style={[styles.rowLabel, { color: theme.danger }]}>Log Out</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.row} onPress={handleDeleteAccount}>
              <View style={[styles.rowIconWrap, { backgroundColor: theme.danger + '15' }]}>
                <Ionicons name="trash-outline" size={20} color={theme.danger} />
              </View>
              <View style={styles.rowContent}>
                <Text style={[styles.rowLabel, { color: theme.danger }]}>Delete Account</Text>
                <Text style={styles.rowValue}>Permanently delete all your data</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* App Info */}
          <View style={styles.appInfo}>
            <Text style={styles.appName}>Àlá</Text>
            <Text style={styles.appVersion}>Version 1.0.0</Text>
            {profile?.account_number && <Text style={styles.accountNumber}>Account #{profile.account_number}</Text>}
          </View>
        </ScrollView>
      </SafeAreaView>
    </AnimatedGradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
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
  headerBtnPlaceholder: { width: 44 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: theme.textPrimary },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 20,
    marginLeft: 4,
  },
  card: {
    backgroundColor: theme.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  rowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.glassMedium,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 16, fontWeight: '500', color: theme.textPrimary },
  rowValue: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: theme.glassBorder, marginLeft: 66 },
  allBadgesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 12,
    backgroundColor: theme.glass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    gap: 8,
  },
  allBadgesBtnText: { fontSize: 15, fontWeight: '500', color: theme.primary, flex: 1 },
  appInfo: {
    alignItems: 'center',
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.glassBorder,
  },
  appName: { fontSize: 28, fontWeight: '700', color: theme.gold },
  appVersion: { fontSize: 13, color: theme.textMuted, marginTop: 4 },
  accountNumber: { fontSize: 12, color: theme.textMuted, marginTop: 8 },
});