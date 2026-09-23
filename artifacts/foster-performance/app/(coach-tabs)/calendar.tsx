import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useAuth } from '@/context/AuthContext';
import { MockNotice } from '@/components/ProductUI';
import { supabase } from '@/lib/supabase';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_BLOCKS = [
  '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
  '6:00 PM', '7:00 PM', '8:00 PM',
];

function toDatabaseTime(label: string) {
  const [clock, meridiem] = label.split(' ');
  const [rawHour, minute] = clock.split(':').map(Number);
  const hour = meridiem === 'PM' ? (rawHour % 12) + 12 : rawHour % 12;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

function toLabel(time: string) {
  const [hourValue, minute] = time.split(':').map(Number);
  const meridiem = hourValue >= 12 ? 'PM' : 'AM';
  const hour = hourValue % 12 || 12;
  return `${hour}:${String(minute).padStart(2, '0')} ${meridiem}`;
}

export default function CoachCalendar() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const defaultDays = Object.fromEntries(
    DAYS.map((d) => [d, ['Monday', 'Wednesday', 'Friday'].includes(d)])
  );
  const [days, setDays] = useState<Record<string, boolean>>(defaultDays);
  const [activeTimes, setActiveTimes] = useState<Record<string, boolean>>(
    Object.fromEntries(TIME_BLOCKS.map((t) => [t, ['9:00 AM', '10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM'].includes(t)]))
  );
  const [sessionDurationMins, setSessionDurationMins] = useState<number>(60);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [leadTime, setLeadTime] = useState(24);
  const [bufferTime, setBufferTime] = useState(15);
  const [cancellationWindow, setCancellationWindow] = useState(12);
  const [exceptions, setExceptions] = useState([
    { date: 'Aug 29, 2026', note: 'Blocked · Personal time', tone: 'blocked' },
    { date: 'Sep 2, 2026', note: 'Extended · 8:00 AM–6:00 PM', tone: 'open' },
  ]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 84 : insets.bottom + 84;

  // Load existing availability on mount
  useEffect(() => {
    (async () => {
      try {
        if (!user) return;
        const { data, error } = await supabase.from('coach_availability').select('*').eq('coach_id', user.id).eq('is_active', true);
        if (error) throw new Error(error.message);
        if (data?.length) {
          const loadedDays = Object.fromEntries(DAYS.map((day, index) => [day, data.some((slot) => slot.weekday === (index + 1) % 7)]));
          const loadedTimes = Object.fromEntries(TIME_BLOCKS.map((time) => [time, data.some((slot) => toLabel(slot.start_time) === time)]));
          setDays(loadedDays);
          setActiveTimes(loadedTimes);
          const first = data[0];
          const duration = (new Date(`1970-01-01T${first.end_time}Z`).getTime() - new Date(`1970-01-01T${first.start_time}Z`).getTime()) / 60_000;
          if (duration > 0) setSessionDurationMins(duration);
        }
      } catch { /* use defaults */ }
      finally { setLoading(false); }
    })();
  }, [user]);

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    try {
      if (!user) throw new Error('Authentication required');
      const removed = await supabase.from('coach_availability').delete().eq('coach_id', user.id);
      if (removed.error) throw new Error(removed.error.message);
      const slots = DAYS.flatMap((day, index) => days[day]
        ? TIME_BLOCKS.filter((time) => activeTimes[time]).map((time) => {
            const start = toDatabaseTime(time);
            const endDate = new Date(`1970-01-01T${start}Z`);
            endDate.setUTCMinutes(endDate.getUTCMinutes() + sessionDurationMins);
            return {
              coach_id: user.id,
              weekday: (index + 1) % 7,
              start_time: start,
              end_time: endDate.toISOString().slice(11, 19),
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            };
          })
        : []);
      if (slots.length) {
        const inserted = await supabase.from('coach_availability').insert(slots);
        if (inserted.error) throw new Error(inserted.error.message);
      }
      setSavedAt(new Date());
      setTimeout(() => setSavedAt(null), 3000);
    } catch {
      Alert.alert('Error', 'Could not save availability. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const activeDays = DAYS.filter((d) => days[d]);
  const activeTimesList = TIME_BLOCKS.filter((t) => activeTimes[t]);

  if (loading) {
    return (
      <View style={styles.root}>
        <BackgroundLayer />
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <BackgroundLayer />
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Calendar</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {activeDays.length} days · {activeTimesList.length} time slots
          </Text>
        </View>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: savedAt ? colors.success : colors.primary, opacity: pressed || saving ? 0.8 : 1 },
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>{savedAt ? '✓ Saved' : 'Save'}</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: botPad }]}
        showsVerticalScrollIndicator={false}
      >
        <MockNotice>Weekly rules may save to the prototype API. Exceptions, policies, conflict detection, and calendar sync remain frontend previews.</MockNotice>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Timezone</Text>
          <View style={styles.settingRow}>
            <MaterialCommunityIcons name="earth" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}><Text style={[styles.dayLabel, { color: colors.foreground }]}>Asia/Karachi</Text><Text style={[styles.cardSub, { color: colors.mutedForeground }]}>Clients see equivalent times in their local timezone.</Text></View>
            <Text style={[styles.zone, { color: colors.primary }]}>UTC+5</Text>
          </View>
        </View>
        {/* Session Duration */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Default Session Length</Text>
          <View style={styles.durationRow}>
            {([30, 60] as const).map((mins) => (
              <Pressable
                key={mins}
                onPress={() => setSessionDurationMins(mins)}
                style={[
                  styles.durationBtn,
                  {
                    backgroundColor: sessionDurationMins === mins ? colors.primary : colors.background,
                    borderColor: sessionDurationMins === mins ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.durationBtnText,
                    { color: sessionDurationMins === mins ? '#FFF' : colors.foreground },
                  ]}
                >
                  {mins} min
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Available days */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Available Days</Text>
          <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
            Toggle the days you accept bookings
          </Text>
          {DAYS.map((day, i) => (
            <View
              key={day}
              style={[
                styles.dayRow,
                {
                  borderBottomColor: colors.border,
                  borderBottomWidth: i < DAYS.length - 1 ? 1 : 0,
                },
              ]}
            >
              <View style={styles.dayLeft}>
                <View
                  style={[
                    styles.dayDot,
                    { backgroundColor: days[day] ? colors.success : colors.border },
                  ]}
                />
                <Text style={[styles.dayLabel, { color: colors.foreground }]}>{day}</Text>
              </View>
              <Switch
                value={days[day]}
                onValueChange={(v) => setDays((prev) => ({ ...prev, [day]: v }))}
                trackColor={{ false: colors.border, true: colors.primary + '88' }}
                thumbColor={days[day] ? colors.primary : '#AAA'}
              />
            </View>
          ))}
        </View>

        {/* Time slots */}
        {activeDays.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Available Time Slots</Text>
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
              Active on: {activeDays.join(', ')}
            </Text>
            <View style={styles.timeGrid}>
              {TIME_BLOCKS.map((t) => {
                const sel = activeTimes[t];
                return (
                  <Pressable
                    key={t}
                    onPress={() => setActiveTimes((prev) => ({ ...prev, [t]: !prev[t] }))}
                    style={[
                      styles.timeSlot,
                      {
                        backgroundColor: sel ? colors.primary : colors.background,
                        borderColor: sel ? colors.primary : colors.border,
                        borderWidth: sel ? 2 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.timeText, { color: sel ? '#FFF' : colors.foreground }]}>
                      {t}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {activeDays.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="calendar-blank" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Enable at least one day to set your time slots.
            </Text>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHead}><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.foreground }]}>Date Exceptions</Text><Text style={[styles.cardSub, { color: colors.mutedForeground }]}>Block a date or override weekly hours.</Text></View><Pressable onPress={() => setExceptions((items) => [...items, { date: 'Sep 8, 2026', note: 'Blocked · New exception', tone: 'blocked' }])} accessibilityRole="button" accessibilityLabel="Add date exception" style={[styles.addBtn, { borderColor: colors.primary }]}><MaterialCommunityIcons name="plus" size={18} color={colors.primary} /><Text style={[styles.addText, { color: colors.primary }]}>Add</Text></Pressable></View>
          {exceptions.map((item, index) => <View key={`${item.date}-${index}`} style={[styles.exception, { borderColor: colors.border }]}><View style={[styles.dayDot, { backgroundColor: item.tone === 'open' ? colors.success : colors.destructive }]} /><View style={{ flex: 1 }}><Text style={[styles.dayLabel, { color: colors.foreground }]}>{item.date}</Text><Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.note}</Text></View><Pressable onPress={() => setExceptions((items) => items.filter((_, i) => i !== index))} accessibilityRole="button" accessibilityLabel={`Remove exception ${item.date}`} style={styles.iconButton}><MaterialCommunityIcons name="close" size={19} color={colors.mutedForeground} /></Pressable></View>)}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Booking Policies</Text>
          {[
            { label: 'Minimum lead time', value: leadTime, set: setLeadTime, options: [2, 12, 24, 48], suffix: 'hr' },
            { label: 'Session buffer', value: bufferTime, set: setBufferTime, options: [0, 10, 15, 30], suffix: 'min' },
            { label: 'Cancellation window', value: cancellationWindow, set: setCancellationWindow, options: [6, 12, 24, 48], suffix: 'hr' },
          ].map((policy) => <View key={policy.label} style={styles.policy}><Text style={[styles.dayLabel, { color: colors.foreground }]}>{policy.label}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.policyOptions}>{policy.options.map((option) => <Pressable key={option} onPress={() => policy.set(option)} style={[styles.policyChip, { backgroundColor: policy.value === option ? colors.primary : colors.background, borderColor: policy.value === option ? colors.primary : colors.border }]}><Text style={[styles.timeText, { color: policy.value === option ? '#FFF' : colors.foreground }]}>{option}{policy.suffix}</Text></Pressable>)}</ScrollView></View>)}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Calendar Sync</Text>
          <View style={styles.settingRow}><MaterialCommunityIcons name="calendar-sync" size={24} color={colors.primary} /><View style={{ flex: 1 }}><Text style={[styles.dayLabel, { color: colors.foreground }]}>External calendar not connected</Text><Text style={[styles.cardSub, { color: colors.mutedForeground }]}>Connection and conflict imports will be enabled in Milestone 2.</Text></View></View>
          <Pressable onPress={() => Alert.alert('Calendar provider preview', 'Google, Apple, and Outlook connection will launch through a secure provider flow in Milestone 2.')} style={[styles.syncBtn, { borderColor: colors.border }]}><Text style={[styles.addText, { color: colors.foreground }]}>Preview connection flow</Text></Pressable>
          <View style={[styles.conflict, { backgroundColor: colors.destructive + '12', borderColor: colors.destructive + '55' }]}><MaterialCommunityIcons name="calendar-alert" size={19} color={colors.destructive} /><Text style={[styles.cardSub, { color: colors.foreground, flex: 1 }]}>Conflict example: Sep 4 at 2:00 PM overlaps an imported event. This slot would be unavailable.</Text></View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, minWidth: 70, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#FFF' },
  content: { padding: 16, gap: 14 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  cardTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  cardSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  durationRow: { flexDirection: 'row', gap: 10 },
  durationBtn: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  durationBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  dayLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayDot: { width: 8, height: 8, borderRadius: 4 },
  dayLabel: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeSlot: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  timeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  emptyCard: { borderRadius: 14, borderWidth: 1, padding: 28, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, zone: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10 }, addBtn: { minHeight: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 4 }, addText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  exception: { minHeight: 58, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }, iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  policy: { gap: 7, paddingTop: 4 }, policyOptions: { gap: 7 }, policyChip: { minHeight: 38, minWidth: 58, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 },
  syncBtn: { minHeight: 44, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, conflict: { flexDirection: 'row', gap: 9, padding: 11, borderWidth: 1, borderRadius: 10, alignItems: 'flex-start' },
});
