import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Clock,
  Hash,
  Lock,
  MessageSquare,
  Pin,
  Reply,
  Send,
  Shield,
  Trash2,
  Users,
  VolumeX,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AdminSecurityNotice } from './AdminSecurityNotice';

interface CompetitionItem {
  id: number;
  name: string;
  description: string;
  gameMode: string;
  status: string;
  difficulty: string;
  scoringSystem: string;
  enrollmentPolicy: string;
  totalCapacity: number;
  perTeamCapacity: number;
  maxTeams: number;
  rulesLocked: boolean;
  rulesText?: string;
  startsAt?: string;
  endsAt?: string;
  registrationDeadline?: string | null;
}

interface RoomItem {
  id: number;
  competitionId: number;
  name: string;
  isActive: boolean;
  isLocked: boolean;
  maxParticipants: number;
  currentParticipants: number;
}

interface TeamItem {
  id: number;
  competitionId: number | null;
  campusName?: string | null;
  name: string;
  maxMembers: number;
  currentMembers: number;
  score: number;
}

interface LobbyPayload {
  competition: CompetitionItem;
  room: { id: number; name: string; isActive: boolean; isLocked: boolean; maxParticipants: number } | null;
  team: { id: number; name: string; score: number; maxMembers: number; campusName: string | null } | null;
  members: Array<{
    userId: number;
    username: string;
    displayName: string;
    roleInTeam: string;
    isMutedInChat: boolean;
    isOnline: boolean;
  }>;
  scoreboard: Array<{
    id: number;
    name: string;
    score: number;
    campusName: string | null;
  }>;
}

interface ChatChannel {
  id: number;
  channelType: string;
  name: string;
  teamId: number | null;
  isEnabled: boolean;
}

interface ChatMsg {
  id: number;
  channelId: number;
  senderId: number;
  senderName: string;
  senderUsername: string;
  senderRole: string;
  senderTeamRole?: string | null;
  content: string;
  replyToId?: number | null;
  isPinned?: boolean;
  createdAt: string;
}

const QUICK_EMOJIS = ['🛡️', '🚩', '🔍', '✅', '👍'];

const COMPETITION_FORMATS = [
  { name: 'CTF Battle', desc: 'Team-based dynamic flag solving across multiple security categories.' },
  { name: 'Red vs Blue', desc: 'Attack and defensive remediation drills inside isolated training subnets.' },
  { name: 'Cyber Investigation', desc: 'Evidence reconstruction and intrusion root-cause triage from logs.' },
  { name: 'Cyber Rush', desc: 'High-tempo sprint rounds optimizing triage speed and flag accuracy.' },
  { name: 'SOC Incident Response', desc: 'Alert prioritization, containment planning, and SIEM rule validation.' },
  { name: 'Network Defence', desc: 'PCAP traffic analysis, firewall policy auditing, and protocol hardening.' },
  { name: 'Digital Forensics Challenge', desc: 'Memory dump, disk image, and timeline artifact investigation.' },
  { name: 'Cryptography Battle', desc: 'Authenticated encryption, nonce analysis, and key verification rounds.' },
  { name: 'Custom Cyber Games', desc: 'Administrator-defined custom scoring, rulesets, and hybrid scenarios.' },
];

function formatCountdown(targetIso?: string): string | null {
  if (!targetIso) return null;
  const diff = new Date(targetIso).getTime() - Date.now();
  if (Number.isNaN(diff)) return null;
  if (diff <= 0) return 'Window Closed';
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const hms = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return days > 0 ? `${days}d ${hms}` : hms;
}

