import { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

export type IoniconsName = ComponentProps<typeof Ionicons>['name'];

export type BadgeKey = 
  | 'founding_dreamer'
  | 'verified'
  | 'verified_interpreter'
  | 'first_dream'
  | 'night_owl'
  | 'prolific_dreamer'
  | 'dream_century'
  | 'consistent_dreamer'
  | 'dream_journaler'
  | 'friendly_dreamer'
  | 'social_butterfly'
  | 'helpful_soul'
  | 'beloved_dreamer'
  | 'conversation_starter';

export interface Badge {
  key: BadgeKey;
  icon: IoniconsName;
  label: string;
  color: string;
  description: string;
  category: 'status' | 'milestone' | 'engagement' | 'special';
  requirement?: {
    type: 'count' | 'streak' | 'manual';
    target?: number;
    metric?: string;
  };
}

export interface UserBadge {
  badge_key: BadgeKey;
  earned_at: string;
  progress?: number;
}
