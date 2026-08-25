import { router } from 'expo-router';
import { ScreenState } from '@/components/ScreenState';

export default function NotFoundScreen() {
  return (
    <ScreenState
      icon="map-marker-question-outline"
      title="Screen not found"
      message="This page may have moved or the link is no longer available. Return to your dashboard to keep training."
      onBack={() => router.canGoBack() ? router.back() : router.replace('/')}
      actionLabel="Go to Dashboard"
      onAction={() => router.replace('/')}
    />
  );
}
