import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useAuth } from '@/context/AuthContext';

export default function AdminCoaches() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [coaches, setCoaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const getApiBase = () =>
    process.env.EXPO_PUBLIC_API_BASE ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${getApiBase()}/admin/users?role=coach`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json().catch(() => ({}));
      setCoaches(Array.isArray(data.users) ? data.users : []);
    } catch { setCoaches([]); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleSuspend = async (userId: number, name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      await fetch(`${getApiBase()}/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: 'member' }),
      });
      await load();
    } catch {}
  };

  return (
    <View style={styles.root}>
      <BackgroundLayer />
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Approved Coaches</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>{coaches.length} active coaches</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: botPad + 20 }]}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : coaches.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="whistle-outline" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No approved coaches yet</Text>
            <Pressable onPress={() => router.push('/(admin-tabs)/applications')} style={[styles.reviewBtn, { backgroundColor: colors.primary }]}>
              <Text style={[styles.reviewBtnText, { color: colors.primaryForeground }]}>Review Applications</Text>
            </Pressable>
          </View>
        ) : (
          coaches.map((c) => (
            <View key={c.id} style={[styles.coachCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.avatar, { backgroundColor: colors.accent + '22' }]}>
                <Text style={[styles.avatarText, { color: colors.accent }]}>
                  {(c.name ?? 'C').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.coachName, { color: colors.foreground }]}>{c.name}</Text>
                <Text style={[styles.coachEmail, { color: colors.mutedForeground }]}>{c.email}</Text>
              </View>
              <Pressable
                onPress={() => handleSuspend(c.id, c.name)}
                style={({ pressed }) => [styles.suspendBtn, { borderColor: '#FF5050', opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={styles.suspendText}>Suspend</Text>
              </Pressable>
            </View>
          ))
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
  content: { padding: 16, gap: 10 },
  empty: { borderRadius: 14, borderWidth: 1, padding: 32, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  reviewBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  reviewBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  coachCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, padding: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  coachName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  coachEmail: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  suspendBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  suspendText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#FF5050' },
});
