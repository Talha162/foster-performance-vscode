import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useAuth } from '@/context/AuthContext';

const PRO_FEATURES = [
  { icon: 'dumbbell',           text: 'All premium training programs across every category' },
  { icon: 'food-apple',         text: 'Personalized nutrition plans + macro tracking' },
  { icon: 'chart-bar',          text: 'Advanced FP Score tracking & analytics' },
  { icon: 'run-fast',           text: 'Running, walking & cardio programs' },
  { icon: 'human-handsup',      text: 'Mobility, stretching & full recovery library' },
  { icon: 'play-box',           text: 'Exclusive coach training videos' },
  { icon: 'star-circle-outline', text: 'Priority access to new programs & features' },
];

const COACHING_SESSIONS = [
  { icon: 'dumbbell',       text: 'Live 30-minute personal training session' },
  { icon: 'clock-outline',  text: 'Live 60-minute full coaching session' },
  { icon: 'video',          text: 'Private video call with a certified coach' },
  { icon: 'account-star',   text: 'Nutrition consultation with a certified dietitian' },
  { icon: 'run-fast',       text: 'Speed, mobility & movement assessment' },
  { icon: 'heart-pulse',    text: 'Personalized health & performance plan' },
];

type Plan = 'monthly' | 'annual';

export default function SubscriptionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, upgradeToPremium } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<Plan>('annual');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pro' | 'coaching'>('pro');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleSubscribe = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push(`/subscription-checkout?plan=${selectedPlan}`);
  };

  if (user?.isPremium) {
    return (
      <View style={styles.root}>
      <BackgroundLayer />
        <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Subscription</Text>
        </View>
        <View style={styles.alreadyPremium}>
          <View style={[styles.iconCircle, { backgroundColor: colors.accent }]}>
            <MaterialCommunityIcons name="crown" size={36} color={colors.accentForeground} />
          </View>
          <Text style={[styles.premiumTitle, { color: colors.foreground }]}>You're Pro!</Text>
          <Text style={[styles.premiumDesc, { color: colors.mutedForeground }]}>
            You have full access to all Foster Performance programs, content, and exclusive coach videos.{'\n\n'}
            To book live 1-on-1 sessions, visit any coach profile.
          </Text>
          <Pressable
            onPress={() => router.push('/coaches')}
            style={({ pressed }) => [styles.coachBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <MaterialCommunityIcons name="video" size={18} color={colors.primaryForeground} />
            <Text style={[styles.coachBtnText, { color: colors.primaryForeground }]}>Browse Coaches</Text>
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backToCta, { borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.backToCtaText, { color: colors.mutedForeground }]}>Back to App</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Premium Plans</Text>
      </View>

      {/* Tab Switcher */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable
          onPress={() => setActiveTab('pro')}
          style={[
            styles.tabBtn,
            { backgroundColor: activeTab === 'pro' ? colors.primary : 'transparent' },
          ]}
        >
          <MaterialCommunityIcons
            name="crown"
            size={15}
            color={activeTab === 'pro' ? colors.primaryForeground : colors.mutedForeground}
          />
          <Text style={[styles.tabBtnText, { color: activeTab === 'pro' ? colors.primaryForeground : colors.mutedForeground }]}>
            Foster Pro
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('coaching')}
          style={[
            styles.tabBtn,
            { backgroundColor: activeTab === 'coaching' ? colors.primary : 'transparent' },
          ]}
        >
          <MaterialCommunityIcons
            name="video"
            size={15}
            color={activeTab === 'coaching' ? colors.primaryForeground : colors.mutedForeground}
          />
          <Text style={[styles.tabBtnText, { color: activeTab === 'coaching' ? colors.primaryForeground : colors.mutedForeground }]}>
            Private Coaching
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 130 }]}
      >
        {activeTab === 'pro' ? (
          <>
            {/* Hero */}
            <View style={styles.hero}>
              <View style={[styles.iconCircle, { backgroundColor: colors.accent }]}>
                <MaterialCommunityIcons name="crown" size={36} color={colors.accentForeground} />
              </View>
              <Text style={[styles.heroTitle, { color: colors.foreground }]}>Foster Performance</Text>
              <Text style={[styles.heroSub, { color: colors.primary }]}>PRO</Text>
              <Text style={[styles.heroDesc, { color: colors.mutedForeground }]}>
                Every program, nutrition plan, and exclusive coach video. Train like the pros — at every position.
              </Text>
            </View>

            {/* Plan Selector */}
            <View style={styles.plans}>
              <PlanCard
                plan="annual"
                title="Annual"
                price="$6.67"
                period="/month"
                badge="Save 33%"
                billedAs="Billed $79.99/year"
                selected={selectedPlan === 'annual'}
                onSelect={() => setSelectedPlan('annual')}
              />
              <PlanCard
                plan="monthly"
                title="Monthly"
                price="$9.99"
                period="/month"
                billedAs="Billed monthly, cancel anytime"
                selected={selectedPlan === 'monthly'}
                onSelect={() => setSelectedPlan('monthly')}
              />
            </View>

            {/* Features */}
            <View style={[styles.featuresCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.featuresTitle, { color: colors.foreground }]}>Everything in Foster Pro</Text>
              {PRO_FEATURES.map((feat, i) => (
                <View key={i} style={styles.featureRow}>
                  <View style={[styles.checkCircle, { backgroundColor: colors.primary + '22' }]}>
                    <MaterialCommunityIcons name={feat.icon as any} size={14} color={colors.primary} />
                  </View>
                  <Text style={[styles.featureText, { color: colors.foreground }]}>{feat.text}</Text>
                </View>
              ))}
            </View>

            {/* Note on coaching */}
            <View style={[styles.noteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="information-outline" size={16} color={colors.mutedForeground} />
              <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
                Live 1-on-1 coaching sessions are billed separately per session and are available to both free and Pro members. See the Private Coaching tab for session pricing.
              </Text>
            </View>

            <View style={[styles.guarantee, { borderColor: colors.border }]}>
              <MaterialCommunityIcons name="shield-check" size={18} color={colors.accent} />
              <Text style={[styles.guaranteeText, { color: colors.mutedForeground }]}>
                Cancel anytime · 7-day free trial · No hidden fees
              </Text>
            </View>
          </>
        ) : (
          <>
            {/* Private Coaching Info */}
            <View style={styles.hero}>
              <View style={[styles.iconCircle, { backgroundColor: colors.primary }]}>
                <MaterialCommunityIcons name="video" size={36} color="#FFFFFF" />
              </View>
              <Text style={[styles.heroTitle, { color: colors.foreground }]}>Private Coaching</Text>
              <Text style={[styles.heroSub, { color: colors.primary }]}>LIVE 1-ON-1</Text>
              <Text style={[styles.heroDesc, { color: colors.mutedForeground }]}>
                Book a live video session with a professional football coach. Sessions are billed individually — no subscription required.
              </Text>
            </View>

            {/* Session Types */}
            <View style={[styles.featuresCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.featuresTitle, { color: colors.foreground }]}>What's Included in a Session</Text>
              {COACHING_SESSIONS.map((feat, i) => (
                <View key={i} style={styles.featureRow}>
                  <View style={[styles.checkCircle, { backgroundColor: colors.primary + '22' }]}>
                    <MaterialCommunityIcons name={feat.icon as any} size={14} color={colors.primary} />
                  </View>
                  <Text style={[styles.featureText, { color: colors.foreground }]}>{feat.text}</Text>
                </View>
              ))}
            </View>

            {/* Pricing Guide */}
            <View style={[styles.featuresCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.featuresTitle, { color: colors.foreground }]}>Session Pricing Guide</Text>
              {[
                { type: 'Position Coaches', range: '$90 – $185', note: 'Per session (30 or 60 min)' },
                { type: 'Speed Coach', range: '$85 – $155', note: 'Per session (30 or 60 min)' },
                { type: 'Strength & Conditioning', range: '$75 – $140', note: 'Per session (30 or 60 min)' },
                { type: 'Sports Nutrition', range: '$65 – $120', note: 'Per session (30 or 60 min)' },
                { type: 'Rehabilitation', range: '$70 – $130', note: 'Per session (30 or 60 min)' },
              ].map((row, i) => (
                <View key={i} style={[styles.pricingRow, { borderBottomColor: colors.border, borderBottomWidth: i < 4 ? 1 : 0 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pricingType, { color: colors.foreground }]}>{row.type}</Text>
                    <Text style={[styles.pricingNote, { color: colors.mutedForeground }]}>{row.note}</Text>
                  </View>
                  <Text style={[styles.pricingRange, { color: colors.primary }]}>{row.range}</Text>
                </View>
              ))}
            </View>

            <Pressable
              onPress={() => router.push('/coaches')}
              style={({ pressed }) => [
                styles.browseBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <MaterialCommunityIcons name="account-search" size={20} color={colors.primaryForeground} />
              <Text style={[styles.browseBtnText, { color: colors.primaryForeground }]}>Browse All Coaches</Text>
            </Pressable>

            <View style={[styles.noteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="information-outline" size={16} color={colors.mutedForeground} />
              <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
                Coach credentials listed on each profile are self-reported. Foster Performance does not verify or guarantee any coach's affiliations with professional football leagues or organizations.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* CTA — only shown on Pro tab */}
      {activeTab === 'pro' && (
        <View style={[styles.ctaBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: botPad + 16 }]}>
          <Pressable
            onPress={handleSubscribe}
            disabled={loading}
            style={({ pressed }) => [
              styles.ctaBtn,
              { backgroundColor: colors.primary, opacity: pressed || loading ? 0.8 : 1 },
            ]}
          >
            {loading ? (
              <Text style={[styles.ctaBtnText, { color: colors.primaryForeground }]}>Processing...</Text>
            ) : (
              <>
                <MaterialCommunityIcons name="crown" size={20} color={colors.primaryForeground} />
                <Text style={[styles.ctaBtnText, { color: colors.primaryForeground }]}>
                  Start {selectedPlan === 'annual' ? 'Annual' : 'Monthly'} Plan
                </Text>
              </>
            )}
          </Pressable>
          <Text style={[styles.trial, { color: colors.mutedForeground }]}>
            7-day free trial, then billed as selected
          </Text>
        </View>
      )}
    </View>
  );
}

function PlanCard({
  plan, title, price, period, badge, billedAs, selected, onSelect,
}: {
  plan: Plan; title: string; price: string; period: string; badge?: string;
  billedAs: string; selected: boolean; onSelect: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelect();
      }}
      style={[
        styles.planCard,
        {
          backgroundColor: selected ? colors.primary + '18' : colors.card,
          borderColor: selected ? colors.primary : colors.border,
          borderWidth: selected ? 2 : 1,
        },
      ]}
    >
      {badge && (
        <View style={[styles.planBadge, { backgroundColor: colors.accent }]}>
          <Text style={[styles.planBadgeText, { color: colors.accentForeground }]}>{badge}</Text>
        </View>
      )}
      <View style={[styles.radioOuter, { borderColor: selected ? colors.primary : colors.border }]}>
        {selected && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
      </View>
      <View style={styles.planInfo}>
        <Text style={[styles.planTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.planBilledAs, { color: colors.mutedForeground }]}>{billedAs}</Text>
      </View>
      <View style={styles.planPrice}>
        <Text style={[styles.planPriceValue, { color: selected ? colors.primary : colors.foreground }]}>{price}</Text>
        <Text style={[styles.planPricePeriod, { color: colors.mutedForeground }]}>{period}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: 'Inter_700Bold' },
  tabBar: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 0,
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
  },
  tabBtnText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  content: { padding: 20, gap: 16 },
  hero: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  heroSub: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 4 },
  heroDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },
  plans: { gap: 10 },
  planCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 16, gap: 12, position: 'relative' },
  planBadge: { position: 'absolute', top: -10, right: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  planBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 12, height: 12, borderRadius: 6 },
  planInfo: { flex: 1 },
  planTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  planBilledAs: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  planPrice: { alignItems: 'flex-end' },
  planPriceValue: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  planPricePeriod: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  featuresCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 12 },
  featuresTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkCircle: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  featureText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  noteCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1, padding: 14 },
  noteText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  guarantee: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingTop: 14 },
  guaranteeText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular' },
  pricingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  pricingType: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  pricingNote: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  pricingRange: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 14,
  },
  browseBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  ctaBar: { padding: 20, borderTopWidth: 1, gap: 8 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: 14 },
  ctaBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  trial: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  alreadyPremium: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  premiumTitle: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  premiumDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  coachBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, marginTop: 4 },
  coachBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  backToCta: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  backToCtaText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
