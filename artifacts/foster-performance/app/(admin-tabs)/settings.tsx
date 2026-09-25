import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function AdminSettings() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [commissionPct, setCommissionPct] = useState('10');
  const [membershipFee, setMembershipFee] = useState('9.99');
  const [coachAppFee, setCoachAppFee] = useState('9.99');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  // Load settings from Supabase on mount.
  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('platform_settings').select('key,value');
      if (error) throw error;
      if (Array.isArray(data)) {
        const find = (key: string, fallback: string) =>
          String((data as any[]).find((s: any) => s.key === key)?.value ?? fallback);
        setCommissionPct(find('platform_commission_pct', '10'));
        setMembershipFee(find('member_monthly_fee', '9.99'));
        setCoachAppFee(find('coach_app_fee', '9.99'));
      }
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const saveSetting = async (key: string, value: string) => {
    const numericValue = Number(value);
    const { error } = await supabase.from('platform_settings').upsert({
      key,
      value: Number.isFinite(numericValue) ? numericValue : value,
      updated_by: user?.id ?? null,
    });
    if (error) throw error;
  };

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    try {
      await Promise.all([
        saveSetting('platform_commission_pct', commissionPct),
        saveSetting('member_monthly_fee', membershipFee),
        saveSetting('coach_app_fee', coachAppFee),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <BackgroundLayer />
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Platform Settings</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>Fees, commissions & configuration</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: botPad + 20 }]}>
          {/* Pricing settings */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Pricing & Fees</Text>
            {[
              {
                label: 'Platform Commission (%)',
                sublabel: 'Percentage taken from each coach booking',
                value: commissionPct,
                onChange: setCommissionPct,
                suffix: '%',
              },
              {
                label: 'Member Monthly Fee ($)',
                sublabel: 'Foster Pro membership monthly price',
                value: membershipFee,
                onChange: setMembershipFee,
                suffix: '$',
              },
              {
                label: 'Coach Platform Fee ($/mo)',
                sublabel: 'Monthly fee charged to active coaches',
                value: coachAppFee,
                onChange: setCoachAppFee,
                suffix: '$',
              },
            ].map((f) => (
              <View key={f.label} style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: colors.foreground }]}>{f.label}</Text>
                  <Text style={[styles.settingDesc, { color: colors.mutedForeground }]}>{f.sublabel}</Text>
                </View>
                <View style={[styles.valueInput, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.valueText, { color: colors.foreground }]}
                    value={f.value}
                    onChangeText={f.onChange}
                    keyboardType="decimal-pad"
                  />
                  <Text style={[styles.suffix, { color: colors.mutedForeground }]}>{f.suffix}</Text>
                </View>
              </View>
            ))}

            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: saved ? colors.success : colors.primary, opacity: pressed || saving ? 0.8 : 1 },
              ]}
            >
              {saved ? (
                <><Feather name="check" size={16} color="#FFF" /><Text style={styles.saveBtnText}>Saved!</Text></>
              ) : (
                <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Settings'}</Text>
              )}
            </Pressable>
          </View>

          {/* Owner Admin info */}
          <View style={[styles.infoCard, { backgroundColor: '#D6A84B12', borderColor: '#D6A84B33' }]}>
            <MaterialCommunityIcons name="shield-lock-outline" size={16} color="#D6A84B" />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.infoTitle, { color: '#D6A84B' }]}>Owner Admin Security</Text>
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                The Owner Admin role is assigned exclusively via the {`OWNER_ADMIN_EMAIL`} environment variable on the server. It cannot be assigned, requested, or revoked through the app interface. There is only one Owner Admin account.
              </Text>
            </View>
          </View>

          {/* Test Mode notice */}
          <View style={[styles.infoCard, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '33' }]}>
            <MaterialCommunityIcons name="test-tube" size={16} color={colors.primary} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.infoTitle, { color: colors.primary }]}>Test Mode Active</Text>
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                All payments and payouts are running in Stripe Test Mode. No real money is charged. Connect Stripe Live Mode via the Integrations tab to go live.
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, gap: 12 },
  backBtn: { paddingBottom: 2 },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  content: { padding: 16, gap: 16 },
  section: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  settingDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  // Fixed width, not minWidth: the flex:1 TextInput inside made this grow at
  // narrow widths and squeezed the label column down to a few characters.
  valueInput: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, height: 40, width: 104, flexShrink: 0 },
  valueText: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  suffix: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  saveBtn: { height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#FFF' },
  infoCard: { flexDirection: 'row', gap: 10, borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'flex-start' },
  infoTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  infoText: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
});
