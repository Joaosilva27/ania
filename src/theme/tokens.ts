/**
 * Design tokens.
 *
 * Warm, editorial palette; 4/8pt rhythm; restrained elevation. Nothing here is
 * screen-specific so the whole app stays visually coherent.
 */

export const colors = {
  background: '#FAF8F2',
  backgroundDeep: '#F4F1E7',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F0EA',
  surfaceSage: '#DCE8D4',

  ink: '#242720',
  inkSoft: '#494E45',
  muted: '#797D75',
  faint: '#A9ACA3',

  green: '#8CBF74',
  greenDeep: '#5A8A45',
  greenInk: '#20301A',
  sage: '#DCE8D4',

  orange: '#F3A35C',
  orangeSoft: '#FBE7D3',

  coral: '#E06B51',
  coralSoft: '#F8DFD8',

  border: '#E7E2D6',
  borderStrong: '#D6D0C1',

  overlay: 'rgba(24, 26, 21, 0.42)',
  scrim: 'rgba(24, 26, 21, 0.55)',
  white: '#FFFFFF',
  black: '#000000',
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
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const fonts = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  bold: 'DMSans_700Bold',
  serif: 'DMSerifDisplay_400Regular',
} as const;

export const type = {
  display: { fontFamily: fonts.serif, fontSize: 36, lineHeight: 42, letterSpacing: -0.6 },
  onboardingTitle: { fontFamily: fonts.serif, fontSize: 32, lineHeight: 38, letterSpacing: -0.4 },
  screenTitle: { fontFamily: fonts.serif, fontSize: 27, lineHeight: 33, letterSpacing: -0.3 },
  sectionTitle: { fontFamily: fonts.serif, fontSize: 23, lineHeight: 29, letterSpacing: -0.2 },
  cardTitle: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 22 },
  recipeTitle: { fontFamily: fonts.bold, fontSize: 21, lineHeight: 26 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  button: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20, letterSpacing: 0.1 },
} as const;

export const shadows = {
  card: {
    shadowColor: '#2B2A24',
    shadowOpacity: 0.09,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  soft: {
    shadowColor: '#2B2A24',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  floating: {
    shadowColor: '#2B2A24',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
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
