import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { ScreenState } from '@/components/ScreenState';
import { useAuth } from '@/context/AuthContext';

export default function ProfileEditScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);

  if (!user) {
    return (
      <ScreenState
        icon="lock-outline"
        title="Sign in required"
        message="Sign in to update your profile."
        onBack={() => router.back()}
      />
    );
  }

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      Alert.alert('Name required', 'Enter at least two characters for your name.');
      return;
    }
    setSaving(true);
    try {
      await updateUser({ name: trimmedName });
      Alert.alert('Profile updated', 'Your name has been saved.', [{ text: 'Done', onPress: () => router.back() }]);
    } catch {
      Alert.alert('Could not save', 'Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <BackgroundLayer />
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Edit Profile</Text>
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        >
          <View style={[styles.avatar, { backgroundColor: colors.primary + '22' }]}>
            <MaterialCommunityIcons name="account-edit-outline" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.introTitle, { color: colors.foreground }]}>Your profile</Text>
          <Text style={[styles.intro, { color: colors.mutedForeground }]}>
            Keep your display name up to date. Your email is managed separately in account security.
          </Text>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>Display name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="words"
              returnKeyType="done"
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            />
          </View>
          <View style={[styles.readOnly, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="mail" size={16} color={colors.mutedForeground} />
            <View style={styles.readOnlyInfo}>
              <Text style={[styles.readOnlyLabel, { color: colors.mutedForeground }]}>Email</Text>
              <Text style={[styles.readOnlyValue, { color: colors.foreground }]}>{user.email}</Text>
            </View>
            <Text style={[styles.readOnlyHint, { color: colors.mutedForeground }]}>Security</Text>
          </View>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.saveBtn,
              { backgroundColor: colors.primary, opacity: saving || pressed ? 0.75 : 1 },
            ]}
          >
            {saving ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.saveText, { color: colors.primaryForeground }]}>Save Changes</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  content: { padding: 24, alignItems: 'stretch', gap: 16 },
  avatar: { width: 70, height: 70, borderRadius: 22, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  introTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  intro: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20, textAlign: 'center', marginBottom: 12 },
  field: { gap: 8 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  input: { minHeight: 52, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 16, fontFamily: 'Inter_400Regular' },
  readOnly: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  readOnlyInfo: { flex: 1, gap: 2 },
  readOnlyLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  readOnlyValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  readOnlyHint: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  saveBtn: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  saveText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});