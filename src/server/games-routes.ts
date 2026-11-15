import express, { Router } from 'express';
import crypto from 'node:crypto';
import { and, desc, eq, gte, inArray, or, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  campuses,
  gameAchievements,
  gameAdminLogs,
  gameCategories,
  gameEvents,
  gameFriendships,
  gameInvitations,
  gameMissions,
  gamePlayerProfiles,
  gamePlayers,
  gameResults,
  gameRewards,
  gameRooms,
  gameSessions,
  gameTeams,
  gameTournamentParticipants,
  gameTournaments,
  games,
  notifications,
  teams,
  userGameAchievements,
  userGameMissions,
  users,
} from '../db/schema.ts';
import { AuthRequest, optionalAuth, requireAuth, requirePermission } from '../middleware/auth.ts';
import { generateSecureCode, sanitizeText } from '../lib/domain/security.ts';
import { GAME_COSMETICS_CATALOG, type GameEngineType } from '../lib/games/catalog-data.ts';
import {
  advanceGameTournamentMatch,
  calculateGameLevel,
  calculateMatchRewards,
  generateGameTournamentBracket,
  validateGameRoomJoin,
  type TournamentBracketStructure,
} from '../lib/games/validation.ts';
import {
  applyGameEngineAction,
  initializeGameSessionState,
  sanitizeSessionForPlayer,
} from '../lib/games/engines.ts';
import { broadcastGameRoomEvent, broadcastUserNotification } from './realtime.ts';

function getPeriodKeys(now = new Date()): { dailyKey: string; weeklyKey: string } {
  const dailyKey = now.toISOString().slice(0, 10);
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / 86_400_000);
  const week = Math.ceil((days + startOfYear.getUTCDay() + 1) / 7);
  return { dailyKey, weeklyKey: `${now.getUTCFullYear()}-W${String(week).padStart(2, '0')}` };
}

async function ensureGameProfile(userId: number) {
  const [existing] = await db
    .select()
    .from(gamePlayerProfiles)
    .where(eq(gamePlayerProfiles.userId, userId))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(gamePlayerProfiles)
    .values({ userId, gameXp: 0, gameLevel: 1, gameCoins: 100 })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  const [retry] = await db
    .select()
    .from(gamePlayerProfiles)
    .where(eq(gamePlayerProfiles.userId, userId))
    .limit(1);
  return retry;
}

async function recordGameAdminLog(params: {
  actorId: number;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
}) {
  await db.insert(gameAdminLogs).values({
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    detailsJson: params.details ?? {},
  });
}

async function grantGameAchievement(userId: number, code: string) {
  const [ach] = await db.select().from(gameAchievements).where(eq(gameAchievements.code, code)).limit(1);
  if (!ach) return;

  const existing = await db
    .select()
    .from(userGameAchievements)
    .where(and(eq(userGameAchievements.userId, userId), eq(userGameAchievements.achievementId, ach.id)))
    .limit(1);
  if (existing.length > 0) return;

  await db.insert(userGameAchievements).values({ userId, achievementId: ach.id }).onConflictDoNothing();
  const idempKey = `game_ach:${userId}:${ach.code}`;
  const [reward] = await db
    .insert(gameRewards)
    .values({
      userId,
      idempotencyKey: idempKey,
      sourceType: 'achievement',
      sourceId: ach.code,
      xpDelta: ach.xpBonus,
      coinsDelta: ach.coinsBonus,
      description: `Achievement unlocked: ${ach.title}`,
    })
    .onConflictDoNothing()
    .returning();

  if (reward) {
    const profile = await ensureGameProfile(userId);
    const nextXp = profile.gameXp + ach.xpBonus;
    const lvl = calculateGameLevel(nextXp);
    await db
      .update(gamePlayerProfiles)
      .set({
        gameXp: nextXp,
        gameLevel: lvl.level,
        gameCoins: sql`${gamePlayerProfiles.gameCoins} + ${ach.coinsBonus}`,
        updatedAt: new Date(),
      })
      .where(eq(gamePlayerProfiles.userId, userId));
    await db
      .update(users)
      .set({ xp: sql`${users.xp} + ${ach.xpBonus}` })
      .where(eq(users.id, userId));

    const [notif] = await db
      .insert(notifications)
      .values({
        userId,
        type: 'achievement',
        title: `Games Badge Unlocked: ${ach.title}`,
        body: `${ach.description} (+${ach.xpBonus} XP, +${ach.coinsBonus} Game Coins)`,
      })
      .returning();
    if (notif) broadcastUserNotification(userId, notif);
  }
}

async function advanceUserMissions(params: {
  userId: number;
  won: boolean;
  accuracyPct: number;
}) {
  const { dailyKey, weeklyKey } = getPeriodKeys();
  const activeMissions = await db.select().from(gameMissions).where(eq(gameMissions.isActive, true));

  for (const m of activeMissions) {
    let delta = 0;
    if (m.targetMetric === 'matches_played') delta = 1;
    else if (m.targetMetric === 'matches_won' && params.won) delta = 1;
    else if (m.targetMetric === 'high_accuracy_matches' && params.accuracyPct >= 80) delta = 1;
    if (delta === 0) continue;

    const periodKey = m.cadence === 'weekly' ? weeklyKey : dailyKey;
    const [existing] = await db
      .select()
      .from(userGameMissions)
      .where(
        and(
          eq(userGameMissions.userId, params.userId),
          eq(userGameMissions.missionId, m.id),
          eq(userGameMissions.periodKey, periodKey),
        ),
      )
      .limit(1);

    const nextProgress = Math.min(m.targetValue, (existing?.progress ?? 0) + delta);
    const completed = nextProgress >= m.targetValue;

    await db
      .insert(userGameMissions)
      .values({
        userId: params.userId,
        missionId: m.id,
        periodKey,
        progress: nextProgress,
        completed,
        claimed: existing?.claimed ?? false,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userGameMissions.userId, userGameMissions.missionId, userGameMissions.periodKey],
        set: { progress: nextProgress, completed, updatedAt: new Date() },
      });
  }
}

