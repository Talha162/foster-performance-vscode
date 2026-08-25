import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';

type TargetMuscleAvatarProps = {
  muscleGroup?: string;
  size?: number;
  accent?: string;
};

/**
 * A deliberately lightweight, non-medical body map for quickly scanning
 * which area an exercise emphasizes. It uses the existing exercise metadata
 * so it remains useful even when a program does not have custom imagery.
 */
export function TargetMuscleAvatar({
  muscleGroup = 'Full Body',
  size = 52,
  accent,
}: TargetMuscleAvatarProps) {
  const colors = useColors();
  const highlight = accent ?? colors.primary;
  const muted = colors.mutedForeground;
  const group = muscleGroup.toLowerCase();
  const fullBody = group.includes('full body') || group.includes('cardio');
  const targets = {
    chest: fullBody || group.includes('chest') || group.includes('push'),
    back: fullBody || group.includes('back') || group.includes('lat'),
    shoulders: fullBody || group.includes('shoulder'),
    arms: fullBody || group.includes('arm') || group.includes('bicep') || group.includes('tricep'),
    core: fullBody || group.includes('core') || group.includes('abs'),
    glutes: fullBody || group.includes('glute'),
    quads: fullBody || group.includes('quad') || group.includes('leg'),
    hamstrings: fullBody || group.includes('hamstring'),
    calves: fullBody || group.includes('calf'),
  };

  const fill = (active: boolean) => (active ? highlight : colors.card);

  return (
    <View accessible accessibilityLabel={`Target muscles: ${muscleGroup}`} style={styles.wrapper}>
      <Svg width={size} height={size * 1.48} viewBox="0 0 100 148" fill="none">
        <G stroke={muted} strokeWidth={1.4} strokeLinejoin="round">
          <Circle cx="50" cy="13" r="8" fill={colors.card} />
          <Path
            d="M39 27c4-3 7-4 11-4s7 1 11 4l5 28-8 4-2-15v31l-5 9-5-9V44l-2 15-8-4 5-28Z"
            fill={fill(targets.core || targets.chest || targets.back)}
          />
          <Path d="M40 29 29 34 22 58l7 3 9-19" fill={fill(targets.shoulders || targets.arms)} />
          <Path d="m60 29 11 5 7 24-7 3-9-19" fill={fill(targets.shoulders || targets.arms)} />
          <Path d="M22 58 20 83l6 1 3-23" fill={fill(targets.arms)} />
          <Path d="m78 58 2 25-6 1-3-23" fill={fill(targets.arms)} />
          <Path d="M40 75h9l-2 31-7 26-7-1 5-28Z" fill={fill(targets.quads || targets.glutes)} />
          <Path d="M51 75h9l2 27 5 28-7 1-7-26Z" fill={fill(targets.quads || targets.glutes)} />
          <Path d="m33 131 7 1-2 12-8-1Z" fill={fill(targets.calves)} />
          <Path d="m60 132 7-1 3 12-8 1Z" fill={fill(targets.calves)} />
          <Rect x="41" y="29" width="18" height="16" rx="7" fill={fill(targets.chest)} />
          <Rect x="43" y="45" width="14" height="21" rx="5" fill={fill(targets.core)} />
          <Path d="M41 67c3 4 6 6 9 6s6-2 9-6" fill={fill(targets.glutes)} />
          <Path d="M44 29h12" stroke={highlight} opacity={targets.chest ? 0.8 : 0.25} />
        </G>
      </Svg>
      <Text style={[styles.label, { color: highlight }]} numberOfLines={1}>
        {muscleGroup}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', width: 56, flexShrink: 0 },
  label: { fontSize: 8, fontFamily: 'Inter_600SemiBold', textAlign: 'center', marginTop: 2 },
});