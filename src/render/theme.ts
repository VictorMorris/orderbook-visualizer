import type { TextStyleOptions } from 'pixi.js';

// Single source of truth for colour and type
// Nothing in render/ should use a literal colour

export const DESIGN_W = 1600;
export const DESIGN_H = 900;

export const COLOR = {
  bg: 0x0b0e14, // Dark Black-Blue 
  panel: 0x0e121a, // Dark Black-Blue
  grid: 0x161b25, // Dark Black-Blue

  bid: 0x26a69a, // Teal
  ask: 0xef5350, // Red
  bidBar: 0x18453f, // Dark Green
  askBar: 0x54211f, // Dark Red

  text: 0xd1d4dc, // Light gray
  muted: 0x6b7280, // Gray
  dim: 0x39404f, // Dark Gray-Blue
  accent: 0xf0b90b, // Yellow
  flash: 0xffffff, // White
} as const;

// Color gradient from cold to hot. Each pair of neighboring colors
// gets blended together to make a smooth transition.
export const HEAT_STOPS = [
  0x0e121a, 0x14304a, 0x1f7a8c, 0x26a69a, 0xf0b90b, 0xfff1c2,
] as const;

const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Courier New", monospace';

export const TEXT: Record<
  'label' | 'title' | 'price' | 'readout' | 'big',
  TextStyleOptions
> = {
  label:   { fontFamily: MONO, fontSize: 10, fill: COLOR.muted },
  title:   { fontFamily: MONO, fontSize: 10, fill: COLOR.muted, letterSpacing: 1.6 },
  price:   { fontFamily: MONO, fontSize: 11, fill: COLOR.text },
  readout: { fontFamily: MONO, fontSize: 13, fill: COLOR.text },
  big:     { fontFamily: MONO, fontSize: 26, fill: COLOR.text },
};

// Blend two packed RGB colours, t in [0,1].
export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const c = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | c;
}
