import React, { useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { MockNotice, PageHeader, SearchField, SectionCard, StatusPill } from '@/components/ProductUI';
import { useColors } from '@/hooks/useColors';

type Mode = 'audit' | 'support' | 'engagement' | 'moderation';

const COPY = {
  audit: { title: 'Audit Log', subtitle: 'Administrative and security activity', icon: 'shield-search' },
  support: { title: 'Support Operations', subtitle: 'Queues, cases, and response workflow', icon: 'lifebuoy' },
  engagement: { title: 'Engagement', subtitle: 'Retention signals and communications', icon: 'chart-timeline-variant' },
  moderation: { title: 'Moderation', subtitle: 'Reports, content review, and enforcement', icon: 'shield-alert-outline' },
} as const;

const AUDIT = [
  { id: 'EVT-1048', title: 'Coach application approved', actor: 'owner@fosterperformance.com', meta: 'Coach: Jordan Lee · 2 minutes ago', status: 'Success', detail: 'Role upgraded from applicant to coach. Approval notification queued.' },
  { id: 'EVT-1047', title: 'Platform fee changed', actor: 'owner@fosterperformance.com', meta: '15% → 12% · 31 minutes ago', status: 'Sensitive', detail: 'Fee change affects future transactions only. Existing bookings are unchanged.' },
  { id: 'EVT-1046', title: 'Failed admin sign-in', actor: 'unknown@sample.com', meta: 'Android · Lahore · 1 hour ago', status: 'Review', detail: 'Password challenge failed. No authenticated session was created.' },
];
const CASES = [
  { id: 'SUP-238', title: 'Refund not visible', actor: 'Ava Thompson', meta: 'Payments · Open · 18 min', status: 'Urgent', detail: 'Member reports the cancelled-session refund has not appeared on their card.' },
  { id: 'SUP-237', title: 'Coach video cannot load', actor: 'Marcus Chen', meta: 'Technical · Assigned · 42 min', status: 'Assigned', detail: 'Playback placeholder fails on one workout in the Strength Foundations program.' },
  { id: 'SUP-231', title: 'Change appointment time', actor: 'Jamie Davis', meta: 'Bookings · Waiting · 3 hr', status: 'Waiting', detail: 'Member needs coach confirmation for a same-day reschedule.' },
];
const REPORTS = [
  { id: 'MOD-091', title: 'Inappropriate chat message', actor: '2 member reports', meta: 'Messages · New · 9 min', status: 'High', detail: 'Reported message and surrounding conversation context are preserved for review.' },
  { id: 'MOD-089', title: 'Misleading credential claim', actor: 'Coach profile report', meta: 'Profile · In review · 2 hr', status: 'Review', detail: 'A certification claim may not match the uploaded credential record.' },
  { id: 'MOD-083', title: 'Unsafe workout instruction', actor: 'Program content report', meta: 'Content · Escalated · 1 day', status: 'Escalated', detail: 'Exercise guidance was flagged for missing a relevant safety warning.' },
];

export function AdminOperations({ mode }: { mode: Mode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState<any>(null);
  const [note, setNote] = useState('');
  const [broadcast, setBroadcast] = useState('');
  const copy = COPY[mode];
  const source = mode === 'audit' ? AUDIT : mode === 'support' ? CASES : REPORTS;
  const rows = useMemo(() => source.filter((item) => `${item.id} ${item.title} ${item.actor} ${item.status}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'All' || item.status === filter)), [source, query, filter]);
  const filters = mode === 'audit' ? ['All', 'Success', 'Sensitive', 'Review'] : mode === 'support' ? ['All', 'Urgent', 'Assigned', 'Waiting'] : ['All', 'High', 'Review', 'Escalated'];
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 36 : insets.bottom + 24;

  if (mode === 'engagement') {
    return (
      <View style={styles.root}><BackgroundLayer /><View style={{ paddingTop: topPad }}><PageHeader title={copy.title} subtitle={copy.subtitle} /></View>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
          <MockNotice>Analytics, audience counts, and message delivery are representative Milestone 1 data.</MockNotice>
          <View style={styles.metricGrid}>
            {[['Weekly active', '1,284', '+8.2%'], ['Workout completion', '72%', '+3.1%'], ['Booking repeat', '48%', '-1.4%'], ['30-day retention', '64%', '+5.0%']].map(([label, value, delta]) => (
              <View key={label} style={[styles.metric, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text><Text style={[styles.small, { color: colors.mutedForeground }]}>{label}</Text><Text style={[styles.delta, { color: delta.startsWith('+') ? colors.success : colors.destructive }]}>{delta}</Text></View>
            ))}
          </View>
          <SectionCard title="Lifecycle funnel" subtitle="Members who progressed during the selected period">
            {[['Registered', 100], ['Onboarding complete', 84], ['First workout', 71], ['First booking', 46], ['Repeat booking', 29]].map(([label, value]) => <View key={String(label)} style={styles.funnelRow}><Text style={[styles.funnelLabel, { color: colors.foreground }]}>{label}</Text><View style={[styles.track, { backgroundColor: colors.muted }]}><View style={[styles.fill, { backgroundColor: colors.primary, width: `${value}%` as any }]} /></View><Text style={[styles.percent, { color: colors.mutedForeground }]}>{value}%</Text></View>)}
          </SectionCard>
          <SectionCard title="Audience segments" subtitle="Preview counts for targeted communications">
            {[['New members · last 7 days', '138'], ['Inactive · 14+ days', '204'], ['Upcoming bookings', '86'], ['Failed payments', '17']].map(([label, value]) => <View key={label} style={styles.segment}><Text style={[styles.rowTitle, { color: colors.foreground }]}>{label}</Text><StatusPill label={value} tone="info" /></View>)}
          </SectionCard>
          <SectionCard title="Point configuration" subtitle="Preview values · production permissions and persistence pending">
            {[['Workout completed', '25 pts', 'Enabled'], ['Weekly streak', '50 pts', 'Enabled'], ['Nutrition check-in', '10 pts', 'Disabled']].map(([activity, points, state]) => <Pressable key={activity} onPress={() => Alert.alert('Edit point rule', `${activity}\n${points}\n${state}\n\nValidation and audited persistence will connect in Milestone 2.`)} style={styles.segment}><View style={{ flex: 1 }}><Text style={[styles.rowTitle, { color: colors.foreground }]}>{activity}</Text><Text style={[styles.small, { color: colors.mutedForeground }]}>{points}</Text></View><StatusPill label={state} tone={state === 'Enabled' ? 'success' : 'muted'} /></Pressable>)}
          </SectionCard>
          <SectionCard title="Challenges" subtitle="Creation, dates, rewards, and lifecycle states">
            {[['September Consistency', 'Sep 1–30 · 400 point goal', 'Scheduled'], ['Mobility Week', 'Aug 24–30 · 100 point reward', 'Active'], ['Summer Strength', 'Jun 1–Jul 31 · Completed', 'Ended']].map(([name, summary, status]) => <Pressable key={name} onPress={() => Alert.alert('Challenge editor preview', `${name}\n${summary}\n${status}`)} style={styles.segment}><View style={{ flex: 1 }}><Text style={[styles.rowTitle, { color: colors.foreground }]}>{name}</Text><Text style={[styles.small, { color: colors.mutedForeground }]}>{summary}</Text></View><StatusPill label={status} tone={status === 'Active' ? 'success' : status === 'Scheduled' ? 'info' : 'muted'} /></Pressable>)}
            <Pressable onPress={() => Alert.alert('Create challenge', 'Title, start/end date, activity criteria, point summary, validation, and preview will connect to the persistent admin service.')} style={[styles.secondary, { borderColor: colors.border }]}><Feather name="plus" size={17} color={colors.foreground} /><Text style={[styles.secondaryText, { color: colors.foreground }]}>Create challenge</Text></Pressable>
          </SectionCard>
          <SectionCard title="Streak freeze administration" subtitle="Find a member, grant with reason, and retain history">
            <SearchField placeholder="Find member by name or email…" />
            <View style={styles.segment}><View style={{ flex: 1 }}><Text style={[styles.rowTitle, { color: colors.foreground }]}>Ava Thompson</Text><Text style={[styles.small, { color: colors.mutedForeground }]}>1 freeze available · Last grant Jul 12</Text></View><Pressable onPress={() => Alert.alert('Grant freeze confirmation', 'A required reason and audited confirmation are represented. No member record was changed.')} style={[styles.filter, { borderColor: colors.primary }]}><Text style={[styles.filterText, { color: colors.primary }]}>Grant</Text></Pressable></View>
          </SectionCard>
          <SectionCard title="Broadcast composer" subtitle="Review and confirmation are required before production delivery">
            <TextInput value={broadcast} onChangeText={setBroadcast} multiline maxLength={240} placeholder="Write an operational announcement…" placeholderTextColor={colors.mutedForeground} style={[styles.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
            <Text style={[styles.counter, { color: colors.mutedForeground }]}>{broadcast.length}/240 · Audience: All active members</Text>
            <Pressable disabled={!broadcast.trim()} onPress={() => Alert.alert('Preview ready', 'Milestone 1 stops before delivery. The production flow will require final audience and send confirmation.')} style={[styles.primary, { backgroundColor: colors.primary, opacity: broadcast.trim() ? 1 : .45 }]}><Feather name="eye" size={17} color="#fff" /><Text style={styles.primaryText}>Preview broadcast</Text></Pressable>
          </SectionCard>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}><BackgroundLayer /><View style={{ paddingTop: topPad }}><PageHeader title={copy.title} subtitle={copy.subtitle} /></View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]} keyboardShouldPersistTaps="handled">
        <MockNotice>{mode === 'audit' ? 'Audit events and export are representative; immutable server logging is a Milestone 2 integration.' : mode === 'support' ? 'Cases, notes, assignment, and replies are local workflow previews.' : 'Reports and enforcement actions are local workflow previews with no account impact.'}</MockNotice>
        <SearchField value={query} onChangeText={setQuery} placeholder={`Search ${mode === 'audit' ? 'events' : mode === 'support' ? 'cases' : 'reports'}…`} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{filters.map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, { borderColor: filter === item ? colors.primary : colors.border, backgroundColor: filter === item ? colors.primary + '20' : colors.card }]}><Text style={[styles.filterText, { color: filter === item ? colors.primary : colors.mutedForeground }]}>{item}</Text></Pressable>)}</ScrollView>
        {mode === 'audit' && <Pressable onPress={() => Alert.alert('Export requested', 'A date-range CSV export preview has been prepared. Secure server generation is deferred to Milestone 2.')} style={[styles.secondary, { borderColor: colors.border }]}><Feather name="download" size={17} color={colors.foreground} /><Text style={[styles.secondaryText, { color: colors.foreground }]}>Export date range</Text></Pressable>}
        <Text style={[styles.results, { color: colors.mutedForeground }]}>{rows.length} result{rows.length === 1 ? '' : 's'}</Text>
        {rows.length ? rows.map((item) => <Pressable key={item.id} onPress={() => { setSelected(item); setNote(''); }} style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? .78 : 1 }]}><View style={[styles.icon, { backgroundColor: colors.primary + '18' }]}><MaterialCommunityIcons name={copy.icon as any} size={22} color={colors.primary} /></View><View style={{ flex: 1 }}><View style={styles.rowTop}><Text style={[styles.rowId, { color: colors.primary }]}>{item.id}</Text><StatusPill label={item.status} tone={item.status === 'Success' || item.status === 'Assigned' ? 'success' : item.status === 'Urgent' || item.status === 'High' ? 'danger' : 'warning'} /></View><Text style={[styles.rowTitle, { color: colors.foreground }]}>{item.title}</Text><Text style={[styles.small, { color: colors.mutedForeground }]}>{item.actor}</Text><Text style={[styles.small, { color: colors.mutedForeground }]}>{item.meta}</Text></View><Feather name="chevron-right" size={20} color={colors.mutedForeground} /></Pressable>) : <SectionCard><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No matching results</Text><Text style={[styles.small, { color: colors.mutedForeground }]}>Clear the search or choose another status.</Text></SectionCard>}
      </ScrollView>
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}><View style={styles.overlay}><View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: bottomPad }]}><View style={styles.sheetTop}><View><Text style={[styles.sheetTitle, { color: colors.foreground }]}>{selected?.id}</Text><Text style={[styles.small, { color: colors.mutedForeground }]}>{selected?.title}</Text></View><Pressable onPress={() => setSelected(null)} style={styles.close}><Feather name="x" size={22} color={colors.foreground} /></Pressable></View><Text style={[styles.detail, { color: colors.foreground }]}>{selected?.detail}</Text><View style={[styles.context, { borderColor: colors.border }]}><Text style={[styles.small, { color: colors.mutedForeground }]}>Actor / reporter</Text><Text style={[styles.rowTitle, { color: colors.foreground }]}>{selected?.actor}</Text><Text style={[styles.small, { color: colors.mutedForeground }]}>{selected?.meta}</Text></View>{mode !== 'audit' && <><TextInput value={note} onChangeText={setNote} multiline placeholder={mode === 'support' ? 'Add internal note or response draft…' : 'Add reviewer rationale…'} placeholderTextColor={colors.mutedForeground} style={[styles.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} /><View style={styles.actions}><Pressable onPress={() => Alert.alert(mode === 'support' ? 'Case updated' : 'Report dismissed', 'Frontend preview updated locally.')} style={[styles.secondary, { borderColor: colors.border, flex: 1 }]}><Text style={[styles.secondaryText, { color: colors.foreground }]}>{mode === 'support' ? 'Assign to me' : 'Dismiss'}</Text></Pressable><Pressable onPress={() => Alert.alert(mode === 'support' ? 'Reply preview' : 'Action confirmation', mode === 'support' ? 'A member-facing reply preview is ready. No message was sent.' : 'The enforcement confirmation is displayed, but no account was changed.')} style={[styles.primary, { backgroundColor: mode === 'moderation' ? colors.destructive : colors.primary, flex: 1 }]}><Text style={styles.primaryText}>{mode === 'support' ? 'Preview reply' : 'Take action'}</Text></Pressable></View></>}</View></View></Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 }, content: { padding: 16, gap: 12 }, filters: { gap: 8 }, filter: { minHeight: 40, paddingHorizontal: 15, borderRadius: 20, borderWidth: 1, justifyContent: 'center' }, filterText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 }, results: { fontFamily: 'Inter_500Medium', fontSize: 12 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 }, icon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, rowId: { fontFamily: 'Inter_700Bold', fontSize: 11 }, rowTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginTop: 2 }, small: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 }, primary: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 14 }, primaryText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 13 }, secondary: { minHeight: 46, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 14 }, secondaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 }, overlay: { flex: 1, backgroundColor: '#000A', justifyContent: 'flex-end' }, sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, gap: 14, maxHeight: '88%' }, sheetTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sheetTitle: { fontFamily: 'Inter_700Bold', fontSize: 22 }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, detail: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 }, context: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 2 }, textArea: { minHeight: 112, borderRadius: 12, borderWidth: 1, padding: 12, fontFamily: 'Inter_400Regular', textAlignVertical: 'top' }, actions: { flexDirection: 'row', gap: 10 }, emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 }, metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metric: { width: '48.5%', borderRadius: 14, borderWidth: 1, padding: 14, gap: 3 }, metricValue: { fontFamily: 'Inter_700Bold', fontSize: 24 }, delta: { fontFamily: 'Inter_600SemiBold', fontSize: 11 }, funnelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 }, funnelLabel: { width: 112, fontFamily: 'Inter_500Medium', fontSize: 12 }, track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' }, fill: { height: 8, borderRadius: 4 }, percent: { width: 36, textAlign: 'right', fontFamily: 'Inter_600SemiBold', fontSize: 11 }, segment: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 }, counter: { fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'right' },
});
