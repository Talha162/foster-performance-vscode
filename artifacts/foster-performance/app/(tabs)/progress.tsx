import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { StatCard } from '@/components/StatCard';
import { useFPScore } from '@/context/FPScoreContext';

export default function ProgressScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { progressEntries, addProgressEntry, workoutLogs } = useApp();
  const { user } = useAuth();
  const { currentScore, scoreHistory } = useFPScore();
  const [showModal, setShowModal] = useState(false);
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const latestWeight = progressEntries[0]?.weight ?? 0;
  const oldestWeight = progressEntries[progressEntries.length - 1]?.weight ?? 0;
  const weightChange = latestWeight - oldestWeight;

  const maxWeight = Math.max(...progressEntries.map((e) => e.weight), 1);
  const minWeight = Math.min(...progressEntries.map((e) => e.weight), 999);
  const range = Math.max(maxWeight - minWeight + 10, 20);

  const thisWeekLogs = workoutLogs.filter((l) => {
    const d = new Date(l.completedAt);
    const now = new Date();
    return now.getTime() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
  });

  const handleAdd = async () => {
    const w = parseFloat(weight);
    if (!w || w < 50 || w > 500) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await addProgressEntry({
      date: new Date().toISOString().split('T')[0],
      weight: w,
      workoutsThisWeek: thisWeekLogs.length,
      notes: notes.trim(),
    });
    setWeight('');
    setNotes('');
    setShowModal(false);
  };

  return (
    <View style={styles.root}>
      <BackgroundLayer />
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Progress</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowModal(true);
          }}
          style={({ pressed }) => [
            styles.addBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="plus" size={18} color={colors.primaryForeground} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === 'web' ? 100 : 100 }]}
      >
        {/* FP Score banner */}
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/fp-score'); }}
          style={({ pressed }) => [styles.fpScoreBanner, {
            backgroundColor: colors.card,
            borderColor: currentScore && currentScore >= 60 ? colors.primary : colors.border,
            opacity: pressed ? 0.88 : 1,
          }]}
        >
          <View style={[styles.fpScoreIconWrap, { backgroundColor: colors.primary + '20' }]}>
            <MaterialCommunityIcons name="chart-line" size={22} color={colors.primary} />
          </View>
          <View style={styles.fpScoreInfo}>
            <Text style={[styles.fpScoreLabel, { color: colors.mutedForeground }]}>FP SCORE</Text>
            <Text style={[styles.fpScoreValue, { color: colors.foreground }]}>
              {currentScore !== null ? currentScore : '—'}
            </Text>
            <Text style={[styles.fpScoreSub, { color: colors.mutedForeground }]}>
              {currentScore === null ? 'Tap to log your first metrics' :
               currentScore >= 80 ? 'Excellent — keep it up!' :
               currentScore >= 60 ? 'Good — keep pushing!' :
               currentScore >= 40 ? 'Building momentum' : 'Just getting started'}
            </Text>
          </View>
          <View style={styles.fpScoreRight}>
            {currentScore !== null && (
              <View style={[styles.fpScorePill, {
                backgroundColor: (currentScore >= 80 ? colors.success : currentScore >= 60 ? colors.primary : currentScore >= 40 ? colors.accent : '#607D8B') + '22',
              }]}>
                <Text style={[styles.fpScorePillText, {
                  color: currentScore >= 80 ? colors.success : currentScore >= 60 ? colors.primary : currentScore >= 40 ? colors.accent : '#607D8B',
                }]}>
                  {currentScore >= 80 ? 'EXCELLENT' : currentScore >= 60 ? 'GOOD' : currentScore >= 40 ? 'FAIR' : 'STARTING'}
                </Text>
              </View>
            )}
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </View>
        </Pressable>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard label="Current Weight" value={latestWeight} unit="lbs" />
          <StatCard
            label="Total Change"
            value={weightChange >= 0 ? `+${weightChange}` : `${weightChange}`}
            unit="lbs"
            accent={weightChange < 0}
          />
        </View>
        <View style={styles.statsRow}>
          <StatCard label="This Week" value={thisWeekLogs.length} unit="sessions" />
          <StatCard label="Total Workouts" value={workoutLogs.length + 14} accent />
        </View>

        {/* Weight Chart */}
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.chartTitle, { color: colors.foreground }]}>Weight Trend</Text>
          <Text style={[styles.chartSub, { color: colors.mutedForeground }]}>Last 6 entries</Text>
          <View style={styles.chartArea}>
            {progressEntries.slice(0, 6).reverse().map((entry, i, arr) => {
              const h = ((entry.weight - minWeight) / range) * 100 + 5;
              const isLast = i === arr.length - 1;
              return (
                <View key={entry.id} style={styles.chartBarGroup}>
                  <View style={styles.chartBarWrapper}>
                    <View
                      style={[
                        styles.chartBar,
                        {
                          height: `${h}%`,
                          backgroundColor: isLast ? colors.primary : colors.muted,
                          borderColor: isLast ? colors.primary : colors.border,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.chartBarLabel, { color: colors.mutedForeground }]}>
                    {entry.weight}
                  </Text>
                  <Text style={[styles.chartBarDate, { color: colors.mutedForeground }]}>
                    {entry.date.slice(5)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Progress Log */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Log History</Text>
          {progressEntries.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="scale" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Tap + to log your first entry
              </Text>
            </View>
          ) : (
            progressEntries.map((entry) => (
              <View
                key={entry.id}
                style={[styles.logItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.logDot, { backgroundColor: colors.primary }]} />
                <View style={styles.logInfo}>
                  <Text style={[styles.logDate, { color: colors.mutedForeground }]}>{entry.date}</Text>
                  {entry.notes ? (
                    <Text style={[styles.logNotes, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {entry.notes}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.logRight}>
                  <Text style={[styles.logWeight, { color: colors.foreground }]}>{entry.weight}</Text>
                  <Text style={[styles.logWeightUnit, { color: colors.mutedForeground }]}>lbs</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Log modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowModal(false)}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: botPad + 20 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Log Progress</Text>
            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Weight (lbs)</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                placeholder="185"
                placeholderTextColor={colors.mutedForeground}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Notes (optional)</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                placeholder="Feeling strong today..."
                placeholderTextColor={colors.mutedForeground}
                value={notes}
                onChangeText={setNotes}
              />
            </View>
            <Pressable
              onPress={handleAdd}
              style={({ pressed }) => [
                styles.modalBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.modalBtnText, { color: colors.primaryForeground }]}>Save Entry</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  addBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 16 },
  statsRow: { flexDirection: 'row', gap: 10 },
  chartCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 4,
  },
  chartTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  chartSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 12 },
  chartArea: { flexDirection: 'row', height: 120, alignItems: 'flex-end', gap: 6 },
  chartBarGroup: { flex: 1, alignItems: 'center', gap: 4 },
  chartBarWrapper: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  chartBar: { width: '100%', borderRadius: 4, borderWidth: 1, minHeight: 8 },
  chartBarLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  chartBarDate: { fontSize: 9, fontFamily: 'Inter_400Regular' },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 10 },
  empty: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  logDot: { width: 10, height: 10, borderRadius: 5 },
  logInfo: { flex: 1, gap: 2 },
  logDate: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  logNotes: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  logRight: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  logWeight: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  logWeightUnit: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  // FP Score banner
  fpScoreBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1.5, padding: 14,
  },
  fpScoreIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fpScoreInfo: { flex: 1, gap: 2 },
  fpScoreLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  fpScoreValue: { fontSize: 28, fontFamily: 'Inter_700Bold', lineHeight: 32 },
  fpScoreSub: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  fpScoreRight: { alignItems: 'flex-end', gap: 6 },
  fpScorePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  fpScorePillText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 24,
    gap: 16,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  modalField: { gap: 6 },
  modalLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  modalInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  modalBtn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  modalBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});
