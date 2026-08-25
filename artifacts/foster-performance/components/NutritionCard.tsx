import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { NutritionPlan } from '@/context/AppContext';

interface NutritionCardProps {
  plan: NutritionPlan;
  isActive?: boolean;
  onPress: () => void;
}

function MacroBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = Math.min((value / total) * 100, 100);
  const colors = useColors();
  return (
    <View style={styles.macroRow}>
      <Text style={[styles.macroLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.macroBarBg, { backgroundColor: colors.muted }]}>
        <View style={[styles.macroBarFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.macroValue, { color: colors.foreground }]}>{value}g</Text>
    </View>
  );
}

export function NutritionCard({ plan, isActive, onPress }: NutritionCardProps) {
  const colors = useColors();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const totalMacros = plan.protein + plan.carbs + plan.fat;

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isActive ? colors.primary : colors.border,
          borderWidth: isActive ? 2 : 1,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>{plan.title}</Text>
          {plan.isPremium && (
            <MaterialCommunityIcons name="crown" size={14} color={colors.accent} />
          )}
        </View>
        <View style={[styles.calBadge, { backgroundColor: colors.primary }]}>
          <Text style={[styles.calText, { color: colors.primaryForeground }]}>{plan.dailyCalories}</Text>
          <Text style={[styles.calLabel, { color: colors.primaryForeground }]}>kcal</Text>
        </View>
      </View>
      <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={2}>
        {plan.description}
      </Text>
      <View style={[styles.goalBadge, { backgroundColor: colors.muted }]}>
        <Text style={[styles.goalText, { color: colors.mutedForeground }]}>{plan.goal}</Text>
      </View>
      <View style={styles.macros}>
        <MacroBar label="Protein" value={plan.protein} total={totalMacros} color={colors.primary} />
        <MacroBar label="Carbs" value={plan.carbs} total={totalMacros} color={colors.accent} />
        <MacroBar label="Fat" value={plan.fat} total={totalMacros} color={colors.mutedForeground} />
      </View>
      {isActive && (
        <View style={[styles.activePill, { backgroundColor: colors.primary }]}>
          <MaterialCommunityIcons name="check-circle" size={10} color={colors.primaryForeground} />
          <Text style={[styles.activeText, { color: colors.primaryForeground }]}>Active Plan</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 10,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  calBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  calText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    lineHeight: 18,
  },
  calLabel: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    lineHeight: 12,
  },
  description: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  goalBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  goalText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  macros: {
    gap: 5,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  macroLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    width: 52,
  },
  macroBarBg: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  macroBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  macroValue: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    width: 34,
    textAlign: 'right',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
});
