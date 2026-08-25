import React from 'react';
import { Redirect } from 'expo-router';
import { AccountType, useAuth } from '@/context/AuthContext';
import { ScreenState } from '@/components/ScreenState';

type RoleGateProps = {
  allow: AccountType[];
  children: React.ReactNode;
};

/** UX-level route protection. Server authorization remains authoritative. */
export function RoleGate({ allow, children }: RoleGateProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <ScreenState title="Loading your workspace" message="Checking your account access…" loading />;
  }
  if (!user) return <Redirect href="/(auth)/welcome" />;
  if (!allow.includes(user.accountType)) return <Redirect href="/" />;
  return <>{children}</>;
}
