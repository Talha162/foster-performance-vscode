import React, { useState } from 'react';
import { Alert, Platform, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { AppButton } from '@/components/AppButton';
import { PageHeader, SectionCard, StatusPill } from '@/components/ProductUI';
import { spacing, typography } from '@/constants/colors';
import { supabase } from '@/lib/supabase';

export default function DataExport() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<'idle' | 'processing' | 'ready' | 'failed'>('idle');
  const [exportJson, setExportJson] = useState('');

  const requestExport = async () => {
    setState('processing');
    const { data, error } = await supabase.functions.invoke('export-data');
    if (error) {
      setState('failed');
      Alert.alert('Export failed', error.message);
      return;
    }
    setExportJson(JSON.stringify(data, null, 2));
    setState('ready');
  };

  const shareExport = async () => {
    await Share.share({ title: 'Foster Performance data export', message: exportJson });
  };

  return <View style={[styles.root, { backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 40 : insets.top }]}>
    <BackgroundLayer />
    <PageHeader title="Export Your Data" subtitle="Portable account copy" />
    <View style={styles.content}>
      <View style={[styles.icon, { backgroundColor: colors.primary + '18' }]}><Feather name="download-cloud" size={42} color={colors.primary} /></View>
      <Text style={[styles.title, { color: colors.foreground }]}>{state === 'idle' ? 'Request an export' : state === 'ready' ? 'Your export is ready' : state === 'failed' ? 'Export needs attention' : 'Preparing your export'}</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>Includes your profile, workouts, nutrition entries, bookings, subscriptions, achievements, notifications, and other account records available to you.</Text>
      <SectionCard title="Request status"><StatusPill label={state === 'idle' ? 'Not requested' : state} tone={state === 'ready' ? 'success' : state === 'failed' ? 'danger' : 'warning'} /></SectionCard>
      {state === 'ready'
        ? <AppButton label="Share Secure Export" onPress={shareExport} />
        : <AppButton label={state === 'processing' ? 'Preparing…' : state === 'failed' ? 'Try Again' : 'Request Export'} disabled={state === 'processing'} onPress={requestExport} />}
    </View>
  </View>;
}

const styles = StyleSheet.create({ root: { flex: 1 }, content: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }, icon: { width: 88, height: 88, borderRadius: 44, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }, title: { ...typography.hero, textAlign: 'center' }, body: { ...typography.body, textAlign: 'center' } });
