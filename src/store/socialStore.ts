import { create } from 'zustand';
import { BlockedUser, UserRelationshipStatus } from '../types/social';
import { socialService } from '../services/socialService';

interface SocialState {
  blockedUsers: BlockedUser[];
  blockedUserIds: Set<string>;
  isLoading: boolean;
  
  // Actions
  fetchBlockedUsers: (userId: string) => Promise<void>;
  blockUser: (userId: string, targetUserId: string) => Promise<boolean>;
  unblockUser: (userId: string, targetUserId: string) => Promise<boolean>;
  isUserBlocked: (targetUserId: string) => boolean;
  clearSocialData: () => void;
}

export const useSocialStore = create<SocialState>((set, get) => ({
  blockedUsers: [],
  blockedUserIds: new Set(),
  isLoading: false,

  fetchBlockedUsers: async (userId: string) => {
    set({ isLoading: true });
    try {
      const blockedUsers = await socialService.getBlockedUsers(userId);
      const blockedUserIds = new Set(blockedUsers.map((b) => b.blocked_user_id));
      set({ blockedUsers, blockedUserIds });
    } catch (error) {
      console.error('Error fetching blocked users:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  blockUser: async (userId: string, targetUserId: string) => {
    const result = await socialService.blockUser(userId, targetUserId);
    if (result.success) {
      // Optimistically update local state
      const newBlockedUserIds = new Set(get().blockedUserIds);
      newBlockedUserIds.add(targetUserId);
      set({ blockedUserIds: newBlockedUserIds });
      
      // Refresh full list
      await get().fetchBlockedUsers(userId);
      return true;
    }
    return false;
  },

  unblockUser: async (userId: string, targetUserId: string) => {
    const result = await socialService.unblockUser(userId, targetUserId);
    if (result.success) {
      // Optimistically update local state
      const newBlockedUserIds = new Set(get().blockedUserIds);
      newBlockedUserIds.delete(targetUserId);
      
      const newBlockedUsers = get().blockedUsers.filter(
        (b) => b.blocked_user_id !== targetUserId
      );
      
      set({ 
        blockedUserIds: newBlockedUserIds,
        blockedUsers: newBlockedUsers,
      });
      return true;
    }
    return false;
  },

  isUserBlocked: (targetUserId: string) => {
    return get().blockedUserIds.has(targetUserId);
  },

  clearSocialData: () => {
    set({
      blockedUsers: [],
      blockedUserIds: new Set(),
      isLoading: false,
    });
  },
}));