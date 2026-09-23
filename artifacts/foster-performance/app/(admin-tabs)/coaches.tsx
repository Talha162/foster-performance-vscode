import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function AdminCoaches() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  useAuth();
  const [coaches, setCoaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('role', 'coach').order('created_at', { ascending: false });
      if (error) throw error;
      setCoaches((data ?? []).map((profile: any) => ({ ...profile, name: profile.full_name })));
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to load coaches';
      console.error('[AdminCoaches] Load error:', err);
      setError(errorMsg);
      setCoaches([]);
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSuspend = async (userId: string, name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const { error } = await supabase.from('profiles').update({ is_suspended: true }).eq('id', userId);
      if (error) throw error;
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
        {error ? (
          <View style={[styles.error, { backgroundColor: '#FF5050' + '15', borderColor: '#FF5050' }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={36} color="#FF5050" />
            <Text style={[styles.errorTitle, { color: '#FF5050' }]}>Failed to Load</Text>
            <Text style={[styles.errorText, { color: colors.mutedForeground }]}>{error}</Text>
            <Pressable onPress={load} style={[styles.retryBtn, { backgroundColor: '#FF5050' }]}>
              <Text style={[styles.retryBtnText]}>Retry</Text>
            </Pressable>
          </View>
        ) : loading ? (
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
  error: { borderRadius: 14, borderWidth: 2, padding: 24, alignItems: 'center', gap: 12, marginTop: 20 },
  errorTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  errorText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 8 },
  retryBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#FFF' },
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
