import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { controls, radii, spacing, typography } from '@/constants/colors';
import { useColors } from '@/hooks/useColors';

type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';

type AppButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  accessibilityHint?: string;
  style?: ViewStyle;
};

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  compact = false,
  accessibilityHint,
  style,
}: AppButtonProps) {
  const colors = useColors();
  const inactive = disabled || loading;
  const palette = {
    primary: { background: colors.primary, foreground: colors.primaryForeground, border: colors.primary },
    secondary: { background: colors.secondary, foreground: colors.secondaryForeground, border: colors.border },
    accent: { background: colors.accent, foreground: colors.accentForeground, border: colors.accent },
    danger: { background: colors.destructive, foreground: colors.destructiveForeground, border: colors.destructive },
    ghost: { background: 'transparent', foreground: colors.foreground, border: colors.border },
  }[variant];

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
          opacity: inactive ? 0.48 : pressed ? 0.78 : 1,
          transform: [{ scale: pressed && !inactive ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.foreground} />
      ) : (
        <>
          {icon && <MaterialCommunityIcons name={icon as any} size={controls.iconMedium} color={palette.foreground} />}
          <Text style={[styles.label, { color: palette.foreground }]} numberOfLines={1}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: controls.buttonHeight,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  compact: { minHeight: controls.compactButtonHeight },
  label: { ...typography.label },
});
