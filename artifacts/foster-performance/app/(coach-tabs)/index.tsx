import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { fetchBookings } from '@/lib/coachRepository';

export default function CoachDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 84 : insets.bottom + 84;

  useEffect(() => {
    (async () => {
      try {
        if (!user?.id) {
          setBookings([]);
          return;
        }
        const bookingRows = await fetchBookings({ coachId: user.id });
        setBookings(bookingRows.slice(0, 5));
      } catch {
        setBookings([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const upcomingCount = bookings.filter((b) => b.status === 'upcoming').length;
  // Prices are stored as dollars (e.g. 75 = $75), not cents.
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.price ?? 0), 0);

  const firstName = user?.name?.split(' ')[0] ?? 'Coach';

  return (
    <View style={styles.root}>
      <BackgroundLayer />
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Welcome back,</Text>
          <Text style={[styles.name, { color: colors.foreground }]}>{firstName} 👋</Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: colors.accent + '22', borderColor: colors.accent + '55' }]}>
          <MaterialCommunityIcons name="whistle" size={12} color={colors.accent} />
          <Text style={[styles.roleBadgeText, { color: colors.accent }]}>COACH</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: botPad }]}>
        {/* Quick Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Upcoming Sessions', value: upcomingCount, icon: 'calendar-check', color: colors.primary },
            { label: 'This Month Revenue', value: `$${totalRevenue.toFixed(0)}`, icon: 'currency-usd', color: colors.accent },
            { label: 'Total Sessions', value: bookings.length, icon: 'clipboard-list', color: colors.success },
          ].map((stat) => (
            <View key={stat.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <MaterialCommunityIcons name={stat.icon as any} size={20} color={stat.color} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {[
              { icon: 'calendar', label: 'Set Availability', onPress: () => router.push('/(coach-tabs)/calendar') },
              { icon: 'clipboard-list-outline', label: 'Create Program', onPress: () => router.push('/(coach-tabs)/programs') },
              { icon: 'message-outline', label: 'Messages', onPress: () => router.push('/messages') },
              { icon: 'currency-usd', label: 'Earnings', onPress: () => router.push('/(coach-tabs)/earnings') },
            ].map((a) => (
              <Pressable
                key={a.label}
                onPress={a.onPress}
                style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
              >
                <MaterialCommunityIcons name={a.icon as any} size={22} color={colors.primary} />
                <Text style={[styles.actionLabel, { color: colors.foreground }]}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Recent Bookings */}
        <View style={styles.recentSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Sessions</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : bookings.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="calendar-blank" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No sessions yet. Once members book you, they'll appear here.
              </Text>
            </View>
          ) : (
            bookings.slice(0, 5).map((b) => (
              <View key={b.id} style={[styles.bookingRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.bookingDot, { backgroundColor: b.status === 'upcoming' ? colors.success : colors.border }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bookingClient, { color: colors.foreground }]}>{b.athlete_name ?? 'Client'}</Text>
                  <Text style={[styles.bookingMeta, { color: colors.mutedForeground }]}>{b.date} · {b.session_length} min</Text>
                </View>
                <Text style={[styles.bookingPrice, { color: colors.accent }]}>${(b.price ?? 0).toFixed(0)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  greeting: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  name: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  roleBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  content: { padding: 16, gap: 16 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 9, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  section: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { width: '47%', flexGrow: 1, borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center', gap: 6 },
  actionLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  recentSection: { gap: 10 },
  empty: { borderRadius: 14, borderWidth: 1, padding: 24, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
  bookingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  bookingDot: { width: 10, height: 10, borderRadius: 5 },
  bookingClient: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  bookingMeta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  bookingPrice: { fontSize: 15, fontFamily: 'Inter_700Bold' },
});
