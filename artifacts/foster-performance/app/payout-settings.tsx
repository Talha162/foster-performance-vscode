import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';

export default function PayoutSettings() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<'checking' | 'savings'>('checking');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleConnectStripe = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Stripe Connect — Test Mode',
      'In production, this button would open the Stripe Connect onboarding flow to link your bank account. ' +
        'Payouts are processed weekly, every Friday.',
      [{ text: 'Got it' }]
    );
  };

  return (
    <View style={styles.root}>
      <BackgroundLayer />
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Payout Settings</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            Connect your bank to receive earnings
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 40 }]}
      >
        {/* Test Mode Banner */}
        <View style={[styles.testBanner, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '44' }]}>
          <MaterialCommunityIcons name="flask-outline" size={16} color={colors.accent} />
          <Text style={[styles.testBannerText, { color: colors.accent }]}>
            Test Mode — Real bank transfers are not processed
          </Text>
        </View>

        {/* Stripe Connect CTA */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardRow}>
            <MaterialCommunityIcons name="bank-outline" size={28} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Connect Bank Account</Text>
              <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
                Powered by Stripe Connect. Secure bank-grade encryption.
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Text style={[styles.label, { color: colors.mutedForeground }]}>Why Stripe Connect?</Text>
          {[
            '✓  Weekly automatic payouts every Friday',
            '✓  Instant access to earnings dashboard',
            '✓  1099-K tax forms generated automatically',
            '✓  Bank-grade encryption — Foster never stores card data',
          ].map((line) => (
            <Text key={line} style={[styles.featureLine, { color: colors.foreground }]}>
              {line}
            </Text>
          ))}

          <Pressable
            onPress={handleConnectStripe}
            style={({ pressed }) => [
              styles.connectBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <MaterialCommunityIcons name="bank-transfer" size={18} color={colors.primaryForeground} />
            <Text style={[styles.connectBtnText, { color: colors.primaryForeground }]}>
              Connect Bank Account
            </Text>
          </Pressable>
        </View>

        {/* Payout Schedule */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Payout Schedule</Text>
          {[
            { label: 'Frequency', value: 'Weekly' },
            { label: 'Payout day', value: 'Every Friday' },
            { label: 'Minimum payout', value: '$10.00' },
            { label: 'Platform fee', value: '10% per session' },
            { label: 'Processing time', value: '2–3 business days' },
          ].map((row) => (
            <View key={row.label} style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* Support */}
        <Pressable
          onPress={() => Linking.openURL('mailto:coaches@fosterperformance.app')}
          style={({ pressed }) => [
            styles.supportBtn,
            { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="mail" size={16} color={colors.primary} />
          <Text style={[styles.supportBtnText, { color: colors.primary }]}>
            Contact payout support
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  content: { padding: 16, gap: 14 },
  testBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  testBannerText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', flex: 1 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  cardDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  divider: { height: 1 },
  label: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  featureLine: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    marginTop: 4,
  },
  connectBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  infoLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  infoValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
  },
  supportBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
