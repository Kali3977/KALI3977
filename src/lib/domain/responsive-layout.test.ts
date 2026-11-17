import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectViewportTier,
  formatDetectionSummary,
  normalizeLayoutPreference,
  resolveEffectiveLayout,
} from './responsive-layout';

test('normalizeLayoutPreference validates known modes and falls back safely', () => {
  assert.equal(normalizeLayoutPreference('automatic'), 'automatic');
  assert.equal(normalizeLayoutPreference('mobile'), 'mobile');
  assert.equal(normalizeLayoutPreference('tablet'), 'tablet');
  assert.equal(normalizeLayoutPreference('desktop'), 'desktop');
  assert.equal(normalizeLayoutPreference('dark'), 'automatic');
  assert.equal(normalizeLayoutPreference('beginner'), 'automatic');
  assert.equal(normalizeLayoutPreference(null), 'automatic');
  assert.equal(normalizeLayoutPreference(undefined, 'tablet'), 'tablet');
});

test('detectViewportTier covers all 9 target widths and breakpoint bands', () => {
  const expectations: Array<[number, number, 'mobile' | 'tablet' | 'desktop', string]> = [
    [320, 640, 'mobile', 'small-mobile'],
    [360, 740, 'mobile', 'small-mobile'],
    [390, 844, 'mobile', 'standard-mobile'],
    [430, 932, 'mobile', 'standard-mobile'],
    [768, 1024, 'tablet', 'tablet'],
    [1024, 768, 'desktop', 'laptop'],
    [1366, 768, 'desktop', 'laptop'],
    [1440, 900, 'desktop', 'desktop'],
    [1920, 1080, 'desktop', 'desktop'],
  ];

  for (const [w, h, tier, band] of expectations) {
    const det = detectViewportTier(w, h);
    assert.equal(det.physicalTier, tier, `width ${w}x${h} tier`);
    assert.equal(det.breakpointBand, band, `width ${w}x${h} band`);
  }
});

test('detectViewportTier recognizes portrait vs landscape orientation and compact landscape phones', () => {
  const portraitPhone = detectViewportTier(390, 844);
  assert.equal(portraitPhone.orientation, 'portrait');
  assert.equal(portraitPhone.isLandscapePhone, false);

  const landscapePhone = detectViewportTier(844, 390);
  assert.equal(landscapePhone.orientation, 'landscape');
  assert.equal(landscapePhone.isLandscapePhone, true);
  assert.equal(landscapePhone.physicalTier, 'mobile');
  assert.equal(landscapePhone.canFitDesktopSidebar, false);

  const tabletPortrait = detectViewportTier(768, 1024);
  assert.equal(tabletPortrait.orientation, 'portrait');
  assert.equal(tabletPortrait.physicalTier, 'tablet');

  const tabletLandscape = detectViewportTier(1024, 768);
  assert.equal(tabletLandscape.orientation, 'landscape');
  assert.equal(tabletLandscape.physicalTier, 'desktop');
  assert.equal(tabletLandscape.canFitDesktopSidebar, true);
});

test('resolveEffectiveLayout applies automatic mode without overrides', () => {
  const mobileAuto = resolveEffectiveLayout('automatic', 390, 844);
  assert.equal(mobileAuto.effectiveLayout, 'mobile');
  assert.equal(mobileAuto.isManualOverride, false);
  assert.equal(mobileAuto.showSidebar, false);
  assert.equal(mobileAuto.showMobileDrawerToggle, true);
  assert.equal(mobileAuto.gridColumnsCap, 1);

  const tabletAuto = resolveEffectiveLayout('automatic', 768, 1024);
  assert.equal(tabletAuto.effectiveLayout, 'tablet');
  assert.equal(tabletAuto.showSidebar, false);
  assert.equal(tabletAuto.gridColumnsCap, 2);

  const desktopAuto = resolveEffectiveLayout('automatic', 1440, 900);
  assert.equal(desktopAuto.effectiveLayout, 'desktop');
  assert.equal(desktopAuto.showSidebar, true);
  assert.equal(desktopAuto.showCompactDesktopNavBar, false);
  assert.equal(desktopAuto.gridColumnsCap, 4);
});

test('resolveEffectiveLayout honors manual mobile/tablet overrides on wide desktops', () => {
  const mobileOnDesktop = resolveEffectiveLayout('mobile', 1920, 1080);
  assert.equal(mobileOnDesktop.effectiveLayout, 'mobile');
  assert.equal(mobileOnDesktop.isManualOverride, true);
  assert.equal(mobileOnDesktop.showSidebar, false);
  assert.equal(mobileOnDesktop.showMobileDrawerToggle, true);
  assert.equal(mobileOnDesktop.gridColumnsCap, 1);
  assert.equal(mobileOnDesktop.headerDensity, 'compact');

  const tabletOnDesktop = resolveEffectiveLayout('tablet', 1920, 1080);
  assert.equal(tabletOnDesktop.effectiveLayout, 'tablet');
  assert.equal(tabletOnDesktop.showSidebar, false);
  assert.equal(tabletOnDesktop.showMobileDrawerToggle, true);
  assert.equal(tabletOnDesktop.gridColumnsCap, 2);
  assert.equal(tabletOnDesktop.headerDensity, 'comfortable');
});

test('resolveEffectiveLayout enforces manual mode safety on small phones', () => {
  const desktopOn320 = resolveEffectiveLayout('desktop', 320, 640);
  assert.equal(desktopOn320.effectiveLayout, 'desktop');
  assert.equal(desktopOn320.isSafeConstrained, true);
  assert.equal(desktopOn320.showSidebar, false);
  assert.equal(desktopOn320.showCompactDesktopNavBar, true);
  assert.equal(desktopOn320.showMobileDrawerToggle, true);
  assert.equal(desktopOn320.headerDensity, 'compact');

  const tabletOn320 = resolveEffectiveLayout('tablet', 320, 640);
  assert.equal(tabletOn320.effectiveLayout, 'tablet');
  assert.equal(tabletOn320.isSafeConstrained, true);
  assert.equal(tabletOn320.gridColumnsCap, 1);
  assert.equal(tabletOn320.showSidebar, false);
});

test('formatDetectionSummary formats human-readable viewport status', () => {
  const summary = formatDetectionSummary(resolveEffectiveLayout('automatic', 844, 390));
  assert.match(summary, /844×390/);
  assert.match(summary, /Landscape/);
  assert.match(summary, /Compact Landscape/);
});
