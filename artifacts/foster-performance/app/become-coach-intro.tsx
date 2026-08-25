/**
 * Become a Coach intro screen — shown to Member accounts who tap the
 * "Become a Coach" CTA.  Explains the program, then calls
 * POST /auth/become-coach to transition their role to coach_applicant
 * and routes them into the coach application flow.
 */
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { ScreenState } from '@/components/ScreenState';
import { useAuth } from '@/context/AuthContext';

const BENEFITS = [
  { icon: 'currency-usd',          title: 'Earn Real Income',       desc: 'Set your own rates and get paid for every session booked.' },
  { icon: 'calendar-clock',        title: 'Work Your Schedule',      desc: 'Choose your available days and hours — you control your calendar.' },
  { icon: 'account-multiple',      title: 'Build a Client Base',     desc: 'Get discovered by members actively looking for your specialty.' },
  { icon: 'video',                  title: 'Live Video Sessions',    desc: 'Coach anyone, anywhere via HD video calls inside the app.' },
  { icon: 'clipboard-list-outline', title: 'Create Programs',       desc: 'Build and sell custom training programs to unlimited members.' },
  { icon: 'chart-line',            title: 'Track Your Growth',      desc: 'Dashboard shows earnings, bookings, and client progress over time.' },
];

const REQUIREMENTS = [
  'Complete a multi-step application with your credentials',
  'Submit certifications and professional background',
  'Wait 2–5 business days for team review',
  'Once approved, your profile goes live on the marketplace',
];

export default function BecomeCoachIntroScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, becomeCoach } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Guard against double-tap: track an in-flight request
  const inFlight = useRef(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  // If user is already coach_applicant or coach, just go to the right screen
  if (user?.accountType === 'coach_applicant') {
    router.replace('/coach-application-status');
    return null;
  }
  if (user?.accountType === 'coach') {
    router.replace('/(coach-tabs)');
    return null;
  }
  if (!user) {
    return (
      <ScreenState
        icon="lock-outline"
        title="Sign in to apply"
        message="Create an account or sign in before starting a Foster Performance coach application."
        actionLabel="Go to Welcome"
        onAction={() => router.replace('/(auth)/welcome')}
      />
    );
  }

  const handleStartApplication = async () => {
    if (inFlight.current || loading) return;
    inFlight.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError('');
    try {
      // becomeCoach atomically calls POST /auth/become-coach, stores the new JWT
      // in AsyncStorage, and updates in-memory token + user state in AuthContext.
      await becomeCoach();
      router.replace('/coach-application');
    } catch (e: any) {
      // Ignore the "already coach_applicant" error if it actually succeeded
      if (e.message?.includes('already have a pending')) {
        router.replace('/coach-application');
        return;
      }
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  };

  return (
    <View style={styles.root}>
      <BackgroundLayer />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Coach Program</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: botPad + 120 }]}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '44' }]}>
          <View style={[styles.heroIcon, { backgroundColor: colors.accent + '28' }]}>
            <MaterialCommunityIcons name="whistle" size={36} color={colors.accent} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>
            Become a Foster Performance Coach
          </Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            Join our network of certified fitness professionals. Earn money doing what you love — on your schedule.
          </Text>
          <View style={[styles.heroPill, { backgroundColor: colors.accent }]}>
            <MaterialCommunityIcons name="check-circle" size={13} color="#FFF" />
            <Text style={styles.heroPillText}>Applications Open</Text>
          </View>
        </View>

        {/* Benefits */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Why Coach on Foster?</Text>
        <View style={styles.benefitsGrid}>
          {BENEFITS.map((b) => (
            <View key={b.title} style={[styles.benefitCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.benefitIcon, { backgroundColor: colors.primary + '18' }]}>
                <MaterialCommunityIcons name={b.icon as any} size={22} color={colors.primary} />
              </View>
              <Text style={[styles.benefitTitle, { color: colors.foreground }]}>{b.title}</Text>
              <Text style={[styles.benefitDesc, { color: colors.mutedForeground }]}>{b.desc}</Text>
            </View>
          ))}
        </View>

        {/* Commission note */}
        <View style={[styles.commNote, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="information-outline" size={16} color={colors.primary} />
          <Text style={[styles.commNoteText, { color: colors.mutedForeground }]}>
            Foster Performance charges a <Text style={[styles.commBold, { color: colors.foreground }]}>10% platform commission</Text> on each session booking. You keep 90% of every session fee you set.
          </Text>
        </View>

        {/* Requirements */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>How It Works</Text>
        <View style={[styles.requirementsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {REQUIREMENTS.map((r, i) => (
            <View key={i} style={[styles.reqRow, i < REQUIREMENTS.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
              <View style={[styles.reqNum, { backgroundColor: colors.primary + '22' }]}>
                <Text style={[styles.reqNumText, { color: colors.primary }]}>{i + 1}</Text>
              </View>
              <Text style={[styles.reqText, { color: colors.foreground }]}>{r}</Text>
            </View>
          ))}
        </View>

        {error ? (
          <View style={[styles.errorBox, { borderColor: '#FF5050', backgroundColor: '#FF505012' }]}>
            <Feather name="alert-circle" size={14} color="#FF5050" />
            <Text style={[styles.errorText, { color: '#FF5050' }]}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* CTA Footer */}
      <View style={[styles.footer, { paddingBottom: botPad + 16, backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <Text style={[styles.footerNote, { color: colors.mutedForeground }]}>
          By starting an application you agree to the Coach Terms & Platform Policies.
        </Text>
        <Pressable
          onPress={handleStartApplication}
          disabled={loading}
          style={({ pressed }) => [styles.ctaBtn, { backgroundColor: colors.accent, opacity: pressed || loading ? 0.8 : 1 }]}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <MaterialCommunityIcons name="whistle" size={18} color="#FFF" />
              <Text style={styles.ctaBtnText}>Start My Application</Text>
              <Feather name="arrow-right" size={18} color="#FFF" />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  content: { padding: 20, gap: 20 },
  hero: { borderRadius: 20, borderWidth: 1, padding: 22, alignItems: 'center', gap: 10 },
  heroIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  heroSub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  heroPillText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#FFF' },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  benefitsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  benefitCard: { width: '47%', flexGrow: 1, borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  benefitIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  benefitTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', marginTop: 2 },
  benefitDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  commNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  commNoteText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  commBold: { fontFamily: 'Inter_700Bold' },
  requirementsCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  reqNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  reqNumText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  reqText: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  errorText: { fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, gap: 10 },
  footerNote: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  ctaBtn: { height: 54, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  ctaBtnText: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#FFF' },
});
