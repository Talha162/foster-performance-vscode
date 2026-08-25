import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  const [phase, setPhase] = useState<'pre' | 'call' | 'post' | 'error'>('pre');
  const [permission, setPermission] = useState<'ready' | 'denied'>('ready');
  const [errorKind, setErrorKind] = useState<'connection' | 'unavailable' | 'expired'>('connection');

  const timer = useTimer();
  const dotOpacity = useRef(new Animated.Value(1)).current;
  const color = coachColor ?? '#2F80FF';

  // Connecting animation
  useEffect(() => {
    if (phase !== 'call' || !connecting) return;
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
  }, [phase, connecting]);

  const handleEnd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPhase('post');
  };

  if (phase === 'pre') {
    return <View style={styles.root}><BackgroundLayer /><ScrollView contentContainerStyle={[styles.lifecycle, { paddingTop: topPad + 18, paddingBottom: botPad + 24 }]}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Leave session lobby" style={styles.lifecycleBack}><MaterialCommunityIcons name="arrow-left" size={24} color="#FFF" /></Pressable>
      <View style={styles.lifecycleHead}><Text style={styles.eyebrow}>SESSION LOBBY · FRONTEND PREVIEW</Text><Text style={styles.lifecycleTitle}>Ready to join?</Text><Text style={styles.lifecycleSub}>{coachName ?? 'Your coach'} · {sessionLength ?? '60'} minute private session</Text></View>
      <View style={styles.preview}><View style={[styles.coachAvatarLarge, { backgroundColor: color + '20', borderColor: color + '55', borderWidth: 2 }]}><MaterialCommunityIcons name={cameraOff ? 'camera-off' : 'account'} size={52} color={cameraOff ? '#9AA3B0' : color} /></View><Text style={styles.previewLabel}>{cameraOff ? 'Camera is off' : 'Camera preview placeholder'}</Text></View>
      {permission === 'denied' && <View style={styles.permissionError}><MaterialCommunityIcons name="shield-alert" size={22} color="#FF5D6C" /><View style={{ flex: 1 }}><Text style={styles.errorTitle}>Camera or microphone permission denied</Text><Text style={styles.errorCopy}>Enable access in device settings before joining. You can still return safely.</Text></View></View>}
      <View style={styles.deviceCard}>
        <LobbyRow icon={muted ? 'microphone-off' : 'microphone'} label="Microphone" value={muted ? 'Off' : 'Ready'} onPress={() => setMuted(!muted)} />
        <LobbyRow icon={cameraOff ? 'camera-off' : 'camera'} label="Camera" value={cameraOff ? 'Off' : 'Ready'} onPress={() => setCameraOff(!cameraOff)} />
        <LobbyRow icon={speakerOn ? 'volume-high' : 'volume-off'} label="Speaker output" value={speakerOn ? 'Device speaker' : 'Muted'} onPress={() => setSpeakerOn(!speakerOn)} />
      </View>
      <View style={styles.timeNotice}><MaterialCommunityIcons name="clock-check-outline" size={20} color="#35C98A" /><Text style={styles.timeNoticeText}>Session is available now. The production join window will be validated by the booking service.</Text></View>
      <Pressable disabled={permission === 'denied'} onPress={() => { setConnecting(true); setPhase('call'); }} style={[styles.joinButton, { opacity: permission === 'denied' ? .45 : 1 }]} accessibilityRole="button" accessibilityLabel="Join video session"><MaterialCommunityIcons name="video" size={20} color="#FFF" /><Text style={styles.joinText}>Join session</Text></Pressable>
      <View style={styles.previewActions}><Pressable onPress={() => setPermission(permission === 'ready' ? 'denied' : 'ready')} style={styles.previewAction}><Text style={styles.previewActionText}>{permission === 'ready' ? 'Preview permission denied' : 'Restore device preview'}</Text></Pressable><Pressable onPress={() => { setErrorKind('unavailable'); setPhase('error'); }} style={styles.previewAction}><Text style={styles.previewActionText}>Preview unavailable state</Text></Pressable></View>
    </ScrollView></View>;
  }

  if (phase === 'error') {
    const errorCopy = errorKind === 'connection' ? ['Connection lost', 'We could not maintain a secure session. Check your network and try reconnecting.'] : errorKind === 'expired' ? ['Session expired', 'This session link is no longer valid. Return to the booking details for support options.'] : ['Session unavailable', 'The session cannot be joined right now. It may not have started, may have ended, or may require booking verification.'];
    return <View style={styles.root}><BackgroundLayer /><View style={[styles.centerState, { paddingTop: topPad, paddingBottom: botPad }]}><View style={styles.stateIcon}><MaterialCommunityIcons name="video-off-outline" size={42} color="#FF5D6C" /></View><Text style={styles.lifecycleTitle}>{errorCopy[0]}</Text><Text style={[styles.lifecycleSub, { textAlign: 'center' }]}>{errorCopy[1]}</Text><Pressable onPress={() => { setConnecting(true); setPhase('call'); }} style={styles.joinButton}><MaterialCommunityIcons name="reload" size={19} color="#FFF" /><Text style={styles.joinText}>Reconnect</Text></Pressable><Pressable onPress={() => setPhase('pre')} style={styles.previewAction}><Text style={styles.previewActionText}>Return to device check</Text></Pressable><Pressable onPress={() => setErrorKind(errorKind === 'unavailable' ? 'expired' : 'unavailable')} style={styles.previewAction}><Text style={styles.previewActionText}>Preview another error</Text></Pressable></View></View>;
  }

  if (phase === 'post') {
    return <View style={styles.root}><BackgroundLayer /><View style={[styles.centerState, { paddingTop: topPad, paddingBottom: botPad }]}><View style={[styles.stateIcon, { borderColor: '#35C98A55' }]}><MaterialCommunityIcons name="check" size={42} color="#35C98A" /></View><Text style={styles.eyebrow}>SESSION COMPLETED</Text><Text style={styles.lifecycleTitle}>Call ended</Text><Text style={[styles.lifecycleSub, { textAlign: 'center' }]}>Your session with {coachName ?? 'your coach'} is complete. Notes and attendance will sync after the production video service is connected.</Text><Pressable onPress={() => router.replace('/(tabs)')} style={styles.joinButton}><Text style={styles.joinText}>Return home</Text></Pressable><View style={styles.postRow}><Pressable onPress={() => Alert.alert('Issue report preview', 'The support flow will include call diagnostics once an RTC provider is connected.')} style={styles.previewAction}><Text style={styles.previewActionText}>Report issue</Text></Pressable><Pressable onPress={() => router.push('/messages')} style={styles.previewAction}><Text style={styles.previewActionText}>Contact support</Text></Pressable></View></View></View>;
  }

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
            <Pressable onPress={() => { setErrorKind('connection'); setPhase('error'); }} accessibilityRole="button" accessibilityLabel="Preview connection lost state" style={styles.connectionPreview}><Text style={styles.networkText}>Preview reconnecting</Text></Pressable>
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

