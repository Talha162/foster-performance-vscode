import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { AppButton } from '@/components/AppButton';
import { InfoRow, PageHeader, SectionCard } from '@/components/ProductUI';
import { radii, spacing, typography } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function DeleteAccount() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const deleteAccount = async () => {
    setDeleting(true);
    const { error } = await supabase.functions.invoke('delete-account', { body: { confirmation: confirm } });
    if (error) {
      setDeleting(false);
      Alert.alert('Deletion failed', error.message);
      return;
    }
    await logout().catch(() => undefined);
    router.replace('/(auth)/welcome');
  };

  return <View style={[styles.root, { backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 40 : insets.top }]}>
    <BackgroundLayer />
    <PageHeader title="Delete Account" subtitle="Permanent account and data deletion" />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      <SectionCard title="Before you continue">
        <InfoRow icon="dumbbell" label="Training and progress" value="Your workout, nutrition, and progress data will be permanently removed" />
        <InfoRow icon="message-outline" label="Messages and bookings" value="Records linked to your account will be deleted according to database retention rules" />
        <InfoRow icon="crown-outline" label="Subscription" value="Cancel active paid subscriptions before deleting your account" />
      </SectionCard>
      <SectionCard title="Confirm permanent deletion" subtitle="This action cannot be undone. Type DELETE to continue.">
        <Text style={[styles.label, { color: colors.foreground }]}>Confirmation</Text>
        <TextInput value={confirm} onChangeText={setConfirm} autoCapitalize="characters" placeholder="DELETE" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]} accessibilityLabel="Type DELETE to confirm" />
        <AppButton label={deleting ? 'Deleting…' : 'Permanently Delete Account'} variant="danger" disabled={confirm !== 'DELETE' || deleting} onPress={deleteAccount} />
      </SectionCard>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({ root: { flex: 1 }, content: { padding: spacing.md, gap: spacing.md }, label: { ...typography.label }, input: { height: 52, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.md, ...typography.body } });
