import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { PageHeader, SectionCard, StatusPill } from '@/components/ProductUI';
import { RoleGate } from '@/components/RoleGate';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { pickImage, uploadAvatar } from '@/lib/storage';
import { Image } from 'expo-image';

const SPECIALTIES = ['Strength', 'Fat loss', 'Mobility', 'Nutrition', 'Sport performance'];

export default function CoachProfileEditor() {
  const colors = useColors(); const insets = useSafeAreaInsets(); const { user, updateUser } = useAuth();
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [available, setAvailable] = useState(true); const [preview, setPreview] = useState(false); const [saved, setSaved] = useState(false);
  const [prices, setPrices] = useState<Record<30 | 60 | 90, string>>({ 30: '', 60: '', 90: '' });
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Prices are stored in cents but edited in whole dollars.
  const centsToInput = (value: number | null | undefined) => (value == null ? '' : String(Math.round(value / 100)));
  const inputToCents = (value: string) => (value.trim() === '' ? null : Math.round(Number(value) * 100));

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setLoadError(null);
    try {
      const { data, error } = await supabase.from('coach_profiles')
        .select('professional_title, biography, specialties, accepting_clients, session_30_price_cents, session_60_price_cents, session_90_price_cents')
        .eq('user_id', user.id).maybeSingle();
      if (error) throw new Error(error.message);
      if (data) {
        setTitle(data.professional_title ?? '');
        setBio(data.biography ?? '');
        setSpecialties(data.specialties ?? []);
        setAvailable(data.accepting_clients ?? true);
        setPrices({
          30: centsToInput(data.session_30_price_cents),
          60: centsToInput(data.session_60_price_cents),
          90: centsToInput(data.session_90_price_cents),
        });
      }
    } catch (error: any) {
      setLoadError(error?.message ?? 'Could not load your profile.');
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('coach_profiles').upsert({
        user_id: user.id,
        professional_title: title.trim(),
        biography: bio.trim(),
        specialties,
        accepting_clients: available,
        session_30_price_cents: inputToCents(prices[30]),
        session_60_price_cents: inputToCents(prices[60]),
        session_90_price_cents: inputToCents(prices[90]),
      }, { onConflict: 'user_id' });
      if (error) throw new Error(error.message);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (error: any) {
      Alert.alert('Could not save profile', error?.message ?? 'Please try again.');
    } finally { setSaving(false); }
  };

  const handlePhoto = async () => {
    if (!user || uploading) return;
    try {
      const picked = await pickImage({ square: true });
      if (!picked) return;
      setUploading(true);
      const url = await uploadAvatar(user.id, picked);
      await updateUser({ avatarUrl: url });
      setAvatarUrl(url);
    } catch (error: any) {
      Alert.alert('Could not update photo', error?.message ?? 'Please try again.');
    } finally { setUploading(false); }
  };
  const topPad = Platform.OS === 'web' ? 48 : insets.top; const bottomPad = Platform.OS === 'web' ? 32 : insets.bottom + 24;
  const toggleSpecialty = (item: string) => setSpecialties((items) => items.includes(item) ? items.filter((x) => x !== item) : [...items, item]);
  return <RoleGate allow={['coach']}><View style={styles.root}><BackgroundLayer /><View style={{ paddingTop: topPad }}><PageHeader title="Public Coach Profile" subtitle="Edit and preview marketplace details" right={<Pressable onPress={() => setPreview(true)} accessibilityRole="button" accessibilityLabel="Preview public profile" style={styles.headerButton}><Feather name="eye" size={21} color={colors.primary} /></Pressable>} /></View><ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]} keyboardShouldPersistTaps="handled">{loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} /> : null}{loadError ? <SectionCard><Text style={[styles.name, { color: colors.destructive }]}>Could not load your profile</Text><Text style={[styles.small, { color: colors.mutedForeground }]}>{loadError}</Text><Pressable onPress={load} style={[styles.primary, { backgroundColor: colors.primary, marginTop: 10 }]}><Text style={styles.primaryText}>Retry</Text></Pressable></SectionCard> : null}<SectionCard title="Profile identity"><View style={styles.identity}><Pressable onPress={handlePhoto} disabled={uploading} accessibilityRole="button" accessibilityLabel="Change profile photo" style={[styles.avatar, { backgroundColor: colors.accent + '22', borderColor: colors.accent, overflow: 'hidden' }]}>{uploading ? <ActivityIndicator color={colors.accent} /> : avatarUrl ? <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Text style={[styles.avatarText, { color: colors.accent }]}>{(user?.name ?? 'Coach').split(' ').map((part) => part[0]).join('').slice(0, 2)}</Text>}<View style={[styles.camera, { backgroundColor: colors.primary }]}><Feather name="camera" size={13} color="#fff" /></View></Pressable><View style={{ flex: 1 }}><Text style={[styles.name, { color: colors.foreground }]}>{user?.name ?? 'Coach'}</Text><StatusPill label={available ? 'Listed in the directory' : 'Hidden from the directory'} tone={available ? 'success' : 'muted'} /><Text style={[styles.small, { color: colors.mutedForeground }]}>This is what members see when they browse coaches.</Text></View></View><Label text="Professional title" colors={colors} /><TextInput value={title} onChangeText={setTitle} maxLength={80} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} /><Label text="Professional bio" colors={colors} /><TextInput value={bio} onChangeText={setBio} multiline maxLength={500} style={[styles.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} /><Text style={[styles.counter, { color: colors.mutedForeground }]}>{bio.length}/500</Text></SectionCard><SectionCard title="Specialties and coaching"><View style={styles.chips}>{SPECIALTIES.map((item) => <Pressable key={item} onPress={() => toggleSpecialty(item)} accessibilityRole="checkbox" accessibilityState={{ checked: specialties.includes(item) }} style={[styles.chip, { backgroundColor: specialties.includes(item) ? colors.primary + '20' : colors.background, borderColor: specialties.includes(item) ? colors.primary : colors.border }]}><Text style={[styles.chipText, { color: specialties.includes(item) ? colors.primary : colors.foreground }]}>{item}</Text></Pressable>)}</View><View style={styles.infoLine}><MaterialCommunityIcons name="video-outline" size={20} color={colors.primary} /><Text style={[styles.lineText, { color: colors.foreground }]}>Online video coaching</Text></View><View style={styles.infoLine}><MaterialCommunityIcons name="map-marker-outline" size={20} color={colors.primary} /><Text style={[styles.lineText, { color: colors.foreground }]}>Online · Serving clients worldwide</Text></View><View style={styles.infoLine}><MaterialCommunityIcons name="calendar-check-outline" size={20} color={available ? colors.success : colors.mutedForeground} /><Text style={[styles.lineText, { color: colors.foreground }]}>Accepting new clients</Text><Switch value={available} onValueChange={setAvailable} trackColor={{ false: colors.border, true: colors.success + '99' }} thumbColor={available ? colors.success : colors.mutedForeground} /></View></SectionCard><SectionCard title="Services and pricing" subtitle="Marketplace price previews in USD">{([30, 60, 90] as const).map((duration) => <View key={duration} style={styles.service}><View style={{ flex: 1 }}><Text style={[styles.name, { color: colors.foreground }]}>{duration}-minute session</Text><Text style={[styles.small, { color: colors.mutedForeground }]}>{duration === 30 ? 'Focused check-in' : duration === 60 ? 'Standard coaching session' : 'Extended assessment and planning'}</Text></View><Text style={[styles.currency, { color: colors.mutedForeground }]}>$</Text><TextInput value={prices[duration]} onChangeText={(value) => setPrices((current) => ({ ...current, [duration]: value.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" style={[styles.price, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} accessibilityLabel={`${duration} minute service price`} /></View>)}</SectionCard><SectionCard title="Public trust information"><View style={styles.infoLine}><MaterialCommunityIcons name="certificate-outline" size={20} color={colors.accent} /><Text style={[styles.lineText, { color: colors.foreground }]}>Credentials shown after approval</Text></View><View style={styles.infoLine}><MaterialCommunityIcons name="star-outline" size={20} color={colors.accent} /><Text style={[styles.lineText, { color: colors.foreground }]}>Reviews: no verified reviews yet</Text></View><View style={styles.infoLine}><MaterialCommunityIcons name="file-document-outline" size={20} color={colors.accent} /><Text style={[styles.lineText, { color: colors.foreground }]}>24-hour cancellation policy preview</Text></View></SectionCard><Pressable onPress={handleSave} disabled={!title.trim() || !bio.trim() || saving} style={[styles.primary, { backgroundColor: saved ? colors.success : colors.primary, opacity: title.trim() && bio.trim() && !saving ? 1 : .4 }]}>{saving ? <ActivityIndicator color="#fff" /> : <><Feather name={saved ? 'check' : 'save'} size={18} color="#fff" /><Text style={styles.primaryText}>{saved ? 'Saved' : 'Save profile'}</Text></>}</Pressable></ScrollView><Modal visible={preview} animationType="slide" onRequestClose={() => setPreview(false)}><View style={[styles.root, { backgroundColor: colors.background }]}><View style={{ paddingTop: topPad }}><PageHeader title="Member Preview" subtitle="Marketplace profile preview" right={<Pressable onPress={() => setPreview(false)} style={styles.headerButton}><Feather name="x" size={22} color={colors.foreground} /></Pressable>} /></View><ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}><View style={styles.previewHero}><View style={[styles.avatar, { backgroundColor: colors.accent + '22', borderColor: colors.accent }]}><Text style={[styles.avatarText, { color: colors.accent }]}>{(user?.name ?? 'Coach').slice(0, 2).toUpperCase()}</Text></View><Text style={[styles.previewName, { color: colors.foreground }]}>{user?.name ?? 'Coach'}</Text><Text style={[styles.previewTitle, { color: colors.mutedForeground }]}>{title}</Text><StatusPill label={available ? 'Accepting clients' : 'Not accepting clients'} tone={available ? 'success' : 'muted'} /></View><SectionCard title="About"><Text style={[styles.bio, { color: colors.foreground }]}>{bio}</Text></SectionCard><SectionCard title="Specialties"><View style={styles.chips}>{specialties.map((item) => <StatusPill key={item} label={item} tone="info" />)}</View></SectionCard><SectionCard title="Book a session">{([30, 60, 90] as const).map((duration) => <View key={duration} style={styles.service}><Text style={[styles.lineText, { color: colors.foreground, flex: 1 }]}>{duration} minutes</Text><Text style={[styles.name, { color: colors.foreground }]}>${prices[duration] || '—'}</Text></View>)}</SectionCard></ScrollView></View></Modal></View></RoleGate>;
}
function Label({ text, colors }: { text: string; colors: ReturnType<typeof useColors> }) { return <Text style={[styles.label, { color: colors.mutedForeground }]}>{text}</Text>; }
const styles = StyleSheet.create({ root: { flex: 1 }, content: { padding: 16, gap: 13 }, headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, identity: { flexDirection: 'row', alignItems: 'center', gap: 13 }, avatar: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, alignItems: 'center', justifyContent: 'center' }, avatarText: { fontSize: 25, fontFamily: 'Inter_700Bold' }, camera: { position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, name: { fontFamily: 'Inter_700Bold', fontSize: 14 }, small: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 }, label: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 3 }, input: { minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontFamily: 'Inter_400Regular' }, textArea: { minHeight: 112, borderRadius: 12, borderWidth: 1, padding: 12, fontFamily: 'Inter_400Regular', textAlignVertical: 'top' }, counter: { textAlign: 'right', fontFamily: 'Inter_400Regular', fontSize: 10 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { minHeight: 42, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 }, infoLine: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10 }, lineText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13 }, service: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8 }, currency: { fontFamily: 'Inter_700Bold', fontSize: 14 }, price: { width: 70, minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontFamily: 'Inter_700Bold', textAlign: 'right' }, primary: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }, primaryText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 14 }, previewHero: { alignItems: 'center', gap: 8, paddingVertical: 14 }, previewName: { fontFamily: 'Inter_700Bold', fontSize: 22 }, previewTitle: { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center' }, bio: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 } });
