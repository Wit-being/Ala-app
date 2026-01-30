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
  is_founding_dreamer?: boolean;
  is_verified?: boolean;
  is_verified_interpreter?: boolean;
}

export type ReactionType = 'scary' | 'sweet' | 'divine';

export interface DreamReaction {
  id: string;
  dream_id: string;
  user_id: string;
  reaction_type: ReactionType;
  created_at: string;
}

export interface DreamWithMeta extends Dream {
  likeCount?: number;
  interpretationCount?: number;
  isLiked?: boolean;
  authorProfile?: UserProfile | null;
  // New reaction fields
  userReaction?: ReactionType | null;
  reactionCount?: number;
  reactionCounts?: {
    scary: number;
    sweet: number;
    divine: number;
  };
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