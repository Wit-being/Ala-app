export interface Dream {
  id: string;
  user_id: string;
  title: string | null;
  content: string | null;
  audio_url: string | null;
  audio_duration: number | null;
  is_public: boolean;
  status?: string;
  dream_date: string;
  created_at: string;
  interpretation_mode?: string;
  enable_engagement?: boolean;
  dream_type?: 'dream' | 'nightmare' | null;
  dream_tag?: string | null;
}

export interface UserProfile {
  id: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  is_public?: boolean;
}

export interface DreamWithMeta extends Dream {
  likeCount?: number;
  interpretationCount?: number;
  isLiked?: boolean;
  authorProfile?: UserProfile | null;
}

export interface DreamSection {
  title: string;
  data: DreamWithMeta[];
}

export interface Interpretation {
  id: string;
  dream_id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id?: string | null;
  author?: UserProfile;
  replies?: Interpretation[];
}

export type AudioContext = 'feed' | 'journal' | 'modal';

export interface JournalStats {
  total: number;
  thisMonth: number;
  streak: number;
  months: string[];
}

export interface DreamTag {
  tag: string;
  count: number;
}