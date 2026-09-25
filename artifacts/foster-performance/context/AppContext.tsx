import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { bookingRowToAppBooking, cancelBooking as cancelSupabaseBooking, createBooking, fetchBookings, fetchCoaches } from '@/lib/coachRepository';

// ─── Core Types ──────────────────────────────────────────────────────────────

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  rest: string;
  muscleGroup: string;
  weight?: string;
  distance?: string;
  notes?: string;
}

export type TrainingLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'College' | 'Professional';

export interface TrainingModule {
  id: string;
  title: string;
  focus: string;
  icon: string;
  drills: Exercise[];
  coachNote: string;
}

export interface WeeklyDay {
  day: string;
  label: string;
  duration: number;
  type: 'strength' | 'speed' | 'skill' | 'conditioning' | 'recovery' | 'rest';
}

export interface WorkoutProgram {
  id: string;
  title: string;
  description: string;
  trainingType: 'fitness' | 'strength' | 'running' | 'recovery' | 'walking' | 'crosstraining';
  subcategory?: string;
  level: TrainingLevel;
  weeks: number;
  daysPerWeek: number;
  duration: number;
  equipment: string[];
  category: string;
  isPremium: boolean;
  imageColor: string;
  exercises: Exercise[];
  modules?: TrainingModule[];
  weeklySchedule?: WeeklyDay[];
  coachTip: string;
}

export interface Meal {
  id: string;
  name: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  foods: string[];
}

export interface NutritionPlan {
  id: string;
  title: string;
  description: string;
  goal: string;
  dailyCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  isPremium: boolean;
  meals: Meal[];
}

export interface RehabProgram {
  id: string;
  title: string;
  description: string;
  bodyPart: string;
  duration: string;
  phases: number;
  exercises: Exercise[];
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
}

export interface CoachAvailabilitySlot {
  /** 0 = Sunday, matching Date.getDay(). */
  weekday: number;
  /** "HH:MM:SS" in the coach's configured timezone. */
  startTime: string;
  endTime: string;
}

export interface Coach {
  id: string;
  name: string;
  title: string;
  specialty: string;
  bio: string;
  credentials: string[];
  specialties: string[];
  rating: number;
  reviews: Review[];
  clients: number;
  experience: number;
  isPremium: boolean;
  initials: string;
  color: string;
  coachType: 'personal' | 'strength' | 'nutrition' | 'speed' | 'rehab';
  /** Short day labels ("Mon") for display chips. */
  availability: string[];
  /** Active availability windows, used to derive bookable days and time slots. */
  availabilitySlots: CoachAvailabilitySlot[];
  session30Price: number;
  session60Price: number;
}

export interface Booking {
  id: string;
  /** The server-assigned booking ID (DB primary key). Used for cancellation API calls. */
  serverId?: string;
  /**
   * High-entropy per-booking token returned once at creation time.
   * Required by the cancel endpoint — acts as a bearer credential for that booking.
   */
  cancellationToken?: string;
  coachId: string;
  coachName: string;
  coachInitials: string;
  coachColor: string;
  sessionLength: 30 | 60;
  price: number;
  date: string;
  time: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface ProgressEntry {
  id: string;
  date: string;
  weight: number;
  workoutsThisWeek: number;
  notes: string;
}

export interface WorkoutLog {
  programId: string;
  completedAt: string;
}

// ─── Catalog row mappers ──────────────────────────────────────────────────────
// The catalog lives in Supabase (workout_programs, nutrition_plans,
// rehab_programs). These map snake_case rows onto the camelCase app types.

function toWorkoutProgram(row: any): WorkoutProgram {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    trainingType: row.training_type,
    subcategory: row.subcategory ?? undefined,
    level: row.level,
    weeks: row.weeks,
    daysPerWeek: row.days_per_week,
    duration: row.duration_minutes,
    equipment: row.equipment ?? [],
    category: row.category,
    isPremium: row.is_premium,
    imageColor: row.image_color ?? '#2F80FF',
    coachTip: row.coach_tip ?? '',
    exercises: (row.exercises as Exercise[]) ?? [],
    modules: (row.modules as TrainingModule[]) ?? [],
    weeklySchedule: (row.weekly_schedule as WeeklyDay[]) ?? [],
  };
}

