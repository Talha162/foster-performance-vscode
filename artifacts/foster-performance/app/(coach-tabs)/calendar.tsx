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

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_BLOCKS = [
  '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
  '6:00 PM', '7:00 PM', '8:00 PM',
];

function getApiBase() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api`;
  return 'http://localhost:8080/api';
}

export default function CoachCalendar() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

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

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 84 : insets.bottom + 84;

  // Load existing availability on mount
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${getApiBase()}/coaches/me/availability`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await resp.json().catch(() => ({}));
        if (data.availability?.days) {
          setDays(data.availability.days);
        }
        if (data.availability?.activeTimes) {
          setActiveTimes(data.availability.activeTimes);
        }
        if (data.availability?.sessionDurationMins) {
          setSessionDurationMins(data.availability.sessionDurationMins);
        }
      } catch { /* use defaults */ }
      finally { setLoading(false); }
    })();
  }, []);

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    try {
      const resp = await fetch(`${getApiBase()}/coaches/me/availability`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ days, activeTimes, sessionDurationMins }),
      });
      if (!resp.ok) throw new Error('Save failed');
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
});
