import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { ScreenState } from '@/components/ScreenState';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { fetchCoach } from '@/lib/coachRepository';
import { supabase } from '@/lib/supabase';

const TIME_SLOTS = [
  '9:00 AM', '10:00 AM', '11:00 AM',
  '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
];

function getNextDays(n: number) {
  const days: { label: string; short: string; value: string; fullDay: string }[] = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const fullDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    days.push({
      label: `${monthNames[d.getMonth()]} ${d.getDate()}`,
      short: dayNames[d.getDay()],
      value: d.toISOString().split('T')[0],
      fullDay: fullDayNames[d.getDay()],
    });
  }
  return days;
}

const NEXT_DAYS = getNextDays(7);

/** Derive the API base URL from the Expo public domain env var. */
function bookingStart(date: string, time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2})\s+(AM|PM)$/i);
  if (!match) throw new Error('Invalid session time.');
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hour += 12;
  const start = new Date(`${date}T00:00:00`);
  start.setHours(hour, Number(match[2]), 0, 0);
  return start;
}

export default function BookSessionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { coachId, sessionLength: initialLength } = useLocalSearchParams<{
    coachId: string;
    sessionLength?: string;
  }>();
  const { coaches } = useApp();
  const { user } = useAuth();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  // Try AppContext coaches first; if not found and id is "api_N", fetch from API.
  const localCoach = coaches.find((c) => c.id === coachId);
  const [apiCoach, setApiCoach] = useState<any>(null);
  const [coachLoading, setCoachLoading] = useState(!localCoach && !!coachId);

  useEffect(() => {
    if (localCoach || !coachId) return;
    (async () => {
      setCoachLoading(true);
      try {
        const c = await fetchCoach(coachId);
        // GET /coaches/:id returns { coach: formatCoach(row) } — normalised already
        if (c && c.name) {
          const name = c.name as string;
          const initials = name
            .split(' ')
            .map((w: string) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
          // Deterministic colour from numeric application id
          const color = c.color;
          // prices is already a parsed object: { session30: number|null, session60: number|null }
          // Null means the coach hasn't priced that length — keep as null so the UI can hide it.
          const s30: number | null = c.session30Price;
          const s60: number | null = c.session60Price;
          // weeklyAvailability is normalised by formatCoach to { days, activeTimes, sessionDurationMins }
          const weeklyAvailability = { days: Object.fromEntries((c.availability ?? []).map((day: string) => [day, true])), activeTimes: {} };
          setApiCoach({ id: coachId, name, initials, color, session30Price: s30, session60Price: s60, weeklyAvailability });
        }
      } catch { /* will fall through to null coach */ }
      finally { setCoachLoading(false); }
    })();
  }, [coachId, localCoach]);

  const coach = localCoach ?? apiCoach;

  // --- Availability filtering (API coaches only) ---
  // apiCoach.weeklyAvailability is normalised to { days: Record<string,bool>, activeTimes: Record<string,bool> }
  // AppContext coaches have no availability data so all days/times remain available.
  const availDays: Record<string, boolean> | null =
    apiCoach?.weeklyAvailability?.days ?? null;
  const availTimes: Record<string, boolean> | null =
    apiCoach?.weeklyAvailability?.activeTimes ?? null;

  // Use availability config when it has been explicitly set (has keys), even if
  // all values are false — a coach with all days disabled shows no bookable dates.
  // Null (AppContext coaches) falls back to showing everything.
  const hasDayConfig = availDays !== null && Object.keys(availDays).length > 0;
  const hasTimeConfig = availTimes !== null && Object.keys(availTimes).length > 0;

  const filteredDays = hasDayConfig
    ? NEXT_DAYS.filter((d) => availDays![d.fullDay] === true)
    : NEXT_DAYS;

  const filteredTimes = hasTimeConfig
    ? TIME_SLOTS.filter((t) => availTimes![t] === true)
    : TIME_SLOTS;

  const [sessionLength, setSessionLength] = useState<30 | 60>(
    initialLength === '30' ? 30 : 60
  );
  const [selectedDate, setSelectedDate] = useState(NEXT_DAYS[0].value);
  const [selectedTime, setSelectedTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (filteredDays.length > 0 && !filteredDays.some((day) => day.value === selectedDate)) {
      setSelectedDate(filteredDays[0].value);
      setSelectedTime('');
    }
  }, [filteredDays, selectedDate]);

  if (coachLoading) {
    return <ScreenState title="Loading coach" message="Checking this coach's availability…" loading />;
  }

  if (!coach) {
    return (
      <ScreenState
        icon="account-off-outline"
        title="Coach unavailable"
        message="We couldn't find that coach. They may have been removed or are not accepting sessions right now."
        onBack={() => router.back()}
        actionLabel="Browse Coaches"
        onAction={() => router.replace('/(tabs)/coaches')}
      />
    );
  }

  const price = sessionLength === 30 ? coach.session30Price : coach.session60Price;
  const selectedDayObj = filteredDays.find((d) => d.value === selectedDate)
    ?? NEXT_DAYS.find((d) => d.value === selectedDate);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!selectedTime) e.time = 'Please select a time slot';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleConfirm = async () => {
    if (!validate()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLoading(true);

    try {
      const returnUrl = Linking.createURL('/session-confirmation');
      const { data, error: billingError } = await supabase.functions.invoke('billing', {
        body: {
          action: 'create-booking-checkout',
          coachId: coach.id,
          sessionLength,
          startsAt: bookingStart(selectedDate, selectedTime).toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          returnUrl,
        },
      });
      if (billingError) throw billingError;
      if (!data?.checkoutUrl) throw new Error('Secure checkout is unavailable.');
      const checkout = await WebBrowser.openAuthSessionAsync(data.checkoutUrl, returnUrl);
      if (checkout.type !== 'success') return;

      setLoading(false);
      router.replace({
        pathname: '/session-confirmation',
        params: {
          coachId: coach.id,
          coachName: coach.name,
          coachInitials: coach.initials,
          coachColor: coach.color,
          sessionLength: String(sessionLength),
          price: String(price),
          date: selectedDate,
          dateLabel: selectedDayObj?.label ?? selectedDate,
          dayShort: selectedDayObj?.short ?? '',
          time: selectedTime,
          bookingId: data.bookingId ?? '',
          // Only show email confirmation badge if the server confirmed delivery
          emailSent: '0',
          athleteEmail: user?.email ?? '',
          persistenceError: '',
        },
      });
    } catch (err: any) {
      // Network error or unexpected failure — explicit, not silent
      setLoading(false);
      Alert.alert(
        'Connection Error',
        'Could not reach the payment server. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <View style={styles.root}>
      <BackgroundLayer />
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Book a Session</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>with {coach.name}</Text>
        </View>
        {/* Coach avatar */}
        <View style={[styles.miniAvatar, { backgroundColor: coach.color + '22' }]}>
          <Text style={[styles.miniAvatarText, { color: coach.color }]}>{coach.initials}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 120 }]}
      >
        {/* Session Length — only show lengths with a valid price */}
        <SectionLabel label="Session Length" />
        {(() => {
          const available = ([30, 60] as const).filter((len) =>
            len === 30 ? coach.session30Price != null : coach.session60Price != null
          );
          if (available.length === 0) {
            return (
              <View style={[styles.emptyAvail, { backgroundColor: colors.muted }]}>
                <Feather name="tag" size={16} color={colors.mutedForeground} />
                <Text style={[styles.emptyAvailText, { color: colors.mutedForeground }]}>
                  This coach hasn't set session prices yet.
                </Text>
              </View>
            );
          }
          return (
            <View style={styles.lengthRow}>
              {available.map((len) => {
                const p = len === 30 ? coach.session30Price : coach.session60Price;
                const sel = sessionLength === len;
                return (
                  <Pressable
                    key={len}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSessionLength(len);
                    }}
                    style={[
                      styles.lengthCard,
                      {
                        backgroundColor: sel ? coach.color + '18' : colors.card,
                        borderColor: sel ? coach.color : colors.border,
                        borderWidth: sel ? 2 : 1,
                        flex: 1,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={len === 30 ? 'timer-outline' : 'timer'}
                      size={22}
                      color={sel ? coach.color : colors.mutedForeground}
                    />
                    <Text style={[styles.lengthMin, { color: sel ? coach.color : colors.foreground }]}>
                      {len} min
                    </Text>
                    <Text style={[styles.lengthPrice, { color: sel ? coach.color : colors.mutedForeground }]}>
                      ${p}
                    </Text>
                    <Text style={[styles.lengthDesc, { color: colors.mutedForeground }]}>
                      {len === 30 ? 'Focused review' : 'Full session'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          );
        })()}

        {/* Date Picker */}
        <SectionLabel label="Select a Date" />
        {filteredDays.length === 0 ? (
          <View style={[styles.emptyAvail, { backgroundColor: colors.muted }]}>
            <Feather name="calendar" size={16} color={colors.mutedForeground} />
            <Text style={[styles.emptyAvailText, { color: colors.mutedForeground }]}>
              This coach hasn't set available days yet.
            </Text>
          </View>
        ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateScroll}>
          {filteredDays.map((day) => {
            const sel = selectedDate === day.value;
            return (
              <Pressable
                key={day.value}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedDate(day.value);
                  setSelectedTime('');
                }}
                style={[
                  styles.dateCard,
                  {
                    backgroundColor: sel ? coach.color : colors.card,
                    borderColor: sel ? coach.color : colors.border,
                  },
                ]}
              >
                <Text style={[styles.dateDow, { color: sel ? 'rgba(255,255,255,0.8)' : colors.mutedForeground }]}>
                  {day.short}
                </Text>
                <Text style={[styles.dateNum, { color: sel ? '#FFFFFF' : colors.foreground }]}>
                  {day.label.split(' ')[1]}
                </Text>
                <Text style={[styles.dateMon, { color: sel ? 'rgba(255,255,255,0.8)' : colors.mutedForeground }]}>
                  {day.label.split(' ')[0]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        )}

        {/* Time Slots */}
        <SectionLabel label="Select a Time" />
        {errors.time && <Text style={[styles.errorText, { color: '#EF4444' }]}>{errors.time}</Text>}
        {filteredTimes.length === 0 ? (
          <View style={[styles.emptyAvail, { backgroundColor: colors.muted }]}>
            <Feather name="clock" size={16} color={colors.mutedForeground} />
            <Text style={[styles.emptyAvailText, { color: colors.mutedForeground }]}>
              This coach hasn't set available time slots yet.
            </Text>
          </View>
        ) : (
        <View style={styles.timeGrid}>
          {filteredTimes.map((slot) => {
            const sel = selectedTime === slot;
            return (
              <Pressable
                key={slot}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedTime(slot);
                  setErrors((e) => ({ ...e, time: '' }));
                }}
                style={[
                  styles.timeSlot,
                  {
                    backgroundColor: sel ? coach.color : colors.card,
                    borderColor: sel ? coach.color : colors.border,
                    borderWidth: sel ? 2 : 1,
                  },
                ]}
              >
                <Text style={[styles.timeSlotText, { color: sel ? '#FFFFFF' : colors.foreground }]}>
                  {slot}
                </Text>
              </Pressable>
            );
          })}
        </View>
        )}

        {/* Payment */}
        <SectionLabel label="Secure Payment" />
        <View style={[styles.payCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.payHeader}>
            <MaterialCommunityIcons name="shield-lock" size={22} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.payHeaderText, { color: colors.foreground }]}>Stripe Checkout</Text>
              <Text style={[styles.secureNoteText, { color: colors.mutedForeground }]}>Your card details are entered securely on Stripe after you confirm.</Text>
            </View>
          </View>
        </View>

        {/* Order Summary */}
        <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>Order Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{coach.name}</Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>{sessionLength}-min session</Text>
          </View>
          {selectedDayObj && selectedTime ? (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
                {selectedDayObj.short}, {selectedDayObj.label}
              </Text>
              <Text style={[styles.summaryValue, { color: colors.foreground }]}>{selectedTime}</Text>
            </View>
          ) : null}
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryTotal, { color: colors.foreground }]}>Total</Text>
            <Text style={[styles.summaryTotalValue, { color: coach.color }]}>${price}</Text>
          </View>
        </View>

        <View style={[styles.secureNote, { borderColor: colors.border }]}>
          <MaterialCommunityIcons name="shield-lock" size={14} color={colors.mutedForeground} />
          <Text style={[styles.secureNoteText, { color: colors.mutedForeground }]}>
            Payments are processed securely via Stripe. A confirmation email will be sent after booking.
          </Text>
        </View>
      </ScrollView>

      {/* Confirm Button */}
      <View style={[styles.ctaBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: botPad + 16 }]}>
        <Pressable
          onPress={handleConfirm}
          disabled={loading}
          style={({ pressed }) => [
            styles.ctaBtn,
            { backgroundColor: coach.color, opacity: pressed || loading ? 0.8 : 1 },
          ]}
        >
          {loading ? (
            <>
              <MaterialCommunityIcons name="loading" size={20} color="#FFFFFF" />
              <Text style={styles.ctaBtnText}>Processing Payment…</Text>
            </>
          ) : (
            <>
              <MaterialCommunityIcons name="lock" size={20} color="#FFFFFF" />
              <Text style={styles.ctaBtnText}>Confirm & Pay ${price}</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function SectionLabel({ label }: { label: string }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionLabel, { color: colors.foreground }]}>{label}</Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  miniAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  content: { padding: 20, gap: 4 },
  sectionLabel: { fontSize: 15, fontFamily: 'Inter_700Bold', marginTop: 16, marginBottom: 10 },
  lengthRow: { flexDirection: 'row', gap: 12 },
  lengthCard: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  lengthMin: { fontSize: 18, fontFamily: 'Inter_700Bold', marginTop: 4 },
  lengthPrice: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  lengthDesc: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  dateScroll: { gap: 10, paddingVertical: 2 },
  dateCard: {
    width: 64,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  dateDow: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  dateNum: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  dateMon: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timeSlot: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 90,
    alignItems: 'center',
  },
  timeSlotText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  payCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12, marginTop: 6 },
  payHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  payHeaderText: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  cardLogos: { flexDirection: 'row', gap: 4 },
  cardLogo: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  cardLogoText: { fontSize: 9, fontFamily: 'Inter_700Bold' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
  },
  input: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', height: 46 },
  rowInputs: { flexDirection: 'row', gap: 10 },
  emptyAvail: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 12 },
  emptyAvailText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  errorText: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: -6 },
  summary: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10, marginTop: 12 },
  summaryTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  summaryValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  summaryDivider: { height: 1 },
  summaryTotal: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  summaryTotalValue: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  secureNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 4,
  },
  secureNoteText: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  ctaBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 14,
  },
  ctaBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
});
