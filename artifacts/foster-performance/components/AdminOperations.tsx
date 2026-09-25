import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { PageHeader, SearchField, SectionCard, StatusPill } from '@/components/ProductUI';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type Mode = 'audit' | 'support' | 'engagement' | 'moderation';

/** Shape the list and detail sheet render, whichever table the row came from. */
type OpsRow = {
  id: string;
  recordId: string;
  title: string;
  actor: string;
  meta: string;
  status: string;
  detail: string;
};

const COPY = {
  audit: { title: 'Audit Log', subtitle: 'Administrative and security activity', icon: 'shield-search' },
  support: { title: 'Support Operations', subtitle: 'Queues, cases, and response workflow', icon: 'lifebuoy' },
  engagement: { title: 'Engagement', subtitle: 'Retention signals and operational load', icon: 'chart-timeline-variant' },
  moderation: { title: 'Moderation', subtitle: 'Reports, content review, and enforcement', icon: 'shield-alert-outline' },
} as const;

const FILTERS: Record<Exclude<Mode, 'engagement'>, string[]> = {
  audit: ['All', 'Sensitive', 'Routine'],
  support: ['All', 'Open', 'In progress', 'Waiting', 'Resolved', 'Closed'],
  moderation: ['All', 'Open', 'Reviewing', 'Actioned', 'Dismissed'],
};

// Actions that move money, roles or access deserve their own pill in a security
// log rather than blending into routine activity.
const SENSITIVE_ACTIONS = [
  'coach_application_reviewed', 'platform_setting_changed', 'account_deleted',
  'role_changed', 'member_suspended', 'refund_issued', 'payout_released',
];

