// Define colors object
const colors = {
  // Backgrounds
  background: '#050a15',
  backgroundGradientStart: '#050a15',
  backgroundGradientEnd: '#0a1628',
  
  // Glass
  glass: 'rgba(255, 255, 255, 0.03)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  glassHighlight: 'rgba(255, 255, 255, 0.05)',
  
  // Accent
  primary: '#60a5fa',
  primaryGlow: 'rgba(96, 165, 250, 0.3)',
  gold: '#d4af37',
  goldGlow: 'rgba(212, 175, 55, 0.3)',
  
  // Text
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textSubtle: '#475569',
  
  // Inputs
  inputBg: 'rgba(255, 255, 255, 0.03)',
  inputBorder: 'rgba(255, 255, 255, 0.08)',
  
  // UI
  danger: '#ef4444',
  success: '#10b981',
  
  // Special effects
  glowBlue: 'rgba(96, 165, 250, 0.15)',
  glowGold: 'rgba(212, 175, 55, 0.15)',
};

// Export as both names for compatibility
export const theme = colors;
export { colors };
export default colors;