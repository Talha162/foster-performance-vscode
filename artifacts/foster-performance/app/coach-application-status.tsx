import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const STATUS_CONFIG: Record<string, { color: string; icon: string; title: string; body: string }> = {
  Incomplete: {
    color: '#9AA3B5', icon: 'pencil-outline',
    title: 'Application Incomplete',
    body: 'Your application is not yet submitted. Complete all required fields and submit when ready.',
  },
  Submitted: {
    color: '#2F80FF', icon: 'send-check-outline',
    title: 'Application Submitted',
    body: 'Your application has been received and is queued for review. We\'ll notify you once reviewed.',
  },
  'Pending Review': {
    color: '#D6A84B', icon: 'clock-outline',
    title: 'Pending Review',
    body: 'Our team is actively reviewing your application. This typically takes 2–5 business days.',
  },
  'More Information Required': {
    color: '#FF9500', icon: 'information-outline',
    title: 'More Information Required',
    body: 'We need additional information before we can proceed. Please review the notes below and update your application.',
  },
  Approved: {
    color: '#35C98A', icon: 'check-circle-outline',
    title: 'Application Approved!',
    body: 'Congratulations! Your coach profile is now live. Welcome to Foster Performance.',
  },
  Rejected: {
    color: '#FF5050', icon: 'close-circle-outline',
    title: 'Application Not Approved',
    body: 'Unfortunately, your application was not approved at this time. You may re-apply after 30 days.',
  },
  Suspended: {
    color: '#FF5050', icon: 'alert-circle-outline',
    title: 'Account Suspended',
    body: 'Your coach account has been suspended. Please contact support for more information.',
  },
};

export default function CoachApplicationStatusScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<any>(null);
  const [error, setError] = useState('');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      try {
        const { data, error: queryError } = await supabase.from('coach_applications').select('*').eq('user_id', user.id).maybeSingle();
        if (queryError) throw new Error(queryError.message);
        const labels: Record<string, string> = { incomplete: 'Incomplete', submitted: 'Submitted', under_review: 'Pending Review', approved: 'Approved', rejected: 'Rejected' };
        setApplication(data ? { ...data, status: labels[data.status] ?? data.status, submittedAt: data.submitted_at, adminNotes: data.admin_notes } : null);
      } catch {
        setError('Could not load application status');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // If approved, redirect to coach dashboard
  useEffect(() => {
    if (user?.accountType === 'coach') {
      router.replace('/(coach-tabs)');
    }
  }, [user?.accountType]);

  const status = application?.status ?? user?.applicationStatus ?? 'Incomplete';
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG['Incomplete'];
  const canEdit = ['Incomplete', 'More Information Required'].includes(status);

  return (
    <View style={styles.root}>
      <BackgroundLayer />

      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Application Status</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Coach / Trainer Application</Text>
        </View>
        <Pressable
          onPress={async () => { await logout(); router.replace('/(auth)/welcome'); }}
          style={[styles.logoutBtn, { borderColor: colors.border }]}
        >
          <Feather name="log-out" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: botPad + 32 }]}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading application status…</Text>
          </View>
        ) : (
          <>
            {/* Status Card */}
            <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: config.color + '55' }]}>
              <View style={[styles.statusIconWrap, { backgroundColor: config.color + '22' }]}>
                <MaterialCommunityIcons name={config.icon as any} size={36} color={config.color} />
              </View>
              <View style={[styles.statusBadge, { backgroundColor: config.color }]}>
                <Text style={styles.statusBadgeText}>{status.toUpperCase()}</Text>
              </View>
              <Text style={[styles.statusTitle, { color: colors.foreground }]}>{config.title}</Text>
              <Text style={[styles.statusBody, { color: colors.mutedForeground }]}>{config.body}</Text>

              {application?.submittedAt && (
                <View style={[styles.dateRow, { borderTopColor: colors.border }]}>
                  <Feather name="calendar" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
                    Submitted: {new Date(application.submittedAt).toLocaleDateString()}
                  </Text>
                </View>
              )}
            </View>

            {/* Admin Notes */}
            {application?.adminNotes && (
              <View style={[styles.notesCard, { backgroundColor: '#D6A84B15', borderColor: '#D6A84B55' }]}>
                <View style={styles.notesHeader}>
                  <MaterialCommunityIcons name="message-text-outline" size={16} color="#D6A84B" />
                  <Text style={[styles.notesTitle, { color: '#D6A84B' }]}>Notes from Foster Performance</Text>
                </View>
                <Text style={[styles.notesBody, { color: colors.foreground }]}>{application.adminNotes}</Text>
              </View>
            )}

            {error ? (
              <Text style={[styles.error, { color: '#FF5050' }]}>{error}</Text>
            ) : null}

            {/* Actions */}
            <View style={styles.actions}>
              {canEdit && (
                <Pressable
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/coach-application'); }}
                  style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
                >
                  <Feather name="edit-2" size={16} color={colors.primaryForeground} />
                  <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
                    {status === 'Incomplete' ? 'Complete Application' : 'Update Application'}
                  </Text>
                </Pressable>
              )}

              <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="help-circle-outline" size={16} color={colors.primary} />
                <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                  Questions? Contact us at support@fosterperformance.com
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  logoutBtn: { padding: 8, borderRadius: 8, borderWidth: 1 },
  content: { padding: 20, gap: 16 },
  loadingWrap: { alignItems: 'center', gap: 12, marginTop: 60 },
  loadingText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  statusCard: { borderRadius: 20, borderWidth: 1.5, padding: 24, alignItems: 'center', gap: 12 },
  statusIconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  statusBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#FFF', letterSpacing: 1 },
  statusTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  statusBody: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 12, borderTopWidth: 1, width: '100%', justifyContent: 'center' },
  dateText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  notesCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
  notesHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notesTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  notesBody: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  error: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  actions: { gap: 12 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 14 },
  primaryBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
});
