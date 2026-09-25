import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View, Modal, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const STATUS_COLORS: Record<string, string> = {
  Incomplete: '#9AA3B5', Submitted: '#2F80FF', 'Pending Review': '#D6A84B',
  'More Information Required': '#FF9500', Approved: '#35C98A',
  Rejected: '#FF5050', Suspended: '#FF5050',
};

const STATUSES = ['Pending Review', 'More Information Required', 'Approved', 'Rejected', 'Suspended'];

export default function AdminApplications() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  useAuth();
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [newStatus, setNewStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [filter, setFilter] = useState('all');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const loadApps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.from('coach_applications').select(`
        *, profile:profiles!coach_applications_user_id_fkey(full_name, email)
      `).order('created_at', { ascending: false });
      if (error) throw error;
      const statusLabels: Record<string, string> = {
        incomplete: 'Incomplete', submitted: 'Submitted', under_review: 'Pending Review',
        approved: 'Approved', rejected: 'Rejected',
      };
      setApps((data ?? []).map((app: any) => ({
        ...app,
        fullName: app.profile?.full_name,
        userEmail: app.profile?.email,
        professionalTitle: app.professional_title,
        biography: app.biography,
        adminNotes: app.admin_notes,
        submittedAt: app.submitted_at,
        status: statusLabels[app.status] ?? app.status,
      })));
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to load applications';
      console.error('[AdminApplications] Load error:', err);
      setError(errorMsg);
      setApps([]);
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadApps(); }, [loadApps]);

  const handleUpdate = async () => {
    if (!selected || !newStatus) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setUpdating(true);
    try {
      const { error } = await supabase.rpc('review_coach_application', {
        p_application_id: selected.id,
        p_status: newStatus,
        p_admin_notes: notes || null,
      });
      if (error) throw error;
      setSelected(null);
      setNotes('');
      await loadApps();
    } finally { setUpdating(false); }
  };

  const filtered = filter === 'all' ? apps : apps.filter((a) => a.status === filter);

  return (
    <View style={styles.root}>
      <BackgroundLayer />
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Coach Applications</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>{apps.length} total</Text>
        </View>
      </View>

      {/* Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {['all', 'Submitted', 'Pending Review', 'More Information Required', 'Approved', 'Rejected'].map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterChip, { backgroundColor: filter === f ? colors.primary : colors.card, borderColor: filter === f ? colors.primary : colors.border }]}
          >
            <Text style={[styles.filterText, { color: filter === f ? colors.primaryForeground : colors.mutedForeground }]}>
              {f === 'all' ? 'All' : f}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: botPad + 20 }]}>
        {error ? (
          <View style={[styles.error, { backgroundColor: '#FF5050' + '15', borderColor: '#FF5050' }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={36} color="#FF5050" />
            <Text style={[styles.errorTitle, { color: '#FF5050' }]}>Failed to Load</Text>
            <Text style={[styles.errorText, { color: colors.mutedForeground }]}>{error}</Text>
            <Pressable onPress={loadApps} style={[styles.retryBtn, { backgroundColor: '#FF5050' }]}>
              <Text style={[styles.retryBtnText]}>Retry</Text>
            </Pressable>
          </View>
        ) : loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="file-document-outline" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No applications found</Text>
          </View>
        ) : (
          filtered.map((app) => (
            <Pressable
              key={app.id}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelected(app); setNewStatus(app.status); setNotes(app.adminNotes ?? ''); }}
              style={({ pressed }) => [styles.appCard, { backgroundColor: colors.card, borderColor: STATUS_COLORS[app.status] + '55', opacity: pressed ? 0.85 : 1 }]}
            >
              <View style={styles.appHeader}>
                <View style={[styles.initials, { backgroundColor: colors.primary + '22' }]}>
                  <Text style={[styles.initialsText, { color: colors.primary }]}>
                    {(app.fullName ?? app.userName ?? '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.appName, { color: colors.foreground }]}>{app.fullName ?? app.userName}</Text>
                  <Text style={[styles.appEmail, { color: colors.mutedForeground }]}>{app.userEmail}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[app.status] + '22' }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[app.status] }]}>{app.status}</Text>
                </View>
              </View>
              {app.professionalTitle && (
                <Text style={[styles.appTitle, { color: colors.mutedForeground }]}>{app.professionalTitle}</Text>
              )}
              {app.submittedAt && (
                <Text style={[styles.appDate, { color: colors.mutedForeground }]}>
                  Submitted: {new Date(app.submittedAt).toLocaleDateString()}
                </Text>
              )}
            </Pressable>
          ))
        )}
      </ScrollView>

      {/* Review Modal */}
      <Modal visible={!!selected} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setSelected(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: botPad + 20 }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Review Application</Text>
            <Text style={[styles.sheetName, { color: colors.mutedForeground }]}>
              {selected?.fullName ?? selected?.userName} · {selected?.userEmail}
            </Text>
            {selected?.professionalTitle && (
              <Text style={[styles.sheetProfTitle, { color: colors.foreground }]}>{selected.professionalTitle}</Text>
            )}
            {selected?.biography && (
              <Text style={[styles.sheetBio, { color: colors.mutedForeground }]} numberOfLines={3}>{selected.biography}</Text>
            )}

            <Text style={[styles.sLabel, { color: colors.mutedForeground }]}>Update Status</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}>
              {STATUSES.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setNewStatus(s); }}
                  style={[styles.statusChip, { backgroundColor: newStatus === s ? STATUS_COLORS[s] + '22' : colors.background, borderColor: newStatus === s ? STATUS_COLORS[s] : colors.border }]}
                >
                  <Text style={[styles.statusChipText, { color: newStatus === s ? STATUS_COLORS[s] : colors.mutedForeground }]}>{s}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={[styles.sLabel, { color: colors.mutedForeground }]}>Notes for applicant (optional)</Text>
            <TextInput
              style={[styles.notesInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Add notes visible to the applicant..."
              placeholderTextColor={colors.mutedForeground}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Pressable
              onPress={handleUpdate}
              disabled={updating || !newStatus}
              style={({ pressed }) => [styles.updateBtn, { backgroundColor: STATUS_COLORS[newStatus] ?? colors.primary, opacity: pressed || updating ? 0.8 : 1 }]}
            >
              {updating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.updateBtnText}>Save Decision</Text>}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, gap: 12 },
  backBtn: { paddingBottom: 2 },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  // See coaches.tsx: pin the horizontal scroller so chips keep their height.
  filterScroll: { flexGrow: 0, flexShrink: 0 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: 'center' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  content: { padding: 16, gap: 10 },
  error: { borderRadius: 14, borderWidth: 2, padding: 24, alignItems: 'center', gap: 12, marginTop: 20 },
  errorTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  errorText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 8 },
  retryBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#FFF' },
  empty: { borderRadius: 14, borderWidth: 1, padding: 32, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  appCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  appHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  initials: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  appName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  appEmail: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  appTitle: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  appDate: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, padding: 20, gap: 12 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  sheetTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  sheetName: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  sheetProfTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  sheetBio: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  sLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', marginTop: 4 },
  statusRow: { gap: 8 },
  statusChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  statusChipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  notesInput: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 13, fontFamily: 'Inter_400Regular', height: 80 },
  updateBtn: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  updateBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#FFF' },
});
