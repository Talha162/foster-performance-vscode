/**
 * FP Score Context — Foster Performance Score
 *
 * Combines health & fitness metrics into a single 0–100 score.
 * The score calculation weights are designed to be admin-configurable
 * (stored in Supabase platform settings so they can be updated
 * via an admin push without requiring users to reinstall the app).
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HealthMetric {
  id: string;
  date: string;
  // Body composition
  weight?: number;              // lbs
  bodyFatPct?: number;          // %
  leanMuscleMass?: number;      // lbs
  waistMeasurement?: number;    // inches
  // Vitals
  restingHeartRate?: number;    // bpm
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  // Activity
  dailySteps?: number;
  caloriesBurned?: number;
  caloriesConsumed?: number;
  waterIntake?: number;         // fl oz
  // Recovery
  sleepDuration?: number;       // hours
  recoveryScore?: number;       // 0–100
  // Fitness
  workoutConsistency?: number;  // 0–100 (workouts done / target)
  strengthProgress?: number;    // 0–100
  cardioEndurance?: number;     // 0–100
  mobilityScore?: number;       // 0–100
  flexibilityScore?: number;    // 0–100
  balanceScore?: number;        // 0–100
}

export interface FPScoreWeights {
  workoutConsistency: number;
  sleepDuration: number;
  waterIntake: number;
  recoveryScore: number;
  cardioEndurance: number;
  strengthProgress: number;
  mobilityScore: number;
  bodyFatProgress: number;     // improvement over time
}

export interface FPScoreEntry {
  id: string;
  date: string;
  score: number;
  breakdown: Record<string, number>;
  metric: HealthMetric;
}

interface FPScoreContextType {
  metrics: HealthMetric[];
  scoreHistory: FPScoreEntry[];
  currentScore: number | null;
  weights: FPScoreWeights;
  addMetric: (m: Omit<HealthMetric, 'id' | 'date'>) => Promise<void>;
  updateWeights: (w: Partial<FPScoreWeights>) => Promise<void>;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS: FPScoreWeights = {
  workoutConsistency: 30,
  sleepDuration:      20,
  waterIntake:        10,
  recoveryScore:      15,
  cardioEndurance:    10,
  strengthProgress:   5,
  mobilityScore:      5,
  bodyFatProgress:    5,
};

// ─── Score calculation ────────────────────────────────────────────────────────

function calcScore(m: HealthMetric, w: FPScoreWeights, allMetrics: HealthMetric[]): { score: number; breakdown: Record<string, number> } {
  const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

  // Workout consistency: treat metric value as 0–100
  const consistency = clamp(m.workoutConsistency ?? 0);

  // Sleep: ideal is 7–9 hours → 100 pts; linear below 6 and above 9.5
  const sleepHrs = m.sleepDuration ?? 0;
  const sleepScore = sleepHrs >= 7 && sleepHrs <= 9
    ? 100
    : sleepHrs >= 6 ? 60 + (sleepHrs - 6) * 40
    : sleepHrs < 6 ? clamp((sleepHrs / 6) * 60)
    : clamp(100 - (sleepHrs - 9) * 20);

  // Water: 64 fl oz = baseline (50), 80 = 80, 100+ = 100
  const water = m.waterIntake ?? 0;
  const waterScore = clamp(water >= 100 ? 100 : water >= 80 ? 80 + (water - 80) : (water / 80) * 80);

  // Recovery: direct 0–100
  const recovery = clamp(m.recoveryScore ?? 0);

  // Cardio endurance: direct 0–100
  const cardio = clamp(m.cardioEndurance ?? 0);

  // Strength progress: direct 0–100
  const strength = clamp(m.strengthProgress ?? 0);

  // Mobility: direct 0–100
  const mobility = clamp(m.mobilityScore ?? 0);

  // Body fat progress: compare to earliest entry
  let bfProgress = 50; // neutral if no data
  if (m.bodyFatPct !== undefined && allMetrics.length > 1) {
    const oldest = [...allMetrics].sort((a, b) => a.date.localeCompare(b.date))[0];
    if (oldest.bodyFatPct !== undefined) {
      const delta = oldest.bodyFatPct - m.bodyFatPct; // positive = improved
      bfProgress = clamp(50 + delta * 5); // each 1% reduction = +5 pts
    }
  }

  const totalWeight = Object.values(w).reduce((s, v) => s + v, 0) || 100;
  const raw =
    (consistency   * w.workoutConsistency +
     sleepScore    * w.sleepDuration +
     waterScore    * w.waterIntake +
     recovery      * w.recoveryScore +
     cardio        * w.cardioEndurance +
     strength      * w.strengthProgress +
     mobility      * w.mobilityScore +
     bfProgress    * w.bodyFatProgress) / totalWeight;

  return {
    score: Math.round(clamp(raw)),
    breakdown: {
      'Workout Consistency': Math.round(consistency),
      'Sleep Quality':       Math.round(sleepScore),
      'Hydration':           Math.round(waterScore),
      'Recovery':            Math.round(recovery),
      'Cardiovascular':      Math.round(cardio),
      'Strength':            Math.round(strength),
      'Mobility':            Math.round(mobility),
      'Body Composition':    Math.round(bfProgress),
    },
  };
}

// ─── Context ─────────────────────────────────────────────────────────────────

const FPScoreContext = createContext<FPScoreContextType | null>(null);

export function FPScoreProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [scoreHistory, setScoreHistory] = useState<FPScoreEntry[]>([]);
  const [weights, setWeights] = useState<FPScoreWeights>(DEFAULT_WEIGHTS);

  useEffect(() => {
    if (!user) {
      setMetrics([]);
      setScoreHistory([]);
      return;
    }
    void Promise.all([
      supabase.from('health_checkins').select('*').eq('user_id', user.id).order('recorded_on', { ascending: false }),
      supabase.from('fp_score_entries').select('*').eq('user_id', user.id).order('recorded_on', { ascending: false }),
      supabase.from('platform_settings').select('value').eq('key', 'fp_score_weights').maybeSingle(),
    ]).then(([metricResult, scoreResult, weightResult]) => {
      if (metricResult.error || scoreResult.error || weightResult.error) throw new Error(metricResult.error?.message ?? scoreResult.error?.message ?? weightResult.error?.message);
      const loadedMetrics = (metricResult.data ?? []).map((row) => ({ id: row.id, date: row.recorded_on, ...(row.metrics as object) } as HealthMetric));
      setMetrics(loadedMetrics);
      setScoreHistory((scoreResult.data ?? []).map((row) => {
        const metric = loadedMetrics.find((item) => item.date === row.recorded_on) ?? { id: row.id, date: row.recorded_on };
        return { id: row.id, date: row.recorded_on, score: row.score, breakdown: row.components as Record<string, number>, metric };
      }));
      if (weightResult.data?.value) setWeights({ ...DEFAULT_WEIGHTS, ...(weightResult.data.value as Partial<FPScoreWeights>) });
    }).catch(() => undefined);
  }, [user]);

  const currentScore = scoreHistory[0]?.score ?? null;

  const addMetric = async (partial: Omit<HealthMetric, 'id' | 'date'>) => {
    if (!user) return;
    const date = new Date().toISOString().split('T')[0];
    const created = await supabase.from('health_checkins').insert({ user_id: user.id, recorded_on: date, metrics: partial }).select('id').single();
    if (created.error) throw new Error(created.error.message);
    const m: HealthMetric = { ...partial, id: created.data.id, date };
    const updated = [m, ...metrics];
    setMetrics(updated);

    // Compute new FP Score
    const { score, breakdown } = calcScore(m, weights, updated);
    const scoreResult = await supabase.from('fp_score_entries').upsert({ user_id: user.id, score, components: breakdown, recorded_on: date }, { onConflict: 'user_id,recorded_on' }).select('id').single();
    if (scoreResult.error) throw new Error(scoreResult.error.message);
    const entry: FPScoreEntry = { id: scoreResult.data.id, date: m.date, score, breakdown, metric: m };
    const updatedHistory = [entry, ...scoreHistory];
    setScoreHistory(updatedHistory);
  };

  const updateWeights = async (partial: Partial<FPScoreWeights>) => {
    const w = { ...weights, ...partial };
    const { error } = await supabase.from('platform_settings').upsert({ key: 'fp_score_weights', value: w, description: 'Global FP Score component weights.', updated_by: user?.id });
    if (error) throw new Error(error.message);
    setWeights(w);
  };

  return (
    <FPScoreContext.Provider value={{ metrics, scoreHistory, currentScore, weights, addMetric, updateWeights }}>
      {children}
    </FPScoreContext.Provider>
  );
}

export function useFPScore() {
  const ctx = useContext(FPScoreContext);
  if (!ctx) throw new Error('useFPScore must be used within FPScoreProvider');
  return ctx;
}
