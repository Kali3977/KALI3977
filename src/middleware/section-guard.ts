import { NextFunction, Response } from 'express';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { aiMentorConfig, platformSections, platformSettings } from '../db/schema.ts';
import {
  PLATFORM_SECTION_DEFINITIONS,
  buildDefaultSectionStates,
  deriveSectionFlags,
  evaluateSectionAccess,
  getSectionDefinition,
} from '../lib/domain/sections.ts';
import type { NavSection, PlatformSectionState, SectionDisplayStatus } from '../types/kali.ts';
import { AuthRequest, optionalAuth } from './auth.ts';

const SECTION_CACHE_TTL_MS = 5_000;

let sectionCache: {
  expiresAt: number;
  rows: PlatformSectionState[];
} | null = null;

export function invalidateSectionCache(): void {
  sectionCache = null;
}

function mapDbRowToSectionState(row: typeof platformSections.$inferSelect): PlatformSectionState {
  return {
    sectionKey: row.sectionKey as NavSection,
    sectionName: row.sectionName,
    description: row.description,
    category: row.category,
    isLockable: row.isLockable,
    enabledStatus: row.enabledStatus,
    displayStatus: (row.displayStatus as SectionDisplayStatus) || 'enabled',
    maintenanceStatus: row.maintenanceStatus,
    statusMessage: row.statusMessage,
    sortOrder: row.sortOrder,
    updatedByEmail: row.updatedByEmail,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function ensurePlatformSectionsSeeded(): Promise<void> {
  const existing = await db.select().from(platformSections);
  const existingKeys = new Set(existing.map((r) => r.sectionKey));

  // Initial backfill honours existing legacy toggles ONLY when creating rows for the first time
  let legacyControls: Record<string, unknown> = {};
  if (!existingKeys.has('mentor') || !existingKeys.has('community')) {
    const [ctrlRow] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, 'platform_controls'))
      .limit(1);
    legacyControls = (ctrlRow?.valueJson as Record<string, unknown>) || {};
  }

  for (const def of PLATFORM_SECTION_DEFINITIONS) {
    if (existingKeys.has(def.sectionKey)) continue;
    let displayStatus: SectionDisplayStatus = def.defaultDisplayStatus;
    if (def.sectionKey === 'mentor' && Boolean(legacyControls.disableAiMentor)) {
      displayStatus = 'disabled';
    } else if (def.sectionKey === 'community' && Boolean(legacyControls.disableCommunity)) {
      displayStatus = 'disabled';
    }
    const flags = deriveSectionFlags({ displayStatus, isLockable: def.isLockable });
    await db
      .insert(platformSections)
      .values({
        sectionKey: def.sectionKey,
        sectionName: def.sectionName,
        description: def.description,
        category: def.category,
        isLockable: def.isLockable,
        enabledStatus: flags.enabledStatus,
        displayStatus: flags.displayStatus,
        maintenanceStatus: flags.maintenanceStatus,
        statusMessage: '',
        sortOrder: def.sortOrder,
      })
      .onConflictDoNothing();
  }
}