export const MultiplayerArena: React.FC = () => {
  const { user, authPending, loginWithGoogle, apiFetch, lastWsEvent, onlineCount } = useAuth();
  const [competitions, setCompetitions] = useState<CompetitionItem[]>([]);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [userParticipations, setUserParticipations] = useState<
    Array<{ competitionId: number; roomId: number; teamId: number; teamName: string; roomName: string }>
  >([]);

  // Never pre-fill Room Code or Team Code
  const [roomCode, setRoomCode] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [joinStatus, setJoinStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [joining, setJoining] = useState(false);

  // Team Lobby State
  const [activeLobbyCompId, setActiveLobbyCompId] = useState<number | null>(null);
  const [lobby, setLobby] = useState<LobbyPayload | null>(null);
  const [countdownText, setCountdownText] = useState<string | null>(null);

  // Team Communication state
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [unreadByChannel, setUnreadByChannel] = useState<Record<number, number>>({});
  const [chatInput, setChatInput] = useState('');
  const [replyToMsg, setReplyToMsg] = useState<ChatMsg | null>(null);
  const [sendingChat, setSendingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const loadArena = async () => {
    const res = await apiFetch<{
      competitions: CompetitionItem[];
      rooms: RoomItem[];
      teams: TeamItem[];
      userParticipations: Array<{
        competitionId: number;
        roomId: number;
        teamId: number;
        teamName: string;
        roomName: string;
      }>;
    }>('/api/arena');
    setCompetitions(res.competitions);
    setRooms(res.rooms);
    setTeams(res.teams);
    setUserParticipations(res.userParticipations);
    if (res.userParticipations.length > 0 && !activeLobbyCompId) {
      setActiveLobbyCompId(res.userParticipations[0].competitionId);
    }
  };

  const loadLobby = async (compId: number) => {
    if (!user) return;
    try {
      const res = await apiFetch<LobbyPayload>(`/api/arena/lobby/${compId}`);
      setLobby(res);
    } catch {
      setLobby(null);
    }
  };

  const loadChannels = async () => {
    if (!user) {
      setChannels([]);
      return;
    }
    const res = await apiFetch<{ channels: ChatChannel[] }>('/api/chat/channels');
    setChannels(res.channels);
    if (res.channels.length > 0 && !activeChannelId) {
      setActiveChannelId(res.channels[0].id);
    }
  };

  const loadMessages = async (chId: number) => {
    if (!user) return;
    try {
      const res = await apiFetch<{ messages: ChatMsg[] }>(`/api/chat/channels/${chId}/messages`);
      setMessages(res.messages);
      setUnreadByChannel((u) => ({ ...u, [chId]: 0 }));
      setChatError(null);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Unable to load channel messages');
    }
  };

  useEffect(() => {
    loadArena();
    loadChannels();
  }, [user?.id]);

  useEffect(() => {
    if (activeLobbyCompId && user) {
      loadLobby(activeLobbyCompId);
    } else {
      setLobby(null);
    }
  }, [activeLobbyCompId, user?.id]);

  useEffect(() => {
    if (!lobby?.competition.endsAt) {
      setCountdownText(null);
      return;
    }
    const update = () => setCountdownText(formatCountdown(lobby.competition.endsAt));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [lobby?.competition.endsAt]);

  useEffect(() => {
    if (activeChannelId && user) {
      setReplyToMsg(null);
      loadMessages(activeChannelId);
    }
  }, [activeChannelId, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  useEffect(() => {
    if (!lastWsEvent) return;
    if (lastWsEvent.type === 'arena:participant_joined' || lastWsEvent.type === 'competition:status') {
      loadArena();
      if (activeLobbyCompId && user) loadLobby(activeLobbyCompId);
    }
    if (lastWsEvent.type === 'chat:message' && lastWsEvent.message) {
      const incoming = lastWsEvent.message as ChatMsg;
      if (incoming.channelId === activeChannelId) {
        setMessages((prev) =>
          prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming],
        );
      } else {
        setUnreadByChannel((prev) => ({
          ...prev,
          [incoming.channelId]: (prev[incoming.channelId] || 0) + 1,
        }));
      }
    }
    if (lastWsEvent.type === 'chat:message_deleted' && lastWsEvent.message) {
      const deleted = lastWsEvent.message as { id: number; channelId: number };
      if (deleted.channelId === activeChannelId) {
        setMessages((prev) => prev.filter((m) => m.id !== deleted.id));
      }
    }
    if (lastWsEvent.type === 'chat:message_pinned' && lastWsEvent.message) {
      const pinnedEvt = lastWsEvent.message as { id: number; channelId: number; isPinned: boolean };
      if (pinnedEvt.channelId === activeChannelId) {
        setMessages((prev) =>
          prev.map((m) => (m.id === pinnedEvt.id ? { ...m, isPinned: pinnedEvt.isPinned } : m)),
        );
      }
    }
  }, [lastWsEvent, activeChannelId, activeLobbyCompId, user?.id]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      await loginWithGoogle();
      return;
    }
    setJoining(true);
    setJoinStatus(null);
    try {
      const res = await apiFetch<{
        roomName: string;
        teamName: string;
        competitionName: string;
        participation: { competitionId: number };
      }>('/api/arena/join', {
        method: 'POST',
        body: JSON.stringify({ roomCode, teamCode }),
      });
      setJoinStatus({
        ok: true,
        msg: `Verified! Joined ${res.competitionName} (${res.roomName}) representing ${res.teamName}.`,
      });
      setActiveLobbyCompId(res.participation.competitionId);
      await Promise.all([loadArena(), loadChannels(), loadLobby(res.participation.competitionId)]);
    } catch (err) {
      setJoinStatus({
        ok: false,
        msg: err instanceof Error ? err.message : 'Unable to join room.',
      });
    } finally {
      setJoining(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeChannelId || !chatInput.trim() || sendingChat) return;
    setSendingChat(true);
    try {
      const res = await apiFetch<{ message: ChatMsg }>(
        `/api/chat/channels/${activeChannelId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({
            content: chatInput,
            replyToId: replyToMsg?.id ?? null,
          }),
        },
      );
      setChatInput('');
      setReplyToMsg(null);
      setMessages((prev) =>
        prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message],
      );
      setChatError(null);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSendingChat(false);
    }
  };

  const handleDeleteMessage = async (msgId: number) => {
    if (!user) return;
    try {
      await apiFetch(`/api/chat/messages/${msgId}`, { method: 'DELETE' });
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Unable to delete message');
    }
  };

  const handleTogglePin = async (msg: ChatMsg) => {
    if (!user) return;
    try {
      await apiFetch(`/api/chat/messages/${msg.id}/pin`, {
        method: 'POST',
        body: JSON.stringify({ isPinned: !msg.isPinned }),
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, isPinned: !msg.isPinned } : m)),
      );
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Unable to update pinned message');
    }
  };

  const handleToggleMuteMember = async (targetUserId: number, currentMuted: boolean) => {
    if (!activeChannelId) return;
    try {
      await apiFetch(`/api/chat/channels/${activeChannelId}/mute`, {
        method: 'POST',
        body: JSON.stringify({ userId: targetUserId, muted: !currentMuted }),
      });
      if (activeLobbyCompId) await loadLobby(activeLobbyCompId);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Unable to update mute state');
    }
  };

  const handleReportMessage = async (msgId: number) => {
    if (!user) return;
    await apiFetch(`/api/chat/messages/${msgId}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Flagged by participant for moderator review' }),
    });
    setChatError('Message reported to competition moderators.');
  };

  const isStaff = Boolean(user && ['owner', 'event_admin', 'moderator'].includes(user.role));
  const isMyTeamCaptain = Boolean(
    user && lobby?.members.some((m) => m.userId === user.id && (m.roleInTeam === 'captain' || m.roleInTeam === 'deputy')),
  );
  const pinnedMessages = messages.filter((m) => m.isPinned);
  const messageById = new Map(messages.map((m) => [m.id, m]));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Multiplayer Arena & Team Lobby
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Dual-code architecture: obtain your Room Code from the event organizer and your private Team Code from your campus captain.
          </p>
        </div>
        <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
          Live Socket Connections: {onlineCount}
        </div>
      </div>

      {/* Administration and Security Notice Gate */}
      <AdminSecurityNotice compact requireAcknowledge />

      {/* Dual-Code Join Competition Form */}
      <section className="grid gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleJoin}
          className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-4"
        >
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            Join Competition Room
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enter both distinct codes separately. Server validates eligibility, policy acknowledgment, deadlines, expiration, and room/team capacity.
          </p>

          <div>
            <label htmlFor="arena-room-code" className="block text-xs font-semibold mb-1.5">
              1. Competition Room Code
            </label>
            <input
              id="arena-room-code"
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="Enter Room Code provided by organizer"
              autoComplete="off"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3.5 py-2 font-mono text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label htmlFor="arena-team-code" className="block text-xs font-semibold mb-1.5">
              2. Campus / Team Code
            </label>
            <input
              id="arena-team-code"
              type="text"
              value={teamCode}
              onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
              placeholder="Enter private Team Code for your campus squad"
              autoComplete="off"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3.5 py-2 font-mono text-sm text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
              required
            />
          </div>

          {user && !user.policyAcknowledgedAt && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-300">
              Please acknowledge the KALI3977 Administration and Security Notice above before joining a competition room.
            </div>
          )}

          {joinStatus && (
            <div
              className={`rounded-lg p-3 text-xs ${
                joinStatus.ok
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-500'
              }`}
            >
              {joinStatus.msg}
            </div>
          )}

          <button
            type="submit"
            disabled={joining || Boolean(user && !user.policyAcknowledgedAt)}
            className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-colors"
          >
            {user ? (joining ? 'Validating Codes...' : 'Validate & Join Team Lobby') : 'Sign In to Join'}
          </button>

          {userParticipations.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Your Active Competition Lobbies
              </p>
              <div className="flex flex-wrap gap-2">
                {userParticipations.map((p) => (
                  <button
                    key={p.competitionId}
                    type="button"
                    onClick={() => setActiveLobbyCompId(p.competitionId)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeLobbyCompId === p.competitionId
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                        : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {p.roomName} · {p.teamName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>

        {/* Public Rooms & Participating Teams (Zero Code Leakage) */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              Active Rooms & Campus Squads
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {competitions.length} public events
            </span>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {rooms.map((rm) => {
              const comp = competitions.find((c) => c.id === rm.competitionId);
              return (
                <div
                  key={rm.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {comp?.name || rm.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {rm.name} · {comp?.gameMode.replace(/_/g, ' ')} · Status:{' '}
                      <span className="text-emerald-500 font-medium">{comp?.status}</span> ·{' '}
                      {rm.isLocked ? 'Locked' : 'Invite / Code Required'}
                    </p>
                  </div>
                  <div className="text-right font-mono text-xs tabular-nums">
                    <p>
                      {rm.currentParticipants} / {rm.maxParticipants} players
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {comp?.enrollmentPolicy === 'campus_verified' ? 'Campus Verified' : 'Team Code Required'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Participating Campus Teams (Team Codes remain private)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Campus Squad</th>
                    <th className="py-2 pr-3 font-medium">Campus</th>
                    <th className="py-2 pr-3 font-medium text-right">Members</th>
                    <th className="py-2 font-medium text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                  {teams.map((t) => (
                    <tr key={t.id} className="h-9">
                      <td className="pr-3 font-medium">{t.name}</td>
                      <td className="pr-3 text-slate-500">{t.campusName || 'Registered Campus'}</td>
                      <td className="pr-3 text-right font-mono">
                        {t.currentMembers}/{t.maxMembers}
                      </td>
                      <td className="text-right font-mono font-semibold text-emerald-500">{t.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Active Joined Team Lobby */}
      {lobby && (
        <section className="rounded-xl border border-emerald-500/30 bg-white dark:bg-[#11161F] p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <p className="text-xs font-mono text-emerald-500 uppercase">
                Verified Competition Lobby · {lobby.competition.status}
              </p>
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                {lobby.competition.name} {lobby.team ? `— ${lobby.team.name}` : ''}
              </h2>
            </div>
            {lobby.competition.endsAt && (
              <div className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 font-mono text-xs text-cyan-500 tabular-nums">
                <Clock className="h-3.5 w-3.5" />
                <span>{countdownText || new Date(lobby.competition.endsAt).toLocaleString()}</span>
              </div>
            )}
          </div>

          {lobby.competition.rulesText && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-3.5 text-xs text-slate-600 dark:text-slate-300">
              <strong className="text-slate-900 dark:text-slate-100">Competition Rules:</strong>{' '}
              {lobby.competition.rulesText}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Team Roster */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Your Squad Roster ({lobby.members.length})
              </h3>
              <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
                {lobby.members.length === 0 ? (
                  <p className="p-4 text-xs text-slate-500">Staff overview mode — no personal squad assigned.</p>
                ) : (
                  lobby.members.map((m) => (
                    <div key={m.userId} className="flex items-center justify-between gap-2 p-3 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 ${
                            m.isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                          title={m.isOnline ? 'Online now' : 'Offline'}
                        />
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {m.displayName}{' '}
                            <span className="font-mono text-slate-500">@{m.username}</span>
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {m.roleInTeam === 'captain' ? 'Team Captain' : m.roleInTeam}
                            {m.isMutedInChat ? ' · Muted in chat' : ''}
                          </p>
                        </div>
                      </div>
                      {(isStaff || isMyTeamCaptain) && m.userId !== user?.id && (
                        <button
                          type="button"
                          onClick={() => handleToggleMuteMember(m.userId, m.isMutedInChat)}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <VolumeX className="h-3 w-3" />
                          {m.isMutedInChat ? 'Unmute' : 'Mute'}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Live Room Scoreboard */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Live Competition Scoreboard
              </h3>
              <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
                {lobby.scoreboard.map((st, idx) => (
                  <div key={st.id} className="flex items-center justify-between p-3 text-xs tabular-nums">
                    <div>
                      <span className="font-mono text-slate-400 mr-2">#{idx + 1}</span>
                      <span className="font-medium">{st.name}</span>
                    </div>
                    <span className="font-mono font-semibold text-emerald-500">{st.score} pts</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 9 Supported Competition Game Modes Architecture */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6">
        <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Supported Competition Formats (9 Game Modes)
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
          {COMPETITION_FORMATS.map((m) => (
            <div
              key={m.name}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-3.5 space-y-1"
            >
              <p className="font-semibold text-slate-900 dark:text-slate-100">{m.name}</p>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Built-in Team Communication System */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-emerald-500" />
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              Team & Competition Communication
            </h2>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Lock className="h-3.5 w-3.5" />
            Server-isolated per team & role · Moderated under Security Notice
          </span>
        </div>

        {!user ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-6 text-center space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sign in and join a competition room with your Team Code to access your private team chat,
              captain brief, and announcements.
            </p>
            <button
              type="button"
              disabled={authPending}
              onClick={() => void loginWithGoogle()}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {authPending ? 'Signing in...' : 'Sign In with Google'}
            </button>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-4 space-y-1.5">
              {channels.map((ch) => {
                const unread = unreadByChannel[ch.id] || 0;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setActiveChannelId(ch.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                      activeChannelId === ch.id
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 truncate">
                      {ch.channelType === 'organizer' ? (
                        <Shield className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                      ) : ch.channelType === 'team' ? (
                        <Users className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
                      ) : (
                        <Hash className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      )}
                      <span className="truncate">{ch.name}</span>
                    </span>
                    {unread > 0 && (
                      <span className="font-mono text-[11px] font-semibold text-emerald-500 tabular-nums">
                        {unread}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="lg:col-span-8 flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-4 min-h-[300px]">
              {/* Pinned Messages Banner */}
              {pinnedMessages.length > 0 && (
                <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-500">
                    <Pin className="h-3.5 w-3.5" />
                    Pinned Strategy / Announcements ({pinnedMessages.length})
                  </div>
                  {pinnedMessages.map((pm) => (
                    <div key={pm.id} className="flex items-center justify-between gap-2 text-slate-700 dark:text-slate-300">
                      <span className="truncate">
                        <strong>@{pm.senderUsername}:</strong> {pm.content}
                      </span>
                      {(isStaff || isMyTeamCaptain) && (
                        <button
                          type="button"
                          onClick={() => handleTogglePin(pm)}
                          className="text-[11px] text-amber-500 hover:underline shrink-0"
                        >
                          Unpin
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                {messages.length === 0 ? (
                  <p className="text-xs text-slate-500">No messages in this channel yet.</p>
                ) : (
                  messages.map((m) => {
                    const canDelete = m.senderId === user.id || isMyTeamCaptain || isStaff;
                    const canPin = isMyTeamCaptain || isStaff;
                    const parentMsg = m.replyToId ? messageById.get(m.replyToId) : null;
                    const timeStr = m.createdAt
                      ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '';
                    return (
                      <div key={m.id} className="group flex items-start justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          {parentMsg && (
                            <p className="mb-0.5 pl-2 border-l-2 border-cyan-500/40 text-[11px] text-slate-500 truncate">
                              Replying to @{parentMsg.senderUsername}: {parentMsg.content}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {m.senderName}
                            </span>
                            <span className="font-mono text-slate-500">@{m.senderUsername}</span>
                            {m.senderTeamRole === 'captain' && (
                              <span className="font-mono text-[10px] text-cyan-500 uppercase">[Captain]</span>
                            )}
                            {['owner', 'event_admin', 'moderator'].includes(m.senderRole) && (
                              <span className="font-mono text-[10px] text-violet-400 uppercase">[Staff]</span>
                            )}
                            {m.isPinned && (
                              <span className="font-mono text-[10px] text-amber-500 uppercase">[Pinned]</span>
                            )}
                            {timeStr && <span className="font-mono text-[10px] text-slate-400">{timeStr}</span>}
                          </div>
                          <p className="mt-0.5 text-slate-700 dark:text-slate-300 break-words">{m.content}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => setReplyToMsg(m)}
                            aria-label={`Reply to ${m.senderUsername}`}
                            className="text-slate-400 hover:text-cyan-500 p-1"
                          >
                            <Reply className="h-3.5 w-3.5" />
                          </button>
                          {canPin && (
                            <button
                              type="button"
                              onClick={() => handleTogglePin(m)}
                              aria-label={`${m.isPinned ? 'Unpin' : 'Pin'} message from ${m.senderUsername}`}
                              className={`p-1 ${m.isPinned ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}
                            >
                              <Pin className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(m.id)}
                              aria-label={`Delete message from ${m.senderUsername}`}
                              className="text-slate-400 hover:text-rose-500 p-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleReportMessage(m.id)}
                            aria-label={`Report message from ${m.senderUsername}`}
                            className="text-slate-400 hover:text-amber-500 p-1"
                          >
                            <AlertCircle className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {chatError && <p className="mt-2 text-xs text-rose-500">{chatError}</p>}

              <div className="mt-3 space-y-2">
                {replyToMsg && (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px]">
                    <span className="truncate text-cyan-600 dark:text-cyan-300">
                      Replying to @{replyToMsg.senderUsername}: {replyToMsg.content}
                    </span>
                    <button
                      type="button"
                      onClick={() => setReplyToMsg(null)}
                      aria-label="Cancel reply"
                      className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  {QUICK_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setChatInput((prev) => `${prev}${em}`)}
                      aria-label={`Insert ${em}`}
                      className="rounded border border-slate-200 dark:border-slate-800 px-2 py-0.5 text-xs hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                      {em}
                    </button>
                  ))}
                </div>
                <form onSubmit={handleSendChat} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Write a message to your channel..."
                    aria-label="Channel message"
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={sendingChat}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {sendingChat ? 'Sending...' : 'Send'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
