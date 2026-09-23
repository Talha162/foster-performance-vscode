import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const CATEGORIES = ['Fitness', 'Strength', 'Cardio', 'Nutrition', 'Mobility', 'Mental', 'Sport-Specific', 'Other'];

interface Program {
  id: string;
  title: string;
  description: string;
  category: string;
  price_cents: number;
  status: 'draft' | 'published';
}

export default function CoachPrograms() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'programs' | 'content'>('programs');

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('Fitness');
  const [newPrice, setNewPrice] = useState('');
  const [creating, setCreating] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 84 : insets.bottom + 84;

  const loadPrograms = useCallback(async () => {
    try {
      if (!user) return;
      const { data, error } = await supabase.from('workout_programs').select('id,title,description,category,price_cents,status').eq('owner_id', user.id).order('updated_at', { ascending: false });
      if (error) throw new Error(error.message);
      setPrograms((data ?? []).filter((item) => item.status !== 'archived') as Program[]);
    } catch {
      setPrograms([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadPrograms(); }, [loadPrograms]);

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Required', 'Please enter a program title.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCreating(true);
    try {
      const priceCents = newPrice ? Math.round(parseFloat(newPrice) * 100) : 0;
      if (!user) throw new Error('Authentication required');
      const { error } = await supabase.from('workout_programs').insert({
        id: `coach-${user.id}-${Date.now()}`,
        owner_id: user.id,
        title: newTitle.trim(),
        description: newDesc.trim(),
        category: newCategory,
        training_type: newCategory.toLowerCase(),
        level: 'Beginner',
        weeks: 1,
        days_per_week: 1,
        duration_minutes: 30,
        price_cents: priceCents,
        status: 'draft',
      });
      if (error) throw new Error(error.message);
      setShowCreate(false);
      setNewTitle('');
      setNewDesc('');
      setNewCategory('Fitness');
      setNewPrice('');
      await loadPrograms();
    } catch {
      Alert.alert('Error', 'Could not create program. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (program: Program) => {
    Alert.alert(
      'Delete Program',
      `Are you sure you want to delete "${program.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('workout_programs').delete().eq('id', program.id);
              if (error) throw new Error(error.message);
              setPrograms((prev) => prev.filter((p) => p.id !== program.id));
            } catch {
              Alert.alert('Error', 'Could not delete program.');
            }
          },
        },
      ]
    );
  };

  const handleToggleStatus = async (program: Program) => {
    const newStatus = program.status === 'published' ? 'draft' : 'published';
    try {
      const { error } = await supabase.from('workout_programs').update({ status: newStatus }).eq('id', program.id);
      if (error) throw new Error(error.message);
      setPrograms((prev) =>
        prev.map((p) => (p.id === program.id ? { ...p, status: newStatus } : p))
      );
    } catch {
      Alert.alert('Error', 'Could not update program status.');
    }
  };

  return (
    <View style={styles.root}>
      <BackgroundLayer />
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Programs</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowCreate(true);
          }}
          style={({ pressed }) => [
            styles.newBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="plus" size={16} color={colors.primaryForeground} />
          <Text style={[styles.newBtnText, { color: colors.primaryForeground }]}>New</Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(['programs', 'content'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[
              styles.tab,
              tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: tab === t ? colors.primary : colors.mutedForeground },
              ]}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: botPad }]}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'programs' ? (
          loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : programs.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="clipboard-list-outline" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No programs yet</Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                Create your first coaching program to offer structured plans to your clients.
              </Text>
              <Pressable
                onPress={() => setShowCreate(true)}
                style={({ pressed }) => [
                  styles.emptyBtn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Feather name="plus" size={16} color="#FFF" />
                <Text style={styles.emptyBtnText}>Create Program</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {programs.map((p) => (
                <View
                  key={p.id}
                  style={[styles.programCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.programTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.programTitle, { color: colors.foreground }]}>{p.title}</Text>
                      <Text style={[styles.programMeta, { color: colors.mutedForeground }]}>
                        {p.category}
                        {p.price_cents > 0 ? ` · $${(p.price_cents / 100).toFixed(0)}` : ' · Free'}
                      </Text>
                      {p.description ? (
                        <Text
                          style={[styles.programDesc, { color: colors.mutedForeground }]}
                          numberOfLines={2}
                        >
                          {p.description}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => handleToggleStatus(p)}
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            p.status === 'published' ? colors.success + '22' : colors.muted,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          {
                            color:
                              p.status === 'published' ? colors.success : colors.mutedForeground,
                          },
                        ]}
                      >
                        {p.status}
                      </Text>
                    </Pressable>
                  </View>
                  <View style={styles.programBottom}>
                    <MaterialCommunityIcons
                      name={p.status === 'published' ? 'eye' : 'eye-off'}
                      size={14}
                      color={colors.mutedForeground}
                    />
                    <Text style={[styles.statusHint, { color: colors.mutedForeground }]}>
                      {p.status === 'published' ? 'Visible to clients' : 'Draft — not visible'}
                    </Text>
                    <View style={{ flex: 1 }} />
                    <Pressable
                      onPress={() => handleDelete(p)}
                      hitSlop={8}
                      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                    >
                      <Feather name="trash-2" size={15} color="#FF5050" />
                    </Pressable>
                  </View>
                </View>
              ))}
            </>
          )
        ) : (
          <Pressable
            onPress={() => router.push('/coach-program-builder' as any)}
            accessibilityRole="button"
            accessibilityLabel="Open advanced program builder"
            style={[styles.comingSoon, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <MaterialCommunityIcons
              name="video-plus-outline"
              size={40}
              color={colors.mutedForeground}
            />
            <Text style={[styles.comingSoonTitle, { color: colors.foreground }]}>Content Uploads</Text>
            <Text style={[styles.comingSoonDesc, { color: colors.mutedForeground }]}>
              Build structured programs with exercises, prescriptions, media references, pricing, preview, and publish controls.
            </Text>
            <View style={[styles.emptyBtn, { backgroundColor: colors.primary }]}>
              <Feather name="edit-3" size={16} color="#FFF" />
              <Text style={styles.emptyBtnText}>Open Program Builder</Text>
            </View>
          </Pressable>
        )}
      </ScrollView>

      {/* Create Program Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="formSheet">
        <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Program</Text>
            <Pressable
              onPress={() => setShowCreate(false)}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            >
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Title *</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card },
                ]}
                placeholder="e.g. 8-Week Fat Loss Blueprint"
                placeholderTextColor={colors.mutedForeground}
                value={newTitle}
                onChangeText={setNewTitle}
                autoFocus
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Description</Text>
              <TextInput
                style={[
                  styles.textArea,
                  { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card },
                ]}
                placeholder="Describe what clients will achieve..."
                placeholderTextColor={colors.mutedForeground}
                value={newDesc}
                onChangeText={setNewDesc}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.categoryRow}>
                  {CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setNewCategory(cat)}
                      style={[
                        styles.catBtn,
                        {
                          backgroundColor:
                            newCategory === cat ? colors.primary : colors.card,
                          borderColor:
                            newCategory === cat ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.catBtnText,
                          {
                            color: newCategory === cat ? '#FFF' : colors.foreground,
                          },
                        ]}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Price (leave blank for free)</Text>
              <View
                style={[
                  styles.priceWrap,
                  { borderColor: colors.border, backgroundColor: colors.card },
                ]}
              >
                <Text style={[styles.priceDollar, { color: colors.mutedForeground }]}>$</Text>
                <TextInput
                  style={[styles.priceInput, { color: colors.foreground }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  value={newPrice}
                  onChangeText={setNewPrice}
                />
              </View>
            </View>

            <Pressable
              onPress={handleCreate}
              disabled={creating}
              style={({ pressed }) => [
                styles.createBtn,
                { backgroundColor: colors.primary, opacity: pressed || creating ? 0.8 : 1 },
              ]}
            >
              {creating ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.createBtnText}>Create Program</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold', flex: 1 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  newBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  content: { padding: 16, gap: 12 },
  empty: { borderRadius: 16, borderWidth: 1, padding: 32, alignItems: 'center', gap: 8, marginTop: 20 },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  emptyDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  emptyBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#FFF' },
  programCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  programTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  programTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  programMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  programDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4, lineHeight: 17 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  programBottom: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusHint: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  comingSoon: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  comingSoonTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  comingSoonDesc: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 19,
  },
  // Modal
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  modalContent: { padding: 20, gap: 16, paddingBottom: 60 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    minHeight: 90,
    textAlignVertical: 'top',
  },
  categoryRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  catBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  catBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
  },
  priceDollar: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginRight: 4 },
  priceInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', height: 46 },
  createBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  createBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#FFF' },
});
