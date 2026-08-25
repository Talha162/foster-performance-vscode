import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';

export type BodyView = 'front' | 'back';

export type MuscleRegion =
  | 'chest'
  | 'shoulders'
  | 'arms'
  | 'upperBack'
  | 'lowerBack'
  | 'core'
  | 'hips'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves';

type TargetMuscleAvatarProps = {
  muscleGroup?: string;
  size?: number;
  accent?: string;
  view?: BodyView;
  showLabel?: boolean;
};

type TargetMuscleMapProps = {
  muscleGroups: string[];
  accent?: string;
};

const ALL_REGIONS: MuscleRegion[] = [
  'chest', 'shoulders', 'arms', 'upperBack', 'lowerBack', 'core',
  'hips', 'glutes', 'quads', 'hamstrings', 'calves',
];

const matches = (value: string, terms: string[]) => terms.some((term) => value.includes(term));

/**
 * Converts the app's existing exercise metadata into display regions. This is
 * deliberately frontend-only and can be replaced by API-provided region IDs later.
 */
export function resolveMuscleRegions(muscleGroup = ''): MuscleRegion[] {
  const value = muscleGroup.toLowerCase().replace(/[–—]/g, '-');
  if (!value.trim()) return [];
  if (matches(value, ['full body', 'full-body'])) return ALL_REGIONS;

  const regions = new Set<MuscleRegion>();
  const add = (region: MuscleRegion, terms: string[]) => {
    if (matches(value, terms)) regions.add(region);
  };

  add('chest', ['chest', 'pectoral']);
  add('shoulders', ['shoulder', 'deltoid', 'rotator cuff', 'rear delt']);
  add('arms', ['arm', 'bicep', 'tricep', 'forearm']);
  add('upperBack', ['upper back', 'thoracic', 't-spine', 'lat', 'teres', 'rotator cuff']);
  add('lowerBack', ['lower back', 'lumbar', 'spine']);
  add('core', ['core', 'abdominal', 'abs', 'oblique', 'anti-rotation', 'stability']);
  add('hips', ['hip', 'adductor', 'it band', 'lateral leg']);
  add('glutes', ['glute']);
  add('quads', ['quad', 'knee', 'anterior leg']);
  add('hamstrings', ['hamstring']);
  add('calves', ['calf', 'calves', 'achilles', 'ankle', 'lower leg']);

  if (matches(value, ['back']) && !regions.has('upperBack') && !regions.has('lowerBack')) {
    regions.add('upperBack');
    regions.add('lowerBack');
  }
  if (matches(value, ['posterior chain'])) {
    regions.add('upperBack');
    regions.add('lowerBack');
    regions.add('glutes');
    regions.add('hamstrings');
    regions.add('calves');
  }
  if (matches(value, ['legs'])) {
    regions.add('quads');
    regions.add('hamstrings');
    regions.add('calves');
  }
  if (matches(value, ['cardio', 'running', 'aerobic', 'endurance', 'speed', 'acceleration'])) {
    regions.add('core');
    regions.add('quads');
    regions.add('hamstrings');
    regions.add('calves');
  }
  if (matches(value, ['power'])) {
    regions.add('core');
    regions.add('glutes');
    regions.add('quads');
    regions.add('hamstrings');
  }
  if (matches(value, ['mobility', 'recovery', 'circulation', 'connective tissue', 'nervous system'])) {
    regions.add('shoulders');
    regions.add('core');
    regions.add('hips');
    regions.add('quads');
    regions.add('hamstrings');
  }

  return Array.from(regions);
}

export function getPreferredBodyView(muscleGroup = ''): BodyView {
  const regions = resolveMuscleRegions(muscleGroup);
  const backScore = ['upperBack', 'lowerBack', 'glutes', 'hamstrings'].filter((region) =>
    regions.includes(region as MuscleRegion)
  ).length;
  const frontScore = ['chest', 'core', 'quads'].filter((region) =>
    regions.includes(region as MuscleRegion)
  ).length;
  return backScore > frontScore ? 'back' : 'front';
}

