import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';

const NOTIFICATIONS_KEY = '@foster_notification_preferences';

type Preferences = {
  workoutReminders: boolean;
  coachMessages: boolean;
  weeklyProgress: boolean;
};

const DEFAULT_PREFERENCES: Preferences = {
  workoutReminders: true,
  coachMessages: true,
  weeklyProgress: true,
};

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    AsyncStorage.getItem(NOTIFICATIONS_KEY).then((saved) => {
      if (!saved) return;
      try {
        setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(saved) });
      } catch {
        // Keep the safe defaults when stored preferences are malformed.
      }
    });
  }, []);

  const toggle = (key: keyof Preferences) => {
    setPreferences((current) => {
      const next = { ...current, [key]: !current[key] };
      AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next));
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
      <View style={styles.content}>
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          Choose the updates that help you stay consistent. These preferences are saved on this device.
        </Text>
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
            icon="message-circle"
            title="Coach messages"
            description="Know when a coach replies to your question."
            value={preferences.coachMessages}
            onToggle={() => toggle('coachMessages')}
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
        </View>
        <View style={[styles.note, { backgroundColor: colors.muted }]}>
          <Feather name="info" size={15} color={colors.primary} />
          <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
            Push delivery will be enabled when device notifications are connected. Your choices are ready now.
          </Text>
        </View>
      </View>
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
});