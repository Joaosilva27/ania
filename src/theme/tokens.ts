/**
 * Design tokens — "bubblegum bakery".
 *
 * Blush paper, bubblegum rose, berry ink, plus a supporting set of candy
 * pastels (lavender, mint, butter) so screens can be layered and playful
 * without losing contrast. Headlines are chunky rounded (Fredoka), body copy is
 * soft rounded (Quicksand), and small asides stay in a lighter Fredoka so they
 * feel handwritten without being hard to read.
 */

export const colors = {
  // Paper
  background: '#FFF7FA',
  backgroundDeep: '#FFEFF6',
  surface: '#FFFFFF',
  surfaceMuted: '#FFF1F7',
  surfaceTint: '#FFE3F0',

  // Ink — deep berry, never pure black
  ink: '#43243A',
  inkSoft: '#6B4459',
  muted: '#7E5A6C',
  faint: '#C0A5B4',

  // Primary — bubblegum
  primary: '#FF7EB6',
  primaryDeep: '#C22A63',
  primaryInk: '#5C1233',
  primarySoft: '#FFD9E9',

  // Candy pastels
  lavender: '#B79CFF',
  lavenderDeep: '#7C5BE0',
  lavenderSoft: '#EDE5FF',
  lavenderInk: '#3B2768',

  mint: '#8FDCC0',
  mintDeep: '#3E9C7C',
  mintSoft: '#E2F8EF',
  mintInk: '#0F4436',

  butter: '#FFD37A',
  butterDeep: '#C98A1F',
  butterSoft: '#FFF3D6',
  butterInk: '#5A3F0B',

  // Secondary — peach
  accent: '#FFB37D',
  accentDeep: '#D97A3F',
  accentInk: '#6B3410',
  accentSoft: '#FFE7D3',

  // Feedback
  danger: '#B02A3E',
  dangerSoft: '#FFE2E8',

  border: '#FFD5E5',
  borderStrong: '#FFB3D2',

  overlay: 'rgba(67, 36, 58, 0.42)',
  scrim: 'rgba(67, 36, 58, 0.5)',
  white: '#FFFFFF',
  black: '#000000',
} as const;

/** Gradient stops for LinearGradient. Always top-left → bottom-right. */
export const gradients = {
  button: ['#D22F68', '#B01F52'],
  buttonSoft: ['#FFE3F0', '#FFD0E4'],
  hero: ['#FFC7E1', '#FFEAF3'],
  candy: ['#FFD3E8', '#FFF0CE'],
  lavender: ['#E9E1FF', '#FFE0F0'],
  mint: ['#DFF8EE', '#E6EFFF'],
  sunrise: ['#FFE1C7', '#FFD6E9'],
  background: ['#FFF7FA', '#FFEFF7'],
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 56,
} as const;

export const radius = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 26,
  xl: 32,
  xxl: 38,
  pill: 999,
} as const;

export const fonts = {
  regular: 'Quicksand_400Regular',
  medium: 'Quicksand_500Medium',
  semibold: 'Quicksand_600SemiBold',
  bold: 'Quicksand_700Bold',
  display: 'Fredoka_600SemiBold',
  displayBold: 'Fredoka_700Bold',
  displayLight: 'Fredoka_500Medium',
} as const;

export const type = {
  display: { fontFamily: fonts.display, fontSize: 38, lineHeight: 44, letterSpacing: -0.3 },
  onboardingTitle: { fontFamily: fonts.display, fontSize: 31, lineHeight: 37, letterSpacing: -0.2 },
  screenTitle: { fontFamily: fonts.display, fontSize: 27, lineHeight: 33, letterSpacing: -0.1 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28 },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 23 },
  recipeTitle: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 23 },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 17 },
  button: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20, letterSpacing: 0.2 },
  // Small friendly asides ("3 meals planned ♡") — rounded but easy to read.
  note: { fontFamily: fonts.displayLight, fontSize: 20, lineHeight: 27, letterSpacing: 0.1 },
  noteSmall: { fontFamily: fonts.displayLight, fontSize: 17, lineHeight: 24, letterSpacing: 0.1 },
  noteTiny: { fontFamily: fonts.displayLight, fontSize: 16, lineHeight: 22, letterSpacing: 0.1 },
} as const;

export const shadows = {
  card: {
    shadowColor: '#D0698F',
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  soft: {
    shadowColor: '#D0698F',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  floating: {
    shadowColor: '#B43A6C',
    shadowOpacity: 0.22,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
} as const;

export const layout = {
  screenPadding: 20,
  tabBarHeight: 62,
  minTouchTarget: 44,
  cardImageAspect: 4 / 5,
} as const;

export const durations = {
  fast: 160,
  base: 240,
  slow: 340,
} as const;
