/**
 * MessagingContext — Server-backed in-app messaging between members and coaches.
 *
 * Conversations and messages are stored on the API server (PostgreSQL), so they
 * are durable across app reinstalls and work across different devices for both
 * the member and the coach.
 *
 * Conversation ID: `conv_{memberUserId}_{coachApiId}` (e.g. conv_42_api_3)
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: 'member' | 'coach';
  text: string;
  timestamp: string; // ISO string
}

export interface Conversation {
  id: string;
  memberUserId: string;
  memberName: string;
  coachApiId: string;
  coachName: string;
  lastMessage: string;
  lastTimestamp: string; // ISO string
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
  refreshConversations: () => Promise<void>;
  unreadForRole: (role: 'member' | 'coach', userId: string, coachApiId?: string) => number;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const MessagingContext = createContext<MessagingContextType | null>(null);

function getApiBase(): string {
  return (
    (process.env.EXPO_PUBLIC_API_BASE as string | undefined) ??
    `https://${process.env.EXPO_PUBLIC_DOMAIN as string}/api`
  );
}

export function MessagingProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // ── Refresh from server ──────────────────────────────────────────────────────

  const refreshConversations = useCallback(async () => {
    if (!token) {
      setConversations([]);
      return;
    }
    try {
      const resp = await fetch(`${getApiBase()}/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return;
      const data = await resp.json().catch(() => ({}));
      setConversations(Array.isArray(data.conversations) ? data.conversations : []);
    } catch {
      // offline or server unavailable — keep existing state
    }
  }, [token]);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  // ── API methods ──────────────────────────────────────────────────────────────

  const getMessages = useCallback(async (convId: string): Promise<Message[]> => {
    if (!token) return [];
    const resp = await fetch(
      `${getApiBase()}/conversations/${encodeURIComponent(convId)}/messages`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error((data as any).error ?? `Failed to load messages (${resp.status})`);
    }
    const data = await resp.json().catch(() => ({}));
    return Array.isArray(data.messages) ? data.messages : [];
  }, [token]);

  const openOrCreateConversation = useCallback(
    async (opts: {
      memberUserId: string;
      memberName: string;
      coachApiId: string;
      coachName: string;
    }): Promise<string> => {
      if (!token) throw new Error('Not authenticated');
      const resp = await fetch(`${getApiBase()}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(opts),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error ?? 'Failed to open conversation');
      const convId: string = data.conversationId;
      await refreshConversations();
      return convId;
    },
    [token, refreshConversations]
  );

  const sendMessage = useCallback(
    async (opts: {
      convId: string;
      senderId: string;
      senderName: string;
      senderRole: 'member' | 'coach';
      text: string;
    }) => {
      const trimmed = opts.text.trim();
      if (!trimmed || !token) return;
      const resp = await fetch(
        `${getApiBase()}/conversations/${encodeURIComponent(opts.convId)}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ text: trimmed, senderName: opts.senderName }),
        }
      );
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error((data as any).error ?? 'Failed to send message');
      }
      // Refresh so the conversation list shows the latest message and unread counts.
      await refreshConversations();
    },
    [token, refreshConversations]
  );

  const markRead = useCallback(
    async (convId: string, _readerRole: 'member' | 'coach') => {
      if (!token) return;
      try {
        await fetch(
          `${getApiBase()}/conversations/${encodeURIComponent(convId)}/read`,
          {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        await refreshConversations();
      } catch {
        // fail silently
      }
    },
    [token, refreshConversations]
  );

  const unreadForRole = useCallback(
    (role: 'member' | 'coach', userId: string, coachApiId?: string): number => {
      if (role === 'member') {
        return conversations
          .filter((c) => c.memberUserId === userId)
          .reduce((s, c) => s + c.unreadForMember, 0);
      }
      return conversations
        .filter((c) => !coachApiId || c.coachApiId === coachApiId)
        .reduce((s, c) => s + c.unreadForCoach, 0);
    },
    [conversations]
  );

  return (
    <MessagingContext.Provider
      value={{
        conversations,
        getMessages,
        sendMessage,
        openOrCreateConversation,
        markRead,
        refreshConversations,
        unreadForRole,
      }}
    >
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessaging() {
  const ctx = useContext(MessagingContext);
  if (!ctx) throw new Error('useMessaging must be used within MessagingProvider');
  return ctx;
}
