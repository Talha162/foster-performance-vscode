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
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function SubscriptionCheckoutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, updateSubscription } = useAuth();
  const params = useLocalSearchParams<{ plan?: string }>();
  const plan = (params.plan === 'annual' ? 'annual' : 'monthly') as 'monthly' | 'annual';

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const planLabel = plan === 'annual' ? 'Annual Plan' : 'Monthly Plan';
  const planPrice = plan === 'annual' ? '$79.99/year' : '$9.99/month';
  const planDetail = plan === 'annual' ? 'Billed $79.99 today ($6.67/month)' : 'Billed $9.99 today, renews monthly';

  const handleSubscribe = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLoading(true);
    setError('');

    try {
      const returnUrl = Linking.createURL('/billing-settings');
      const { data, error: billingError } = await supabase.functions.invoke('billing', {
        body: { action: 'create-member-checkout', plan, returnUrl },
      });
      if (billingError) throw billingError;
      if (!data?.checkoutUrl) throw new Error('Secure checkout is unavailable.');
      const result = await WebBrowser.openAuthSessionAsync(data.checkoutUrl, returnUrl);
      if (result.type !== 'success') return;
      await updateSubscription({});

      router.replace('/(tabs)');
      setTimeout(() => {
        Alert.alert(
          'Welcome to Foster Performance! 🎉',
          `Your ${planLabel} is now active. You have full access to all premium features and the Coach Marketplace.`,
          [{ text: 'Let\'s Go!' }]
        );
      }, 500);
    } catch {
      setError('Checkout could not be started. Please try again or contact support.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <BackgroundLayer />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Checkout</Text>
        <View style={[styles.testBadge, { backgroundColor: '#F5A623' + '22', borderColor: '#F5A623' }]}>
          <Text style={[styles.testBadgeText, { color: '#F5A623' }]}>TEST MODE</Text>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: botPad + 120 }]}
        >
          {/* Order Summary */}
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.accent + '22' }]}>
              <MaterialCommunityIcons name="crown" size={24} color={colors.accent} />
            </View>
            <View style={styles.summaryInfo}>
              <Text style={[styles.summaryTitle, { color: colors.foreground }]}>Foster Performance Membership</Text>
              <Text style={[styles.summaryPlan, { color: colors.mutedForeground }]}>{planLabel} · {planPrice}</Text>
              <Text style={[styles.summaryDetail, { color: colors.mutedForeground }]}>{planDetail}</Text>
            </View>
          </View>

          {/* What's included */}
          <View style={[styles.featuresCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.featuresTitle, { color: colors.foreground }]}>What's included</Text>
            {[
              'Access to all 45+ training programs',
              'Fitness, strength, running & recovery content',
              'Goal-personalized nutrition plans',
              'Coach marketplace access',
              'Advanced progress tracking',
              'Cancel anytime',
            ].map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />
                <Text style={[styles.featureText, { color: colors.foreground }]}>{f}</Text>
              </View>
            ))}
          </View>

          {/* Note: coaching is separate */}
          <View style={[styles.noteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="information-outline" size={15} color={colors.mutedForeground} />
            <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
              Membership gives you platform access. Private coaching sessions and coach-created programs are purchased separately.
            </Text>
          </View>

          {/* Secure payment handoff */}
          <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.formTitle, { color: colors.foreground }]}>Secure Stripe Checkout</Text>
            <Text style={[styles.formSubtitle, { color: colors.mutedForeground }]}>
              Continue to Stripe's encrypted checkout to enter your payment details. Foster Performance never receives or stores your card number.
            </Text>
            <View style={styles.secureRow}>
              <MaterialCommunityIcons name="shield-lock-outline" size={22} color={colors.success} />
              <Text style={[styles.noteText, { color: colors.mutedForeground }]}>PCI-compliant payment processing</Text>
            </View>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: '#FF444422', borderColor: '#FF4444' }]}>
                <Feather name="alert-circle" size={13} color="#FF4444" />
                <Text style={[styles.errorText, { color: '#FF4444' }]}>{error}</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>

      {/* CTA Bar */}
      <View style={[styles.ctaBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: botPad + 16 }]}>
        <Pressable
          onPress={handleSubscribe}
          disabled={loading}
          style={({ pressed }) => [styles.ctaBtn, { backgroundColor: colors.primary, opacity: pressed || loading ? 0.8 : 1 }]}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <MaterialCommunityIcons name="lock" size={18} color={colors.primaryForeground} />
              <Text style={[styles.ctaBtnText, { color: colors.primaryForeground }]}>
                Subscribe · {planPrice}
              </Text>
            </>
          )}
        </Pressable>
        <Text style={[styles.ctaNote, { color: colors.mutedForeground }]}>
          Secure payment · Cancel anytime · Test Mode
        </Text>
      </View>
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
  testBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  testBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  content: { padding: 20, gap: 16 },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  summaryIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  summaryInfo: { flex: 1, gap: 3 },
  summaryTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  summaryPlan: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  summaryDetail: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  featuresCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 10 },
  featuresTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  noteCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, padding: 12, borderWidth: 1 },
  noteText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  formCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 14 },
  formTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  formSubtitle: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16, marginTop: -6 },
  secureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 },
  field: { gap: 5 },
  label: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 46,
  },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  cardRow: { flexDirection: 'row', gap: 12 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorText: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium' },
  ctaBar: { padding: 20, borderTopWidth: 1, gap: 8 },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 14,
  },
  ctaBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  ctaNote: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