async function finalizeGameMatch(params: {
  room: typeof gameRooms.$inferSelect;
  session: typeof gameSessions.$inferSelect;
  game: typeof games.$inferSelect;
  nextState: Record<string, unknown>;
}) {
  const { room, session, game, nextState } = params;
  if (session.status === 'completed') return;

  await db
    .update(gameSessions)
    .set({ status: 'completed', phase: 'completed', endedAt: new Date(), stateJson: nextState })
    .where(eq(gameSessions.id, session.id));

  await db
    .update(gameRooms)
    .set({ status: 'completed', endedAt: new Date() })
    .where(eq(gameRooms.id, room.id));

  await db
    .update(games)
    .set({ playCount: sql`${games.playCount} + 1` })
    .where(eq(games.id, game.id));

  const playersList = await db
    .select()
    .from(gamePlayers)
    .where(eq(gamePlayers.roomId, room.id))
    .orderBy(desc(gamePlayers.score));

  const isMultiplayer = playersList.length > 1;
  const winnerTeamSocial = nextState.winnerTeam as string | null | undefined;
  const rolesSocial = (nextState.roles || {}) as Record<string, string>;

  for (let idx = 0; idx < playersList.length; idx++) {
    const p = playersList[idx];
    let won = idx === 0 && p.score > 0;
    if (game.engineType === 'social_deduction' && winnerTeamSocial) {
      const myRole = rolesSocial[String(p.userId)];
      won =
        (winnerTeamSocial === 'defenders' && myRole === 'defender') ||
        (winnerTeamSocial === 'hackers' && myRole === 'hacker');
    }

    const { xpAwarded, coinsAwarded } = calculateMatchRewards({
      scoringConfig: game.scoringConfigJson,
      won,
      score: p.score,
      accuracyPct: p.accuracyPct,
      isMultiplayer,
    });

    const [insertedResult] = await db
      .insert(gameResults)
      .values({
        roomId: room.id,
        sessionId: session.id,
        gameId: game.id,
        userId: p.userId,
        gameTeamId: p.gameTeamId,
        placement: idx + 1,
        finalScore: p.score,
        accuracyPct: p.accuracyPct,
        xpAwarded,
        coinsAwarded,
        won,
      })
      .onConflictDoNothing()
      .returning();

    if (insertedResult) {
      const idempKey = `match_result:${session.id}:${p.userId}`;
      const [reward] = await db
        .insert(gameRewards)
        .values({
          userId: p.userId,
          idempotencyKey: idempKey,
          sourceType: 'match',
          sourceId: String(session.id),
          xpDelta: xpAwarded,
          coinsDelta: coinsAwarded,
          description: `${game.title} match (${won ? 'Victory' : `Rank #${idx + 1}`})`,
        })
        .onConflictDoNothing()
        .returning();

      if (reward) {
        const profile = await ensureGameProfile(p.userId);
        const nextGameXp = profile.gameXp + xpAwarded;
        const lvl = calculateGameLevel(nextGameXp);
        const nextStreak = won ? profile.winStreak + 1 : 0;

        await db
          .update(gamePlayerProfiles)
          .set({
            gameXp: nextGameXp,
            gameLevel: lvl.level,
            gameCoins: sql`${gamePlayerProfiles.gameCoins} + ${coinsAwarded}`,
            matchesPlayed: sql`${gamePlayerProfiles.matchesPlayed} + 1`,
            matchesWon: won ? sql`${gamePlayerProfiles.matchesWon} + 1` : profile.matchesWon,
            winStreak: nextStreak,
            bestWinStreak: Math.max(profile.bestWinStreak, nextStreak),
            updatedAt: new Date(),
          })
          .where(eq(gamePlayerProfiles.userId, p.userId));

        await db
          .update(users)
          .set({ xp: sql`${users.xp} + ${xpAwarded}`, updatedAt: new Date() })
          .where(eq(users.id, p.userId));

        if (p.gameTeamId) {
          await db
            .update(gameTeams)
            .set({ score: sql`${gameTeams.score} + ${p.score}` })
            .where(eq(gameTeams.id, p.gameTeamId));
        }

        await advanceUserMissions({ userId: p.userId, won, accuracyPct: p.accuracyPct });
        await grantGameAchievement(p.userId, 'FIRST_ARENA_MATCH');
        if (won) await grantGameAchievement(p.userId, 'FIRST_VICTORY');
        if (nextStreak >= 3) await grantGameAchievement(p.userId, 'WIN_STREAK_3');
        if (isMultiplayer || p.gameTeamId) await grantGameAchievement(p.userId, 'MULTIPLAYER_TEAM_PLAY');
        if (game.engineType === 'investigation' && p.accuracyPct >= 80) {
          await grantGameAchievement(p.userId, 'SHARP_DETECTIVE');
        }
        if (game.engineType === 'social_deduction' && won) {
          await grantGameAchievement(p.userId, 'SOCIAL_SLEUTH');
        }
      }
    }
  }

  broadcastGameRoomEvent(room.roomCode, 'games:match_ended', {
    sessionId: session.id,
    winnerTeam: winnerTeamSocial ?? null,
  });
}

async function buildRoomSnapshot(roomId: number, requestingUserId: number | null) {
  const [room] = await db.select().from(gameRooms).where(eq(gameRooms.id, roomId)).limit(1);
  if (!room) return null;

  const [game] = await db.select().from(games).where(eq(games.id, room.gameId)).limit(1);
  const [playersRows, teamsRows, latestSessionRows] = await Promise.all([
    db
      .select({
        id: gamePlayers.id,
        userId: gamePlayers.userId,
        username: users.username,
        displayName: users.displayName,
        gameTeamId: gamePlayers.gameTeamId,
        side: gamePlayers.side,
        roleInGame: gamePlayers.roleInGame,
        ready: gamePlayers.ready,
        connected: gamePlayers.connected,
        status: gamePlayers.status,
        score: gamePlayers.score,
        accuracyPct: gamePlayers.accuracyPct,
        actionsCount: gamePlayers.actionsCount,
      })
      .from(gamePlayers)
      .innerJoin(users, eq(gamePlayers.userId, users.id))
      .where(eq(gamePlayers.roomId, room.id))
      .orderBy(desc(gamePlayers.score), gamePlayers.joinedAt),
    db.select().from(gameTeams).where(eq(gameTeams.roomId, room.id)),
    db
      .select()
      .from(gameSessions)
      .where(eq(gameSessions.roomId, room.id))
      .orderBy(desc(gameSessions.startedAt))
      .limit(1),
  ]);

  const latestSession = latestSessionRows[0] || null;
  const sanitizedSession = latestSession
    ? {
        id: latestSession.id,
        status: latestSession.status,
        phase: latestSession.phase,
        roundNumber: latestSession.roundNumber,
        startedAt: latestSession.startedAt,
        endedAt: latestSession.endedAt,
        state: sanitizeSessionForPlayer(
          latestSession.stateJson,
          requestingUserId,
          latestSession.status,
        ),
      }
    : null;

  const myPlayer = requestingUserId
    ? playersRows.find((p) => p.userId === requestingUserId) || null
    : null;

  return {
    room: {
      id: room.id,
      roomCode: room.roomCode,
      gameId: room.gameId,
      hostUserId: room.hostUserId,
      name: room.name,
      mode: room.mode,
      visibility: room.visibility,
      requiresTeamCode: room.requiresTeamCode,
      isLocked: room.isLocked,
      status: room.status,
      registrationOpen: room.registrationOpen,
      maxPlayers: room.maxPlayers,
      durationSeconds: room.durationSeconds,
      startedAt: room.startedAt,
      endedAt: room.endedAt,
    },
    game,
    players: playersRows,
    teams: teamsRows.map((t) => ({
      id: t.id,
      name: t.name,
      teamCode: t.teamCode,
      side: t.side,
      score: t.score,
      maxMembers: t.maxMembers,
      isActive: t.isActive,
      isSuspended: t.isSuspended,
    })),
    myPlayer,
    session: sanitizedSession,
  };
}

