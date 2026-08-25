import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import type { AccountType } from '@/context/AuthContext';

type Step = 'role' | 'details';
type RoleChoice = 'member' | 'coach_applicant';

function getPasswordStrength(p: string): { score: number; label: string; color: string } {
  let score = 0;
  if (p.length >= 8) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[a-z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p)) score++;
  if (score <= 1) return { score, label: 'Weak', color: '#FF5050' };
  if (score <= 2) return { score, label: 'Fair', color: '#F59E0B' };
  if (score <= 3) return { score, label: 'Good', color: '#3B82F6' };
  if (score === 4) return { score, label: 'Strong', color: '#10B981' };
  return { score, label: 'Very Strong', color: '#10B981' };
}

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();

  const [step, setStep] = useState<Step>('role');
  const [roleChoice, setRoleChoice] = useState<RoleChoice>('member');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Password strength
  const passwordStrength = getPasswordStrength(password);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (!/[A-Z]/.test(password)) { setError('Password must contain at least one uppercase letter'); return; }
    if (!/[a-z]/.test(password)) { setError('Password must contain at least one lowercase letter'); return; }
    if (!/[0-9]/.test(password)) { setError('Password must contain at least one number'); return; }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      setError('Password must contain at least one special character');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError('');
    try {
      await register(name.trim(), email.trim().toLowerCase(), password, roleChoice as AccountType);
      // Route based on role
      if (roleChoice === 'coach_applicant') {
        router.replace('/coach-application');
      } else {
        router.replace('/onboarding');
      }
    } catch (e: any) {
      setError(e.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topPad + 20, paddingBottom: botPad + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => (step === 'details' ? setStep('role') : router.back())}
          style={styles.back}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>

        <View style={styles.header}>
          <Image source={require('@/assets/images/icon.png')} style={styles.logoMark} resizeMode="contain" />
          <Text style={[styles.title, { color: colors.foreground }]}>
            {step === 'role' ? 'Join Foster Performance' : 'Create Account'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {step === 'role' ? 'What brings you here?' : `Signing up as a ${roleChoice === 'coach_applicant' ? 'Coach / Trainer' : 'Member'}`}
          </Text>
        </View>

        {step === 'role' ? (
          <View style={styles.roleSection}>
            <RoleCard
              selected={roleChoice === 'member'}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRoleChoice('member'); }}
              icon="account-circle"
              title="Become a Member"
              description="Access personalized workouts, wellness tools, progress tracking, and professional coaching."
              color={colors.primary}
              colors={colors}
            />
            <RoleCard
              selected={roleChoice === 'coach_applicant'}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRoleChoice('coach_applicant'); }}
              icon="whistle"
              title="Become a Coach or Trainer"
              description="Apply to offer coaching services, manage clients, schedule appointments, create programs, and earn money through Foster Performance."
              color={colors.accent}
              colors={colors}
            />

            <View style={[styles.noteRow, { borderColor: colors.border }]}>
              <MaterialCommunityIcons name="information-outline" size={14} color={colors.mutedForeground} />
              <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
                Coach accounts require an application and approval before going live on the platform.
              </Text>
            </View>

            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStep('details'); }}
              style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Continue</Text>
              <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Full Name</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="user" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="John Foster"
                  placeholderTextColor={colors.mutedForeground}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoComplete="name"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Email</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="mail" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.mutedForeground}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Password</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="lock" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={colors.mutedForeground}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  autoComplete="new-password"
                />
                <Pressable onPress={() => setShowPass(!showPass)}>
                  <Feather name={showPass ? 'eye-off' : 'eye'} size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
              {/* Strength bar */}
              {password.length > 0 && (
                <View style={styles.strengthRow}>
                  <View style={styles.strengthBars}>
                    {[1,2,3,4,5].map(i => (
                      <View key={i} style={[styles.strengthBar, { backgroundColor: i <= passwordStrength.score ? passwordStrength.color : colors.border }]} />
                    ))}
                  </View>
                  <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>{passwordStrength.label}</Text>
                </View>
              )}
            </View>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: 'rgba(255,80,80,0.1)', borderColor: '#FF5050' }]}>
                <Feather name="alert-circle" size={14} color="#FF5050" />
                <Text style={[styles.errorText, { color: '#FF5050' }]}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={handleRegister}
              disabled={loading}
              style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, opacity: pressed || loading ? 0.8 : 1 }]}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Create Account</Text>
              )}
            </Pressable>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Already have an account? </Text>
          <Pressable onPress={() => router.replace('/(auth)/login')}>
            <Text style={[styles.footerLink, { color: colors.primary }]}>Sign In</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function RoleCard({ selected, onPress, icon, title, description, color, colors }: {
  selected: boolean; onPress: () => void; icon: string; title: string;
  description: string; color: string; colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.roleCard, { backgroundColor: selected ? color + '14' : colors.card, borderColor: selected ? color : colors.border, borderWidth: selected ? 2 : 1 }]}
    >
      <View style={[styles.roleIcon, { backgroundColor: color + '22' }]}>
        <MaterialCommunityIcons name={icon as any} size={28} color={color} />
      </View>
      <View style={styles.roleText}>
        <Text style={[styles.roleTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.roleDesc, { color: colors.mutedForeground }]}>{description}</Text>
      </View>
      <View style={[styles.roleRadio, { borderColor: selected ? color : colors.border }]}>
        {selected && <View style={[styles.roleRadioInner, { backgroundColor: color }]} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 24 },
  back: { width: 40, height: 40, justifyContent: 'center' },
  header: { alignItems: 'center', gap: 8 },
  logoMark: { width: 64, height: 64, borderRadius: 14, marginBottom: 8 },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  roleSection: { gap: 12 },
  roleCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, gap: 14 },
  roleIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  roleText: { flex: 1, gap: 4 },
  roleTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  roleDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  roleRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  roleRadioInner: { width: 12, height: 12, borderRadius: 6 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  noteText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  form: { gap: 16 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 52 },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  errorText: { fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  strengthBars: { flex: 1, flexDirection: 'row', gap: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', minWidth: 64, textAlign: 'right' },
  btn: { height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 8 },
  btnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  footerLink: { fontSize: 14, fontFamily: 'Inter_700Bold' },
});
