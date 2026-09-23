import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const SUB_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:   { label: 'Active',   color: '#35C98A' },
  trial:    { label: 'Trial',    color: '#2F80FF' },
  pending:  { label: 'Pending',  color: '#F5A623' },
  past_due: { label: 'Past Due', color: '#FF5050' },
  canceled: { label: 'Canceled', color: '#9AA3B5' },
  expired:  { label: 'Expired',  color: '#FF5050' },
};

export default function AdminMembers() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [acting, setActing] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('role', 'member').order('created_at', { ascending: false });
      if (error) throw error;
      setUsers((data ?? []).map((profile: any) => ({ ...profile, name: profile.full_name, account_type: profile.role })));
    } catch {
      setUsers([]);
      setLoadError('We could not load the member directory. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(
    (u) =>
      !search ||
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSuspend = async (u: any) => {
    const willSuspend = !u.is_suspended;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      willSuspend ? 'Suspend Member' : 'Restore Member',
      willSuspend
        ? `Suspend ${u.name}? They will lose premium access and cannot book sessions. Their data is preserved.`
        : `Restore ${u.name}? They will regain normal access.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: willSuspend ? 'Suspend' : 'Restore',
          style: willSuspend ? 'destructive' : 'default',
          onPress: async () => {
            setActing(true);
            try {
              const { error } = await supabase.from('profiles').update({
                is_suspended: willSuspend,
                ...(willSuspend ? { is_premium: false } : {}),
              }).eq('id', u.id);
              if (error) throw error;
              setSelected(null);
              await load();
            } catch {}
            finally { setActing(false); }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <BackgroundLayer />
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Members</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {users.length} registered member{users.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search by name or email…"
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 20 }]}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : loadError ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="cloud-alert-outline" size={36} color="#FF5050" />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Members unavailable</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{loadError}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={load}
              style={({ pressed }) => [styles.retryBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
            >
              <Feather name="refresh-cw" size={15} color={colors.primaryForeground} />
              <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Retry</Text>
            </Pressable>
          </View>
        ) : filtered.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="account-search" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No members found</Text>
          </View>
        ) : (
          filtered.map((u) => {
            const subInfo = u.subscription_status
              ? SUB_STATUS_LABELS[u.subscription_status] ?? { label: u.subscription_status, color: '#9AA3B5' }
              : null;

            return (
              <Pressable
                key={u.id}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelected(u); }}
                style={({ pressed }) => [
                  styles.userCard,
                  {
                    backgroundColor: u.is_suspended ? colors.card + 'AA' : colors.card,
                    borderColor: u.is_suspended ? '#FF505044' : colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View style={[styles.avatar, { backgroundColor: u.is_suspended ? '#FF505022' : colors.primary + '22' }]}>
                  <Text style={[styles.avatarText, { color: u.is_suspended ? '#FF5050' : colors.primary }]}>
                    {(u.name ?? 'M').charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.userName, { color: colors.foreground }]} numberOfLines={1}>
                      {u.name}
                    </Text>
                    {u.is_suspended && (
                      <View style={styles.suspendedTag}>
                        <Text style={styles.suspendedTagText}>SUSPENDED</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.userEmail, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {u.email}
                  </Text>
                  <View style={styles.metaRow}>
                    {subInfo && (
                      <View style={[styles.subPill, { backgroundColor: subInfo.color + '22' }]}>
                        <Text style={[styles.subPillText, { color: subInfo.color }]}>{subInfo.label}</Text>
                      </View>
                    )}
                    <Text style={[styles.joinDate, { color: colors.mutedForeground }]}>
                      Joined {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </Text>
                  </View>
                </View>

                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Member detail modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: colors.card }]}
            onPress={(e) => e.stopPropagation()}
          >
            {selected && (() => {
              const sub = selected.subscription_status
                ? SUB_STATUS_LABELS[selected.subscription_status] ?? { label: selected.subscription_status, color: '#9AA3B5' }
                : null;
              return (
                <>
                  <View style={styles.modalHandle} />
                  <Text style={[styles.modalName, { color: colors.foreground }]}>{selected.name}</Text>
                  <Text style={[styles.modalEmail, { color: colors.mutedForeground }]}>{selected.email}</Text>

                  <View style={[styles.infoGrid, { borderColor: colors.border }]}>
                    <InfoRow label="Member Since" value={selected.created_at ? new Date(selected.created_at).toLocaleDateString() : '—'} colors={colors} />
                    <InfoRow label="Account Type" value={selected.account_type ?? '—'} colors={colors} />
                    <InfoRow
                      label="Subscription"
                      value={sub?.label ?? 'Free'}
                      valueColor={sub?.color}
                      colors={colors}
                    />
                    {selected.subscription_end_date && (
                      <InfoRow
                        label="Sub Ends"
                        value={new Date(selected.subscription_end_date).toLocaleDateString()}
                        colors={colors}
                      />
                    )}
                    <InfoRow
                      label="Status"
                      value={selected.is_suspended ? 'Suspended' : 'Active'}
                      valueColor={selected.is_suspended ? '#FF5050' : '#35C98A'}
                      colors={colors}
                    />
                  </View>

                  <Pressable
                    onPress={() => handleSuspend(selected)}
                    disabled={acting}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      {
                        backgroundColor: selected.is_suspended ? '#35C98A22' : '#FF505018',
                        borderColor: selected.is_suspended ? '#35C98A55' : '#FF505055',
                        opacity: pressed || acting ? 0.7 : 1,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={selected.is_suspended ? 'account-check-outline' : 'account-cancel-outline'}
                      size={18}
                      color={selected.is_suspended ? '#35C98A' : '#FF5050'}
                    />
                    <Text
                      style={[
                        styles.actionBtnText,
                        { color: selected.is_suspended ? '#35C98A' : '#FF5050' },
                      ]}
                    >
                      {acting ? 'Working…' : selected.is_suspended ? 'Restore Account' : 'Suspend Account'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setSelected(null)}
                    style={[styles.closeBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                  >
                    <Text style={[styles.closeBtnText, { color: colors.foreground }]}>Close</Text>
                  </Pressable>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function InfoRow({
  label,
  value,
  valueColor,
  colors,
}: {
  label: string;
  value: string;
  valueColor?: string;
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
}) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: valueColor ?? colors.foreground }]}>{value}</Text>
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
    gap: 12,
  },
  backBtn: { paddingBottom: 2 },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  content: { paddingHorizontal: 16, gap: 8 },
  empty: { borderRadius: 14, borderWidth: 1, padding: 32, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  emptyText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  retryBtn: {
    minHeight: 44, paddingHorizontal: 18, borderRadius: 11,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 4,
  },
  retryText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', flex: 1 },
  suspendedTag: { backgroundColor: '#FF505022', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  suspendedTagText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#FF5050', letterSpacing: 0.5 },
  userEmail: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  subPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  subPillText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  joinDate: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#9AA3B555', alignSelf: 'center', marginBottom: 8 },
  modalName: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  modalEmail: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  infoGrid: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  infoLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  infoValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  actionBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  closeBtn: { height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  closeBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
