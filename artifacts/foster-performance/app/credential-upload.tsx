/**
 * Credential Upload screen — lets coach applicants attach certifications
 * and résumé placeholders.  Documents are stored as metadata only (test mode).
 * Credential list is persisted to AsyncStorage under @coach_credentials.
 */
import React, { useEffect, useState } from 'react';
import {
  Alert, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';

const STORAGE_KEY = '@coach_credentials';

interface CredEntry {
  id: string;
  name: string;
  type: 'certification' | 'resume' | 'transcript' | 'photo';
  addedAt: string;
  placeholder: boolean;
  status?: 'uploaded' | 'processing' | 'verified' | 'rejected' | 'expired';
  feedback?: string;
}

const CRED_TYPES = [
  { value: 'certification', label: 'Certification', icon: 'certificate' },
  { value: 'resume',        label: 'Résumé / CV',    icon: 'file-account' },
  { value: 'transcript',   label: 'Transcript',      icon: 'school' },
  { value: 'photo',         label: 'Profile Photo',  icon: 'camera' },
] as const;

export default function CredentialUploadScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [credentials, setCredentials] = useState<CredEntry[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<CredEntry['type']>('certification');
  const [showAdd, setShowAdd] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try { setCredentials(JSON.parse(raw)); } catch {}
      }
    });
  }, []);

  const save = async (updated: CredEntry[]) => {
    setCredentials(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const handleAdd = async () => {
    if (!name.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const entry: CredEntry = {
      id: Date.now().toString(),
      name: name.trim(),
      type,
      addedAt: new Date().toISOString(),
      placeholder: true,
      status: 'uploaded',
    };
    await save([...credentials, entry]);
    setName('');
    setShowAdd(false);
  };

  const handleRemove = (id: string) => {
    Alert.alert('Remove Credential', 'Remove this credential entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await save(credentials.filter((c) => c.id !== id));
        },
      },
    ]);
  };

  const handleUploadPlaceholder = () => {
    Alert.alert(
      'Test Mode',
      'Document uploads are stored as metadata only during testing. Real file upload will be available when the app launches.',
      [{ text: 'OK' }]
    );
  };

  const getIcon = (t: CredEntry['type']) =>
    CRED_TYPES.find((ct) => ct.value === t)?.icon ?? 'file-document';

  const cycleStatus = async (credential: CredEntry) => {
    const states: NonNullable<CredEntry['status']>[] = ['uploaded', 'processing', 'verified', 'rejected', 'expired'];
    const current = credential.status ?? 'uploaded';
    const next = states[(states.indexOf(current) + 1) % states.length];
    await save(credentials.map((item) => item.id === credential.id ? {
      ...item,
      status: next,
      feedback: next === 'rejected' ? 'Preview feedback: issuer or expiry evidence needs clarification.' : next === 'expired' ? 'Preview feedback: replace this credential with a current document.' : undefined,
    } : item));
  };

  return (
    <View style={styles.root}>
      <BackgroundLayer />

      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Credentials</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>Certifications, résumé & documents</Text>
        </View>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowAdd(true); }}
          style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
        >
          <Feather name="plus" size={16} color={colors.primaryForeground} />
          <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>Add</Text>
        </Pressable>
      </View>

      {/* Test mode banner */}
      <View style={[styles.testBanner, { backgroundColor: '#D6A84B18', borderBottomColor: '#D6A84B44' }]}>
        <MaterialCommunityIcons name="flask-outline" size={14} color="#D6A84B" />
        <Text style={[styles.testBannerText, { color: '#D6A84B' }]}>
          Test mode — documents are stored as metadata. Real upload requires app review approval.
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: botPad + 20 }]}>
        {/* Add form */}
        {showAdd && (
          <View style={[styles.addForm, { backgroundColor: colors.card, borderColor: colors.primary }]}>
            <Text style={[styles.addFormTitle, { color: colors.foreground }]}>Add Credential</Text>

            <View style={styles.typeRow}>
              {CRED_TYPES.map((ct) => (
                <Pressable
                  key={ct.value}
                  onPress={() => setType(ct.value)}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: type === ct.value ? colors.primary + '22' : colors.background,
                      borderColor: type === ct.value ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <MaterialCommunityIcons name={ct.icon as any} size={14} color={type === ct.value ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.typeChipText, { color: type === ct.value ? colors.primary : colors.mutedForeground }]}>
                    {ct.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <MaterialCommunityIcons name={getIcon(type) as any} size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="e.g. NASM Certified Personal Trainer"
                placeholderTextColor={colors.mutedForeground}
                value={name}
                onChangeText={setName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleAdd}
              />
            </View>

            <View style={styles.addFormActions}>
              <Pressable
                onPress={() => { setShowAdd(false); setName(''); }}
                style={({ pressed }) => [styles.cancelFormBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.cancelFormBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleAdd}
                disabled={!name.trim()}
                style={({ pressed }) => [styles.saveFormBtn, { backgroundColor: colors.primary, opacity: !name.trim() || pressed ? 0.6 : 1 }]}
              >
                <Text style={[styles.saveFormBtnText, { color: colors.primaryForeground }]}>Save</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Credential list */}
        {credentials.length === 0 && !showAdd ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="certificate-outline" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No credentials yet</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              Add certifications, your résumé, and other credentials to strengthen your application.
            </Text>
            <Pressable
              onPress={() => setShowAdd(true)}
              style={({ pressed }) => [styles.emptyBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
            >
              <Feather name="plus" size={16} color={colors.primaryForeground} />
              <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>Add First Credential</Text>
            </Pressable>
          </View>
        ) : (
          credentials.map((cred) => (
            <View key={cred.id} style={[styles.credCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.credIcon, { backgroundColor: colors.primary + '18' }]}>
                <MaterialCommunityIcons name={getIcon(cred.type) as any} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.credName, { color: colors.foreground }]}>{cred.name}</Text>
                <Text style={[styles.credType, { color: colors.mutedForeground }]}>
                  {CRED_TYPES.find((ct) => ct.value === cred.type)?.label ?? cred.type}
                  {cred.placeholder && ' · Metadata only'}
                </Text>
                <Pressable
                  onPress={() => cycleStatus(cred)}
                  accessibilityRole="button"
                  accessibilityLabel={`Credential status ${cred.status ?? 'uploaded'}. Tap to preview next state.`}
                  style={[styles.statusPill, { backgroundColor: (cred.status === 'verified' ? colors.success : cred.status === 'rejected' || cred.status === 'expired' ? '#FF5050' : colors.accent) + '20' }]}
                >
                  <Text style={[styles.statusText, { color: cred.status === 'verified' ? colors.success : cred.status === 'rejected' || cred.status === 'expired' ? '#FF5050' : colors.accent }]}>{cred.status ?? 'uploaded'} · preview next</Text>
                </Pressable>
                {!!cred.feedback && <Text style={[styles.feedback, { color: '#FF8088' }]}>{cred.feedback}</Text>}
              </View>
              <View style={styles.credActions}>
                <Pressable
                  onPress={handleUploadPlaceholder}
                  style={({ pressed }) => [styles.uploadBtn, { borderColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
                >
                  <Feather name="upload" size={13} color={colors.primary} />
                  <Text style={[styles.uploadBtnText, { color: colors.primary }]}>Upload</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleRemove(cred.id)}
                  style={({ pressed }) => [styles.removeBtn, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Feather name="trash-2" size={15} color="#FF5050" />
                </Pressable>
              </View>
            </View>
          ))
        )}

        {/* Tips */}
        <View style={[styles.tipsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.tipsTitle, { color: colors.foreground }]}>What to include</Text>
          {[
            'Personal training certifications (NASM, ACE, ISSA, NSCA, etc.)',
            'Nutrition or health coaching credentials',
            'Degree or relevant education',
            'Résumé or professional bio',
            'Any sport-specific coaching licenses',
          ].map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <MaterialCommunityIcons name="check-circle-outline" size={15} color={colors.success} />
              <Text style={[styles.tipText, { color: colors.mutedForeground }]}>{tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  backBtn: { paddingBottom: 2 },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  testBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, paddingHorizontal: 20, borderBottomWidth: 1 },
  testBannerText: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium' },
  content: { padding: 16, gap: 12 },
  addForm: { borderRadius: 14, borderWidth: 2, padding: 16, gap: 12 },
  addFormTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  typeChipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 48 },
  input: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  addFormActions: { flexDirection: 'row', gap: 10 },
  cancelFormBtn: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cancelFormBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  saveFormBtn: { flex: 2, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  saveFormBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  empty: { borderRadius: 16, borderWidth: 1, padding: 32, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  emptyDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  emptyBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  credCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  credIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  credName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  credType: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  credActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  uploadBtnText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  removeBtn: { padding: 4 },
  tipsCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
  tipsTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, marginTop: 6 },
  statusText: { fontSize: 9, fontFamily: 'Inter_700Bold', textTransform: 'capitalize' },
  feedback: { fontSize: 10, fontFamily: 'Inter_400Regular', lineHeight: 14, marginTop: 4 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tipText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
});