function LobbyRow({ icon, label, value, onPress }: { icon: string; label: string; value: string; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="switch" style={styles.lobbyRow}><View style={styles.lobbyIcon}><MaterialCommunityIcons name={icon as any} size={21} color="#2F80FF" /></View><View style={{ flex: 1 }}><Text style={styles.lobbyLabel}>{label}</Text><Text style={styles.lobbyValue}>{value}</Text></View><MaterialCommunityIcons name="chevron-right" size={20} color="#9AA3B0" /></Pressable>;
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
  lifecycle: { flexGrow: 1, paddingHorizontal: 20, gap: 15 }, lifecycleBack: { width: 44, height: 44, justifyContent: 'center' }, lifecycleHead: { gap: 5 }, eyebrow: { color: '#2F80FF', fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: .8 }, lifecycleTitle: { color: '#FFF', fontSize: 28, fontFamily: 'Inter_700Bold' }, lifecycleSub: { color: '#9AA3B0', fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 21 },
  preview: { minHeight: 230, backgroundColor: '#171A21', borderWidth: 1, borderColor: '#2A3040', borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 12 }, previewLabel: { color: '#9AA3B0', fontSize: 12, fontFamily: 'Inter_500Medium' },
  deviceCard: { backgroundColor: '#171A21', borderWidth: 1, borderColor: '#2A3040', borderRadius: 16, paddingHorizontal: 14 }, lobbyRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2A3040' }, lobbyIcon: { width: 40, height: 40, borderRadius: 11, backgroundColor: '#2F80FF18', alignItems: 'center', justifyContent: 'center' }, lobbyLabel: { color: '#FFF', fontSize: 14, fontFamily: 'Inter_600SemiBold' }, lobbyValue: { color: '#9AA3B0', fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  timeNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: '#35C98A12', borderColor: '#35C98A55', borderWidth: 1, borderRadius: 12, padding: 12 }, timeNoticeText: { color: '#C6CFDC', fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular', flex: 1 }, joinButton: { minHeight: 52, backgroundColor: '#2F80FF', borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 20 }, joinText: { color: '#FFF', fontSize: 15, fontFamily: 'Inter_700Bold' },
  previewActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }, previewAction: { minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }, previewActionText: { color: '#9AA3B0', fontSize: 12, fontFamily: 'Inter_600SemiBold' }, permissionError: { flexDirection: 'row', gap: 10, backgroundColor: '#FF5D6C12', borderColor: '#FF5D6C55', borderWidth: 1, borderRadius: 12, padding: 12 }, errorTitle: { color: '#FFF', fontSize: 13, fontFamily: 'Inter_700Bold' }, errorCopy: { color: '#9AA3B0', fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17, marginTop: 2 },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28, gap: 14 }, stateIcon: { width: 82, height: 82, borderRadius: 41, borderWidth: 1, borderColor: '#FF5D6C55', backgroundColor: '#171A21', alignItems: 'center', justifyContent: 'center' }, postRow: { flexDirection: 'row', gap: 10 }, connectionPreview: { position: 'absolute', top: 104, left: 12, minHeight: 34, justifyContent: 'center', backgroundColor: '#0009', paddingHorizontal: 9, borderRadius: 8 },
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
