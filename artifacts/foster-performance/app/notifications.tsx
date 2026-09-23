import React, { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type Preferences = {
  workoutReminders: boolean;
  coachMessages: boolean;
  weeklyProgress: boolean;
  nutritionReminders: boolean;
  sessionReminders: boolean;
  achievements: boolean;
  platformNews: boolean;
};

const DEFAULT_PREFERENCES: Preferences = {
  workoutReminders: true,
  coachMessages: true,
  weeklyProgress: true,
  nutritionReminders: true,
  sessionReminders: true,
  achievements: true,
  platformNews: false,
};

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [permission, setPermission] = useState<'not-requested' | 'enabled' | 'denied'>('not-requested');

  useEffect(() => {
    if (!user) return;
    supabase.from('user_app_state').select('notification_preferences').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.notification_preferences) setPreferences({ ...DEFAULT_PREFERENCES, ...data.notification_preferences });
      });
  }, [user]);

  const toggle = (key: keyof Preferences) => {
    setPreferences((current) => {
      const next = { ...current, [key]: !current[key] };
      if (user) supabase.from('user_app_state').upsert({ user_id: user.id, notification_preferences: next }).then();
      return next;
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <BackgroundLayer />
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Notifications</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: (Platform.OS === 'web' ? 32 : insets.bottom + 24) }]}>
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          Choose the updates that help you stay consistent. These preferences are saved on this device.
        </Text>
        <View style={[styles.permission, { backgroundColor: colors.card, borderColor: permission === 'denied' ? colors.destructive : colors.border }]}>
          <View style={[styles.permissionIcon, { backgroundColor: (permission === 'enabled' ? colors.success : permission === 'denied' ? colors.destructive : colors.primary) + '18' }]}><Feather name={permission === 'enabled' ? 'check' : permission === 'denied' ? 'bell-off' : 'bell'} size={20} color={permission === 'enabled' ? colors.success : permission === 'denied' ? colors.destructive : colors.primary} /></View>
          <View style={{ flex: 1 }}><Text style={[styles.permissionTitle, { color: colors.foreground }]}>System permission: {permission === 'enabled' ? 'Enabled' : permission === 'denied' ? 'Denied' : 'Not requested'}</Text><Text style={[styles.rowDescription, { color: colors.mutedForeground }]}>{permission === 'enabled' ? 'Device delivery can be connected in Milestone 2.' : permission === 'denied' ? 'Open device settings to allow notifications.' : 'Preview the permission request before production push is connected.'}</Text></View>
          <Pressable onPress={() => permission === 'denied' ? Linking.openSettings().catch(() => Alert.alert('Device settings unavailable')) : setPermission('enabled')} style={[styles.permissionBtn, { borderColor: colors.primary }]}><Text style={[styles.permissionBtnText, { color: colors.primary }]}>{permission === 'denied' ? 'Settings' : permission === 'enabled' ? 'On' : 'Allow'}</Text></Pressable>
        </View>
        <Pressable onPress={() => setPermission(permission === 'denied' ? 'not-requested' : 'denied')} style={styles.previewLink}><Text style={[styles.previewText, { color: colors.mutedForeground }]}>{permission === 'denied' ? 'Reset permission preview' : 'Preview permission denied'}</Text></Pressable>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <PreferenceRow
            icon="clock"
            title="Workout reminders"
            description="A gentle reminder when it is time to train."
            value={preferences.workoutReminders}
            onToggle={() => toggle('workoutReminders')}
            colors={colors}
          />
          <PreferenceRow
            icon="coffee"
            title="Nutrition reminders"
            description="Meal planning and food logging reminders."
            value={preferences.nutritionReminders}
            onToggle={() => toggle('nutritionReminders')}
            colors={colors}
          />
          <PreferenceRow
            icon="message-circle"
            title="Coach messages"
            description="Know when a coach replies to your question."
            value={preferences.coachMessages}
            onToggle={() => toggle('coachMessages')}
            colors={colors}
          />
          <PreferenceRow
            icon="calendar"
            title="Session reminders"
            description="Upcoming coaching appointment and join-window updates."
            value={preferences.sessionReminders}
            onToggle={() => toggle('sessionReminders')}
            colors={colors}
          />
          <PreferenceRow
            icon="bar-chart-2"
            title="Weekly progress"
            description="A weekly summary of your training activity."
            value={preferences.weeklyProgress}
            onToggle={() => toggle('weeklyProgress')}
            colors={colors}
          />
          <PreferenceRow
            icon="award"
            title="Achievements and streaks"
            description="Meaningful milestones and consistency updates."
            value={preferences.achievements}
            onToggle={() => toggle('achievements')}
            colors={colors}
          />
          <PreferenceRow
            icon="radio"
            title="Platform news"
            description="Optional product news and service announcements."
            value={preferences.platformNews}
            onToggle={() => toggle('platformNews')}
            colors={colors}
          />
        </View>
        <View style={[styles.note, { backgroundColor: colors.muted }]}>
          <Feather name="info" size={15} color={colors.primary} />
          <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
            Push delivery will be enabled when device notifications are connected. Your choices are ready now.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function PreferenceRow({
  icon, title, description, value, onToggle, colors,
}: {
  icon: string;
  title: string;
  description: string;
  value: boolean;
  onToggle: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.primary + '18' }]}>
        <Feather name={icon as any} size={17} color={colors.primary} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.rowDescription, { color: colors.mutedForeground }]}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.primary + '88' }}
        thumbColor={value ? colors.primary : colors.mutedForeground}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  content: { padding: 20, gap: 16 },
  intro: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowInfo: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  rowDescription: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 14, borderRadius: 12 },
  noteText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  permission: { borderRadius: 16, borderWidth: 1, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 }, permissionIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, permissionTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', marginBottom: 3 }, permissionBtn: { minHeight: 40, minWidth: 58, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 }, permissionBtnText: { fontSize: 11, fontFamily: 'Inter_700Bold' }, previewLink: { minHeight: 38, marginTop: -12, alignItems: 'flex-end', justifyContent: 'center' }, previewText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
});
