import React from 'react';
import {
  Image,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';

export default function WelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  // "PERFORMANCE" is 11 chars. Empirical Inter Bold width per char ≈ fontSize * 0.748.
  // At letterSpacing LS each char takes (fontSize*0.748 + LS)px; total = 11*(fontSize*0.748 + LS).
  // With LS=3: fontSize ≤ (availableWidth - 33) / 8.23.  Cap at 38 (looks great, fits all sizes).
  const availableWidth = width - 48;
  const titleFontSize = Math.max(26, Math.min(38, Math.floor((availableWidth - 33) / 8.23)));
  const titleLetterSpacing = 3;

  const handleLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(auth)/login');
  };

  const handleRegister = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(auth)/register');
  };

  return (
    <View style={styles.root}>
      <BackgroundLayer />
      {/* Hero image area */}
      <ImageBackground
        source={require('@/assets/images/hero-banner.jpg')}
        style={[styles.hero, { paddingTop: topPad }]}
        resizeMode="cover"
      >
        <View style={styles.heroOverlay} />
        {/* Logo mark */}
        <Image
          source={require('@/assets/images/icon.png')}
          style={styles.logoMark}
          resizeMode="contain"
        />
        <Text style={[styles.heroTitle, { color: '#FFFFFF', fontSize: titleFontSize, letterSpacing: titleLetterSpacing }]}>
          FOSTER
        </Text>
        <Text style={[styles.heroTitle, { color: '#2472E3', fontSize: titleFontSize, letterSpacing: titleLetterSpacing }]}>
          PERFORMANCE
        </Text>
        <Text style={[styles.slogan, { color: '#9AA3B0' }]}>Fostering Better Performance</Text>
        {/* Feature pills */}
        <View style={styles.pills}>
          {['Workouts', 'Nutrition', 'Coaching', 'Recovery'].map((pill) => (
            <View key={pill} style={[styles.pill, { backgroundColor: 'rgba(47,128,255,0.10)', borderColor: 'rgba(47,128,255,0.22)' }]}>
              <Text style={[styles.pillText, { color: colors.primary }]}>{pill}</Text>
            </View>
          ))}
        </View>
      </ImageBackground>

      {/* CTA area */}
      <View style={[styles.cta, { backgroundColor: colors.background, paddingBottom: botPad + 16 }]}>
        <Pressable
          onPress={handleRegister}
          style={({ pressed }) => [
            styles.btnPrimary,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <MaterialCommunityIcons name="lightning-bolt" size={20} color={colors.primaryForeground} />
          <Text style={[styles.btnPrimaryText, { color: colors.primaryForeground }]}>Get Started Free</Text>
        </Pressable>
        <Pressable
          onPress={handleLogin}
          style={({ pressed }) => [
            styles.btnSecondary,
            { borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.btnSecondaryText, { color: colors.foreground }]}>Sign In</Text>
        </Pressable>
        <Text style={[styles.legal, { color: colors.mutedForeground }]}>
          By continuing you agree to our{' '}
          <Text
            style={[styles.legalLink, { color: colors.foreground }]}
            onPress={() => router.push('/privacy-policy')}
            accessibilityRole="link"
          >
            Terms &amp; Privacy Policy
          </Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  logoMark: {
    width: 80,
    height: 80,
    borderRadius: 18,
    marginBottom: 16,
  },
  goldBolt: {
    marginBottom: 8,
    marginTop: -4,
  },
  heroTitle: {
    fontFamily: 'Inter_700Bold',
    lineHeight: 52,
    textAlign: 'center',
  },
  slogan: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    letterSpacing: 2,
    marginTop: 8,
    marginBottom: 24,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.5,
  },
  cta: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 12,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 14,
  },
  btnPrimaryText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  btnSecondary: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  legal: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 4,
  },
  legalLink: {
    fontFamily: 'Inter_600SemiBold',
    textDecorationLine: 'underline',
  },
});
