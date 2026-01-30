import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useAlert } from '../hooks/useAlert';
import { theme, AMBIENT_GRADIENTS } from '../constants/theme';

interface ProfileData {
  display_name: string;
  username: string;
  bio: string;
  username_changed_at: string | null;
}

export default function EditProfileScreen({ navigation }: any) {
  const user = useAuthStore((state) => state.user);
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalData, setOriginalData] = useState<ProfileData | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameChangedAt, setUsernameChangedAt] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, [user?.id]);

  const fetchProfile = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, username, bio, username_changed_at')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setDisplayName(data.display_name || '');
        setUsername(data.username || '');
        setBio(data.bio || '');
        setUsernameChangedAt(data.username_changed_at);
        setOriginalData({
          display_name: data.display_name || '',
          username: data.username || '',
          bio: data.bio || '',
          username_changed_at: data.username_changed_at,
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const canChangeUsername = () => {
    if (!originalData?.username) return true;
    if (!usernameChangedAt) return true;

    const lastChanged = new Date(usernameChangedAt);
    const now = new Date();
    const daysSinceChange = Math.floor(
      (now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysSinceChange >= 14;
  };

  const daysUntilUsernameChange = () => {
    if (!usernameChangedAt) return 0;

    const lastChanged = new Date(usernameChangedAt);
    const now = new Date();
    const daysSinceChange = Math.floor(
      (now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24)
    );

    return Math.max(0, 14 - daysSinceChange);
  };

  const validateUsername = (value: string): string | null => {
    if (!value.trim()) return null;
    if (value.length < 3) return 'Username must be at least 3 characters';
    if (value.length > 20) return 'Username must be 20 characters or less';
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Only letters, numbers, and underscores';
    return null;
  };

  const checkUsernameAvailable = async (value: string): Promise<boolean> => {
    if (!value.trim()) return true;

    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', value.toLowerCase())
      .neq('id', user?.id || '')
      .single();

    return !data;
  };

  const hasChanges = () => {
    if (!originalData) return false;
    return (
      displayName !== originalData.display_name ||
      username !== originalData.username ||
      bio !== originalData.bio
    );
  };

  const handleSave = async () => {
    if (!user?.id || !hasChanges()) return;

    const usernameChanged = username !== originalData?.username;

    if (usernameChanged && username.trim()) {
      if (!canChangeUsername()) {
        const days = daysUntilUsernameChange();
        showAlert({
          title: 'Username Locked',
          message: `You can change your username in ${days} day${days !== 1 ? 's' : ''}.`,
          type: 'warning',
        });
        return;
      }

      const validationError = validateUsername(username);
      if (validationError) {
        setUsernameError(validationError);
        return;
      }

      const isAvailable = await checkUsernameAvailable(username);
      if (!isAvailable) {
        setUsernameError('This username is already taken');
        return;
      }
    }

    setSaving(true);
    setUsernameError('');

    try {
      const updates: any = {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
      };

      if (usernameChanged) {
        updates.username = username.trim().toLowerCase() || null;
        if (username.trim()) {
          updates.username_changed_at = new Date().toISOString();
        }
      }

      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);

      if (error) throw error;

      navigation.goBack();
    } catch (error: any) {
      console.error('Error saving profile:', error);
      showAlert({
        title: 'Error',
        message: error.message || 'Failed to save changes.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUsernameChange = (text: string) => {
    const cleaned = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(cleaned);
    setUsernameError('');
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

  const usernameIsLocked = originalData?.username && !canChangeUsername();

  return (
    <LinearGradient colors={AMBIENT_GRADIENTS[0]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
              <Ionicons name="close" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.saveBtn, !hasChanges() && styles.saveBtnDisabled]}
              disabled={!hasChanges() || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.saveBtnText, !hasChanges() && styles.saveBtnTextDisabled]}>
                  Save
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Display Name</Text>
              <TextInput
                style={styles.input}
                placeholder="How others will see your name"
                placeholderTextColor={theme.textMuted}
                value={displayName}
                onChangeText={setDisplayName}
                maxLength={30}
              />
              <Text style={styles.hint}>{displayName.length}/30</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <View style={[styles.usernameInputWrap, usernameIsLocked && styles.inputLocked]}>
                <Text style={styles.usernamePrefix}>@</Text>
                <TextInput
                  style={styles.usernameInput}
                  placeholder="username"
                  placeholderTextColor={theme.textMuted}
                  value={username}
                  onChangeText={handleUsernameChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                  editable={!usernameIsLocked}
                />
                {usernameIsLocked && (
                  <Ionicons name="lock-closed" size={16} color={theme.textMuted} />
                )}
              </View>
              {usernameError ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={14} color={theme.danger} />
                  <Text style={styles.errorText}>{usernameError}</Text>
                </View>
              ) : usernameIsLocked ? (
                <Text style={styles.hint}>
                  Can be changed in {daysUntilUsernameChange()} day
                  {daysUntilUsernameChange() !== 1 ? 's' : ''}
                </Text>
              ) : (
                <Text style={styles.hint}>Letters, numbers, underscores only</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, styles.bioInput]}
                placeholder="Tell others about yourself..."
                placeholderTextColor={theme.textMuted}
                value={bio}
                onChangeText={setBio}
                multiline
                maxLength={150}
                textAlignVertical="top"
              />
              <Text style={styles.hint}>{bio.length}/150</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  keyboardView: {
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
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: theme.primary,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: theme.glass,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  saveBtnTextDisabled: {
    color: theme.textMuted,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 10,
    marginLeft: 4,
  },
  input: {
    backgroundColor: theme.glass,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.textPrimary,
  },
  inputLocked: {
    opacity: 0.6,
  },
  bioInput: {
    height: 100,
    paddingTop: 14,
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
    fontSize: 16,
    color: theme.textMuted,
    marginRight: 2,
  },
  usernameInput: {
    flex: 1,
    fontSize: 16,
    color: theme.textPrimary,
    paddingVertical: 14,
  },
  hint: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 8,
    marginLeft: 4,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginLeft: 4,
  },
  errorText: {
    fontSize: 12,
    color: theme.danger,
  },
});