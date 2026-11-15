import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  LogOut,
  MessageSquare,
  Play,
  Send,
  Shield,
  Trophy,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { GamePlayStage } from './GamePlayStage';
import { playTacticalSound } from './sound';
import type { RoomSnapshot } from './types';

interface ChatMessage {
  id: string;
  userId: number;
  username: string;
  displayName: string;
  message: string;
  createdAt: string;
}

interface Props {
  initialSnapshot: RoomSnapshot;
  onExitRoom: () => void;
  onMatchSettled: () => void;
}

export const GameLobbyView: React.FC<Props> = ({
  initialSnapshot,
  onExitRoom,
  onMatchSettled,
}) => {
  const { user, apiFetch, lastWsEvent, sendWsMessage, refreshProfile } = useAuth();
  const [snapshot, setSnapshot] = useState<RoomSnapshot>(initialSnapshot);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(initialSnapshot.feedback || null);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(initialSnapshot.room.durationSeconds);

  const roomCode = snapshot.room.roomCode;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const reloadRoom = useCallback(async () => {
    try {
      const fresh = await apiFetch<RoomSnapshot>(`/api/games/rooms/${encodeURIComponent(roomCode)}`);
      setSnapshot(fresh);
      if (fresh.session?.status === 'completed') {
        onMatchSettled();
        void refreshProfile();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refresh room state.');
    }
  }, [apiFetch, onMatchSettled, refreshProfile, roomCode]);

  // Subscribe to WebSocket room updates + heartbeat
  useEffect(() => {
    sendWsMessage({ type: 'games:subscribe_room', roomCode });
    const hb = window.setInterval(() => {
      sendWsMessage({ type: 'games:heartbeat', roomCode });
    }, 15_000);

    return () => {
      window.clearInterval(hb);
      sendWsMessage({ type: 'games:unsubscribe_room', roomCode });
    };
  }, [roomCode, sendWsMessage]);

  // React to incoming WebSocket room events
  useEffect(() => {
    if (!lastWsEvent) return;
    const evtType = String(lastWsEvent.type || '');
    const evtRoom = String(lastWsEvent.roomCode || '').toUpperCase();
    if (evtRoom !== roomCode.toUpperCase()) return;

    if (evtType === 'games:chat_message' && lastWsEvent.chatItem) {
      const msg = lastWsEvent.chatItem as ChatMessage;
      setChatLog((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev.slice(-49), msg]));
      return;
    }

    if (evtType === 'games:match_started') {
      playTacticalSound('start', mutedRef.current);
      void reloadRoom();
      return;
    }

    if (evtType === 'games:match_ended') {
      playTacticalSound('victory', mutedRef.current);
      void reloadRoom();
      return;
    }

    if (
      evtType === 'games:room_updated' ||
      evtType === 'games:player_ready' ||
      evtType === 'games:state_sync' ||
      evtType === 'games:player_disconnected' ||
      evtType === 'games:player_reconnected'
    ) {
      void reloadRoom();
    }
  }, [lastWsEvent, reloadRoom, roomCode]);

  // Match countdown timer
  useEffect(() => {
    const updateTimer = () => {
      if (snapshot.room.status !== 'active' || !snapshot.session?.startedAt) {
        setRemainingSeconds(snapshot.room.durationSeconds);
        return;
      }
      const elapsed = Math.floor((Date.now() - new Date(snapshot.session.startedAt).getTime()) / 1000);
      setRemainingSeconds(Math.max(0, snapshot.room.durationSeconds - elapsed));
    };
    updateTimer();
    const id = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(id);
  }, [snapshot.room.durationSeconds, snapshot.room.status, snapshot.session?.startedAt]);

  const copyText = (key: string, value: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1800);
    }
  };

  const handleToggleReady = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const next = await apiFetch<RoomSnapshot>(`/api/games/rooms/${encodeURIComponent(roomCode)}/ready`, {
        method: 'POST',
        body: JSON.stringify({ ready: !(snapshot.myPlayer?.ready ?? false) }),
      });
      setSnapshot(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update ready status.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartMatch = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const next = await apiFetch<RoomSnapshot>(`/api/games/rooms/${encodeURIComponent(roomCode)}/start`, {
        method: 'POST',
      });
      playTacticalSound('start', muted);
      setSnapshot(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start match.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinishMatch = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const next = await apiFetch<RoomSnapshot>(`/api/games/rooms/${encodeURIComponent(roomCode)}/finish`, {
        method: 'POST',
      });
      playTacticalSound('victory', muted);
      setSnapshot(next);
      onMatchSettled();
      void refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to conclude match.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGameplayAction = async (eventType: string, payload: Record<string, unknown>) => {
    setSubmitting(true);
    setError(null);
    const clientEventId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    try {
      const next = await apiFetch<RoomSnapshot>(`/api/games/rooms/${encodeURIComponent(roomCode)}/action`, {
        method: 'POST',
        body: JSON.stringify({ clientEventId, eventType, payload }),
      });
      setSnapshot(next);
      if (next.feedback) setFeedback(next.feedback);

      if (next.matchEnded || next.session?.status === 'completed') {
        playTacticalSound('victory', muted);
        onMatchSettled();
        void refreshProfile();
      } else if (next.valid === false) {
        playTacticalSound('error', muted);
      } else if ((next.pointsAwarded ?? 0) > 0) {
        playTacticalSound('success', muted);
      } else if (eventType === 'sabotage' || eventType === 'call_meeting') {
        playTacticalSound('alert', muted);
      }
    } catch (err) {
      playTacticalSound('error', muted);
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUsername.trim()) return;
    setInviteStatus(null);
    setError(null);
    try {
      const res = await apiFetch<{ ok: boolean; invitedUsername: string }>(
        `/api/games/rooms/${encodeURIComponent(roomCode)}/invite`,
        {
          method: 'POST',
          body: JSON.stringify({ username: inviteUsername.trim() }),
        },
      );
      setInviteStatus(`Invitation dispatched to @${res.invitedUsername}`);
      setInviteUsername('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite player.');
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = chatInput.trim();
    if (!message) return;
    setChatInput('');
    try {
      await apiFetch(`/api/games/rooms/${encodeURIComponent(roomCode)}/chat`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send chat message.');
    }
  };

  const handleLeaveRoom = async () => {
    try {
      await apiFetch(`/api/games/rooms/${encodeURIComponent(roomCode)}/leave`, { method: 'POST' });
    } catch {
      // Proceed to exit cleanly even if room already closed
    }
    onExitRoom();
  };

  const isHostOrAdmin = Boolean(
    user && (snapshot.room.hostUserId === user.id || ['owner', 'event_admin'].includes(user.role)),
  );
  const mins = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const secs = String(remainingSeconds % 60).padStart(2, '0');
  const isCompleted = snapshot.room.status === 'completed' || snapshot.session?.status === 'completed';

  return (
    <div className="space-y-6">
      {/* Top Control Header */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onExitRoom}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Arena
            </button>
            <span className="font-mono text-xs text-emerald-500 uppercase">
              {snapshot.room.status} · {snapshot.room.mode.replace(/_/g, ' ')}
            </span>
          </div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
            {snapshot.room.name} — {snapshot.game.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Engine: {snapshot.game.engineType.replace(/_/g, ' ')} · Difficulty: {snapshot.game.difficulty}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs">
            <span className="text-slate-500 mr-2">Room Code</span>
            <strong className="font-mono text-cyan-500 mr-2">{roomCode}</strong>
            <button
              type="button"
              onClick={() => copyText('room', roomCode)}
              aria-label="Copy room code"
              className="text-slate-400 hover:text-emerald-500"
            >
              {copiedKey === 'room' ? <Check className="h-3.5 w-3.5 inline text-emerald-500" /> : <Copy className="h-3.5 w-3.5 inline" />}
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 font-mono text-xs tabular-nums flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            <span>
              {mins}:{secs}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Unmute tactical audio' : 'Mute tactical audio'}
            className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-slate-500 hover:text-emerald-500"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => void handleLeaveRoom()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 px-3 py-2 text-xs font-medium text-rose-500 hover:bg-rose-500/10 whitespace-nowrap shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" />
            Leave Room
          </button>
        </div>
      </div>

      {/* Team Codes Strip (only when Team Code mode enabled) */}
      {snapshot.teams.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <Shield className="h-4 w-4 text-violet-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Team Access Codes (Distinct from Room Code):
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {snapshot.teams.map((tm) => (
              <div
                key={tm.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5"
              >
                <span className="font-semibold">{tm.name}:</span>
                <span className="font-mono text-violet-400">{tm.teamCode}</span>
                <button
                  type="button"
                  onClick={() => copyText(`team-${tm.id}`, tm.teamCode)}
                  aria-label={`Copy team code for ${tm.name}`}
                  className="text-slate-400 hover:text-emerald-500"
                >
                  {copiedKey === `team-${tm.id}` ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-400">
          {error}
        </div>
      )}

      {feedback && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3.5 text-xs text-cyan-400">
          {feedback}
        </div>
      )}

      {/* Main Workspace Grid: Play Stage + Live Roster & Chat Sidebar */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Waiting Lobby Controls */}
          {snapshot.room.status === 'waiting' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-5">
              <div className="space-y-1">
                <h3 className="font-display text-lg font-semibold">Pre-Match Briefing &amp; Ready Check</h3>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {snapshot.game.instructions}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {snapshot.myPlayer && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleToggleReady()}
                    className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      snapshot.myPlayer.ready
                        ? 'border border-emerald-500 bg-emerald-500/15 text-emerald-400'
                        : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                    }`}
                  >
                    {snapshot.myPlayer.ready ? 'Ready Checked' : 'Mark Ready'}
                  </button>
                )}

                {isHostOrAdmin && (
                  <button
                    type="button"
                    disabled={submitting || snapshot.room.isLocked}
                    onClick={() => void handleStartMatch()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Start Match Now
                  </button>
                )}
              </div>

              {/* Host Invite Player Form */}
              {snapshot.room.mode !== 'solo' && (
                <form onSubmit={handleInvite} className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <label htmlFor="invite-player-input" className="block text-xs font-medium text-slate-500">
                    Invite Player by Username or Email
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      id="invite-player-input"
                      type="text"
                      value={inviteUsername}
                      onChange={(e) => setInviteUsername(e.target.value)}
                      placeholder="username or email..."
                      className="flex-1 min-w-[200px] rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Send Invite
                    </button>
                  </div>
                  {inviteStatus && <p className="text-xs text-emerald-500">{inviteStatus}</p>}
                </form>
              )}
            </div>
          )}

          {/* Active or Completed Match Stage */}
          {snapshot.session && (
            <>
              <GamePlayStage
                snapshot={snapshot}
                currentUserId={user?.id ?? null}
                submitting={submitting}
                onAction={handleGameplayAction}
              />

              {isHostOrAdmin && snapshot.room.status === 'active' && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleFinishMatch()}
                    className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-400 hover:bg-amber-500/20"
                  >
                    Conclude Match &amp; Settle Scores
                  </button>
                </div>
              )}
            </>
          )}

          {/* Post-Match Settlement Banner */}
          {isCompleted && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <Trophy className="h-5 w-5" />
                <h3 className="font-display text-base font-bold">Match Settled — Rewards Credited</h3>
              </div>
              <p className="text-xs text-slate-300">
                Final standings, Game XP, unified KALI3977 XP, Game Coins, missions, and achievements have been persisted server-side.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onExitRoom}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                >
                  Return to Games Arena Hub
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Roster / Scoreboard + Room Chat */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-500" />
                Live Scoreboard ({snapshot.players.length}/{snapshot.room.maxPlayers})
              </h3>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {snapshot.players.map((p, idx) => (
                <div key={p.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-slate-400">#{idx + 1}</span>
                      <span className="font-semibold truncate">{p.displayName}</span>
                      {p.connected ? (
                        <span title="Connected" className="shrink-0">
                          <Wifi className="h-3 w-3 text-emerald-500" />
                        </span>
                      ) : (
                        <span title="Disconnected" className="shrink-0">
                          <WifiOff className="h-3 w-3 text-rose-500" />
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-[11px] text-slate-500">
                      @{p.username} · {p.side !== 'solo' ? p.side.toUpperCase() : p.roleInGame} ·{' '}
                      {p.ready ? 'Ready' : 'Waiting'}
                    </p>
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <p className="font-bold text-cyan-500">{p.score} pts</p>
                    <p className="text-[11px] text-slate-500">{p.accuracyPct}% acc</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Real-Time Room Chat */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 flex flex-col space-y-3">
            <h3 className="font-display text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-cyan-500" />
              Live Tactical Room Chat
            </h3>

            <div className="h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-3 space-y-2 text-xs">
              {chatLog.length === 0 ? (
                <p className="text-slate-500">
                  No chat messages yet. Coordinate strategy or debate emergency meetings here.
                </p>
              ) : (
                chatLog.map((m) => (
                  <div key={m.id} className="space-y-0.5">
                    <span className="font-semibold text-emerald-500">{m.displayName}: </span>
                    <span className="text-slate-700 dark:text-slate-200 break-words">{m.message}</span>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendChat} className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Send room message..."
                aria-label="Room chat message"
                className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
              />
              <button
                type="submit"
                aria-label="Send message"
                className="rounded-lg bg-cyan-500 px-3 py-2 text-slate-950 hover:bg-cyan-400 shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
