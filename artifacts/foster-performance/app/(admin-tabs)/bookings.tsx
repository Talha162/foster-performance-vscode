import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { fetchBookings } from '@/lib/coachRepository';

const STATUS_COLORS: Record<string, string> = {
  upcoming: '#2F80FF',
  completed: '#35C98A',
  cancelled: '#FF5050',
};

export default function AdminBookings() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBookings(await fetchBookings());
    } catch { setBookings([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);

  return (
    <View style={styles.root}>
      <BackgroundLayer />
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>All Bookings</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>{bookings.length} total bookings</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {['all', 'upcoming', 'completed', 'cancelled'].map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.chip, { backgroundColor: filter === f ? colors.primary : colors.card, borderColor: filter === f ? colors.primary : colors.border }]}
          >
            <Text style={[styles.chipText, { color: filter === f ? colors.primaryForeground : colors.mutedForeground }]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: botPad + 20 }]}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="calendar-blank" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No bookings found</Text>
          </View>
        ) : (
          filtered.map((b, i) => {
            const price = b.price ?? 0;
            const sc = STATUS_COLORS[b.status] ?? colors.border;
            return (
              <View key={i} style={[styles.bookingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.statusDot, { backgroundColor: sc }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.coachName, { color: colors.foreground }]}>{b.coach_name ?? 'Coach'}</Text>
                  <Text style={[styles.clientName, { color: colors.mutedForeground }]}>
                    {b.athlete_name ?? 'Member'} · {b.date}
                  </Text>
                  <Text style={[styles.duration, { color: colors.mutedForeground }]}>
                    {b.session_length ? `${b.session_length} min` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[styles.price, { color: colors.foreground }]}>${price.toFixed(2)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: sc + '22' }]}>
                    <Text style={[styles.statusText, { color: sc }]}>{b.status}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, gap: 12 },
  backBtn: { paddingBottom: 2 },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  content: { padding: 16, gap: 10 },
  empty: { borderRadius: 14, borderWidth: 1, padding: 32, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  bookingCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 2 },
  coachName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  clientName: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  duration: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  price: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
});
