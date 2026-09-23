import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useAuth } from '@/context/AuthContext';
import { fetchBookings } from '@/lib/coachRepository';

const PLATFORM_FEE = 0.10; // 10%

export default function CoachEarnings() {
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
        setBookings(user ? await fetchBookings({ coachId: user.id }) : []);
      } catch { setBookings([]); }
      finally { setLoading(false); }
    })();
  }, [user]);

  // Prices are stored as dollars (e.g. 75 = $75), not cents — no division needed.
  const grossRevenue = bookings.reduce((s, b) => s + (b.price ?? 0), 0);
  const platformFees = grossRevenue * PLATFORM_FEE;
  const netEarnings = grossRevenue - platformFees;
  const pendingCount = bookings.filter((b) => b.status === 'upcoming').length;

  return (
    <View style={styles.root}>
      <BackgroundLayer />
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Earnings</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>Revenue & payout summary</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad }]} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Main earnings card */}
            <View style={[styles.mainCard, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}>
              <Text style={[styles.mainLabel, { color: colors.primary }]}>Net Earnings (All Time)</Text>
              <Text style={[styles.mainValue, { color: colors.foreground }]}>${netEarnings.toFixed(2)}</Text>
              <View style={styles.breakdownRow}>
                <View style={styles.breakdownItem}>
                  <Text style={[styles.bLabel, { color: colors.mutedForeground }]}>Gross Revenue</Text>
                  <Text style={[styles.bValue, { color: colors.foreground }]}>${grossRevenue.toFixed(2)}</Text>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.breakdownItem}>
                  <Text style={[styles.bLabel, { color: colors.mutedForeground }]}>Platform Fees (10%)</Text>
                  <Text style={[styles.bValue, { color: '#FF5050' }]}>-${platformFees.toFixed(2)}</Text>
                </View>
              </View>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              {[
                { label: 'Total Sessions', value: bookings.length, icon: 'clipboard-check-outline', color: colors.success },
                { label: 'Upcoming', value: pendingCount, icon: 'clock-outline', color: colors.accent },
                { label: 'Avg per Session', value: `$${bookings.length ? (netEarnings / bookings.length).toFixed(0) : '0'}`, icon: 'trending-up', color: colors.primary },
              ].map((s) => (
                <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <MaterialCommunityIcons name={s.icon as any} size={20} color={s.color} />
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{s.value}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* Payout settings */}
            <Pressable
              onPress={() => router.push('/payout-settings')}
              style={({ pressed }) => [styles.payoutCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
            >
              <MaterialCommunityIcons name="bank-outline" size={24} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.payoutTitle, { color: colors.foreground }]}>Payout Settings</Text>
                <Text style={[styles.payoutDesc, { color: colors.mutedForeground }]}>
                  Connect your bank account to receive payouts. Payouts are processed weekly.
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/payout-lifecycle' as any)}
              style={({ pressed }) => [styles.payoutCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
            >
              <MaterialCommunityIcons name="bank-outline" size={24} color={colors.primary} />
              <View style={{ flex: 1 }}><Text style={[styles.payoutTitle, { color: colors.foreground }]}>Payout Lifecycle Preview</Text><Text style={[styles.payoutDesc, { color: colors.mutedForeground }]}>Provider onboarding, requirements, pending, paid, refunded, and disputed settlement states.</Text></View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </Pressable>

            {/* Recent transactions */}
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Transactions</Text>
            {bookings.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="currency-usd-off" size={32} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No transactions yet</Text>
              </View>
            ) : (
              bookings.slice(0, 10).map((b, i) => {
                const gross = b.price ?? 0; // stored as dollars
                const net = gross * (1 - PLATFORM_FEE);
                return (
                  <View key={i} style={[styles.txRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.txIcon, { backgroundColor: colors.success + '22' }]}>
                      <MaterialCommunityIcons name="arrow-down" size={16} color={colors.success} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.txClient, { color: colors.foreground }]}>{b.athlete_name ?? 'Client'}</Text>
                      <Text style={[styles.txMeta, { color: colors.mutedForeground }]}>{b.date} · {b.session_length}min</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.txNet, { color: colors.success }]}>+${net.toFixed(2)}</Text>
                      <Text style={[styles.txGross, { color: colors.mutedForeground }]}>${gross.toFixed(2)} gross</Text>
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
  header: { paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  content: { padding: 16, gap: 16 },
  mainCard: { borderRadius: 20, borderWidth: 1, padding: 20, gap: 8, alignItems: 'center' },
  mainLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 },
  mainValue: { fontSize: 40, fontFamily: 'Inter_700Bold' },
  breakdownRow: { flexDirection: 'row', width: '100%', gap: 16, marginTop: 4 },
  breakdownItem: { flex: 1, alignItems: 'center', gap: 2 },
  divider: { width: 1, height: '100%' },
  bLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  bValue: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 9, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  payoutCard: { flexDirection: 'row', gap: 12, borderRadius: 14, borderWidth: 1, padding: 16, alignItems: 'flex-start' },
  payoutTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  payoutDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  empty: { borderRadius: 14, borderWidth: 1, padding: 24, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  txIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  txClient: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  txMeta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  txNet: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  txGross: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});
