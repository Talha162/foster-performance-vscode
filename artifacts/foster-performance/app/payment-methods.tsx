import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { AppButton } from '@/components/AppButton';
import { InfoRow, MockNotice, PageHeader, SectionCard, StatusPill } from '@/components/ProductUI';
import { spacing } from '@/constants/colors';

export default function PaymentMethodsScreen() {
  const colors = useColors(); const insets = useSafeAreaInsets(); const [state, setState] = useState<'idle'|'launching'|'success'|'failed'|'auth'>('idle');
  const launch = () => { setState('launching'); setTimeout(() => setState('auth'), 700); };
  return <View style={[styles.root,{backgroundColor:colors.background,paddingTop:Platform.OS==='web'?40:insets.top}]}><BackgroundLayer/><PageHeader title="Payment Methods" subtitle="Secure provider-managed payments"/><ScrollView contentContainerStyle={[styles.content,{paddingBottom:insets.bottom+24}]}><MockNotice>No raw card details are stored here. Stripe PaymentSheet/provider connection is pending Milestone 2.</MockNotice><SectionCard title="Saved methods"><InfoRow icon="credit-card-outline" label="Visa ending in 4242" value="Preview method · Expires 12/29 · Default"/><StatusPill label="Provider preview" tone="muted"/></SectionCard><SectionCard title="Secure payment flow"><InfoRow icon="shield-lock-outline" label="Add payment method" value="Launches the secure provider sheet"/><InfoRow icon="lock-check-outline" label="Authentication" value="3D Secure or bank authentication may be required"/>{state==='auth'&&<StatusPill label="Authentication required" tone="warning"/>}{state==='success'&&<StatusPill label="Payment method added" tone="success"/>}{state==='failed'&&<StatusPill label="Provider unavailable — try again" tone="danger"/>}</SectionCard><AppButton label={state==='launching'?'Opening secure provider…':'Add Payment Method'} loading={state==='launching'} onPress={launch}/>{state==='auth'&&<><AppButton label="Complete Authentication (Preview)" onPress={()=>setState('success')}/><AppButton label="Simulate Failure" variant="secondary" onPress={()=>setState('failed')}/></>}</ScrollView></View>;
}
const styles=StyleSheet.create({root:{flex:1},content:{padding:spacing.md,gap:spacing.md}});
