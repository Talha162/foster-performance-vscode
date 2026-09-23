import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { bookingRowToAppBooking, cancelBooking as cancelSupabaseBooking, createBooking, fetchBookings } from '@/lib/coachRepository';

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
  availability: string[];
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

// ─── Training Programs ───────────────────────────────────────────────────────

const WORKOUT_PROGRAMS: WorkoutProgram[] = [
  // ─── Fitness Programs ──────────────────────────────────────────────────────

  {
    id: 'f1', title: 'Fat Loss Accelerator',
    description: '8-week fat loss program combining HIIT, circuit training, and steady-state cardio to maximize caloric burn while preserving lean muscle.',
    trainingType: 'fitness', subcategory: 'Weight Loss', level: 'Beginner',
    weeks: 8, daysPerWeek: 4, duration: 40, category: 'Fitness', isPremium: false,
    imageColor: '#FF6B35',
    coachTip: 'Pair this program with a 200–400 calorie daily deficit for optimal fat loss. Track weekly weight and adjust portions — not exercise intensity — when progress stalls.',
    equipment: ['Dumbbells', 'Jump Rope', 'Mat'],
    exercises: [
      { id: 'f1e1', name: 'Jump Rope Warmup', sets: 1, reps: '3 min', rest: '30s', muscleGroup: 'Full Body / Cardio', notes: 'Moderate pace — elevate heart rate without burning out' },
      { id: 'f1e2', name: 'Dumbbell Squat', sets: 3, reps: '15', rest: '45s', muscleGroup: 'Quads / Glutes', weight: '15–25 lbs' },
      { id: 'f1e3', name: 'Push-Up to Mountain Climber', sets: 3, reps: '10 + 20', rest: '45s', muscleGroup: 'Chest / Core', notes: '10 push-ups then 20 mountain climbers — no rest between' },
      { id: 'f1e4', name: 'Dumbbell Romanian Deadlift', sets: 3, reps: '12', rest: '60s', muscleGroup: 'Hamstrings / Glutes', weight: '20–35 lbs' },
      { id: 'f1e5', name: 'Burpee', sets: 4, reps: '10', rest: '30s', muscleGroup: 'Full Body', notes: 'Rest 90s every other set if needed as a beginner' },
    ],
    weeklySchedule: [
      { day: 'Monday', label: 'HIIT Circuit', duration: 40, type: 'conditioning' as const },
      { day: 'Tuesday', label: 'Active Recovery', duration: 30, type: 'recovery' as const },
      { day: 'Wednesday', label: 'Strength + Cardio', duration: 45, type: 'strength' as const },
      { day: 'Thursday', label: 'Rest', duration: 0, type: 'rest' as const },
      { day: 'Friday', label: 'HIIT Circuit', duration: 40, type: 'conditioning' as const },
      { day: 'Saturday', label: 'Cardio Burn', duration: 35, type: 'conditioning' as const },
      { day: 'Sunday', label: 'Rest', duration: 0, type: 'rest' as const },
    ],
  },

  {
    id: 'f2', title: 'Muscle Building Hypertrophy',
    description: '12-week hypertrophy program built on proven push/pull/legs splits. Progressive overload drives muscle growth week over week.',
    trainingType: 'fitness', subcategory: 'Muscle Building', level: 'Intermediate',
    weeks: 12, daysPerWeek: 5, duration: 60, category: 'Fitness', isPremium: true,
    imageColor: '#9C27B0',
    coachTip: 'Eat at least 0.8g of protein per pound of bodyweight each day. Sleep is when muscle is built — aim for 7–9 hours consistently.',
    equipment: ['Barbell', 'Dumbbells', 'Pull-Up Bar', 'Bench', 'Cable Machine'],
    exercises: [
      { id: 'f2e1', name: 'Barbell Bench Press', sets: 4, reps: '8–10', rest: '90s', muscleGroup: 'Chest', weight: '65–75% 1RM' },
      { id: 'f2e2', name: 'Incline Dumbbell Press', sets: 3, reps: '10–12', rest: '75s', muscleGroup: 'Upper Chest', weight: '30–45 lbs' },
      { id: 'f2e3', name: 'Pull-Up', sets: 4, reps: '6–10', rest: '90s', muscleGroup: 'Back / Biceps', notes: 'Use band assistance if needed' },
      { id: 'f2e4', name: 'Barbell Squat', sets: 4, reps: '8', rest: '2 min', muscleGroup: 'Quads / Glutes', weight: '70–80% 1RM' },
      { id: 'f2e5', name: 'Seated Dumbbell OHP', sets: 3, reps: '10–12', rest: '75s', muscleGroup: 'Shoulders', weight: '25–40 lbs' },
    ],
    weeklySchedule: [
      { day: 'Monday', label: 'Push (Chest/Shoulders)', duration: 60, type: 'strength' as const },
      { day: 'Tuesday', label: 'Pull (Back/Biceps)', duration: 60, type: 'strength' as const },
      { day: 'Wednesday', label: 'Legs', duration: 65, type: 'strength' as const },
      { day: 'Thursday', label: 'Rest', duration: 0, type: 'rest' as const },
      { day: 'Friday', label: 'Push', duration: 60, type: 'strength' as const },
      { day: 'Saturday', label: 'Pull + Legs', duration: 70, type: 'strength' as const },
      { day: 'Sunday', label: 'Rest', duration: 0, type: 'rest' as const },
    ],
  },

  {
    id: 'f3', title: 'Beginner Fitness Foundation',
    description: 'A gentle 6-week introduction to structured fitness. Full-body workouts three times per week with progressive difficulty built in.',
    trainingType: 'fitness', subcategory: 'Beginner Programs', level: 'Beginner',
    weeks: 6, daysPerWeek: 3, duration: 30, category: 'Fitness', isPremium: false,
    imageColor: '#35C98A',
    coachTip: 'Consistency over intensity. Showing up three times a week every week beats sporadic hard sessions every time.',
    equipment: ['Dumbbells', 'Mat'],
    exercises: [
      { id: 'f3e1', name: 'Bodyweight Squat', sets: 3, reps: '12', rest: '60s', muscleGroup: 'Legs' },
      { id: 'f3e2', name: 'Push-Up (Knee or Full)', sets: 3, reps: '8–12', rest: '60s', muscleGroup: 'Chest / Triceps', notes: 'Start on knees and progress to full push-up by week 4' },
      { id: 'f3e3', name: 'Dumbbell Row', sets: 3, reps: '10 each', rest: '60s', muscleGroup: 'Back / Biceps', weight: '10–20 lbs' },
      { id: 'f3e4', name: 'Glute Bridge', sets: 3, reps: '15', rest: '45s', muscleGroup: 'Glutes / Hamstrings' },
      { id: 'f3e5', name: 'Plank Hold', sets: 3, reps: '20–40s', rest: '45s', muscleGroup: 'Core', notes: 'Straight line from head to heel' },
    ],
  },

  {
    id: 'f4', title: 'Home Workout Builder',
    description: 'Zero-equipment, full-body training you can do anywhere. Progressive bodyweight workouts that actually build real fitness.',
    trainingType: 'fitness', subcategory: 'Home Workouts', level: 'Beginner',
    weeks: 8, daysPerWeek: 4, duration: 35, category: 'Fitness', isPremium: false,
    imageColor: '#2F80FF',
    coachTip: 'Elevate your feet on a chair for decline push-ups, use a backpack full of books for weighted squats — creativity is the home gym advantage.',
    equipment: ['Mat', 'Chair'],
    exercises: [
      { id: 'f4e1', name: 'Jump Squat', sets: 3, reps: '12', rest: '45s', muscleGroup: 'Legs / Power' },
      { id: 'f4e2', name: 'Pike Push-Up', sets: 3, reps: '10', rest: '60s', muscleGroup: 'Shoulders / Triceps', notes: 'Inverted V position — targets shoulder press pattern' },
      { id: 'f4e3', name: 'Single-Leg Glute Bridge', sets: 3, reps: '12 each', rest: '45s', muscleGroup: 'Glutes / Hamstrings' },
      { id: 'f4e4', name: 'Tricep Dip (Chair)', sets: 3, reps: '12', rest: '45s', muscleGroup: 'Triceps / Shoulders' },
      { id: 'f4e5', name: 'Bicycle Crunch', sets: 3, reps: '20', rest: '30s', muscleGroup: 'Core / Obliques' },
    ],
  },

  {
    id: 'f5', title: 'Gym Strength & Conditioning',
    description: '12-week gym program building strength and conditioning simultaneously. Designed for athletes who want both muscle and cardiovascular fitness.',
    trainingType: 'fitness', subcategory: 'Gym Workouts', level: 'Intermediate',
    weeks: 12, daysPerWeek: 5, duration: 60, category: 'Fitness', isPremium: true,
    imageColor: '#D6A84B',
    coachTip: 'Superset accessory movements to keep heart rate elevated. The goal is both a muscular pump and cardiovascular challenge in every session.',
    equipment: ['Barbell', 'Dumbbells', 'Cables', 'Bench', 'Pull-Up Bar'],
    exercises: [
      { id: 'f5e1', name: 'Barbell Back Squat', sets: 4, reps: '6–8', rest: '2 min', muscleGroup: 'Legs', weight: '75–85% 1RM' },
      { id: 'f5e2', name: 'Lat Pulldown', sets: 4, reps: '10', rest: '75s', muscleGroup: 'Back / Lats' },
      { id: 'f5e3', name: 'Dumbbell Lunge', sets: 3, reps: '10 each', rest: '60s', muscleGroup: 'Quads / Glutes', weight: '20–35 lbs' },
      { id: 'f5e4', name: 'Cable Face Pull', sets: 3, reps: '15', rest: '45s', muscleGroup: 'Rear Delts / Rotator Cuff' },
      { id: 'f5e5', name: 'Treadmill Interval Sprint', sets: 6, reps: '30s on/30s off', rest: '—', muscleGroup: 'Cardio', notes: 'Sprint at 90% effort for 30 seconds, jog lightly for 30' },
    ],
  },

  {
    id: 'f6', title: 'CrossFit Style Training',
    description: 'High-intensity functional fitness modeled on CrossFit methodology. WODs combining Olympic lifts, gymnastics, and metabolic conditioning.',
    trainingType: 'fitness', subcategory: 'HIIT', level: 'Advanced',
    weeks: 0, daysPerWeek: 5, duration: 60, category: 'Fitness', isPremium: true,
    imageColor: '#FF5722',
    coachTip: 'Scale weight and movements to your ability — a properly scaled WOD delivers the same stimulus as Rx. Ego-lifting leads to injury.',
    equipment: ['Barbell', 'Pull-Up Bar', 'Jump Rope', 'Kettlebell', 'Box', 'Rings'],
    exercises: [
      { id: 'f6e1', name: 'Power Clean', sets: 5, reps: '3', rest: '2 min', muscleGroup: 'Full Body / Power', weight: '65–75% 1RM' },
      { id: 'f6e2', name: 'Muscle-Up (or Pull-Up)', sets: 3, reps: '5 (or 10)', rest: '90s', muscleGroup: 'Back / Chest / Core' },
      { id: 'f6e3', name: 'Box Jump', sets: 4, reps: '8', rest: '60s', muscleGroup: 'Legs / Power' },
      { id: 'f6e4', name: 'Kettlebell Swing', sets: 4, reps: '20', rest: '45s', muscleGroup: 'Posterior Chain', weight: '35–53 lbs' },
      { id: 'f6e5', name: 'Double-Under Jump Rope', sets: 3, reps: '50', rest: '60s', muscleGroup: 'Cardio', notes: 'Sub 100 single-unders if double-unders not yet mastered' },
    ],
  },

  {
    id: 'f7', title: 'HIIT Shred Program',
    description: '8 weeks of science-backed high-intensity interval training. Short, brutal, effective — sessions under 35 minutes that torch fat long after you finish.',
    trainingType: 'fitness', subcategory: 'HIIT', level: 'Intermediate',
    weeks: 8, daysPerWeek: 4, duration: 30, category: 'Fitness', isPremium: false,
    imageColor: '#FF6B35',
    coachTip: 'HIIT creates an "afterburn" that keeps metabolism elevated for 24 hours. Never train HIIT on consecutive days — recovery is when results happen.',
    equipment: ['Mat', 'Dumbbells (optional)'],
    exercises: [
      { id: 'f7e1', name: 'Sprint in Place', sets: 1, reps: '30s', rest: '10s', muscleGroup: 'Cardio' },
      { id: 'f7e2', name: 'Explosive Squat Jump', sets: 1, reps: '20s', rest: '10s', muscleGroup: 'Legs / Power' },
      { id: 'f7e3', name: 'Push-Up Burpee', sets: 1, reps: '30s', rest: '10s', muscleGroup: 'Full Body' },
      { id: 'f7e4', name: 'High Knees', sets: 1, reps: '30s', rest: '10s', muscleGroup: 'Cardio / Core' },
      { id: 'f7e5', name: 'Rest Complete', sets: 1, reps: '90s', rest: '—', muscleGroup: '—', notes: 'Complete 6–8 full rounds of the circuit above' },
    ],
  },

  {
    id: 'f8', title: 'Functional Fitness',
    description: 'Train movements, not muscles. 10 weeks of functional training that makes everyday life and sport easier — carry, push, pull, squat, hinge, rotate.',
    trainingType: 'fitness', subcategory: 'Functional Fitness', level: 'Intermediate',
    weeks: 10, daysPerWeek: 4, duration: 45, category: 'Fitness', isPremium: false,
    imageColor: '#795548',
    coachTip: 'Train barefoot or in minimal shoes when possible — it improves foot strength and proprioception, making every movement more stable.',
    equipment: ['Dumbbells', 'Kettlebell', 'Resistance Bands', 'TRX or Rings'],
    exercises: [
      { id: 'f8e1', name: 'Turkish Get-Up', sets: 3, reps: '3 each side', rest: '90s', muscleGroup: 'Full Body / Stability', weight: '15–35 lbs' },
      { id: 'f8e2', name: 'KB Deadlift to High Pull', sets: 4, reps: '10', rest: '60s', muscleGroup: 'Posterior Chain / Shoulders', weight: '35–53 lbs' },
      { id: 'f8e3', name: 'TRX Row', sets: 3, reps: '12', rest: '60s', muscleGroup: 'Back / Biceps / Core' },
      { id: 'f8e4', name: 'Lateral Lunge to Balance', sets: 3, reps: '10 each', rest: '45s', muscleGroup: 'Glutes / Adductors / Balance' },
      { id: 'f8e5', name: 'Pallof Press', sets: 3, reps: '12 each', rest: '45s', muscleGroup: 'Core / Anti-Rotation', notes: 'Resist rotation throughout — key movement for injury-resistant core' },
    ],
  },

  // ─── Strength Programs ─────────────────────────────────────────────────────

  {
    id: 's1', title: 'Beginner Weightlifting',
    description: 'An 8-week foundational program. Learn the big movements with perfect form and set personal records every single week.',
    trainingType: 'strength', subcategory: 'Beginner Weightlifting', level: 'Beginner',
    weeks: 8, daysPerWeek: 3, duration: 60, category: 'Strength', isPremium: false,
    imageColor: '#9C27B0',
    coachTip: 'Never sacrifice form for weight. Start lighter than you think — adding 5 lbs per week is 260 lbs gained over a year.',
    equipment: ['Barbell', 'Dumbbells', 'Bench', 'Squat Rack'],
    exercises: [
      { id: 's1e1', name: 'Barbell Squat', sets: 3, reps: '5', rest: '3 min', muscleGroup: 'Legs / Core', weight: 'Start 45–65 lbs', notes: 'Focus on depth and knees tracking over toes' },
      { id: 's1e2', name: 'Barbell Bench Press', sets: 3, reps: '5', rest: '3 min', muscleGroup: 'Chest / Triceps', weight: 'Start 45–65 lbs' },
      { id: 's1e3', name: 'Barbell Deadlift', sets: 1, reps: '5', rest: '3 min', muscleGroup: 'Full Posterior Chain', weight: 'Start 65–95 lbs', notes: '1 work set per session — quality over quantity' },
      { id: 's1e4', name: 'Barbell Overhead Press', sets: 3, reps: '5', rest: '3 min', muscleGroup: 'Shoulders / Triceps', weight: 'Start 35–55 lbs' },
      { id: 's1e5', name: 'Barbell Row', sets: 3, reps: '5', rest: '3 min', muscleGroup: 'Back / Biceps', weight: 'Start 45–65 lbs' },
    ],
    weeklySchedule: [
      { day: 'Monday', label: 'Squat / Bench / Row', duration: 60, type: 'strength' as const },
      { day: 'Tuesday', label: 'Rest', duration: 0, type: 'rest' as const },
      { day: 'Wednesday', label: 'Squat / Press / Deadlift', duration: 60, type: 'strength' as const },
      { day: 'Thursday', label: 'Rest', duration: 0, type: 'rest' as const },
      { day: 'Friday', label: 'Squat / Bench / Row', duration: 60, type: 'strength' as const },
      { day: 'Saturday', label: 'Rest', duration: 0, type: 'rest' as const },
      { day: 'Sunday', label: 'Rest', duration: 0, type: 'rest' as const },
    ],
  },

  {
    id: 's2', title: 'Powerlifting Peak Program',
    description: '16-week periodized powerlifting program. Maximize your squat, bench, and deadlift using block periodization and a structured peaking phase.',
    trainingType: 'strength', subcategory: 'Powerlifting', level: 'Advanced',
    weeks: 16, daysPerWeek: 4, duration: 90, category: 'Strength', isPremium: true,
    imageColor: '#795548',
    coachTip: 'The peaking block (weeks 13–16) reduces volume and tapers to PR attempts. Feeling "less" in the final weeks means your CNS is peaking.',
    equipment: ['Barbell', 'Squat Rack', 'Bench', 'Belt', 'Knee Sleeves'],
    exercises: [
      { id: 's2e1', name: 'Competition Squat', sets: 4, reps: '3', rest: '4 min', muscleGroup: 'Legs / Core', weight: '80–92% 1RM' },
      { id: 's2e2', name: 'Competition Bench Press', sets: 4, reps: '3', rest: '4 min', muscleGroup: 'Chest / Triceps', weight: '80–92% 1RM' },
      { id: 's2e3', name: 'Competition Deadlift', sets: 4, reps: '2', rest: '5 min', muscleGroup: 'Full Posterior Chain', weight: '80–92% 1RM' },
      { id: 's2e4', name: 'Pause Squat', sets: 3, reps: '3', rest: '3 min', muscleGroup: 'Quads / Core', weight: '70% 1RM', notes: '3-second pause — builds strength out of the hole' },
      { id: 's2e5', name: 'Close-Grip Bench Press', sets: 3, reps: '5', rest: '3 min', muscleGroup: 'Triceps / Chest', weight: '65% 1RM' },
    ],
  },

  {
    id: 's3', title: 'Olympic Weightlifting',
    description: '12-week program developing the snatch and clean & jerk from fundamentals through full lifts. Explosive, technical, and deeply rewarding.',
    trainingType: 'strength', subcategory: 'Olympic Lifting', level: 'Advanced',
    weeks: 12, daysPerWeek: 4, duration: 75, category: 'Strength', isPremium: true,
    imageColor: '#D6A84B',
    coachTip: 'Record every lift on video. More errors are caught on film than in the mirror. The overhead squat exposes every mobility limitation.',
    equipment: ['Barbell', 'Bumper Plates', 'Squat Rack', 'Lifting Shoes'],
    exercises: [
      { id: 's3e1', name: 'Power Snatch', sets: 5, reps: '3', rest: '3 min', muscleGroup: 'Full Body / Power', weight: '65–75% 1RM' },
      { id: 's3e2', name: 'Clean & Jerk', sets: 5, reps: '2+1', rest: '3 min', muscleGroup: 'Full Body / Power', weight: '70–80% 1RM', notes: '2 cleans + 1 jerk' },
      { id: 's3e3', name: 'Front Squat', sets: 4, reps: '3', rest: '2 min', muscleGroup: 'Quads / Core', weight: '80–85% 1RM' },
      { id: 's3e4', name: 'Snatch Deadlift', sets: 4, reps: '4', rest: '2 min', muscleGroup: 'Posterior Chain', weight: '90–100% snatch max', notes: 'Reinforces correct pull path' },
      { id: 's3e5', name: 'Overhead Squat', sets: 3, reps: '5', rest: '2 min', muscleGroup: 'Stability / Full Body' },
    ],
  },

  {
    id: 's4', title: 'Strength & Conditioning',
    description: '12 weeks of concurrent training that builds muscle, maximal strength, and real conditioning — the best of both worlds.',
    trainingType: 'strength', subcategory: 'Strength & Conditioning', level: 'Intermediate',
    weeks: 12, daysPerWeek: 4, duration: 60, category: 'Strength', isPremium: false,
    imageColor: '#2F80FF',
    coachTip: 'Do strength work before conditioning — fatigued muscles make for poor motor patterns on heavy lifts, which leads to injury.',
    equipment: ['Barbell', 'Dumbbells', 'Pull-Up Bar', 'Sled (optional)', 'Kettlebell'],
    exercises: [
      { id: 's4e1', name: 'Barbell Squat', sets: 4, reps: '5', rest: '2 min', muscleGroup: 'Legs / Core', weight: '75–80% 1RM' },
      { id: 's4e2', name: 'Push Press', sets: 4, reps: '5', rest: '2 min', muscleGroup: 'Shoulders / Triceps / Legs', weight: '60–70% 1RM' },
      { id: 's4e3', name: 'Weighted Pull-Up', sets: 3, reps: '5', rest: '2 min', muscleGroup: 'Back / Biceps' },
      { id: 's4e4', name: 'Sled Push', sets: 4, reps: '30m', rest: '90s', muscleGroup: 'Full Body / Conditioning' },
      { id: 's4e5', name: 'Assault Bike Sprint', sets: 5, reps: '15s', rest: '45s', muscleGroup: 'Cardio / Full Body', notes: 'Max effort — brutal but effective' },
    ],
    weeklySchedule: [
      { day: 'Monday', label: 'Lower Strength + Sled', duration: 65, type: 'strength' as const },
      { day: 'Tuesday', label: 'Conditioning', duration: 30, type: 'conditioning' as const },
      { day: 'Wednesday', label: 'Upper Strength', duration: 65, type: 'strength' as const },
      { day: 'Thursday', label: 'Rest', duration: 0, type: 'rest' as const },
      { day: 'Friday', label: 'Full Body + Bike Intervals', duration: 60, type: 'strength' as const },
      { day: 'Saturday', label: 'Active Recovery', duration: 30, type: 'recovery' as const },
      { day: 'Sunday', label: 'Rest', duration: 0, type: 'rest' as const },
    ],
  },

  // ─── Running Programs ──────────────────────────────────────────────────────

  {
    id: 'r1', title: 'Couch to 5K',
    description: 'Transform from non-runner to confident 5K finisher in 8 weeks. Walk-run intervals that build your aerobic base without injury.',
    trainingType: 'running', subcategory: 'Beginner Running', level: 'Beginner',
    weeks: 8, daysPerWeek: 3, duration: 30, category: 'Running', isPremium: false,
    imageColor: '#35C98A',
    coachTip: 'You should be able to hold a conversation while running — if you cannot, slow down. Building aerobic base takes months; there are no shortcuts.',
    equipment: ['Running Shoes'],
    exercises: [
      { id: 'r1e1', name: 'Warmup Walk', sets: 1, reps: '5 min', rest: '—', muscleGroup: 'Full Body / Cardio' },
      { id: 'r1e2', name: 'Run/Walk Intervals', sets: 1, reps: '20 min', rest: '—', muscleGroup: 'Cardio', notes: 'Week 1: 60s run / 90s walk × 8. Intervals lengthen each week' },
      { id: 'r1e3', name: 'Cooldown Walk', sets: 1, reps: '5 min', rest: '—', muscleGroup: 'Full Body / Cardio' },
    ],
    weeklySchedule: [
      { day: 'Monday', label: 'Run Session', duration: 30, type: 'conditioning' as const },
      { day: 'Tuesday', label: 'Rest', duration: 0, type: 'rest' as const },
      { day: 'Wednesday', label: 'Run Session', duration: 30, type: 'conditioning' as const },
      { day: 'Thursday', label: 'Rest', duration: 0, type: 'rest' as const },
      { day: 'Friday', label: 'Rest', duration: 0, type: 'rest' as const },
      { day: 'Saturday', label: 'Long Run', duration: 35, type: 'conditioning' as const },
      { day: 'Sunday', label: 'Rest', duration: 0, type: 'rest' as const },
    ],
  },

  {
    id: 'r2', title: '5K Race Ready',
    description: '8-week structured 5K plan. Easy runs, tempo efforts, and speed work that build your fitness to PR on race day.',
    trainingType: 'running', subcategory: '5K', level: 'Beginner',
    weeks: 8, daysPerWeek: 4, duration: 30, category: 'Running', isPremium: false,
    imageColor: '#4CAF50',
    coachTip: 'Run your easy days truly easy — most runners run easy days too hard, making hard days too slow. Trust the easy pace.',
    equipment: ['Running Shoes', 'GPS Watch (optional)'],
    exercises: [
      { id: 'r2e1', name: 'Easy Run', sets: 1, reps: '20–30 min', rest: '—', muscleGroup: 'Cardio', notes: 'Conversational pace — full sentences throughout' },
      { id: 'r2e2', name: 'Tempo Run', sets: 1, reps: '15–20 min', rest: '—', muscleGroup: 'Cardio', notes: 'Comfortably hard — short phrases only' },
      { id: 'r2e3', name: '400m Repeats', sets: 4, reps: '400m', rest: '90s', muscleGroup: 'Cardio / Speed', distance: '400m', notes: '5K race pace effort each repeat' },
      { id: 'r2e4', name: 'Long Run', sets: 1, reps: '35–45 min', rest: '—', muscleGroup: 'Aerobic Endurance' },
    ],
    weeklySchedule: [
      { day: 'Monday', label: 'Easy Run', duration: 25, type: 'conditioning' as const },
      { day: 'Tuesday', label: 'Rest', duration: 0, type: 'rest' as const },
      { day: 'Wednesday', label: 'Tempo Run', duration: 30, type: 'speed' as const },
      { day: 'Thursday', label: '400m Repeats', duration: 35, type: 'speed' as const },
      { day: 'Friday', label: 'Rest', duration: 0, type: 'rest' as const },
      { day: 'Saturday', label: 'Long Run', duration: 45, type: 'conditioning' as const },
      { day: 'Sunday', label: 'Rest', duration: 0, type: 'rest' as const },
    ],
  },

  {
    id: 'r3', title: '10K Training Plan',
    description: '10-week progression from 5K fitness to 10K race-readiness. Longer tempo work, progressive long runs, and race-specific intervals.',
    trainingType: 'running', subcategory: '10K', level: 'Intermediate',
    weeks: 10, daysPerWeek: 4, duration: 40, category: 'Running', isPremium: false,
    imageColor: '#2F80FF',
    coachTip: 'Pacing discipline separates finishers from runners who blow up. Practice goal pace on tempo days so it feels natural on race day.',
    equipment: ['Running Shoes', 'GPS Watch'],
    exercises: [
      { id: 'r3e1', name: 'Easy Recovery Run', sets: 1, reps: '30 min', rest: '—', muscleGroup: 'Cardio' },
      { id: 'r3e2', name: '10K Tempo Run', sets: 1, reps: '25–30 min', rest: '—', muscleGroup: 'Cardio', notes: 'Hold goal 10K race pace — the key workout of the week' },
      { id: 'r3e3', name: '1K Repeats', sets: 5, reps: '1 km', rest: '2 min', muscleGroup: 'Cardio / Speed', distance: '1 km', notes: 'Slightly faster than 10K goal pace each repeat' },
      { id: 'r3e4', name: 'Long Run', sets: 1, reps: '60–75 min', rest: '—', muscleGroup: 'Aerobic Endurance' },
    ],
  },

  {
    id: 'r4', title: 'Half Marathon Program',
    description: '16-week half marathon plan. Progressive mileage, tune-up races, and a smart taper ensure you arrive at the start line ready to run your best.',
    trainingType: 'running', subcategory: 'Half Marathon', level: 'Intermediate',
    weeks: 16, daysPerWeek: 4, duration: 60, category: 'Running', isPremium: true,
    imageColor: '#D6A84B',
    coachTip: 'The long run is the cornerstone of half marathon training. Do it 60–90 seconds per mile slower than race pace — your race-day legs will thank you.',
    equipment: ['Running Shoes', 'GPS Watch', 'Energy Gels'],
    exercises: [
      { id: 'r4e1', name: 'Easy Base Run', sets: 1, reps: '40 min', rest: '—', muscleGroup: 'Cardio' },
      { id: 'r4e2', name: 'Half Marathon Tempo', sets: 1, reps: '30–40 min', rest: '—', muscleGroup: 'Cardio', notes: 'Race goal pace — builds confidence and fitness together' },
      { id: 'r4e3', name: 'Long Run (Negative Split)', sets: 1, reps: '90–120 min', rest: '—', muscleGroup: 'Aerobic Endurance', notes: 'Run second half slightly faster than first' },
      { id: 'r4e4', name: 'Strides', sets: 6, reps: '20s', rest: '1 min', muscleGroup: 'Speed / Neuromuscular', notes: 'Relaxed accelerations to 95% — improves running economy' },
    ],
  },

  {
    id: 'r5', title: 'Marathon Training Plan',
    description: '20-week marathon plan: progressive long runs, back-to-back weekend sessions, and a structured 3-week taper.',
    trainingType: 'running', subcategory: 'Marathon', level: 'Advanced',
    weeks: 20, daysPerWeek: 5, duration: 90, category: 'Running', isPremium: true,
    imageColor: '#FF6B35',
    coachTip: 'Practice your race-day nutrition on every long run above 16 miles. Gut issues are almost always preventable with proper rehearsal.',
    equipment: ['Running Shoes', 'GPS Watch', 'Energy Gels', 'Hydration Vest'],
    exercises: [
      { id: 'r5e1', name: 'Easy Recovery Run', sets: 1, reps: '45–60 min', rest: '—', muscleGroup: 'Cardio' },
      { id: 'r5e2', name: 'Marathon Pace Run', sets: 1, reps: '10–14 miles', rest: '—', muscleGroup: 'Cardio', distance: '10–14 miles', notes: 'Goal marathon pace — most important run of the week' },
      { id: 'r5e3', name: 'Progression Long Run', sets: 1, reps: '18–22 miles', rest: '—', muscleGroup: 'Aerobic Endurance', distance: '18–22 miles' },
      { id: 'r5e4', name: 'Midweek Medium-Long Run', sets: 1, reps: '12–15 miles', rest: '—', muscleGroup: 'Aerobic Base', distance: '12–15 miles' },
    ],
    weeklySchedule: [
      { day: 'Monday', label: 'Rest', duration: 0, type: 'rest' as const },
      { day: 'Tuesday', label: 'Easy Run', duration: 50, type: 'conditioning' as const },
      { day: 'Wednesday', label: 'Marathon Pace', duration: 90, type: 'speed' as const },
      { day: 'Thursday', label: 'Easy Run', duration: 45, type: 'conditioning' as const },
      { day: 'Friday', label: 'Rest', duration: 0, type: 'rest' as const },
      { day: 'Saturday', label: 'Medium-Long Run', duration: 80, type: 'conditioning' as const },
      { day: 'Sunday', label: 'Long Run', duration: 150, type: 'conditioning' as const },
    ],
  },

  {
    id: 'r6', title: 'Sprint Speed Development',
    description: '8-week sprint program focused on acceleration, max velocity mechanics, and speed endurance. Get measurably faster.',
    trainingType: 'running', subcategory: 'Sprint Training', level: 'Intermediate',
    weeks: 8, daysPerWeek: 4, duration: 45, category: 'Running', isPremium: false,
    imageColor: '#D6A84B',
    coachTip: 'Sprint work requires full recovery between reps. If your times are slowing down significantly, stop — you are training fatigue, not speed.',
    equipment: ['Track or Turf Field', 'Resistance Bands'],
    exercises: [
      { id: 'r6e1', name: '10m Acceleration Sprint', sets: 6, reps: '10m', rest: '2 min', muscleGroup: 'Full Body / Power', distance: '10m', notes: 'Forward lean and powerful first 3 steps' },
      { id: 'r6e2', name: '40m Flying Sprint', sets: 5, reps: '40m', rest: '3 min', muscleGroup: 'Speed / Power', distance: '40m', notes: 'Start jogging, hit max velocity at 20m mark' },
      { id: 'r6e3', name: 'Resisted Sprint (Band)', sets: 4, reps: '20m', rest: '3 min', muscleGroup: 'Acceleration', distance: '20m', notes: 'Partner resistance drives acceleration overload' },
      { id: 'r6e4', name: '150m Speed Endurance', sets: 4, reps: '150m', rest: '4 min', muscleGroup: 'Speed Endurance', distance: '150m', notes: '90% effort — builds speed endurance' },
    ],
    weeklySchedule: [
      { day: 'Monday', label: 'Acceleration Work', duration: 45, type: 'speed' as const },
      { day: 'Tuesday', label: 'Lower Body Strength', duration: 50, type: 'strength' as const },
      { day: 'Wednesday', label: 'Rest', duration: 0, type: 'rest' as const },
      { day: 'Thursday', label: 'Max Velocity', duration: 45, type: 'speed' as const },
      { day: 'Friday', label: 'Speed Endurance', duration: 50, type: 'conditioning' as const },
      { day: 'Saturday', label: 'Rest', duration: 0, type: 'rest' as const },
      { day: 'Sunday', label: 'Rest', duration: 0, type: 'rest' as const },
    ],
  },

  // ─── Recovery Programs ─────────────────────────────────────────────────────

  {
    id: 'rc1', title: 'Daily Mobility Flow',
    description: '6-week mobility program that systematically opens every major joint. 30-minute daily flows that reduce pain, improve posture, and enhance performance.',
    trainingType: 'recovery', subcategory: 'Mobility', level: 'Beginner',
    weeks: 6, daysPerWeek: 5, duration: 30, category: 'Recovery', isPremium: false,
    imageColor: '#00BCD4',
    coachTip: 'Breathe into each stretch — exhale and sink deeper into end range. Tension is your nervous system protecting you; teach it the new range is safe.',
    equipment: ['Mat', 'Foam Roller', 'Resistance Band'],
    exercises: [
      { id: 'rc1e1', name: '90/90 Hip Stretch', sets: 1, reps: '2 min each side', rest: '—', muscleGroup: 'Hip Rotators' },
      { id: 'rc1e2', name: 'Thoracic Spine Rotation', sets: 1, reps: '10 each side', rest: '—', muscleGroup: 'Thoracic / Upper Back' },
      { id: 'rc1e3', name: "World's Greatest Stretch", sets: 1, reps: '5 each side', rest: '—', muscleGroup: 'Hips / Thoracic / Shoulders', notes: 'Best single movement for total body mobility' },
      { id: 'rc1e4', name: 'Ankle CARs', sets: 1, reps: '10 each direction per foot', rest: '—', muscleGroup: 'Ankle / Lower Leg' },
      { id: 'rc1e5', name: 'Cat-Cow Breath Flow', sets: 1, reps: '10 full breaths', rest: '—', muscleGroup: 'Lumbar / Thoracic Spine' },
    ],
  },

  {
    id: 'rc2', title: 'Flexibility & Stretching',
    description: '6-week daily stretching program targeting chronically tight muscles — hips, hamstrings, thoracic spine, and shoulders.',
    trainingType: 'recovery', subcategory: 'Stretching', level: 'Beginner',
    weeks: 6, daysPerWeek: 6, duration: 20, category: 'Recovery', isPremium: false,
    imageColor: '#4CAF50',
    coachTip: 'Hold stretches for at least 60 seconds — research shows 30 seconds is not enough to create lasting flexibility change.',
    equipment: ['Mat', 'Yoga Blocks (optional)', 'Strap or Towel'],
    exercises: [
      { id: 'rc2e1', name: 'Supine Hamstring Stretch', sets: 1, reps: '90s each leg', rest: '—', muscleGroup: 'Hamstrings', notes: 'Use a strap to keep leg straight' },
      { id: 'rc2e2', name: 'Pigeon Pose', sets: 1, reps: '90s each side', rest: '—', muscleGroup: 'Glutes / Hip External Rotators' },
      { id: 'rc2e3', name: 'Doorway Pec Stretch', sets: 1, reps: '60s each side', rest: '—', muscleGroup: 'Chest / Anterior Shoulder' },
      { id: 'rc2e4', name: 'Standing Quad Stretch', sets: 1, reps: '60s each leg', rest: '—', muscleGroup: 'Quads / Hip Flexor' },
      { id: 'rc2e5', name: 'Seated Spinal Twist', sets: 1, reps: '90s each side', rest: '—', muscleGroup: 'Lumbar Spine / Obliques' },
    ],
  },

  {
    id: 'rc3', title: 'Foam Rolling & Myofascial Release',
    description: 'Targeted foam rolling protocol for pre- and post-workout recovery. Releases tight fascia, reduces DOMS, and primes the nervous system.',
    trainingType: 'recovery', subcategory: 'Foam Rolling', level: 'Beginner',
    weeks: 0, daysPerWeek: 5, duration: 20, category: 'Recovery', isPremium: false,
    imageColor: '#607D8B',
    coachTip: 'When you find a tender spot, pause on it 30–60 seconds rather than rolling back and forth. You want the tissue to release, not just the surface massaged.',
    equipment: ['Foam Roller', 'Lacrosse Ball'],
    exercises: [
      { id: 'rc3e1', name: 'IT Band Roll', sets: 1, reps: '60s each side', rest: '—', muscleGroup: 'IT Band / Lateral Leg', notes: 'Hip to knee slowly — pause on tender spots' },
      { id: 'rc3e2', name: 'Thoracic Spine Roll', sets: 1, reps: '90s', rest: '—', muscleGroup: 'Upper Back / T-Spine', notes: 'Deep breath at each segment to open the spine' },
      { id: 'rc3e3', name: 'Glute / Piriformis (Lacrosse Ball)', sets: 1, reps: '60s each side', rest: '—', muscleGroup: 'Glutes / Hip Rotators' },
      { id: 'rc3e4', name: 'Calf & Achilles Roll', sets: 1, reps: '60s each leg', rest: '—', muscleGroup: 'Calf / Achilles' },
      { id: 'rc3e5', name: 'Lat Roll', sets: 1, reps: '60s each side', rest: '—', muscleGroup: 'Lats / Teres Major' },
    ],
  },

  {
    id: 'rc4', title: 'Injury Prevention Protocol',
    description: '8-week proactive injury prevention program targeting the most commonly injured areas — ACL, rotator cuff, hamstrings, and lower back.',
    trainingType: 'recovery', subcategory: 'Injury Prevention', level: 'Intermediate',
    weeks: 8, daysPerWeek: 4, duration: 35, category: 'Recovery', isPremium: true,
    imageColor: '#FF6B35',
    coachTip: 'Injury prevention is not exciting — it is done before you need it. Athletes who never miss time did the boring prehab work consistently.',
    equipment: ['Resistance Bands', 'Mat', 'Balance Board (optional)'],
    exercises: [
      { id: 'rc4e1', name: 'Nordic Hamstring Curl', sets: 3, reps: '5', rest: '2 min', muscleGroup: 'Hamstrings', notes: 'Most evidence-based ACL & hamstring injury prevention exercise' },
      { id: 'rc4e2', name: 'Band Clamshell', sets: 3, reps: '20 each', rest: '45s', muscleGroup: 'Glute Med / Hip Stabilizers', notes: 'Weak glute med is the root cause of most knee alignment issues' },
      { id: 'rc4e3', name: 'Rotator Cuff External Rotation', sets: 3, reps: '15 each', rest: '45s', muscleGroup: 'Rotator Cuff' },
      { id: 'rc4e4', name: 'Single-Leg RDL', sets: 3, reps: '10 each', rest: '60s', muscleGroup: 'Hamstrings / Glutes / Balance' },
      { id: 'rc4e5', name: 'Dead Bug', sets: 3, reps: '10 each', rest: '45s', muscleGroup: 'Core / Lower Back', notes: 'Press lower back into floor throughout — slow and controlled' },
    ],
  },

  {
    id: 'rc5', title: 'Active Recovery Program',
    description: '6-week program for the days between hard training sessions. Light movement, breath work, and tissue work that accelerates recovery.',
    trainingType: 'recovery', subcategory: 'Recovery Sessions', level: 'Intermediate',
    weeks: 6, daysPerWeek: 5, duration: 30, category: 'Recovery', isPremium: false,
    imageColor: '#35C98A',
    coachTip: 'Active recovery is not a day off — it is targeted low-intensity movement that flushes metabolic waste. It should feel restorative, not challenging.',
    equipment: ['Mat', 'Foam Roller', 'Resistance Bands'],
    exercises: [
      { id: 'rc5e1', name: 'Easy Walk or Light Jog', sets: 1, reps: '10 min', rest: '—', muscleGroup: 'Full Body / Cardio', notes: 'Zone 1 heart rate only — just enough to get blood moving' },
      { id: 'rc5e2', name: 'Full Body Foam Roll', sets: 1, reps: '10 min', rest: '—', muscleGroup: 'Connective Tissue' },
      { id: 'rc5e3', name: 'Diaphragmatic Breathing', sets: 1, reps: '5 min', rest: '—', muscleGroup: 'Nervous System', notes: '4 counts in, 6 counts out — activates rest-and-digest' },
      { id: 'rc5e4', name: 'Yoga Flow (Sun Salutation)', sets: 3, reps: '1 full flow', rest: '30s', muscleGroup: 'Full Body / Mobility' },
      { id: 'rc5e5', name: 'Contrast Shower', sets: 1, reps: '3 min (30s cold/30s hot)', rest: '—', muscleGroup: 'Recovery / Circulation', notes: 'Reduces inflammation and speeds muscular recovery' },
    ],
  },

  // ─── Walking Programs ─────────────────────────────────────────────────────

  {
    id: 'w1', title: 'Power Walking for Fitness',
    description: '8-week progressive walking program that builds cardiovascular fitness, burns calories, and improves overall health without joint stress.',
    trainingType: 'walking', subcategory: 'Walking', level: 'Beginner',
    weeks: 8, daysPerWeek: 5, duration: 40, category: 'Cardio', isPremium: false,
    imageColor: '#8BC34A',
    coachTip: 'Walk with intention — keep your core lightly engaged, shoulders relaxed, and eyes forward. A 20-minute brisk walk burns as many calories as a 15-minute jog for most people.',
    equipment: ['Comfortable shoes', 'Water bottle'],
    exercises: [
      { id: 'w1e1', name: 'Warm-Up Walk', sets: 1, reps: '5 min easy pace', rest: '—', muscleGroup: 'Full Body / Cardio' },
      { id: 'w1e2', name: 'Brisk Walk', sets: 1, reps: '25–35 min moderate pace', rest: '—', muscleGroup: 'Legs / Cardio', notes: 'Target 3.5–4 mph — you should be able to talk but feel slightly breathless' },
      { id: 'w1e3', name: 'Incline Walk', sets: 3, reps: '3 min uphill', rest: '2 min flat', muscleGroup: 'Glutes / Calves / Cardio' },
      { id: 'w1e4', name: 'Cool-Down Walk', sets: 1, reps: '5 min slow pace', rest: '—', muscleGroup: 'Full Body' },
      { id: 'w1e5', name: 'Standing Calf Stretch', sets: 2, reps: '45s each leg', rest: '—', muscleGroup: 'Calves' },
    ],
  },

  // ─── Cross-Training Programs ───────────────────────────────────────────────

  {
    id: 'ct1', title: 'Cross-Training Challenge',
    description: '8-week mixed-modality program combining strength, cardio, and functional movements for total-body fitness and athletic endurance.',
    trainingType: 'crosstraining', subcategory: 'Cross-Training', level: 'Intermediate',
    weeks: 8, daysPerWeek: 4, duration: 50, category: 'Cardio', isPremium: false,
    imageColor: '#FF5722',
    coachTip: 'Cross-training is about variety — the combination of modalities challenges your body in new ways every session. Embrace the variety and trust the process.',
    equipment: ['Dumbbells', 'Jump Rope', 'Rowing Machine (optional)', 'Mat'],
    exercises: [
      { id: 'ct1e1', name: 'Jump Rope Intervals', sets: 5, reps: '1 min on / 30s off', rest: '30s', muscleGroup: 'Cardio / Calves / Coordination' },
      { id: 'ct1e2', name: 'Dumbbell Thrusters', sets: 4, reps: '12', rest: '60s', muscleGroup: 'Full Body / Shoulders / Legs' },
      { id: 'ct1e3', name: 'Rowing Machine (or Row Subs)', sets: 3, reps: '500m', rest: '90s', muscleGroup: 'Back / Arms / Cardio' },
      { id: 'ct1e4', name: 'Box Jumps or Step-Ups', sets: 4, reps: '10', rest: '60s', muscleGroup: 'Legs / Power / Cardio' },
      { id: 'ct1e5', name: 'Turkish Get-Up', sets: 3, reps: '3 each side', rest: '90s', muscleGroup: 'Full Body / Core / Stability' },
    ],
  },

];

