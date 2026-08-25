import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

/**
 * Renders a barely-visible carbon-fiber weave pattern at ~4% opacity.
 * Must be inside a View with position:'relative' (or any View).
 * Use pointerEvents="none" so it never blocks touches.
 */
export function BackgroundTexture() {
  const { width, height } = useWindowDimensions();

  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFillObject}
      // @ts-ignore – pointerEvents is valid on RN-SVG root
      pointerEvents="none"
    >
      <Defs>
        {/*
          Carbon-fiber weave tile: 4×4 px
          Two offset "fiber bundles" (top-left & bottom-right cells),
          each with a 1 px left-edge highlight to simulate the raised weave.
          All fills are white; opacity is kept very low for a subtle effect.
        */}
        <Pattern
          id="cf-tile"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          {/* Bundle A — top-left quadrant */}
          <Rect x="0" y="0" width="2" height="2" fill="white" fillOpacity={0.055} />
          {/* Bundle A highlight (left edge) */}
          <Rect x="0" y="0" width="1" height="2" fill="white" fillOpacity={0.035} />

          {/* Bundle B — bottom-right quadrant */}
          <Rect x="2" y="2" width="2" height="2" fill="white" fillOpacity={0.055} />
          {/* Bundle B highlight (left edge) */}
          <Rect x="2" y="2" width="1" height="2" fill="white" fillOpacity={0.035} />
        </Pattern>
      </Defs>

      {/* Fill the entire screen with the repeating tile */}
      <Rect width={width} height={height} fill="url(#cf-tile)" />
    </Svg>
  );
}

const _styles = StyleSheet.create({
  // kept for reference — the SVG uses StyleSheet.absoluteFillObject inline
});
