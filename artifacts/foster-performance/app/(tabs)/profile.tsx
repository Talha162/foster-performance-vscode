import React, { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useAuth } from '@/context/AuthContext';
import type { SubscriptionStatus } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { CoachCard } from '@/components/CoachCard';
import { PremiumBanner } from '@/components/PremiumBanner';

function subStatusColor(status: SubscriptionStatus | null): string {
  switch (status) {
    case 'active': return '#35C98A';
    case 'trial': return '#2F80FF';
    case 'pending': return '#F5A623';
    case 'past_due': return '#FF4444';
    case 'canceled': return '#9AA3B5';
    case 'expired': return '#FF4444';
    default: return '#9AA3B5';
  }
}

function subStatusLabel(status: SubscriptionStatus | null): string {
  switch (status) {
    case 'active': return 'Active';
    case 'trial': return 'Trial';
    case 'pending': return 'Pending';
    case 'past_due': return 'Past Due';
    case 'canceled': return 'Canceled';
    case 'expired': return 'Expired';
    default: return 'Free';
  }
}

function MenuItem({
  icon,
  label,
  onPress,
  danger,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
  badge?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <View style={[styles.menuIcon, { backgroundColor: colors.muted }]}>{icon}</View>
      <Text style={[styles.menuLabel, { color: danger ? colors.destructive : colors.foreground, flex: 1 }]}>
        {label}
      </Text>
      {badge ? (
        <View style={[styles.menuBadge, { backgroundColor: '#F59E0B22' }]}>
          <Text style={[styles.menuBadgeText, { color: '#F59E0B' }]}>{badge}</Text>
        </View>
      ) : (
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      )}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout, signOutAll } = useAuth();
  const { coaches, workoutLogs, bookings, cancelBooking } = useApp();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await logout();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  const handleCancelBooking = (bookingId: string, coachName: string, date: string, time: string) => {
    Alert.alert(
      'Cancel Session',
      `Cancel your session with ${coachName} on ${date} at ${time}?\n\nFree cancellations are available up to 24 hours before your session. After that, a 50% refund applies.`,
      [
        { text: 'Keep Session', style: 'cancel' },
        {
          text: 'Cancel Session',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setCancellingId(bookingId);
            try {
              const target = bookings.find((b) => b.id === bookingId);
              const { refunded, partial } = await cancelBooking(
                bookingId,
                target?.cancellationToken ?? ''
              );
              setCancellingId(null);

              if (refunded && partial) {
                Alert.alert(
                  'Session Cancelled',
                  'Your session has been cancelled. A 50% refund has been issued and will appear in 5–10 business days.',
                  [{ text: 'OK' }]
                );
              } else if (refunded) {
                Alert.alert(
                  'Session Cancelled',
                  'Your session has been cancelled and a full refund has been issued. It will appear in 5–10 business days.',
                  [{ text: 'OK' }]
                );
              } else {
                Alert.alert(
                  'Session Cancelled',
                  'Your session has been cancelled. If you were charged, please contact support for a refund.',
                  [{ text: 'OK' }]
                );
              }
            } catch {
              setCancellingId(null);
              Alert.alert('Error', 'Could not cancel the session. Please try again.', [{ text: 'OK' }]);
            }
          },
        },
      ]
    );
  };

  const upcomingBookings = bookings.filter((b) => b.status === 'upcoming');

  const joinYear = user?.joinDate ? new Date(user.joinDate).getFullYear() : 2026;

  return (
    <View style={styles.root}>
      <BackgroundLayer />
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Profile</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === 'web' ? 100 : 100 }]}
      >
        {/* User card */}
        <View style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>
              {user?.name?.slice(0, 2).toUpperCase() ?? 'FP'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <View style={styles.userNameRow}>
              <Text style={[styles.userName, { color: colors.foreground }]}>{user?.name}</Text>
              {user?.subscriptionStatus === 'active' || user?.subscriptionStatus === 'trial' ? (
                <View style={[styles.premiumBadge, { backgroundColor: colors.accent }]}>
                  <MaterialCommunityIcons name="crown" size={10} color={colors.accentForeground} />
                  <Text style={[styles.premiumBadgeText, { color: colors.accentForeground }]}>PRO</Text>
                </View>
              ) : user?.accountType === 'coach' ? (
                <View style={[styles.premiumBadge, { backgroundColor: colors.primary }]}>
                  <MaterialCommunityIcons name="whistle" size={10} color={colors.primaryForeground} />
                  <Text style={[styles.premiumBadgeText, { color: colors.primaryForeground }]}>COACH</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{user?.email}</Text>
            <Text style={[styles.userSince, { color: colors.mutedForeground }]}>Member since {joinYear}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <StatItem value={`${workoutLogs.length + 14}`} label="Workouts" />
          <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
          <StatItem value={`${user?.streakDays ?? 0}`} label="Day Streak" />
          <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
          <StatItem value={`${joinYear}`} label="Member Since" />
        </View>

        {/* Subscription Status Card */}
        {(() => {
          const status = user?.subscriptionStatus ?? null;
          const color = subStatusColor(status);
          const label = subStatusLabel(status);
          const isActive = status === 'active' || status === 'trial';
          return (
            <Pressable
              onPress={() => router.push(isActive ? '/billing-settings' : '/subscription')}
              style={({ pressed }) => [
                styles.subCard,
                { backgroundColor: colors.card, borderColor: isActive ? color : colors.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <View style={[styles.subIconWrap, { backgroundColor: color + '22' }]}>
                <MaterialCommunityIcons
                  name={isActive ? 'crown' : 'crown-outline'}
                  size={20}
                  color={color}
                />
              </View>
              <View style={styles.subInfo}>
                <Text style={[styles.subTitle, { color: colors.foreground }]}>
                  Foster Performance Membership
                </Text>
                <View style={styles.subRow}>
                  <View style={[styles.subPill, { backgroundColor: color + '22' }]}>
                    <Text style={[styles.subPillText, { color }]}>{label.toUpperCase()}</Text>
                  </View>
                  {isActive && (
                    <Text style={[styles.subMeta, { color: colors.mutedForeground }]}>
                      {user?.subscriptionPlan === 'annual' ? '$79.99/year' : '$9.99/month'}
                    </Text>
                  )}
                </View>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </Pressable>
          );
        })()}

        {/* Upgrade banner for free users */}
        {!user?.isPremium && user?.subscriptionStatus !== 'pending' && (
          <View style={styles.section}>
            <PremiumBanner />
          </View>
        )}

        {/* Upcoming Sessions */}
        {upcomingBookings.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Upcoming Sessions</Text>
            <View style={styles.bookingList}>
              {upcomingBookings.map((booking) => (
                <View
                  key={booking.id}
                  style={[styles.bookingCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={[styles.bookingColorBar, { backgroundColor: booking.coachColor }]} />
                  <View style={styles.bookingBody}>
                    <View style={styles.bookingRow}>
                      <View style={[styles.bookingInitials, { backgroundColor: booking.coachColor + '22' }]}>
                        <Text style={[styles.bookingInitialsText, { color: booking.coachColor }]}>
                          {booking.coachInitials}
                        </Text>
                      </View>
                      <View style={styles.bookingInfo}>
                        <Text style={[styles.bookingCoach, { color: colors.foreground }]}>
                          {booking.coachName}
                        </Text>
                        <Text style={[styles.bookingMeta, { color: colors.mutedForeground }]}>
                          {booking.date} · {booking.time} · {booking.sessionLength} min
                        </Text>
                        <Text style={[styles.bookingPrice, { color: colors.primary }]}>
                          ${booking.price}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => router.push(`/booking/${booking.id}` as any)}
                      style={({ pressed }) => [styles.cancelBtn, { borderColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
                      accessibilityRole="button"
                      accessibilityLabel={`View booking with ${booking.coachName}`}
                    >
                      <Text style={[styles.cancelBtnText, { color: colors.primary }]}>View Details &amp; Reschedule</Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        handleCancelBooking(booking.id, booking.coachName, booking.date, booking.time)
                      }
                      disabled={cancellingId === booking.id}
                      style={({ pressed }) => [
                        styles.cancelBtn,
                        {
                          borderColor: colors.destructive,
                          opacity: cancellingId === booking.id ? 0.5 : pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.cancelBtnText, { color: colors.destructive }]}>
                        {cancellingId === booking.id ? 'Cancelling…' : 'Cancel Session'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Become a Coach CTA — members only */}
        {user?.accountType === 'member' && (
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/become-coach-intro'); }}
            style={({ pressed }) => [
              styles.coachCtaCard,
              { backgroundColor: colors.accent + '14', borderColor: colors.accent + '55', opacity: pressed ? 0.88 : 1 },
            ]}
          >
            <View style={[styles.coachCtaIcon, { backgroundColor: colors.accent + '28' }]}>
              <MaterialCommunityIcons name="whistle" size={26} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.coachCtaTitle, { color: colors.foreground }]}>Become a Foster Coach</Text>
              <Text style={[styles.coachCtaSub, { color: colors.mutedForeground }]}>
                Earn income, set your schedule, and coach members 1-on-1
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.accent} />
          </Pressable>
        )}

        {/* Featured Coaches */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Our Coaches</Text>
            <Pressable onPress={() => router.push('/coaches')}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See All</Text>
            </Pressable>
          </View>
          {coaches.slice(0, 3).map((coach) => (
            <CoachCard
              key={coach.id}
              coach={coach}
              compact
              onPress={() => router.push(`/coach/${coach.id}`)}
            />
          ))}
        </View>

        {/* Menu */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Settings</Text>
          <View style={styles.menuList}>
            <MenuItem
              icon={<MaterialCommunityIcons name="message-outline" size={18} color={colors.primary} />}
              label="Messages"
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/messages'); }}
            />
            <MenuItem
              icon={<MaterialCommunityIcons name="bell-badge-outline" size={18} color={colors.primary} />}
              label="Notification Center"
              onPress={() => router.push('/notification-center')}
            />
            <MenuItem
              icon={<MaterialCommunityIcons name="account-edit" size={18} color={colors.foreground} />}
              label="Edit Profile"
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/profile-edit'); }}
            />
            {user?.isPremium ? (
              <MenuItem
                icon={<MaterialCommunityIcons name="credit-card-outline" size={18} color={colors.accent} />}
                label="Billing & Membership"
                onPress={() => router.push('/billing-settings')}
              />
            ) : (
              <MenuItem
                icon={<MaterialCommunityIcons name="crown-outline" size={18} color={colors.accent} />}
                label="Get Foster Pro"
                onPress={() => router.push('/subscription')}
              />
            )}
            <MenuItem
              icon={<Feather name="bell" size={18} color={colors.foreground} />}
              label="Notification Preferences"
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/notifications'); }}
            />
            <MenuItem
              icon={<Feather name="sliders" size={18} color={colors.foreground} />}
              label="App Preferences"
              onPress={() => router.push('/app-settings')}
            />
            <MenuItem
              icon={<MaterialCommunityIcons name="shield-account-outline" size={18} color={colors.foreground} />}
              label="Privacy & Data Controls"
              onPress={() => router.push('/privacy-controls')}
            />
            <MenuItem
              icon={<MaterialCommunityIcons name="credit-card-multiple-outline" size={18} color={colors.foreground} />}
              label="Payment Methods"
              onPress={() => router.push('/payment-methods')}
            />
            <MenuItem
              icon={<MaterialCommunityIcons name="receipt-text-outline" size={18} color={colors.foreground} />}
              label="Billing History"
              onPress={() => router.push('/billing-history')}
            />
            <MenuItem
              icon={<Feather name="shield" size={18} color={colors.foreground} />}
              label="Privacy Policy"
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/privacy-policy'); }}
            />
          </View>

          {/* Security section */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Security</Text>

            {!user?.emailVerified && (
              <MenuItem
                icon={<Feather name="mail" size={18} color="#F59E0B" />}
                label="Verify Email"
                badge="Action required"
                onPress={() => router.push('/(auth)/verify-email')}
              />
            )}
            <MenuItem
              icon={<Feather name="lock" size={18} color={colors.foreground} />}
              label="Change Password"
              onPress={() => router.push('/change-password')}
            />
            <MenuItem
              icon={<Feather name="smartphone" size={18} color={colors.foreground} />}
              label="Sign Out of All Devices"
              onPress={() => {
                Alert.alert(
                  'Sign Out Everywhere',
                  "This will sign you out of all devices. You'll stay signed in here.",
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Sign Out All',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await signOutAll();
                          Alert.alert('Done', 'All other sessions have been signed out.');
                        } catch {
                          Alert.alert('Error', 'Failed to sign out of other devices. Please try again.');
                        }
                      },
                    },
                  ]
                );
              }}
            />
            <MenuItem
              icon={<Feather name="log-out" size={18} color={colors.destructive} />}
              label="Sign Out"
              onPress={handleLogout}
              danger
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  const colors = useColors();
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  content: { padding: 20, gap: 20 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  avatar: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  userInfo: { flex: 1, gap: 2 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  premiumBadgeText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  userEmail: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  userSince: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  statsCard: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center', gap: 4 },
  statValue: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  statDiv: { width: 1, height: '80%', alignSelf: 'center' },
  section: {},
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  seeAll: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  menuList: { gap: 8 },
  coachCtaCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16,
    borderWidth: 1.5, padding: 16, marginBottom: 20,
  },
  coachCtaIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  coachCtaTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  coachCtaSub: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17, marginTop: 2 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  menuIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium' },
  menuBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  menuBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  // Bookings
  bookingList: { gap: 12 },
  bookingCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  bookingColorBar: { width: 4 },
  bookingBody: { flex: 1, padding: 14, gap: 12 },
  bookingRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  bookingInitials: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingInitialsText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  bookingInfo: { flex: 1, gap: 2 },
  bookingCoach: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  bookingMeta: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  bookingPrice: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  cancelBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  cancelBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  // Subscription card
  subCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
  },
  subIconWrap: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  subInfo: { flex: 1, gap: 5 },
  subTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  subPillText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  subMeta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