// ─── Nutrition Plans ──────────────────────────────────────────────────────────

const NUTRITION_PLANS: NutritionPlan[] = [
  {
    id: 'np1',
    title: 'Endurance Performance Plan',
    description: 'High-carb endurance nutrition plan — peak glycogen loading, optimal hydration, and performance-timed fuel.',
    goal: 'Improve Endurance',
    dailyCalories: 3400,
    protein: 210,
    carbs: 420,
    fat: 75,
    isPremium: false,
    meals: [
      { id: 'm1', name: 'Morning Activation', time: '7:00 AM', calories: 700, protein: 45, carbs: 90, fat: 18, foods: ['Oatmeal with honey', 'Eggs (3)', 'Banana', 'Orange juice'] },
      { id: 'm2', name: 'Pre-Workout Fuel', time: '11:00 AM', calories: 800, protein: 55, carbs: 110, fat: 15, foods: ['Grilled chicken', 'White rice', 'Steamed vegetables', 'Gatorade'] },
      { id: 'm3', name: 'Pre-Workout Snack', time: '1:00 PM', calories: 350, protein: 25, carbs: 55, fat: 5, foods: ['Rice cakes', 'Peanut butter', 'Banana'] },
      { id: 'm4', name: 'Mid-Session Refuel', time: 'Half', calories: 300, protein: 15, carbs: 55, fat: 5, foods: ['Sports drink', 'Orange slices', 'Energy chew'] },
      { id: 'm5', name: 'Post-Workout Recovery', time: '6:00 PM', calories: 900, protein: 65, carbs: 105, fat: 22, foods: ['Salmon', 'Sweet potato', 'Broccoli', 'Protein shake'] },
      { id: 'm6', name: 'Night Recovery', time: '9:30 PM', calories: 350, protein: 35, carbs: 30, fat: 10, foods: ['Cottage cheese', 'Cherries', 'Casein shake'] },
    ],
  },
  {
    id: 'np2',
    title: 'Muscle Building Plan',
    description: 'High-calorie, protein-rich plan for building muscle — add functional size and strength while minimizing fat gain.',
    goal: 'Build Muscle',
    dailyCalories: 3800,
    protein: 250,
    carbs: 440,
    fat: 95,
    isPremium: false,
    meals: [
      { id: 'm7', name: 'Power Breakfast', time: '7:00 AM', calories: 850, protein: 55, carbs: 100, fat: 25, foods: ['6 eggs', 'Oatmeal', 'Whole milk', 'Banana', 'Almond butter'] },
      { id: 'm8', name: 'Mid-Morning', time: '10:00 AM', calories: 550, protein: 45, carbs: 65, fat: 14, foods: ['Greek yogurt', 'Protein bar', 'Trail mix'] },
      { id: 'm9', name: 'Pre-Training', time: '12:30 PM', calories: 750, protein: 55, carbs: 95, fat: 18, foods: ['Ground beef', 'Brown rice', 'Avocado'] },
      { id: 'm10', name: 'Post-Training', time: '3:30 PM', calories: 700, protein: 65, carbs: 85, fat: 12, foods: ['Whey shake', 'White rice', 'Banana', 'Chocolate milk'] },
      { id: 'm11', name: 'Dinner', time: '7:00 PM', calories: 950, protein: 75, carbs: 95, fat: 26, foods: ['Steak (8oz)', 'Pasta', 'Broccoli', 'Olive oil'] },
    ],
  },
  {
    id: 'np3',
    title: 'Active Training Fuel',
    description: 'Periodized nutrition built around your training schedule — fuel up on heavy days, recover smart on light days.',
    goal: 'Improve Endurance',
    dailyCalories: 3000,
    protein: 210,
    carbs: 340,
    fat: 78,
    isPremium: true,
    meals: [
      { id: 'm12', name: 'Early Morning', time: '6:00 AM', calories: 550, protein: 38, carbs: 65, fat: 16, foods: ['Overnight oats', 'Whey protein', 'Blueberries'] },
      { id: 'm13', name: 'Pre-Training Fuel', time: '10:30 AM', calories: 700, protein: 50, carbs: 85, fat: 15, foods: ['Turkey wrap', 'Rice cakes', 'Apple'] },
      { id: 'm14', name: 'Post-Training Recovery', time: '2:00 PM', calories: 750, protein: 60, carbs: 90, fat: 17, foods: ['Chocolate milk', 'Sweet potato', 'Chicken breast'] },
      { id: 'm15', name: 'Dinner', time: '7:00 PM', calories: 700, protein: 52, carbs: 75, fat: 20, foods: ['Salmon', 'Quinoa', 'Mixed greens', 'Olive oil'] },
      { id: 'm16', name: 'Night Recovery', time: '10:00 PM', calories: 300, protein: 30, carbs: 25, fat: 10, foods: ['Casein shake', 'Walnuts', 'Tart cherry juice'] },
    ],
  },
  {
    id: 'np4',
    title: 'Weight Loss Protocol',
    description: 'Structured plan for managing body composition — maintain performance while hitting your target weight.',
    goal: 'Lose Weight',
    dailyCalories: 2400,
    protein: 215,
    carbs: 220,
    fat: 65,
    isPremium: true,
    meals: [
      { id: 'm17', name: 'Morning', time: '7:00 AM', calories: 500, protein: 45, carbs: 45, fat: 14, foods: ['Egg whites (6)', 'Spinach', 'Whole grain toast', 'Black coffee'] },
      { id: 'm18', name: 'Midday Fuel', time: '12:00 PM', calories: 650, protein: 60, carbs: 65, fat: 16, foods: ['Grilled chicken', 'Brown rice', 'Cucumber salad'] },
      { id: 'm19', name: 'Pre-Train', time: '3:00 PM', calories: 400, protein: 35, carbs: 50, fat: 8, foods: ['Protein shake', 'Rice cakes', 'Banana'] },
      { id: 'm20', name: 'Dinner', time: '7:00 PM', calories: 650, protein: 65, carbs: 55, fat: 20, foods: ['Tilapia', 'Cauliflower rice', 'Asparagus', 'Lemon'] },
      { id: 'm21', name: 'Night Snack', time: '9:30 PM', calories: 200, protein: 25, carbs: 10, fat: 7, foods: ['Cottage cheese', 'Cucumber'] },
    ],
  },
];

