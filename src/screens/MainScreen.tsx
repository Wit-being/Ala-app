import React, { useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import PagerView from 'react-native-pager-view';

// Components
import AnimatedGradientBackground from '../components/common/AnimatedGradientBackground';
import ComingSoonModal from '../components/common/ComingSoonModal';
import ConfirmModal from '../components/common/ConfirmModal';
import GlowingStar from '../components/common/GlowingStar';
import FeedContent from '../components/main/FeedContent';
import JournalContent from '../components/main/JournalContent';
import SearchContent from '../components/main/SearchContent';
import DreamModal from '../components/main/DreamModal';
import BottomNav from '../components/main/BottomNav';

// Hook & Theme
import { useMainScreen } from '../hooks/useMainScreen';
import { theme } from '../constants/theme';
import { UserProfile } from '../types/dreams';

export default function MainScreen({ navigation, route }: any) {
  const pagerRef = useRef<PagerView>(null);
  const [activeTab, setActiveTab] = React.useState(1); // Start on Feed

  const {
    user,
    userProfile,
    hasNotifications,
    getUserAvatarUrl,
    feedDreams,
    feedLoading,
    feedError,
    fetchFeedDreams,
    myDreams,
    myDreamsLoading,
    myDreamsError,
    fetchMyDreams,
    journalStats,
    groupedDreams,
    searchQuery,
    setSearchQuery,
    selectedMonth,
    setSelectedMonth,
    player,
    status,
    playingId,
    playingContext,
    isAudioLoading,
    playAudio,
    resetAudioState,
    modalVisible,
    selectedDream,
    interpretations,
    interpretationsLoading,
    openDreamModal,
    closeDreamModal,
    deleteModalVisible,
    showDeleteConfirmation,
    confirmDeleteDream,
    cancelDelete,
    toggleLike,
    comingSoonVisible,
    comingSoonFeature,
    showComingSoon,
    hideComingSoon,
    currentGradientIndex,
    setCurrentGradientIndex,
    fetchUserProfile,
    checkNotifications,
  } = useMainScreen();

  // Handle deep link to open specific dream
  useEffect(() => {
    if (route?.params?.openDreamId) {
      const dreamId = route.params.openDreamId;
      const dream = feedDreams.find((d) => d.id === dreamId) || myDreams.find((d) => d.id === dreamId);
      if (dream) openDreamModal(dream);
      navigation.setParams({ openDreamId: undefined });
    }
  }, [route?.params?.openDreamId, feedDreams, myDreams]);

  // Fetch data on focus
  useFocusEffect(
    useCallback(() => {
      fetchUserProfile();
      checkNotifications();
      fetchFeedDreams();
      fetchMyDreams();
      return () => {
        player.pause();
        resetAudioState();
      };
    }, [user?.id])
  );

  const onPageSelected = (e: any) => setActiveTab(e.nativeEvent.position);
  const switchTab = (index: number) => pagerRef.current?.setPage(index);

  const navigateToProfile = (profile: UserProfile | null, userId: string) => {
    if (!profile?.is_public && userId !== user?.id) {
      showComingSoon('Private Profile');
      return;
    }
    navigation.navigate('ViewProfile', { userId });
  };

  return (
    <AnimatedGradientBackground onGradientChange={setCurrentGradientIndex}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
            <Image source={{ uri: getUserAvatarUrl() }} style={styles.headerAvatar} />
          </TouchableOpacity>

          <View style={styles.tabRow}>
            <TouchableOpacity style={styles.tab} onPress={() => switchTab(0)}>
              <Ionicons
                name="search-outline"
                size={20}
                color={activeTab === 0 ? theme.primary : theme.textMuted}
              />
              {activeTab === 0 && <View style={styles.tabDot} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.tab} onPress={() => switchTab(1)}>
              <Text style={[styles.tabText, activeTab === 1 && styles.tabActive]}>Feed</Text>
              {activeTab === 1 && <View style={styles.tabDot} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.tab} onPress={() => switchTab(2)}>
              <Text style={[styles.tabText, activeTab === 2 && styles.tabActiveGold]}>Journal</Text>
              {activeTab === 2 && <View style={[styles.tabDot, styles.tabDotGold]} />}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            style={styles.notificationBtn}
          >
            <Ionicons name="notifications-outline" size={22} color={theme.textPrimary} />
            {hasNotifications && <GlowingStar />}
          </TouchableOpacity>
        </View>

        {/* Pages */}
        <PagerView
          ref={pagerRef}
          style={styles.pager}
          initialPage={1}
          onPageSelected={onPageSelected}
        >
          <View key="search" style={styles.page}>
            <SearchContent navigation={navigation} />
          </View>
          <View key="feed" style={styles.page}>
            <FeedContent
              dreams={feedDreams}
              loading={feedLoading}
              error={feedError}
              currentUserId={user?.id}
              playingId={playingId}
              playingContext={playingContext}
              isAudioLoading={isAudioLoading}
              audioStatus={status}
              onRefresh={fetchFeedDreams}
              onDreamPress={openDreamModal}
              onPlayAudio={playAudio}
              onToggleLike={toggleLike}
              onWowPress={() => showComingSoon('Wow Reactions')}
              onProfilePress={navigateToProfile}
              onRecordPress={() => navigation.navigate('RecordDream')}
            />
          </View>
          <View key="journal" style={styles.page}>
            <JournalContent
              dreams={myDreams}
              groupedDreams={groupedDreams}
              loading={myDreamsLoading}
              error={myDreamsError}
              stats={journalStats}
              searchQuery={searchQuery}
              selectedMonth={selectedMonth}
              playingId={playingId}
              playingContext={playingContext}
              isAudioLoading={isAudioLoading}
              audioStatus={status}
              onSearchChange={setSearchQuery}
              onMonthSelect={setSelectedMonth}
              onRefresh={fetchMyDreams}
              onDreamPress={openDreamModal}
              onPlayAudio={playAudio}
              onRecordPress={() => navigation.navigate('RecordDream')}
            />
          </View>
        </PagerView>

        {/* Bottom Navigation */}
        <BottomNav
          onCirclesPress={() => showComingSoon('Dream Circles')}
          onTellPress={() => navigation.navigate('RecordDream')}
          gradientIndex={currentGradientIndex}
        />
      </SafeAreaView>

      {/* Dream Modal */}
      <DreamModal
        visible={modalVisible}
        dream={selectedDream}
        interpretations={interpretations}
        interpretationsLoading={interpretationsLoading}
        currentUserId={user?.id}
        playingId={playingId}
        playingContext={playingContext}
        isAudioLoading={isAudioLoading}
        audioStatus={status}
        onClose={closeDreamModal}
        onDelete={showDeleteConfirmation}
        onPlayAudio={playAudio}
        onToggleLike={toggleLike}
        onWowPress={() => showComingSoon('Wow Reactions')}
        onAddInterpretation={() => showComingSoon('Add Interpretation')}
        onProfilePress={navigateToProfile}
      />

      {/* Modals */}
      <ComingSoonModal
        visible={comingSoonVisible}
        onClose={hideComingSoon}
        feature={comingSoonFeature}
      />
      <ConfirmModal
        visible={deleteModalVisible}
        onClose={cancelDelete}
        onConfirm={confirmDeleteDream}
        title="Delete Dream"
        message="This dream will be permanently deleted. This action cannot be undone."
        confirmText="Delete"
        cancelText="Keep"
        confirmColor={theme.danger}
        icon="trash-outline"
      />
    </AnimatedGradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: theme.glassBorder,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  tab: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textMuted,
  },
  tabActive: {
    color: theme.textPrimary,
  },
  tabActiveGold: {
    color: theme.gold,
  },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.primary,
    marginTop: 4,
  },
  tabDotGold: {
    backgroundColor: theme.gold,
  },
  notificationBtn: {
    position: 'relative',
    padding: 4,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
});