function toNutritionPlan(row: any): NutritionPlan {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    goal: row.goal ?? '',
    dailyCalories: row.daily_calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    isPremium: row.is_premium,
    meals: (row.meals as Meal[]) ?? [],
  };
}

function toRehabProgram(row: any): RehabProgram {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    bodyPart: row.body_part ?? '',
    duration: row.duration ?? '',
    phases: row.phases,
    exercises: (row.exercises as Exercise[]) ?? [],
  };
}

// ─── Context Type ─────────────────────────────────────────────────────────────

interface AppContextType {
  workoutPrograms: WorkoutProgram[];
  nutritionPlans: NutritionPlan[];
  rehabPrograms: RehabProgram[];
  coaches: Coach[];
  /** True until the program catalog fetch settles, so screens can tell "empty" from "still loading". */
  catalogLoading: boolean;
  progressEntries: ProgressEntry[];
  workoutLogs: WorkoutLog[];
  bookings: Booking[];
  activeWorkoutId: string | null;
  activeNutritionId: string | null;
  setActiveWorkout: (id: string | null) => void;
  setActiveNutrition: (id: string | null) => void;
  addProgressEntry: (entry: Omit<ProgressEntry, 'id'>) => void;
  logWorkout: (programId: string) => void;
  addBooking: (booking: Omit<Booking, 'id' | 'createdAt'>) => void;
  cancelBooking: (bookingId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [workoutPrograms, setWorkoutPrograms] = useState<WorkoutProgram[]>([]);
  const [nutritionPlans, setNutritionPlans] = useState<NutritionPlan[]>([]);
  const [rehabPrograms, setRehabPrograms] = useState<RehabProgram[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [progressEntries, setProgressEntries] = useState<ProgressEntry[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(null);
  const [activeNutritionId, setActiveNutritionId] = useState<string | null>(null);

  // The program catalog is granted to anon, so it loads without a session.
  useEffect(() => {
    (async () => {
      try {
        const [wpResult, npResult, rpResult] = await Promise.all([
          supabase.from('workout_programs').select('*').eq('status', 'published'),
          supabase.from('nutrition_plans').select('*').eq('status', 'published'),
          supabase.from('rehab_programs').select('*').eq('status', 'published'),
        ]);
        const error = wpResult.error ?? npResult.error ?? rpResult.error;
        if (error) throw new Error(error.message);
        setWorkoutPrograms((wpResult.data ?? []).map(toWorkoutProgram));
        setNutritionPlans((npResult.data ?? []).map(toNutritionPlan));
        setRehabPrograms((rpResult.data ?? []).map(toRehabProgram));
      } catch (error: any) {
        console.info('[AppContext] Background program load failed:', error?.message ?? error);
      } finally {
        setCatalogLoading(false);
      }
    })();
  }, []);

  // coach_profiles is granted to authenticated only — fetching it before a
  // session exists returns 401, so this is keyed to the user rather than mount.
  useEffect(() => {
    if (!user) {
      setCoaches([]);
      return;
    }
    fetchCoaches()
      .then(setCoaches)
      .catch((error: any) => console.info('[AppContext] Background coach load failed:', error?.message ?? error));
  }, [user]);

  useEffect(() => {
    if (!user) {
      setProgressEntries([]);
      setWorkoutLogs([]);
      setBookings([]);
      setActiveWorkoutId(null);
      setActiveNutritionId(null);
      return;
    }
    void Promise.all([
      supabase.from('progress_entries').select('*').eq('user_id', user.id).order('recorded_on', { ascending: false }),
      supabase.from('workout_sessions').select('program_id, completed_at').eq('user_id', user.id).order('completed_at', { ascending: false }),
      supabase.from('user_app_state').select('*').eq('user_id', user.id).maybeSingle(),
      fetchBookings({ memberId: user.id }),
    ]).then(([progressResult, logsResult, stateResult, bookingRows]) => {
      if (progressResult.error || logsResult.error || stateResult.error) {
        throw new Error(progressResult.error?.message ?? logsResult.error?.message ?? stateResult.error?.message);
      }
      setProgressEntries((progressResult.data ?? []).map((row) => ({
        id: row.id,
        date: row.recorded_on,
        weight: Number(row.weight_kg ?? 0),
        workoutsThisWeek: row.workouts_this_week,
        notes: row.notes,
      })));
      setWorkoutLogs((logsResult.data ?? []).filter((row) => row.program_id).map((row) => ({ programId: row.program_id!, completedAt: row.completed_at })));
      setActiveWorkoutId(stateResult.data?.active_workout_id ?? null);
      setActiveNutritionId(stateResult.data?.active_nutrition_id ?? null);
      setBookings(bookingRows.map(bookingRowToAppBooking));
    }).catch((error: any) => {
      console.info('[AppContext] Background app-state load failed:', error?.message || error);
    });
  }, [user]);

  const setActiveWorkout = useCallback(async (id: string | null) => {
    setActiveWorkoutId(id);
    if (!user) return;
    const { error } = await supabase.from('user_app_state').upsert({ user_id: user.id, active_workout_id: id });
    if (error) throw new Error(error.message);
  }, [user]);

  const setActiveNutrition = useCallback(async (id: string | null) => {
    setActiveNutritionId(id);
    if (!user) return;
    const { error } = await supabase.from('user_app_state').upsert({ user_id: user.id, active_nutrition_id: id });
    if (error) throw new Error(error.message);
  }, [user]);

  const addProgressEntry = useCallback(async (entry: Omit<ProgressEntry, 'id'>) => {
    if (!user) return;
    const { data, error } = await supabase.from('progress_entries').insert({
      user_id: user.id,
      recorded_on: entry.date,
      weight_kg: entry.weight,
      workouts_this_week: entry.workoutsThisWeek,
      notes: entry.notes,
    }).select('id').single();
    if (error) throw new Error(error.message);
    setProgressEntries((current) => [{ ...entry, id: data.id }, ...current]);
  }, [user]);

  const logWorkout = useCallback(async (programId: string) => {
    const log: WorkoutLog = { programId, completedAt: new Date().toISOString() };
    if (!user) return;
    const program = workoutPrograms.find((item) => item.id === programId);
    const { error } = await supabase.from('workout_sessions').insert({
      user_id: user.id,
      // Without program_id the reload query filters this row out, so the
      // completed workout would disappear on the next app launch.
      program_id: program ? programId : null,
      workout_name: program?.title ?? programId,
      completed_at: log.completedAt,
    });
    if (error) throw new Error(error.message);
    setWorkoutLogs((current) => [log, ...current]);
  }, [user, workoutPrograms]);

  const addBooking = useCallback(async (booking: Omit<Booking, 'id' | 'createdAt' | 'serverId'>) => {
    if (!user) throw new Error('User must be authenticated to create booking');
    const bookingId = await createBooking({
      memberId: user.id,
      coachId: booking.coachId,
      sessionLength: booking.sessionLength,
      price: booking.price,
      startsAt: new Date(`${booking.date}T${booking.time}`).toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    const newBooking: Booking = { ...booking, id: bookingId, serverId: bookingId, createdAt: new Date().toISOString() };
    setBookings((current) => [newBooking, ...current]);
  }, [user]);

  // Cancelling marks the booking cancelled; it does not issue a refund. Refunds
  // would need Stripe, which is not wired up, so this deliberately reports no
  // refund outcome rather than returning flags the caller could present as one.
  const cancelBooking = useCallback(async (bookingId: string): Promise<void> => {
    const booking = bookings.find((b) => b.id === bookingId);

    if (booking?.serverId) {
      // Throws on failure — the caller must not update local state in that case,
      // so the booking stays "upcoming" rather than silently appearing cancelled.
      await cancelSupabaseBooking(booking.serverId);
    }

    setBookings((current) => current.map((b) =>
      b.id === bookingId ? { ...b, status: 'cancelled' as const } : b
    ));
  }, [bookings]);

  const contextValue = useMemo<AppContextType>(() => ({
    workoutPrograms,
    nutritionPlans,
    rehabPrograms,
    coaches,
    catalogLoading,
    progressEntries,
    workoutLogs,
    bookings,
    activeWorkoutId,
    activeNutritionId,
    setActiveWorkout,
    setActiveNutrition,
    addProgressEntry,
    logWorkout,
    addBooking,
    cancelBooking,
  }), [
    workoutPrograms, nutritionPlans, rehabPrograms, coaches, catalogLoading,
    activeNutritionId, activeWorkoutId, addBooking, addProgressEntry, bookings,
    cancelBooking, logWorkout, progressEntries, setActiveNutrition,
    setActiveWorkout, workoutLogs,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
