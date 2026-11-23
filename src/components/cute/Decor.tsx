import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Path, Pattern, Rect } from 'react-native-svg';
import { colors } from '@/theme';

/** Little heart, used for favourites, progress pips and decorative accents. */
export function Heart({
  size = 16,
  color = colors.primary,
  filled = true,
  style,
}: {
  size?: number;
  color?: string;
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 20.7 4.3 13c-2.1-2.1-2.1-5.5 0-7.6 2.1-2.1 5.5-2.1 7.6 0l.1.1.1-.1c2.1-2.1 5.5-2.1 7.6 0 2.1 2.1 2.1 5.5 0 7.6z"
          fill={filled ? color : 'none'}
          stroke={color}
          strokeWidth={filled ? 0 : 2}
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

/** Four-point sparkle — the "twinkle" that makes a layout feel hand-made. */
export function Sparkle({
  size = 14,
  color = colors.primary,
  style,
}: {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 1.5c.5 4.9 2.1 7.4 5.6 8.1-3.5.7-5.1 3.2-5.6 8.1-.5-4.9-2.1-7.4-5.6-8.1 3.5-.7 5.1-3.2 5.6-8.1z"
          fill={color}
        />
        <Path
          d="M12 11.6c.4 3.4 1.5 5.1 3.9 5.6-2.4.5-3.5 2.2-3.9 5.6-.4-3.4-1.5-5.1-3.9-5.6 2.4-.5 3.5-2.2 3.9-5.6z"
          fill={color}
          opacity={0.55}
        />
      </Svg>
    </View>
  );
}

/** Five-petal blossom. */
export function Flower({
  size = 18,
  color = colors.primarySoft,
  center = colors.butter,
  style,
}: {
  size?: number;
  color?: string;
  center?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {[0, 72, 144, 216, 288].map((angle) => (
          <Ellipse
            key={angle}
            cx={12}
            cy={7}
            rx={3.6}
            ry={4.6}
            fill={color}
            transform={`rotate(${angle} 12 12)`}
          />
        ))}
        <Circle cx={12} cy={12} r={2.6} fill={center} />
      </Svg>
    </View>
  );
}

/**
 * Scalloped / lace edge. Drop it above a sheet or card: `flip` points the
 * scallops the other way (used for card tops).
 */
export function ScallopEdge({
  color = colors.surface,
  height = 12,
  scallop = 18,
  flip = false,
  style,
}: {
  color?: string;
  height?: number;
  scallop?: number;
  flip?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const id = `scallop-${color.replace('#', '')}-${scallop}`;
  return (
    <View style={[flip ? styles.flip : null, style]} pointerEvents="none">
      <Svg width="100%" height={height}>
        <Defs>
          <Pattern id={id} width={scallop} height={height} patternUnits="userSpaceOnUse">
            <Circle cx={scallop / 2} cy={flip ? height : 0} r={scallop / 2} fill={color} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height={height} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** Soft background wash of polka dots for headers and empty states. */
export function DotWash({ color = colors.primarySoft, style }: { color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.fill, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="dots" width={18} height={18} patternUnits="userSpaceOnUse">
            <Circle cx={3} cy={3} r={2.2} fill={color} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#dots)" />
      </Svg>
    </View>
  );
}

/** Rounded organic blob used behind avatars and illustrations. */
export function Blob({
  size = 120,
  color = colors.primarySoft,
  style,
}: {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Path
          d="M61 6c19 0 33 9 44 22s9 32 2 46-22 27-40 31-39 0-51-13S3 62 7 45 20 17 34 11 51 6 61 6z"
          fill={color}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  flip: { transform: [{ scaleY: -1 }] },
});
