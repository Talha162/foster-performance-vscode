/**
 * Coach Application — multi-step form (5 steps).
 * Saves draft progress and submits to /coach-applications.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable, ScrollView,
  StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppForm {
  fullName: string;
  phone: string;
  professionalTitle: string;
  profilePhotoUrl: string;
  biography: string;
  experienceYears: string;
  certifications: string;
  specialties: string[];
  services: string[];
  session30Price: string;
  session60Price: string;
  session90Price: string;
  monday: boolean; tuesday: boolean; wednesday: boolean;
  thursday: boolean; friday: boolean; saturday: boolean; sunday: boolean;
  virtualSessions: boolean;
  inPersonSessions: boolean;
  serviceLocation: string;
  website: string;
  instagram: string;
  linkedin: string;
  agreedToTerms: boolean;
}

const INITIAL: AppForm = {
  fullName: '', phone: '', professionalTitle: '', profilePhotoUrl: '',
  biography: '', experienceYears: '', certifications: '',
  specialties: [], services: [],
  session30Price: '', session60Price: '', session90Price: '',
  monday: false, tuesday: false, wednesday: false,
  thursday: false, friday: false, saturday: false, sunday: false,
  virtualSessions: true, inPersonSessions: false,
  serviceLocation: '', website: '', instagram: '', linkedin: '',
  agreedToTerms: false,
};

const SPECIALTY_OPTIONS = [
  'Weight Loss', 'Muscle Building', 'Strength Training', 'Cardio & Endurance',
  'HIIT', 'CrossFit', 'Running', 'Cycling', 'Yoga & Flexibility', 'Mobility',
  'Sports Performance', 'Rehabilitation', 'Senior Fitness', 'Youth Fitness',
  'Nutrition Coaching', 'Mental Wellness', 'Powerlifting', 'Functional Fitness',
];

const SERVICE_OPTIONS = [
  '1-on-1 Personal Training', 'Group Fitness Classes', 'Online Coaching',
  'Nutrition Planning', 'Meal Prep Guidance', 'Workout Programming',
  'Accountability Coaching', 'Recovery & Rehab', 'Sports Performance',
  'Corporate Wellness', 'Weight Management', 'Body Transformation',
];

// ─── Field helpers ────────────────────────────────────────────────────────────

function Field({ label, placeholder, value, onChange, multiline = false, keyboard = 'default' }: any) {
  const colors = useColors();
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          multiline && styles.inputMulti,
          { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        keyboardType={keyboard}
        textAlignVertical={multiline ? 'top' : 'auto'}
      />
    </View>
  );
}

function ChipSelect({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  const colors = useColors();
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={styles.chips}>
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <Pressable
              key={opt}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggle(opt); }}
              style={[styles.chip, { backgroundColor: active ? colors.primary + '22' : colors.card, borderColor: active ? colors.primary : colors.border }]}
            >
              <Text style={[styles.chipText, { color: active ? colors.primary : colors.mutedForeground }]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DayToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const colors = useColors();
  return (
    <View style={[styles.dayRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.dayLabel, { color: colors.foreground }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary + '88' }}
        thumbColor={value ? colors.primary : '#AAAAAA'}
      />
    </View>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function StepProgress({ step, total }: { step: number; total: number }) {
  const colors = useColors();
  return (
    <View style={styles.progressRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.progressDot,
            {
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: i < step ? colors.primary : i === step ? colors.primary + '88' : colors.border,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;
const STEP_TITLES = [
  'Basic Info',
  'About You',
  'Services & Pricing',
  'Availability',
  'Review & Submit',
];

export default function CoachApplicationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<AppForm>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // When entering Step 1, pre-populate certifications saved in Supabase.
  useEffect(() => {
    if (step !== 1 || !user) return;
    supabase.from('coach_applications').select('certifications').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      try {
        const entries = Array.isArray(data?.certifications) ? data.certifications as Array<string | { name: string }> : [];
        if (entries.length === 0) return;
        setForm((f) => {
          if (f.certifications.trim()) return f;
          return { ...f, certifications: entries.map((entry) => typeof entry === 'string' ? entry : entry.name).join(', ') };
        });
      } catch {}
    });
  }, [step, user]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const set = (key: keyof AppForm, val: any) => setForm((f) => ({ ...f, [key]: val }));
  const toggleList = (key: 'specialties' | 'services', val: string) =>
    setForm((f) => ({
      ...f,
      [key]: (f[key] as string[]).includes(val)
        ? (f[key] as string[]).filter((v) => v !== val)
        : [...(f[key] as string[]), val],
    }));

  const canAdvance = () => {
    if (step === 0) return form.professionalTitle.trim().length > 0;
    if (step === 1) return form.biography.trim().length > 10;
    if (step === 2) return form.services.length > 0;
    if (step === 3) return form.virtualSessions || form.inPersonSessions;
    if (step === 4) return form.agreedToTerms;
    return true;
  };

  const handleNext = () => {
    if (!canAdvance()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    if (!form.agreedToTerms) { setError('You must agree to the Coach terms'); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError('');
    try {
      if (!user) throw new Error('Authentication required');
      const profileResult = await supabase.from('profiles').update({
        full_name: form.fullName || user.name,
        phone: form.phone,
        avatar_url: form.profilePhotoUrl || null,
      }).eq('id', user.id);
      if (profileResult.error) throw new Error(profileResult.error.message);
      const applicationResult = await supabase.from('coach_applications').upsert({
          user_id: user.id,
          professional_title: form.professionalTitle,
          profile_photo_url: form.profilePhotoUrl,
          biography: form.biography,
          experience_years: form.experienceYears ? parseInt(form.experienceYears) : null,
          certifications: form.certifications.split(/,\s*/).filter(Boolean),
          specialties: form.specialties,
          services: form.services,
          session_lengths: [
            ...(form.session30Price ? [30] : []),
            ...(form.session60Price ? [60] : []),
            ...(form.session90Price ? [90] : []),
          ],
          prices: {
            session30: form.session30Price ? parseFloat(form.session30Price) : null,
            session60: form.session60Price ? parseFloat(form.session60Price) : null,
            session90: form.session90Price ? parseFloat(form.session90Price) : null,
          },
          weekly_availability: {
            monday: form.monday, tuesday: form.tuesday, wednesday: form.wednesday,
            thursday: form.thursday, friday: form.friday, saturday: form.saturday, sunday: form.sunday,
          },
          virtual_sessions: form.virtualSessions,
          in_person_sessions: form.inPersonSessions,
          service_location: form.serviceLocation,
          professional_links: { website: form.website, instagram: form.instagram, linkedin: form.linkedin },
          agreed_to_terms: true,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (applicationResult.error) throw new Error(applicationResult.error.message);
      router.replace('/coach-application-status');
    } catch (e: any) {
      setError(e.message || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <BackgroundLayer />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => { if (step > 0) setStep((s) => s - 1); else router.back(); }} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Coach Application</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Step {step + 1} of {TOTAL_STEPS} — {STEP_TITLES[step]}
          </Text>
        </View>
      </View>

      <StepProgress step={step} total={TOTAL_STEPS} />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 120 }]}
      >
        {/* ── Step 0: Basic Info ───────────────────────────────────────────── */}
        {step === 0 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>Professional Information</Text>
            <Text style={[styles.stepDesc, { color: colors.mutedForeground }]}>
              Tell us about your professional identity so members know how to find you.
            </Text>
            <Field label="Professional Title *" placeholder="e.g. Certified Personal Trainer, Strength Coach" value={form.professionalTitle} onChange={(v: string) => set('professionalTitle', v)} />
            <Field label="Full Name" placeholder={user?.name ?? 'Your name'} value={form.fullName} onChange={(v: string) => set('fullName', v)} />
            <Field label="Phone Number" placeholder="+1 (555) 000-0000" value={form.phone} onChange={(v: string) => set('phone', v)} keyboard="phone-pad" />
            <Field label="Profile Photo URL (optional)" placeholder="https://example.com/photo.jpg" value={form.profilePhotoUrl} onChange={(v: string) => set('profilePhotoUrl', v)} />
          </View>
        )}

        {/* ── Step 1: About You ────────────────────────────────────────────── */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>About You</Text>
            <Text style={[styles.stepDesc, { color: colors.mutedForeground }]}>
              Help members understand your background and expertise.
            </Text>
            <Field label="Biography *" placeholder="Share your coaching philosophy, background, and what makes your approach unique (minimum 10 characters)..." value={form.biography} onChange={(v: string) => set('biography', v)} multiline />
            <Field label="Years of Experience" placeholder="e.g. 5" value={form.experienceYears} onChange={(v: string) => set('experienceYears', v)} keyboard="number-pad" />
            <Field label="Certifications & Credentials" placeholder="e.g. NASM-CPT, ACE, CSCS, RD..." value={form.certifications} onChange={(v: string) => set('certifications', v)} multiline />
            <Pressable
              onPress={() => router.push('/credential-upload')}
              style={({ pressed }) => [
                styles.credBtn,
                { borderColor: colors.primary + '66', backgroundColor: colors.primary + '10', opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <MaterialCommunityIcons name="certificate-outline" size={16} color={colors.primary} />
              <Text style={[styles.credBtnText, { color: colors.primary }]}>Manage Credential Documents</Text>
              <Feather name="external-link" size={13} color={colors.primary} />
            </Pressable>
            <ChipSelect label="Specialties (select all that apply)" options={SPECIALTY_OPTIONS} selected={form.specialties} onToggle={(v) => toggleList('specialties', v)} />
          </View>
        )}

        {/* ── Step 2: Services & Pricing ───────────────────────────────────── */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>Services & Pricing</Text>
            <Text style={[styles.stepDesc, { color: colors.mutedForeground }]}>
              Choose what you offer and set your session rates. Foster Performance charges a 10% platform fee.
            </Text>
            <ChipSelect label="Services Offered *" options={SERVICE_OPTIONS} selected={form.services} onToggle={(v) => toggleList('services', v)} />

            <View style={[styles.pricingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.pricingTitle, { color: colors.foreground }]}>Session Pricing</Text>
              <Text style={[styles.pricingNote, { color: colors.mutedForeground }]}>Leave blank to disable that session length</Text>
              <View style={styles.priceRow}>
                <View style={styles.priceField}>
                  <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>30-min</Text>
                  <View style={[styles.priceInput, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.priceDollar, { color: colors.mutedForeground }]}>$</Text>
                    <TextInput style={[styles.priceValue, { color: colors.foreground }]} placeholder="—" placeholderTextColor={colors.mutedForeground} value={form.session30Price} onChangeText={(v) => set('session30Price', v)} keyboardType="decimal-pad" />
                  </View>
                </View>
                <View style={styles.priceField}>
                  <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>60-min</Text>
                  <View style={[styles.priceInput, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.priceDollar, { color: colors.mutedForeground }]}>$</Text>
                    <TextInput style={[styles.priceValue, { color: colors.foreground }]} placeholder="—" placeholderTextColor={colors.mutedForeground} value={form.session60Price} onChangeText={(v) => set('session60Price', v)} keyboardType="decimal-pad" />
                  </View>
                </View>
                <View style={styles.priceField}>
                  <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>90-min</Text>
                  <View style={[styles.priceInput, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.priceDollar, { color: colors.mutedForeground }]}>$</Text>
                    <TextInput style={[styles.priceValue, { color: colors.foreground }]} placeholder="—" placeholderTextColor={colors.mutedForeground} value={form.session90Price} onChangeText={(v) => set('session90Price', v)} keyboardType="decimal-pad" />
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── Step 3: Availability & Location ─────────────────────────────── */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>Availability & Location</Text>
            <Text style={[styles.stepDesc, { color: colors.mutedForeground }]}>
              Set your weekly availability and session delivery options.
            </Text>

            <View style={[styles.sectionBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionBoxTitle, { color: colors.foreground }]}>Weekly Availability</Text>
              {(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const).map((day) => (
                <DayToggle key={day} label={day.charAt(0).toUpperCase() + day.slice(1)} value={form[day]} onChange={(v) => set(day, v)} />
              ))}
            </View>

            <View style={[styles.sectionBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionBoxTitle, { color: colors.foreground }]}>Session Delivery *</Text>
              <View style={styles.toggleRow}>
                <MaterialCommunityIcons name="video-outline" size={20} color={form.virtualSessions ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Virtual / Online Sessions</Text>
                <Switch value={form.virtualSessions} onValueChange={(v) => set('virtualSessions', v)} trackColor={{ false: colors.border, true: colors.primary + '88' }} thumbColor={form.virtualSessions ? colors.primary : '#AAA'} />
              </View>
              <View style={styles.toggleRow}>
                <MaterialCommunityIcons name="map-marker-outline" size={20} color={form.inPersonSessions ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.toggleLabel, { color: colors.foreground }]}>In-Person Sessions</Text>
                <Switch value={form.inPersonSessions} onValueChange={(v) => set('inPersonSessions', v)} trackColor={{ false: colors.border, true: colors.primary + '88' }} thumbColor={form.inPersonSessions ? colors.primary : '#AAA'} />
              </View>
            </View>

            {form.inPersonSessions && (
              <Field label="Service Location" placeholder="City, gym name, or address" value={form.serviceLocation} onChange={(v: string) => set('serviceLocation', v)} />
            )}

            <View style={[styles.sectionBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionBoxTitle, { color: colors.foreground }]}>Professional Links (optional)</Text>
              <Field label="Website" placeholder="https://yourwebsite.com" value={form.website} onChange={(v: string) => set('website', v)} />
              <Field label="Instagram" placeholder="@yourhandle" value={form.instagram} onChange={(v: string) => set('instagram', v)} />
              <Field label="LinkedIn" placeholder="https://linkedin.com/in/yourprofile" value={form.linkedin} onChange={(v: string) => set('linkedin', v)} />
            </View>
          </View>
        )}

        {/* ── Step 4: Review & Submit ──────────────────────────────────────── */}
        {step === 4 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>Review & Submit</Text>
            <Text style={[styles.stepDesc, { color: colors.mutedForeground }]}>
              Review your application details before submitting.
            </Text>

            {[
              { label: 'Title', value: form.professionalTitle },
              { label: 'Experience', value: form.experienceYears ? `${form.experienceYears} years` : null },
              { label: 'Specialties', value: form.specialties.slice(0, 3).join(', ') || null },
              { label: 'Services', value: form.services.slice(0, 2).join(', ') || null },
              { label: 'Session types', value: [form.virtualSessions && 'Virtual', form.inPersonSessions && 'In-Person'].filter(Boolean).join(' & ') || null },
            ].map((row) => row.value ? (
              <View key={row.label} style={[styles.reviewRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                <Text style={[styles.reviewValue, { color: colors.foreground }]}>{row.value}</Text>
              </View>
            ) : null)}

            <View style={[styles.termsBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.termsTitle, { color: colors.foreground }]}>Coach Terms & Policies</Text>
              <Text style={[styles.termsText, { color: colors.mutedForeground }]}>
                By submitting, you agree to Foster Performance's Coach Terms of Service. This includes:{'\n\n'}
                • Maintaining professional conduct with all clients{'\n'}
                • Honoring your booked sessions and availability{'\n'}
                • A 10% platform commission on all paid sessions{'\n'}
                • Background verification as required by Foster Performance{'\n'}
                • Compliance with all applicable laws and professional standards
              </Text>
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); set('agreedToTerms', !form.agreedToTerms); }}
                style={styles.checkRow}
              >
                <View style={[styles.checkbox, { borderColor: form.agreedToTerms ? colors.primary : colors.border, backgroundColor: form.agreedToTerms ? colors.primary : 'transparent' }]}>
                  {form.agreedToTerms && <Feather name="check" size={12} color="#FFF" />}
                </View>
                <Text style={[styles.checkLabel, { color: colors.foreground }]}>
                  I agree to the Coach Terms & Policies
                </Text>
              </Pressable>
            </View>

            {error ? (
              <View style={[styles.errorBox, { borderColor: '#FF5050', backgroundColor: '#FF505012' }]}>
                <Feather name="alert-circle" size={14} color="#FF5050" />
                <Text style={[styles.errorText, { color: '#FF5050' }]}>{error}</Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Footer CTA */}
      <View style={[styles.footer, { paddingBottom: botPad + 16, borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <Pressable
          onPress={step < TOTAL_STEPS - 1 ? handleNext : handleSubmit}
          disabled={!canAdvance() || loading}
          style={({ pressed }) => [
            styles.nextBtn,
            {
              backgroundColor: canAdvance() ? colors.primary : colors.muted,
              opacity: pressed || loading ? 0.8 : 1,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Text style={[styles.nextBtnText, { color: canAdvance() ? colors.primaryForeground : colors.mutedForeground }]}>
                {step < TOTAL_STEPS - 1 ? 'Continue' : 'Submit Application'}
              </Text>
              {step < TOTAL_STEPS - 1 && <Feather name="arrow-right" size={18} color={canAdvance() ? colors.primaryForeground : colors.mutedForeground} />}
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  backBtn: { paddingBottom: 2 },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  progressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 20, paddingVertical: 10 },
  progressDot: {},
  content: { padding: 20 },
  stepContent: { gap: 16 },
  stepTitle: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  stepDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20, marginTop: -8 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 48, fontSize: 15, fontFamily: 'Inter_400Regular' },
  inputMulti: { height: 100, paddingTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  pricingCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
  pricingTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  pricingNote: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  priceRow: { flexDirection: 'row', gap: 10 },
  priceField: { flex: 1, gap: 4 },
  priceLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  priceInput: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, height: 44 },
  priceDollar: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  priceValue: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  sectionBox: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  sectionBoxTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderRadius: 10, borderWidth: 1 },
  dayLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
  reviewLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  reviewValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold', flex: 1, textAlign: 'right' },
  termsBox: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  termsTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  termsText: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  errorText: { fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
  nextBtn: { height: 54, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  nextBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  credBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  credBtnText: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
