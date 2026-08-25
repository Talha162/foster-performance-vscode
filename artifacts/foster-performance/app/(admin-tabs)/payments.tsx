import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useAuth } from '@/context/AuthContext';

const PLATFORM_FEE = 0.10;

export default function AdminPayments() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const getApiBase = () =>
    process.env.EXPO_PUBLIC_API_BASE ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${getApiBase()}/admin/bookings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json().catch(() => ({}));
      setBookings(Array.isArray(data.bookings) ? data.bookings : []);
    } catch { setBookings([]); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const totalRevenue = bookings.reduce((s, b) => s + (b.price ?? 0), 0) / 100;
  const platformRevenue = totalRevenue * PLATFORM_FEE;
  const coachPayouts = totalRevenue - platformRevenue;

  return (
    <View style={styles.root}>
      <BackgroundLayer />
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Payments</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>Revenue, commissions & payouts</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: botPad + 20 }]}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={[styles.revenueCard, { backgroundColor: '#D6A84B18', borderColor: '#D6A84B44' }]}>
              <Text style={[styles.revenueLabel, { color: '#D6A84B' }]}>Total Platform Revenue</Text>
              <Text style={[styles.revenueValue, { color: colors.foreground }]}>${totalRevenue.toFixed(2)}</Text>
            </View>

            <View style={styles.splitRow}>
              <View style={[styles.splitCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="shield-check" size={20} color={colors.primary} />
                <Text style={[styles.splitValue, { color: colors.primary }]}>${platformRevenue.toFixed(2)}</Text>
                <Text style={[styles.splitLabel, { color: colors.mutedForeground }]}>Platform Fees (10%)</Text>
              </View>
              <View style={[styles.splitCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="account-cash" size={20} color={colors.success} />
                <Text style={[styles.splitValue, { color: colors.success }]}>${coachPayouts.toFixed(2)}</Text>
                <Text style={[styles.splitLabel, { color: colors.mutedForeground }]}>Coach Payouts (90%)</Text>
              </View>
            </View>

            <View style={[styles.statsRow]}>
              {[
                { label: 'Total Bookings', value: bookings.length, icon: 'calendar-check', color: colors.primary },
                { label: 'Completed', value: bookings.filter((b) => b.status === 'completed').length, icon: 'check-circle', color: colors.success },
                { label: 'Pending', value: bookings.filter((b) => b.status === 'upcoming').length, icon: 'clock', color: colors.accent },
              ].map((s) => (
                <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <MaterialCommunityIcons name={s.icon as any} size={18} color={s.color} />
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{s.value}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Transactions</Text>
            {bookings.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="currency-usd-off" size={32} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No transactions yet</Text>
              </View>
            ) : (
              bookings.slice(0, 20).map((b, i) => {
                const gross = (b.price ?? 0) / 100;
                const fee = gross * PLATFORM_FEE;
                return (
                  <View key={i} style={[styles.txRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.txCoach, { color: colors.foreground }]}>{b.coach_name}</Text>
                      <Text style={[styles.txClient, { color: colors.mutedForeground }]}>{b.athlete_name ?? 'Client'} · {b.date}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <Text style={[styles.txGross, { color: colors.foreground }]}>${gross.toFixed(2)}</Text>
                      <Text style={[styles.txFee, { color: colors.primary }]}>+${fee.toFixed(2)} fee</Text>
                    </View>
                  </View>
                );
              })
            )}
          </>
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
  content: { padding: 16, gap: 14 },
  revenueCard: { borderRadius: 18, borderWidth: 1, padding: 20, alignItems: 'center', gap: 4 },
  revenueLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 },
  revenueValue: { fontSize: 38, fontFamily: 'Inter_700Bold' },
  splitRow: { flexDirection: 'row', gap: 10 },
  splitCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'center', gap: 4 },
  splitValue: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  splitLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 10, alignItems: 'center', gap: 3 },
  statValue: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 9, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  empty: { borderRadius: 14, borderWidth: 1, padding: 24, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  txRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 12 },
  txCoach: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  txClient: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  txGross: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  txFee: { fontSize: 11, fontFamily: 'Inter_500Medium' },
});
