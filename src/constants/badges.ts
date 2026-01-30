import { Badge, BadgeKey, BadgeCategory } from '../types/badges';
import { theme } from './theme';

export const BADGES: Record<BadgeKey, Badge> = {
  // Status Badges
  founding_dreamer: {
    key: 'founding_dreamer',
    icon: 'ribbon',
    label: 'Founding Dreamer',
    color: theme.gold,
    description: 'One of the first 50 dreamers to join',
    category: 'status',
    requirement: { type: 'manual' },
  },
  verified: {
    key: 'verified',
    icon: 'checkmark-circle',
    label: 'Verified',
    color: theme.primary,
    description: 'Verified account',
    category: 'status',
    requirement: { type: 'manual' },
  },
  verified_interpreter: {
    key: 'verified_interpreter',
    icon: 'eye',
    label: 'Verified Interpreter',
    color: theme.purple,
    description: 'Certified dream interpreter',
    category: 'status',
    requirement: { type: 'manual' },
  },

  // Milestone Badges
  first_dream: {
    key: 'first_dream',
    icon: 'moon',
    label: 'First Dream',
    color: theme.primary,
    description: 'Shared your first public dream',
    category: 'milestone',
    requirement: { type: 'count', target: 1, metric: 'public_dreams' },
  },
  night_owl: {
    key: 'night_owl',
    icon: 'cloudy-night',
    label: 'Night Owl',
    color: theme.purple,
    description: 'Shared 10 public dreams',
    category: 'milestone',
    requirement: { type: 'count', target: 10, metric: 'public_dreams' },
  },
  prolific_dreamer: {
    key: 'prolific_dreamer',
    icon: 'library',
    label: 'Prolific Dreamer',
    color: theme.gold,
    description: 'Shared 50 public dreams',
    category: 'milestone',
    requirement: { type: 'count', target: 50, metric: 'public_dreams' },
  },
  dream_century: {
    key: 'dream_century',
    icon: 'trophy',
    label: 'Dream Century',
    color: theme.gold,
    description: 'Shared 100 public dreams',
    category: 'milestone',
    requirement: { type: 'count', target: 100, metric: 'public_dreams' },
  },
  consistent_dreamer: {
    key: 'consistent_dreamer',
    icon: 'flame',
    label: 'Consistent Dreamer',
    color: theme.gold,
    description: 'Logged dreams 7 days in a row',
    category: 'milestone',
    requirement: { type: 'streak', target: 7, metric: 'dream_streak' },
  },
  dream_journaler: {
    key: 'dream_journaler',
    icon: 'book',
    label: 'Dream Journaler',
    color: theme.gold,
    description: 'Logged dreams 30 days in a row',
    category: 'milestone',
    requirement: { type: 'streak', target: 30, metric: 'dream_streak' },
  },

  // Engagement Badges
  friendly_dreamer: {
    key: 'friendly_dreamer',
    icon: 'hand-left',
    label: 'Friendly Dreamer',
    color: theme.primary,
    description: 'Following 10 dreamers',
    category: 'engagement',
    requirement: { type: 'count', target: 10, metric: 'following_count' },
  },
  social_butterfly: {
    key: 'social_butterfly',
    icon: 'people',
    label: 'Social Butterfly',
    color: theme.purple,
    description: 'Following 50 dreamers',
    category: 'engagement',
    requirement: { type: 'count', target: 50, metric: 'following_count' },
  },
  helpful_soul: {
    key: 'helpful_soul',
    icon: 'heart',
    label: 'Helpful Soul',
    color: theme.purple,
    description: 'Left 10 interpretations on dreams',
    category: 'engagement',
    requirement: { type: 'count', target: 10, metric: 'interpretations_given' },
  },
  beloved_dreamer: {
    key: 'beloved_dreamer',
    icon: 'sparkles',
    label: 'Beloved Dreamer',
    color: theme.gold,
    description: 'Received 50 reactions on your dreams',
    category: 'engagement',
    requirement: { type: 'count', target: 50, metric: 'reactions_received' },
  },
  conversation_starter: {
    key: 'conversation_starter',
    icon: 'chatbubbles',
    label: 'Conversation Starter',
    color: theme.primary,
    description: 'Received 25 comments on your dreams',
    category: 'engagement',
    requirement: { type: 'count', target: 25, metric: 'comments_received' },
  },
};

export const BADGE_KEYS = Object.keys(BADGES) as BadgeKey[];

export const BADGE_CATEGORIES: Record<BadgeCategory, { label: string; description: string }> = {
  status: {
    label: 'Account Status',
    description: 'Special account designations',
  },
  milestone: {
    label: 'Dream Milestones',
    description: 'Earned through dream activity',
  },
  engagement: {
    label: 'Community Engagement',
    description: 'Earned through social activity',
  },
  special: {
    label: 'Special Recognition',
    description: 'Limited edition badges',
  },
};

// Utilities

export function getBadge(key: BadgeKey): Badge | undefined {
  return BADGES[key];
}

export function getBadgesByCategory(category: BadgeCategory): Badge[] {
  return BADGE_KEYS.map((key) => BADGES[key]).filter((b) => b.category === category);
}

export function getBadgeProgress(badge: Badge, currentValue: number): number {
  if (!badge.requirement?.target) return 0;
  return Math.min((currentValue / badge.requirement.target) * 100, 100);
}

export function isBadgeEarnable(badge: Badge): boolean {
  return badge.requirement?.type !== 'manual';
}

export function getGlowColor(color: string, opacity: number = 0.2): string {
  if (color === theme.gold) return `rgba(212, 175, 55, ${opacity})`;
  if (color === theme.primary) return `rgba(96, 165, 250, ${opacity})`;
  if (color === theme.purple) return `rgba(167, 139, 250, ${opacity})`;
  return `rgba(255, 255, 255, ${opacity})`;
}