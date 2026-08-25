import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { InfoRow, MockNotice, PageHeader, SectionCard, StatusPill } from '@/components/ProductUI';
import { spacing } from '@/constants/colors';

const invoices=[['FP-2026-008','Aug 1, 2026','$9.99','Paid'],['FP-2026-007','Jul 1, 2026','$9.99','Paid'],['FP-2026-006','Jun 1, 2026','$9.99','Refunded']];
export default function BillingHistoryScreen(){const colors=useColors();const insets=useSafeAreaInsets();return <View style={[styles.root,{backgroundColor:colors.background,paddingTop:Platform.OS==='web'?40:insets.top}]}><BackgroundLayer/><PageHeader title="Billing History" subtitle="Invoices, receipts and refunds"/><ScrollView contentContainerStyle={[styles.content,{paddingBottom:insets.bottom+24}]}><SectionCard title="Payment recovery"><InfoRow icon="alert-circle-outline" label="Failed payment example" value="Update your payment method to restore uninterrupted access"/><StatusPill label="No action needed" tone="success"/></SectionCard><SectionCard title="Invoices">{invoices.map(([id,date,amount,status])=><InfoRow key={id} icon="receipt-text-outline" label={`${amount} · ${status}`} value={`${id} · ${date}`} onPress={()=>{}}/>)}</SectionCard><SectionCard title="Refund status"><InfoRow icon="cash-refund" label="Refunded" value="Full and partial refund states will update from the payment provider"/><InfoRow icon="progress-clock" label="Processing" value="Usually returns to the original method after provider confirmation"/><InfoRow icon="lifebuoy" label="Refund failed" value="Contact support with the invoice reference"/></SectionCard><MockNotice>Invoice files and authoritative billing history will be supplied by the commerce backend in Milestone 2.</MockNotice></ScrollView></View>}
const styles=StyleSheet.create({root:{flex:1},content:{padding:spacing.md,gap:spacing.md}});
