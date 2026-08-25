/**
 * Messages screen — conversation list.
 * Members see conversations they've started with coaches.
 * Coaches see conversations members have opened with them.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useAuth } from '@/context/AuthContext';
import { useMessaging } from '@/context/MessagingContext';
import type { Conversation } from '@/context/MessagingContext';
import { SearchField } from '@/components/ProductUI';

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { conversations, refreshConversations } = useMessaging();
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const isCoach = user?.accountType === 'coach' || user?.accountType === 'owner_admin';

  // The server already scopes GET /conversations to the calling user,
  // so no client-side ID resolution or filtering is needed.
  useEffect(() => {
    setRefreshing(true);
    refreshConversations().finally(() => setRefreshing(false));
  }, []);

  const sorted = useMemo(
    () => [...conversations].sort(
      (a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()
    ),
    [conversations]
  );
  const visible = useMemo(() => sorted.filter((conversation) => {
    const otherName = isCoach ? conversation.memberName : conversation.coachName;
    return `${otherName} ${conversation.lastMessage}`.toLowerCase().includes(query.trim().toLowerCase());
  }), [sorted, query, isCoach]);

  const handleOpen = (conv: Conversation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/message-thread', params: { convId: conv.id } });
  };

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  }

  const title = isCoach ? 'Client Messages' : 'Messages';
  const showLoading = refreshing && conversations.length === 0;

  return (
    <View style={styles.root}>
      <BackgroundLayer />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {showLoading
              ? 'Loading…'
              : sorted.length === 0
              ? 'No conversations yet'
              : `${sorted.length} conversation${sorted.length === 1 ? '' : 's'}`}
          </Text>
        </View>
      </View>

      <View style={styles.searchWrap}><SearchField value={query} onChangeText={setQuery} placeholder="Search conversations…" /></View>

      {showLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : sorted.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="message-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {isCoach ? 'No client messages yet' : 'No conversations yet'}
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              {isCoach
                ? 'When members message you, conversations will appear here.'
                : 'Open a coach profile and tap "Message Coach" to start a conversation.'}
            </Text>
            {!isCoach && (
              <Pressable
                onPress={() => router.back()}
                style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.ctaBtnText, { color: colors.primaryForeground }]}>Browse Coaches</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : visible.length === 0 ? (
        <View style={styles.emptyWrap}><View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}><Feather name="search" size={38} color={colors.mutedForeground} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No matching conversations</Text><Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>Try a coach or member name, or clear the search.</Text><Pressable onPress={() => setQuery('')} style={[styles.ctaBtn, { backgroundColor: colors.primary }]}><Text style={[styles.ctaBtnText, { color: colors.primaryForeground }]}>Clear search</Text></Pressable></View></View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(conversation) => conversation.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 20 }]}
          initialNumToRender={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          renderItem={({ item: conv }) => {
            const unread = isCoach ? conv.unreadForCoach : conv.unreadForMember;
            const otherName = isCoach ? conv.memberName : conv.coachName;
            const initial = (otherName ?? '?').charAt(0).toUpperCase();

            return (
              <Pressable
                onPress={() => handleOpen(conv)}
                accessibilityRole="button"
                accessibilityLabel={`Open conversation with ${otherName}${unread ? `, ${unread} unread` : ''}`}
                style={({ pressed }) => [
                  styles.convRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                {/* Avatar */}
                <View style={[styles.avatar, { backgroundColor: colors.primary + '22' }]}>
                  <Text style={[styles.avatarText, { color: colors.primary }]}>{initial}</Text>
                  {unread > 0 && (
                    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                    </View>
                  )}
                </View>

                {/* Info */}
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={styles.convTopRow}>
                    <Text
                      style={[
                        styles.convName,
                        {
                          color: colors.foreground,
                          fontFamily: unread > 0 ? 'Inter_700Bold' : 'Inter_600SemiBold',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {otherName}
                    </Text>
                    <Text style={[styles.convTime, { color: colors.mutedForeground }]}>
                      {conv.lastTimestamp ? timeAgo(conv.lastTimestamp) : ''}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.convPreview,
                      {
                        color: unread > 0 ? colors.foreground : colors.mutedForeground,
                        fontFamily: unread > 0 ? 'Inter_500Medium' : 'Inter_400Regular',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {conv.lastMessage || 'Start the conversation…'}
                  </Text>
                </View>

                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: { paddingBottom: 2 },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  emptyWrap: { flex: 1, padding: 24, justifyContent: 'center' },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  emptyDesc: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  ctaBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 4 },
  ctaBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  list: { padding: 16, gap: 8 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12 },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  convTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convName: { fontSize: 15, flex: 1 },
  convTime: { fontSize: 11, fontFamily: 'Inter_400Regular', marginLeft: 8 },
  convPreview: { fontSize: 13, lineHeight: 18 },
});
