/**
 * AuthContext — server-backed authentication.
 *
 * Roles:
 *   member          → member onboarding + main tabs
 *   coach_applicant → coach application flow + status screen
 *   coach           → coach dashboard
 *   owner_admin     → admin portal (role assigned via OWNER_ADMIN_EMAIL env var only)
 *
 * JWT is stored in AsyncStorage under @foster_jwt.
 * On startup the token is validated against /auth/me.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AccountType = 'member' | 'coach_applicant' | 'coach' | 'owner_admin';
export type SubscriptionStatus =
  | 'active' | 'trial' | 'pending' | 'past_due' | 'canceled' | 'expired';

export interface User {
  id: string;
  name: string;
  email: string;
  accountType: AccountType;
  onboardingComplete?: boolean;
  goal?: string;
  level?: 'Beginner' | 'Intermediate' | 'Advanced';
  applicationStatus?: string;
  emailVerified?: boolean;
  // Subscription
  isPremium: boolean;
  subscriptionStatus?: SubscriptionStatus | null;
  subscriptionPlan?: 'monthly' | 'annual';
  subscriptionEndDate?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  // Stats
  streakDays: number;
  totalWorkouts: number;
  joinDate: string;
}

export interface SubscriptionUpdate {
  subscriptionStatus?: SubscriptionStatus;
  subscriptionPlan?: 'monthly' | 'annual';
  subscriptionEndDate?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, accountType?: AccountType) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  upgradeToPremium: () => Promise<void>;
  updateSubscription: (update: SubscriptionUpdate) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  becomeCoach: () => Promise<void>;
  // ─── Auth security ────────────────────────────────────────────────────────
  forgotPassword: (email: string) => Promise<string>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  sendVerification: () => Promise<void>;
  verifyEmail: (code: string) => Promise<void>;
  signOutAll: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  changeEmail: (currentPassword: string, newEmail: string) => Promise<void>;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

const getApiBase = () =>
  process.env.EXPO_PUBLIC_API_BASE ??
  `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

const JWT_KEY = '@foster_jwt';

async function apiFetch(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as any),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const resp = await fetch(`${getApiBase()}${path}`, { ...options, headers });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: validate stored JWT
  useEffect(() => {
    (async () => {
      try {
        const storedToken = await AsyncStorage.getItem(JWT_KEY);
        if (!storedToken) { setIsLoading(false); return; }
        const data = await apiFetch('/auth/me', {}, storedToken);
        setToken(storedToken);
        setUser(data.user);
      } catch {
        await AsyncStorage.removeItem(JWT_KEY);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ─── Auth actions ───────────────────────────────────────────────────────────

  const login = async (email: string, password: string) => {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await AsyncStorage.setItem(JWT_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    accountType: AccountType = 'member'
  ) => {
    const safeType =
      accountType === 'owner_admin' ? 'member' : accountType;
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, accountType: safeType }),
    });
    await AsyncStorage.setItem(JWT_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove([JWT_KEY, '@foster_subscription']);
    setToken(null);
    setUser(null);
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!token) return;
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
    try {
      const data = await apiFetch('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: updates.name,
          goal: updates.goal,
          level: updates.level,
          onboardingComplete: updates.onboardingComplete,
          isPremium: updates.isPremium,
          subscriptionStatus: updates.subscriptionStatus,
          subscriptionPlan: updates.subscriptionPlan,
          subscriptionEndDate: updates.subscriptionEndDate,
          stripeCustomerId: updates.stripeCustomerId,
          stripeSubscriptionId: updates.stripeSubscriptionId,
          streakDays: updates.streakDays,
          totalWorkouts: updates.totalWorkouts,
        }),
      }, token);
      setUser(data.user);
    } catch {
      // Server update failed — local state already updated
    }
  };

  const upgradeToPremium = async () => {
    await updateUser({ isPremium: true, subscriptionStatus: 'active', subscriptionPlan: 'monthly' });
  };

  const updateSubscription = async (update: SubscriptionUpdate) => {
    const isPremium = update.subscriptionStatus === 'active' || update.subscriptionStatus === 'trial';
    await updateUser({ ...update, isPremium });
  };

  const cancelSubscription = async () => {
    await updateUser({ isPremium: false, subscriptionStatus: 'canceled' });
  };

  const becomeCoach = async () => {
    if (!token) throw new Error('Not authenticated');
    const data = await apiFetch('/auth/become-coach', { method: 'POST' }, token);
    await AsyncStorage.setItem(JWT_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
  };

  // ─── Auth security actions ──────────────────────────────────────────────────

  /** Sends password-reset OTP. Returns the neutral server message. */
  const forgotPassword = async (email: string): Promise<string> => {
    const data = await apiFetch('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    return data.message ?? 'If an account exists for this email, password-reset instructions have been sent.';
  };

  /** Resets password using the OTP code. Navigates user to login after. */
  const resetPassword = async (email: string, code: string, newPassword: string): Promise<void> => {
    await apiFetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, code, newPassword }),
    });
    // Invalidate any stored token — sessions invalidated server-side
    await AsyncStorage.removeItem(JWT_KEY);
    setToken(null);
    setUser(null);
  };

  /** Sends a verification email to the current user's email address. */
  const sendVerification = async (): Promise<void> => {
    if (!token) throw new Error('Not authenticated');
    await apiFetch('/auth/send-verification', { method: 'POST' }, token);
  };

  /** Verifies email with the 6-char code sent by email. */
  const verifyEmail = async (code: string): Promise<void> => {
    if (!token) throw new Error('Not authenticated');
    await apiFetch('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }, token);
    setUser((prev) => prev ? { ...prev, emailVerified: true } : prev);
  };

  /** Signs out all devices. Returns a fresh token for the current session. */
  const signOutAll = async (): Promise<void> => {
    if (!token) throw new Error('Not authenticated');
    const data = await apiFetch('/auth/logout-all', { method: 'POST' }, token);
    // Store the fresh token issued for this session
    await AsyncStorage.setItem(JWT_KEY, data.token);
    setToken(data.token);
  };

  /** Changes password. Requires current password. Issues a fresh token. */
  const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    if (!token) throw new Error('Not authenticated');
    const data = await apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }, token);
    await AsyncStorage.setItem(JWT_KEY, data.token);
    setToken(data.token);
  };

  /** Changes email. Requires current password. Sends verification to new email. */
  const changeEmail = async (currentPassword: string, newEmail: string): Promise<void> => {
    if (!token) throw new Error('Not authenticated');
    await apiFetch('/auth/change-email', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newEmail }),
    }, token);
    setUser((prev) => prev ? { ...prev, email: newEmail.toLowerCase().trim(), emailVerified: false } : prev);
  };

  return (
    <AuthContext.Provider
      value={{
        user, isLoading, token,
        login, register, logout, updateUser,
        upgradeToPremium, updateSubscription, cancelSubscription, becomeCoach,
        forgotPassword, resetPassword, sendVerification, verifyEmail,
        signOutAll, changePassword, changeEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
