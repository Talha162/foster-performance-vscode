import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';

export function PremiumBanner() {
  const colors = useColors();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/subscription');
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.banner,
        { backgroundColor: colors.card, borderColor: colors.accent, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={[styles.crownBg, { backgroundColor: colors.accent }]}>
        <MaterialCommunityIcons name="crown" size={20} color={colors.accentForeground} />
      </View>
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: colors.accent }]}>Go Premium</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Unlock elite programs, pro coaches, and advanced analytics
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  crownBg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  sub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 16,
  },
});
