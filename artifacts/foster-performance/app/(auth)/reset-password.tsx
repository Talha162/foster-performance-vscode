import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';

// ─── Password strength helpers ────────────────────────────────────────────────

function getStrength(p: string): { score: number; label: string; color: string } {
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

function StrengthBar({ password, colors }: { password: string; colors: any }) {
  if (!password) return null;
  const { score, label, color } = getStrength(password);
  return (
    <View style={strengthStyles.root}>
      <View style={strengthStyles.bars}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={[
              strengthStyles.bar,
              { backgroundColor: i <= score ? color : colors.border },
            ]}
          />
        ))}
      </View>
      <Text style={[strengthStyles.label, { color }]}>{label}</Text>
    </View>
  );
}

function RequirementRow({ met, text, colors }: { met: boolean; text: string; colors: any }) {
  return (
    <View style={reqStyles.row}>
      <Feather name={met ? 'check-circle' : 'circle'} size={13} color={met ? '#10B981' : colors.border} />
      <Text style={[reqStyles.text, { color: met ? colors.foreground : colors.mutedForeground }]}>{text}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ResetPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { resetPassword } = useAuth();
  const { email, code } = useLocalSearchParams<{ email: string; code: string }>();

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleReset = async () => {
    if (!newPassword || !confirm) { setError('Please fill in both password fields'); return; }
    if (newPassword !== confirm) { setError('Passwords do not match'); return; }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError('');
    try {
      await resetPassword(email ?? '', code ?? '', newPassword);
      setSuccess(true);
    } catch (e: any) {
      setError(e.message || 'Password reset failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.successContainer, { paddingTop: topPad + 40, paddingHorizontal: 32 }]}>
          <View style={[styles.successIcon, { backgroundColor: '#10B98118' }]}>
            <Feather name="check" size={36} color="#10B981" />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>Password Updated</Text>
          <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
            Your password has been updated successfully. Please sign in with your new password.
          </Text>
          <Pressable
            onPress={() => router.replace('/(auth)/login')}
            style={[styles.btn, { backgroundColor: colors.primary, marginTop: 32 }]}
          >
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Sign In</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: topPad + 20, paddingBottom: botPad + 20 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => router.back()} style={styles.back}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>

          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + '18' }]}>
              <Feather name="shield" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>Set New Password</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Create a strong password for your account.
            </Text>
          </View>

          <View style={styles.form}>
            {/* New password */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>New Password</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="lock" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={colors.mutedForeground}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNew}
                  autoComplete="new-password"
                  autoFocus
                />
                <Pressable onPress={() => setShowNew(!showNew)}>
                  <Feather name={showNew ? 'eye-off' : 'eye'} size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
              <StrengthBar password={newPassword} colors={colors} />
            </View>

            {/* Requirements */}
            {newPassword.length > 0 && (
              <View style={[styles.requirementsBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <RequirementRow met={newPassword.length >= 8} text="At least 8 characters" colors={colors} />
                <RequirementRow met={/[A-Z]/.test(newPassword)} text="One uppercase letter" colors={colors} />
                <RequirementRow met={/[a-z]/.test(newPassword)} text="One lowercase letter" colors={colors} />
                <RequirementRow met={/[0-9]/.test(newPassword)} text="One number" colors={colors} />
                <RequirementRow
                  met={/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)}
                  text="One special character"
                  colors={colors}
                />
              </View>
            )}

            {/* Confirm password */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Confirm Password</Text>
              <View style={[
                styles.inputWrapper,
                {
                  backgroundColor: colors.card,
                  borderColor: confirm && confirm !== newPassword ? '#FF5050' : colors.border,
                },
              ]}>
                <Feather name="lock" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Re-enter new password"
                  placeholderTextColor={colors.mutedForeground}
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry={!showConfirm}
                  autoComplete="new-password"
                />
                <Pressable onPress={() => setShowConfirm(!showConfirm)}>
                  <Feather name={showConfirm ? 'eye-off' : 'eye'} size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
              {confirm && confirm !== newPassword && (
                <Text style={styles.matchError}>Passwords do not match</Text>
              )}
            </View>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: 'rgba(255,80,80,0.08)', borderColor: '#FF5050' }]}>
                <Feather name="alert-circle" size={14} color="#FF5050" />
                <Text style={[styles.errorText, { color: '#FF5050' }]}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={handleReset}
              disabled={loading}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: colors.primary, opacity: pressed || loading ? 0.8 : 1 },
              ]}
            >
              {loading
                ? <ActivityIndicator color={colors.primaryForeground} />
                : <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Reset Password</Text>
              }
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const strengthStyles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  bars: { flex: 1, flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  label: { fontSize: 12, fontFamily: 'Inter_600SemiBold', minWidth: 64, textAlign: 'right' },
});

const reqStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  text: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 24 },
  back: { width: 40, height: 40, justifyContent: 'center' },
  header: { alignItems: 'center', gap: 12 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  form: { gap: 16 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 52,
  },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  matchError: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#FF5050', marginTop: 2 },
  requirementsBox: {
    borderRadius: 10, borderWidth: 1, padding: 12, gap: 6,
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  errorText: { fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },
  btn: { height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  successContainer: { flex: 1, alignItems: 'center', gap: 16 },
  successIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  successTitle: { fontSize: 26, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  successSub: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
});
