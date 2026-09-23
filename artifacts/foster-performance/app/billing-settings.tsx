import React, { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useAuth } from '@/context/AuthContext';
import type { SubscriptionStatus } from '@/context/AuthContext';

function statusColor(status: SubscriptionStatus | null, colors: ReturnType<typeof import('@/hooks/useColors').useColors>) {
  switch (status) {
    case 'active': return '#35C98A';
    case 'trial': return colors.primary;
    case 'pending': return '#F5A623';
    case 'past_due': return '#FF4444';
    case 'canceled': return colors.mutedForeground;
    case 'expired': return '#FF4444';
    default: return colors.mutedForeground;
  }
}

function statusLabel(status: SubscriptionStatus | null): string {
  switch (status) {
    case 'active': return 'Active';
    case 'trial': return 'Trial';
    case 'pending': return 'Pending';
    case 'past_due': return 'Past Due';
    case 'canceled': return 'Canceled';
    case 'expired': return 'Expired';
    default: return 'No Subscription';
  }
}

function statusIcon(status: SubscriptionStatus | null): string {
  switch (status) {
    case 'active': return 'check-circle';
    case 'trial': return 'clock-outline';
    case 'pending': return 'clock-alert-outline';
    case 'past_due': return 'alert-circle';
    case 'canceled': return 'close-circle';
    case 'expired': return 'close-circle';
    default: return 'help-circle';
  }
}

