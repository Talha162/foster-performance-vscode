import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';

export default function VerifyEmailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, verifyEmail, sendVerification } = useAuth();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resent, setResent] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleVerify = async () => {
    if (code.trim().length < 6) { setError('Please enter the 6-character verification code'); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError('');
    try {
      await verifyEmail(code.trim());
      setSuccess(true);
    } catch (e: any) {
      setError(e.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    try {
      await sendVerification();
      setResent(true);
    } catch (e: any) {
      setError(e.message || 'Failed to resend. Please try again.');
    } finally {
      setResending(false);
    }
  };

  if (success) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.center, { paddingTop: topPad + 60, paddingHorizontal: 32 }]}>
          <View style={[styles.iconCircle, { backgroundColor: '#10B98118' }]}>
            <Feather name="check-circle" size={36} color="#10B981" />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Email Verified!</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Your email address has been verified. You now have full access to Foster Performance.
          </Text>
          <Pressable
            onPress={() => router.replace('/')}
            style={[styles.btn, { backgroundColor: colors.primary, marginTop: 32 }]}
          >
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Continue</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topPad + 20, paddingBottom: botPad + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>

        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + '18' }]}>
            <Feather name="mail" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Verify Your Email</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            We sent a 6-character code to{' '}
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
              {user?.email ?? 'your email'}
            </Text>
            . Enter it below to verify your account.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Verification Code</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="shield" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, styles.codeInput, { color: colors.foreground }]}
                placeholder="A1B2C3"
                placeholderTextColor={colors.mutedForeground}
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                autoFocus
              />
            </View>
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: 'rgba(255,80,80,0.08)', borderColor: '#FF5050' }]}>
              <Feather name="alert-circle" size={14} color="#FF5050" />
              <Text style={[styles.errorText, { color: '#FF5050' }]}>{error}</Text>
            </View>
          ) : null}

          {resent ? (
            <View style={[styles.infoBox, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '40' }]}>
              <Feather name="check" size={14} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                Verification code resent. Check your inbox.
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleVerify}
            disabled={loading}
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: colors.primary, opacity: pressed || loading ? 0.8 : 1 },
            ]}
          >
            {loading
              ? <ActivityIndicator color={colors.primaryForeground} />
              : <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Verify Email</Text>
            }
          </Pressable>

          <Pressable onPress={handleResend} disabled={resending} style={styles.resendRow}>
            {resending
              ? <ActivityIndicator size="small" color={colors.mutedForeground} />
              : <Text style={[styles.resendText, { color: colors.mutedForeground }]}>
                  Didn't receive a code?{' '}
                  <Text style={{ color: colors.primary }}>Resend</Text>
                </Text>
            }
          </Pressable>

          <Pressable onPress={() => router.replace('/')} style={styles.skipRow}>
            <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Verify later</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 28 },
  center: { flex: 1, alignItems: 'center', gap: 16 },
  back: { width: 40, height: 40, justifyContent: 'center' },
  header: { alignItems: 'center', gap: 12 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 21 },
  form: { gap: 16 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 52,
  },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  codeInput: { fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: 6 },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  errorText: { fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },
  btn: { height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  resendRow: { alignItems: 'center', paddingVertical: 2 },
  resendText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  skipRow: { alignItems: 'center', paddingVertical: 2 },
  skipText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
