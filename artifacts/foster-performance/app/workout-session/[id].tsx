import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useApp, Exercise } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { AppButton } from '@/components/AppButton';
import { MockNotice, PageHeader, SectionCard, StatusPill } from '@/components/ProductUI';
import { ScreenState } from '@/components/ScreenState';
import { TargetMuscleAvatar } from '@/components/TargetMuscleAvatar';
import { radii, spacing, typography } from '@/constants/colors';

type SetLog = { reps: string; weight: string; done: boolean };
type ExerciseLogs = Record<string, SetLog[]>;

const alternatives: Record<string, string[]> = {
  Chest: ['Incline Push-Up', 'Dumbbell Floor Press', 'Band Chest Press'],
  Back: ['Band Row', 'One-Arm Dumbbell Row', 'Inverted Row'],
  Quads: ['Goblet Squat', 'Reverse Lunge', 'Step-Up'],
  Glutes: ['Hip Thrust', 'Glute Bridge', 'Cable Pull-Through'],
  Hamstrings: ['Good Morning', 'Stability-Ball Curl', 'Single-Leg RDL'],
  Shoulders: ['Landmine Press', 'Pike Push-Up', 'Band Lateral Raise'],
  Core: ['Dead Bug', 'Pallof Press', 'Plank'],
};

function initialLogs(exercises: Exercise[]): ExerciseLogs {
  return Object.fromEntries(exercises.map((exercise) => [exercise.id, Array.from({ length: Math.max(1, exercise.sets) }, () => ({ reps: '', weight: '', done: false }))]));
}

