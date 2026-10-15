import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type AccountType = 'member' | 'coach_applicant' | 'coach' | 'owner_admin';
export type SubscriptionStatus = 'active' | 'trial' | 'pending' | 'past_due' | 'canceled' | 'expired';

export interface User {
  id: string;
  name: string;
  email: string;
  accountType: AccountType;
  avatarUrl?: string;
  onboardingComplete?: boolean;
  goal?: string;
  level?: 'Beginner' | 'Intermediate' | 'Advanced';
  applicationStatus?: string;
  emailVerified?: boolean;
  isPremium: boolean;
  subscriptionStatus?: SubscriptionStatus | null;
  subscriptionPlan?: 'monthly' | 'annual';
  subscriptionEndDate?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
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
  /** Address awaiting email confirmation, when signup produced no session. */
  pendingEmail: string | null;
  isLoading: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  /** Resolves true when the account was created but still needs email confirmation. */
  register: (name: string, email: string, password: string, accountType?: AccountType) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  upgradeToPremium: () => Promise<void>;
  updateSubscription: (update: SubscriptionUpdate) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  becomeCoach: () => Promise<void>;
  forgotPassword: (email: string) => Promise<string>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  sendVerification: () => Promise<void>;
  verifyEmail: (code: string) => Promise<void>;
  signOutAll: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  changeEmail: (currentPassword: string, newEmail: string) => Promise<void>;
}

type ProfileRow = {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: AccountType;
  onboarding_complete: boolean;
  goal: string | null;
  level: User['level'] | null;
  is_premium: boolean;
  subscription_status: SubscriptionStatus | null;
  subscription_plan: User['subscriptionPlan'] | null;
  subscription_end_date: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  streak_days: number;
  total_workouts: number;
  created_at: string;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function loadUser(authUser: SupabaseAuthUser): Promise<User> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .single();
  if (error) throw new Error(error.message);

  const profile = data as ProfileRow;
  let applicationStatus: string | undefined;
  if (profile.role === 'coach_applicant') {
    const result = await supabase
      .from('coach_applications')
      .select('status')
      .eq('user_id', profile.id)
      .maybeSingle();
    if (result.error) throw new Error(result.error.message);
    applicationStatus = result.data?.status;
  }

  return {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    accountType: profile.role,
    avatarUrl: profile.avatar_url ?? undefined,
    onboardingComplete: profile.onboarding_complete,
    goal: profile.goal ?? undefined,
    level: profile.level ?? undefined,
    applicationStatus,
    emailVerified: Boolean(authUser.email_confirmed_at),
    isPremium: profile.is_premium,
    subscriptionStatus: profile.subscription_status,
    subscriptionPlan: profile.subscription_plan ?? undefined,
    subscriptionEndDate: profile.subscription_end_date ?? undefined,
    stripeCustomerId: profile.stripe_customer_id ?? undefined,
    stripeSubscriptionId: profile.stripe_subscription_id ?? undefined,
    streakDays: profile.streak_days,
    totalWorkouts: profile.total_workouts,
    joinDate: profile.created_at,
  };
}

