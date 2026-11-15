import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  LOCKABLE_SECTION_KEYS,
  PLATFORM_SECTION_DEFINITIONS,
  buildDefaultSectionStates,
  deriveSectionFlags,
  evaluateSectionAccess,
  getEffectiveSectionStatus,
  getSectionDefinition,
  isSectionVisibleInStudentNav,
  normalizeSectionDisplayStatus,
} from './sections.ts';
import { VALID_NAV_SECTIONS, parseNavSectionFromHash } from '../auth-helpers.ts';

test('Canonical Global Section Registry includes all 11 toggleable sections + Learn KALI directly after Cyber Labs', () => {
  const keys = PLATFORM_SECTION_DEFINITIONS.map((s) => s.sectionKey);
  assert.equal(new Set(keys).size, keys.length, 'Section keys must be unique');

  assert.deepEqual(LOCKABLE_SECTION_KEYS, [
    'academy',
    'books',
    'labs',
    'learn-kali',
    'ctf',
    'arena',
    'games',
    'tournaments',
    'mentor',
    'community',
    'career',
  ]);

  const labsIdx = VALID_NAV_SECTIONS.indexOf('labs');
  const learnKaliIdx = VALID_NAV_SECTIONS.indexOf('learn-kali');
  const ctfIdx = VALID_NAV_SECTIONS.indexOf('ctf');
  assert.ok(labsIdx >= 0);
  assert.equal(learnKaliIdx, labsIdx + 1, 'learn-kali must be directly after labs');
  assert.equal(ctfIdx, learnKaliIdx + 1, 'ctf must be directly after learn-kali');

  assert.equal(parseNavSectionFromHash('#learn-kali'), 'learn-kali');
  assert.equal(parseNavSectionFromHash('#/learn-kali?tab=tree'), 'learn-kali');

  for (const protectedKey of ['home', 'profile', 'notifications', 'settings', 'legal', 'admin']) {
    const def = getSectionDefinition(protectedKey);
    assert.ok(def, `Protected section ${protectedKey} must exist`);
    assert.equal(def.isLockable, false, `Protected section ${protectedKey} must remain non-lockable`);
  }
});

test('deriveSectionFlags and getEffectiveSectionStatus enforce state invariants and protect core sections', () => {
  assert.deepEqual(
    deriveSectionFlags({ displayStatus: 'disabled', isLockable: false }),
    { displayStatus: 'enabled', enabledStatus: true, maintenanceStatus: false },
  );

  assert.deepEqual(
    deriveSectionFlags({ displayStatus: 'coming_soon', isLockable: true }),
    { displayStatus: 'coming_soon', enabledStatus: false, maintenanceStatus: false },
  );

  assert.deepEqual(
    deriveSectionFlags({ displayStatus: 'maintenance', isLockable: true }),
    { displayStatus: 'maintenance', enabledStatus: false, maintenanceStatus: true },
  );

  assert.equal(normalizeSectionDisplayStatus('MAINTENANCE'), 'maintenance');
  assert.equal(normalizeSectionDisplayStatus('coming_soon'), 'coming_soon');
  assert.equal(normalizeSectionDisplayStatus('invalid_status', 'enabled'), 'enabled');

  const defaults = buildDefaultSectionStates();
  const learnKali = defaults.find((d) => d.sectionKey === 'learn-kali');
  assert.ok(learnKali);
  assert.equal(getEffectiveSectionStatus(learnKali), 'enabled');
  assert.equal(isSectionVisibleInStudentNav(learnKali), true);

  assert.equal(
    isSectionVisibleInStudentNav({
      isLockable: true,
      enabledStatus: false,
      displayStatus: 'coming_soon',
      maintenanceStatus: false,
    }),
    false,
  );
});

test('evaluateSectionAccess enforces student lockouts, 403/503 HTTP codes, admin access, and Student Preview', () => {
  const disabledSection = {
    sectionKey: 'labs' as const,
    sectionName: 'Cyber Labs',
    isLockable: true,
    enabledStatus: false,
    displayStatus: 'disabled' as const,
    maintenanceStatus: false,
    statusMessage: 'Labs are offline for kernel upgrades.',
  };

  const guestRes = evaluateSectionAccess({ section: disabledSection, userRole: 'guest' });
  assert.equal(guestRes.allowed, false);
  assert.equal(guestRes.httpStatus, 403);
  assert.equal(guestRes.reason, 'Labs are offline for kernel upgrades.');

  const playerRes = evaluateSectionAccess({ section: disabledSection, userRole: 'player' });
  assert.equal(playerRes.allowed, false);
  assert.equal(playerRes.httpStatus, 403);

  const captainRes = evaluateSectionAccess({ section: disabledSection, userRole: 'team_captain' });
  assert.equal(captainRes.allowed, false);
  assert.equal(captainRes.httpStatus, 403);

  for (const adminRole of ['owner', 'event_admin', 'moderator']) {
    const adminRes = evaluateSectionAccess({ section: disabledSection, userRole: adminRole });
    assert.equal(adminRes.allowed, true);
    assert.equal(adminRes.httpStatus, 200);

    const previewRes = evaluateSectionAccess({
      section: disabledSection,
      userRole: adminRole,
      previewAsStudent: true,
    });
    assert.equal(previewRes.allowed, false);
    assert.equal(previewRes.httpStatus, 403);
  }

  const maintSection = {
    sectionKey: 'mentor' as const,
    sectionName: 'AI Cyber Mentor',
    isLockable: true,
    enabledStatus: false,
    displayStatus: 'maintenance' as const,
    maintenanceStatus: true,
    statusMessage: '',
  };
  const maintRes = evaluateSectionAccess({ section: maintSection, userRole: 'player' });
  assert.equal(maintRes.allowed, false);
  assert.equal(maintRes.httpStatus, 503);
  assert.match(maintRes.reason, /scheduled maintenance/i);

  const soonSection = {
    sectionKey: 'learn-kali' as const,
    sectionName: 'Learn KALI',
    isLockable: true,
    enabledStatus: false,
    displayStatus: 'coming_soon' as const,
    maintenanceStatus: false,
    statusMessage: '',
  };
  const soonRes = evaluateSectionAccess({ section: soonSection, userRole: 'player' });
  assert.equal(soonRes.allowed, false);
  assert.equal(soonRes.httpStatus, 403);
  assert.match(soonRes.reason, /Coming Soon/i);
});

test('100% Free Platform policy: BooksLibrary contains no Paid Edition labels or paywall filters', () => {
  const booksSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/BooksLibrary.tsx'),
    'utf8',
  );
  assert.equal(/Paid Edition|Paid \/ Publisher/i.test(booksSource), false);
});
