import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useAuth } from '@/context/AuthContext';

function getApiBase() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api`;
  return 'http://localhost:8080/api';
}

export default function CoachBillingSettings() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [status, setStatus] = useState<{ status: string; plan: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${getApiBase()}/coach-subscriptions/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await resp.json().catch(() => ({}));
        setStatus(data);
      } catch {
        setStatus({ status: 'none', plan: null });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCancel = () => {
    Alert.alert(
      'Cancel Coach Subscription',
      'Your subscription will remain active until the end of the current billing period. Are you sure?',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await fetch(`${getApiBase()}/coach-subscriptions/cancel`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
              });
              setStatus((prev) => prev ? { ...prev, status: 'cancelled' } : prev);
            } catch {
              Alert.alert('Error', 'Could not cancel subscription. Please try again.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = () => {
    switch (status?.status) {
      case 'active': return colors.success;
      case 'cancelled': return '#FF5050';
      default: return colors.mutedForeground;
    }
  };

  const getPlanLabel = (plan: string | null) => {
    if (!plan) return '—';
    if (plan.includes('annual')) return 'Annual ($249.99/year)';
    if (plan.includes('monthly')) return 'Monthly ($29.99/month)';
    return plan;
  };

  return (
    <View style={styles.root}>
      <BackgroundLayer />
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Billing & Subscription</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>Manage your coach plan</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 40 }]}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
        ) : (
          <>
            {/* Status card */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.statusRow}>
                <MaterialCommunityIcons name="crown-outline" size={24} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>Coach Platform</Text>
                  <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
                    {getPlanLabel(status?.plan ?? null)}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '22' }]}>
                  <Text style={[styles.statusBadgeText, { color: getStatusColor() }]}>
                    {status?.status ?? 'none'}
                  </Text>
                </View>
              </View>

              {status?.status === 'none' && (
                <Pressable
                  onPress={() => router.push('/coach-subscription')}
                  style={({ pressed }) => [
                    styles.upgradeBtn,
                    { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <MaterialCommunityIcons name="lightning-bolt" size={16} color="#FFF" />
                  <Text style={styles.upgradeBtnText}>Subscribe to Coach Platform</Text>
                </Pressable>
              )}
            </View>

            {/* Included features */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>What's included</Text>
              {[
                { icon: 'calendar-check', label: 'Booking calendar & availability' },
                { icon: 'account-multiple', label: 'Client management dashboard' },
                { icon: 'currency-usd', label: 'Earnings tracking & payouts' },
                { icon: 'magnify', label: 'Listed in Coach Marketplace' },
                { icon: 'clipboard-list', label: 'Program creation tools' },
              ].map((f) => (
                <View key={f.label} style={styles.featureRow}>
                  <MaterialCommunityIcons name={f.icon as any} size={16} color={colors.success} />
                  <Text style={[styles.featureText, { color: colors.foreground }]}>{f.label}</Text>
                </View>
              ))}
            </View>

            {/* Billing info */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Billing Details</Text>
              {[
                { label: 'Status', value: status?.status ?? 'none' },
                { label: 'Plan', value: getPlanLabel(status?.plan ?? null) },
                { label: 'Platform fee', value: '10% per completed session' },
              ].map((row) => (
                <View key={row.label} style={[styles.infoRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>{row.value}</Text>
                </View>
              ))}
            </View>

            {/* Actions */}
            {status?.status === 'active' && (
              <Pressable
                onPress={handleCancel}
                disabled={cancelling}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  { borderColor: '#FF5050', opacity: pressed || cancelling ? 0.7 : 1 },
                ]}
              >
                {cancelling ? (
                  <ActivityIndicator color="#FF5050" size="small" />
                ) : (
                  <>
                    <Feather name="x-circle" size={16} color="#FF5050" />
                    <Text style={styles.cancelBtnText}>Cancel Subscription</Text>
                  </>
                )}
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  content: { padding: 16, gap: 14 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  cardDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusBadgeText: { fontSize: 12, fontFamily: 'Inter_700Bold', textTransform: 'capitalize' },
  upgradeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: 10 },
  upgradeBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#FFF' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  infoLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  infoValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: 12, borderWidth: 1 },
  cancelBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#FF5050' },
});
