export type UserRole =
  | 'guest'
  | 'player'
  | 'team_captain'
  | 'moderator'
  | 'event_admin'
  | 'owner';

export type Permission =
  | 'admin:view_analytics'
  | 'admin:manage_users'
  | 'admin:appoint_admins'
  | 'admin:manage_rooms'
  | 'admin:manage_teams'
  | 'admin:manage_rules'
  | 'admin:emergency_override'
  | 'admin:manage_content'
  | 'admin:manage_books'
  | 'admin:manage_appeals'
  | 'admin:manage_certificates'
  | 'admin:manage_comms'
  | 'admin:view_security'
  | 'admin:export_reports'
  | 'admin:platform_settings'
  | 'captain:manage_team'
  | 'captain:access_captain_chat'
  | 'mod:review_reports'
  | 'mod:mute_users'
  | 'mod:organizer_chat';

export interface RbacSubject {
  id: number;
  role: UserRole;
  isSuspended: boolean;
  isBanned: boolean;
  mfaEnabled: boolean;
  mfaVerifiedForSession?: boolean;
  permissionsJson?: {
    scopes?: string[];
    eventIds?: number[];
    expiresAt?: string | null;
  };
}

const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, Permission[]> = {
  guest: [],
  player: [],
  team_captain: ['captain:manage_team', 'captain:access_captain_chat'],
  moderator: [
    'admin:view_analytics',
    'admin:manage_comms',
    'admin:manage_appeals',
    'mod:review_reports',
    'mod:mute_users',
    'mod:organizer_chat',
  ],
  event_admin: [
    'admin:view_analytics',
    'admin:manage_rooms',
    'admin:manage_teams',
    'admin:manage_rules',
    'admin:manage_content',
    'admin:manage_books',
    'admin:manage_appeals',
    'admin:manage_comms',
    'admin:export_reports',
    'mod:review_reports',
    'mod:mute_users',
    'mod:organizer_chat',
    'captain:access_captain_chat',
  ],
  owner: [
    'admin:view_analytics',
    'admin:manage_users',
    'admin:appoint_admins',
    'admin:manage_rooms',
    'admin:manage_teams',
    'admin:manage_rules',
    'admin:emergency_override',
    'admin:manage_content',
    'admin:manage_books',
    'admin:manage_appeals',
    'admin:manage_certificates',
    'admin:manage_comms',
    'admin:view_security',
    'admin:export_reports',
    'admin:platform_settings',
    'captain:manage_team',
    'captain:access_captain_chat',
    'mod:review_reports',
    'mod:mute_users',
    'mod:organizer_chat',
  ],
};

export function isRegistrationRoleAllowed(requestedRole: string): boolean {
  return requestedRole === 'player';
}

export function canAssignRole(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole !== 'owner') return false;
  return ['player', 'team_captain', 'moderator', 'event_admin'].includes(targetRole);
}

export function hasPermission(
  subject: RbacSubject | null | undefined,
  permission: Permission,
  context?: { competitionId?: number; now?: Date },
): boolean {
  if (!subject) return false;
  if (subject.isBanned || subject.isSuspended) return false;

  if (subject.role === 'owner') {
    return true;
  }

  const now = context?.now ?? new Date();
  const perms = subject.permissionsJson;
  if (perms?.expiresAt) {
    const exp = new Date(perms.expiresAt);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < now.getTime()) {
      return false;
    }
  }

  if (
    (subject.role === 'event_admin' || subject.role === 'moderator') &&
    context?.competitionId !== undefined &&
    Array.isArray(perms?.eventIds) &&
    perms.eventIds.length > 0
  ) {
    if (!perms.eventIds.includes(context.competitionId)) {
      return false;
    }
  }

  const defaultPerms = ROLE_DEFAULT_PERMISSIONS[subject.role] || [];
  if (defaultPerms.includes(permission)) return true;

  if (Array.isArray(perms?.scopes) && perms.scopes.includes(permission)) {
    // Only owner can ever have admin:appoint_admins or admin:platform_settings
    if (permission === 'admin:appoint_admins' || permission === 'admin:platform_settings') {
      return false;
    }
    return true;
  }

  return false;
}
