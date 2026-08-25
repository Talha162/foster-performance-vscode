import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';

export default function CoachProfile() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, updateUser, logout } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 84 : insets.bottom + 84;

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    try {
      await updateUser({ name });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/welcome');
  };

  const initials = (user?.name ?? 'C').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <View style={styles.root}>
      <BackgroundLayer />
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Profile</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>Manage your coach profile</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad }]} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: colors.accent + '30', borderColor: colors.accent }]}>
            <Text style={[styles.avatarText, { color: colors.accent }]}>{initials}</Text>
          </View>
          <View style={[styles.coachBadge, { backgroundColor: colors.accent, }]}>
            <MaterialCommunityIcons name="whistle" size={10} color="#FFF" />
            <Text style={styles.coachBadgeText}>COACH</Text>
          </View>
        </View>

        {/* Edit form */}
        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>Account Details</Text>
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Display Name</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Feather name="user" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Email</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="mail" size={16} color={colors.mutedForeground} />
              <Text style={[styles.readonlyText, { color: colors.mutedForeground }]}>{user?.email}</Text>
            </View>
          </View>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [styles.saveBtn, { backgroundColor: saved ? colors.success : colors.primary, opacity: pressed || saving ? 0.8 : 1 }]}
          >
            {saved ? (
              <><Feather name="check" size={16} color="#FFF" /><Text style={styles.saveBtnText}>Saved!</Text></>
            ) : (
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
            )}
          </Pressable>
        </View>

        {/* Coach application */}
        <Pressable
          onPress={() => router.push('/coach-profile-editor' as any)}
          style={({ pressed }) => [styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <MaterialCommunityIcons name="account-edit-outline" size={20} color={colors.accent} />
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>Edit Public Coach Profile</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/credential-upload')}
          style={({ pressed }) => [styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <MaterialCommunityIcons name="certificate-outline" size={20} color={colors.primary} />
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>Credential Management</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/coach-application-status')}
          style={({ pressed }) => [styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <MaterialCommunityIcons name="file-document-outline" size={20} color={colors.primary} />
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>View Application Status</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </Pressable>

        {/* Payout Settings */}
        <Pressable
          onPress={() => router.push('/payout-settings')}
          style={({ pressed }) => [styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <MaterialCommunityIcons name="bank-outline" size={20} color={colors.success} />
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>Payout Settings</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </Pressable>

        {/* Coach Subscription */}
        <Pressable
          onPress={() => router.push('/coach-billing-settings')}
          style={({ pressed }) => [styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <MaterialCommunityIcons name="crown-outline" size={20} color={colors.accent} />
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>Billing & Subscription</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </Pressable>

        {/* Logout */}
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [styles.logoutBtn, { borderColor: '#FF5050', opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="log-out" size={16} color="#FF5050" />
          <Text style={[styles.logoutText, { color: '#FF5050' }]}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  content: { padding: 20, gap: 16, alignItems: 'center' },
  avatarSection: { alignItems: 'center', gap: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  avatarText: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  coachBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  coachBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#FFF', letterSpacing: 0.5 },
  formCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 14, width: '100%' },
  formTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 48 },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  readonlyText: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  saveBtn: { height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#FFF' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 16, width: '100%' },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 12, borderWidth: 1, width: '100%', marginTop: 4 },
  logoutText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
