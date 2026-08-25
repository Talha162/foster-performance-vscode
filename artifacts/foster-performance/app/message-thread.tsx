/**
 * Message thread screen — chat bubbles between one member and one coach.
 * Receives `convId` as a URL param.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useAuth } from '@/context/AuthContext';
import { useMessaging, type Conversation, type Message } from '@/context/MessagingContext';

export default function MessageThreadScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { convId } = useLocalSearchParams<{ convId: string }>();
  const { user } = useAuth();
  const { conversations, getMessages, sendMessage, markRead } = useMessaging();

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const isCoach = user?.accountType === 'coach' || user?.accountType === 'owner_admin';
  const myRole: 'member' | 'coach' = isCoach ? 'coach' : 'member';

  const conv = conversations.find((c) => c.id === convId);
  const otherName = conv ? (isCoach ? conv.memberName : conv.coachName) : '';

  // Load messages and mark as read
  const load = useCallback(async () => {
    if (!convId) return;
    setLoadError(null);
    try {
      const msgs = await getMessages(convId);
      setMessages(msgs);
      await markRead(convId, myRole);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
    } catch (err: any) {
      setLoadError(err?.message ?? 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [convId, myRole]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSend = async () => {
    if (!text.trim() || !convId || !user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const draft = text.trim();
    setSending(true);
    try {
      await sendMessage({
        convId,
        senderId: user.id,
        senderName: user.name,
        senderRole: myRole,
        text: draft,
      });
      // Only clear the draft after a confirmed successful send
      setText('');
      const msgs = await getMessages(convId);
      setMessages(msgs);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    } catch {
      // Draft is preserved in the input so the user can retry
      Alert.alert('Send Failed', 'Your message could not be sent. Please try again.');
    } finally {
      setSending(false);
    }
  };

  function formatTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  // Group messages by date
  function shouldShowDate(msgs: Message[], idx: number): boolean {
    if (idx === 0) return true;
    const prev = new Date(msgs[idx - 1].timestamp).toDateString();
    const curr = new Date(msgs[idx].timestamp).toDateString();
    return prev !== curr;
  }

  function dateSeparator(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <BackgroundLayer />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={[styles.headerAvatar, { backgroundColor: colors.primary + '22' }]}>
          <Text style={[styles.headerAvatarText, { color: colors.primary }]}>
            {(otherName || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerName, { color: colors.foreground }]} numberOfLines={1}>
            {otherName || '…'}
          </Text>
          <Text style={[styles.headerRole, { color: colors.mutedForeground }]}>
            {isCoach ? 'Member' : 'Coach'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Messages */}
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : loadError ? (
          <View style={styles.emptyThread}>
            <Feather name="alert-circle" size={32} color={colors.destructive} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, marginTop: 8 }]}>
              {loadError}
            </Text>
            <Pressable
              onPress={() => { setLoading(true); load(); }}
              style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.retryBtnText, { color: colors.primaryForeground }]}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.msgList, { paddingBottom: 12 }]}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {messages.length === 0 && (
              <View style={styles.emptyThread}>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No messages yet.{'\n'}Send the first message below!
                </Text>
              </View>
            )}

            {messages.map((msg, idx) => {
              const isMine = msg.senderId === user?.id;
              const showDate = shouldShowDate(messages, idx);

              return (
                <React.Fragment key={msg.id}>
                  {showDate && (
                    <View style={styles.dateSep}>
                      <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
                      <Text style={[styles.dateLabel, { color: colors.mutedForeground, backgroundColor: colors.background }]}>
                        {dateSeparator(msg.timestamp)}
                      </Text>
                      <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
                    </View>
                  )}

                  <View style={[styles.bubbleRow, isMine ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
                    {!isMine && (
                      <View style={[styles.bubbleAvatar, { backgroundColor: colors.primary + '22' }]}>
                        <Text style={[styles.bubbleAvatarText, { color: colors.primary }]}>
                          {(msg.senderName || '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ maxWidth: '72%' }}>
                      <View
                        style={[
                          styles.bubble,
                          isMine
                            ? [styles.bubbleMine, { backgroundColor: colors.primary }]
                            : [styles.bubbleTheirs, { backgroundColor: colors.card, borderColor: colors.border }],
                        ]}
                      >
                        <Text
                          style={[
                            styles.bubbleText,
                            { color: isMine ? colors.primaryForeground : colors.foreground },
                          ]}
                        >
                          {msg.text}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.bubbleTime,
                          { color: colors.mutedForeground, textAlign: isMine ? 'right' : 'left' },
                        ]}
                      >
                        {formatTime(msg.timestamp)}
                      </Text>
                    </View>
                  </View>
                </React.Fragment>
              );
            })}
          </ScrollView>
        )}

        {/* Input bar */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: botPad + 8,
            },
          ]}
        >
          <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Type a message…"
              placeholderTextColor={colors.mutedForeground}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={1000}
              returnKeyType="default"
            />
          </View>
          <Pressable
            onPress={handleSend}
            disabled={!text.trim() || sending}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: text.trim() ? colors.primary : colors.card,
                borderColor: colors.border,
                opacity: pressed || sending ? 0.7 : 1,
              },
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Feather name="send" size={18} color={text.trim() ? colors.primaryForeground : colors.mutedForeground} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  headerName: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  headerRole: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  msgList: { padding: 16, gap: 2 },
  emptyThread: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  dateSep: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 },
  dateLine: { flex: 1, height: 1 },
  dateLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', paddingHorizontal: 8 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginVertical: 3 },
  bubbleRowLeft: { justifyContent: 'flex-start' },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubbleAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  bubbleAvatarText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { borderBottomRightRadius: 4 },
  bubbleTheirs: { borderWidth: 1, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  bubbleTime: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3, marginHorizontal: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1 },
  inputWrap: { flex: 1, borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, maxHeight: 120 },
  input: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 12 },
  retryBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
