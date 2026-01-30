export const theme = {
  background: '#050a15',
  backgroundGradientStart: '#050a15',
  backgroundGradientEnd: '#0a1628',
  glass: 'rgba(255, 255, 255, 0.06)',
  glassMedium: 'rgba(255, 255, 255, 0.08)',
  glassStrong: 'rgba(255, 255, 255, 0.12)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  glassBorderLight: 'rgba(255, 255, 255, 0.15)',
  primary: '#60a5fa',
  primaryDark: '#3b82f6',
  gold: '#d4af37',
  goldLight: '#e6c55a',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textSubtle: '#64748b',
  textMuted: '#475569',
  danger: '#ef4444',
  success: '#10b981',
  purple: '#a78bfa',
  glowBlue: 'rgba(96, 165, 250, 0.15)',
  glowGold: 'rgba(212, 175, 55, 0.15)',
  glowPurple: 'rgba(167, 139, 250, 0.15)',
};

export const badgeColors = {
  founding: {
    primary: '#FFD700',
    secondary: '#FFF8DC',
    glow: 'rgba(255, 215, 0, 0.25)',
    background: 'rgba(255, 215, 0, 0.12)',
  },
  verified: {
    primary: '#1DA1F2',
    secondary: '#E8F5FD',
    glow: 'rgba(29, 161, 242, 0.25)',
    background: 'rgba(29, 161, 242, 0.12)',
  },
  interpreter: {
    primary: '#9B59B6',
    secondary: '#F5EEF8',
    glow: 'rgba(155, 89, 182, 0.25)',
    background: 'rgba(155, 89, 182, 0.12)',
  },
  milestone: {
    primary: '#3498DB',
    secondary: '#EBF5FB',
    glow: 'rgba(52, 152, 219, 0.25)',
    background: 'rgba(52, 152, 219, 0.12)',
  },
  night: {
    primary: '#2C3E50',
    secondary: '#D5D8DC',
    glow: 'rgba(44, 62, 80, 0.25)',
    background: 'rgba(44, 62, 80, 0.15)',
  },
  achievement: {
    primary: '#E74C3C',
    secondary: '#FDEDEC',
    glow: 'rgba(231, 76, 60, 0.25)',
    background: 'rgba(231, 76, 60, 0.12)',
  },
  trophy: {
    primary: '#F39C12',
    secondary: '#FEF5E7',
    glow: 'rgba(243, 156, 18, 0.25)',
    background: 'rgba(243, 156, 18, 0.12)',
  },
  streak: {
    primary: '#E67E22',
    secondary: '#FDF2E9',
    glow: 'rgba(230, 126, 34, 0.25)',
    background: 'rgba(230, 126, 34, 0.12)',
  },
  journal: {
    primary: '#1ABC9C',
    secondary: '#E8F8F5',
    glow: 'rgba(26, 188, 156, 0.25)',
    background: 'rgba(26, 188, 156, 0.12)',
  },
  social: {
    primary: '#9B59B6',
    secondary: '#F5EEF8',
    glow: 'rgba(155, 89, 182, 0.25)',
    background: 'rgba(155, 89, 182, 0.12)',
  },
  love: {
    primary: '#E91E63',
    secondary: '#FCE4EC',
    glow: 'rgba(233, 30, 99, 0.25)',
    background: 'rgba(233, 30, 99, 0.12)',
  },
  heart: {
    primary: '#FF6B6B',
    secondary: '#FFE8E8',
    glow: 'rgba(255, 107, 107, 0.25)',
    background: 'rgba(255, 107, 107, 0.12)',
  },
  conversation: {
    primary: '#00BCD4',
    secondary: '#E0F7FA',
    glow: 'rgba(0, 188, 212, 0.25)',
    background: 'rgba(0, 188, 212, 0.12)',
  },
};

export type BadgeColorKey = keyof typeof badgeColors;

export const AMBIENT_GRADIENTS: readonly [string, string, string][] = [
  ['#050a15', '#0a1628', '#0f172a'],
  ['#0a0f1a', '#121a2e', '#1a2744'],
  ['#0d0a15', '#1a1428', '#261e3d'],
  ['#0a1210', '#122420', '#1a3530'],
  ['#100a0a', '#201414', '#301e1e'],
  ['#0a0d14', '#141e2d', '#1e2e45'],
  ['#0f0a14', '#1a142a', '#251e40'],
];

export const GRADIENT_INTERVAL = 14000;
export const ICON_SWAP_INTERVAL = 7000;

export const TAG_EMOJIS: { [key: string]: string } = {
  sparkles: '✨',
  stars: '🌟',
  rainbow: '🌈',
  butterfly: '🦋',
  cloud: '☁️',
  heart: '💖',
  cobweb: '🕸️',
  skull: '💀',
  ghost: '👻',
  moon: '🌑',
  eye: '👁️',
  fog: '🌫️',
};

export const OVERLAY_CONFIG: {
  [key: string]: { emoji: string; tintColor: string; secondaryEmoji?: string };
} = {
  sparkles: { emoji: '✨', tintColor: 'rgba(255, 215, 0, 0.04)', secondaryEmoji: '⭐' },
  stars: { emoji: '🌟', tintColor: 'rgba(255, 223, 100, 0.04)', secondaryEmoji: '✨' },
  rainbow: { emoji: '🌈', tintColor: 'rgba(255, 150, 200, 0.03)', secondaryEmoji: '☁️' },
  butterfly: { emoji: '🦋', tintColor: 'rgba(150, 200, 255, 0.04)', secondaryEmoji: '🌸' },
  cloud: { emoji: '☁️', tintColor: 'rgba(200, 220, 255, 0.05)', secondaryEmoji: '💫' },
  heart: { emoji: '💖', tintColor: 'rgba(255, 150, 180, 0.04)', secondaryEmoji: '💕' },
  cobweb: { emoji: '🕸️', tintColor: 'rgba(80, 60, 50, 0.06)', secondaryEmoji: '🕷️' },
  skull: { emoji: '💀', tintColor: 'rgba(60, 60, 70, 0.06)', secondaryEmoji: '🦴' },
  ghost: { emoji: '👻', tintColor: 'rgba(180, 180, 200, 0.04)', secondaryEmoji: '💨' },
  moon: { emoji: '🌑', tintColor: 'rgba(30, 30, 50, 0.06)', secondaryEmoji: '🌫️' },
  eye: { emoji: '👁️', tintColor: 'rgba(100, 50, 80, 0.05)', secondaryEmoji: '👁️‍🗨️' },
  fog: { emoji: '🌫️', tintColor: 'rgba(150, 150, 170, 0.05)', secondaryEmoji: '💨' },
};