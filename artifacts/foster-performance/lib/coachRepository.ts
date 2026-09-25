import type { Booking, Coach } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';

const colors = ['#2F80FF', '#9C27B0', '#35C98A', '#FF6B35', '#00BCD4', '#E91E8C'];

function hashColor(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

function dayLabel(day: number) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day] ?? '';
}

function toCoach(row: any): Coach {
  const name = row.profile?.full_name ?? 'Foster Coach';
  const specialties = row.specialties ?? [];
  return {
    id: row.user_id,
    name,
    title: row.professional_title || 'Certified Coach',
    specialty: specialties[0] ?? '',
    bio: row.biography ?? '',
    credentials: row.credentials ?? [],
    specialties,
    rating: Number(row.rating ?? 0),
    reviews: (row.profile?.coach_reviews ?? []).map((review: any) => ({
      id: review.id,
      author: review.member?.full_name ?? 'Member',
      rating: review.rating,
      text: review.review_text,
      date: review.created_at,
    })),
    clients: row.client_count ?? 0,
    experience: row.experience_years ?? 0,
    isPremium: false,
    initials: name.split(' ').map((part: string) => part[0] ?? '').join('').slice(0, 2).toUpperCase(),
    color: hashColor(row.user_id),
    coachType: row.coach_type ?? 'personal',
    availability: Array.from(new Set((row.profile?.coach_availability ?? []).filter((slot: any) => slot.is_active).map((slot: any) => dayLabel(slot.weekday)))),
    availabilitySlots: (row.profile?.coach_availability ?? [])
      .filter((slot: any) => slot.is_active)
      .map((slot: any) => ({ weekday: slot.weekday, startTime: slot.start_time, endTime: slot.end_time })),
    session30Price: Math.round((row.session_30_price_cents ?? 5500) / 100),
    session60Price: Math.round((row.session_60_price_cents ?? 9000) / 100),
  } as Coach;
}

async function hydrateCoaches(rows: any[]): Promise<Coach[]> {
  if (rows.length === 0) return [];

  const coachIds = rows.map((row) => row.user_id);
  // Coaches and review authors are people the viewer usually has no
  // relationship with, so RLS hides their profile rows. Display fields come
  // from a definer function that returns a name and avatar and nothing else.
  const [profilesResult, availabilityResult, reviewsResult] = await Promise.all([
    supabase.rpc('public_display_profiles', { p_user_ids: coachIds }),
    supabase.from('coach_availability').select('*').in('coach_id', coachIds),
    supabase.from('coach_reviews')
      .select('id, coach_id, member_id, rating, review_text, created_at')
      .in('coach_id', coachIds),
  ]);

  const firstError = profilesResult.error ?? availabilityResult.error ?? reviewsResult.error;
  if (firstError) throw new Error(firstError.message);

  const reviews = reviewsResult.data ?? [];
  const authors = await supabase.rpc('public_display_profiles', {
    p_user_ids: Array.from(new Set(reviews.map((review: any) => review.member_id).filter(Boolean))),
  });
  if (authors.error) throw new Error(authors.error.message);
  const authorById = new Map<string, any>((authors.data ?? []).map((a: any) => [a.id, a]));

  const coachProfiles = (profilesResult.data ?? []) as any[];

  return rows.map((row) => toCoach({
    ...row,
    profile: {
      ...coachProfiles.find((profile) => profile.id === row.user_id),
      coach_availability: (availabilityResult.data ?? []).filter((slot) => slot.coach_id === row.user_id),
      coach_reviews: reviews
        .filter((review: any) => review.coach_id === row.user_id)
        .map((review: any) => ({ ...review, member: authorById.get(review.member_id) ?? null })),
    },
  }));
}

export async function fetchCoaches(): Promise<Coach[]> {
  const { data, error } = await supabase
    .from('coach_profiles')
    .select('*')
    .eq('accepting_clients', true)
    .order('rating', { ascending: false });
  if (error) throw new Error(error.message);
  return hydrateCoaches(data ?? []);
}

export async function fetchCoach(coachId: string): Promise<Coach | null> {
  const { data, error } = await supabase.from('coach_profiles').select('*').eq('user_id', coachId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [coach] = await hydrateCoaches([data]);
  return coach;
}

export type BookingRow = {
  id: string;
  member_id: string;
  coach_id: string;
  athlete_name: string;
  athlete_email: string;
  coach_name: string;
  session_length: number;
  price: number;
  date: string;
  time: string;
  starts_at: string;
  status: string;
};

function toBookingRow(row: any): BookingRow {
  const start = new Date(row.starts_at);
  return {
    id: row.id,
    member_id: row.member_id,
    coach_id: row.coach_id,
    athlete_name: row.member?.full_name ?? 'Member',
    athlete_email: row.member?.email ?? '',
    coach_name: row.coach?.full_name ?? 'Coach',
    session_length: row.session_length_minutes,
    price: Number(row.price_cents ?? 0) / 100,
    date: start.toISOString().slice(0, 10),
    time: start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    starts_at: row.starts_at,
    status: row.status,
  };
}

export async function fetchBookings(filters: { coachId?: string; memberId?: string } = {}): Promise<BookingRow[]> {
  let query = supabase.from('bookings').select(`
    *, member:profiles!bookings_member_id_fkey(full_name, email),
    coach:profiles!bookings_coach_id_fkey(full_name)
  `).order('starts_at', { ascending: false });
  if (filters.coachId) query = query.eq('coach_id', filters.coachId);
  if (filters.memberId) query = query.eq('member_id', filters.memberId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(toBookingRow);
}

export async function createBooking(input: {
  memberId: string;
  coachId: string;
  sessionLength: 30 | 60;
  price: number;
  startsAt: string;
  timezone: string;
  notes?: string;
}) {
  const start = new Date(input.startsAt);
  const end = new Date(start.getTime() + input.sessionLength * 60_000);
  const { data, error } = await supabase.from('bookings').insert({
    member_id: input.memberId,
    coach_id: input.coachId,
    session_length_minutes: input.sessionLength,
    price_cents: Math.round(input.price * 100),
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    timezone: input.timezone,
    member_notes: input.notes ?? null,
    status: input.price > 0 ? 'pending' : 'upcoming',
  }).select('id').single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function cancelBooking(bookingId: string) {
  const { error } = await supabase.from('bookings').update({
    status: 'cancelled',
    cancelled_at: new Date().toISOString(),
  }).eq('id', bookingId);
  if (error) throw new Error(error.message);
}

export function bookingRowToAppBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    serverId: row.id,
    coachId: row.coach_id,
    coachName: row.coach_name,
    coachInitials: row.coach_name.split(' ').map((part) => part[0] ?? '').join('').slice(0, 2),
    coachColor: hashColor(row.coach_id),
    sessionLength: row.session_length as 30 | 60,
    price: row.price,
    date: row.date,
    time: row.time,
    status: row.status === 'completed' ? 'completed' : row.status === 'cancelled' ? 'cancelled' : 'upcoming',
    createdAt: row.starts_at,
  };
}
