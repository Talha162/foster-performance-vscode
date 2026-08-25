import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';

type ScreenStateProps = {
  icon?: string;
  title: string;
  message: string;
  loading?: boolean;
  onBack?: () => void;
  actionLabel?: string;
  onAction?: () => void;
};

export function ScreenState({
  icon = 'alert-circle-outline',
  title,
  message,
  loading = false,
  onBack,
  actionLabel,
  onAction,
}: ScreenStateProps) {
  const colors = useColors();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <BackgroundLayer />
      {onBack && (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.back}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
      )}
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
            <MaterialCommunityIcons name={icon as any} size={34} color={colors.primary} />
          </View>
        )}
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.message, { color: colors.mutedForeground }]}>{message}</Text>
        {actionLabel && onAction && (
          <Pressable
            onPress={onAction}
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={[styles.actionText, { color: colors.primaryForeground }]}>{actionLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  back: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  iconWrap: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 19, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  message: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20, textAlign: 'center', maxWidth: 320 },
  action: { minHeight: 46, paddingHorizontal: 22, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  actionText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
});