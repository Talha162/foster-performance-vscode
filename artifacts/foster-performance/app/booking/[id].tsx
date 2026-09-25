import React, { useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { AppButton } from '@/components/AppButton';
import { InfoRow, MockNotice, PageHeader, SectionCard, StatusPill } from '@/components/ProductUI';
import { ScreenState } from '@/components/ScreenState';
import { radii, spacing, typography } from '@/constants/colors';

const dates = ['Wed 26', 'Thu 27', 'Fri 28', 'Sat 29', 'Sun 30'];
const times = ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '4:00 PM'];
const reasons = ['Schedule conflict', 'No longer needed', 'Illness or injury', 'Booked by mistake', 'Other'];

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bookings, cancelBooking } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const booking = bookings.find((item) => item.id === id || item.serverId === id);
  const [mode, setMode] = useState<'detail' | 'reschedule' | 'cancel' | 'success'>('detail');
  const [date, setDate] = useState(dates[1]);
  const [time, setTime] = useState(times[1]);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local timezone';
  const refundState = useMemo(() => mode === 'cancel' ? 'Full refund expected when cancelled more than 24 hours before the session. Final eligibility is confirmed by the payment service.' : '', [mode]);

  if (!booking) return <ScreenState title="Booking unavailable" message="This appointment is not stored on this device. Refresh your bookings after signing in." onBack={() => router.back()} />;

  const confirmCancel = async () => {
    if (!reason) { Alert.alert('Choose a reason', 'Select the reason for cancellation.'); return; }
    setBusy(true);
    try {
      await cancelBooking(booking.id);
      setMode('success');
    } catch (error: any) { Alert.alert('Cancellation failed', error?.message ?? 'Please try again or contact support.'); }
    finally { setBusy(false); }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 40 : insets.top }]}>
      <BackgroundLayer /><PageHeader title={mode === 'reschedule' ? 'Reschedule Session' : mode === 'cancel' ? 'Cancel Session' : 'Booking Details'} subtitle={timezone} />
      {mode === 'success' ? (
        <View style={styles.success}><View style={[styles.successIcon, { backgroundColor: colors.success + '20' }]}><Feather name="check" size={40} color={colors.success} /></View><Text style={[styles.successTitle, { color: colors.foreground }]}>Cancellation completed</Text><Text style={[styles.successBody, { color: colors.mutedForeground }]}>Your session is cancelled. Refund status will update when the payment provider confirms it.</Text><StatusPill label="Refund processing" tone="warning" /><MockNotice>Refund lifecycle updates will be synchronized by the payment backend in Milestone 2.</MockNotice><AppButton label="Return to Booking" onPress={() => setMode('detail')} /></View>
      ) : (
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]} keyboardShouldPersistTaps="handled">
        <SectionCard>
          <View style={styles.coachRow}><View style={[styles.avatar, { backgroundColor: booking.coachColor + '22' }]}><Text style={[styles.avatarText, { color: booking.coachColor }]}>{booking.coachInitials}</Text></View><View style={{ flex: 1 }}><Text style={[styles.coachName, { color: colors.foreground }]}>{booking.coachName}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{booking.sessionLength}-minute live coaching</Text></View><StatusPill label={booking.status} tone={booking.status === 'upcoming' ? 'success' : booking.status === 'cancelled' ? 'danger' : 'muted'} /></View>
        </SectionCard>

        {mode === 'detail' && <>
          <SectionCard title="Appointment"><InfoRow icon="calendar" label="Date" value={booking.date} /><InfoRow icon="clock-outline" label="Time" value={`${booking.time} · ${timezone}`} /><InfoRow icon="timer-outline" label="Duration" value={`${booking.sessionLength} minutes`} /><InfoRow icon="credit-card-outline" label="Payment" value={`Paid · $${booking.price.toFixed(2)}`} /><InfoRow icon="receipt-text-outline" label="Receipt" value="FP preview receipt · invoice available after provider sync" /></SectionCard>
          <SectionCard title="Session actions"><InfoRow icon="video-outline" label="Join session" value="Available near the scheduled start time" onPress={() => Alert.alert('Session not started', 'The Join button becomes available shortly before the appointment.')} /><InfoRow icon="calendar-edit" label="Reschedule" value="Choose another available date and time" onPress={() => setMode('reschedule')} /><InfoRow icon="lifebuoy" label="Report a session issue" value="Coach absent, member absent, connection or payment issue" onPress={() => Alert.alert('Support preview', 'A support case form will be submitted when the support service is connected.')} /><InfoRow icon="calendar-remove" label="Cancel appointment" value="Refund depends on cancellation timing" danger onPress={() => setMode('cancel')} /></SectionCard>
          <MockNotice>Booking detail actions are complete frontend previews. Rescheduling, receipts and support submission require Milestone 2 endpoints.</MockNotice>
        </>}

        {mode === 'reschedule' && <>
          <SectionCard title="Existing appointment" subtitle={`${booking.date} · ${booking.time} · ${booking.sessionLength} minutes`}><StatusPill label="No price difference" tone="success" /></SectionCard>
          <SectionCard title="Select a new date"><View style={styles.choices}>{dates.map((item) => <Pressable key={item} onPress={() => setDate(item)} style={[styles.choice, { borderColor: date === item ? colors.primary : colors.border, backgroundColor: date === item ? colors.primary + '18' : colors.muted }]} accessibilityRole="radio" accessibilityState={{ checked: date === item }}><Text style={{ color: date === item ? colors.primary : colors.foreground }}>{item}</Text></Pressable>)}</View></SectionCard>
          <SectionCard title="Select a new time" subtitle={timezone}><View style={styles.choices}>{times.map((item) => <Pressable key={item} onPress={() => setTime(item)} style={[styles.choice, { borderColor: time === item ? colors.primary : colors.border, backgroundColor: time === item ? colors.primary + '18' : colors.muted }]} accessibilityRole="radio" accessibilityState={{ checked: time === item }}><Text style={{ color: time === item ? colors.primary : colors.foreground }}>{item}</Text></Pressable>)}</View></SectionCard>
          <AppButton label="Confirm Reschedule" icon="calendar-check" onPress={() => { Alert.alert('Session rescheduled', `Preview updated to ${date} at ${time}. Backend persistence will be connected in Milestone 2.`); setMode('detail'); }} /><AppButton label="Keep Existing Time" variant="secondary" onPress={() => setMode('detail')} />
        </>}

        {mode === 'cancel' && <>
          <SectionCard title="Refund policy summary" subtitle={refundState}><StatusPill label="Estimated full refund" tone="success" /></SectionCard>
          <SectionCard title="Why are you cancelling?"><View style={styles.reasonList}>{reasons.map((item) => <Pressable key={item} onPress={() => setReason(item)} style={styles.reason} accessibilityRole="radio" accessibilityState={{ checked: reason === item }}><MaterialCommunityIcons name={reason === item ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={reason === item ? colors.primary : colors.mutedForeground} /><Text style={{ color: colors.foreground, flex: 1 }}>{item}</Text></Pressable>)}</View><TextInput value={note} onChangeText={setNote} placeholder="Optional note for support" placeholderTextColor={colors.mutedForeground} multiline style={[styles.note, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]} /></SectionCard>
          <AppButton label="Confirm Cancellation" variant="danger" loading={busy} disabled={!reason} onPress={confirmCancel} /><AppButton label="Keep Appointment" variant="secondary" onPress={() => setMode('detail')} />
        </>}
      </ScrollView>)}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 }, content: { padding: spacing.md, gap: spacing.md }, coachRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, avatar: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' }, avatarText: { ...typography.title }, coachName: { ...typography.label, fontSize: 16 }, meta: { ...typography.bodySmall, marginTop: 2 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, choice: { minHeight: 44, minWidth: 92, flexGrow: 1, borderWidth: 1, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm }, reasonList: { gap: spacing.xs }, reason: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, note: { minHeight: 90, borderWidth: 1, borderRadius: radii.md, padding: spacing.sm, textAlignVertical: 'top' }, success: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }, successIcon: { width: 88, height: 88, borderRadius: 44, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }, successTitle: { ...typography.hero, textAlign: 'center' }, successBody: { ...typography.body, textAlign: 'center' } });