export default function BillingSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, cancelSubscription, updateSubscription } = useAuth();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const [cancelling, setCancelling] = useState(false);

  const status = user?.subscriptionStatus ?? null;
  const isActive = status === 'active' || status === 'trial';
  const isCanceled = status === 'canceled' || status === 'expired';
  const color = statusColor(status, colors);

  const planLabel = user?.subscriptionPlan === 'annual' ? 'Annual Plan' : 'Monthly Plan';
  const planPrice = user?.subscriptionPlan === 'annual' ? '$79.99/year' : '$9.99/month';

  const nextBillingDate = (() => {
    if (!user?.subscriptionEndDate) return 'N/A';
    try {
      return new Date(user.subscriptionEndDate).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      });
    } catch { return 'N/A'; }
  })();

  const handleCancel = () => {
    Alert.alert(
      'Cancel Membership',
      'Are you sure you want to cancel your Foster Performance membership?\n\nYou will keep access until the end of your current billing period.',
      [
        { text: 'Keep Membership', style: 'cancel' },
        {
          text: 'Cancel Membership',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setCancelling(true);
            try {
              await cancelSubscription();
              Alert.alert(
                'Membership Canceled',
                'Your membership has been canceled. You will keep access until your current period ends.',
                [{ text: 'OK' }]
              );
            } catch {
              Alert.alert('Error', 'Network error. Please try again.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const handleReactivate = () => {
    router.push('/subscription');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <BackgroundLayer />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Billing & Membership</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 40 }]}
      >
        {/* Status Card */}
        <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: color, borderWidth: 1.5 }]}>
          <View style={[styles.statusIconWrap, { backgroundColor: color + '22' }]}>
            <MaterialCommunityIcons name={statusIcon(status) as any} size={28} color={color} />
          </View>
          <View style={styles.statusInfo}>
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color }]}>{statusLabel(status)}</Text>
              {status && (
                <View style={[styles.statusPill, { backgroundColor: color + '22' }]}>
                  <Text style={[styles.statusPillText, { color }]}>{statusLabel(status).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.statusTitle, { color: colors.foreground }]}>Foster Performance Membership</Text>
            {isActive && (
              <Text style={[styles.statusMeta, { color: colors.mutedForeground }]}>
                {planLabel} · {planPrice}
              </Text>
            )}
          </View>
        </View>

        {/* Billing Details */}
        {isActive && (
          <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Billing Details</Text>
            <DetailRow
              label="Plan"
              value={planLabel}
              colors={colors}
            />
            <DetailRow
              label="Amount"
              value={planPrice}
              colors={colors}
            />
            <DetailRow
              label="Next Billing Date"
              value={nextBillingDate}
              colors={colors}
            />
            <DetailRow
              label="Status"
              value={statusLabel(status)}
              valueColor={color}
              colors={colors}
            />
            {user?.stripeSubscriptionId && (
              <DetailRow
                label="Subscription ID"
                value={user.stripeSubscriptionId.slice(0, 20) + '…'}
                colors={colors}
              />
            )}
          </View>
        )}

        {/* What's Included */}
        {isActive && (
          <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>What's Included</Text>
            {[
              { icon: 'dumbbell', text: '45+ training programs across all categories' },
              { icon: 'food-apple', text: 'Goal-personalized nutrition plans' },
              { icon: 'account-group', text: 'Coach Marketplace access' },
              { icon: 'chart-line', text: 'Advanced progress tracking' },
              { icon: 'crown', text: 'All premium content unlocked' },
            ].map((item, i) => (
              <View key={i} style={styles.featureRow}>
                <View style={[styles.featureIcon, { backgroundColor: colors.primary + '22' }]}>
                  <MaterialCommunityIcons name={item.icon as any} size={14} color={colors.primary} />
                </View>
                <Text style={[styles.featureText, { color: colors.foreground }]}>{item.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Inactive / No subscription */}
        {!isActive && (
          <View style={[styles.upgradeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="crown-outline" size={36} color={colors.accent} />
            <Text style={[styles.upgradeTitle, { color: colors.foreground }]}>
              {isCanceled ? 'Reactivate Membership' : 'Get Foster Performance'}
            </Text>
            <Text style={[styles.upgradeDesc, { color: colors.mutedForeground }]}>
              {isCanceled
                ? 'Your membership is canceled. Reactivate to restore access to all premium features and the Coach Marketplace.'
                : 'Subscribe to access all premium features, 45+ training programs, and the Coach Marketplace.'}
            </Text>
            <Pressable
              onPress={handleReactivate}
              style={({ pressed }) => [
                styles.upgradeBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <MaterialCommunityIcons name="crown" size={18} color={colors.primaryForeground} />
              <Text style={[styles.upgradeBtnText, { color: colors.primaryForeground }]}>
                {isCanceled ? 'Reactivate — $9.99/month' : 'Subscribe — $9.99/month'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Test Mode Note */}
        <View style={[styles.testNote, { backgroundColor: '#F5A62311', borderColor: '#F5A623' }]}>
          <MaterialCommunityIcons name="information" size={14} color="#F5A623" />
          <Text style={[styles.testNoteText, { color: '#F5A623' }]}>
            Test Mode — All subscription charges are simulated and no real money is collected.
          </Text>
        </View>

        {/* Cancel */}
        {isActive && (
          <View style={styles.dangerSection}>
            <Text style={[styles.dangerTitle, { color: colors.mutedForeground }]}>Danger Zone</Text>
            <Pressable
              onPress={handleCancel}
              disabled={cancelling}
              style={({ pressed }) => [
                styles.cancelBtn,
                { borderColor: colors.destructive, opacity: cancelling || pressed ? 0.6 : 1 },
              ]}
            >
              {cancelling ? (
                <ActivityIndicator color={colors.destructive} size="small" />
              ) : (
                <Feather name="x-circle" size={16} color={colors.destructive} />
              )}
              <Text style={[styles.cancelBtnText, { color: colors.destructive }]}>
                {cancelling ? 'Canceling…' : 'Cancel Membership'}
              </Text>
            </Pressable>
            <Text style={[styles.cancelNote, { color: colors.mutedForeground }]}>
              You will keep access until {nextBillingDate}.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function DetailRow({
  label, value, valueColor, colors,
}: {
  label: string;
  value: string;
  valueColor?: string;
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
}) {
  return (
    <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: valueColor ?? colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: 'Inter_700Bold' },
  content: { padding: 20, gap: 16 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    padding: 16,
  },
  statusIconWrap: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  statusInfo: { flex: 1, gap: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusLabel: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  statusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusPillText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  statusTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  statusMeta: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  detailsCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 0 },
  sectionTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  detailLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  detailValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  featureIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
  upgradeCard: { borderRadius: 16, padding: 20, borderWidth: 1, alignItems: 'center', gap: 10 },
  upgradeTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  upgradeDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 24,
    marginTop: 4,
  },
  upgradeBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  testNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  testNoteText: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  dangerSection: { gap: 8 },
  dangerTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  cancelNote: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
