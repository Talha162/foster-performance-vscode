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
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '@/context/AuthContext';
import { useMessaging, type Conversation, type Message } from '@/context/MessagingContext';
import { pickImage, signedUrl, uploadMessageAttachment } from '@/lib/storage';

export default function MessageThreadScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { convId } = useLocalSearchParams<{ convId: string }>();
  const { user } = useAuth();
  const { conversations, getMessages, sendMessage, markRead, reportConversation, setConversationBlocked } = useMessaging();

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [queued, setQueued] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const isCoach = user?.accountType === 'coach' || user?.accountType === 'owner_admin';
  const myRole: 'member' | 'coach' = isCoach ? 'coach' : 'member';

  const conv = conversations.find((c) => c.id === convId);
  const blockedBy = conv?.blockedBy ?? null;
  const blocked = !!blockedBy;
  const iBlocked = blockedBy === user?.id;
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
      setQueued(true);
    } finally {
      setSending(false);
    }
  };

  const submitReport = (reason: string, messageId?: string, quoted?: string) => {
    if (!convId) return;
    Alert.alert(
      'Report this?',
      'An administrator will review it. The conversation stays available to you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            try {
              await reportConversation({
                convId,
                reason,
                messageId,
                details: quoted ? `Reported message: ${quoted}` : undefined,
              });
              Alert.alert('Report submitted', 'Thanks — an administrator will review this.');
            } catch (error: any) {
              Alert.alert('Could not submit report', error?.message ?? 'Please try again.');
            }
          },
        },
      ],
    );
  };

  const toggleBlock = () => {
    if (!convId || blocking) return;
    const turningOn = !blocked;
    Alert.alert(
      turningOn ? 'Block this conversation?' : 'Unblock this conversation?',
      turningOn
        ? 'Neither of you will be able to send new messages. The history stays, and you can undo this at any time.'
        : 'You will both be able to send messages again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: turningOn ? 'Block' : 'Unblock',
          style: turningOn ? 'destructive' : 'default',
          onPress: async () => {
            setBlocking(true);
            try {
              await setConversationBlocked(convId, turningOn);
            } catch (error: any) {
              Alert.alert('Could not update', error?.message ?? 'Please try again.');
            } finally { setBlocking(false); }
          },
        },
      ],
    );
  };

  const handleAttach = async () => {
    if (!convId || !user || attaching) return;
    try {
      const picked = await pickImage();
      if (!picked) return;
      setAttaching(true);
      const attachmentPath = await uploadMessageAttachment(user.id, convId, picked);
      await sendMessage({
        convId,
        senderId: user.id,
        senderName: user.name,
        senderRole: myRole,
        text: text.trim(),
        attachmentPath,
      });
      setText('');
      await load();
    } catch (error: any) {
      Alert.alert('Could not send attachment', error?.message ?? 'Please try again.');
    } finally {
      setAttaching(false);
    }
  };

  /** Attachments live in a private bucket, so opening one needs a signed link. */
  const openAttachment = async (path: string) => {
    try {
      const url = await signedUrl('message-attachments', path);
      if (!url) throw new Error('The link could not be created.');
      await WebBrowser.openBrowserAsync(url);
    } catch (error: any) {
      Alert.alert('Could not open attachment', error?.message ?? 'Please try again.');
    }
  };

  const conversationMenu = () => Alert.alert('Conversation options', otherName || 'Conversation', [
    { text: blocked ? (iBlocked ? 'Unblock' : 'Blocked by the other person') : 'Block', style: blocked ? 'default' : 'destructive', onPress: () => { if (blocked && !iBlocked) { Alert.alert('Conversation closed', 'This conversation was closed by the other person, so only they can reopen it.'); return; } toggleBlock(); } },
    { text: 'Report conversation', style: 'destructive', onPress: () => submitReport('inappropriate_conversation') },
    { text: 'Cancel', style: 'cancel' },
  ]);

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
        <Pressable onPress={conversationMenu} accessibilityRole="button" accessibilityLabel="Conversation options" style={styles.menuBtn}><Feather name="more-vertical" size={21} color={colors.foreground} /></Pressable>
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
                      <Pressable
                        onLongPress={() => Alert.alert('Message options', msg.text, [
                          { text: 'Reply', onPress: () => setReplyTo(msg) },
                          { text: 'Copy', onPress: () => Alert.alert('Copied preview', 'Clipboard integration will be attached to this action in Milestone 2.') },
                          { text: 'Message info', onPress: () => Alert.alert('Message info', isMine ? 'Sent · Delivered · Read state preview' : 'Received message') },
                          ...(isMine ? [{ text: 'Delete preview', style: 'destructive' as const, onPress: () => Alert.alert('Delete message', 'Deletion confirmation is ready; server mutation is pending.') }] : [{ text: 'Report message', style: 'destructive' as const, onPress: () => submitReport('inappropriate_message', msg.id, msg.text) }]),
                          { text: 'Cancel', style: 'cancel' },
                        ])}
                        accessibilityRole="text"
                        accessibilityHint="Long press for message actions"
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
                        {msg.attachmentPath ? (
                          <Pressable
                            onPress={() => openAttachment(msg.attachmentPath!)}
                            accessibilityRole="button"
                            accessibilityLabel="Open attachment"
                            style={[styles.attachmentChip, {
                              borderColor: isMine ? colors.primaryForeground + '55' : colors.border,
                            }]}
                          >
                            <Feather name="paperclip" size={14} color={isMine ? colors.primaryForeground : colors.mutedForeground} />
                            <Text style={[styles.attachmentChipText, { color: isMine ? colors.primaryForeground : colors.foreground }]}>
                              View attachment
                            </Text>
                          </Pressable>
                        ) : null}
                      </Pressable>
                      <Text
                        style={[
                          styles.bubbleTime,
                          { color: colors.mutedForeground, textAlign: isMine ? 'right' : 'left' },
                        ]}
                      >
                        {formatTime(msg.timestamp)}{isMine ? idx === messages.length - 1 ? ' · Read' : ' · Delivered' : ''}
                      </Text>
                    </View>
                  </View>
                </React.Fragment>
              );
            })}
          </ScrollView>
        )}

        {/* Input bar */}
        {replyTo && <View style={[styles.replyPreview, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={{ flex: 1 }}><Text style={[styles.replyLabel, { color: colors.primary }]}>Replying to {replyTo.senderName}</Text><Text numberOfLines={1} style={[styles.replyText, { color: colors.mutedForeground }]}>{replyTo.text}</Text></View><Pressable onPress={() => setReplyTo(null)} accessibilityRole="button" accessibilityLabel="Cancel reply" style={styles.menuBtn}><Feather name="x" size={19} color={colors.mutedForeground} /></Pressable></View>}
        {queued && <Pressable onPress={() => { setQueued(false); handleSend(); }} style={[styles.queueBanner, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive }]}><Feather name="wifi-off" size={16} color={colors.destructive} /><Text style={[styles.queueText, { color: colors.foreground }]}>Message not sent · Tap to retry</Text></Pressable>}
        {blocked && <View style={[styles.queueBanner, { backgroundColor: colors.muted, borderColor: colors.border }]}><Feather name="slash" size={16} color={colors.mutedForeground} /><Text style={[styles.queueText, { color: colors.mutedForeground }]}>{iBlocked ? 'You blocked this conversation. Unblock it from the menu to continue.' : 'This conversation is closed, so new messages cannot be sent. Your history is still here.'}</Text></View>}
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
          <Pressable onPress={handleAttach} disabled={blocked || attaching} accessibilityRole="button" accessibilityLabel="Add attachment" style={styles.attachmentBtn}>{attaching ? <ActivityIndicator size="small" color={colors.mutedForeground} /> : <Feather name="plus" size={22} color={blocked ? colors.border : colors.mutedForeground} />}</Pressable>
          <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border, opacity: blocked ? .5 : 1 }]}>
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Type a message…"
              placeholderTextColor={colors.mutedForeground}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={1000}
              returnKeyType="default"
              editable={!blocked}
            />
          </View>
          <Pressable
            onPress={handleSend}
            disabled={!text.trim() || sending || blocked}
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
  menuBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
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
  replyPreview: { minHeight: 58, marginHorizontal: 16, marginTop: 8, paddingLeft: 12, borderWidth: 1, borderLeftWidth: 3, borderRadius: 10, flexDirection: 'row', alignItems: 'center' }, replyLabel: { fontSize: 11, fontFamily: 'Inter_700Bold' }, replyText: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  queueBanner: { minHeight: 42, marginHorizontal: 16, marginTop: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 8 }, queueText: { flex: 1, fontSize: 11, fontFamily: 'Inter_600SemiBold' }, attachmentBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, attachmentChip: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, alignSelf: 'flex-start' }, attachmentChipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
});
