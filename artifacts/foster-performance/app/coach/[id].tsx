import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { ScreenState } from '@/components/ScreenState';
import { useApp, Coach, Review } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useMessaging } from '@/context/MessagingContext';
import { fetchCoach } from '@/lib/coachRepository';

// ─── Helpers for normalizing API coaches ─────────────────────────────────────

const COACH_COLORS = ['#2F80FF', '#9C27B0', '#35C98A', '#FF6B35', '#00BCD4', '#E91E8C'];

function hashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  return COACH_COLORS[Math.abs(h) % COACH_COLORS.length];
}

function tryParse(v: any, fallback: any) {
  if (!v) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return fallback; }
}


// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CoachDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { coaches } = useApp();
  const { user } = useAuth();
  const { openOrCreateConversation } = useMessaging();
  const [selectedLength, setSelectedLength] = useState<30 | 60>(60);
  const [apiCoach, setApiCoach] = useState<Coach | null>(null);
  const [loadingApi, setLoadingApi] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const decodedId = id ? decodeURIComponent(id) : '';
  // Try to find in AppContext first
  const localCoach = coaches.find((c) => c.id === decodedId);

  // Fetch from API if not found locally
  useEffect(() => {
    if (!decodedId || localCoach) return;
    setLoadingApi(true);
    fetchCoach(decodedId)
      .then(setApiCoach)
      .catch(() => {})
      .finally(() => setLoadingApi(false));
  }, [decodedId, localCoach]);

  const coach = localCoach ?? apiCoach;

  if (loadingApi) {
    return <ScreenState title="Loading coach" message="Fetching coach details…" loading />;
  }

  if (!coach) {
    return (
      <ScreenState
        icon="account-off-outline"
        title="Coach not found"
        message="This coach profile is no longer available. Browse the marketplace to find another coach."
        onBack={() => router.back()}
        actionLabel="Browse Coaches"
        onAction={() => router.replace('/(tabs)/coaches')}
      />
    );
  }

  const isPremiumContent = coach.isPremium && !user?.isPremium;
  const price = selectedLength === 30 ? coach.session30Price : coach.session60Price;

  const handleBook = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/book-session',
      params: {
        coachId: coach.id,
        sessionLength: String(selectedLength),
      },
    });
  };

  const handleMessage = async () => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const convId = await openOrCreateConversation({
        memberUserId: String(user.id),
        memberName: user.name,
        coachApiId: coach.id,
        coachName: coach.name,
      });
      router.push({ pathname: '/message-thread', params: { convId } });
    } catch {}
  };

  const avgRating = coach.reviews.length > 0
    ? (coach.reviews.reduce((sum, r) => sum + r.rating, 0) / coach.reviews.length).toFixed(1)
    : coach.rating.toFixed(1);

  return (
    <View style={styles.root}>
      <BackgroundLayer />
      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: coach.color, paddingTop: topPad }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#FFFFFF" />
        </Pressable>
        <View style={styles.heroContent}>
          <View style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
            <Text style={styles.avatarText}>{coach.initials}</Text>
            {coach.isPremium && (
              <View style={[styles.premiumBadge, { backgroundColor: colors.accent }]}>
                <MaterialCommunityIcons name="crown" size={9} color={colors.accentForeground} />
              </View>
            )}
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.coachName}>{coach.name}</Text>
            <Text style={styles.coachTitle}>{coach.title}</Text>
            <View style={styles.heroStats}>
              <HeroStat icon="star" value={avgRating} label="Rating" />
              <HeroStat icon="account-group" value={String(coach.clients)} label="Clients" />
              <HeroStat icon="briefcase-clock" value={`${coach.experience}yr`} label="Exp." />
            </View>
          </View>
        </View>

        {/* Availability chips */}
        <View style={styles.availRow}>
          <MaterialCommunityIcons name="calendar-check" size={13} color="rgba(255,255,255,0.7)" />
          <Text style={styles.availLabel}>Available:</Text>
          {coach.availability.map((day) => (
            <View key={day} style={styles.availChip}>
              <Text style={styles.availChipText}>{day}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 140 }]}
      >
        {/* About */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>About</Text>
        <Text style={[styles.bio, { color: colors.mutedForeground }]}>{coach.bio}</Text>

        {/* Credentials */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Credentials</Text>
        <View style={styles.credentialList}>
          {coach.credentials.map((cred, i) => (
            <View key={i} style={[styles.credRow, { borderBottomColor: colors.border }]}>
              <View style={[styles.credCheck, { backgroundColor: coach.color + '22' }]}>
                <MaterialCommunityIcons name="check-decagram" size={14} color={coach.color} />
              </View>
              <Text style={[styles.credText, { color: colors.foreground }]}>{cred}</Text>
            </View>
          ))}
        </View>

        {/* Specialties */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Specialties</Text>
        <View style={styles.tags}>
          {coach.specialties.map((s) => (
            <View key={s} style={[styles.tag, { backgroundColor: coach.color + '18', borderColor: coach.color + '44' }]}>
              <Text style={[styles.tagText, { color: coach.color }]}>{s}</Text>
            </View>
          ))}
        </View>

        {/* Session Pricing */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Book a Session</Text>
        <View style={[styles.pricingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.pricingCardSub, { color: colors.mutedForeground }]}>
            Live 1-on-1 video session · Billed per session · Not included in Pro membership
          </Text>
          <View style={styles.pricingOptions}>
            {([30, 60] as const).map((len) => {
              const p = len === 30 ? coach.session30Price : coach.session60Price;
              const sel = selectedLength === len;
              return (
                <Pressable
                  key={len}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedLength(len);
                  }}
                  style={[
                    styles.pricingOption,
                    {
                      backgroundColor: sel ? coach.color + '18' : colors.background,
                      borderColor: sel ? coach.color : colors.border,
                      borderWidth: sel ? 2 : 1,
                    },
                  ]}
                >
                  <View style={[styles.radioOuter, { borderColor: sel ? coach.color : colors.border }]}>
                    {sel && <View style={[styles.radioInner, { backgroundColor: coach.color }]} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sessionLen, { color: colors.foreground }]}>{len}-Minute Session</Text>
                    <Text style={[styles.sessionDesc, { color: colors.mutedForeground }]}>
                      {len === 30 ? 'Focused technique review or Q&A' : 'Full position development session'}
                    </Text>
                  </View>
                  <Text style={[styles.sessionPrice, { color: sel ? coach.color : colors.foreground }]}>${p}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Reviews */}
        {coach.reviews.length > 0 && (
          <>
            <View style={styles.reviewsHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>
                Reviews
              </Text>
              <View style={styles.ratingRow}>
                <MaterialCommunityIcons name="star" size={14} color={colors.accent} />
                <Text style={[styles.ratingNum, { color: colors.foreground }]}>{avgRating}</Text>
                <Text style={[styles.ratingCount, { color: colors.mutedForeground }]}>
                  ({coach.reviews.length})
                </Text>
              </View>
            </View>
            {coach.reviews.map((review) => (
              <ReviewCard key={review.id} review={review} accentColor={coach.color} />
            ))}
          </>
        )}

        {/* Premium content locked info */}
        {isPremiumContent && (
          <View style={[styles.proNote, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '44' }]}>
            <MaterialCommunityIcons name="crown" size={18} color={colors.accent} />
            <Text style={[styles.proNoteText, { color: colors.mutedForeground }]}>
              Upgrade to Foster Performance Pro to access {coach.name}'s exclusive training videos and content library. Live sessions are available to all users.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* CTA */}
      <View style={[styles.ctaBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: botPad + 16 }]}>
        <View style={styles.ctaTop}>
          <View>
            <Text style={[styles.ctaPrice, { color: colors.foreground }]}>${price}</Text>
            <Text style={[styles.ctaDuration, { color: colors.mutedForeground }]}>{selectedLength}-min session</Text>
          </View>
          <Pressable
            onPress={handleBook}
            style={({ pressed }) => [
              styles.ctaBtn,
              { backgroundColor: coach.color, opacity: pressed ? 0.85 : 1, flex: 1 },
            ]}
          >
            <MaterialCommunityIcons name="video" size={20} color="#FFFFFF" />
            <Text style={styles.ctaBtnText}>Book Session</Text>
          </Pressable>
        </View>
        {/* Message Coach — members only, API-backed coaches only */}
        {user?.accountType === 'member' && !localCoach && (
          <Pressable
            onPress={handleMessage}
            style={({ pressed }) => [
              styles.proBtn,
              { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <MaterialCommunityIcons name="message-outline" size={15} color={colors.primary} />
            <Text style={[styles.proBtnText, { color: colors.primary }]}>Message Coach</Text>
          </Pressable>
        )}
        {isPremiumContent && (
          <Pressable
            onPress={() => router.push('/subscription')}
            style={({ pressed }) => [styles.proBtn, { borderColor: colors.accent, opacity: pressed ? 0.8 : 1 }]}
          >
            <MaterialCommunityIcons name="crown" size={15} color={colors.accent} />
            <Text style={[styles.proBtnText, { color: colors.accent }]}>Unlock Pro Content</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function HeroStat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <View style={styles.heroStat}>
      <MaterialCommunityIcons name={icon as any} size={12} color="rgba(255,255,255,0.7)" />
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function ReviewCard({ review, accentColor }: { review: Review; accentColor: string }) {
  const colors = useColors();
  return (
    <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.reviewTop}>
        <View style={[styles.reviewAvatar, { backgroundColor: accentColor + '22' }]}>
          <Text style={[styles.reviewAvatarText, { color: accentColor }]}>
            {review.author.charAt(0)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.reviewAuthor, { color: colors.foreground }]}>{review.author}</Text>
          <Text style={[styles.reviewDate, { color: colors.mutedForeground }]}>{review.date}</Text>
        </View>
        <View style={styles.reviewStars}>
          {Array.from({ length: 5 }).map((_, i) => (
            <MaterialCommunityIcons
              key={i}
              name={i < review.rating ? 'star' : 'star-outline'}
              size={12}
              color={i < review.rating ? '#D6A84B' : colors.border}
            />
          ))}
        </View>
      </View>
      <Text style={[styles.reviewText, { color: colors.mutedForeground }]}>{review.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { paddingBottom: 16 },
  backBtn: { paddingHorizontal: 20, paddingVertical: 12 },
  heroContent: { flexDirection: 'row', gap: 14, paddingHorizontal: 20, alignItems: 'center' },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 28, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  premiumBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: { flex: 1, gap: 3 },
  coachName: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  coachTitle: { fontSize: 13, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.8)' },
  heroStats: { flexDirection: 'row', gap: 6, marginTop: 4 },
  heroStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.22)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heroStatValue: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  heroStatLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.7)' },
  availRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 12,
    flexWrap: 'wrap',
  },
  availLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.7)' },
  availChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  availChipText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF' },
  content: { padding: 20, gap: 10 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginTop: 10, marginBottom: 6 },
  bio: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  credentialList: { gap: 0 },
  credRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  credCheck: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  credText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  tagText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  pricingCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  pricingCardSub: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  pricingOptions: { gap: 10 },
  pricingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    padding: 14,
  },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 12, height: 12, borderRadius: 6 },
  sessionLen: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  sessionDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  sessionPrice: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  reviewsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingNum: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  ratingCount: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  reviewCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  reviewTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  reviewAvatarText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  reviewAuthor: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  reviewDate: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  proNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  proNoteText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  ctaBar: { padding: 16, borderTopWidth: 1, gap: 10 },
  ctaTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ctaPrice: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  ctaDuration: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 14,
  },
  ctaBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  proBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
  },
  proBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