// ─── Rehab Programs ───────────────────────────────────────────────────────────

const REHAB_PROGRAMS: RehabProgram[] = [
  {
    id: 'rp1',
    title: 'Lower Back Recovery',
    description: 'Evidence-based protocol to heal lower back pain — one of the most common training injuries.',
    bodyPart: 'Lower Back',
    duration: '6-8 weeks',
    phases: 3,
    exercises: [
      { id: 're1', name: 'Cat-Cow Stretch', sets: 2, reps: '10', rest: '30 sec', muscleGroup: 'Spine' },
      { id: 're2', name: 'Bird Dog', sets: 3, reps: '10 each', rest: '45 sec', muscleGroup: 'Core' },
      { id: 're3', name: 'Dead Bug', sets: 3, reps: '8 each', rest: '45 sec', muscleGroup: 'Core' },
      { id: 're4', name: 'Glute Bridge', sets: 3, reps: '15', rest: '60 sec', muscleGroup: 'Glutes' },
      { id: 're5', name: "Child's Pose", sets: 3, reps: '60 sec', rest: '30 sec', muscleGroup: 'Back' },
    ],
  },
  {
    id: 'rp2',
    title: 'Shoulder Rehabilitation',
    description: 'Restore shoulder mobility and strength after impact, throwing overuse, or blocking stress.',
    bodyPart: 'Shoulder',
    duration: '8-10 weeks',
    phases: 4,
    exercises: [
      { id: 're6', name: 'Pendulum Swings', sets: 3, reps: '30 sec', rest: '30 sec', muscleGroup: 'Shoulder' },
      { id: 're7', name: 'Band External Rotation', sets: 3, reps: '15', rest: '45 sec', muscleGroup: 'Rotator Cuff' },
      { id: 're8', name: 'Scapular Wall Slides', sets: 3, reps: '12', rest: '45 sec', muscleGroup: 'Upper Back' },
      { id: 're9', name: 'Prone Y-T-W', sets: 3, reps: '10', rest: '60 sec', muscleGroup: 'Shoulder' },
    ],
  },
  {
    id: 'rp3',
    title: 'Knee & ACL Recovery',
    description: 'Step-by-step protocol for ACL, meniscus, or general knee recovery.',
    bodyPart: 'Knee',
    duration: '10-16 weeks',
    phases: 5,
    exercises: [
      { id: 're10', name: 'Quad Sets', sets: 3, reps: '15', rest: '30 sec', muscleGroup: 'Quads' },
      { id: 're11', name: 'Straight Leg Raise', sets: 3, reps: '15', rest: '45 sec', muscleGroup: 'Quads' },
      { id: 're12', name: 'Single-Leg Balance Progression', sets: 3, reps: '30 sec each', rest: '45 sec', muscleGroup: 'Stability' },
      { id: 're13', name: 'Terminal Knee Extension', sets: 3, reps: '15', rest: '45 sec', muscleGroup: 'Quads' },
      { id: 're14', name: 'Hip Abduction Series', sets: 3, reps: '15', rest: '45 sec', muscleGroup: 'Hips' },
    ],
  },
  {
    id: 'rp4',
    title: 'Hamstring & Hip Recovery',
    description: 'Targeted recovery for hamstring strains and hip flexor injuries.',
    bodyPart: 'Hamstring / Hip',
    duration: '4-8 weeks',
    phases: 3,
    exercises: [
      { id: 're15', name: '90/90 Hip Stretch', sets: 3, reps: '60 sec', rest: '30 sec', muscleGroup: 'Hip Flexor' },
      { id: 're16', name: 'Nordic Hamstring Curl', sets: 3, reps: '6-8', rest: '90 sec', muscleGroup: 'Hamstrings' },
      { id: 're17', name: 'Prone Hip Extension', sets: 3, reps: '12 each', rest: '45 sec', muscleGroup: 'Glutes' },
      { id: 're18', name: 'Eccentric Hamstring Slide', sets: 3, reps: '8 each', rest: '60 sec', muscleGroup: 'Hamstrings' },
    ],
  },
];

