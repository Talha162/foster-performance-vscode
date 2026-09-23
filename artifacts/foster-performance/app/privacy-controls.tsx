import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { InfoRow, PageHeader, SectionCard, StatusPill } from '@/components/ProductUI';
import { spacing } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type PrivacyPreferences = { health: boolean; analytics: boolean; marketing: boolean };
const defaults: PrivacyPreferences = { health: true, analytics: false, marketing: false };

export default function PrivacyControls() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [preferences, setPreferences] = useState(defaults);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from('user_app_state').select('privacy_preferences').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data?.privacy_preferences) setPreferences({ ...defaults, ...data.privacy_preferences }); });
  }, [user]);

  const setPreference = async (key: keyof PrivacyPreferences, value: boolean) => {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    setSaved(false);
    if (!user) return;
    const { error } = await supabase.from('user_app_state').upsert({ user_id: user.id, privacy_preferences: next });
    setSaved(!error);
  };

  const Toggle = ({ label, name }: { label: string; name: keyof PrivacyPreferences }) => <View style={styles.toggle}>
    <Text style={[styles.toggleText, { color: colors.foreground }]}>{label}</Text>
    <Switch value={preferences[name]} onValueChange={(value) => setPreference(name, value)} trackColor={{ true: colors.primary, false: colors.muted }} accessibilityLabel={label} />
  </View>;

  return <View style={[styles.root, { backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 40 : insets.top }]}>
    <BackgroundLayer />
    <PageHeader title="Privacy & Data" subtitle="Control your information" />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      <SectionCard title="Consent preferences">
        <Toggle label="Use health data for FP Score" name="health" />
        <Toggle label="Optional product analytics" name="analytics" />
        <Toggle label="Marketing communications" name="marketing" />
        <StatusPill label={saved ? 'Saved securely' : 'Saving…'} tone={saved ? 'success' : 'warning'} />
      </SectionCard>
      <SectionCard title="Your data">
        <InfoRow icon="archive-arrow-down-outline" label="Request data export" value="Prepare a portable copy of your account data" onPress={() => router.push('/data-export')} />
        <InfoRow icon="account-remove-outline" label="Delete account" value="Permanently remove your account and linked data" danger onPress={() => router.push('/delete-account')} />
        <InfoRow icon="shield-account-outline" label="Privacy policy" value="Review how Foster Performance handles data" onPress={() => router.push('/privacy-policy')} />
      </SectionCard>
      <SectionCard title="Account controls">
        <InfoRow icon="devices" label="Active sessions" value="Sign out other devices from Profile → Security" />
        <InfoRow icon="bell-outline" label="Notification permission" value="Managed in notification preferences" onPress={() => router.push('/notifications')} />
      </SectionCard>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({ root: { flex: 1 }, content: { padding: spacing.md, gap: spacing.md }, toggle: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, toggleText: { fontSize: 14, flex: 1, paddingRight: 12 } });
