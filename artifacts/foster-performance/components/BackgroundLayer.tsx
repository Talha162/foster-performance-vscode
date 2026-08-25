import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BackgroundTexture } from './BackgroundTexture';
import { useColors } from '@/hooks/useColors';

/**
 * Drop-in first child for any screen root View.
 * Renders the solid background colour + the carbon-fibre texture at ~4% opacity,
 * both absolutely positioned so they never affect layout.
 *
 * Usage:
 *   <View style={styles.root}>
 *     <BackgroundLayer />
 *     {… screen content …}
 *   </View>
 */
export function BackgroundLayer() {
  const colors = useColors();
  return (
    <>
      <View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.background }]}
        pointerEvents="none"
      />
      <BackgroundTexture />
    </>
  );
}