// ─── Coaches ──────────────────────────────────────────────────────────────────

const COACHES: Coach[] = [
  {
    id: 'c1', name: 'Marcus Reid', title: 'Head Strength & Conditioning Coach',
    specialty: 'Football S&C / Power Development',
    bio: 'Marcus is a certified strength and conditioning specialist (NSCA-CSCS) with over 11 years of experience training football athletes at the collegiate and semi-professional levels.',
    credentials: ['NSCA-CSCS Certified', 'Former Division I S&C Coordinator', 'FMS Level 2', 'USA Weightlifting Coach'],
    specialties: ['Power Clean & Olympic Lifting', 'Combine Preparation', 'In-Season Periodization', 'Defensive Line Strength'],
    rating: 4.9, clients: 418, experience: 11, isPremium: false, initials: 'MR', color: '#2F80FF',
    coachType: 'strength', availability: ['Mon', 'Tue', 'Thu', 'Fri'], session30Price: 75, session60Price: 140,
    reviews: [
      { id: 'r1', author: 'J. Thompson', rating: 5, text: 'Marcus completely transformed my combine prep. Added 2 inches to my vertical and shaved 0.12 off my 40 time in 8 weeks.', date: 'Jun 2026' },
      { id: 'r2', author: 'D. Harris', rating: 5, text: 'Best S&C coach I have worked with. Program is position-specific and actually translates to the field.', date: 'May 2026' },
    ],
  },
  {
    id: 'c2', name: 'Sarah Chen', title: 'Sports Nutrition Coach',
    specialty: 'Football Nutrition / Body Composition',
    bio: 'Sarah is a Registered Dietitian (RD) and Board Certified Sports Dietitian (CSSD) with seven years working with competitive football players.',
    credentials: ['Registered Dietitian (RD)', 'Board Certified Sports Dietitian (CSSD)', 'Precision Nutrition L2'],
    specialties: ['Game-Day Fueling', 'Body Composition Management', 'Supplement Protocols', 'Weight Class Management'],
    rating: 4.8, clients: 305, experience: 7, isPremium: false, initials: 'SC', color: '#2196F3',
    coachType: 'nutrition', availability: ['Mon', 'Wed', 'Fri', 'Sat'], session30Price: 65, session60Price: 120,
    reviews: [
      { id: 'r4', author: 'K. Brooks', rating: 5, text: 'Sarah helped me cut 12 lbs before the season without losing any strength. Her protocols actually work.', date: 'Jun 2026' },
      { id: 'r5', author: 'R. Simmons', rating: 5, text: 'My energy levels during camp went through the roof after following her game-day plan.', date: 'May 2026' },
    ],
  },
  {
    id: 'c3', name: 'Darius Coleman', title: 'Defensive Backs Coach',
    specialty: 'DB Coverage / Cornerback Development',
    bio: 'Darius spent nine years coaching defensive backs at the Division I collegiate level, building some of the top-rated DB units in his conference.',
    credentials: ['Former Division I DB Coach (9 yrs)', 'Played CB at Power Five Program', 'AFCA Member'],
    specialties: ['Press Coverage Technique', 'Zone & Cover 2/3/4 Concepts', 'Ball-Tracking & Interception'],
    rating: 5.0, clients: 148, experience: 9, isPremium: true, initials: 'DC', color: '#9C27B0',
    coachType: 'personal', availability: ['Tue', 'Thu', 'Sat'], session30Price: 95, session60Price: 175,
    reviews: [
      { id: 'r7', author: 'A. Robinson', rating: 5, text: "Darius fixed my press coverage technique in one session. Nobody has broken it down to that level of detail.", date: 'Jul 2026' },
      { id: 'r8', author: 'T. James', rating: 5, text: 'My hips are completely different. He teaches the fundamentals at a level you can immediately apply.', date: 'Jun 2026' },
    ],
  },
  {
    id: 'c4', name: 'Priya Sharma', title: 'Sports Rehabilitation Specialist',
    specialty: 'Football Injury Rehab / Return-to-Sport',
    bio: 'Priya is a licensed Physical Therapist (DPT) with a sports rehabilitation specialty and eight years working with football athletes.',
    credentials: ['Doctor of Physical Therapy (DPT)', 'CSCS (NSCA)', 'Functional Movement Specialist (FMS)', 'Return-to-Sport Certified'],
    specialties: ['ACL/Knee Rehabilitation', 'Hamstring & Hip Recovery', 'Lower Back Protocols'],
    rating: 4.9, clients: 221, experience: 8, isPremium: false, initials: 'PS', color: '#4CAF50',
    coachType: 'rehab', availability: ['Mon', 'Wed', 'Thu', 'Fri'], session30Price: 70, session60Price: 130,
    reviews: [
      { id: 'r10', author: 'L. Williams', rating: 5, text: 'Priya cleared me to play 4 weeks ahead of schedule after my hamstring strain. Incredible rehab plan.', date: 'Jun 2026' },
      { id: 'r11', author: 'N. Moore', rating: 5, text: 'After two years of knee issues nobody could solve, Priya identified the root cause in the first session.', date: 'May 2026' },
    ],
  },
  {
    id: 'c5', name: 'Jordan Blake', title: 'Speed & Explosiveness Coach',
    specialty: 'Sprint Mechanics / First-Step Explosion',
    bio: 'Jordan is an NSCA-certified coach and former Division I sprinter who has spent 12 years specializing in football-specific speed development.',
    credentials: ['NSCA-CSCS', 'Former D1 Sprinter (100m/200m)', 'USAW Sports Performance Coach'],
    specialties: ['40-Yard Dash Mechanics', 'First-Step & Acceleration', 'Change of Direction', 'Combine Speed Events'],
    rating: 5.0, clients: 134, experience: 12, isPremium: true, initials: 'JB', color: '#D6A84B',
    coachType: 'speed', availability: ['Mon', 'Wed', 'Fri'], session30Price: 85, session60Price: 155,
    reviews: [
      { id: 'r13', author: 'P. Davis', rating: 5, text: 'Jordan took my 40 from 4.72 to 4.55 in 10 weeks. His mechanics coaching is on another level.', date: 'Jul 2026' },
      { id: 'r14', author: 'R. Thomas', rating: 5, text: 'Best speed coach period. Every drill has a purpose and he explains the biomechanics behind everything.', date: 'Jun 2026' },
    ],
  },
  {
    id: 'c6', name: 'DeShawn Williams', title: 'Linebacker & Edge Rush Coach',
    specialty: 'Linebacker Technique / Pass Rush Development',
    bio: "DeShawn played inside and outside linebacker at the Division I level and went on to coach linebackers for seven years.",
    credentials: ['Former D1 Linebacker', '7 Years Coaching LBs (HS/JUCO)', 'AFCA Member'],
    specialties: ['Blitz Package Execution', 'Run-Fit & Gap Discipline', 'Hand Fighting for LBs'],
    rating: 4.8, clients: 97, experience: 7, isPremium: true, initials: 'DW', color: '#FF6B35',
    coachType: 'personal', availability: ['Tue', 'Thu', 'Sat', 'Sun'], session30Price: 90, session60Price: 165,
    reviews: [
      { id: 'r16', author: 'C. Turner', rating: 5, text: "DeShawn's blitz timing coaching is elite. He broke down every gap assignment in complete detail.", date: 'Jun 2026' },
      { id: 'r17', author: 'M. King', rating: 5, text: 'My read-and-react speed jumped significantly. He makes complex coverages simple.', date: 'May 2026' },
    ],
  },
  {
    id: 'c7', name: 'Tony Hernandez', title: 'Quarterback Development Coach',
    specialty: 'QB Mechanics / Footwork & Decision-Making',
    bio: 'Tony is a quarterbacks coach with 14 years of experience developing signal-callers from youth football through the collegiate level.',
    credentials: ['Former Division II QB', '14 Years QB Coaching', 'AFCA Member'],
    specialties: ['Footwork & Drop Mechanics', 'Pre-Snap Reads & Progressions', 'Throwing Motion Efficiency'],
    rating: 4.9, clients: 186, experience: 14, isPremium: true, initials: 'TH', color: '#00BCD4',
    coachType: 'personal', availability: ['Mon', 'Tue', 'Wed', 'Thu'], session30Price: 100, session60Price: 185,
    reviews: [
      { id: 'r19', author: 'B. Mitchell', rating: 5, text: "Tony rebuilt my footwork from the ground up. I went from a walk-on to a starter in one off-season.", date: 'Jul 2026' },
      { id: 'r20', author: 'Q. Adams', rating: 5, text: 'His progression reads coaching helped me clean up 15 years of bad habits in three sessions.', date: 'Jun 2026' },
    ],
  },
  {
    id: 'c8', name: 'Kevin Park', title: 'Offensive Line Coach',
    specialty: 'OL Technique / Run & Pass Blocking',
    bio: 'Kevin is a former Division I offensive lineman turned coach, with nine years developing offensive linemen at the high school and college levels.',
    credentials: ['Former Division I Offensive Lineman', '9 Years OL Coaching', 'AFCA Member'],
    specialties: ['Pass Protection Footwork', 'Run Blocking Combos', 'Anchor Strength & Leverage'],
    rating: 4.7, clients: 112, experience: 9, isPremium: false, initials: 'KP', color: '#795548',
    coachType: 'personal', availability: ['Wed', 'Thu', 'Sat', 'Sun'], session30Price: 80, session60Price: 145,
    reviews: [
      { id: 'r22', author: 'T. Brown', rating: 5, text: 'Kevin fixed my kick-slide in the first session. Simple cues, huge improvement.', date: 'Jun 2026' },
      { id: 'r23', author: 'J. Clark', rating: 5, text: 'Best OL coach I have worked with. He sees everything and explains it in a way that clicks.', date: 'May 2026' },
    ],
  },
];