export default function WorkoutSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workoutPrograms, setActiveWorkout, logWorkout } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const program = workoutPrograms.find((item) => item.id === id);
  const exercises = program?.exercises ?? [];
  const [index, setIndex] = useState(0);
  const [logs, setLogs] = useState<ExerciseLogs>(() => initialLogs(exercises));
  const [paused, setPaused] = useState(false);
  const [rest, setRest] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [showExercise, setShowExercise] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const [complete, setComplete] = useState(false);
  const [replacement, setReplacement] = useState<Record<string, string>>({});

  useEffect(() => {
    if (paused || complete) return;
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [paused, complete]);

  useEffect(() => {
    if (paused || rest <= 0) return;
    const timer = setInterval(() => setRest((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [paused, rest]);

  const exercise = exercises[index];
  const currentLogs = exercise ? logs[exercise.id] ?? [] : [];
  const completedSets = Object.values(logs).flat().filter((set) => set.done).length;
  const totalSets = Object.values(logs).flat().length;
  const progress = totalSets ? completedSets / totalSets : 0;
  const duration = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const suggestions = useMemo(() => {
    const group = exercise?.muscleGroup ?? '';
    const key = Object.keys(alternatives).find((name) => group.toLowerCase().includes(name.toLowerCase()));
    return alternatives[key ?? 'Core'];
  }, [exercise]);

  if (!program || !exercise) return <ScreenState title="Workout unavailable" message="This workout session could not be prepared." onBack={() => router.back()} />;

  const updateSet = (setIndex: number, changes: Partial<SetLog>) => {
    setLogs((previous) => ({ ...previous, [exercise.id]: previous[exercise.id].map((set, i) => i === setIndex ? { ...set, ...changes } : set) }));
  };

  const toggleSet = (setIndex: number) => {
    const set = currentLogs[setIndex];
    if (!set.done && !set.reps.trim()) {
      Alert.alert('Reps required', 'Enter completed reps before marking this set complete.');
      return;
    }
    updateSet(setIndex, { done: !set.done });
    if (!set.done) { setRest(60); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
  };

  const addSet = () => setLogs((previous) => ({ ...previous, [exercise.id]: [...previous[exercise.id], { reps: '', weight: '', done: false }] }));
  const removeSet = (setIndex: number) => {
    if (currentLogs.length <= 1) return;
    setLogs((previous) => ({ ...previous, [exercise.id]: previous[exercise.id].filter((_, i) => i !== setIndex) }));
  };

  const finish = () => {
    if (!complete) {
      logWorkout(program.id);
      setActiveWorkout(program.id);
      setComplete(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  if (complete) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 40 : insets.top }]}>
        <BackgroundLayer />
        <ScrollView contentContainerStyle={[styles.completion, { paddingBottom: insets.bottom + 24 }]}>
          <View style={[styles.completeIcon, { backgroundColor: colors.success + '22' }]}><MaterialCommunityIcons name="trophy-outline" size={48} color={colors.success} /></View>
          <Text style={[styles.completeTitle, { color: colors.foreground }]}>Workout Complete</Text>
          <Text style={[styles.completeSub, { color: colors.mutedForeground }]}>You finished {program.title}. Great consistency—your completed session has been logged on this device.</Text>
          <View style={styles.summaryGrid}>
            {[['Duration', duration], ['Exercises', String(exercises.length)], ['Sets', `${completedSets}/${totalSets}`], ['Status', 'Completed']].map(([label, value]) => (
              <View key={label} style={[styles.summaryTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.summaryValue, { color: colors.foreground }]}>{value}</Text><Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{label}</Text>
              </View>
            ))}
          </View>
          <MockNotice>Points and streak rewards are previewed here; synchronized awarding will be connected in Milestone 2.</MockNotice>
          <AppButton label="Done" icon="check" onPress={() => router.replace('/(tabs)')} />
          <AppButton label="View Program" variant="secondary" onPress={() => router.replace(`/workout/${program.id}`)} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 40 : insets.top }]}>
      <BackgroundLayer />
      <PageHeader title={program.title} subtitle={`Exercise ${index + 1} of ${exercises.length} · ${duration}`} right={<StatusPill label={paused ? 'Paused' : 'In progress'} tone={paused ? 'warning' : 'success'} />} />
      <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}><View style={[styles.progressFill, { backgroundColor: program.imageColor, width: `${Math.max(4, progress * 100)}%` }]} /></View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 130 }]} keyboardShouldPersistTaps="handled">
        <SectionCard>
          <View style={styles.exerciseHero}>
            <TargetMuscleAvatar muscleGroup={exercise.muscleGroup} size={84} accent={program.imageColor} />
            <View style={styles.exerciseCopy}>
              <Text style={[styles.eyebrow, { color: program.imageColor }]}>CURRENT EXERCISE</Text>
              <Text style={[styles.exerciseName, { color: colors.foreground }]}>{replacement[exercise.id] ?? exercise.name}</Text>
              <Text style={[styles.exerciseMeta, { color: colors.mutedForeground }]}>{exercise.muscleGroup} · {exercise.rest} rest</Text>
              <View style={styles.heroActions}>
                <Pressable onPress={() => setShowExercise(true)} style={[styles.smallAction, { borderColor: colors.border }]} accessibilityRole="button"><Text style={[styles.smallActionText, { color: colors.foreground }]}>Details</Text></Pressable>
                <Pressable onPress={() => setShowSwap(true)} style={[styles.smallAction, { borderColor: colors.border }]} accessibilityRole="button"><Text style={[styles.smallActionText, { color: colors.foreground }]}>Substitute</Text></Pressable>
              </View>
            </View>
          </View>
        </SectionCard>

        <SectionCard title="Set Log" subtitle="Previous performance will appear here after synchronized workout history is connected.">
          <View style={styles.setHeader}><Text style={[styles.colSet, { color: colors.mutedForeground }]}>SET</Text><Text style={[styles.colInput, { color: colors.mutedForeground }]}>REPS</Text><Text style={[styles.colInput, { color: colors.mutedForeground }]}>WEIGHT</Text><View style={styles.colDone} /></View>
          {currentLogs.map((set, setIndex) => (
            <View key={setIndex} style={[styles.setRow, set.done && { backgroundColor: colors.success + '0D' }]}>
              <Text style={[styles.setNumber, { color: colors.foreground }]}>{setIndex + 1}</Text>
              <TextInput value={set.reps} onChangeText={(reps) => updateSet(setIndex, { reps })} placeholder={exercise.reps} placeholderTextColor={colors.mutedForeground} keyboardType="numeric" style={[styles.setInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]} accessibilityLabel={`Set ${setIndex + 1} reps`} />
              <TextInput value={set.weight} onChangeText={(weight) => updateSet(setIndex, { weight })} placeholder={exercise.weight ?? 'Body'} placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" style={[styles.setInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]} accessibilityLabel={`Set ${setIndex + 1} weight`} />
              <Pressable onPress={() => toggleSet(setIndex)} onLongPress={() => removeSet(setIndex)} style={[styles.doneButton, { backgroundColor: set.done ? colors.success : colors.muted, borderColor: set.done ? colors.success : colors.border }]} accessibilityRole="checkbox" accessibilityState={{ checked: set.done }} accessibilityLabel={`Set ${setIndex + 1} complete`} accessibilityHint="Long press to remove this set">
                <Feather name="check" size={18} color={set.done ? '#FFF' : colors.mutedForeground} />
              </Pressable>
            </View>
          ))}
          <Pressable onPress={addSet} style={styles.addSet} accessibilityRole="button"><Feather name="plus" size={18} color={colors.primary} /><Text style={[styles.addSetText, { color: colors.primary }]}>Add Set</Text></Pressable>
        </SectionCard>

        {rest > 0 && <SectionCard title="Rest Timer"><View style={styles.timerRow}><Text style={[styles.timer, { color: colors.primary }]}>{Math.floor(rest / 60)}:{String(rest % 60).padStart(2, '0')}</Text><Pressable onPress={() => setRest((v) => v + 30)} style={[styles.timerAction, { borderColor: colors.border }]}><Text style={{ color: colors.foreground }}>+30s</Text></Pressable><Pressable onPress={() => setRest(0)} style={[styles.timerAction, { borderColor: colors.border }]}><Text style={{ color: colors.foreground }}>Skip</Text></Pressable></View></SectionCard>}

        <View style={styles.navRow}>
          <AppButton label="Previous" variant="secondary" icon="chevron-left" disabled={index === 0} onPress={() => setIndex((value) => Math.max(0, value - 1))} style={{ flex: 1 }} />
          <AppButton label={index === exercises.length - 1 ? 'Finish' : 'Next'} icon={index === exercises.length - 1 ? 'flag' : 'chevron-right'} onPress={() => index === exercises.length - 1 ? finish() : setIndex((value) => value + 1)} style={{ flex: 1 }} />
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 10 }]}>
        <Pressable onPress={() => setPaused((value) => !value)} style={[styles.control, { borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel={paused ? 'Resume workout' : 'Pause workout'}><Feather name={paused ? 'play' : 'pause'} size={20} color={colors.foreground} /><Text style={[styles.controlText, { color: colors.foreground }]}>{paused ? 'Resume' : 'Pause'}</Text></Pressable>
        <Text style={[styles.bottomProgress, { color: colors.mutedForeground }]}>{completedSets} of {totalSets} sets</Text>
        <Pressable onPress={() => Alert.alert('Finish workout?', 'You can finish now or continue logging sets.', [{ text: 'Continue', style: 'cancel' }, { text: 'Finish', onPress: finish }])} style={[styles.control, { borderColor: colors.destructive + '66' }]} accessibilityRole="button"><Feather name="square" size={18} color={colors.destructive} /><Text style={[styles.controlText, { color: colors.destructive }]}>Finish</Text></Pressable>
      </View>

      <Modal visible={showExercise} transparent animationType="slide" onRequestClose={() => setShowExercise(false)}><Pressable style={styles.overlay} onPress={() => setShowExercise(false)}><View style={[styles.sheet, { backgroundColor: colors.card }]} onStartShouldSetResponder={() => true}><TargetMuscleAvatar muscleGroup={exercise.muscleGroup} size={90} accent={program.imageColor} /><Text style={[styles.sheetTitle, { color: colors.foreground }]}>{replacement[exercise.id] ?? exercise.name}</Text><Text style={[styles.sheetBody, { color: colors.mutedForeground }]}>Target: {exercise.muscleGroup}{'\n'}Equipment/load: {exercise.weight ?? 'Bodyweight or available equipment'}{'\n'}Prescription: {exercise.sets} sets · {exercise.reps}{'\n'}Rest: {exercise.rest}</Text><Text style={[styles.sheetBody, { color: colors.foreground }]}>{exercise.notes ?? 'Move through a controlled range of motion. Stop if you feel sharp pain and ask a qualified professional for guidance.'}</Text><View style={[styles.mediaPlaceholder, { backgroundColor: colors.muted }]}><MaterialCommunityIcons name="play-box-outline" size={32} color={colors.mutedForeground} /><Text style={{ color: colors.mutedForeground }}>Exercise media placeholder</Text></View><AppButton label="Close" onPress={() => setShowExercise(false)} /></View></Pressable></Modal>

      <Modal visible={showSwap} transparent animationType="slide" onRequestClose={() => setShowSwap(false)}><Pressable style={styles.overlay} onPress={() => setShowSwap(false)}><View style={[styles.sheet, { backgroundColor: colors.card }]} onStartShouldSetResponder={() => true}><Text style={[styles.sheetTitle, { color: colors.foreground }]}>Substitute Exercise</Text><Text style={[styles.sheetBody, { color: colors.mutedForeground }]}>Alternatives target a similar area. Confirm equipment and suitability before replacing.</Text>{suggestions.map((name) => <Pressable key={name} onPress={() => { setReplacement((value) => ({ ...value, [exercise.id]: name })); setShowSwap(false); }} style={[styles.swapRow, { borderColor: colors.border }]} accessibilityRole="button"><View><Text style={[styles.swapName, { color: colors.foreground }]}>{name}</Text><Text style={[styles.swapMeta, { color: colors.mutedForeground }]}>{exercise.muscleGroup} · equipment varies</Text></View><Feather name="repeat" size={18} color={colors.primary} /></Pressable>)}<AppButton label="Keep Current Exercise" variant="secondary" onPress={() => setShowSwap(false)} /></View></Pressable></Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 }, progressTrack: { height: 4 }, progressFill: { height: 4 }, content: { padding: spacing.md, gap: spacing.md },
  exerciseHero: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' }, exerciseCopy: { flex: 1, gap: 4 }, eyebrow: { ...typography.caption, fontFamily: 'Inter_700Bold' }, exerciseName: { ...typography.title }, exerciseMeta: { ...typography.bodySmall },
  heroActions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs }, smallAction: { minHeight: 36, borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: spacing.sm, justifyContent: 'center' }, smallActionText: { ...typography.caption },
  setHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }, colSet: { width: 38, ...typography.caption }, colInput: { flex: 1, textAlign: 'center', ...typography.caption }, colDone: { width: 44 },
  setRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radii.md, paddingHorizontal: 4 }, setNumber: { width: 30, textAlign: 'center', ...typography.label },
  setInput: { flex: 1, minWidth: 0, height: 44, borderWidth: 1, borderRadius: radii.sm, textAlign: 'center', ...typography.bodySmall }, doneButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  addSet: { minHeight: 44, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }, addSetText: { ...typography.label },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, timer: { flex: 1, fontSize: 36, fontFamily: 'Inter_700Bold' }, timerAction: { minWidth: 58, height: 44, borderWidth: 1, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  navRow: { flexDirection: 'row', gap: spacing.sm }, bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 76, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, gap: spacing.sm },
  control: { minWidth: 80, minHeight: 46, borderWidth: 1, borderRadius: radii.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, controlText: { ...typography.caption }, bottomProgress: { ...typography.caption },
  completion: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }, completeIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }, completeTitle: { ...typography.hero, textAlign: 'center' }, completeSub: { ...typography.body, textAlign: 'center' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, summaryTile: { width: '48%', flexGrow: 1, borderWidth: 1, borderRadius: radii.lg, padding: spacing.md, alignItems: 'center' }, summaryValue: { ...typography.title }, summaryLabel: { ...typography.caption },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' }, sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, paddingBottom: 36, gap: spacing.md }, sheetTitle: { ...typography.title }, sheetBody: { ...typography.bodySmall, lineHeight: 20 },
  mediaPlaceholder: { minHeight: 100, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', gap: 6 }, swapRow: { minHeight: 64, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, swapName: { ...typography.label }, swapMeta: { ...typography.caption, marginTop: 2 },
});
