import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  gameAchievements,
  gameCategories,
  gameMissions,
  gameTournaments,
  games,
} from './schema.ts';
import {
  GAME_ACHIEVEMENTS_SEED,
  GAME_CATEGORIES_SEED,
  GAME_MISSIONS_SEED,
  GAMES_SEED,
} from '../lib/games/catalog-data.ts';

export async function syncGamesArenaSeed(): Promise<void> {
  const categoryIdByCode = new Map<string, number>();

  for (const cat of GAME_CATEGORIES_SEED) {
    const [existing] = await db
      .select()
      .from(gameCategories)
      .where(eq(gameCategories.code, cat.code))
      .limit(1);

    if (!existing) {
      const [inserted] = await db
        .insert(gameCategories)
        .values({
          code: cat.code,
          slug: cat.slug,
          name: cat.name,
          description: cat.description,
          accentColor: cat.accentColor,
          orderIndex: cat.orderIndex,
        })
        .returning();
      categoryIdByCode.set(cat.code, inserted.id);
    } else {
      await db
        .update(gameCategories)
        .set({
          slug: cat.slug,
          name: cat.name,
          description: cat.description,
          accentColor: cat.accentColor,
          orderIndex: cat.orderIndex,
        })
        .where(eq(gameCategories.id, existing.id));
      categoryIdByCode.set(cat.code, existing.id);
    }
  }

  let ctfBattleId: number | null = null;
  let amongUsId: number | null = null;

  for (const g of GAMES_SEED) {
    const categoryId = categoryIdByCode.get(g.categoryCode);
    if (!categoryId) continue;

    const [existing] = await db.select().from(games).where(eq(games.slug, g.slug)).limit(1);
    if (!existing) {
      const [inserted] = await db
        .insert(games)
        .values({
          categoryId,
          slug: g.slug,
          title: g.title,
          tagline: g.tagline,
          description: g.description,
          instructions: g.instructions,
          engineType: g.engineType,
          difficulty: g.difficulty,
          minPlayers: g.minPlayers,
          maxPlayers: g.maxPlayers,
          supportedModesJson: g.supportedModes,
          scoringConfigJson: g.scoringConfig,
          durationSeconds: g.durationSeconds,
          isFeatured: g.isFeatured,
          isEnabled: true,
          isPublished: true,
        })
        .returning();
      if (g.slug === 'cyber-ctf-battle') ctfBattleId = inserted.id;
      if (g.slug === 'hacker-among-us') amongUsId = inserted.id;
    } else {
      await db
        .update(games)
        .set({
          categoryId,
          title: g.title,
          tagline: g.tagline,
          description: g.description,
          instructions: g.instructions,
          engineType: g.engineType,
          difficulty: g.difficulty,
          minPlayers: g.minPlayers,
          maxPlayers: g.maxPlayers,
          supportedModesJson: g.supportedModes,
          scoringConfigJson: g.scoringConfig,
          durationSeconds: g.durationSeconds,
          isFeatured: g.isFeatured,
        })
        .where(eq(games.id, existing.id));
      if (g.slug === 'cyber-ctf-battle') ctfBattleId = existing.id;
      if (g.slug === 'hacker-among-us') amongUsId = existing.id;
    }
  }

  for (const ach of GAME_ACHIEVEMENTS_SEED) {
    const [existing] = await db
      .select()
      .from(gameAchievements)
      .where(eq(gameAchievements.code, ach.code))
      .limit(1);
    if (!existing) {
      await db.insert(gameAchievements).values(ach);
    }
  }

  for (const m of GAME_MISSIONS_SEED) {
    const [existing] = await db
      .select()
      .from(gameMissions)
      .where(eq(gameMissions.code, m.code))
      .limit(1);
    if (!existing) {
      await db.insert(gameMissions).values(m);
    }
  }

  // Ensure starter Games Arena Tournaments exist cleanly without fabricated participants
  const existingTournaments = await db.select().from(gameTournaments).limit(1);
  if (existingTournaments.length === 0 && ctfBattleId) {
    await db.insert(gameTournaments).values([
      {
        gameId: ctfBattleId,
        name: 'KALI3977 Games Open — Cyber CTF Clash',
        description:
          'Single-elimination 1v1 and team Cyber CTF Battle bracket. Brackets populate automatically from real registered players.',
        format: 'single_elimination',
        mode: '1v1',
        status: 'registration_open',
        maxParticipants: 16,
        entryMinLevel: 1,
        rewardCoinsPool: 1200,
        bracketsJson: { format: 'single_elimination', rounds: [] },
        startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
      ...(amongUsId
        ? [
            {
              gameId: amongUsId,
              name: 'Inter-Campus Social Deduction League',
              description:
                'Campus vs Campus Hacker Among Us seasonal league with automated round-robin pools.',
              format: 'campus_league',
              mode: 'campus_vs_campus',
              status: 'registration_open',
              maxParticipants: 12,
              entryMinLevel: 1,
              rewardCoinsPool: 1500,
              bracketsJson: { format: 'campus_league', rounds: [] },
              startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            },
          ]
        : []),
    ]);
  }
}