// ─── Conversion Functions ─────────────────────────────────────────────────────

function toWorkoutProgram(row: any): WorkoutProgram {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    trainingType: row.training_type,
    subcategory: row.subcategory,
    level: row.level,
    weeks: row.weeks,
    daysPerWeek: row.days_per_week,
    duration: row.duration_minutes,
    equipment: row.equipment || [],
    category: row.category,
    isPremium: row.is_premium,
    imageColor: row.image_color || '#2F80FF',
    coachTip: row.coach_tip || '',
    exercises: (row.exercises as any[]) || [],
    weeklySchedule: (row.weekly_schedule as any[]) || [],
  };
}

function toNutritionPlan(row: any): NutritionPlan {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    goal: row.goal,
    dailyCalories: row.daily_calories || 2000,
    protein: row.protein_target || 150,
    carbs: row.carbs_target || 200,
    fat: row.fat_target || 65,
    isPremium: row.is_premium || false,
    meals: (row.meals as any[]) || [],
  };
}

function toRehabProgram(row: any): RehabProgram {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    bodyPart: row.body_part || row.injury_type || 'General',
    duration: String(row.duration_weeks || 4),
    phases: row.phases || 3,
    exercises: (row.exercises as any[]) || [],
  };
}

// ─── Context Type ─────────────────────────────────────────────────────────────

