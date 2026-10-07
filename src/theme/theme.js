// Design tokens shared across every Kilix screen.
// Synced 1:1 with the original Stitch design system (trans_mediterranean_sourcing/DESIGN.md).

export const colors = {
  // Neutral graphite — replaces the former navy-blue secondary accent everywhere
  // (chips, checkboxes, avatars, step badges) so blue is reserved almost entirely
  // for the primary CTA / active nav / selected-state role below.
  navyDeep: '#26272B',
  // Brand hero navy — kept only for the Welcome screen's brand moment, per
  // "preserve existing brand identity". Not referenced anywhere else.
  primary: '#002046',
  primaryContainer: '#1B365D',
  onPrimaryContainer: '#87A0CD',
  orangeVibrant: '#FF6B00',
  secondary: '#A04100',
  secondaryContainer: '#FE6B00',
  onSecondaryContainer: '#572000',
  background: '#FCF9F8',
  mistGray: '#F4F7F9',
  surface: '#FCF9F8',
  surfaceDim: '#DCD9D9',
  surfaceContainer: '#F0EDED',
  surfaceContainerLow: '#F6F3F2',
  surfaceContainerHigh: '#EAE7E7',
  surfaceContainerHighest: '#E4E2E1',
  surfaceContainerLowest: '#FFFFFF',
  surfaceVariant: '#E4E2E1',
  charcoalText: '#2D2D2D',
  onSurface: '#1B1C1C',
  onSurfaceVariant: '#44474E',
  outline: '#74777F',
  outlineVariant: '#C4C6CF',
  error: '#BA1A1A',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#93000A',
  white: '#FFFFFF',
  success: '#1E8E3E',
  successContainer: '#E3F5E8',
  warning: '#B7791F',
  warningContainer: '#FFF3D6',
  info: '#1A56DB',
  infoContainer: '#E1EAFB',
  // Soft brand-orange tints for small accent chips (exclusive/discount badges,
  // icon roundels). Kept out of the blue role per the color-system rule.
  orangeTint: '#FFF1E6',
  orangeTintStrong: '#FFDBCC',
  orangeTintBorder: '#FFB693',
  onOrangeTintStrong: '#351000',
};

// 4pt base grid / 8pt layout rhythm.
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

// Refined rounded scale — softened from the original Stitch export to a tighter,
// more premium curve (excess roundness reads as templated / low-end).
export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 16,
  xxl: 20,
  card: 22, // auth cards / big containers
  full: 999,
};

// Component dimension tokens — shared across buttons, inputs, lists, nav, icons
// so every screen inherits the same rhythm instead of ad hoc pixel values.
export const sizes = {
  touchTarget: 44,      // WCAG / Material minimum interactive hit area
  buttonHeight: 52,
  buttonHeightSm: 40,
  inputHeight: 52,
  headerHeight: 56,
  navBarHeight: 64,
  listRowMinHeight: 64,
  iconXs: 14,
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
  iconXl: 28,
  avatarSm: 32,
  avatarMd: 44,
  avatarLg: 88,
  borderHairline: 1,
  borderFocus: 1.5,
};

export const letterSpacing = {
  tight: -0.2,
  normal: 0,
  wide: 0.2,
  wider: 0.4,
};

export const typography = {
  // Cairo covers Arabic text everywhere; Space Grotesk is used only for prices / technical data.
  displayLg: { fontFamily: 'Cairo_800ExtraBold', fontSize: 48, lineHeight: 58, letterSpacing: letterSpacing.tight },
  headlineLg: { fontFamily: 'Cairo_700Bold', fontSize: 32, lineHeight: 42, letterSpacing: letterSpacing.tight },
  headlineMobile: { fontFamily: 'Cairo_700Bold', fontSize: 24, lineHeight: 31, letterSpacing: letterSpacing.tight },
  titleMd: { fontFamily: 'Cairo_600SemiBold', fontSize: 20, lineHeight: 28, letterSpacing: letterSpacing.normal },
  titleSm: { fontFamily: 'Cairo_600SemiBold', fontSize: 16, lineHeight: 22, letterSpacing: letterSpacing.normal },
  bodyLg: { fontFamily: 'Cairo_400Regular', fontSize: 16, lineHeight: 26, letterSpacing: letterSpacing.normal },
  bodySm: { fontFamily: 'Cairo_400Regular', fontSize: 14, lineHeight: 21, letterSpacing: letterSpacing.normal },
  caption: { fontFamily: 'Cairo_400Regular', fontSize: 12, lineHeight: 17, letterSpacing: letterSpacing.wide },
  dataMono: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 14, lineHeight: 20, letterSpacing: letterSpacing.normal },
  priceLg: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 18, lineHeight: 22, letterSpacing: letterSpacing.normal },
};

const theme = { colors, spacing, radius, sizes, letterSpacing, typography };
export default theme;

// Elevation presets matching DESIGN.md: Level 1 (cards) uses a soft diffused shadow,
// Level 2 (active/hover, big modals) uses a stronger one. Spread these into any
// StyleSheet card/container style, e.g. `{ ...cardShadow.level1, ...otherStyles }`.
export const cardShadow = {
  level1: {
    shadowColor: '#0F1115',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  level2: {
    shadowColor: '#0F1115',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 4,
  },
};

// Dedicated, subtler elevation for the primary (orange) CTA — a soft brand-tinted
// glow rather than a hard drop shadow, matching the "subtle shadows" mandate.
export const buttonShadow = {
  shadowColor: colors.orangeVibrant,
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.16,
  shadowRadius: 8,
  elevation: 2,
};
