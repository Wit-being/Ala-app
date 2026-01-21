import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import GlassCard from '../components/GlassCard';
import PillButton from '../components/PillButton';

const theme = {
  backgroundGradientStart: '#050a15',
  backgroundGradientEnd: '#0a1628',
  glass: 'rgba(255, 255, 255, 0.05)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  primary: '#60a5fa',
  gold: '#d4af37',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textSubtle: '#64748b',
};

export default function ProfileScreen({ navigation }: any) {
  const user = useAuthStore((state) => state.user);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.email || 'User')}&background=1e293b&color=60a5fa&size=128`;

  return (
    <LinearGradient
      colors={[theme.backgroundGradientStart, theme.backgroundGradientEnd]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile Info */}
          <View style={styles.profileSection}>
            <View style={styles.avatarGlow}>
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            </View>
            <Text style={styles.email}>{user?.email}</Text>
            <Text style={styles.memberSince}>
              Dreaming since {new Date(user?.created_at || '').toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric'
              })}
            </Text>
          </View>

          {/* Coming Soon Features */}
          <Text style={styles.sectionTitle}>Coming Soon</Text>
          
          <GlassCard style={styles.featureCard}>
            <View style={styles.featureRow}>
              <Text style={styles.featureIcon}>🌙</Text>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>Dream Circles</Text>
                <Text style={styles.featureDesc}>Share dreams with close friends</Text>
              </View>
            </View>
          </GlassCard>

          <GlassCard style={styles.featureCard}>
            <View style={styles.featureRow}>
              <Text style={styles.featureIcon}>✨</Text>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>Dream Analysis</Text>
                <Text style={styles.featureDesc}>AI-powered pattern insights</Text>
              </View>
            </View>
          </GlassCard>

          <GlassCard style={styles.featureCard}>
            <View style={styles.featureRow}>
              <Text style={styles.featureIcon}>🔮</Text>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>Lucid Training</Text>
                <Text style={styles.featureDesc}>Learn to control your dreams</Text>
              </View>
            </View>
          </GlassCard>

          {/* Logout */}
          <View style={styles.logoutSection}>
            <PillButton
              title="Log Out"
              onPress={handleLogout}
              variant="glass"
              size="large"
            />
          </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    color: theme.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    color: theme.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatarGlow: {
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 25,
    elevation: 15,
    marginBottom: 16,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: theme.glassBorder,
  },
  email: {
    fontSize: 18,
    color: theme.textPrimary,
    fontWeight: '500',
    marginBottom: 4,
  },
  memberSince: {
    fontSize: 14,
    color: theme.textSubtle,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
    marginLeft: 4,
  },
  featureCard: {
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIcon: {
    fontSize: 32,
    marginRight: 16,
    width: 40,
    textAlign: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  logoutSection: {
    marginTop: 32,
    alignItems: 'center',
  },
});