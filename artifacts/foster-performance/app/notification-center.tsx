import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { PageHeader, SearchField, StatusPill } from '@/components/ProductUI';
import { radii, spacing, typography } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type Notice = {
  id: string;
  title: string;
  body: string;
  time: string;
  icon: string;
  category: string;
  read: boolean;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

const ICON_MAP: Record<string, string> = {
  workout: 'dumbbell',
  booking: 'video-outline',
  nutrition: 'food-apple-outline',
  achievement: 'trophy',
  message: 'message-text-outline',
  system: 'bell-outline',
};

export default function NotificationCenter() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setItems(
          (data ?? []).map((row: any) => ({
            id: row.id,
            title: row.title,
            body: row.body,
            time: timeAgo(row.created_at),
            icon: ICON_MAP[row.notification_type] || 'bell',
            category:
              row.notification_type.charAt(0).toUpperCase() +
              row.notification_type.slice(1),
            read: !!row.read_at,
          }))
        );
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const filtered = useMemo(
    () =>
      items.filter((n) =>
        (n.title + n.body + n.category)
          .toLowerCase()
          .includes(q.toLowerCase())
      ),
    [items, q]
  );

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null);
    setItems((v) => v.map((i) => ({ ...i, read: true })));
  };

  const markRead = async (notificationId: string) => {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);
    setItems((v) =>
      v.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  };

  if (loading) {
    return (
      <View
        style={[
          styles.root,
          {
            backgroundColor: colors.background,
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: Platform.OS === 'web' ? 40 : insets.top,
        },
      ]}
    >
      <BackgroundLayer />
      <PageHeader
        title="Notifications"
        subtitle={`${items.filter((i) => !i.read).length} unread`}
        right={
          <Pressable
            onPress={markAllRead}
            style={styles.mark}
            accessibilityRole="button"
            accessibilityLabel="Mark all notifications read"
          >
            <Text style={{ color: colors.primary }}>Read all</Text>
          </Pressable>
        }
      />
      <View style={styles.search}>
        <SearchField
          value={q}
          onChangeText={setQ}
          placeholder="Search notifications"
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name="bell-check-outline"
              size={42}
              color={colors.mutedForeground}
            />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              You're all caught up
            </Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              New training, coaching and account updates will appear here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => markRead(item.id)}
            style={[
              styles.item,
              {
                backgroundColor: item.read
                  ? colors.card
                  : colors.primary + '12',
                borderColor: item.read
                  ? colors.border
                  : colors.primary + '55',
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${
              item.read ? 'Read' : 'Unread'
            } notification: ${item.title}`}
          >
            <View
              style={[styles.icon, { backgroundColor: colors.primary + '18' }]}
            >
              <MaterialCommunityIcons
                name={item.icon as any}
                size={22}
                color={colors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.top}>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  {item.title}
                </Text>
                {!item.read && (
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: colors.primary },
                    ]}
                  />
                )}
              </View>
              <Text style={[styles.body, { color: colors.mutedForeground }]}>
                {item.body}
              </Text>
              <View style={styles.meta}>
                <StatusPill label={item.category} tone="muted" />
                <Text style={[styles.time, { color: colors.mutedForeground }]}>
                  {item.time}
                </Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  mark: {
    minWidth: 64,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: { padding: spacing.md, paddingBottom: 0 },
  list: { padding: spacing.md, gap: spacing.sm },
  item: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...typography.label, flex: 1 },
  body: { ...typography.bodySmall, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  time: { ...typography.caption },
  empty: { padding: 48, alignItems: 'center', gap: spacing.sm },
  emptyTitle: { ...typography.title },
  emptyBody: { ...typography.bodySmall, textAlign: 'center' },
});