export function createGamesRouter(): Router {
  const router = Router();
  router.use(express.json({ limit: '256kb' }));

  // =========================================================================
  // 1. CATALOG, GAME DETAILS, ACTIVE ROOMS & PLAYER SUMMARY
  // =========================================================================
  router.get('/catalog', optionalAuth, async (req: AuthRequest, res) => {
    const [categories, allGames, openRooms] = await Promise.all([
      db.select().from(gameCategories).orderBy(gameCategories.orderIndex),
      db
        .select()
        .from(games)
        .where(eq(games.isPublished, true))
        .orderBy(games.categoryId, games.id),
      db
        .select({
          id: gameRooms.id,
          roomCode: gameRooms.roomCode,
          gameId: gameRooms.gameId,
          gameTitle: games.title,
          gameSlug: games.slug,
          name: gameRooms.name,
          mode: gameRooms.mode,
          visibility: gameRooms.visibility,
          requiresTeamCode: gameRooms.requiresTeamCode,
          status: gameRooms.status,
          maxPlayers: gameRooms.maxPlayers,
          createdAt: gameRooms.createdAt,
          playerCount: sql<number>`(SELECT count(*)::int FROM game_players gp WHERE gp.room_id = ${gameRooms.id} AND gp.status = 'active')`,
        })
        .from(gameRooms)
        .innerJoin(games, eq(gameRooms.gameId, games.id))
        .where(
          and(
            eq(gameRooms.visibility, 'public'),
            inArray(gameRooms.status, ['waiting', 'active']),
            eq(gameRooms.isLocked, false),
          ),
        )
        .orderBy(desc(gameRooms.createdAt))
        .limit(20),
    ]);

    let playerSummary = null;
    if (req.dbUser) {
      const u = req.dbUser;
      const profile = await ensureGameProfile(u.id);
      const { dailyKey, weeklyKey } = getPeriodKeys();

      const [missions, userMissions, allAchievements, earnedAchievements, recentResults, pendingInvites, myActiveRooms] =
        await Promise.all([
          db.select().from(gameMissions).where(eq(gameMissions.isActive, true)),
          db
            .select()
            .from(userGameMissions)
            .where(
              and(
                eq(userGameMissions.userId, u.id),
                inArray(userGameMissions.periodKey, [dailyKey, weeklyKey]),
              ),
            ),
          db.select().from(gameAchievements),
          db
            .select({
              achievementId: userGameAchievements.achievementId,
              earnedAt: userGameAchievements.earnedAt,
            })
            .from(userGameAchievements)
            .where(eq(userGameAchievements.userId, u.id)),
          db
            .select({
              id: gameResults.id,
              gameTitle: games.title,
              gameSlug: games.slug,
              placement: gameResults.placement,
              finalScore: gameResults.finalScore,
              accuracyPct: gameResults.accuracyPct,
              xpAwarded: gameResults.xpAwarded,
              coinsAwarded: gameResults.coinsAwarded,
              won: gameResults.won,
              createdAt: gameResults.createdAt,
            })
            .from(gameResults)
            .innerJoin(games, eq(gameResults.gameId, games.id))
            .where(eq(gameResults.userId, u.id))
            .orderBy(desc(gameResults.createdAt))
            .limit(12),
          db
            .select({
              id: gameInvitations.id,
              roomCode: gameRooms.roomCode,
              roomName: gameRooms.name,
              gameTitle: games.title,
              invitedBy: users.username,
              createdAt: gameInvitations.createdAt,
            })
            .from(gameInvitations)
            .innerJoin(gameRooms, eq(gameInvitations.roomId, gameRooms.id))
            .innerJoin(games, eq(gameRooms.gameId, games.id))
            .innerJoin(users, eq(gameInvitations.invitedByUserId, users.id))
            .where(and(eq(gameInvitations.invitedUserId, u.id), eq(gameInvitations.status, 'pending'))),
          db
            .select({
              roomCode: gameRooms.roomCode,
              roomName: gameRooms.name,
              gameTitle: games.title,
              status: gameRooms.status,
              mode: gameRooms.mode,
            })
            .from(gamePlayers)
            .innerJoin(gameRooms, eq(gamePlayers.roomId, gameRooms.id))
            .innerJoin(games, eq(gameRooms.gameId, games.id))
            .where(
              and(
                eq(gamePlayers.userId, u.id),
                inArray(gameRooms.status, ['waiting', 'countdown', 'active']),
              ),
            ),
        ]);

      const earnedMap = new Map(earnedAchievements.map((e) => [e.achievementId, e.earnedAt]));
      const missionMap = new Map(userMissions.map((um) => [um.missionId, um]));
      const levelInfo = calculateGameLevel(profile.gameXp);

      playerSummary = {
        profile: {
          ...profile,
          levelInfo,
        },
        missions: missions.map((m) => {
          const um = missionMap.get(m.id);
          return {
            ...m,
            progress: um?.progress ?? 0,
            completed: um?.completed ?? false,
            claimed: um?.claimed ?? false,
          };
        }),
        achievements: allAchievements.map((a) => ({
          ...a,
          earned: earnedMap.has(a.id),
          earnedAt: earnedMap.get(a.id) ?? null,
        })),
        cosmetics: GAME_COSMETICS_CATALOG,
        recentResults,
        pendingInvites,
        myActiveRooms,
      };
    }

    res.json({
      categories,
      games: allGames,
      openRooms,
      playerSummary,
    });
  });

  router.get('/detail/:slug', optionalAuth, async (req: AuthRequest, res) => {
    const slug = sanitizeText(String(req.params.slug || ''), 80);
    const [game] = await db.select().from(games).where(eq(games.slug, slug)).limit(1);
    if (!game) return res.status(404).json({ error: 'Game not found.' });

    const [cat, topScores, rooms] = await Promise.all([
      db.select().from(gameCategories).where(eq(gameCategories.id, game.categoryId)).limit(1),
      db
        .select({
          userId: users.id,
          username: users.username,
          displayName: users.displayName,
          finalScore: gameResults.finalScore,
          accuracyPct: gameResults.accuracyPct,
          won: gameResults.won,
          createdAt: gameResults.createdAt,
        })
        .from(gameResults)
        .innerJoin(users, eq(gameResults.userId, users.id))
        .where(eq(gameResults.gameId, game.id))
        .orderBy(desc(gameResults.finalScore))
        .limit(10),
      db
        .select({
          id: gameRooms.id,
          roomCode: gameRooms.roomCode,
          name: gameRooms.name,
          mode: gameRooms.mode,
          status: gameRooms.status,
          requiresTeamCode: gameRooms.requiresTeamCode,
          maxPlayers: gameRooms.maxPlayers,
          playerCount: sql<number>`(SELECT count(*)::int FROM game_players gp WHERE gp.room_id = ${gameRooms.id} AND gp.status = 'active')`,
        })
        .from(gameRooms)
        .where(
          and(
            eq(gameRooms.gameId, game.id),
            eq(gameRooms.visibility, 'public'),
            inArray(gameRooms.status, ['waiting', 'active']),
          ),
        )
        .orderBy(desc(gameRooms.createdAt))
        .limit(10),
    ]);

    res.json({
      game,
      category: cat[0] || null,
      leaderboard: topScores,
      openRooms: rooms,
    });
  });

  // =========================================================================
  // 2. ROOM CREATION, ROOM+TEAM CODE JOINING, MATCHMAKING & INVITES
  // =========================================================================
  router.post('/rooms', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const gameId = Number(req.body.gameId);
    const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
    if (!game || !game.isEnabled) {
      return res.status(400).json({ error: 'Selected game is unavailable or disabled by admin.' });
    }

    const mode = sanitizeText(String(req.body.mode || 'solo'), 32);
    if (!game.supportedModesJson.includes(mode)) {
      return res.status(400).json({ error: `Mode "${mode}" is not supported for ${game.title}.` });
    }

    const visibility = req.body.visibility === 'private' ? 'private' : 'public';
    const requiresTeamCode =
      Boolean(req.body.requiresTeamCode) || mode === 'team_vs_team' || mode === 'campus_vs_campus';
    const maxPlayers = Math.max(
      game.minPlayers,
      Math.min(game.maxPlayers, Number(req.body.maxPlayers || (mode === 'solo' ? 1 : game.maxPlayers))),
    );
    const name = sanitizeText(String(req.body.name || `${game.title} Arena`), 80);
    const roomCode = generateSecureCode(`GA-${game.slug.slice(0, 3).toUpperCase()}`);

    const [createdRoom] = await db
      .insert(gameRooms)
      .values({
        roomCode,
        gameId: game.id,
        hostUserId: u.id,
        name,
        mode,
        visibility,
        requiresTeamCode,
        maxPlayers,
        usageLimit: maxPlayers * 2,
        durationSeconds: game.durationSeconds,
        rulesSnapshotJson: {
          mode,
          scoringConfig: game.scoringConfigJson,
          durationSeconds: game.durationSeconds,
        },
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      })
      .returning();

    let hostGameTeamId: number | null = null;
    let createdTeams: Array<{ id: number; name: string; teamCode: string; side: string }> = [];

    if (requiresTeamCode) {
      const alphaCode = generateSecureCode('TM-ALP');
      const betaCode = generateSecureCode('TM-BET');
      const teamRows = await db
        .insert(gameTeams)
        .values([
          {
            roomId: createdRoom.id,
            campusId: u.campusId,
            teamCode: alphaCode,
            name: sanitizeText(String(req.body.teamAlphaName || 'Team Alpha'), 60),
            side: 'alpha',
            maxMembers: Math.max(2, Math.ceil(maxPlayers / 2)),
            codeUsageLimit: maxPlayers,
          },
          {
            roomId: createdRoom.id,
            teamCode: betaCode,
            name: sanitizeText(String(req.body.teamBetaName || 'Team Beta'), 60),
            side: 'beta',
            maxMembers: Math.max(2, Math.ceil(maxPlayers / 2)),
            codeUsageLimit: maxPlayers,
          },
        ])
        .returning();
      createdTeams = teamRows.map((t) => ({ id: t.id, name: t.name, teamCode: t.teamCode, side: t.side }));
      hostGameTeamId = teamRows[0]?.id ?? null;
    }

    await db.insert(gamePlayers).values({
      roomId: createdRoom.id,
      userId: u.id,
      gameTeamId: hostGameTeamId,
      side: hostGameTeamId ? 'alpha' : 'solo',
      roleInGame: 'host',
      ready: true,
      connected: true,
      reconnectToken: crypto.randomBytes(12).toString('hex'),
    });

    const snapshot = await buildRoomSnapshot(createdRoom.id, u.id);
    res.status(201).json({
      ...snapshot,
      createdTeams,
    });
  });

  router.post('/rooms/join', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const roomCode = sanitizeText(String(req.body.roomCode || ''), 32).toUpperCase();
    const teamCode = sanitizeText(String(req.body.teamCode || ''), 32).toUpperCase();

    if (!roomCode) {
      return res.status(400).json({ error: 'Room Code is required.' });
    }

    const [room] = await db.select().from(gameRooms).where(eq(gameRooms.roomCode, roomCode)).limit(1);
    let team: typeof gameTeams.$inferSelect | null = null;
    if (teamCode) {
      const [foundTeam] = await db.select().from(gameTeams).where(eq(gameTeams.teamCode, teamCode)).limit(1);
      team = foundTeam || null;
      if (!team) {
        return res.status(400).json({ error: 'Provided Team Code is invalid or does not exist.' });
      }
    }

    const currentPlayersRows = room
      ? await db.select().from(gamePlayers).where(eq(gamePlayers.roomId, room.id))
      : [];
    const activeCount = currentPlayersRows.filter((p) => p.status === 'active').length;
    const alreadyInRoom = currentPlayersRows.some((p) => p.userId === u.id);

    const teamMemberCount = team
      ? currentPlayersRows.filter((p) => p.gameTeamId === team!.id && p.status === 'active').length
      : 0;

    const validation = validateGameRoomJoin({
      room: room
        ? {
            id: room.id,
            roomCode: room.roomCode,
            gameId: room.gameId,
            status: room.status,
            isLocked: room.isLocked,
            registrationOpen: room.registrationOpen,
            requiresTeamCode: room.requiresTeamCode,
            maxPlayers: room.maxPlayers,
            currentPlayers: activeCount,
            usageCount: room.usageCount,
            usageLimit: room.usageLimit,
            expiresAt: room.expiresAt,
          }
        : null,
      team: team
        ? {
            id: team.id,
            roomId: team.roomId,
            campusId: team.campusId,
            teamCode: team.teamCode,
            name: team.name,
            isActive: team.isActive,
            isSuspended: team.isSuspended,
            maxMembers: team.maxMembers,
            currentMembers: teamMemberCount,
            codeUsageCount: team.codeUsageCount,
            codeUsageLimit: team.codeUsageLimit,
            codeExpiresAt: team.codeExpiresAt,
          }
        : null,
      userId: u.id,
      userSuspended: u.isSuspended,
      userBanned: u.isBanned,
      userCampusId: u.campusId,
      requiresCampusMatch: room?.mode === 'campus_vs_campus',
      alreadyInRoom,
    });

    if (!validation.allowed) {
      return res.status(400).json({ code: validation.code, error: validation.message });
    }

    if (alreadyInRoom && room) {
      await db
        .update(gamePlayers)
        .set({ connected: true, disconnectedAt: null, lastHeartbeatAt: new Date() })
        .where(and(eq(gamePlayers.roomId, room.id), eq(gamePlayers.userId, u.id)));
    } else if (room) {
      await db.insert(gamePlayers).values({
        roomId: room.id,
        userId: u.id,
        gameTeamId: team?.id ?? null,
        side: team?.side ?? 'solo',
        roleInGame: 'player',
        ready: false,
        connected: true,
        reconnectToken: crypto.randomBytes(12).toString('hex'),
      });
      await db
        .update(gameRooms)
        .set({ usageCount: sql`${gameRooms.usageCount} + 1` })
        .where(eq(gameRooms.id, room.id));
      if (team) {
        await db
          .update(gameTeams)
          .set({ codeUsageCount: sql`${gameTeams.codeUsageCount} + 1` })
          .where(eq(gameTeams.id, team.id));
      }
      broadcastGameRoomEvent(room.roomCode, 'games:room_updated', { joinedUserId: u.id });
    }

    const snapshot = await buildRoomSnapshot(room!.id, u.id);
    res.json(snapshot);
  });

  router.post('/matchmaking', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const gameId = Number(req.body.gameId);
    const mode = sanitizeText(String(req.body.mode || 'free_for_all'), 32);
    const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
    if (!game || !game.isEnabled) {
      return res.status(400).json({ error: 'Selected game is unavailable.' });
    }

    // Look for an open public waiting room for this game and mode with space
    const candidates = await db
      .select()
      .from(gameRooms)
      .where(
        and(
          eq(gameRooms.gameId, game.id),
          eq(gameRooms.mode, mode),
          eq(gameRooms.visibility, 'public'),
          eq(gameRooms.status, 'waiting'),
          eq(gameRooms.isLocked, false),
          eq(gameRooms.requiresTeamCode, false),
        ),
      )
      .orderBy(desc(gameRooms.createdAt))
      .limit(10);

    for (const candidate of candidates) {
      const members = await db.select().from(gamePlayers).where(eq(gamePlayers.roomId, candidate.id));
      const already = members.some((m) => m.userId === u.id);
      if (already) {
        const snapshot = await buildRoomSnapshot(candidate.id, u.id);
        return res.json({ matchedExisting: true, ...snapshot });
      }
      if (members.length < candidate.maxPlayers) {
        await db.insert(gamePlayers).values({
          roomId: candidate.id,
          userId: u.id,
          side: 'solo',
          roleInGame: 'player',
          ready: true,
          connected: true,
          reconnectToken: crypto.randomBytes(12).toString('hex'),
        });
        broadcastGameRoomEvent(candidate.roomCode, 'games:room_updated', { joinedUserId: u.id });
        const snapshot = await buildRoomSnapshot(candidate.id, u.id);
        return res.json({ matchedExisting: true, ...snapshot });
      }
    }

    // No open waiting room found -> provision new quick-match room
    const roomCode = generateSecureCode(`GA-${game.slug.slice(0, 3).toUpperCase()}`);
    const [created] = await db
      .insert(gameRooms)
      .values({
        roomCode,
        gameId: game.id,
        hostUserId: u.id,
        name: `${game.title} Quick Match`,
        mode,
        visibility: 'public',
        requiresTeamCode: false,
        maxPlayers: mode === '1v1' ? 2 : game.maxPlayers,
        durationSeconds: game.durationSeconds,
        expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
      })
      .returning();

    await db.insert(gamePlayers).values({
      roomId: created.id,
      userId: u.id,
      side: 'solo',
      roleInGame: 'host',
      ready: true,
      connected: true,
      reconnectToken: crypto.randomBytes(12).toString('hex'),
    });

    const snapshot = await buildRoomSnapshot(created.id, u.id);
    res.status(201).json({ matchedExisting: false, ...snapshot });
  });

  // =========================================================================
  // 3. LIVE LOBBY, READY, INVITE, START, ACTIONS, CHAT, RECONNECTION
  // =========================================================================
  router.get('/rooms/:roomCode', optionalAuth, async (req: AuthRequest, res) => {
    const code = sanitizeText(String(req.params.roomCode || ''), 32).toUpperCase();
    const [room] = await db.select().from(gameRooms).where(eq(gameRooms.roomCode, code)).limit(1);
    if (!room) return res.status(404).json({ error: 'Room not found.' });
    const snapshot = await buildRoomSnapshot(room.id, req.dbUser?.id ?? null);
    res.json(snapshot);
  });

  router.post('/rooms/:roomCode/ready', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const code = sanitizeText(String(req.params.roomCode || ''), 32).toUpperCase();
    const [room] = await db.select().from(gameRooms).where(eq(gameRooms.roomCode, code)).limit(1);
    if (!room) return res.status(404).json({ error: 'Room not found.' });

    const [player] = await db
      .select()
      .from(gamePlayers)
      .where(and(eq(gamePlayers.roomId, room.id), eq(gamePlayers.userId, u.id)))
      .limit(1);
    if (!player) return res.status(403).json({ error: 'Join the room first.' });

    const nextReady = typeof req.body.ready === 'boolean' ? req.body.ready : !player.ready;
    await db
      .update(gamePlayers)
      .set({ ready: nextReady, connected: true, lastHeartbeatAt: new Date() })
      .where(eq(gamePlayers.id, player.id));

    broadcastGameRoomEvent(room.roomCode, 'games:player_ready', { userId: u.id, ready: nextReady });
    const snapshot = await buildRoomSnapshot(room.id, u.id);
    res.json(snapshot);
  });

  router.post('/rooms/:roomCode/invite', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const code = sanitizeText(String(req.params.roomCode || ''), 32).toUpperCase();
    const targetUsername = sanitizeText(String(req.body.username || ''), 60).toLowerCase();
    const [room] = await db.select().from(gameRooms).where(eq(gameRooms.roomCode, code)).limit(1);
    if (!room) return res.status(404).json({ error: 'Room not found.' });

    const [target] = await db
      .select()
      .from(users)
      .where(or(eq(users.username, targetUsername), eq(users.email, targetUsername)))
      .limit(1);
    if (!target) return res.status(404).json({ error: 'Player username or email not found.' });
    if (target.id === u.id) return res.status(400).json({ error: 'Cannot invite yourself.' });

    await db.insert(gameInvitations).values({
      roomId: room.id,
      invitedUserId: target.id,
      invitedByUserId: u.id,
      status: 'pending',
    });

    const [notif] = await db
      .insert(notifications)
      .values({
        userId: target.id,
        type: 'game_invite',
        title: `Games Arena Invite from @${u.username}`,
        body: `Join room "${room.name}" using Room Code: ${room.roomCode}`,
      })
      .returning();
    if (notif) broadcastUserNotification(target.id, notif);

    res.json({ ok: true, invitedUsername: target.username });
  });

  router.post('/rooms/:roomCode/start', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const code = sanitizeText(String(req.params.roomCode || ''), 32).toUpperCase();
    const [room] = await db.select().from(gameRooms).where(eq(gameRooms.roomCode, code)).limit(1);
    if (!room) return res.status(404).json({ error: 'Room not found.' });

    const isAdmin = ['owner', 'event_admin'].includes(u.role);
    if (room.hostUserId !== u.id && !isAdmin) {
      return res.status(403).json({ error: 'Only the room host or Games Admin can start the match.' });
    }
    if (room.status === 'active') {
      const snapshot = await buildRoomSnapshot(room.id, u.id);
      return res.json(snapshot);
    }

    const [game] = await db.select().from(games).where(eq(games.id, room.gameId)).limit(1);
    if (!game || !game.isEnabled) return res.status(400).json({ error: 'Game is currently disabled.' });

    const playersRows = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        side: gamePlayers.side,
      })
      .from(gamePlayers)
      .innerJoin(users, eq(gamePlayers.userId, users.id))
      .where(and(eq(gamePlayers.roomId, room.id), eq(gamePlayers.status, 'active')));

    if (playersRows.length === 0) {
      return res.status(400).json({ error: 'At least one active player is required.' });
    }

    const seed = crypto.randomBytes(12).toString('hex');
    const initialState = initializeGameSessionState({
      engineType: game.engineType as GameEngineType,
      gameSlug: game.slug,
      mode: room.mode,
      players: playersRows,
      seed,
    });

    await db
      .update(gameRooms)
      .set({ status: 'active', startedAt: new Date() })
      .where(eq(gameRooms.id, room.id));

    await db.insert(gameSessions).values({
      roomId: room.id,
      gameId: game.id,
      status: 'active',
      phase: String(initialState.phase || 'play'),
      roundNumber: 1,
      maxRounds: 4,
      seed,
      stateJson: initialState,
    });

    broadcastGameRoomEvent(room.roomCode, 'games:match_started', { gameSlug: game.slug });
    const snapshot = await buildRoomSnapshot(room.id, u.id);
    res.json(snapshot);
  });

  router.post('/rooms/:roomCode/action', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const code = sanitizeText(String(req.params.roomCode || ''), 32).toUpperCase();
    const clientEventId = sanitizeText(String(req.body.clientEventId || ''), 80);
    const eventType = sanitizeText(String(req.body.eventType || ''), 48);
    const payload =
      req.body.payload && typeof req.body.payload === 'object'
        ? (req.body.payload as Record<string, unknown>)
        : {};

    if (!clientEventId || !eventType) {
      return res.status(400).json({ error: 'clientEventId and eventType are required.' });
    }

    const [room] = await db.select().from(gameRooms).where(eq(gameRooms.roomCode, code)).limit(1);
    if (!room) return res.status(404).json({ error: 'Room not found.' });
    if (room.status === 'paused') return res.status(400).json({ error: 'Match is paused by admin.' });
    if (room.status !== 'active') return res.status(400).json({ error: 'Match is not active.' });

    // Idempotency / Replay protection
    const [existingEvt] = await db
      .select()
      .from(gameEvents)
      .where(and(eq(gameEvents.roomId, room.id), eq(gameEvents.clientEventId, clientEventId)))
      .limit(1);
    if (existingEvt) {
      const snapshot = await buildRoomSnapshot(room.id, u.id);
      return res.json({ idempotentReplay: true, feedback: 'Event already processed.', ...snapshot });
    }

    const [player] = await db
      .select()
      .from(gamePlayers)
      .where(and(eq(gamePlayers.roomId, room.id), eq(gamePlayers.userId, u.id), eq(gamePlayers.status, 'active')))
      .limit(1);
    if (!player) return res.status(403).json({ error: 'You are not an active player in this room.' });

    const [game] = await db.select().from(games).where(eq(games.id, room.gameId)).limit(1);
    const [session] = await db
      .select()
      .from(gameSessions)
      .where(and(eq(gameSessions.roomId, room.id), eq(gameSessions.status, 'active')))
      .orderBy(desc(gameSessions.startedAt))
      .limit(1);

    if (!game || !session) return res.status(404).json({ error: 'Active session not found.' });

    const elapsedSeconds = Math.max(
      0,
      Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000),
    );

    const outcome = applyGameEngineAction({
      state: session.stateJson,
      userId: u.id,
      displayName: u.displayName,
      eventType,
      payload,
      elapsedSeconds,
    });

    await db.insert(gameEvents).values({
      roomId: room.id,
      sessionId: session.id,
      userId: u.id,
      clientEventId,
      eventType,
      payloadJson: payload,
      pointsAwarded: outcome.pointsAwarded,
      isValid: outcome.valid,
    });

    if (outcome.valid) {
      const nextActions = player.actionsCount + 1;
      const newAccuracy =
        eventType === 'submit_case' && outcome.nextState.submissionsByUser
          ? ((outcome.nextState.submissionsByUser as Record<string, { accuracyPct?: number }>)[String(u.id)]?.accuracyPct ?? 100)
          : outcome.pointsAwarded > 0
            ? Math.min(100, Math.round(((player.accuracyPct * player.actionsCount + 100) / nextActions)))
            : Math.max(25, Math.round(((player.accuracyPct * player.actionsCount + 40) / nextActions)));

      await db
        .update(gamePlayers)
        .set({
          score: sql`${gamePlayers.score} + ${outcome.pointsAwarded}`,
          actionsCount: nextActions,
          accuracyPct: newAccuracy,
          lastHeartbeatAt: new Date(),
        })
        .where(eq(gamePlayers.id, player.id));

      await db
        .update(gameSessions)
        .set({
          stateJson: outcome.nextState,
          phase: String(outcome.nextState.phase || session.phase),
          roundNumber: Number(outcome.nextState.roundNumber || session.roundNumber),
        })
        .where(eq(gameSessions.id, session.id));

      if (outcome.matchEnded) {
        await finalizeGameMatch({ room, session, game, nextState: outcome.nextState });
      } else {
        broadcastGameRoomEvent(room.roomCode, 'games:state_sync', {
          actorUserId: u.id,
          eventType,
        });
      }
    }

    const snapshot = await buildRoomSnapshot(room.id, u.id);
    res.json({
      valid: outcome.valid,
      pointsAwarded: outcome.pointsAwarded,
      feedback: outcome.feedback,
      matchEnded: outcome.matchEnded,
      ...snapshot,
    });
  });

  router.post('/rooms/:roomCode/finish', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const code = sanitizeText(String(req.params.roomCode || ''), 32).toUpperCase();
    const [room] = await db.select().from(gameRooms).where(eq(gameRooms.roomCode, code)).limit(1);
    if (!room) return res.status(404).json({ error: 'Room not found.' });

    const isAdmin = ['owner', 'event_admin'].includes(u.role);
    if (room.hostUserId !== u.id && !isAdmin) {
      return res.status(403).json({ error: 'Only host or admin can conclude the match early.' });
    }

    const [game] = await db.select().from(games).where(eq(games.id, room.gameId)).limit(1);
    const [session] = await db
      .select()
      .from(gameSessions)
      .where(and(eq(gameSessions.roomId, room.id), eq(gameSessions.status, 'active')))
      .limit(1);

    if (game && session) {
      await finalizeGameMatch({ room, session, game, nextState: session.stateJson });
    }
    const snapshot = await buildRoomSnapshot(room.id, u.id);
    res.json(snapshot);
  });

  router.post('/rooms/:roomCode/chat', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const code = sanitizeText(String(req.params.roomCode || ''), 32).toUpperCase();
    const message = sanitizeText(String(req.body.message || ''), 320);
    if (!message) return res.status(400).json({ error: 'Message cannot be empty.' });

    const [room] = await db.select().from(gameRooms).where(eq(gameRooms.roomCode, code)).limit(1);
    if (!room) return res.status(404).json({ error: 'Room not found.' });

    const [player] = await db
      .select()
      .from(gamePlayers)
      .where(and(eq(gamePlayers.roomId, room.id), eq(gamePlayers.userId, u.id)))
      .limit(1);
    if (!player) return res.status(403).json({ error: 'Join the room to chat.' });

    const chatItem = {
      id: `${Date.now()}-${u.id}`,
      userId: u.id,
      username: u.username,
      displayName: u.displayName,
      message,
      createdAt: new Date().toISOString(),
    };
    broadcastGameRoomEvent(room.roomCode, 'games:chat_message', { chatItem });
    res.json({ ok: true, chatItem });
  });

  router.post('/rooms/:roomCode/leave', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const code = sanitizeText(String(req.params.roomCode || ''), 32).toUpperCase();
    const [room] = await db.select().from(gameRooms).where(eq(gameRooms.roomCode, code)).limit(1);
    if (!room) return res.status(404).json({ error: 'Room not found.' });

    await db
      .update(gamePlayers)
      .set({ status: 'left', connected: false })
      .where(and(eq(gamePlayers.roomId, room.id), eq(gamePlayers.userId, u.id)));
    broadcastGameRoomEvent(room.roomCode, 'games:room_updated', { leftUserId: u.id });
    res.json({ ok: true });
  });

  // =========================================================================
  // 4. PROGRESSION: MISSIONS, COSMETICS, FRIENDS & LEADERBOARDS
  // =========================================================================
  router.post('/missions/:missionId/claim', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const missionId = Number(req.params.missionId);
    const [mission] = await db.select().from(gameMissions).where(eq(gameMissions.id, missionId)).limit(1);
    if (!mission) return res.status(404).json({ error: 'Mission not found.' });

    const { dailyKey, weeklyKey } = getPeriodKeys();
    const periodKey = mission.cadence === 'weekly' ? weeklyKey : dailyKey;
    const [um] = await db
      .select()
      .from(userGameMissions)
      .where(
        and(
          eq(userGameMissions.userId, u.id),
          eq(userGameMissions.missionId, mission.id),
          eq(userGameMissions.periodKey, periodKey),
        ),
      )
      .limit(1);

    if (!um || !um.completed) {
      return res.status(400).json({ error: 'Mission objective not yet completed.' });
    }
    if (um.claimed) {
      return res.status(400).json({ error: 'Mission reward already claimed for this period.' });
    }

    const idempKey = `mission:${u.id}:${mission.id}:${periodKey}`;
    const [reward] = await db
      .insert(gameRewards)
      .values({
        userId: u.id,
        idempotencyKey: idempKey,
        sourceType: 'mission',
        sourceId: `${mission.code}:${periodKey}`,
        xpDelta: mission.xpReward,
        coinsDelta: mission.coinsReward,
        description: `Mission claimed: ${mission.title}`,
      })
      .onConflictDoNothing()
      .returning();

    await db
      .update(userGameMissions)
      .set({ claimed: true, updatedAt: new Date() })
      .where(eq(userGameMissions.id, um.id));

    if (reward) {
      const profile = await ensureGameProfile(u.id);
      const nextXp = profile.gameXp + mission.xpReward;
      await db
        .update(gamePlayerProfiles)
        .set({
          gameXp: nextXp,
          gameLevel: calculateGameLevel(nextXp).level,
          gameCoins: sql`${gamePlayerProfiles.gameCoins} + ${mission.coinsReward}`,
        })
        .where(eq(gamePlayerProfiles.userId, u.id));
      await db.update(users).set({ xp: sql`${users.xp} + ${mission.xpReward}` }).where(eq(users.id, u.id));
    }

    res.json({ ok: true, xpAwarded: mission.xpReward, coinsAwarded: mission.coinsReward });
  });

  router.post('/cosmetics/unlock', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const cosmeticId = sanitizeText(String(req.body.cosmeticId || ''), 60);
    const item = GAME_COSMETICS_CATALOG.find((c) => c.id === cosmeticId);
    if (!item) return res.status(404).json({ error: 'Cosmetic item not found.' });

    const profile = await ensureGameProfile(u.id);
    if (profile.unlockedCosmeticsJson.includes(item.id)) {
      return res.json({ ok: true, profile });
    }
    if (profile.gameCoins < item.costCoins) {
      return res.status(400).json({ error: `Need ${item.costCoins} Game Coins (you have ${profile.gameCoins}).` });
    }

    const nextUnlocked = [...profile.unlockedCosmeticsJson, item.id];
    const [updated] = await db
      .update(gamePlayerProfiles)
      .set({
        gameCoins: sql`${gamePlayerProfiles.gameCoins} - ${item.costCoins}`,
        unlockedCosmeticsJson: nextUnlocked,
        equippedCosmetic: item.type === 'theme' ? item.id : profile.equippedCosmetic,
        equippedBadge: item.type === 'badge' ? item.name : profile.equippedBadge,
        updatedAt: new Date(),
      })
      .where(eq(gamePlayerProfiles.userId, u.id))
      .returning();

    res.json({ ok: true, profile: updated });
  });

  router.post('/cosmetics/equip', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const cosmeticId = sanitizeText(String(req.body.cosmeticId || ''), 60);
    const item = GAME_COSMETICS_CATALOG.find((c) => c.id === cosmeticId);
    if (!item) return res.status(404).json({ error: 'Cosmetic item not found.' });

    const profile = await ensureGameProfile(u.id);
    if (!profile.unlockedCosmeticsJson.includes(item.id)) {
      return res.status(400).json({ error: 'Unlock this cosmetic with Game Coins first.' });
    }

    const [updated] = await db
      .update(gamePlayerProfiles)
      .set({
        equippedCosmetic: item.type === 'theme' ? item.id : profile.equippedCosmetic,
        equippedBadge: item.type === 'badge' ? item.name : profile.equippedBadge,
        updatedAt: new Date(),
      })
      .where(eq(gamePlayerProfiles.userId, u.id))
      .returning();
    res.json({ ok: true, profile: updated });
  });

  router.post('/friends', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const username = sanitizeText(String(req.body.username || ''), 60).toLowerCase();
    const [friend] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!friend) return res.status(404).json({ error: 'User not found.' });
    if (friend.id === u.id) return res.status(400).json({ error: 'Cannot add yourself.' });

    await db
      .insert(gameFriendships)
      .values({ userId: u.id, friendUserId: friend.id, status: 'accepted' })
      .onConflictDoNothing();
    res.json({ ok: true, friend: { id: friend.id, username: friend.username, displayName: friend.displayName } });
  });

  router.get('/leaderboards', optionalAuth, async (req: AuthRequest, res) => {
    const gameId = req.query.gameId ? Number(req.query.gameId) : null;
    const now = Date.now();
    const weekStart = new Date(now - 7 * 86_400_000);
    const monthStart = new Date(now - 30 * 86_400_000);
    const seasonStart = new Date(now - 90 * 86_400_000);

    const [globalBoard, campusBoard, weeklyBoard, monthlyBoard, seasonalBoard] = await Promise.all([
      db
        .select({
          userId: users.id,
          username: users.username,
          displayName: users.displayName,
          gameXp: gamePlayerProfiles.gameXp,
          gameLevel: gamePlayerProfiles.gameLevel,
          matchesWon: gamePlayerProfiles.matchesWon,
          matchesPlayed: gamePlayerProfiles.matchesPlayed,
          equippedBadge: gamePlayerProfiles.equippedBadge,
        })
        .from(gamePlayerProfiles)
        .innerJoin(users, eq(gamePlayerProfiles.userId, users.id))
        .orderBy(desc(gamePlayerProfiles.gameXp))
        .limit(20),
      db
        .select({
          campusId: campuses.id,
          code: campuses.code,
          name: campuses.name,
          totalScore: sql<number>`COALESCE(SUM(${gameResults.finalScore}), 0)::int`,
          wins: sql<number>`COALESCE(SUM(CASE WHEN ${gameResults.won} THEN 1 ELSE 0 END), 0)::int`,
        })
        .from(campuses)
        .leftJoin(users, eq(users.campusId, campuses.id))
        .leftJoin(gameResults, eq(gameResults.userId, users.id))
        .groupBy(campuses.id)
        .orderBy(desc(sql`COALESCE(SUM(${gameResults.finalScore}), 0)`))
        .limit(15),
      db
        .select({
          userId: users.id,
          username: users.username,
          displayName: users.displayName,
          totalScore: sql<number>`SUM(${gameResults.finalScore})::int`,
          xpEarned: sql<number>`SUM(${gameResults.xpAwarded})::int`,
          wins: sql<number>`SUM(CASE WHEN ${gameResults.won} THEN 1 ELSE 0 END)::int`,
        })
        .from(gameResults)
        .innerJoin(users, eq(gameResults.userId, users.id))
        .where(gte(gameResults.createdAt, weekStart))
        .groupBy(users.id)
        .orderBy(desc(sql`SUM(${gameResults.finalScore})`))
        .limit(15),
      db
        .select({
          userId: users.id,
          username: users.username,
          displayName: users.displayName,
          totalScore: sql<number>`SUM(${gameResults.finalScore})::int`,
          xpEarned: sql<number>`SUM(${gameResults.xpAwarded})::int`,
          wins: sql<number>`SUM(CASE WHEN ${gameResults.won} THEN 1 ELSE 0 END)::int`,
        })
        .from(gameResults)
        .innerJoin(users, eq(gameResults.userId, users.id))
        .where(gte(gameResults.createdAt, monthStart))
        .groupBy(users.id)
        .orderBy(desc(sql`SUM(${gameResults.finalScore})`))
        .limit(15),
      db
        .select({
          userId: users.id,
          username: users.username,
          displayName: users.displayName,
          totalScore: sql<number>`SUM(${gameResults.finalScore})::int`,
          xpEarned: sql<number>`SUM(${gameResults.xpAwarded})::int`,
          wins: sql<number>`SUM(CASE WHEN ${gameResults.won} THEN 1 ELSE 0 END)::int`,
        })
        .from(gameResults)
        .innerJoin(users, eq(gameResults.userId, users.id))
        .where(gte(gameResults.createdAt, seasonStart))
        .groupBy(users.id)
        .orderBy(desc(sql`SUM(${gameResults.finalScore})`))
        .limit(15),
    ]);

    let friendsBoard: typeof globalBoard = [];
    if (req.dbUser) {
      const friendRows = await db
        .select({ friendUserId: gameFriendships.friendUserId })
        .from(gameFriendships)
        .where(eq(gameFriendships.userId, req.dbUser.id));
      const ids = Array.from(new Set([req.dbUser.id, ...friendRows.map((f) => f.friendUserId)]));
      friendsBoard = await db
        .select({
          userId: users.id,
          username: users.username,
          displayName: users.displayName,
          gameXp: gamePlayerProfiles.gameXp,
          gameLevel: gamePlayerProfiles.gameLevel,
          matchesWon: gamePlayerProfiles.matchesWon,
          matchesPlayed: gamePlayerProfiles.matchesPlayed,
          equippedBadge: gamePlayerProfiles.equippedBadge,
        })
        .from(gamePlayerProfiles)
        .innerJoin(users, eq(gamePlayerProfiles.userId, users.id))
        .where(inArray(users.id, ids))
        .orderBy(desc(gamePlayerProfiles.gameXp));
    }

    const perGameBoard = gameId
      ? await db
          .select({
            userId: users.id,
            username: users.username,
            displayName: users.displayName,
            bestScore: sql<number>`MAX(${gameResults.finalScore})::int`,
            wins: sql<number>`SUM(CASE WHEN ${gameResults.won} THEN 1 ELSE 0 END)::int`,
          })
          .from(gameResults)
          .innerJoin(users, eq(gameResults.userId, users.id))
          .where(eq(gameResults.gameId, gameId))
          .groupBy(users.id)
          .orderBy(desc(sql`MAX(${gameResults.finalScore})`))
          .limit(15)
      : [];

    res.json({
      global: globalBoard,
      friends: friendsBoard,
      campus: campusBoard,
      game: perGameBoard,
      weekly: weeklyBoard,
      monthly: monthlyBoard,
      seasonal: seasonalBoard,
    });
  });

  // =========================================================================
  // 5. TOURNAMENTS & BRACKETS
  // =========================================================================
  router.get('/tournaments', optionalAuth, async (_req, res) => {
    const list = await db
      .select({
        id: gameTournaments.id,
        gameId: gameTournaments.gameId,
        gameTitle: games.title,
        gameSlug: games.slug,
        name: gameTournaments.name,
        description: gameTournaments.description,
        format: gameTournaments.format,
        mode: gameTournaments.mode,
        status: gameTournaments.status,
        maxParticipants: gameTournaments.maxParticipants,
        entryMinLevel: gameTournaments.entryMinLevel,
        rewardCoinsPool: gameTournaments.rewardCoinsPool,
        bracketsJson: gameTournaments.bracketsJson,
        startsAt: gameTournaments.startsAt,
      })
      .from(gameTournaments)
      .innerJoin(games, eq(gameTournaments.gameId, games.id))
      .orderBy(desc(gameTournaments.createdAt));

    const participants = await db.select().from(gameTournamentParticipants);
    res.json({
      tournaments: list.map((t) => ({
        ...t,
        participants: participants.filter((p) => p.tournamentId === t.id),
      })),
    });
  });

  router.post('/tournaments/:id/register', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const tournamentId = Number(req.params.id);
    const [t] = await db.select().from(gameTournaments).where(eq(gameTournaments.id, tournamentId)).limit(1);
    if (!t) return res.status(404).json({ error: 'Tournament not found.' });
    if (t.status !== 'registration_open') {
      return res.status(400).json({ error: 'Tournament registration is currently closed.' });
    }

    const profile = await ensureGameProfile(u.id);
    if (profile.gameLevel < t.entryMinLevel) {
      return res.status(400).json({ error: `Requires Games Arena Level ${t.entryMinLevel}+.` });
    }

    const existing = await db
      .select()
      .from(gameTournamentParticipants)
      .where(eq(gameTournamentParticipants.tournamentId, t.id));
    if (existing.some((p) => p.userId === u.id)) {
      return res.status(400).json({ error: 'You are already registered in this tournament.' });
    }
    if (existing.length >= t.maxParticipants) {
      return res.status(400).json({ error: 'Tournament capacity reached.' });
    }

    const [created] = await db
      .insert(gameTournamentParticipants)
      .values({
        tournamentId: t.id,
        userId: u.id,
        campusId: u.campusId,
        displayName: u.displayName,
        seedNumber: existing.length + 1,
      })
      .returning();

    res.status(201).json({ ok: true, participant: created });
  });

  // =========================================================================
  // 6. GAMES ARENA ADMIN CONTROLS (RBAC PROTECTED)
  // =========================================================================
  router.get(
    '/admin/overview',
    requireAuth,
    requirePermission('admin:manage_rooms'),
    async (_req, res) => {
      const [allGames, rooms, teamsRows, tournamentsRows, logs, activePlayersCount] = await Promise.all([
        db.select().from(games).orderBy(games.id),
        db
          .select({
            id: gameRooms.id,
            roomCode: gameRooms.roomCode,
            name: gameRooms.name,
            gameTitle: games.title,
            mode: gameRooms.mode,
            visibility: gameRooms.visibility,
            status: gameRooms.status,
            isLocked: gameRooms.isLocked,
            requiresTeamCode: gameRooms.requiresTeamCode,
            maxPlayers: gameRooms.maxPlayers,
            createdAt: gameRooms.createdAt,
            playerCount: sql<number>`(SELECT count(*)::int FROM game_players gp WHERE gp.room_id = ${gameRooms.id} AND gp.status = 'active')`,
          })
          .from(gameRooms)
          .innerJoin(games, eq(gameRooms.gameId, games.id))
          .orderBy(desc(gameRooms.createdAt))
          .limit(40),
        db.select().from(gameTeams).orderBy(desc(gameTeams.createdAt)).limit(40),
        db.select().from(gameTournaments).orderBy(desc(gameTournaments.createdAt)),
        db.select().from(gameAdminLogs).orderBy(desc(gameAdminLogs.createdAt)).limit(40),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(gamePlayers)
          .where(eq(gamePlayers.connected, true)),
      ]);

      res.json({
        games: allGames,
        rooms,
        teams: teamsRows,
        tournaments: tournamentsRows,
        logs,
        activePlayersCount: activePlayersCount[0]?.count ?? 0,
      });
    },
  );

  router.patch(
    '/admin/games/:id',
    requireAuth,
    requirePermission('admin:manage_content'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const gameId = Number(req.params.id);
      const patch: Record<string, unknown> = {};
      if (typeof req.body.isEnabled === 'boolean') patch.isEnabled = req.body.isEnabled;
      if (typeof req.body.isFeatured === 'boolean') patch.isFeatured = req.body.isFeatured;
      if (typeof req.body.difficulty === 'string') patch.difficulty = sanitizeText(req.body.difficulty, 24);
      if (typeof req.body.durationSeconds === 'number') {
        patch.durationSeconds = Math.max(60, Math.min(3600, Number(req.body.durationSeconds)));
      }

      const [updated] = await db.update(games).set(patch).where(eq(games.id, gameId)).returning();
      if (!updated) return res.status(404).json({ error: 'Game not found.' });

      await recordGameAdminLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'GAME_UPDATED',
        targetType: 'game',
        targetId: String(gameId),
        details: patch,
      });
      res.json({ game: updated });
    },
  );

  router.patch(
    '/admin/rooms/:id',
    requireAuth,
    requirePermission('admin:manage_rooms'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const roomId = Number(req.params.id);
      const patch: Record<string, unknown> = {};
      if (typeof req.body.isLocked === 'boolean') patch.isLocked = req.body.isLocked;
      if (typeof req.body.registrationOpen === 'boolean') patch.registrationOpen = req.body.registrationOpen;
      if (typeof req.body.status === 'string') {
        if (['waiting', 'active', 'paused', 'completed', 'terminated'].includes(req.body.status)) {
          patch.status = req.body.status;
        }
      }

      const [updated] = await db.update(gameRooms).set(patch).where(eq(gameRooms.id, roomId)).returning();
      if (!updated) return res.status(404).json({ error: 'Game room not found.' });

      await recordGameAdminLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'GAME_ROOM_UPDATED',
        targetType: 'game_room',
        targetId: updated.roomCode,
        details: patch,
      });
      broadcastGameRoomEvent(updated.roomCode, 'games:room_updated', { adminOverride: patch });
      res.json({ room: updated });
    },
  );

  router.post(
    '/admin/rooms/:roomCode/kick/:targetUserId',
    requireAuth,
    requirePermission('admin:manage_rooms'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const roomCode = sanitizeText(String(req.params.roomCode || ''), 32).toUpperCase();
      const targetUserId = Number(req.params.targetUserId);
      const [room] = await db.select().from(gameRooms).where(eq(gameRooms.roomCode, roomCode)).limit(1);
      if (!room) return res.status(404).json({ error: 'Room not found.' });

      await db
        .update(gamePlayers)
        .set({ status: 'removed', connected: false })
        .where(and(eq(gamePlayers.roomId, room.id), eq(gamePlayers.userId, targetUserId)));

      await recordGameAdminLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'PLAYER_DISQUALIFIED',
        targetType: 'game_room',
        targetId: room.roomCode,
        details: { targetUserId },
      });
      broadcastGameRoomEvent(room.roomCode, 'games:room_updated', { removedUserId: targetUserId });
      res.json({ ok: true });
    },
  );

  router.post(
    '/admin/teams',
    requireAuth,
    requirePermission('admin:manage_teams'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const name = sanitizeText(String(req.body.name || ''), 60);
      const roomId = req.body.roomId ? Number(req.body.roomId) : null;
      const campusId = req.body.campusId ? Number(req.body.campusId) : null;
      if (!name) return res.status(400).json({ error: 'Team name is required.' });

      const teamCode = generateSecureCode('GA-TEAM');
      const [created] = await db
        .insert(gameTeams)
        .values({
          roomId,
          campusId,
          teamCode,
          name,
          side: req.body.side === 'beta' ? 'beta' : 'alpha',
          maxMembers: Math.max(2, Math.min(30, Number(req.body.maxMembers || 10))),
          codeUsageLimit: Math.max(2, Math.min(60, Number(req.body.maxMembers || 10))),
        })
        .returning();

      await recordGameAdminLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'GAME_TEAM_CREATED',
        targetType: 'game_team',
        targetId: created.teamCode,
        details: { name, roomId, campusId },
      });
      res.status(201).json({ team: created });
    },
  );

  router.patch(
    '/admin/teams/:id',
    requireAuth,
    requirePermission('admin:manage_teams'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const teamId = Number(req.params.id);
      const patch: Record<string, unknown> = {};
      if (typeof req.body.isSuspended === 'boolean') patch.isSuspended = req.body.isSuspended;
      if (typeof req.body.isActive === 'boolean') patch.isActive = req.body.isActive;
      if (req.body.regenerateCode) patch.teamCode = generateSecureCode('GA-TEAM');

      const [updated] = await db.update(gameTeams).set(patch).where(eq(gameTeams.id, teamId)).returning();
      if (!updated) return res.status(404).json({ error: 'Team not found.' });

      await recordGameAdminLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'GAME_TEAM_UPDATED',
        targetType: 'game_team',
        targetId: updated.teamCode,
        details: patch,
      });
      res.json({ team: updated });
    },
  );

  router.post(
    '/admin/tournaments',
    requireAuth,
    requirePermission('admin:manage_rules'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const gameId = Number(req.body.gameId);
      const name = sanitizeText(String(req.body.name || ''), 120);
      const format = ['single_elimination', 'double_elimination', 'round_robin', 'campus_league'].includes(
        String(req.body.format),
      )
        ? String(req.body.format)
        : 'single_elimination';
      const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
      if (!game || !name) return res.status(400).json({ error: 'Valid game and tournament name required.' });

      const [created] = await db
        .insert(gameTournaments)
        .values({
          gameId: game.id,
          name,
          description: sanitizeText(String(req.body.description || `${game.title} official tournament`), 300),
          format,
          mode: sanitizeText(String(req.body.mode || '1v1'), 32),
          maxParticipants: Math.max(4, Math.min(64, Number(req.body.maxParticipants || 16))),
          rewardCoinsPool: Math.max(100, Math.min(10000, Number(req.body.rewardCoinsPool || 1000))),
          startsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          bracketsJson: { format, rounds: [] },
          createdById: actor.id,
        })
        .returning();

      await recordGameAdminLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'GAME_TOURNAMENT_CREATED',
        targetType: 'game_tournament',
        targetId: String(created.id),
        details: { name, format, gameId },
      });
      res.status(201).json({ tournament: created });
    },
  );

  router.post(
    '/admin/tournaments/:id/generate-brackets',
    requireAuth,
    requirePermission('admin:manage_rules'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const tournamentId = Number(req.params.id);
      const [t] = await db.select().from(gameTournaments).where(eq(gameTournaments.id, tournamentId)).limit(1);
      if (!t) return res.status(404).json({ error: 'Tournament not found.' });

      const parts = await db
        .select()
        .from(gameTournamentParticipants)
        .where(eq(gameTournamentParticipants.tournamentId, t.id));
      if (parts.length < 2) {
        return res.status(400).json({ error: 'At least 2 registered participants are needed to seed brackets.' });
      }

      const bracket = generateGameTournamentBracket(
        parts.map((p) => ({ id: p.id, displayName: p.displayName, seedNumber: p.seedNumber })),
        t.format,
      );

      const [updated] = await db
        .update(gameTournaments)
        .set({
          status: 'active',
          bracketsJson: bracket as unknown as Record<string, unknown>,
        })
        .where(eq(gameTournaments.id, t.id))
        .returning();

      await recordGameAdminLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'GAME_TOURNAMENT_BRACKETS_GENERATED',
        targetType: 'game_tournament',
        targetId: String(t.id),
        details: { participantCount: parts.length },
      });
      res.json({ tournament: updated });
    },
  );

  router.post(
    '/admin/tournaments/:id/advance',
    requireAuth,
    requirePermission('admin:manage_rules'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const tournamentId = Number(req.params.id);
      const matchId = sanitizeText(String(req.body.matchId || ''), 40);
      const winnerId = Number(req.body.winnerId);
      const scoreSummary = sanitizeText(String(req.body.scoreSummary || 'Win'), 40);

      const [t] = await db.select().from(gameTournaments).where(eq(gameTournaments.id, tournamentId)).limit(1);
      if (!t) return res.status(404).json({ error: 'Tournament not found.' });

      const currentBracket = t.bracketsJson as unknown as TournamentBracketStructure;
      const nextBracket = advanceGameTournamentMatch(currentBracket, matchId, winnerId, scoreSummary);

      const lastRound = nextBracket.rounds[nextBracket.rounds.length - 1];
      const allCompleted =
        lastRound &&
        lastRound.matches.length === 1 &&
        lastRound.matches[0].status === 'completed';

      const [updated] = await db
        .update(gameTournaments)
        .set({
          bracketsJson: nextBracket as unknown as Record<string, unknown>,
          status: allCompleted ? 'completed' : t.status,
        })
        .where(eq(gameTournaments.id, t.id))
        .returning();

      await recordGameAdminLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'GAME_TOURNAMENT_MATCH_ADVANCED',
        targetType: 'game_tournament',
        targetId: String(t.id),
        details: { matchId, winnerId, scoreSummary },
      });
      res.json({ tournament: updated });
    },
  );

  return router;
}