const TICKET_STATUS_LABELS: Record<string, string> = {
  open: 'Open', in_progress: 'In progress', waiting_on_member: 'Waiting',
  resolved: 'Resolved', closed: 'Closed',
};
const MODERATION_STATUS_LABELS: Record<string, string> = {
  open: 'Open', reviewing: 'Reviewing', actioned: 'Actioned', dismissed: 'Dismissed',
};

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days} day${days === 1 ? '' : 's'} ago` : new Date(iso).toLocaleDateString();
}

/** "coach_application_reviewed" -> "Coach application reviewed" */
function humanize(value: string): string {
  const spaced = String(value ?? '').replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

type ProfileLite = { id: string; full_name: string | null; email: string | null };

/**
 * Names are resolved with a second query rather than a PostgREST embed. The
 * embedded form relies on foreign-key inference that has already failed once in
 * this project, and these screens are the ones an admin least wants blank.
 */
async function hydrateProfiles(ids: (string | null | undefined)[]): Promise<Map<string, ProfileLite>> {
  const unique = Array.from(new Set(ids.filter((id): id is string => !!id)));
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase.from('profiles').select('id, full_name, email').in('id', unique);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((row) => [row.id, row as ProfileLite]));
}

const describe = (profile?: ProfileLite) => profile?.full_name || profile?.email || 'Unknown user';

async function loadAudit(): Promise<OpsRow[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, actor_id, action, entity_type, entity_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const profiles = await hydrateProfiles(rows.map((row: any) => row.actor_id));
  return rows.map((row: any) => ({
    id: `EVT-${row.id}`,
    recordId: String(row.id),
    title: humanize(row.action),
    actor: row.actor_id ? describe(profiles.get(row.actor_id)) : 'System',
    meta: `${humanize(row.entity_type)}${row.entity_id ? ` · ${row.entity_id}` : ''} · ${timeAgo(row.created_at)}`,
    status: SENSITIVE_ACTIONS.includes(row.action) ? 'Sensitive' : 'Routine',
    detail: row.details && Object.keys(row.details).length > 0
      ? Object.entries(row.details).map(([key, value]) => `${humanize(key)}: ${String(value)}`).join('\n')
      : 'No additional detail was recorded for this event.',
  }));
}

async function loadSupport(): Promise<OpsRow[]> {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('id, user_id, assigned_to, subject, category, priority, status, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const profiles = await hydrateProfiles(rows.flatMap((row: any) => [row.user_id, row.assigned_to]));
  return rows.map((row: any) => ({
    id: `SUP-${String(row.id).slice(0, 8)}`,
    recordId: row.id,
    title: row.subject,
    actor: describe(profiles.get(row.user_id)),
    meta: `${humanize(row.category)} · ${TICKET_STATUS_LABELS[row.status] ?? row.status} · ${timeAgo(row.created_at)}`,
    status: row.priority === 'urgent' || row.priority === 'high'
      ? 'Urgent'
      : TICKET_STATUS_LABELS[row.status] ?? row.status,
    detail: [
      `Priority: ${humanize(row.priority)}`,
      `Category: ${humanize(row.category)}`,
      `Assigned to: ${row.assigned_to ? describe(profiles.get(row.assigned_to)) : 'Nobody yet'}`,
    ].join('\n'),
  }));
}

async function loadModeration(): Promise<OpsRow[]> {
  const { data, error } = await supabase
    .from('moderation_reports')
    .select('id, reporter_id, reported_user_id, reason, details, status, resolution, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const profiles = await hydrateProfiles(rows.flatMap((row: any) => [row.reporter_id, row.reported_user_id]));
  return rows.map((row: any) => ({
    id: `MOD-${String(row.id).slice(0, 8)}`,
    recordId: row.id,
    title: humanize(row.reason),
    actor: `Reported by ${row.reporter_id ? describe(profiles.get(row.reporter_id)) : 'a removed account'}`,
    meta: `${row.reported_user_id ? describe(profiles.get(row.reported_user_id)) : 'Unknown subject'} · ${MODERATION_STATUS_LABELS[row.status] ?? row.status} · ${timeAgo(row.created_at)}`,
    status: MODERATION_STATUS_LABELS[row.status] ?? row.status,
    detail: `${row.details || 'The reporter did not add extra detail.'}${row.resolution ? `\n\nResolution: ${row.resolution}` : ''}`,
  }));
}

type Engagement = {
  members: number; coaches: number; onboarded: number;
  withWorkout: number; withBooking: number; repeatBooking: number;
  newMembers7d: number; upcomingBookings: number; openTickets: number; openReports: number;
};

async function loadEngagement(): Promise<Engagement> {
  const since7d = new Date(Date.now() - 7 * 86400000).toISOString();
  const countOf = async (table: string, apply: (q: any) => any): Promise<number> => {
    const { count, error } = await apply(supabase.from(table).select('*', { count: 'exact', head: true }));
    if (error) throw new Error(error.message);
    return count ?? 0;
  };

  // The funnel steps past signup need *distinct* users, which a head-count
  // cannot express, so these two pull ids and dedupe here.
  const [sessions, bookings] = await Promise.all([
    supabase.from('workout_sessions').select('user_id').limit(5000),
    supabase.from('bookings').select('member_id').limit(5000),
  ]);
  const firstError = sessions.error ?? bookings.error;
  if (firstError) throw new Error(firstError.message);

  const bookingCounts = new Map<string, number>();
  for (const row of bookings.data ?? []) {
    bookingCounts.set(row.member_id, (bookingCounts.get(row.member_id) ?? 0) + 1);
  }

  const [members, coaches, onboarded, newMembers7d, upcomingBookings, openTickets, openReports] = await Promise.all([
    countOf('profiles', (q) => q.eq('role', 'member')),
    countOf('profiles', (q) => q.eq('role', 'coach')),
    countOf('profiles', (q) => q.eq('onboarding_complete', true)),
    countOf('profiles', (q) => q.gte('created_at', since7d)),
    countOf('bookings', (q) => q.gt('starts_at', new Date().toISOString()).neq('status', 'cancelled')),
    countOf('support_tickets', (q) => q.in('status', ['open', 'in_progress', 'waiting_on_member'])),
    countOf('moderation_reports', (q) => q.in('status', ['open', 'reviewing'])),
  ]);

  return {
    members, coaches, onboarded, newMembers7d, upcomingBookings, openTickets, openReports,
    withWorkout: new Set((sessions.data ?? []).map((row) => row.user_id)).size,
    withBooking: bookingCounts.size,
    repeatBooking: Array.from(bookingCounts.values()).filter((n) => n > 1).length,
  };
}

function toneFor(status: string): 'info' | 'success' | 'warning' | 'danger' | 'muted' {
  if (status === 'Urgent' || status === 'Sensitive') return 'danger';
  if (status === 'Resolved' || status === 'Actioned') return 'success';
  if (status === 'Dismissed' || status === 'Closed' || status === 'Routine') return 'muted';
  return 'warning';
}

export function AdminOperations({ mode }: { mode: Mode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState<OpsRow | null>(null);
  const [note, setNote] = useState('');
  const [rows, setRows] = useState<OpsRow[]>([]);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const copy = COPY[mode];
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 36 : insets.bottom + 24;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'engagement') setEngagement(await loadEngagement());
      else if (mode === 'audit') setRows(await loadAudit());
      else if (mode === 'support') setRows(await loadSupport());
      else setRows(await loadModeration());
    } catch (err: any) {
      console.error(`[AdminOperations:${mode}] load failed:`, err?.message ?? err);
      setError(err?.message ?? 'Could not load this view.');
      setRows([]);
      setEngagement(null);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => rows.filter((item) => {
    const haystack = `${item.id} ${item.title} ${item.actor} ${item.meta} ${item.status}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (filter === 'All' || item.status === filter);
  }), [rows, query, filter]);

  const assignTicket = async (row: OpsRow) => {
    if (!user) return;
    setWorking(true);
    try {
      const { error: updateError } = await supabase
        .from('support_tickets')
        .update({ assigned_to: user.id, status: 'in_progress' })
        .eq('id', row.recordId);
      if (updateError) throw new Error(updateError.message);
      setSelected(null);
      await load();
    } catch (err: any) {
      Alert.alert('Could not assign case', err?.message ?? 'Please try again.');
    } finally { setWorking(false); }
  };

  const addInternalNote = async (row: OpsRow) => {
    if (!user || !note.trim()) return;
    setWorking(true);
    try {
      const { error: insertError } = await supabase.from('support_messages').insert({
        ticket_id: row.recordId,
        sender_id: user.id,
        body: note.trim(),
        is_internal: true,
      });
      if (insertError) throw new Error(insertError.message);
      setNote('');
      setSelected(null);
      Alert.alert('Note saved', 'The internal note was added to this case.');
      await load();
    } catch (err: any) {
      Alert.alert('Could not save note', err?.message ?? 'Please try again.');
    } finally { setWorking(false); }
  };

  const resolveReport = async (row: OpsRow, status: 'actioned' | 'dismissed') => {
    if (!user) return;
    setWorking(true);
    try {
      const { error: updateError } = await supabase
        .from('moderation_reports')
        .update({ status, resolution: note.trim() || null, assigned_to: user.id })
        .eq('id', row.recordId);
      if (updateError) throw new Error(updateError.message);
      setNote('');
      setSelected(null);
      await load();
    } catch (err: any) {
      Alert.alert('Could not update report', err?.message ?? 'Please try again.');
    } finally { setWorking(false); }
  };

  const errorBlock = error ? (
    <View style={[styles.errorCard, { borderColor: colors.destructive, backgroundColor: colors.destructive + '14' }]}>
      <MaterialCommunityIcons name="alert-circle-outline" size={22} color={colors.destructive} />
      <Text style={[styles.rowTitle, { color: colors.destructive }]}>Could not load this view</Text>
      <Text style={[styles.small, { color: colors.mutedForeground }]}>{error}</Text>
      <Pressable onPress={load} style={[styles.secondary, { borderColor: colors.border }]}>
        <Feather name="refresh-cw" size={16} color={colors.foreground} />
        <Text style={[styles.secondaryText, { color: colors.foreground }]}>Retry</Text>
      </Pressable>
    </View>
  ) : null;

  if (mode === 'engagement') {
    const funnel: [string, number][] = engagement ? [
      ['Registered', engagement.members + engagement.coaches],
      ['Onboarding complete', engagement.onboarded],
      ['First workout', engagement.withWorkout],
      ['First booking', engagement.withBooking],
      ['Repeat booking', engagement.repeatBooking],
    ] : [];
    const top = funnel.length ? Math.max(funnel[0][1], 1) : 1;

    return (
      <View style={styles.root}><BackgroundLayer /><View style={{ paddingTop: topPad }}><PageHeader title={copy.title} subtitle={copy.subtitle} /></View>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
          {errorBlock}
          {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} /> : engagement && (
            <>
              <View style={styles.metricGrid}>
                {([['Members', engagement.members], ['Coaches', engagement.coaches], ['Upcoming bookings', engagement.upcomingBookings], ['New in 7 days', engagement.newMembers7d]] as [string, number][]).map(([label, value]) => (
                  <View key={label} style={[styles.metric, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
                    <Text style={[styles.small, { color: colors.mutedForeground }]}>{label}</Text>
                  </View>
                ))}
              </View>
              <SectionCard title="Lifecycle funnel" subtitle="Distinct accounts that reached each step">
                {funnel.map(([label, value]) => (
                  <View key={label} style={styles.funnelRow}>
                    <Text style={[styles.funnelLabel, { color: colors.foreground }]}>{label}</Text>
                    <View style={[styles.track, { backgroundColor: colors.muted }]}>
                      <View style={[styles.fill, { backgroundColor: colors.primary, width: `${Math.round((value / top) * 100)}%` as any }]} />
                    </View>
                    <Text style={[styles.percent, { color: colors.mutedForeground }]}>{value}</Text>
                  </View>
                ))}
              </SectionCard>
              <SectionCard title="Operational queue" subtitle="Work waiting on an administrator">
                {([['Open support cases', engagement.openTickets], ['Open moderation reports', engagement.openReports]] as [string, number][]).map(([label, value]) => (
                  <View key={label} style={styles.segment}>
                    <Text style={[styles.rowTitle, { color: colors.foreground }]}>{label}</Text>
                    <StatusPill label={String(value)} tone={value > 0 ? 'warning' : 'success'} />
                  </View>
                ))}
              </SectionCard>
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}><BackgroundLayer /><View style={{ paddingTop: topPad }}><PageHeader title={copy.title} subtitle={copy.subtitle} /></View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]} keyboardShouldPersistTaps="handled">
        {errorBlock}
        <SearchField value={query} onChangeText={setQuery} placeholder={`Search ${mode === 'audit' ? 'events' : mode === 'support' ? 'cases' : 'reports'}…`} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filters}>
          {FILTERS[mode].map((item) => (
            <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, { borderColor: filter === item ? colors.primary : colors.border, backgroundColor: filter === item ? colors.primary + '20' : colors.card }]}>
              <Text style={[styles.filterText, { color: filter === item ? colors.primary : colors.mutedForeground }]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} /> : (
          <>
            <Text style={[styles.results, { color: colors.mutedForeground }]}>{visible.length} result{visible.length === 1 ? '' : 's'}</Text>
            {visible.length ? visible.map((item) => (
              <Pressable key={item.id} onPress={() => { setSelected(item); setNote(''); }} style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.78 : 1 }]}>
                <View style={[styles.icon, { backgroundColor: colors.primary + '18' }]}>
                  <MaterialCommunityIcons name={copy.icon as any} size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.rowId, { color: colors.primary }]}>{item.id}</Text>
                    <StatusPill label={item.status} tone={toneFor(item.status)} />
                  </View>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[styles.small, { color: colors.mutedForeground }]}>{item.actor}</Text>
                  <Text style={[styles.small, { color: colors.mutedForeground }]}>{item.meta}</Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </Pressable>
            )) : !error && (
              <SectionCard>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  {rows.length === 0 ? 'Nothing recorded yet' : 'No matching results'}
                </Text>
                <Text style={[styles.small, { color: colors.mutedForeground }]}>
                  {rows.length === 0
                    ? mode === 'audit'
                      ? 'Privileged actions are written here as they happen.'
                      : mode === 'support'
                        ? 'Cases raised by members will appear here.'
                        : 'Reports submitted by members will appear here.'
                    : 'Clear the search or choose another status.'}
                </Text>
              </SectionCard>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: bottomPad }]}>
            <View style={styles.sheetTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{selected?.id}</Text>
                <Text style={[styles.small, { color: colors.mutedForeground }]}>{selected?.title}</Text>
              </View>
              <Pressable onPress={() => setSelected(null)} style={styles.close}><Feather name="x" size={22} color={colors.foreground} /></Pressable>
            </View>
            <Text style={[styles.detail, { color: colors.foreground }]}>{selected?.detail}</Text>
            <View style={[styles.context, { borderColor: colors.border }]}>
              <Text style={[styles.small, { color: colors.mutedForeground }]}>Actor / reporter</Text>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>{selected?.actor}</Text>
              <Text style={[styles.small, { color: colors.mutedForeground }]}>{selected?.meta}</Text>
            </View>
            {mode !== 'audit' && selected && (
              <>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  multiline
                  placeholder={mode === 'support' ? 'Add an internal note…' : 'Add reviewer rationale…'}
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                />
                <View style={styles.actions}>
                  <Pressable
                    disabled={working}
                    onPress={() => (mode === 'support' ? assignTicket(selected) : resolveReport(selected, 'dismissed'))}
                    style={[styles.secondary, { borderColor: colors.border, flex: 1, opacity: working ? 0.6 : 1 }]}
                  >
                    <Text style={[styles.secondaryText, { color: colors.foreground }]}>{mode === 'support' ? 'Assign to me' : 'Dismiss'}</Text>
                  </Pressable>
                  <Pressable
                    disabled={working || (mode === 'support' && !note.trim())}
                    onPress={() => (mode === 'support' ? addInternalNote(selected) : resolveReport(selected, 'actioned'))}
                    style={[styles.primary, { backgroundColor: mode === 'moderation' ? colors.destructive : colors.primary, flex: 1, opacity: working || (mode === 'support' && !note.trim()) ? 0.45 : 1 }]}
                  >
                    {working ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{mode === 'support' ? 'Save note' : 'Take action'}</Text>}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 12 },
  filterScroll: { flexGrow: 0, flexShrink: 0 },
  filters: { gap: 8, alignItems: 'center' },
  filter: { minHeight: 40, paddingHorizontal: 15, borderRadius: 20, borderWidth: 1, justifyContent: 'center' },
  filterText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  results: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowId: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  rowTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginTop: 2 },
  small: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  primary: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 14 },
  primaryText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 13 },
  secondary: { minHeight: 46, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 14 },
  secondaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  errorCard: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 8, alignItems: 'center' },
  overlay: { flex: 1, backgroundColor: '#000A', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, gap: 14, maxHeight: '88%' },
  sheetTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontFamily: 'Inter_700Bold', fontSize: 22 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  detail: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
  context: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 2 },
  textArea: { minHeight: 112, borderRadius: 12, borderWidth: 1, padding: 12, fontFamily: 'Inter_400Regular', textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 10 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { width: '48.5%', borderRadius: 14, borderWidth: 1, padding: 14, gap: 3 },
  metricValue: { fontFamily: 'Inter_700Bold', fontSize: 24 },
  funnelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  funnelLabel: { width: 112, fontFamily: 'Inter_500Medium', fontSize: 12 },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  percent: { width: 36, textAlign: 'right', fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  segment: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 },
});
