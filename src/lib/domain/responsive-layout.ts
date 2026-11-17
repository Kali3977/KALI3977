import type { LayoutPreference } from '../../types/kali';

export type EffectiveDeviceTier = 'mobile' | 'tablet' | 'desktop';
export type ViewportOrientation = 'portrait' | 'landscape';
export type ViewportBreakpointBand =
  | 'small-mobile'
  | 'standard-mobile'
  | 'large-mobile'
  | 'tablet'
  | 'laptop'
  | 'desktop';

export interface LayoutOptionMeta {
  id: LayoutPreference;
  label: string;
  shortLabel: string;
  description: string;
}

export const LAYOUT_OPTIONS: ReadonlyArray<LayoutOptionMeta> = [
  {
    id: 'automatic',
    label: 'Automatic (Default)',
    shortLabel: 'Auto',
    description: 'Adapts live to screen width, height, orientation changes, and browser resizing.',
  },
  {
    id: 'mobile',
    label: 'Mobile Layout',
    shortLabel: 'Mobile',
    description: 'Single-column stacked cards, compact touch header, and slide-out navigation drawer.',
  },
  {
    id: 'tablet',
    label: 'Tablet Layout',
    shortLabel: 'Tablet',
    description: 'Balanced 2-column grids, medium workspace density, and adaptive drawer navigation.',
  },
  {
    id: 'desktop',
    label: 'Desktop Layout',
    shortLabel: 'Desktop',
    description: 'Full multi-column grids and persistent desktop navigation (auto-clamped safely on small screens).',
  },
];

export const RESPONSIVE_BREAKPOINTS = {
  smallMobileMax: 374,
  standardMobileMax: 430,
  largeMobileMax: 767,
  tabletMin: 768,
  tabletMax: 1023,
  laptopMin: 1024,
  laptopMax: 1439,
  desktopMin: 1440,
} as const;

export interface ViewportDetection {
  width: number;
  height: number;
  physicalTier: EffectiveDeviceTier;
  breakpointBand: ViewportBreakpointBand;
  orientation: ViewportOrientation;
  isLandscapePhone: boolean;
  canFitDesktopSidebar: boolean;
  canFitTabletTwoCol: boolean;
}

export interface EffectiveLayoutState extends ViewportDetection {
  preference: LayoutPreference;
  effectiveLayout: EffectiveDeviceTier;
  isManualOverride: boolean;
  isSafeConstrained: boolean;
  showSidebar: boolean;
  showMobileDrawerToggle: boolean;
  showCompactDesktopNavBar: boolean;
  gridColumnsCap: 1 | 2 | 4;
  headerDensity: 'compact' | 'comfortable' | 'spacious';
}

export function normalizeLayoutPreference(
  value: unknown,
  fallback: LayoutPreference = 'automatic',
): LayoutPreference {
  if (
    value === 'automatic' ||
    value === 'mobile' ||
    value === 'tablet' ||
    value === 'desktop'
  ) {
    return value;
  }
  return fallback;
}

