import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';

const SECTIONS = [
  {
    title: 'What we collect',
    body: 'Foster Performance uses the information you provide, such as your name, email, training goals, workout history, and nutrition entries, to personalize the app and provide the services you request.',
  },
  {
    title: 'How we use it',
    body: 'Your information helps us show relevant programs, track your progress, connect you with coaches, process bookings, and keep your account secure. We do not sell personal information.',
  },
  {
    title: 'Your choices',
    body: 'You can update your profile, manage notification preferences, change your password, sign out of other devices, or request account data and deletion through the account controls.',
  },
  {
    title: 'Payments and coaches',
    body: 'Payment details are sent to our payment provider for processing. Coaches only receive the information needed to deliver a session or respond to a message.',
  },
];

export default function PrivacyPolicyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <BackgroundLayer />
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Privacy Policy</Text>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
        <View style={[styles.notice, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '44' }]}>
          <Feather name="shield" size={18} color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.foreground }]}>
            Your data belongs to you. Here is a plain-language overview of how it is used.
          </Text>
        </View>
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{section.title}</Text>
            <Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>{section.body}</Text>
          </View>
        ))}
        <Text style={[styles.updated, { color: colors.mutedForeground }]}>
          Last updated August 2026 · For questions about your data, contact Foster Performance support.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  content: { padding: 20, gap: 22 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  noticeText: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold', lineHeight: 20 },
  section: { gap: 7 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  sectionBody: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 21 },
  updated: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
});