function BodySvg({
  active,
  size,
  accent,
  view,
}: {
  active: Set<MuscleRegion>;
  size: number;
  accent: string;
  view: BodyView;
}) {
  const colors = useColors();
  const outline = colors.mutedForeground;
  const resting = colors.muted;
  const fill = (region: MuscleRegion) => (active.has(region) ? accent : resting);
  const opacity = (region: MuscleRegion) => (active.has(region) ? 1 : 0.65);

  return (
    <Svg width={size} height={size * 1.62} viewBox="0 0 100 162" fill="none">
      <G stroke={outline} strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round">
        <Circle cx="50" cy="12" r="8" fill={resting} />
        <Path d="M43 21h14l4 8-4 8H43l-4-8 4-8Z" fill={resting} />

        <Path d="M39 27 27 34 20 58l8 3 10-20Z" fill={fill('shoulders')} opacity={opacity('shoulders')} />
        <Path d="m61 27 12 7 7 24-8 3-10-20Z" fill={fill('shoulders')} opacity={opacity('shoulders')} />
        <Path d="m20 58-2 27 8 1 2-25Z" fill={fill('arms')} opacity={opacity('arms')} />
        <Path d="m80 58 2 27-8 1-2-25Z" fill={fill('arms')} opacity={opacity('arms')} />

        {view === 'front' ? (
          <>
            <Path d="M39 28c7-4 15-4 22 0l-2 22H41l-2-22Z" fill={fill('chest')} opacity={opacity('chest')} />
            <Path d="M41 50h18l-2 27-7 7-7-7-2-27Z" fill={fill('core')} opacity={opacity('core')} />
            <Path d="M43 77h14l4 9-11 6-11-6 4-9Z" fill={fill('hips')} opacity={opacity('hips')} />
            <Path d="M39 86h11l-3 35-10 16-7-3 7-31Z" fill={fill('quads')} opacity={opacity('quads')} />
            <Path d="M50 86h11l2 17 7 31-7 3-10-16Z" fill={fill('quads')} opacity={opacity('quads')} />
          </>
        ) : (
          <>
            <Path d="M39 28c7-4 15-4 22 0l-2 29H41l-2-29Z" fill={fill('upperBack')} opacity={opacity('upperBack')} />
            <Path d="M41 57h18l-2 20-7 7-7-7-2-20Z" fill={fill('lowerBack')} opacity={opacity('lowerBack')} />
            <Path d="M43 77h14l4 10-11 7-11-7 4-10Z" fill={fill('glutes')} opacity={opacity('glutes')} />
            <Path d="M39 88h11l-3 33-10 16-7-3 7-31Z" fill={fill('hamstrings')} opacity={opacity('hamstrings')} />
            <Path d="M50 88h11l2 15 7 31-7 3-10-16Z" fill={fill('hamstrings')} opacity={opacity('hamstrings')} />
          </>
        )}

        <Path d="m30 134 7 3 1 20h-9Z" fill={fill('calves')} opacity={opacity('calves')} />
        <Path d="m63 137 7-3 1 23h-9Z" fill={fill('calves')} opacity={opacity('calves')} />
        <Path d="M29 157h10" />
        <Path d="M61 157h10" />
      </G>
    </Svg>
  );
}

export const TargetMuscleAvatar = memo(function TargetMuscleAvatar({
  muscleGroup = 'Full Body',
  size = 52,
  accent,
  view,
  showLabel = true,
}: TargetMuscleAvatarProps) {
  const colors = useColors();
  const highlight = accent ?? colors.primary;
  const selectedView = view ?? getPreferredBodyView(muscleGroup);
  const regions = useMemo(() => new Set(resolveMuscleRegions(muscleGroup)), [muscleGroup]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${selectedView} body view. Target muscles: ${muscleGroup}`}
      style={[styles.avatar, { width: Math.max(size + 8, 54) }]}
    >
      <BodySvg active={regions} size={size} accent={highlight} view={selectedView} />
      {showLabel && (
        <Text style={[styles.avatarLabel, { color: highlight }]} numberOfLines={2}>
          {selectedView === 'front' ? 'Front' : 'Back'} · {muscleGroup}
        </Text>
      )}
    </View>
  );
});

export const TargetMuscleMap = memo(function TargetMuscleMap({
  muscleGroups,
  accent,
}: TargetMuscleMapProps) {
  const colors = useColors();
  const highlight = accent ?? colors.primary;
  const combined = muscleGroups.filter(Boolean).join(' / ') || 'Full Body';
  const regions = useMemo(() => resolveMuscleRegions(combined), [combined]);
  const active = useMemo(() => new Set(regions), [regions]);
  const labels = useMemo(
    () => Array.from(new Set(muscleGroups.filter((label) => label && label !== '—'))).slice(0, 6),
    [muscleGroups]
  );

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Program target areas: ${labels.join(', ') || 'Full Body'}`}
      style={[styles.mapCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.viewsRow}>
        {(['front', 'back'] as const).map((bodyView) => (
          <View key={bodyView} style={styles.mapView}>
            <BodySvg active={active} size={82} accent={highlight} view={bodyView} />
            <Text style={[styles.viewLabel, { color: colors.mutedForeground }]}>
              {bodyView === 'front' ? 'FRONT' : 'BACK'}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: highlight }]} />
        <Text style={[styles.legendText, { color: colors.foreground }]}>Primary target areas</Text>
      </View>
      <View style={styles.chips}>
        {(labels.length ? labels : ['Full Body']).map((label) => (
          <View key={label} style={[styles.chip, { backgroundColor: highlight + '18', borderColor: highlight + '45' }]}>
            <Text style={[styles.chipText, { color: highlight }]} numberOfLines={1}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', flexShrink: 0 },
  avatarLabel: {
    fontSize: 8,
    lineHeight: 10,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    marginTop: 2,
  },
  mapCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  viewsRow: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-start' },
  mapView: { alignItems: 'center', minWidth: 104 },
  viewLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1, marginTop: 4 },
  legend: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  chip: { maxWidth: '100%', borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5 },
  chipText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
});
