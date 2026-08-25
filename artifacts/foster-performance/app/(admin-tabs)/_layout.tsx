/**
 * Owner Admin layout — Stack-based (7 sections is too many for a tab bar).
 * The index screen is the admin home with navigation cards.
 * All routes are protected: the backend enforces owner_admin via JWT.
 */
import { Stack } from 'expo-router';
import { RoleGate } from '@/components/RoleGate';

export default function AdminLayout() {
  return (
    <RoleGate allow={['owner_admin']}>
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="applications" />
      <Stack.Screen name="members" />
      <Stack.Screen name="coaches" />
      <Stack.Screen name="bookings" />
      <Stack.Screen name="payments" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="audit-log" />
      <Stack.Screen name="support" />
      <Stack.Screen name="engagement" />
      <Stack.Screen name="moderation" />
    </Stack>
    </RoleGate>
  );
}
