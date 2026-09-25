import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: 'member' | 'coach';
  text: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  memberUserId: string;
  memberName: string;
  coachApiId: string;
  coachName: string;
  lastMessage: string;
  lastTimestamp: string;
  unreadForMember: number;
  unreadForCoach: number;
}

interface MessagingContextType {
  conversations: Conversation[];
  getMessages: (convId: string) => Promise<Message[]>;
  sendMessage: (opts: {
    convId: string;
    senderId: string;
    senderName: string;
    senderRole: 'member' | 'coach';
    text: string;
  }) => Promise<void>;
  openOrCreateConversation: (opts: {
    memberUserId: string;
    memberName: string;
    coachApiId: string;
    coachName: string;
  }) => Promise<string>;
  markRead: (convId: string, readerRole: 'member' | 'coach') => Promise<void>;
  /** Files a moderation report. Pass messageId to report one message rather than the thread. */
  reportConversation: (opts: { convId: string; reason: string; details?: string; messageId?: string }) => Promise<void>;
  refreshConversations: () => Promise<void>;
  unreadForRole: (role: 'member' | 'coach', userId: string, coachApiId?: string) => number;
}

const MessagingContext = createContext<MessagingContextType | null>(null);

type ConversationRow = {
  id: string;
  member_id: string;
  coach_id: string;
  last_message_at: string | null;
  member: { full_name: string } | null;
  coach: { full_name: string } | null;
  messages: Array<{
    body: string;
    created_at: string;
    sender_id: string;
    read_at: string | null;
  }>;
};

export function MessagingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const refreshConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      return;
    }
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id, member_id, coach_id, last_message_at,
        member:profiles!conversations_member_id_fkey(full_name),
        coach:profiles!conversations_coach_id_fkey(full_name),
        messages(body, created_at, sender_id, read_at)
      `)
      .order('last_message_at', { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);

    setConversations(((data ?? []) as unknown as ConversationRow[]).map((row) => {
      const ordered = [...row.messages].sort((a, b) => b.created_at.localeCompare(a.created_at));
      const latest = ordered[0];
      const unread = row.messages.filter((message) => message.sender_id !== user.id && !message.read_at).length;
      return {
        id: row.id,
        memberUserId: row.member_id,
        memberName: row.member?.full_name ?? 'Member',
        coachApiId: row.coach_id,
        coachName: row.coach?.full_name ?? 'Coach',
        lastMessage: latest?.body ?? '',
        lastTimestamp: latest?.created_at ?? row.last_message_at ?? '',
        unreadForMember: row.member_id === user.id ? unread : 0,
        unreadForCoach: row.coach_id === user.id ? unread : 0,
      };
    }));
  }, [user]);

  useEffect(() => {
    void refreshConversations().catch((error: any) => console.info('[MessagingContext] Background load failed:', error));
    if (!user) return;
    const channel = supabase
      .channel(`messages:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        void refreshConversations().catch((error: any) => console.info('[MessagingContext] Background refresh failed:', error));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refreshConversations, user]);

  const getMessages = useCallback(async (convId: string): Promise<Message[]> => {
    const { data, error } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, body, created_at, sender:profiles!messages_sender_id_fkey(full_name, role)')
      .eq('conversation_id', convId)
      .order('created_at');
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: any) => ({
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      senderName: row.sender?.full_name ?? 'User',
      senderRole: row.sender?.role === 'member' ? 'member' : 'coach',
      text: row.body,
      timestamp: row.created_at,
    }));
  }, []);

  const openOrCreateConversation = useCallback(async (opts: {
    memberUserId: string;
    memberName: string;
    coachApiId: string;
    coachName: string;
  }) => {
    const existing = await supabase
      .from('conversations')
      .select('id')
      .eq('member_id', opts.memberUserId)
      .eq('coach_id', opts.coachApiId)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) return existing.data.id;

    const created = await supabase
      .from('conversations')
      .insert({ member_id: opts.memberUserId, coach_id: opts.coachApiId })
      .select('id')
      .single();
    if (created.error) throw new Error(created.error.message);
    await refreshConversations();
    return created.data.id;
  }, [refreshConversations]);

  const sendMessage = useCallback(async (opts: {
    convId: string;
    senderId: string;
    senderName: string;
    senderRole: 'member' | 'coach';
    text: string;
  }) => {
    const body = opts.text.trim();
    if (!body || !user) return;
    const { error } = await supabase.from('messages').insert({
      conversation_id: opts.convId,
      sender_id: user.id,
      body,
    });
    if (error) throw new Error(error.message);
    await refreshConversations();
  }, [refreshConversations, user]);

  const markRead = useCallback(async (convId: string, _readerRole: 'member' | 'coach') => {
    if (!user) return;
    const { error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', convId)
      .neq('sender_id', user.id)
      .is('read_at', null);
    if (error) throw new Error(error.message);
    await refreshConversations();
  }, [refreshConversations, user]);

  const reportConversation = useCallback(async (opts: {
    convId: string; reason: string; details?: string; messageId?: string;
  }) => {
    if (!user) throw new Error('You must be signed in to report a conversation.');
    const conversation = conversations.find((item) => item.id === opts.convId);
    if (!conversation) throw new Error('That conversation is no longer available.');
    // Whoever in the thread is not the reporter is the subject of the report.
    const reportedUserId = conversation.memberUserId === user.id
      ? conversation.coachApiId
      : conversation.memberUserId;

    const { error } = await supabase.from('moderation_reports').insert({
      reporter_id: user.id,
      reported_user_id: reportedUserId,
      conversation_id: opts.convId,
      message_id: opts.messageId ?? null,
      reason: opts.reason,
      details: opts.details ?? null,
    });
    if (error) throw new Error(error.message);
  }, [conversations, user]);

  const unreadForRole = useCallback((role: 'member' | 'coach', userId: string, coachApiId?: string) => {
    return conversations
      .filter((conversation) => role === 'member'
        ? conversation.memberUserId === userId
        : !coachApiId || conversation.coachApiId === coachApiId)
      .reduce((sum, conversation) => sum + (role === 'member' ? conversation.unreadForMember : conversation.unreadForCoach), 0);
  }, [conversations]);

  return (
    <MessagingContext.Provider value={{
      conversations,
      getMessages,
      sendMessage,
      openOrCreateConversation,
      markRead,
      reportConversation,
      refreshConversations,
      unreadForRole,
    }}>
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessaging() {
  const context = useContext(MessagingContext);
  if (!context) throw new Error('useMessaging must be used within MessagingProvider');
  return context;
}
