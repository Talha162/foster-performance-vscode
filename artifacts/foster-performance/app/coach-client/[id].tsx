import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { RoleGate } from '@/components/RoleGate';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { AppButton } from '@/components/AppButton';
import { InfoRow, PageHeader, SectionCard, StatusPill } from '@/components/ProductUI';
import { radii, spacing, typography } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type Note = { id: string; body: string; created_at: string };
type Session = { id: string; starts_at: string; session_length_minutes: number; status: string };

function formatSession(session: Session): string {
  const start = new Date(session.starts_at);
  const date = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time} · ${session.session_length_minutes} min`;
}

export default function CoachClientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [clientName, setClientName] = useState('Client');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [enrolledProgram, setEnrolledProgram] = useState<{ id: string; title: string } | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingNote, setSavingNote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !id) return;
    setLoading(true);
    setError(null);
    try {
      const [profile, bookings, noteRows, enrollments] = await Promise.all([
        // A coach shares a booking with this client, so RLS allows the row.
        supabase.from('profiles').select('full_name').eq('id', id).maybeSingle(),
        supabase.from('bookings')
          .select('id, starts_at, session_length_minutes, status')
          .eq('coach_id', user.id).eq('member_id', id)
          .order('starts_at', { ascending: false }),
        supabase.from('coach_client_notes')
          .select('id, body, created_at')
          .eq('coach_id', user.id).eq('client_id', id)
          .order('created_at', { ascending: false }),
        supabase.from('workout_enrollments')
          .select('program_id, status')
          .eq('user_id', id).eq('status', 'active'),
      ]);

      const firstError = profile.error ?? bookings.error ?? noteRows.error ?? enrollments.error;
      if (firstError) throw new Error(firstError.message);

      setClientName(profile.data?.full_name ?? 'Client');
      setSessions((bookings.data ?? []) as Session[]);
      setNotes((noteRows.data ?? []) as Note[]);

      const programId = enrollments.data?.[0]?.program_id;
      if (programId) {
        const program = await supabase.from('workout_programs').select('id, title').eq('id', programId).maybeSingle();
        setEnrolledProgram(program.data ?? null);
      } else {
        setEnrolledProgram(null);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Could not load this client.');
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => { void load(); }, [load]);

  const addNote = async () => {
    if (!user || !id || !note.trim() || savingNote) return;
    setSavingNote(true);
    try {
      const { error: insertError } = await supabase.from('coach_client_notes')
        .insert({ coach_id: user.id, client_id: id, body: note.trim() });
      if (insertError) throw new Error(insertError.message);
      setNote('');
      await load();
    } catch (err: any) {
      Alert.alert('Could not save note', err?.message ?? 'Please try again.');
    } finally {
      setSavingNote(false);
    }
  };

  const now = Date.now();
  const upcoming = sessions.filter((s) => new Date(s.starts_at).getTime() > now && s.status !== 'cancelled');
  const completed = sessions.filter((s) => s.status === 'completed');
  const initials = clientName.split(' ').map((part) => part[0] ?? '').join('').slice(0, 2).toUpperCase();

  return (
    <RoleGate allow={['coach']}>
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 40 : insets.top }]}>
        <BackgroundLayer />
        <PageHeader title="Client Detail" subtitle="Coaching workspace" />
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} /> : error ? (
            <SectionCard>
              <Text style={[styles.name, { color: colors.destructive }]}>Could not load this client</Text>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>{error}</Text>
              <AppButton label="Retry" onPress={load} />
            </SectionCard>
          ) : (
            <>
              <SectionCard>
                <View style={styles.hero}>
                  <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.avatarText, { color: colors.primary }]}>{initials || 'CL'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: colors.foreground }]}>{clientName}</Text>
                    <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                      {sessions.length} session{sessions.length === 1 ? '' : 's'} booked with you
                    </Text>
                  </View>
                  <StatusPill
                    label={upcoming.length ? 'Active' : 'No upcoming'}
                    tone={upcoming.length ? 'success' : 'muted'}
                  />
                </View>
              </SectionCard>

              <SectionCard title="Sessions">
                <InfoRow
                  icon="calendar-clock"
                  label="Next session"
                  value={upcoming.length ? formatSession(upcoming[upcoming.length - 1]) : 'Nothing booked yet'}
                />
                <InfoRow
                  icon="history"
                  label="Completed"
                  value={completed.length ? `${completed.length} session${completed.length === 1 ? '' : 's'}` : 'None yet'}
                />
                <InfoRow
                  icon="message-outline"
                  label="Message client"
                  value="Open your conversation"
                  onPress={() => router.push('/messages')}
                />
              </SectionCard>

              <SectionCard title="Program assignment">
                <InfoRow
                  icon="clipboard-check-outline"
                  label={enrolledProgram?.title ?? 'No active program'}
                  value={enrolledProgram
                    ? 'This client is enrolled and training on it'
                    : 'The client enrols themselves from the program catalogue'}
                />
              </SectionCard>

              <SectionCard
                title="Private coach notes"
                subtitle="Only you and platform admins can read these. The client cannot."
              >
                {notes.length === 0 ? (
                  <Text style={[styles.meta, { color: colors.mutedForeground }]}>No notes yet.</Text>
                ) : notes.map((item) => (
                  <View key={item.id} style={[styles.noteCard, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.noteText, { color: colors.foreground }]}>{item.body}</Text>
                    <Text style={[styles.noteMeta, { color: colors.mutedForeground }]}>
                      {new Date(item.created_at).toLocaleString()}
                    </Text>
                  </View>
                ))}
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Add a coaching note"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
                />
                <AppButton label="Save Note" loading={savingNote} disabled={!note.trim()} onPress={addNote} />
              </SectionCard>
            </>
          )}
        </ScrollView>
      </View>
    </RoleGate>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.title },
  name: { ...typography.title },
  meta: { ...typography.bodySmall, marginTop: 2 },
  noteCard: { padding: spacing.sm, borderRadius: radii.md, gap: 4 },
  noteText: { ...typography.bodySmall },
  noteMeta: { ...typography.caption },
  input: { minHeight: 90, borderWidth: 1, borderRadius: radii.md, padding: spacing.sm, textAlignVertical: 'top', ...typography.body },
});
