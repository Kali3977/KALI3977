import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTotpOtpAuthUri,
  detectSuspiciousInput,
  generateSecureCode,
  generateTotpCode,
  generateTotpSecret,
  hashFlag,
  maskFlag,
  verifyFlagConstantTime,
  verifyTotpCode,
} from './security';
import { canAssignRole, hasPermission, isRegistrationRoleAllowed } from './rbac';
import {
  ADAPTIVE_LEVELS,
  SlidingWindowRateLimiter,
  analyzeWeakSkills,
  calculateDynamicCtfPoints,
  calculateLevelFromXp,
  createCompetitionRulesSnapshot,
  doesEmailMatchCampusDomain,
  evaluateChatAccess,
  evaluateDiagnosticPlacement,
  generateTournamentBrackets,
  isBookDownloadPermitted,
  validateRoomAndTeamJoin,
} from './arena';
import { isSafeExternalUrl, parseSafeRichText } from './rich-text';
import {
  AntiScrapingMonitor,
  KALI3977_BRAND_NOTICE,
  clampPaginationLimit,
  isLegitimateAssistiveOrBrowserUa,
  validateIpReportInput,
} from './anti-abuse';
import {
  CTF_CATEGORIES,
  EXTERNAL_CTF_PLATFORMS,
  SEEDED_BOOKS,
  SEEDED_CTF_CHALLENGES,
} from '../../db/seed-ctf-books';
import { INITIAL_NFSU_CAMPUSES } from '../../db/seed';

test('CTF flag HMAC hashing and constant-time verification', () => {
  const secret = 'test-hmac-secret';
  const hash = hashFlag('KALI3977{sql_auth_bypass_42}', secret);
  assert.equal(verifyFlagConstantTime('KALI3977{sql_auth_bypass_42}', hash, secret), true);
  assert.equal(verifyFlagConstantTime('  KALI3977{sql_auth_bypass_42}  ', hash, secret), true);
  assert.equal(verifyFlagConstantTime('KALI3977{wrong_flag}', hash, secret), false);
  assert.equal(maskFlag('KALI3977{secret_flag}'), 'KALI***g}');
});