interface AppContextType {
  workoutPrograms: WorkoutProgram[];
  nutritionPlans: NutritionPlan[];
  rehabPrograms: RehabProgram[];
  coaches: Coach[];
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
  cancelBooking: (bookingId: string, cancellationToken: string) => Promise<{ refunded: boolean; partial: boolean }>;
}

const AppContext = createContext<AppContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [workoutPrograms, setWorkoutPrograms] = useState<WorkoutProgram[]>(WORKOUT_PROGRAMS);
  const [nutritionPlans, setNutritionPlans] = useState<NutritionPlan[]>(NUTRITION_PLANS);
  const [rehabPrograms, setRehabPrograms] = useState<RehabProgram[]>(REHAB_PROGRAMS);
  const [coaches, setCoaches] = useState<Coach[]>(COACHES);
  const [progressEntries, setProgressEntries] = useState<ProgressEntry[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(null);
  const [activeNutritionId, setActiveNutritionId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [wpResult, npResult, rpResult] = await Promise.all([
          supabase.from('workout_programs').select('*').eq('is_published', true).limit(50),
          supabase.from('nutrition_plans').select('*').limit(10),
          supabase.from('rehab_programs').select('*').limit(10),
        ]);
        if (wpResult.data && wpResult.data.length > 0) {
          setWorkoutPrograms((wpResult.data as any[]).map(toWorkoutProgram));
        }
        if (npResult.data && npResult.data.length > 0) {
          setNutritionPlans((npResult.data as any[]).map(toNutritionPlan));
        }
        if (rpResult.data && rpResult.data.length > 0) {
          setRehabPrograms((rpResult.data as any[]).map(toRehabProgram));
        }
      } catch (error) {
        console.error('[AppContext] Failed to load programs from Supabase, using defaults:', error);
      }
    })();
  }, []);

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
      console.error('[AppContext] Failed to load app state:', error?.message || error);
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
    const program = WORKOUT_PROGRAMS.find((item) => item.id === programId);
    const { error } = await supabase.from('workout_sessions').insert({
      user_id: user.id,
      workout_name: program?.title ?? programId,
      completed_at: log.completedAt,
    });
    if (error) throw new Error(error.message);
    setWorkoutLogs((current) => [log, ...current]);
  }, [user]);

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

  const cancelBooking = useCallback(async (
    bookingId: string,
    cancellationToken: string
  ): Promise<{ refunded: boolean; partial: boolean }> => {
    const booking = bookings.find((b) => b.id === bookingId);

    let refunded = false;
    let partial = false;

    if (booking?.serverId) {
      // Call the server to cancel and trigger the refund.
      // Throws on network error or non-2xx response — caller must handle the error
      // and must NOT update local state so the booking stays "upcoming".
      await cancelSupabaseBooking(booking.serverId);

      refunded = false;
      partial = false;
    }
    // Bookings without a serverId/cancellationToken (e.g. demo/offline) cancel locally only.

    const updated = bookings.map((b) =>
      b.id === bookingId ? { ...b, status: 'cancelled' as const } : b
    );
    setBookings(updated);
    return { refunded, partial };
  }, [bookings]);

  const contextValue = useMemo<AppContextType>(() => ({
    workoutPrograms,
    nutritionPlans,
    rehabPrograms,
    coaches,
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
    workoutPrograms, nutritionPlans, rehabPrograms, coaches,
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
