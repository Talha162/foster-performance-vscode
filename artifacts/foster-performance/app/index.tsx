import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

export default function Index() {
  const { user, isLoading } = useAuth();
  const colors = useColors();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/welcome" />;

  switch (user.accountType) {
    case 'owner_admin':
      return <Redirect href="/(admin-tabs)" />;
    case 'coach':
      return <Redirect href="/(coach-tabs)" />;
    case 'coach_applicant':
      return <Redirect href="/coach-application-status" />;
    default: // member
      if (!user.onboardingComplete) return <Redirect href="/onboarding" />;
      return <Redirect href="/(tabs)" />;
  }
}
