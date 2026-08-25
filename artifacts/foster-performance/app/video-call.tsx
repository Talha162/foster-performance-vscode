import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';

function useTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function VideoCallScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { coachName, coachInitials, coachColor, sessionLength } = useLocalSearchParams<{
    coachId: string;
    coachName: string;
    coachInitials: string;
    coachColor: string;
    sessionLength: string;
  }>();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [connecting, setConnecting] = useState(true);

  const timer = useTimer();
  const dotOpacity = useRef(new Animated.Value(1)).current;
  const color = coachColor ?? '#2F80FF';

  // Connecting animation
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(dotOpacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(dotOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    const t = setTimeout(() => {
      setConnecting(false);
      anim.stop();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 2000);
    return () => {
      clearTimeout(t);
      anim.stop();
    };
  }, []);

  const handleEnd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.root}>
      <BackgroundLayer />
      {/* Header bar */}
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <View style={styles.callInfo}>
          {connecting ? (
            <Animated.View style={[styles.connectDot, { backgroundColor: '#D6A84B', opacity: dotOpacity }]} />
          ) : (
            <View style={[styles.connectDot, { backgroundColor: '#35C98A' }]} />
          )}
          <Text style={styles.callStatus}>
            {connecting ? 'Connecting...' : timer}
          </Text>
        </View>
        {sessionLength && !connecting && (
          <View style={[styles.sessionBadge, { backgroundColor: color + '30', borderColor: color + '60' }]}>
            <MaterialCommunityIcons name="timer-outline" size={12} color={color} />
            <Text style={[styles.sessionBadgeText, { color }]}>{sessionLength} min session</Text>
          </View>
        )}
      </View>

      {/* Coach video area */}
      <View style={styles.coachVideo}>
        {connecting ? (
          <View style={styles.connectingOverlay}>
            <View style={[styles.coachAvatar, { backgroundColor: color + '30', borderColor: color + '60' }]}>
              <Text style={[styles.coachInitials, { color }]}>{coachInitials}</Text>
            </View>
            <Animated.Text style={[styles.connectingText, { opacity: dotOpacity }]}>
              Connecting to {coachName}...
            </Animated.Text>
          </View>
        ) : (
          <>
              {/* Deliberate preview panel until a live video provider is connected. */}
            <View style={[styles.coachVideoPlaceholder, { backgroundColor: '#171A21' }]}>
              <View style={[styles.coachAvatarLarge, { backgroundColor: color + '20', borderColor: color + '40', borderWidth: 2 }]}>
                <Text style={[styles.coachInitialsLarge, { color }]}>{coachInitials}</Text>
              </View>
              <Text style={styles.coachVideoName}>{coachName}</Text>
              <Text style={styles.coachVideoTitle}>Session preview · Live video coming soon</Text>
            </View>

            {/* Network indicator */}
            <View style={styles.networkBadge}>
              <MaterialCommunityIcons name="wifi" size={12} color="#35C98A" />
            <Text style={styles.networkText}>Preview</Text>
            </View>
          </>
        )}
      </View>

      {/* Self-view (picture-in-picture) */}
      {!connecting && (
        <View style={styles.selfView}>
          {cameraOff ? (
            <View style={[styles.selfViewOff, { backgroundColor: '#1E2028' }]}>
              <MaterialCommunityIcons name="camera-off" size={20} color="#9AA3B0" />
            </View>
          ) : (
            <View style={[styles.selfViewOn, { backgroundColor: '#171A21' }]}>
              <MaterialCommunityIcons name="account" size={32} color="#2A3040" />
            </View>
          )}
          <Text style={styles.selfLabel}>You</Text>
        </View>
      )}

      {/* Controls */}
      <View style={[styles.controls, { paddingBottom: botPad + 20 }]}>
        {/* Session notes */}
        {!connecting && (
          <Text style={styles.notesHint}>
            Preview controls are available now. Live video, chat, and screen sharing will activate when secure calling is connected.
          </Text>
        )}

        <View style={styles.controlRow}>
          {/* Mute */}
          <ControlButton
            icon={muted ? 'microphone-off' : 'microphone'}
            label={muted ? 'Unmute' : 'Mute'}
            active={!muted}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setMuted((m) => !m);
            }}
          />

          {/* End Call — center, red */}
          <Pressable
            onPress={handleEnd}
            style={({ pressed }) => [
              styles.endCallBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <MaterialCommunityIcons name="phone-hangup" size={28} color="#FFFFFF" />
          </Pressable>

          {/* Camera */}
          <ControlButton
            icon={cameraOff ? 'camera-off' : 'camera'}
            label={cameraOff ? 'Camera On' : 'Camera Off'}
            active={!cameraOff}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setCameraOff((c) => !c);
            }}
          />
        </View>

        <View style={styles.secondaryRow}>
          {/* Speaker */}
          <ControlButton
            icon={speakerOn ? 'volume-high' : 'volume-off'}
            label="Speaker"
            small
            active={speakerOn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSpeakerOn((s) => !s);
            }}
          />
          {/* Chat and sharing are intentionally unavailable until secure calling is connected. */}
          <ControlButton
            icon="chat-outline"
            label="Chat soon"
            small
            active={false}
            disabled
            onPress={() => Alert.alert('Coming soon', 'In-session chat will be available with secure live calling.')}
          />
          <ControlButton
            icon="monitor-share"
            label="Share soon"
            small
            active={false}
            disabled
            onPress={() => Alert.alert('Coming soon', 'Screen sharing will be available with secure live calling.')}
          />
        </View>
      </View>
    </View>
  );
}

function ControlButton({
  icon, label, active, onPress, small, disabled,
}: {
  icon: string; label: string; active: boolean; onPress: () => void; small?: boolean; disabled?: boolean;
}) {
  const size = small ? 48 : 60;
  const iconSize = small ? 20 : 24;
  return (
    <View style={styles.controlBtnWrap}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        style={({ pressed }) => [
          styles.controlBtn,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
            borderColor: active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
            opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={icon as any}
          size={iconSize}
          color={active ? '#FFFFFF' : '#666'}
        />
      </Pressable>
      <Text style={[styles.controlLabel, { fontSize: small ? 9 : 11 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  callInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  connectDot: { width: 10, height: 10, borderRadius: 5 },
  callStatus: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF' },
  sessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  sessionBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  coachVideo: {
    flex: 1,
    backgroundColor: '#0D0F14',
    position: 'relative',
  },
  connectingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  coachAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  coachInitials: { fontSize: 36, fontFamily: 'Inter_700Bold' },
  connectingText: { fontSize: 16, fontFamily: 'Inter_400Regular', color: '#AAAAAA' },
  coachVideoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  coachAvatarLarge: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachInitialsLarge: { fontSize: 48, fontFamily: 'Inter_700Bold' },
  coachVideoName: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  coachVideoTitle: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#888' },
  networkBadge: {
    position: 'absolute',
    top: 60,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  networkText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: '#35C98A' },
  selfView: {
    position: 'absolute',
    top: 90,
    right: 16,
    alignItems: 'center',
    gap: 4,
    zIndex: 5,
  },
  selfViewOff: {
    width: 88,
    height: 116,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1E2330',
  },
  selfViewOn: {
    width: 88,
    height: 116,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1E2330',
  },
  selfLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: '#888' },
  controls: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingTop: 16,
    paddingHorizontal: 24,
    gap: 14,
  },
  notesHint: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    textAlign: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  endCallBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  controlBtnWrap: { alignItems: 'center', gap: 6 },
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  controlLabel: { fontFamily: 'Inter_400Regular', color: '#888' },
});
