import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';

export default function SessionConfirmationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    coachId,
    coachName,
    coachInitials,
    coachColor,
    sessionLength,
    price,
    date,
    dateLabel,
    dayShort,
    time,
    bookingId,
    emailSent,
    athleteEmail,
  } = useLocalSearchParams<{
    coachId: string;
    coachName: string;
    coachInitials: string;
    coachColor: string;
    sessionLength: string;
    price: string;
    date: string;
    dateLabel: string;
    dayShort: string;
    time: string;
    bookingId?: string;
    emailSent?: string;
    athleteEmail?: string;
  }>();

  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  // Success animation
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 8,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const color = coachColor ?? '#2F80FF';
  const didSendEmail = emailSent === '1' && !!athleteEmail;

  const confirmationSubtext = didSendEmail
    ? `Your session with ${coachName} is confirmed and your card has been charged. A confirmation email was sent to ${athleteEmail}.`
    : `Your session with ${coachName} is confirmed and your card has been charged. You'll receive video call details before the session.`;

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad }]}>
      <View style={styles.inner}>
        {/* Animated Check */}
        <Animated.View
          style={[
            styles.checkCircle,
            { backgroundColor: color + '20', transform: [{ scale }], opacity },
          ]}
        >
          <View style={[styles.checkInner, { backgroundColor: color }]}>
            <MaterialCommunityIcons name="check" size={42} color="#FFFFFF" />
          </View>
        </Animated.View>

        <Text style={[styles.title, { color: colors.foreground }]}>Session Booked!</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>{confirmationSubtext}</Text>

        {/* Email sent badge */}
        {didSendEmail && (
          <View style={[styles.emailBadge, { backgroundColor: color + '15', borderColor: color + '40' }]}>
            <MaterialCommunityIcons name="email-check-outline" size={15} color={color} />
            <Text style={[styles.emailBadgeText, { color }]}>
              Confirmation sent to {athleteEmail}
            </Text>
          </View>
        )}

        {/* Booking Detail Card */}
        <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Coach row */}
          <View style={styles.detailRow}>
            <View style={[styles.coachAvatar, { backgroundColor: color + '22' }]}>
              <Text style={[styles.coachAvatarText, { color }]}>{coachInitials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.coachName, { color: colors.foreground }]}>{coachName}</Text>
              <Text style={[styles.sessionType, { color: colors.mutedForeground }]}>
                {sessionLength}-minute coaching session
              </Text>
            </View>
            <Text style={[styles.detailPrice, { color }]}>${price}</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Date & time */}
          <View style={styles.detailInfoGrid}>
            <DetailItem
              icon="calendar"
              label="Date"
              value={`${dayShort}, ${dateLabel}`}
              color={color}
            />
            <DetailItem
              icon="clock-outline"
              label="Time"
              value={time ?? ''}
              color={color}
            />
            <DetailItem
              icon="timer-outline"
              label="Duration"
              value={`${sessionLength} minutes`}
              color={color}
            />
            <DetailItem
              icon="video"
              label="Format"
              value="Live video call"
              color={color}
            />
          </View>

          {/* Booking reference */}
          {bookingId ? (
            <View style={[styles.bookingRef, { borderTopColor: colors.border }]}>
              <Text style={[styles.bookingRefLabel, { color: colors.mutedForeground }]}>
                Booking ref: {bookingId.slice(0, 8).toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Actions */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push({
              pathname: '/video-call',
              params: { coachId, coachName, coachInitials, coachColor: color, sessionLength },
            });
          }}
          style={({ pressed }) => [
            styles.videoBtn,
            { backgroundColor: color, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <MaterialCommunityIcons name="video" size={20} color="#FFFFFF" />
          <Text style={styles.videoBtnText}>Join Video Call</Text>
        </Pressable>

        <Pressable
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          style={({ pressed }) => [
            styles.calBtn,
            { borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <MaterialCommunityIcons name="calendar-plus" size={18} color={colors.mutedForeground} />
          <Text style={[styles.calBtnText, { color: colors.mutedForeground }]}>Add to Calendar</Text>
        </Pressable>

        <Pressable
          onPress={() => router.replace('/(tabs)')}
          style={({ pressed }) => [styles.doneBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={[styles.doneBtnText, { color: colors.mutedForeground }]}>Done</Text>
        </Pressable>
      </View>

      {/* Cancellation note */}
      <View style={[styles.cancelNote, { paddingBottom: botPad + 20, borderTopColor: colors.border }]}>
        <MaterialCommunityIcons name="information-outline" size={13} color={colors.mutedForeground} />
        <Text style={[styles.cancelNoteText, { color: colors.mutedForeground }]}>
          Free cancellation up to 24 hours before your session. To cancel, visit your profile.
        </Text>
      </View>
    </View>
  );
}

function DetailItem({ icon, label, value, color }: {
  icon: string; label: string; value: string; color: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.detailItem}>
      <View style={[styles.detailIcon, { backgroundColor: color + '18' }]}>
        <MaterialCommunityIcons name={icon as any} size={15} color={color} />
      </View>
      <View>
        <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: colors.foreground }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 },
  checkCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  checkInner: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22, maxWidth: 300 },
  emailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  emailBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  detailCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  coachAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  coachAvatarText: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  coachName: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  sessionType: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  detailPrice: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  divider: { height: 1 },
  detailInfoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '45%' },
  detailIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  detailLabel: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  detailValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: 1 },
  bookingRef: { borderTopWidth: 1, paddingTop: 10 },
  bookingRefLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  videoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    height: 52,
    borderRadius: 14,
  },
  videoBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  calBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
  },
  calBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  doneBtn: { paddingVertical: 10 },
  doneBtnText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  cancelNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 24,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  cancelNoteText: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 17 },
});