export async function getPlatformSections(forceRefresh = false): Promise<PlatformSectionState[]> {
  const now = Date.now();
  if (!forceRefresh && sectionCache && sectionCache.expiresAt > now) {
    return sectionCache.rows;
  }

  try {
    const dbRows = await db
      .select()
      .from(platformSections)
      .orderBy(asc(platformSections.sortOrder), asc(platformSections.id));

    if (dbRows.length === 0) {
      await ensurePlatformSectionsSeeded();
      const seededRows = await db
        .select()
        .from(platformSections)
        .orderBy(asc(platformSections.sortOrder), asc(platformSections.id));
      const mapped = seededRows.length > 0 ? seededRows.map(mapDbRowToSectionState) : buildDefaultSectionStates();
      sectionCache = { expiresAt: now + SECTION_CACHE_TTL_MS, rows: mapped };
      return mapped;
    }

    const byKey = new Map<string, PlatformSectionState>(
      dbRows.map((r) => [r.sectionKey, mapDbRowToSectionState(r)]),
    );
    const merged: PlatformSectionState[] = PLATFORM_SECTION_DEFINITIONS.map((def) => {
      const found = byKey.get(def.sectionKey);
      if (found) return found;
      return {
        sectionKey: def.sectionKey,
        sectionName: def.sectionName,
        description: def.description,
        category: def.category,
        isLockable: def.isLockable,
        enabledStatus: true,
        displayStatus: def.defaultDisplayStatus,
        maintenanceStatus: false,
        statusMessage: '',
        sortOrder: def.sortOrder,
        updatedByEmail: null,
      };
    });
    for (const row of dbRows) {
      if (!getSectionDefinition(row.sectionKey)) {
        merged.push(mapDbRowToSectionState(row));
      }
    }
    sectionCache = { expiresAt: now + SECTION_CACHE_TTL_MS, rows: merged };
    return merged;
  } catch (err) {
    console.error('Failed to read platform_sections; falling back to defaults:', err);
    return buildDefaultSectionStates();
  }
}

export async function syncLegacyControlsFromSection(params: {
  sectionKey: string;
  enabled: boolean;
  actorId: number | null;
}): Promise<void> {
  if (params.sectionKey !== 'mentor' && params.sectionKey !== 'community') {
    return;
  }

  const [ctrlRow] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, 'platform_controls'))
    .limit(1);

  const current = (ctrlRow?.valueJson as Record<string, unknown>) || {};
  const nextControls = {
    ...current,
    ...(params.sectionKey === 'mentor' ? { disableAiMentor: !params.enabled } : {}),
    ...(params.sectionKey === 'community' ? { disableCommunity: !params.enabled } : {}),
  };

  await db
    .insert(platformSettings)
    .values({
      key: 'platform_controls',
      valueJson: nextControls,
      updatedById: params.actorId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: {
        valueJson: nextControls,
        updatedById: params.actorId,
        updatedAt: new Date(),
      },
    });

  if (params.sectionKey === 'mentor') {
    await db
      .update(aiMentorConfig)
      .set({
        enabled: params.enabled,
        updatedById: params.actorId,
        updatedAt: new Date(),
      })
      .where(eq(aiMentorConfig.id, 1));
  }
}

export async function syncSectionFromLegacyToggle(params: {
  sectionKey: 'mentor' | 'community';
  enabled: boolean;
  actorId: number | null;
  actorEmail: string | null;
}): Promise<void> {
  await ensurePlatformSectionsSeeded();
  const displayStatus: SectionDisplayStatus = params.enabled ? 'enabled' : 'disabled';
  const flags = deriveSectionFlags({ displayStatus, isLockable: true });
  await db
    .update(platformSections)
    .set({
      enabledStatus: flags.enabledStatus,
      displayStatus: flags.displayStatus,
      maintenanceStatus: flags.maintenanceStatus,
      updatedById: params.actorId,
      updatedByEmail: params.actorEmail,
      updatedAt: new Date(),
    })
    .where(eq(platformSections.sectionKey, params.sectionKey));
  invalidateSectionCache();
}

export function requireSectionEnabled(sectionKey: NavSection) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const finishCheck = async () => {
      try {
        const sections = await getPlatformSections();
        const section = sections.find((s) => s.sectionKey === sectionKey);
        const evaluation = evaluateSectionAccess({
          section,
          userRole: req.dbUser?.role ?? 'guest',
        });

        if (!evaluation.allowed) {
          return res.status(evaluation.httpStatus).json({
            error: evaluation.reason,
            code: 'SECTION_UNAVAILABLE',
            sectionKey,
            status: evaluation.effectiveStatus,
            statusMessage: section?.statusMessage || '',
          });
        }
        return next();
      } catch (err) {
        console.error(`Section guard failure for ${sectionKey}:`, err);
        return next();
      }
    };

    if (!req.dbUser && req.headers.authorization?.startsWith('Bearer ')) {
      return optionalAuth(req, res, () => {
        void finishCheck();
      });
    }
    return finishCheck();
  };
}
