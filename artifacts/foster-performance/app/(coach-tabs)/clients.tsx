import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useAuth } from '@/context/AuthContext';

export default function CoachClients() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 84 : insets.bottom + 84;

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(
          `${process.env.EXPO_PUBLIC_API_BASE ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`}/bookings?coachId=${user?.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await resp.json().catch(() => ({}));
        const bookings: any[] = Array.isArray(data.bookings) ? data.bookings : [];
        // Deduplicate by athlete email
        const seen = new Set<string>();
        const unique = bookings.filter((b) => {
          if (seen.has(b.athlete_email)) return false;
          seen.add(b.athlete_email);
          return true;
        });
        setClients(unique);
      } catch { setClients([]); }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <View style={styles.root}>
      <BackgroundLayer />
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Clients</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {loading ? 'Loading…' : `${clients.length} client${clients.length !== 1 ? 's' : ''}`}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad }]} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : clients.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="account-multiple-outline" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No clients yet</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              Once members book sessions with you, they'll appear here.
            </Text>
          </View>
        ) : (
          clients.map((c, i) => (
            <View key={i} style={[styles.clientCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.avatar, { backgroundColor: colors.primary + '22' }]}>
                <Text style={[styles.avatarText, { color: colors.primary }]}>
                  {(c.athlete_name ?? 'C').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.clientName, { color: colors.foreground }]}>{c.athlete_name ?? 'Client'}</Text>
                <Text style={[styles.clientEmail, { color: colors.mutedForeground }]}>{c.athlete_email ?? ''}</Text>
              </View>
              <View style={[styles.sessionBadge, { backgroundColor: colors.success + '22' }]}>
                <Text style={[styles.sessionBadgeText, { color: colors.success }]}>Active</Text>
              </View>
            </View>
          ))
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
  content: { padding: 16, gap: 10 },
  empty: { borderRadius: 16, borderWidth: 1, padding: 32, alignItems: 'center', gap: 8, marginTop: 20 },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  emptyDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
  clientCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  clientName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  clientEmail: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  sessionBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  sessionBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
});
