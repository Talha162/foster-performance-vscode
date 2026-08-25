import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  accent?: boolean;
  icon?: React.ReactNode;
}

export function StatCard({ label, value, unit, accent, icon }: StatCardProps) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: accent ? colors.primary : colors.card,
          borderColor: accent ? colors.primary : colors.border,
        },
      ]}
    >
      {icon && <View style={styles.iconWrapper}>{icon}</View>}
      <Text style={[styles.value, { color: accent ? colors.primaryForeground : colors.foreground }]}>
        {value}
        {unit && (
          <Text style={[styles.unit, { color: accent ? colors.primaryForeground : colors.mutedForeground }]}>
            {' '}{unit}
          </Text>
        )}
      </Text>
      <Text style={[styles.label, { color: accent ? colors.primaryForeground : colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 4,
    alignItems: 'flex-start',
  },
  iconWrapper: {
    marginBottom: 4,
  },
  value: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    lineHeight: 30,
  },
  unit: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  label: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
});