export function detectViewportTier(widthInput: number, heightInput: number): ViewportDetection {
  const width = Number.isFinite(widthInput) && widthInput > 0 ? Math.round(widthInput) : 1280;
  const height = Number.isFinite(heightInput) && heightInput > 0 ? Math.round(heightInput) : 800;

  const orientation: ViewportOrientation = width > height ? 'landscape' : 'portrait';

  let breakpointBand: ViewportBreakpointBand;
  let physicalTier: EffectiveDeviceTier;

  if (width <= RESPONSIVE_BREAKPOINTS.smallMobileMax) {
    breakpointBand = 'small-mobile';
    physicalTier = 'mobile';
  } else if (width <= RESPONSIVE_BREAKPOINTS.standardMobileMax) {
    breakpointBand = 'standard-mobile';
    physicalTier = 'mobile';
  } else if (width <= RESPONSIVE_BREAKPOINTS.largeMobileMax) {
    breakpointBand = 'large-mobile';
    physicalTier = 'mobile';
  } else if (width <= RESPONSIVE_BREAKPOINTS.tabletMax) {
    breakpointBand = 'tablet';
    physicalTier = 'tablet';
  } else if (width <= RESPONSIVE_BREAKPOINTS.laptopMax) {
    breakpointBand = 'laptop';
    physicalTier = 'desktop';
  } else {
    breakpointBand = 'desktop';
    physicalTier = 'desktop';
  }

  // Landscape mobile phone: short vertical height (<= 500px) and narrower than desktop sidebar threshold
  const isLandscapePhone = orientation === 'landscape' && height <= 500 && width < RESPONSIVE_BREAKPOINTS.laptopMin;

  // When a phone rotates to landscape (e.g. 640x360 or 844x390), treat physical tier safely as mobile/compact-tablet
  // so fixed desktop sidebars never consume scarce vertical/horizontal space.
  if (isLandscapePhone && physicalTier === 'tablet' && height <= 440) {
    physicalTier = 'mobile';
  }

  const canFitDesktopSidebar = width >= RESPONSIVE_BREAKPOINTS.laptopMin && height >= 460;
  const canFitTabletTwoCol = width >= 540;

  return {
    width,
    height,
    physicalTier,
    breakpointBand,
    orientation,
    isLandscapePhone,
    canFitDesktopSidebar,
    canFitTabletTwoCol,
  };
}

export function resolveEffectiveLayout(
  preferenceInput: LayoutPreference,
  width: number,
  height: number,
): EffectiveLayoutState {
  const preference = normalizeLayoutPreference(preferenceInput, 'automatic');
  const detection = detectViewportTier(width, height);
  const effectiveLayout: EffectiveDeviceTier =
    preference === 'automatic' ? detection.physicalTier : preference;

  const isManualOverride = preference !== 'automatic';

  // Safety rule: never render a fixed w-64 desktop sidebar on viewports too narrow or too short (< 1024px wide).
  // Instead, show a compact, horizontally scrollable desktop navigation strip (`showCompactDesktopNavBar`)
  // alongside the drawer toggle so desktop-style navigation stays immediately accessible without clipping or overflow.
  const showSidebar = effectiveLayout === 'desktop' && detection.canFitDesktopSidebar;
  const showCompactDesktopNavBar = effectiveLayout === 'desktop' && !detection.canFitDesktopSidebar;
  const showMobileDrawerToggle = !showSidebar;

  const isSafeConstrained =
    (effectiveLayout === 'desktop' && !detection.canFitDesktopSidebar) ||
    (effectiveLayout === 'tablet' && !detection.canFitTabletTwoCol);

  const gridColumnsCap: 1 | 2 | 4 =
    effectiveLayout === 'mobile'
      ? 1
      : effectiveLayout === 'tablet'
        ? detection.canFitTabletTwoCol
          ? 2
          : 1
        : 4;

  const headerDensity: EffectiveLayoutState['headerDensity'] =
    effectiveLayout === 'mobile' || detection.width < 640 || detection.isLandscapePhone
      ? 'compact'
      : effectiveLayout === 'tablet'
        ? 'comfortable'
        : 'spacious';

  return {
    ...detection,
    preference,
    effectiveLayout,
    isManualOverride,
    isSafeConstrained,
    showSidebar,
    showMobileDrawerToggle,
    showCompactDesktopNavBar,
    gridColumnsCap,
    headerDensity,
  };
}

export function getLayoutOptionLabel(pref: LayoutPreference): string {
  return LAYOUT_OPTIONS.find((opt) => opt.id === pref)?.label ?? 'Automatic (Default)';
}

export function formatDetectionSummary(state: EffectiveLayoutState): string {
  const tierLabel =
    state.physicalTier.charAt(0).toUpperCase() + state.physicalTier.slice(1);
  const orientationLabel =
    state.orientation === 'landscape' ? 'Landscape' : 'Portrait';
  const suffix = state.isLandscapePhone ? ' · Compact Landscape' : '';
  return `${tierLabel} (${state.width}×${state.height} · ${orientationLabel}${suffix})`;
}
