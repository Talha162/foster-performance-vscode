import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useApp } from '@/context/AppContext';

const PART_COLORS: Record<string, string> = {
  'Lower Back': '#2F80FF',
  Shoulder: '#2196F3',
  Knee: '#4CAF50',
  Hip: '#FF9800',
};

export default function RehabScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { rehabPrograms } = useApp();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={styles.root}>
      <BackgroundLayer />
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Injury Rehab</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>Evidence-based recovery protocols</Text>
        </View>
      </View>

      {/* Banner */}
      <View style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="shield-plus" size={22} color={colors.primary} />
        <Text style={[styles.bannerText, { color: colors.mutedForeground }]}>
          Always consult a physician before starting a rehab program
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === 'web' ? 50 : 40 }]}>
        <Pressable onPress={() => router.push('/rehab-intake' as any)} accessibilityRole="button" accessibilityLabel="Start rehabilitation safety intake" style={[styles.intakeButton, { backgroundColor: colors.primary }]}><MaterialCommunityIcons name="clipboard-pulse-outline" size={20} color="#FFF" /><View style={{ flex: 1 }}><Text style={styles.intakeTitle}>Start safety intake</Text><Text style={styles.intakeSub}>Area, acknowledgement, warning, and protocol preview</Text></View><Feather name="chevron-right" size={20} color="#FFF" /></Pressable>
        {rehabPrograms.map((program) => {
          const accent = PART_COLORS[program.bodyPart] ?? colors.primary;
          return (
            <Pressable
              key={program.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <View style={[styles.cardColorBar, { backgroundColor: accent }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <View>
                    <View style={[styles.bodyPartBadge, { backgroundColor: accent + '22' }]}>
                      <MaterialCommunityIcons name="bandage" size={12} color={accent} />
                      <Text style={[styles.bodyPartText, { color: accent }]}>{program.bodyPart}</Text>
                    </View>
                    <Text style={[styles.cardTitle, { color: colors.foreground }]}>{program.title}</Text>
                  </View>
                  <View style={[styles.phasesBadge, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.phasesText, { color: colors.mutedForeground }]}>{program.phases} phases</Text>
                  </View>
                </View>
                <Text style={[styles.cardDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                  {program.description}
                </Text>
                <View style={styles.cardMeta}>
                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons name="clock-outline" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{program.duration}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons name="dumbbell" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{program.exercises.length} exercises</Text>
                  </View>
                </View>
                {/* Exercise preview */}
                <View style={styles.exercisePreview}>
                  {program.exercises.slice(0, 3).map((ex) => (
                    <View key={ex.id} style={styles.exItem}>
                      <View style={[styles.exDot, { backgroundColor: accent }]} />
                      <Text style={[styles.exName, { color: colors.foreground }]}>{ex.name}</Text>
                      <Text style={[styles.exSets, { color: colors.mutedForeground }]}>{ex.sets}x{ex.reps}</Text>
                    </View>
                  ))}
                  {program.exercises.length > 3 && (
                    <Text style={[styles.moreText, { color: colors.mutedForeground }]}>
                      +{program.exercises.length - 3} more exercises
                    </Text>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, marginBottom: 0, borderRadius: 12, padding: 12, borderWidth: 1 },
  bannerText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  content: { padding: 16 },
  card: { flexDirection: 'row', borderRadius: 14, overflow: 'hidden', borderWidth: 1, marginBottom: 12 },
  cardColorBar: { width: 5 },
  cardBody: { flex: 1, padding: 14, gap: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bodyPartBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 4, alignSelf: 'flex-start' },
  bodyPartText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  cardTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  phasesBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  phasesText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  cardDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  cardMeta: { flexDirection: 'row', gap: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  exercisePreview: { gap: 5, paddingTop: 4 },
  exItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exDot: { width: 6, height: 6, borderRadius: 3 },
  exName: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium' },
  exSets: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  moreText: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  intakeButton: { minHeight: 68, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12 }, intakeTitle: { color: '#FFF', fontSize: 14, fontFamily: 'Inter_700Bold' }, intakeSub: { color: '#DDE9FF', fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
});
