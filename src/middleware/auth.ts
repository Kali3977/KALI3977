import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { eq, sql } from 'drizzle-orm';
import crypto from 'node:crypto';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { loginHistory, userSessions, users } from '../db/schema.ts';
import { hasPermission, type Permission, type UserRole } from '../lib/domain/rbac.ts';

export type DbUser = typeof users.$inferSelect;

export interface AuthRequest extends Request {
  firebaseUser?: DecodedIdToken;
  dbUser?: DbUser;
  sessionId?: string;
}

const DEFAULT_OWNER_EMAIL = 'r.7777rb@gmail.com';

export function getServerOwnerEmail(): string {
  return (process.env.OWNER_EMAIL?.trim() || DEFAULT_OWNER_EMAIL).toLowerCase();
}

export function shouldAssignInitialOwnerRole(params: {
  email: string;
  emailVerified: boolean;
  existingOwnerCount: number;
  ownerEmail?: string;
}): boolean {
  if (!params.emailVerified) return false;
  const targetOwner = (params.ownerEmail?.trim() || getServerOwnerEmail()).toLowerCase();
  return params.email.trim().toLowerCase() === targetOwner && params.existingOwnerCount === 0;
}

function buildSafeUsername(email: string, uid: string): string {
  const base = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, 18);
  const suffix = uid.slice(0, 5).toLowerCase();
  return `${base || 'operator'}_${suffix}`;
}

const pendingUserSyncs = new Map<string, Promise<DbUser>>();

async function syncFirebaseUserToDb(decoded: DecodedIdToken, req: Request): Promise<DbUser> {
  const inflight = pendingUserSyncs.get(decoded.uid);
  if (inflight) {
    return inflight;
  }

  const syncPromise = (async (): Promise<DbUser> => {
    const email = decoded.email || `${decoded.uid}@users.kali3977.local`;
    const emailVerified = Boolean(decoded.email_verified);
    const displayName =
      (typeof decoded.name === 'string' && decoded.name.trim()) ||
      email.split('@')[0] ||
      'Cyber Learner';
    const avatarUrl = typeof decoded.picture === 'string' ? decoded.picture : null;
    const today = new Date().toISOString().slice(0, 10);

    const existing = await db.select().from(users).where(eq(users.uid, decoded.uid)).limit(1);
    if (existing.length > 0) {
      const u = existing[0];
      let nextRole = u.role;

      if (emailVerified && email.toLowerCase() === getServerOwnerEmail() && u.role !== 'owner') {
        const existingOwners = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(users)
          .where(eq(users.role, 'owner'));
        if ((existingOwners[0]?.count ?? 0) === 0) {
          nextRole = 'owner';
        }
      }

      if (
        u.email !== email ||
        u.emailVerified !== emailVerified ||
        u.role !== nextRole ||
        u.lastActiveDate !== today ||
        (!u.avatarUrl && avatarUrl)
      ) {
        const updated = await db
          .update(users)
          .set({
            email,
            emailVerified,
            role: nextRole,
            avatarUrl: u.avatarUrl || avatarUrl,
            lastActiveDate: today,
            updatedAt: new Date(),
          })
          .where(eq(users.id, u.id))
          .returning();
        return updated[0];
      }
      return u;
    }

    // Server-side owner bootstrap from deployment configuration (never hardcoded passwords or client flags)
    let initialRole: UserRole = 'player';
    const existingOwners = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, 'owner'));
    if (
      shouldAssignInitialOwnerRole({
        email,
        emailVerified,
        existingOwnerCount: existingOwners[0]?.count ?? 0,
      })
    ) {
      initialRole = 'owner';
    }

    const username = buildSafeUsername(email, decoded.uid);
    const inserted = await db
      .insert(users)
      .values({
        uid: decoded.uid,
        email,
        emailVerified,
        username,
        displayName,
        avatarUrl,
        role: initialRole,
        lastActiveDate: today,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          emailVerified,
          lastActiveDate: today,
          updatedAt: new Date(),
        },
      })
      .returning();

    const createdUser = inserted[0];

    const ipAddress =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0].trim()
        : req.ip) || '0.0.0.0';
    const userAgent = (req.headers['user-agent'] || 'Unknown').slice(0, 200);

    await db.insert(loginHistory).values({
      userId: createdUser.id,
      ipAddress,
      userAgent,
      status: 'success',
    });

    await db.insert(userSessions).values({
      userId: createdUser.id,
      sessionId: crypto.randomUUID(),
      userAgent,
      ipAddress,
      mfaVerified: false,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return createdUser;
  })();

  pendingUserSyncs.set(decoded.uid, syncPromise);
  try {
    return await syncPromise;
  } finally {
    pendingUserSyncs.delete(decoded.uid);
  }
}

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return next();

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.firebaseUser = decoded;
    req.dbUser = await syncFirebaseUserToDb(decoded, req);
  } catch {
    // Invalid optional token simply leaves user unauthenticated (guest)
  }
  return next();
};

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.firebaseUser = decoded;
    const dbUser = await syncFirebaseUserToDb(decoded, req);

    if (dbUser.isBanned) {
      return res.status(403).json({
        error: 'This account has been permanently banned for policy violations.',
        reason: dbUser.suspensionReason || 'Policy violation',
      });
    }
    if (dbUser.isSuspended) {
      return res.status(403).json({
        error: 'This account is currently suspended.',
        reason: dbUser.suspensionReason || 'Administrative suspension',
      });
    }

    const sessionHeader = req.headers['x-kali-session-id'];
    if (typeof sessionHeader === 'string' && sessionHeader.length > 0) {
      const sess = await db
        .select()
        .from(userSessions)
        .where(eq(userSessions.sessionId, sessionHeader))
        .limit(1);
      if (sess.length > 0 && (sess[0].revoked || sess[0].expiresAt.getTime() < Date.now())) {
        return res.status(401).json({ error: 'Session has been revoked or expired.' });
      }
      req.sessionId = sessionHeader;
    }

    req.dbUser = dbUser;
    return next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
};

export const requirePermission = (
  permission: Permission,
  getCompetitionId?: (req: AuthRequest) => number | undefined,
) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const u = req.dbUser;
    if (!u) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const competitionId = getCompetitionId ? getCompetitionId(req) : undefined;
    const allowed = hasPermission(
      {
        id: u.id,
        role: u.role as UserRole,
        isSuspended: u.isSuspended,
        isBanned: u.isBanned,
        mfaEnabled: u.mfaEnabled,
        permissionsJson: u.permissionsJson,
      },
      permission,
      { competitionId },
    );
    if (!allowed) {
      return res.status(403).json({
        error: `Forbidden: missing required permission (${permission}).`,
      });
    }
    return next();
  };
};
