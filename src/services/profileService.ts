import { supabase } from '../lib/supabase';
import { UserProfile, DreamStats, PublicDream } from '../types/profile';

export const profileService = {
  async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  },

  async createProfile(userId: string, email?: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          username: null,
          display_name: email?.split('@')[0] || null,
          avatar_url: null,
          is_public: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating profile:', error);
      return null;
    }
  },

  async updateProfile(
    userId: string,
    updates: Partial<UserProfile>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error updating profile:', error);
      return { success: false, error: error.message };
    }
  },

  async getDreamStats(userId: string): Promise<DreamStats> {
    try {
      const { data: dreams, error } = await supabase
        .from('dreams')
        .select('dream_date, is_public')
        .eq('user_id', userId);

      if (error) throw error;

      const totalDreams = dreams?.length || 0;
      const publicDreams = dreams?.filter((d) => d.is_public).length || 0;

      let streak = 0;
      if (dreams && dreams.length > 0) {
        const sortedDates = [...new Set(dreams.map((d) => d.dream_date.split('T')[0]))]
          .sort()
          .reverse();
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        if (sortedDates[0] === today || sortedDates[0] === yesterday) {
          streak = 1;
          for (let i = 1; i < sortedDates.length; i++) {
            const prevDate = new Date(sortedDates[i - 1]);
            const currDate = new Date(sortedDates[i]);
            const diffDays = Math.floor(
              (prevDate.getTime() - currDate.getTime()) / 86400000
            );
            if (diffDays === 1) streak++;
            else break;
          }
        }
      }

      return { totalDreams, publicDreams, streak };
    } catch (error) {
      console.error('Error fetching dream stats:', error);
      return { totalDreams: 0, publicDreams: 0, streak: 0 };
    }
  },

  async getPublicDreams(userId: string, limit: number = 10): Promise<PublicDream[]> {
    try {
      const { data, error } = await supabase
        .from('dreams')
        .select('id, title, content, dream_date, created_at')
        .eq('user_id', userId)
        .eq('is_public', true)
        .order('dream_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching public dreams:', error);
      return [];
    }
  },

  async checkUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    try {
      let query = supabase
        .from('profiles')
        .select('id')
        .eq('username', username.toLowerCase());

      if (excludeUserId) {
        query = query.neq('id', excludeUserId);
      }

      const { data } = await query.single();
      return !data;
    } catch {
      return true;
    }
  },

  async uploadAvatar(
    userId: string,
    uri: string
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${userId}/avatar.${fileExt}`;

      const formData = new FormData();
      formData.append('file', {
        uri,
        name: fileName,
        type: `image/${fileExt}`,
      } as any);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, formData, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      return { success: true, url: avatarUrl };
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      return { success: false, error: error.message };
    }
  },

  async removeAvatar(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', userId);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  getAvatarUrl(profile: UserProfile | null, fallbackEmail?: string): string {
    if (profile?.avatar_url) return profile.avatar_url;
    const name = profile?.display_name || profile?.username || fallbackEmail || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=60a5fa&size=200`;
  },

  getDisplayName(profile: UserProfile | null): string {
    if (profile?.display_name) return profile.display_name;
    if (profile?.username) return `@${profile.username}`;
    return 'Anonymous Dreamer';
  },
};