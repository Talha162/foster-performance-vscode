import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

export default function ChangePasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { changePassword } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const strength = getPasswordStrength(newPassword);

  const handleChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (!/[A-Z]/.test(newPassword)) { setError('Password must contain at least one uppercase letter'); return; }
    if (!/[a-z]/.test(newPassword)) { setError('Password must contain at least one lowercase letter'); return; }
    if (!/[0-9]/.test(newPassword)) { setError('Password must contain at least one number'); return; }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
      setError('Password must contain at least one special character');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError('');
    try {
      await changePassword(currentPassword, newPassword);
      Alert.alert(
        'Password Updated',
        'Your password has been changed successfully.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      setError(e.message || 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: botPad + 20 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => router.back()} style={styles.back}>
              <Feather name="arrow-left" size={22} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.title, { color: colors.foreground }]}>Change Password</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.form}>
            {/* Current password */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Current Password</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="lock" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Enter current password"
                  placeholderTextColor={colors.mutedForeground}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrent}
                  autoComplete="password"
                />
                <Pressable onPress={() => setShowCurrent(!showCurrent)}>
                  <Feather name={showCurrent ? 'eye-off' : 'eye'} size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </View>

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
                />
                <Pressable onPress={() => setShowNew(!showNew)}>
                  <Feather name={showNew ? 'eye-off' : 'eye'} size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
              {newPassword.length > 0 && (
                <View style={styles.strengthRow}>
                  <View style={styles.strengthBars}>
                    {[1,2,3,4,5].map(i => (
                      <View key={i} style={[styles.strengthBar, { backgroundColor: i <= strength.score ? strength.color : colors.border }]} />
                    ))}
                  </View>
                  <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                </View>
              )}
            </View>

            {/* Requirements */}
            {newPassword.length > 0 && (
              <View style={[styles.requirements, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {[
                  { met: newPassword.length >= 8, text: 'At least 8 characters' },
                  { met: /[A-Z]/.test(newPassword), text: 'One uppercase letter' },
                  { met: /[a-z]/.test(newPassword), text: 'One lowercase letter' },
                  { met: /[0-9]/.test(newPassword), text: 'One number' },
                  { met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword), text: 'One special character' },
                ].map(({ met, text }) => (
                  <View key={text} style={styles.reqRow}>
                    <Feather name={met ? 'check-circle' : 'circle'} size={13} color={met ? '#10B981' : colors.border} />
                    <Text style={[styles.reqText, { color: met ? colors.foreground : colors.mutedForeground }]}>{text}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Confirm new password */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Confirm New Password</Text>
              <View style={[
                styles.inputWrapper,
                { backgroundColor: colors.card, borderColor: confirmPassword && confirmPassword !== newPassword ? '#FF5050' : colors.border },
              ]}>
                <Feather name="lock" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Re-enter new password"
                  placeholderTextColor={colors.mutedForeground}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirm}
                  autoComplete="new-password"
                />
                <Pressable onPress={() => setShowConfirm(!showConfirm)}>
                  <Feather name={showConfirm ? 'eye-off' : 'eye'} size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
              {confirmPassword && confirmPassword !== newPassword && (
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
              onPress={handleChange}
              disabled={loading}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: colors.primary, opacity: pressed || loading ? 0.8 : 1 },
              ]}
            >
              {loading
                ? <ActivityIndicator color={colors.primaryForeground} />
                : <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Update Password</Text>
              }
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: 0 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, marginBottom: 24,
  },
  back: { width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  form: { paddingHorizontal: 20, gap: 16 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 52,
  },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  strengthBars: { flex: 1, flexDirection: 'row', gap: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', minWidth: 64, textAlign: 'right' },
  requirements: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 6 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  reqText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  matchError: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#FF5050', marginTop: 2 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  errorText: { fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },
  btn: { height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  btnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});