const profileColumns: Partial<Record<keyof User, keyof ProfileRow>> = {
  name: 'full_name',
  email: 'email',
  avatarUrl: 'avatar_url',
  onboardingComplete: 'onboarding_complete',
  goal: 'goal',
  level: 'level',
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  // Set when a signup completes without a session because the project requires
  // email confirmation. There is no signed-in user to read an address from at
  // that point, so the verification screen needs it from here.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async (authUser?: SupabaseAuthUser | null) => {
    const activeUser = authUser ?? (await supabase.auth.getUser()).data.user;
    if (!activeUser) {
      setUser(null);
      return;
    }
    setUser(await loadUser(activeUser));
  }, []);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(async ({ data, error }) => {
      try {
        if (error) throw error;
        if (!mounted) return;
        setToken(data.session?.access_token ?? null);
        if (data.session?.user) await refreshUser(data.session.user);
      } finally {
        if (mounted) setIsLoading(false);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? null);
      if (!session) setUser(null);
      else void refreshUser(session.user).catch(() => setUser(null));
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(error.message);
    setToken(data.session.access_token);
    setUser(await loadUser(data.user));
  }, []);

  const register = useCallback(async (
    name: string,
    email: string,
    password: string,
    accountType: AccountType = 'member',
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim(), account_type: accountType } },
    });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Supabase did not create the account.');

    // No session means the project has email confirmation switched on, so the
    // account exists but cannot act yet. Loading the profile here would run as
    // `anon` and come back "permission denied for table profiles", which is
    // what the user used to see instead of being told to check their email.
    if (!data.session) {
      setPendingEmail(email.trim());
      return true;
    }

    setToken(data.session.access_token);
    setUser(await loadUser(data.user));
    setPendingEmail(null);
    return false;
  }, []);

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    if (!user) throw new Error('You must be signed in.');
    const payload: Record<string, unknown> = {};
    for (const [key, column] of Object.entries(profileColumns)) {
      if (key in updates) payload[column] = updates[key as keyof User];
    }
    if (Object.keys(payload).length) {
      const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
      if (error) throw new Error(error.message);
    }
    if (updates.email && updates.email !== user.email) {
      const { error } = await supabase.auth.updateUser({ email: updates.email });
      if (error) throw new Error(error.message);
    }
    await refreshUser();
  }, [refreshUser, user]);

  const invokeBilling = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke('billing', { body: { action, ...payload } });
    if (error) throw new Error(error.message);
    await refreshUser();
    return data;
  }, [refreshUser]);

  const upgradeToPremium = useCallback(async () => {
    await invokeBilling('create-member-checkout', { plan: 'monthly' });
  }, [invokeBilling]);

  const updateSubscription = useCallback(async (update: SubscriptionUpdate) => {
    await invokeBilling('sync-subscription', { ...update });
  }, [invokeBilling]);

  const cancelSubscription = useCallback(async () => {
    await invokeBilling('cancel-member-subscription');
  }, [invokeBilling]);

  const becomeCoach = useCallback(async () => {
    const { error } = await supabase.rpc('start_coach_application');
    if (error) throw new Error(error.message);
    await refreshUser();
  }, [refreshUser]);

  const forgotPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'foster-performance://reset-password',
    });
    if (error) throw new Error(error.message);
    return 'Check your email for the password recovery code.';
  }, []);

  const resetPassword = useCallback(async (email: string, code: string, newPassword: string) => {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'recovery',
    });
    if (verifyError) throw new Error(verifyError.message);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  }, []);

  // Both of these run while nobody is signed in, so they fall back to the
  // address captured during signup rather than requiring a session.
  const sendVerification = useCallback(async () => {
    const email = user?.email ?? pendingEmail;
    if (!email) throw new Error('No account is awaiting verification.');
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw new Error(error.message);
  }, [pendingEmail, user]);

  const verifyEmail = useCallback(async (code: string) => {
    const email = user?.email ?? pendingEmail;
    if (!email) throw new Error('No account is awaiting verification.');
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    if (error) throw new Error(error.message);
    if (data.session) setToken(data.session.access_token);
    if (data.user) setUser(await loadUser(data.user));
    setPendingEmail(null);
  }, [pendingEmail, user]);

  const signOutAll = useCallback(async () => {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) throw new Error(error.message);
    setToken(null);
    setUser(null);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (!user) throw new Error('You must be signed in.');
    const verify = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (verify.error) throw new Error('Current password is incorrect.');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  }, [user]);

  const changeEmail = useCallback(async (currentPassword: string, newEmail: string) => {
    if (!user) throw new Error('You must be signed in.');
    const verify = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (verify.error) throw new Error('Current password is incorrect.');
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (error) throw new Error(error.message);
  }, [user]);

  const value = useMemo<AuthContextType>(() => ({
    user,
    pendingEmail,
    isLoading,
    token,
    login,
    register,
    logout,
    updateUser,
    upgradeToPremium,
    updateSubscription,
    cancelSubscription,
    becomeCoach,
    forgotPassword,
    resetPassword,
    sendVerification,
    verifyEmail,
    signOutAll,
    changePassword,
    changeEmail,
  }), [
    user, isLoading, token, login, register, logout, updateUser, upgradeToPremium,
    updateSubscription, cancelSubscription, becomeCoach, forgotPassword, resetPassword,
    sendVerification, verifyEmail, signOutAll, changePassword, changeEmail, pendingEmail,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
