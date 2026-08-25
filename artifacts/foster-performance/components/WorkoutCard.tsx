import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { WorkoutProgram } from '@/context/AppContext';

interface WorkoutCardProps {
  program: WorkoutProgram;
  isActive?: boolean;
  onPress: () => void;
}

export function WorkoutCard({ program, isActive, onPress }: WorkoutCardProps) {
  const colors = useColors();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

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
      <View style={[styles.colorBar, { backgroundColor: program.imageColor }]} />
      <View style={styles.body}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
              {program.title}
            </Text>
            {program.isPremium && (
              <View style={[styles.premiumBadge, { backgroundColor: colors.accent }]}>
                <MaterialCommunityIcons name="crown" size={10} color={colors.accentForeground} />
              </View>
            )}
          </View>
          <View style={[styles.levelBadge, { backgroundColor: colors.muted }]}>
            <Text style={[styles.levelText, { color: colors.mutedForeground }]}>{program.level}</Text>
          </View>
        </View>
        <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={2}>
          {program.description}
        </Text>
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="calendar-range" size={12} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{program.weeks}w</Text>
          </View>
          <View style={styles.metaDot} />
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="lightning-bolt" size={12} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{program.daysPerWeek}x/wk</Text>
          </View>
          <View style={styles.metaDot} />
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="dumbbell" size={12} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{program.category}</Text>
          </View>
        </View>
        {isActive && (
          <View style={[styles.activePill, { backgroundColor: colors.primary }]}>
            <MaterialCommunityIcons name="play-circle" size={10} color={colors.primaryForeground} />
            <Text style={[styles.activeText, { color: colors.primaryForeground }]}>Active Program</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    flexDirection: 'row',
  },
  colorBar: {
    width: 5,
  },
  body: {
    flex: 1,
    padding: 14,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    flex: 1,
  },
  premiumBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  levelText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  description: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#2A3040',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 2,
  },
  activeText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
});
