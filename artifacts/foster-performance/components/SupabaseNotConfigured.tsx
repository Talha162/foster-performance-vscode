import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Shown instead of the app when the Supabase environment variables are absent.
 *
 * Without this the app rendered nothing at all, because lib/supabase.ts threw
 * during module evaluation and no error boundary was mounted yet to catch it.
 * Anyone hitting it could only report that the app "wasn't connected", which
 * says nothing about the cause. Naming the variables makes it self-diagnosing.
 */
export function SupabaseNotConfigured() {
  const insets = useSafeAreaInsets();
  const missing = [
    !process.env.EXPO_PUBLIC_SUPABASE_URL && 'EXPO_PUBLIC_SUPABASE_URL',
    !process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY && 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  ].filter(Boolean) as string[];

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Foster Performance can&rsquo;t reach its backend</Text>
        <Text style={styles.body}>
          The app started, but the Supabase connection details were not supplied when it was built,
          so it cannot sign anyone in or load any data.
        </Text>

        <Text style={styles.heading}>Missing</Text>
        {missing.map((name) => (
          <Text key={name} style={styles.code}>{name}</Text>
        ))}

        <Text style={styles.heading}>How to fix it</Text>
        <Text style={styles.body}>
          Add both values as secrets in the environment running this app, then restart it.
          {Platform.OS === 'web' ? ' On Replit these go in Tools → Secrets.' : ''}
        </Text>
        <Text style={styles.note}>
          They are read when the app is bundled, not at runtime, so the server has to be restarted
          after adding them. Their values are in the project&rsquo;s .env.local file, which is not
          committed to git.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  content: { padding: 24, gap: 12 },
  title: { color: '#FFFFFF', fontSize: 22, fontFamily: 'Inter_700Bold', lineHeight: 29 },
  heading: { color: '#D6A84B', fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1, marginTop: 14, textTransform: 'uppercase' },
  body: { color: '#C9C9C9', fontSize: 15, lineHeight: 22, fontFamily: 'Inter_400Regular' },
  note: { color: '#8A8A8A', fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular', marginTop: 6 },
  code: { color: '#FFFFFF', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', backgroundColor: '#1C1C1C', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6 },
});
