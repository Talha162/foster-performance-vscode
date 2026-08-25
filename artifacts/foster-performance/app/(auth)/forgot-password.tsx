import React, { useState, useRef } from 'react';
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
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';

type Step = 'email' | 'code';

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { forgotPassword } = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sentMessage, setSentMessage] = useState('');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleSendCode = async () => {
    if (!email.trim()) { setError('Please enter your email address'); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError('');
    try {
      const msg = await forgotPassword(email.trim().toLowerCase());
      setSentMessage(msg);
      setStep('code');
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (code.trim().length < 6) { setError('Please enter the 6-character code from your email'); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/(auth)/reset-password',
      params: { email: email.trim().toLowerCase(), code: code.trim().toUpperCase() },
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: topPad + 20, paddingBottom: botPad + 20 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => (step === 'code' ? setStep('email') : router.back())} style={styles.back}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + '18' }]}>
              <Feather name="lock" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {step === 'email' ? 'Forgot Password?' : 'Check Your Email'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {step === 'email'
                ? "Enter your account email and we'll send you a reset code."
                : `We sent a 6-character code to ${email}. Enter it below.`}
            </Text>
          </View>

          {step === 'email' ? (
            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Email Address</Text>
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
                    autoFocus
                  />
                </View>
              </View>

              {error ? <ErrorBox message={error} colors={colors} /> : null}

              <Pressable
                onPress={handleSendCode}
                disabled={loading}
                style={({ pressed }) => [
                  styles.btn,
                  { backgroundColor: colors.primary, opacity: pressed || loading ? 0.8 : 1 },
                ]}
              >
                {loading
                  ? <ActivityIndicator color={colors.primaryForeground} />
                  : <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Send Reset Code</Text>
                }
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              {sentMessage ? (
                <View style={[styles.infoBox, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '40' }]}>
                  <Feather name="info" size={14} color={colors.primary} />
                  <Text style={[styles.infoText, { color: colors.mutedForeground }]}>{sentMessage}</Text>
                </View>
              ) : null}

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Reset Code</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Feather name="key" size={16} color={colors.mutedForeground} />
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

              {error ? <ErrorBox message={error} colors={colors} /> : null}

              <Pressable
                onPress={handleContinue}
                style={({ pressed }) => [
                  styles.btn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Continue</Text>
              </Pressable>

              <Pressable
                onPress={() => { setStep('email'); setCode(''); setError(''); }}
                style={styles.resendRow}
              >
                <Text style={[styles.resendText, { color: colors.mutedForeground }]}>
                  Didn't receive a code?{' '}
                  <Text style={{ color: colors.primary }}>Try again</Text>
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function ErrorBox({ message, colors }: { message: string; colors: any }) {
  return (
    <View style={[styles.errorBox, { backgroundColor: 'rgba(255,80,80,0.08)', borderColor: '#FF5050' }]}>
      <Feather name="alert-circle" size={14} color="#FF5050" />
      <Text style={[styles.errorText, { color: '#FF5050' }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 28 },
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
  codeInput: { fontSize: 20, fontFamily: 'Inter_700Bold', letterSpacing: 4 },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  errorText: { fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },
  btn: { height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  resendRow: { alignItems: 'center', paddingVertical: 4 },
  resendText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
});
