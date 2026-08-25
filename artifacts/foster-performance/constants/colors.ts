const colors = {
  light: {
    text: '#0a0a0a',
    tint: '#2F80FF',
    background: '#F4F4F4',
    foreground: '#0A0A0A',
    card: '#FFFFFF',
    cardForeground: '#0A0A0A',
    primary: '#2F80FF',
    primaryForeground: '#FFFFFF',
    secondary: '#F0F0F0',
    secondaryForeground: '#1A1A1A',
    muted: '#EFEFEF',
    mutedForeground: '#666666',
    accent: '#D6A84B',
    accentForeground: '#0A0A0A',
    success: '#35C98A',
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',
    border: '#E0E0E0',
    input: '#E0E0E0',
  },
  dark: {
    text: '#FFFFFF',
    tint: '#2F80FF',
    background: '#05070B',
    foreground: '#FFFFFF',
    card: '#0D1117',
    cardForeground: '#FFFFFF',
    primary: '#2F80FF',
    primaryForeground: '#FFFFFF',
    secondary: '#12151C',
    secondaryForeground: '#FFFFFF',
    muted: '#12151C',
    mutedForeground: '#9AA3B5',
    accent: '#D6A84B',
    accentForeground: '#0A0A0A',
    success: '#35C98A',
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',
    border: '#141720',
    input: '#141720',
  },
  radius: 12,
};

/** Shared layout and interaction tokens for the Foster Performance UI. */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const typography = {
  caption: { fontSize: 11, lineHeight: 15, fontFamily: 'Inter_500Medium' },
  bodySmall: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  body: { fontSize: 15, lineHeight: 21, fontFamily: 'Inter_400Regular' },
  label: { fontSize: 14, lineHeight: 18, fontFamily: 'Inter_600SemiBold' },
  title: { fontSize: 20, lineHeight: 26, fontFamily: 'Inter_700Bold' },
  hero: { fontSize: 28, lineHeight: 34, fontFamily: 'Inter_700Bold' },
} as const;

export const controls = {
  buttonHeight: 52,
  compactButtonHeight: 44,
  inputHeight: 52,
  minimumTouchTarget: 44,
  iconSmall: 16,
  iconMedium: 20,
  iconLarge: 24,
} as const;

export const motion = {
  fast: 120,
  standard: 200,
  deliberate: 280,
} as const;

export default colors;