test('RFC 6238 TOTP MFA generation and verification', () => {
  const secret = generateTotpSecret();
  const now = 1_794_688_000_000;
  const code = generateTotpCode(secret, now);
  assert.match(code, /^\d{6}$/);
  assert.equal(verifyTotpCode(secret, code, now), true);
  assert.equal(verifyTotpCode(secret, '000000', now), code === '000000');
  assert.match(buildTotpOtpAuthUri('owner@kali3977.org', secret), /^otpauth:\/\/totp\//);
});

test('SQL injection and XSS detection signals', () => {
  assert.equal(detectSuspiciousInput("admin' OR 1=1 --").isSuspicious, true);
  assert.equal(detectSuspiciousInput('<script>alert(1)</script>').isSuspicious, true);
  assert.equal(detectSuspiciousInput('Normal cybersecurity discussion').isSuspicious, false);
});

test('RBAC prevents privilege escalation and respects temporary scoped permissions', () => {
  assert.equal(isRegistrationRoleAllowed('player'), true);
  assert.equal(isRegistrationRoleAllowed('owner'), false);
  assert.equal(isRegistrationRoleAllowed('event_admin'), false);

  assert.equal(canAssignRole('player', 'event_admin'), false);
  assert.equal(canAssignRole('event_admin', 'moderator'), false);
  assert.equal(canAssignRole('owner', 'event_admin'), true);
  assert.equal(canAssignRole('owner', 'owner'), false);

  const player = { id: 2, role: 'player' as const, isSuspended: false, isBanned: false, mfaEnabled: false };
  assert.equal(hasPermission(player, 'admin:manage_users'), false);
  assert.equal(hasPermission(player, 'admin:view_analytics'), false);

  const scopedAdmin = {
    id: 3,
    role: 'event_admin' as const,
    isSuspended: false,
    isBanned: false,
    mfaEnabled: true,
    permissionsJson: { eventIds: [10], expiresAt: '2026-12-01T00:00:00Z' },
  };
  assert.equal(hasPermission(scopedAdmin, 'admin:manage_rooms', { competitionId: 10, now: new Date('2026-11-15T00:00:00Z') }), true);
  assert.equal(hasPermission(scopedAdmin, 'admin:manage_rooms', { competitionId: 99, now: new Date('2026-11-15T00:00:00Z') }), false);
  assert.equal(hasPermission(scopedAdmin, 'admin:manage_rooms', { competitionId: 10, now: new Date('2026-12-02T00:00:00Z') }), false);
  assert.equal(hasPermission(scopedAdmin, 'admin:appoint_admins', { competitionId: 10 }), false);
});

test('Dual Room Code and Team Code validation enforces separation, capacity, expiry, and anti-switch', () => {
  const baseRoom = {
    id: 1,
    competitionId: 100,
    roomCode: '3977-CTF-82A',
    isActive: true,
    isLocked: false,
    maxParticipants: 150,
    currentParticipants: 40,
    usageCount: 40,
    usageLimit: 150,
    expiresAt: new Date('2026-12-31T00:00:00Z'),
  };
  const baseTeam = {
    id: 5,
    competitionId: 100,
    campusId: 1,
    name: 'Campus Alpha',
    teamCode: 'CAMPUS-001',
    isActive: true,
    isSuspended: false,
    maxMembers: 30,
    currentMembers: 10,
    codeUsageCount: 10,
    codeUsageLimit: 30,
    codeExpiresAt: new Date('2026-12-31T00:00:00Z'),
  };
  const baseComp = {
    id: 100,
    status: 'active',
    enrollmentPolicy: 'shared_team_code',
    allowLateJoin: true,
    totalCapacity: 150,
    perTeamCapacity: 30,
  };
  const now = new Date('2026-11-15T00:00:00Z');

  assert.equal(
    validateRoomAndTeamJoin({
      room: baseRoom,
      team: baseTeam,
      competition: baseComp,
      userCampusId: 1,
      existingParticipationInCompetition: null,
      now,
    }).allowed,
    true,
  );

  // Invalid room code
  assert.equal(
    validateRoomAndTeamJoin({
      room: null,
      team: baseTeam,
      competition: baseComp,
      userCampusId: 1,
      existingParticipationInCompetition: null,
      now,
    }).code,
    'INVALID_ROOM_CODE',
  );

  // Expired room code
  assert.equal(
    validateRoomAndTeamJoin({
      room: { ...baseRoom, expiresAt: new Date('2026-11-01T00:00:00Z') },
      team: baseTeam,
      competition: baseComp,
      userCampusId: 1,
      existingParticipationInCompetition: null,
      now,
    }).code,
    'ROOM_CODE_EXPIRED',
  );

  // Room capacity reached
  assert.equal(
    validateRoomAndTeamJoin({
      room: { ...baseRoom, currentParticipants: 150 },
      team: baseTeam,
      competition: baseComp,
      userCampusId: 1,
      existingParticipationInCompetition: null,
      now,
    }).code,
    'ROOM_CAPACITY_REACHED',
  );

  // Team capacity reached
  assert.equal(
    validateRoomAndTeamJoin({
      room: baseRoom,
      team: { ...baseTeam, currentMembers: 30 },
      competition: baseComp,
      userCampusId: 1,
      existingParticipationInCompetition: null,
      now,
    }).code,
    'TEAM_CAPACITY_REACHED',
  );

  // Unauthorized team switching
  assert.equal(
    validateRoomAndTeamJoin({
      room: baseRoom,
      team: baseTeam,
      competition: baseComp,
      userCampusId: 1,
      existingParticipationInCompetition: { teamId: 9 },
      now,
    }).code,
    'TEAM_SWITCH_FORBIDDEN',
  );
});

test('Chat isolation enforces strict team, captain, and organizer access boundaries', () => {
  assert.equal(
    evaluateChatAccess({
      channelType: 'team',
      channelTeamId: 5,
      channelEnabled: true,
      userRole: 'player',
      userTeamIds: [6],
      isCaptainOfChannelTeam: false,
    }).allowed,
    false,
  );
  assert.equal(
    evaluateChatAccess({
      channelType: 'team',
      channelTeamId: 5,
      channelEnabled: true,
      userRole: 'player',
      userTeamIds: [5],
      isCaptainOfChannelTeam: false,
    }).allowed,
    true,
  );
  assert.equal(
    evaluateChatAccess({
      channelType: 'captain',
      channelTeamId: 5,
      channelEnabled: true,
      userRole: 'player',
      userTeamIds: [5],
      isCaptainOfChannelTeam: false,
    }).allowed,
    false,
  );
  assert.equal(
    evaluateChatAccess({
      channelType: 'organizer',
      channelTeamId: null,
      channelEnabled: true,
      userRole: 'team_captain',
      userTeamIds: [5],
      isCaptainOfChannelTeam: true,
    }).allowed,
    false,
  );
});

test('Dynamic scoring, XP leveling, rate limiter, brackets, and rule snapshotting', () => {
  assert.equal(calculateDynamicCtfPoints(500, 0), 500);
  assert.ok(calculateDynamicCtfPoints(500, 10) < 500);
  assert.ok(calculateDynamicCtfPoints(500, 500) >= 100);

  const lvl = calculateLevelFromXp(450);
  assert.equal(lvl.level, 3);

  const limiter = new SlidingWindowRateLimiter();
  assert.equal(limiter.check('user:1:flag', 2, 60_000, 1000).allowed, true);
  assert.equal(limiter.check('user:1:flag', 2, 60_000, 2000).allowed, true);
  assert.equal(limiter.check('user:1:flag', 2, 60_000, 3000).allowed, false);

  const snap = createCompetitionRulesSnapshot({
    gameMode: 'ctf_battle',
    scoringSystem: 'dynamic',
    totalCapacity: 150,
    perTeamCapacity: 30,
    maxTeams: 5,
    penaltyPerWrongFlag: 10,
    hintsEnabled: true,
    allowLateJoin: true,
    enrollmentPolicy: 'shared_team_code',
    durationMinutes: 180,
  });
  assert.equal(snap.totalCapacity, 150);

  const brackets = generateTournamentBrackets(
    [
      { id: 1, name: 'Alpha' },
      { id: 2, name: 'Beta' },
      { id: 3, name: 'Gamma' },
    ],
    'round_robin',
  );
  assert.equal(brackets.rounds[0].matches.length, 3);

  const weak = analyzeWeakSkills([{ category: 'Binary Exploitation', solved: 1, attempts: 5 }]);
  assert.equal(weak[0].accuracyPct, 20);
  assert.match(generateSecureCode('3977-CTF'), /^3977-CTF-/);
});

test('Safe rich-text parser blocks dangerous URI schemes and allows safe external & artifact links', () => {
  assert.equal(isSafeExternalUrl('https://owasp.org/Top10/'), true);
  assert.equal(isSafeExternalUrl('http://localhost:3000/docs'), true);
  assert.equal(isSafeExternalUrl('/api/ctf/12/artifact'), true);
  assert.equal(isSafeExternalUrl('javascript:alert(1)'), false);
  assert.equal(isSafeExternalUrl('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(isSafeExternalUrl('vbscript:msgbox(1)'), false);
  assert.equal(isSafeExternalUrl('//evil.example/payload'), false);

  const parsed = parseSafeRichText(
    'Read [OWASP](https://owasp.org) and avoid [bad](javascript:alert(1)) with **TLS** and `curl -I`.\n- First item\n```bash\ncurl -s https://kali3977.org\n```',
  );
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].type, 'paragraph');
  assert.equal(parsed[0].tokens?.some((t) => t.type === 'link' && t.href === 'https://owasp.org'), true);
  assert.equal(parsed[0].tokens?.some((t) => t.type === 'link' && t.text === 'bad'), false);
  assert.equal(parsed[0].tokens?.some((t) => t.type === 'strong' && t.text === 'TLS'), true);
  assert.equal(parsed[1].type, 'list');
  assert.equal(parsed[2].type, 'codeblock');
});

test('Campus domain matching, paused competitions, registration deadlines, chat mute, and group_stage brackets', () => {
  assert.equal(doesEmailMatchCampusDomain('alice@iitb.ac.in', true, 'iitb.ac.in'), true);
  assert.equal(doesEmailMatchCampusDomain('alice@cse.iitb.ac.in', true, 'iitb.ac.in'), true);
  assert.equal(doesEmailMatchCampusDomain('alice@iitb.ac.in', false, 'iitb.ac.in'), false);
  assert.equal(doesEmailMatchCampusDomain('alice@gmail.com', true, 'iitb.ac.in'), false);

  const baseRoom = {
    id: 1,
    competitionId: 100,
    roomCode: '3977-CTF-82A',
    isActive: true,
    isLocked: false,
    maxParticipants: 150,
    currentParticipants: 5,
    usageCount: 5,
    usageLimit: 150,
    expiresAt: null,
  };
  const baseTeam = {
    id: 5,
    competitionId: 100,
    campusId: 1,
    name: 'Campus Alpha',
    teamCode: 'CAMPUS-001',
    isActive: true,
    isSuspended: false,
    maxMembers: 30,
    currentMembers: 2,
    codeUsageCount: 2,
    codeUsageLimit: 30,
    codeExpiresAt: null,
  };

  assert.equal(
    validateRoomAndTeamJoin({
      room: baseRoom,
      team: baseTeam,
      competition: {
        id: 100,
        status: 'paused',
        enrollmentPolicy: 'shared_team_code',
        allowLateJoin: true,
        totalCapacity: 150,
        perTeamCapacity: 30,
      },
      userCampusId: 1,
      existingParticipationInCompetition: null,
    }).code,
    'COMPETITION_PAUSED',
  );

  assert.equal(
    validateRoomAndTeamJoin({
      room: baseRoom,
      team: baseTeam,
      competition: {
        id: 100,
        status: 'registration_open',
        enrollmentPolicy: 'shared_team_code',
        allowLateJoin: true,
        totalCapacity: 150,
        perTeamCapacity: 30,
        registrationDeadline: new Date('2026-11-01T00:00:00Z'),
      },
      userCampusId: 1,
      existingParticipationInCompetition: null,
      now: new Date('2026-11-15T00:00:00Z'),
    }).code,
    'REGISTRATION_CLOSED',
  );

  assert.equal(
    evaluateChatAccess({
      channelType: 'team',
      channelTeamId: 5,
      channelEnabled: true,
      userRole: 'player',
      userTeamIds: [5],
      isCaptainOfChannelTeam: false,
      isMutedInChat: true,
      isWrite: true,
    }).allowed,
    false,
  );

  const groupBracket = generateTournamentBrackets(
    [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
      { id: 4, name: 'D' },
    ],
    'group_stage',
  );
  assert.equal(groupBracket.format, 'group_stage');
  assert.equal(groupBracket.rounds.length, 2);
  assert.equal(groupBracket.rounds[0].matches.length, 1);
  assert.equal(groupBracket.rounds[1].matches.length, 1);
});

test('Adaptive learning diagnostic placement skips beginner tiers only at >= 50%', () => {
  assert.equal(ADAPTIVE_LEVELS.length, 8);

  const low = evaluateDiagnosticPlacement(4, 10, ['linux-fundamentals', 'networking-essentials']);
  assert.equal(low.scorePct, 40);
  assert.equal(low.verifiedLevel, 'Elementary');
  assert.equal(low.unlockIntermediate, false);
  assert.deepEqual(low.skippedCourseSlugs, []);

  const mid = evaluateDiagnosticPlacement(5, 10, ['linux-fundamentals', 'networking-essentials']);
  assert.equal(mid.scorePct, 50);
  assert.equal(mid.verifiedLevel, 'Intermediate');
  assert.equal(mid.unlockIntermediate, true);
  assert.deepEqual(mid.skippedCourseSlugs, ['linux-fundamentals', 'networking-essentials']);

  const high = evaluateDiagnosticPlacement(10, 10, ['linux-fundamentals']);
  assert.equal(high.verifiedLevel, 'Research and Specialist Level');
  assert.equal(high.unlockIntermediate, true);
});

test('Books library license gate allows open-access downloads and blocks copyrighted books', () => {
  assert.equal(isBookDownloadPermitted({ canDownload: true, licenseType: 'Public Domain' }), true);
  assert.equal(isBookDownloadPermitted({ canDownload: true, licenseType: 'Creative Commons CC BY-NC-SA 3.0' }), true);
  assert.equal(isBookDownloadPermitted({ canDownload: true, licenseType: 'Open Access (Free Educational PDF)' }), true);
  assert.equal(isBookDownloadPermitted({ canDownload: true, licenseType: 'GNU Free Documentation License' }), true);
  assert.equal(isBookDownloadPermitted({ canDownload: true, licenseType: 'Commercial Copyrighted Reference' }), false);
  assert.equal(isBookDownloadPermitted({ canDownload: false, licenseType: 'Public Domain' }), false);
});

test('Disciplinary team and competition removals block room/team re-entry', () => {
  const room = {
    id: 1,
    competitionId: 100,
    roomCode: '3977-CTF-82A',
    isActive: true,
    isLocked: false,
    maxParticipants: 150,
    currentParticipants: 10,
    usageCount: 10,
    usageLimit: 150,
    expiresAt: null,
  };
  const team = {
    id: 5,
    competitionId: 100,
    campusId: 1,
    name: 'NFSU Gandhinagar Team 01',
    teamCode: 'NFSU-TEAM-01',
    isActive: true,
    isSuspended: false,
    maxMembers: 30,
    currentMembers: 5,
    codeUsageCount: 5,
    codeUsageLimit: 30,
    codeExpiresAt: null,
  };
  const comp = {
    id: 100,
    status: 'active',
    enrollmentPolicy: 'shared_team_code',
    allowLateJoin: true,
    totalCapacity: 150,
    perTeamCapacity: 30,
  };

  assert.equal(
    validateRoomAndTeamJoin({
      room,
      team,
      competition: comp,
      userCampusId: 1,
      existingParticipationInCompetition: null,
      teamRemovalState: { status: 'perm_removed', expiresAt: null },
    }).code,
    'TEAM_PERMANENTLY_REMOVED',
  );

  const future = new Date(Date.now() + 3_600_000);
  assert.equal(
    validateRoomAndTeamJoin({
      room,
      team,
      competition: comp,
      userCampusId: 1,
      existingParticipationInCompetition: null,
      teamRemovalState: { status: 'temp_removed', expiresAt: future },
    }).code,
    'TEAM_TEMPORARILY_REMOVED',
  );

  // Expired temp removal no longer blocks re-entry
  const past = new Date(Date.now() - 3_600_000);
  assert.equal(
    validateRoomAndTeamJoin({
      room,
      team,
      competition: comp,
      userCampusId: 1,
      existingParticipationInCompetition: null,
      teamRemovalState: { status: 'temp_removed', expiresAt: past },
    }).allowed,
    true,
  );

  assert.equal(
    validateRoomAndTeamJoin({
      room,
      team,
      competition: comp,
      userCampusId: 1,
      existingParticipationInCompetition: { teamId: 5, status: 'removed' },
    }).code,
    'COMPETITION_PARTICIPANT_REMOVED',
  );
});

test('Seed invariants: exact 5 NFSU campuses, >=50 CTFs across 14 categories, >=20 books, valid external platforms', () => {
  assert.equal(INITIAL_NFSU_CAMPUSES.length, 5);
  assert.deepEqual(
    INITIAL_NFSU_CAMPUSES.map((c) => c.name),
    [
      'NFSU Gandhinagar',
      'NFSU Delhi',
      'NFSU Tripura',
      'NFSU Dharwad',
      'NFSU Guwahati',
    ],
  );

  assert.ok(SEEDED_CTF_CHALLENGES.length >= 50, `Expected >=50 CTF challenges, got ${SEEDED_CTF_CHALLENGES.length}`);
  const ctfSlugs = new Set(SEEDED_CTF_CHALLENGES.map((c) => c.slug));
  assert.equal(ctfSlugs.size, SEEDED_CTF_CHALLENGES.length);
  for (const category of CTF_CATEGORIES) {
    assert.ok(
      SEEDED_CTF_CHALLENGES.some((c) => c.category === category),
      `Missing CTF challenges for category: ${category}`,
    );
  }

  assert.ok(SEEDED_BOOKS.length >= 20, `Expected >=20 seeded books, got ${SEEDED_BOOKS.length}`);
  const bookSlugs = new Set(SEEDED_BOOKS.map((b) => b.slug));
  assert.equal(bookSlugs.size, SEEDED_BOOKS.length);
  for (const book of SEEDED_BOOKS) {
    assert.ok(book.officialUrl.startsWith('https://'), `Unsafe book URL: ${book.officialUrl}`);
    if (!book.isFree || book.licenseType.toLowerCase().includes('copyright')) {
      assert.equal(isBookDownloadPermitted(book), false, `Copyrighted book must not permit download: ${book.slug}`);
    }
  }

  assert.ok(EXTERNAL_CTF_PLATFORMS.length >= 6);
  for (const ext of EXTERNAL_CTF_PLATFORMS) {
    assert.ok(ext.url.startsWith('https://'));
  }
});

test('Anti-scraping monitor throttles automated harvesters while preserving browsers and screen readers', () => {
  const monitor = new AntiScrapingMonitor();
  assert.equal(isLegitimateAssistiveOrBrowserUa('Mozilla/5.0 NVDA/2025.1'), true);
  assert.equal(isLegitimateAssistiveOrBrowserUa('VoiceOver/14 Safari/605.1'), true);
  assert.equal(isLegitimateAssistiveOrBrowserUa('Scrapy/2.11 (+https://scrapy.org)'), false);

  // Automated bulk scraper gets flagged immediately and throttled after 5 requests on /ctf
  for (let i = 0; i < 5; i += 1) {
    const res = monitor.checkRequest({
      clientKey: 'scraper-ip',
      path: '/ctf',
      userAgent: 'HTTrack/3.0x',
      nowMs: 1_000_000 + i * 100,
    });
    assert.equal(res.allowed, true);
    assert.equal(res.suspicious, true);
  }
  const blockedScraper = monitor.checkRequest({
    clientKey: 'scraper-ip',
    path: '/ctf',
    userAgent: 'HTTrack/3.0x',
    nowMs: 1_000_600,
  });
  assert.equal(blockedScraper.allowed, false);
  assert.ok(blockedScraper.retryAfterSeconds >= 1);

  // Assistive screen reader + normal browser user stays allowed for ordinary usage
  for (let i = 0; i < 15; i += 1) {
    const res = monitor.checkRequest({
      clientKey: 'learner-nvda',
      path: '/academy',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 NVDA/2025.1',
      nowMs: 2_000_000 + i * 1000,
    });
    assert.equal(res.allowed, true);
    assert.equal(res.suspicious, false);
  }
});

test('Pagination clamping, IP report validation, and honest trademark notice enforcement', () => {
  assert.equal(clampPaginationLimit('99999', 25, 25), 25);
  assert.equal(clampPaginationLimit('-5', 25, 25), 25);
  assert.equal(clampPaginationLimit('10', 25, 25), 10);

  // Honest trademark disclaimer: must use TM, must not falsely claim registered ® status
  assert.ok(KALI3977_BRAND_NOTICE.includes('unregistered common-law mark'));
  assert.ok(!KALI3977_BRAND_NOTICE.includes('registered trademark ®'));

  const badUrl = validateIpReportInput({
    reportType: 'copyright_takedown',
    targetType: 'course',
    targetRef: 'course/web-101',
    reporterName: 'Alice Rights',
    reporterEmail: 'alice@example.org',
    description: 'Unauthorized mirror hosting our training labs without attribution.',
    evidenceUrl: 'javascript:alert(1)',
  });
  assert.equal(badUrl.valid, false);

  const validReport = validateIpReportInput({
    reportType: 'cloning_scraping',
    targetType: 'platform_clone',
    targetRef: 'https://clone.invalid/kali3977',
    reporterName: 'Legal Ops',
    reporterEmail: 'LEGAL@KALI3977.ORG',
    organization: 'KALI3977',
    description: 'Mirror copying KALI3977 logo SVG and proprietary CTF prompts.',
    evidenceUrl: 'https://kali3977.org/legal',
  });
  assert.equal(validReport.valid, true);
  assert.equal(validReport.data?.reporterEmail, 'legal@kali3977.org');
});



