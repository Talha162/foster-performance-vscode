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
import { useFPScore, HealthMetric } from '@/context/FPScoreContext';

// ─── Score arc ────────────────────────────────────────────────────────────────

function ScoreArc({ score, size = 160 }: { score: number; size?: number }) {
  const colors = useColors();
  const color =
    score >= 80 ? colors.success :
    score >= 60 ? colors.primary :
    score >= 40 ? colors.accent : '#9AA3B5';
  const label =
    score >= 80 ? 'Excellent' :
    score >= 60 ? 'Good' :
    score >= 40 ? 'Fair' : 'Getting Started';

  return (
    <View style={[styles.scoreArcWrap, { width: size, height: size }]}>
      <View style={[styles.scoreArcOuter, { width: size, height: size, borderRadius: size / 2, borderColor: color + '30' }]}>
        <View style={[styles.scoreArcInner, { borderColor: color, width: size - 16, height: size - 16, borderRadius: (size - 16) / 2, backgroundColor: colors.card }]}>
          <Text style={[styles.scoreNum, { color, fontSize: size * 0.28 }]}>{score}</Text>
          <Text style={[styles.scoreLabel, { color: colors.mutedForeground }]}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Breakdown bar ────────────────────────────────────────────────────────────

function BreakdownBar({ label, value, color }: { label: string; value: number; color: string }) {
  const colors = useColors();
  return (
    <View style={styles.breakdownRow}>
      <Text style={[styles.breakdownLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.barBg, { backgroundColor: colors.muted }]}>
        <View style={[styles.barFill, { width: `${value}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.breakdownValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

// ─── Metric field ─────────────────────────────────────────────────────────────

function MetricField({
  label, field, unit, keyboard, value, onChange,
}: {
  label: string; field: string; unit: string; keyboard?: 'decimal-pad' | 'number-pad';
  value: string; onChange: (v: string) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.metricField}>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.metricInputWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <TextInput
          style={[styles.metricInput, { color: colors.foreground }]}
          placeholder="—"
          placeholderTextColor={colors.mutedForeground}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboard ?? 'decimal-pad'}
        />
        <Text style={[styles.metricUnit, { color: colors.mutedForeground }]}>{unit}</Text>
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function FPScoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { scoreHistory, currentScore, addMetric } = useFPScore();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const [showModal, setShowModal] = useState(false);

  // Form fields
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [waist, setWaist] = useState('');
  const [rhr, setRhr] = useState('');
  const [steps, setSteps] = useState('');
  const [water, setWater] = useState('');
  const [sleep, setSleep] = useState('');
  const [recovery, setRecovery] = useState('');
  const [consistency, setConsistency] = useState('');
  const [saving, setSaving] = useState(false);

  const latestEntry = scoreHistory[0];
  const score = currentScore ?? 0;

  const breakdownColor = (v: number) =>
    v >= 80 ? colors.success : v >= 60 ? colors.primary : v >= 40 ? colors.accent : '#607D8B';

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    try {
      const metric: Omit<HealthMetric, 'id' | 'date'> = {
        weight: weight ? parseFloat(weight) : undefined,
        bodyFatPct: bodyFat ? parseFloat(bodyFat) : undefined,
        waistMeasurement: waist ? parseFloat(waist) : undefined,
        restingHeartRate: rhr ? parseInt(rhr) : undefined,
        dailySteps: steps ? parseInt(steps) : undefined,
        waterIntake: water ? parseFloat(water) : undefined,
        sleepDuration: sleep ? parseFloat(sleep) : undefined,
        recoveryScore: recovery ? Math.min(100, Math.max(0, parseFloat(recovery))) : undefined,
        workoutConsistency: consistency ? Math.min(100, Math.max(0, parseFloat(consistency))) : undefined,
      };
      await addMetric(metric);
      setShowModal(false);
      // Reset form
      setWeight(''); setBodyFat(''); setWaist(''); setRhr('');
      setSteps(''); setWater(''); setSleep(''); setRecovery(''); setConsistency('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <BackgroundLayer />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>FP Score</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Foster Performance Score</Text>
        </View>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowModal(true); }}
          style={({ pressed }) => [styles.logBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
        >
          <Feather name="plus" size={16} color={colors.primaryForeground} />
          <Text style={[styles.logBtnText, { color: colors.primaryForeground }]}>Log</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 100 }]}
      >
        {/* Score card */}
        <View style={[styles.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.scoreCardTop}>
            <View>
              <Text style={[styles.scoreCardTitle, { color: colors.foreground }]}>Your FP Score</Text>
              <Text style={[styles.scoreCardSub, { color: colors.mutedForeground }]}>
                {latestEntry ? `Updated ${latestEntry.date}` : 'Log your first metrics to get started'}
              </Text>
            </View>
            {score > 0 && (
              <View style={[styles.trendChip, { backgroundColor: colors.success + '22' }]}>
                <MaterialCommunityIcons name="trending-up" size={12} color={colors.success} />
                <Text style={[styles.trendText, { color: colors.success }]}>Improving</Text>
              </View>
            )}
          </View>

          <View style={styles.scoreArcRow}>
            <ScoreArc score={score} size={160} />
            <View style={styles.scoreRightCol}>
              <Text style={[styles.scoreRightTitle, { color: colors.foreground }]}>What is the FP Score?</Text>
              <Text style={[styles.scoreRightDesc, { color: colors.mutedForeground }]}>
                A 0–100 composite score built from your workout consistency, sleep, hydration, recovery, cardiovascular fitness, strength, mobility, and body composition — all in one number.
              </Text>
              {score > 0 && (
                <View style={[styles.scorePill, {
                  backgroundColor: (score >= 80 ? colors.success : score >= 60 ? colors.primary : score >= 40 ? colors.accent : '#607D8B') + '22'
                }]}>
                  <Text style={[styles.scorePillText, {
                    color: score >= 80 ? colors.success : score >= 60 ? colors.primary : score >= 40 ? colors.accent : '#607D8B'
                  }]}>
                    {score >= 80 ? '🏆 Excellent work!' : score >= 60 ? '💪 Great progress!' : score >= 40 ? '📈 Building momentum' : '🌱 Let\'s get started!'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Breakdown */}
          {latestEntry?.breakdown && Object.keys(latestEntry.breakdown).length > 0 && (
            <View style={[styles.breakdown, { borderTopColor: colors.border }]}>
              <Text style={[styles.breakdownTitle, { color: colors.foreground }]}>Score Breakdown</Text>
              {Object.entries(latestEntry.breakdown).map(([key, val]) => (
                <BreakdownBar key={key} label={key} value={val} color={breakdownColor(val)} />
              ))}
            </View>
          )}
        </View>

        {/* Score history chart */}
        {scoreHistory.length > 1 && (
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.chartTitle, { color: colors.foreground }]}>Score History</Text>
            <Text style={[styles.chartSub, { color: colors.mutedForeground }]}>Last {Math.min(scoreHistory.length, 8)} entries</Text>
            <View style={styles.chartArea}>
              {scoreHistory.slice(0, 8).reverse().map((entry, i, arr) => {
                const isLast = i === arr.length - 1;
                const barH = `${Math.max(entry.score, 8)}%`;
                const barColor = entry.score >= 80 ? colors.success : entry.score >= 60 ? colors.primary : entry.score >= 40 ? colors.accent : '#607D8B';
                return (
                  <View key={entry.id} style={styles.chartBarGroup}>
                    <View style={styles.chartBarWrapper}>
                      <View style={[styles.chartBar, { height: barH as any, backgroundColor: isLast ? barColor : barColor + '80' }]} />
                    </View>
                    <Text style={[styles.chartBarValue, { color: isLast ? colors.foreground : colors.mutedForeground }]}>
                      {entry.score}
                    </Text>
                    <Text style={[styles.chartBarDate, { color: colors.mutedForeground }]}>
                      {entry.date.slice(5)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Latest metrics snapshot */}
        {latestEntry?.metric && (
          <View style={[styles.snapshotCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.snapshotTitle, { color: colors.foreground }]}>Latest Metrics</Text>
            <View style={styles.snapshotGrid}>
              {[
                { label: 'Weight', value: latestEntry.metric.weight, unit: 'lbs', icon: 'scale-bathroom' },
                { label: 'Body Fat', value: latestEntry.metric.bodyFatPct, unit: '%', icon: 'human' },
                { label: 'Waist', value: latestEntry.metric.waistMeasurement, unit: 'in', icon: 'tape-measure' },
                { label: 'Resting HR', value: latestEntry.metric.restingHeartRate, unit: 'bpm', icon: 'heart-pulse' },
                { label: 'Daily Steps', value: latestEntry.metric.dailySteps?.toLocaleString(), unit: '', icon: 'walk' },
                { label: 'Water', value: latestEntry.metric.waterIntake, unit: 'oz', icon: 'water' },
                { label: 'Sleep', value: latestEntry.metric.sleepDuration, unit: 'hrs', icon: 'sleep' },
                { label: 'Recovery', value: latestEntry.metric.recoveryScore, unit: '/100', icon: 'battery-charging' },
              ].filter((m) => m.value !== undefined).map((m) => (
                <View key={m.label} style={[styles.snapshotItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <MaterialCommunityIcons name={m.icon as any} size={18} color={colors.primary} />
                  <Text style={[styles.snapshotValue, { color: colors.foreground }]}>
                    {m.value}{m.unit}
                  </Text>
                  <Text style={[styles.snapshotLabel, { color: colors.mutedForeground }]}>{m.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Empty state */}
        {scoreHistory.length === 0 && (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="chart-line" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Start Tracking</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Log your first health metrics to calculate your FP Score and start seeing your progress over time.
            </Text>
            <Pressable
              onPress={() => setShowModal(true)}
              style={({ pressed }) => [styles.emptyBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
            >
              <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>Log First Metrics</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Log Metrics Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setShowModal(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: botPad + 20 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Log Health Metrics</Text>
            <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
              Fill in any fields you have. Your FP Score will update automatically.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <Text style={[styles.sheetSection, { color: colors.mutedForeground }]}>BODY COMPOSITION</Text>
              <View style={styles.metricGrid}>
                <MetricField label="Weight" field="weight" unit="lbs" value={weight} onChange={setWeight} />
                <MetricField label="Body Fat" field="bodyFat" unit="%" value={bodyFat} onChange={setBodyFat} />
                <MetricField label="Waist" field="waist" unit="in" value={waist} onChange={setWaist} />
              </View>

              <Text style={[styles.sheetSection, { color: colors.mutedForeground }]}>VITALS</Text>
              <View style={styles.metricGrid}>
                <MetricField label="Resting HR" field="rhr" unit="bpm" keyboard="number-pad" value={rhr} onChange={setRhr} />
                <MetricField label="Daily Steps" field="steps" unit="steps" keyboard="number-pad" value={steps} onChange={setSteps} />
              </View>

              <Text style={[styles.sheetSection, { color: colors.mutedForeground }]}>DAILY HABITS</Text>
              <View style={styles.metricGrid}>
                <MetricField label="Water" field="water" unit="fl oz" value={water} onChange={setWater} />
                <MetricField label="Sleep" field="sleep" unit="hrs" value={sleep} onChange={setSleep} />
              </View>

              <Text style={[styles.sheetSection, { color: colors.mutedForeground }]}>FITNESS (0–100)</Text>
              <View style={styles.metricGrid}>
                <MetricField label="Recovery" field="recovery" unit="/100" keyboard="number-pad" value={recovery} onChange={setRecovery} />
                <MetricField label="Consistency" field="consistency" unit="/100" keyboard="number-pad" value={consistency} onChange={setConsistency} />
              </View>
              <View style={{ height: 8 }} />
            </ScrollView>

            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => [styles.saveBtn, { backgroundColor: colors.primary, opacity: pressed || saving ? 0.8 : 1 }]}
            >
              <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
                {saving ? 'Calculating…' : 'Calculate My FP Score'}
              </Text>
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
    flexDirection: 'row', alignItems: 'flex-end', gap: 12,
    paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1,
  },
  backBtn: { paddingBottom: 2 },
  headerTitle: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  logBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
  },
  logBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  content: { padding: 16, gap: 16 },

  // Score card
  scoreCard: { borderRadius: 18, borderWidth: 1, padding: 18, gap: 16 },
  scoreCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  scoreCardTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  scoreCardSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 3 },
  trendChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  trendText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  // Arc
  scoreArcRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  scoreArcWrap: { alignItems: 'center', justifyContent: 'center' },
  scoreArcOuter: { borderWidth: 8, alignItems: 'center', justifyContent: 'center' },
  scoreArcInner: { borderWidth: 4, alignItems: 'center', justifyContent: 'center', gap: 2 },
  scoreNum: { fontFamily: 'Inter_700Bold', lineHeight: undefined },
  scoreLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  scoreRightCol: { flex: 1, gap: 8 },
  scoreRightTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  scoreRightDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  scorePill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  scorePillText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  // Breakdown
  breakdown: { borderTopWidth: 1, paddingTop: 14, gap: 8 },
  breakdownTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breakdownLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', width: 120 },
  barBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  breakdownValue: { fontSize: 11, fontFamily: 'Inter_700Bold', width: 28, textAlign: 'right' },

  // Chart
  chartCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 4 },
  chartTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  chartSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 10 },
  chartArea: { flexDirection: 'row', height: 100, alignItems: 'flex-end', gap: 4 },
  chartBarGroup: { flex: 1, alignItems: 'center', gap: 3 },
  chartBarWrapper: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  chartBar: { width: '100%', borderRadius: 4, minHeight: 6 },
  chartBarValue: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  chartBarDate: { fontSize: 8, fontFamily: 'Inter_400Regular' },

  // Snapshot
  snapshotCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  snapshotTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  snapshotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  snapshotItem: {
    width: '47%', flexGrow: 1, borderRadius: 12, borderWidth: 1,
    padding: 12, alignItems: 'center', gap: 4,
  },
  snapshotValue: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  snapshotLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },

  // Empty
  empty: {
    borderRadius: 16, borderWidth: 1, padding: 28,
    alignItems: 'center', gap: 10, marginTop: 8,
  },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginTop: 4 },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 4 },
  emptyBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, padding: 20, gap: 12,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  sheetTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  sheetSub: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  sheetSection: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1, marginTop: 8, marginBottom: 4 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricField: { width: '47%', flexGrow: 1, gap: 4 },
  metricLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  metricInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, height: 42,
  },
  metricInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  metricUnit: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  saveBtn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  saveBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});
