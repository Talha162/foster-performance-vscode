import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { controls, radii, spacing, typography } from '@/constants/colors';

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
        <Feather name="arrow-left" size={24} color={colors.foreground} />
      </Pressable>
      <View style={styles.headerCopy}>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        {!!subtitle && <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>}
      </View>
      {right ?? <View style={styles.back} />}
    </View>
  );
}

export function SectionCard({ children, title, subtitle }: { children: React.ReactNode; title?: string; subtitle?: string }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {!!title && <Text style={[styles.cardTitle, { color: colors.foreground }]}>{title}</Text>}
      {!!subtitle && <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>}
      {children}
    </View>
  );
}

export function StatusPill({ label, tone = 'info' }: { label: string; tone?: 'info' | 'success' | 'warning' | 'danger' | 'muted' }) {
  const colors = useColors();
  const color = { info: colors.primary, success: colors.success, warning: colors.accent, danger: colors.destructive, muted: colors.mutedForeground }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: color + '1F', borderColor: color + '55' }]} accessibilityLabel={`Status: ${label}`}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function InfoRow({ icon, label, value, onPress, danger = false }: { icon: string; label: string; value?: string; onPress?: () => void; danger?: boolean }) {
  const colors = useColors();
  const content = (
    <>
      <View style={[styles.rowIcon, { backgroundColor: (danger ? colors.destructive : colors.primary) + '18' }]}>
        <MaterialCommunityIcons name={icon as any} size={20} color={danger ? colors.destructive : colors.primary} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowLabel, { color: danger ? colors.destructive : colors.foreground }]}>{label}</Text>
        {!!value && <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text>}
      </View>
      {!!onPress && <Feather name="chevron-right" size={20} color={colors.mutedForeground} />}
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={value}>
      {content}
    </Pressable>
  ) : <View style={styles.row}>{content}</View>;
}

export function MockNotice({ children = 'Frontend preview — production service connection is scheduled for Milestone 2.' }: { children?: string }) {
  const colors = useColors();
  return (
    <View style={[styles.notice, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '44' }]}>
      <MaterialCommunityIcons name="flask-outline" size={18} color={colors.primary} />
      <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>{children}</Text>
    </View>
  );
}

export function SearchField(props: TextInputProps) {
  const colors = useColors();
  return (
    <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Feather name="search" size={18} color={colors.mutedForeground} />
      <TextInput {...props} style={[styles.searchInput, { color: colors.foreground }, props.style]} placeholderTextColor={colors.mutedForeground} returnKeyType="search" accessibilityLabel={props.accessibilityLabel ?? props.placeholder ?? 'Search'} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1 },
  back: { width: controls.minimumTouchTarget, height: controls.minimumTouchTarget, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 }, title: { ...typography.title, flexShrink: 1 }, subtitle: { ...typography.bodySmall, marginTop: 1 },
  card: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.md, gap: spacing.sm },
  cardTitle: { ...typography.label, fontSize: 16 }, cardSubtitle: { ...typography.bodySmall, marginTop: -6 },
  pill: { alignSelf: 'flex-start', borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  pillText: { ...typography.caption, fontFamily: 'Inter_700Bold' },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowIcon: { width: 40, height: 40, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1 }, rowLabel: { ...typography.label }, rowValue: { ...typography.bodySmall, marginTop: 2 },
  notice: { flexDirection: 'row', gap: spacing.sm, borderWidth: 1, borderRadius: radii.md, padding: spacing.sm, alignItems: 'flex-start' },
  noticeText: { ...typography.bodySmall, flex: 1 },
  search: { height: controls.inputHeight, borderWidth: 1, borderRadius: radii.md, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.sm },
  searchInput: { flex: 1, ...typography.body, paddingVertical: 0 },
});
