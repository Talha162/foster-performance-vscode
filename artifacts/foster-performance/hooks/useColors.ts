import colors from '@/constants/colors';

/**
 * Returns the design tokens for the current color scheme.
 *
 * Foster Performance is a dark-first app. The dark palette is always
 * used regardless of the device or browser's system-level preference,
 * so the deep-black / electric-blue / gold look is consistent everywhere.
 */
export function useColors() {
  const palette = 'dark' in colors
    ? (colors as unknown as Record<string, typeof colors.light>).dark
    : (colors as any).light;
  return { ...palette, radius: colors.radius };
}
