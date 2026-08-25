import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useFonts } from '@expo-google-fonts/inter/useFonts';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import { FPScoreProvider } from '@/context/FPScoreContext';
import { MessagingProvider } from '@/context/MessagingContext';
import { NutritionProvider } from '@/context/NutritionContext';
import { LeaderboardProvider } from '@/context/LeaderboardContext';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(coach-tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(admin-tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="coach-application" options={{ headerShown: false, presentation: 'card', gestureEnabled: false }} />
      <Stack.Screen name="coach-application-status" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen
        name="workout/[id]"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="nutrition-plan/[id]"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="coaches"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="coach/[id]"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="rehab"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="subscription"
        options={{ headerShown: false, presentation: 'modal' }}
      />
      <Stack.Screen
        name="subscription-checkout"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="billing-settings"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="book-session"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="session-confirmation"
        options={{ headerShown: false, presentation: 'card', gestureEnabled: false }}
      />
      <Stack.Screen
        name="video-call"
        options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }}
      />
      <Stack.Screen
        name="onboarding"
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="fp-score"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="become-coach-intro"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="credential-upload"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="payout-settings"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="coach-subscription"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="coach-billing-settings"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="messages"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="message-thread"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="change-password"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="profile-edit"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="notifications"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="privacy-policy"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="nutrition-recipe/[id]"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="log-food"
        options={{ headerShown: false, presentation: 'modal' }}
      />
      <Stack.Screen
        name="nutrition-onboarding"
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="leaderboard"
        options={{ headerShown: false, presentation: 'card' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...MaterialCommunityIcons.font,
    ...Feather.font,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <AppProvider>
                  <NutritionProvider>
                    <LeaderboardProvider>
                    <MessagingProvider>
                      <FPScoreProvider>
                        <RootLayoutNav />
                      </FPScoreProvider>
                    </MessagingProvider>
                    </LeaderboardProvider>
                  </NutritionProvider>
                </AppProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
