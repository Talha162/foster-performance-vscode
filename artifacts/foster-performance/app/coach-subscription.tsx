/**
 * Coach Platform subscription screen.
 *
 * TEST MODE: activates a subscription directly without card collection.
 * Real payment will use the native Stripe SDK/PaymentSheet once Task #5
 * (native Stripe card collection) is complete.
 */
import React, { useState } from 'react';
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
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useAuth } from '@/context/AuthContext';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';

const PLANS = [
  {
    id: 'monthly',
    label: 'Monthly',
    price: '$29.99',
    period: '/month',
    savings: null,
    description: 'Flexible, cancel anytime.',
  },
  {
    id: 'annual',
    label: 'Annual',
    price: '$249.99',
    period: '/year',
    savings: 'Save $109.89',
    description: 'Best value — 3 months free.',
  },
];

const FEATURES = [
  'Unlimited booking calendar',
  'Client management dashboard',
  'Session earnings tracking',
  'Featured in Coach Marketplace',
  'Program creation tools',
  'Priority support',
];

export default function CoachSubscriptionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  useAuth();

  const [plan, setPlan] = useState<'monthly' | 'annual'>('annual');
  const [loading, setLoading] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  /**
   * Activates a test-mode subscription without collecting card details.
   * Production payment via Stripe PaymentSheet will be wired in Task #5.
   */
  const handleActivate = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLoading(true);
    try {
      const returnUrl = Linking.createURL('/coach-billing-settings');
      const { data, error } = await supabase.functions.invoke('billing', {
        body: { action: 'create-coach-checkout', plan, returnUrl },
      });
      if (error) throw error;
      if (!data?.checkoutUrl) throw new Error('Secure checkout is unavailable.');
      const result = await WebBrowser.openAuthSessionAsync(data.checkoutUrl, returnUrl);
      if (result.type !== 'success') return;
      Alert.alert(
        'Payment Received',
        `Your ${plan} coach subscription is being activated. Your dashboard will update as soon as Stripe confirms payment.`,
        [{ text: 'Go to Dashboard', onPress: () => router.replace('/(coach-tabs)') }]
      );
    } catch {
      Alert.alert('Connection Error', 'Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = PLANS.find((p) => p.id === plan)!;

  return (
    <View style={styles.root}>
      <BackgroundLayer />
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Coach Platform</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            Subscribe to accept bookings
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 100 }]}
      >
        {/* Test mode notice */}
        <View style={[styles.testBanner, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '44' }]}>
          <MaterialCommunityIcons name="flask-outline" size={15} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.testTitle, { color: colors.accent }]}>Test Mode Active</Text>
            <Text style={[styles.testDesc, { color: colors.mutedForeground }]}>
              No real charges occur. Native Stripe payment will be enabled in an upcoming update.
            </Text>
          </View>
        </View>

        {/* Plan selector */}
        <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Choose a Plan</Text>
        <View style={styles.planRow}>
          {PLANS.map((p) => {
            const sel = plan === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPlan(p.id as 'monthly' | 'annual')}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: sel ? colors.primary + '15' : colors.card,
                    borderColor: sel ? colors.primary : colors.border,
                    borderWidth: sel ? 2 : 1,
                    flex: 1,
                  },
                ]}
              >
                {p.savings && (
                  <View style={[styles.savingsBadge, { backgroundColor: colors.success }]}>
                    <Text style={styles.savingsBadgeText}>{p.savings}</Text>
                  </View>
                )}
                <Text style={[styles.planLabel, { color: sel ? colors.primary : colors.mutedForeground }]}>
                  {p.label}
                </Text>
                <Text style={[styles.planPrice, { color: sel ? colors.primary : colors.foreground }]}>
                  {p.price}
                </Text>
                <Text style={[styles.planPeriod, { color: colors.mutedForeground }]}>{p.period}</Text>
                <Text style={[styles.planDesc, { color: colors.mutedForeground }]}>{p.description}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Features */}
        <View style={[styles.featuresCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.featuresTitle, { color: colors.foreground }]}>What's included</Text>
          {FEATURES.map((f) => (
            <View key={f} style={styles.featureRow}>
              <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />
              <Text style={[styles.featureText, { color: colors.foreground }]}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
              Coach Platform ({selectedPlan.label})
            </Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>{selectedPlan.price}</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryTotal, { color: colors.foreground }]}>Total today (test)</Text>
            <Text style={[styles.summaryTotalValue, { color: colors.primary }]}>$0.00</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.ctaBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: botPad + 16 }]}>
        <Pressable
          onPress={handleActivate}
          disabled={loading}
          style={({ pressed }) => [styles.ctaBtn, { backgroundColor: colors.primary, opacity: pressed || loading ? 0.8 : 1 }]}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <MaterialCommunityIcons name="lightning-bolt" size={18} color="#FFF" />
              <Text style={styles.ctaBtnText}>Activate {selectedPlan.label} Plan (Test)</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  content: { padding: 16, gap: 16 },
  testBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1, padding: 14 },
  testTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  testDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17, marginTop: 2 },
  sectionLabel: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  planRow: { flexDirection: 'row', gap: 10 },
  planCard: { borderRadius: 14, padding: 14, gap: 4, alignItems: 'center', position: 'relative', overflow: 'hidden' },
  savingsBadge: { position: 'absolute', top: 0, right: 0, paddingHorizontal: 8, paddingVertical: 3, borderBottomLeftRadius: 10 },
  savingsBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#FFF' },
  planLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 },
  planPrice: { fontSize: 22, fontFamily: 'Inter_700Bold', marginTop: 4 },
  planPeriod: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  planDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 4 },
  featuresCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  featuresTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  summary: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  summaryValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  summaryDivider: { height: 1 },
  summaryTotal: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  summaryTotalValue: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  ctaBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingTop: 12, borderTopWidth: 1 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: 14 },
  ctaBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#FFF' },
});
