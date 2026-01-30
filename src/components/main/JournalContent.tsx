import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SectionList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import JournalEntryCard from './JournalEntryCard';
import StatsCard from './StatsCard';
import { theme } from '../../constants/theme';
import { DreamWithMeta, DreamSection, JournalStats, AudioContext } from '../../types/dreams';

interface Props {
  dreams: DreamWithMeta[];
  groupedDreams: DreamSection[];
  loading: boolean;
  error: string | null;
  stats: JournalStats;
  searchQuery: string;
  selectedMonth: string | null;
  playingId: string | null;
  playingContext: AudioContext | null;
  isAudioLoading: string | null;
  audioStatus: any;
  onSearchChange: (query: string) => void;
  onMonthSelect: (month: string | null) => void;
  onRefresh: () => void;
  onDreamPress: (dream: DreamWithMeta) => void;
  onPlayAudio: (dream: DreamWithMeta, context: AudioContext) => void;
  onRecordPress: () => void;
}

export default function JournalContent({
  dreams,
  groupedDreams,
  loading,
  error,
  stats,
  searchQuery,
  selectedMonth,
  playingId,
  playingContext,
  isAudioLoading,
  audioStatus,
  onSearchChange,
  onMonthSelect,
  onRefresh,
  onDreamPress,
  onPlayAudio,
  onRecordPress,
}: Props) {
  if (loading && dreams.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.gold} />
        <Text style={styles.loadingText}>Loading your journal...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={48} color={theme.textSubtle} />
        <Text style={styles.stateTitle}>Connection Issue</Text>
        <Text style={styles.stateSubtitle}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (dreams.length === 0) {
    return (
      <ScrollView style={styles.emptyScroll} contentContainerStyle={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="book-outline" size={64} color={theme.gold} />
        </View>
        <Text style={styles.emptyTitle}>Your Dream Journal</Text>
        <Text style={styles.emptyText}>
          Start capturing your dreams to unlock insights about your subconscious mind.
        </Text>
        <View style={styles.benefits}>
          <View style={styles.benefitItem}>
            <Ionicons name="sparkles" size={20} color={theme.gold} />
            <Text style={styles.benefitText}>Improve dream recall</Text>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="analytics-outline" size={20} color={theme.primary} />
            <Text style={styles.benefitText}>Discover patterns</Text>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="bulb-outline" size={20} color={theme.purple} />
            <Text style={styles.benefitText}>Gain insights</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.emptyRecordBtn} onPress={onRecordPress}>
          <LinearGradient colors={[theme.gold, '#b8962e']} style={styles.emptyRecordGradient}>
            <Feather name="feather" size={20} color="#fff" />
            <Text style={styles.emptyRecordText}>Tell Your First Dream</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats */}
      <View style={styles.statsRow}>
        <StatsCard icon="book" label="Total" value={stats.total} color={theme.primary} />
        <StatsCard icon="flame" label="Streak" value={`${stats.streak}d`} color={theme.gold} />
        <StatsCard icon="calendar" label="This Month" value={stats.thisMonth} color={theme.purple} />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={theme.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search your dreams..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={onSearchChange}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange('')}>
            <Ionicons name="close-circle" size={18} color={theme.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Month Filter */}
      {stats.months.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.monthFilter}
          contentContainerStyle={styles.monthFilterContent}
        >
          <TouchableOpacity
            style={[styles.monthPill, !selectedMonth && styles.monthPillActive]}
            onPress={() => onMonthSelect(null)}
          >
            <Text style={[styles.monthPillText, !selectedMonth && styles.monthPillTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {stats.months.slice(0, 6).map((month) => {
            const [year, m] = month.split('-');
            const label = new Date(parseInt(year), parseInt(m) - 1).toLocaleDateString('en-US', {
              month: 'short',
            });
            return (
              <TouchableOpacity
                key={month}
                style={[styles.monthPill, selectedMonth === month && styles.monthPillActive]}
                onPress={() => onMonthSelect(selectedMonth === month ? null : month)}
              >
                <Text
                  style={[
                    styles.monthPillText,
                    selectedMonth === month && styles.monthPillTextActive,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* List */}
      {groupedDreams.length === 0 ? (
        <View style={styles.noResults}>
          <Ionicons name="search-outline" size={32} color={theme.textMuted} />
          <Text style={styles.noResultsText}>No dreams found</Text>
        </View>
      ) : (
        <SectionList
          sections={groupedDreams}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <JournalEntryCard
              item={item}
              playingId={playingId}
              playingContext={playingContext}
              isAudioLoading={isAudioLoading}
              audioStatus={audioStatus}
              onPress={() => onDreamPress(item)}
              onPlayAudio={onPlayAudio}
            />
          )}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{title}</Text>
            </View>
          )}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          refreshing={loading}
          onRefresh={onRefresh}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.glass,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.textPrimary,
    marginLeft: 8,
  },
  monthFilter: {
    marginTop: 12,
    maxHeight: 36,
  },
  monthFilterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  monthPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  monthPillActive: {
    backgroundColor: theme.glowGold,
    borderColor: theme.gold + '50',
  },
  monthPillText: {
    fontSize: 13,
    color: theme.textSubtle,
    fontWeight: '500',
  },
  monthPillTextActive: {
    color: theme.gold,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 140,
  },
  sectionHeader: {
    paddingVertical: 8,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  noResultsText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.textMuted,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 16,
    color: theme.textSubtle,
    fontSize: 14,
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  stateSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  emptyScroll: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 100,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.glowGold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  benefits: {
    width: '100%',
    gap: 12,
    marginBottom: 32,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.glass,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  benefitText: {
    fontSize: 14,
    color: theme.textPrimary,
    fontWeight: '500',
  },
  emptyRecordBtn: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  emptyRecordGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  emptyRecordText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});