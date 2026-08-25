import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { Coach } from '@/context/AppContext';

interface CoachCardProps {
  coach: Coach;
  onPress: () => void;
  compact?: boolean;
}

export function CoachCard({ coach, onPress, compact }: CoachCardProps) {
  const colors = useColors();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  if (compact) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.compactCard,
          { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: coach.color }]}>
          <Text style={styles.initials}>{coach.initials}</Text>
        </View>
        <View style={styles.compactInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.compactName, { color: colors.foreground }]} numberOfLines={1}>{coach.name}</Text>
            {coach.isPremium && (
              <MaterialCommunityIcons name="crown" size={12} color={colors.accent} />
            )}
          </View>
          <Text style={[styles.specialty, { color: colors.mutedForeground }]} numberOfLines={1}>{coach.specialty}</Text>
        </View>
        <View style={styles.ratingRow}>
          <MaterialCommunityIcons name="star" size={12} color={colors.accent} />
          <Text style={[styles.rating, { color: colors.foreground }]}>{coach.rating}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.avatarLarge, { backgroundColor: coach.color }]}>
          <Text style={styles.initialsLarge}>{coach.initials}</Text>
        </View>
        <View style={styles.cardHeaderInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.foreground }]}>{coach.name}</Text>
            {coach.isPremium && (
              <View style={[styles.premiumTag, { backgroundColor: colors.accent }]}>
                <MaterialCommunityIcons name="crown" size={10} color={colors.accentForeground} />
                <Text style={[styles.premiumTagText, { color: colors.accentForeground }]}>PRO</Text>
              </View>
            )}
          </View>
          <Text style={[styles.specialty, { color: colors.primary }]}>{coach.specialty}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="star" size={12} color={colors.accent} />
              <Text style={[styles.statText, { color: colors.foreground }]}>{coach.rating}</Text>
            </View>
            <View style={[styles.dot, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Feather name="users" size={12} color={colors.mutedForeground} />
              <Text style={[styles.statText, { color: colors.foreground }]}>{coach.clients}</Text>
            </View>
            <View style={[styles.dot, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="briefcase-outline" size={12} color={colors.mutedForeground} />
              <Text style={[styles.statText, { color: colors.foreground }]}>{coach.experience}yr</Text>
            </View>
          </View>
        </View>
      </View>
      <Text style={[styles.bio, { color: colors.mutedForeground }]} numberOfLines={3}>{coach.bio}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  avatarLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsLarge: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  cardHeaderInfo: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  premiumTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  premiumTagText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  specialty: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  bio: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    gap: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  compactInfo: {
    flex: 1,
    gap: 2,
  },
  compactName: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  rating: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
});
