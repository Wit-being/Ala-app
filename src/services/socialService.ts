import { supabase } from '../lib/supabase';
import { BlockedUser, MutedUser, FollowRelationship, UserRelationshipStatus } from '../types/social';

export const socialService = {
  // Block a user
  async blockUser(userId: string, targetUserId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Insert block record
      const { error: blockError } = await supabase
        .from('blocked_users')
        .insert({
          user_id: userId,
          blocked_user_id: targetUserId,
          created_at: new Date().toISOString(),
        });

      if (blockError) throw blockError;

      // Remove any existing follow relationships in both directions
      await supabase
        .from('follows')
        .delete()
        .or(`and(follower_id.eq.${userId},following_id.eq.${targetUserId}),and(follower_id.eq.${targetUserId},following_id.eq.${userId})`);

      // Remove from muted users if exists
      await supabase
        .from('muted_users')
        .delete()
        .eq('user_id', userId)
        .eq('muted_user_id', targetUserId);

      return { success: true };
    } catch (error: any) {
      console.error('Error blocking user:', error);
      return { success: false, error: error.message || 'Failed to block user' };
    }
  },

  // Unblock a user
  async unblockUser(userId: string, targetUserId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('user_id', userId)
        .eq('blocked_user_id', targetUserId);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error unblocking user:', error);
      return { success: false, error: error.message || 'Failed to unblock user' };
    }
  },

  // Get all blocked users for a user
  async getBlockedUsers(userId: string): Promise<BlockedUser[]> {
    try {
      const { data, error } = await supabase
        .from('blocked_users')
        .select('id, user_id, blocked_user_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch profiles for blocked users
      const blockedUserIds = data.map((b) => b.blocked_user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', blockedUserIds);

      const profilesMap = (profiles || []).reduce(
        (acc, p) => ({ ...acc, [p.id]: p }),
        {} as Record<string, BlockedUser['profile']>
      );

      return data.map((b) => ({
        ...b,
        profile: profilesMap[b.blocked_user_id],
      }));
    } catch (error) {
      console.error('Error fetching blocked users:', error);
      return [];
    }
  },

  // Check if a user is blocked
  async isBlocked(userId: string, targetUserId: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('user_id', userId)
        .eq('blocked_user_id', targetUserId)
        .single();

      return !!data;
    } catch {
      return false;
    }
  },

  // Check if blocked by another user
  async isBlockedBy(userId: string, targetUserId: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('user_id', targetUserId)
        .eq('blocked_user_id', userId)
        .single();

      return !!data;
    } catch {
      return false;
    }
  },

  // Follow a user
  async followUser(followerId: string, followingId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if blocked in either direction
      const [blocked, blockedBy] = await Promise.all([
        this.isBlocked(followerId, followingId),
        this.isBlockedBy(followerId, followingId),
      ]);

      if (blocked || blockedBy) {
        return { success: false, error: 'Cannot follow this user' };
      }

      const { error } = await supabase
        .from('follows')
        .insert({
          follower_id: followerId,
          following_id: followingId,
          created_at: new Date().toISOString(),
        });

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error following user:', error);
      return { success: false, error: error.message || 'Failed to follow user' };
    }
  },

  // Unfollow a user
  async unfollowUser(followerId: string, followingId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', followingId);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error unfollowing user:', error);
      return { success: false, error: error.message || 'Failed to unfollow user' };
    }
  },

  // Check if following a user
  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .single();

      return !!data;
    } catch {
      return false;
    }
  },

  // Get full relationship status between two users
  async getRelationshipStatus(userId: string, targetUserId: string): Promise<UserRelationshipStatus> {
    try {
      const [isFollowing, isFollowedBy, isBlocked, isBlockedBy, isMuted] = await Promise.all([
        this.isFollowing(userId, targetUserId),
        this.isFollowing(targetUserId, userId),
        this.isBlocked(userId, targetUserId),
        this.isBlockedBy(userId, targetUserId),
        this.isMuted(userId, targetUserId),
      ]);

      return { isFollowing, isFollowedBy, isBlocked, isBlockedBy, isMuted };
    } catch {
      return {
        isFollowing: false,
        isFollowedBy: false,
        isBlocked: false,
        isBlockedBy: false,
        isMuted: false,
      };
    }
  },

  // Mute a user
  async muteUser(userId: string, targetUserId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('muted_users')
        .upsert({
          user_id: userId,
          muted_user_id: targetUserId,
          created_at: new Date().toISOString(),
        });

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to mute user' };
    }
  },

  // Unmute a user
  async unmuteUser(userId: string, targetUserId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('muted_users')
        .delete()
        .eq('user_id', userId)
        .eq('muted_user_id', targetUserId);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to unmute user' };
    }
  },

  // Check if user is muted
  async isMuted(userId: string, targetUserId: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('muted_users')
        .select('id')
        .eq('user_id', userId)
        .eq('muted_user_id', targetUserId)
        .single();

      return !!data;
    } catch {
      return false;
    }
  },

  // Get follower count
  async getFollowerCount(userId: string): Promise<number> {
    try {
      const { count } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId);

      return count || 0;
    } catch {
      return 0;
    }
  },

  // Get following count
  async getFollowingCount(userId: string): Promise<number> {
    try {
      const { count } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId);

      return count || 0;
    } catch {
      return 0;
    }
  },
};