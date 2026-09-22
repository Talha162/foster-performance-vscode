import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const NAV_ITEMS = [
  { label: 'Applications', icon: 'file-document-edit-outline', route: '/(admin-tabs)/applications', desc: 'Review & approve coach applications', color: '#D6A84B' },
  { label: 'Members', icon: 'account-multiple-outline', route: '/(admin-tabs)/members', desc: 'Manage member accounts', color: '#2F80FF' },
  { label: 'Coaches', icon: 'whistle-outline', route: '/(admin-tabs)/coaches', desc: 'Manage approved coaches', color: '#35C98A' },
  { label: 'Bookings', icon: 'calendar-check-outline', route: '/(admin-tabs)/bookings', desc: 'View all platform bookings', color: '#A78BFA' },
  { label: 'Payments', icon: 'credit-card-outline', route: '/(admin-tabs)/payments', desc: 'Revenue, commissions & payouts', color: '#F59E0B' },
  { label: 'Settings', icon: 'cog-outline', route: '/(admin-tabs)/settings', desc: 'Platform fees & configuration', color: '#9AA3B5' },
  { label: 'Audit Log', icon: 'shield-search-outline', route: '/(admin-tabs)/audit-log', desc: 'Review privileged and security activity', color: '#60A5FA' },
  { label: 'Support', icon: 'lifebuoy', route: '/(admin-tabs)/support', desc: 'Triage cases and prepare responses', color: '#F472B6' },
  { label: 'Engagement', icon: 'chart-timeline-variant', route: '/(admin-tabs)/engagement', desc: 'Retention signals and broadcasts', color: '#22D3EE' },
  { label: 'Moderation', icon: 'shield-alert-outline', route: '/(admin-tabs)/moderation', desc: 'Review reports and enforcement', color: '#FB7185' },
] as const;

export default function AdminDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  useEffect(() => {
    (async () => {
      try {
        const [members, coaches, applications, bookings] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'member'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'coach'),
          supabase.from('coach_applications').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
          supabase.from('bookings').select('price_cents', { count: 'exact', head: true }),
        ]);
        const revenue = (bookings.data ?? []).reduce((sum, b: any) => sum + (b.price_cents ?? 0), 0) / 100;
        setStats({
          totalMembers: members.count ?? 0,
          totalCoaches: coaches.count ?? 0,
          pendingApplications: applications.count ?? 0,
          totalBookings: bookings.count ?? 0,
          platformRevenue: revenue,
        });
      } catch {
        /* non-fatal */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/welcome');
  };

  return (
    <View style={styles.root}>
      <BackgroundLayer />

      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <View style={styles.headerTop}>
            <View style={[styles.adminBadge, { backgroundColor: '#D6A84B22', borderColor: '#D6A84B55' }]}>
              <MaterialCommunityIcons name="shield-crown" size={12} color="#D6A84B" />
              <Text style={[styles.adminBadgeText, { color: '#D6A84B' }]}>OWNER ADMIN</Text>
            </View>
          </View>
          <Text style={[styles.greeting, { color: colors.foreground }]}>Admin Portal</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>Foster Performance · {user?.email}</Text>
        </View>
        <Pressable onPress={handleLogout} style={[styles.logoutBtn, { borderColor: colors.border }]}>
          <Feather name="log-out" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: botPad + 32 }]}>
        {/* Platform stats */}
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
        ) : stats && (
          <View style={styles.statsRow}>
            {[
              { label: 'Members', value: stats.members ?? 0, color: '#2F80FF' },
              { label: 'Coaches', value: stats.coaches ?? 0, color: '#35C98A' },
              { label: 'Applicants', value: stats.applicants ?? 0, color: '#D6A84B' },
              { label: 'Bookings', value: stats.bookings ?? 0, color: '#A78BFA' },
            ].map((s) => (
              <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Navigation cards */}
        <View style={styles.navGrid}>
          {NAV_ITEMS.map((item) => (
            <Pressable
              key={item.label}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(item.route as any); }}
              style={({ pressed }) => [styles.navCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
            >
              <View style={[styles.navIconWrap, { backgroundColor: item.color + '22' }]}>
                <MaterialCommunityIcons name={item.icon as any} size={24} color={item.color} />
              </View>
              <Text style={[styles.navLabel, { color: colors.foreground }]}>{item.label}</Text>
              <Text style={[styles.navDesc, { color: colors.mutedForeground }]}>{item.desc}</Text>
              <Feather name="chevron-right" size={14} color={colors.mutedForeground} style={styles.navChevron} />
            </Pressable>
          ))}
        </View>

        <View style={[styles.secureNote, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="shield-lock-outline" size={14} color={colors.mutedForeground} />
          <Text style={[styles.secureText, { color: colors.mutedForeground }]}>
            This portal is protected. Access is granted only to the account registered as Owner Admin in the server configuration.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  headerTop: { marginBottom: 4 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start' },
  adminBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  greeting: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  logoutBtn: { padding: 8, borderRadius: 8, borderWidth: 1 },
  content: { padding: 16, gap: 16 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 10, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 9, fontFamily: 'Inter_500Medium' },
  navGrid: { gap: 10 },
  navCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 2 },
  navIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  navLabel: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  navDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  navChevron: { position: 'absolute', right: 16, top: '50%' },
  secureNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1 },
  secureText: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
});
