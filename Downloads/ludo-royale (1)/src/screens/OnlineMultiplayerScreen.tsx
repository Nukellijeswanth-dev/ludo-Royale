import React, { useState, useEffect } from 'react';
import { roomService, ConnectionStatus, MatchmakingState } from '../services/roomService';
import { presenceService, PresenceInfo } from '../services/presenceService';
import { Room, RoomPlayer, RoomState } from '../types/roomTypes';
import { PlayerColor } from '../types/gameTypes';
import { Avatar } from '../components/common/Avatar';
import { OnlineGameArena } from '../components/game/OnlineGameArena';
import { MatchmakingOverlay } from '../components/matchmaking/MatchmakingOverlay';
import { InviteFriendsDrawer } from '../components/friends/InviteFriendsDrawer';
import {
  ArrowLeft,
  Crown,
  Users,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Radio,
  Play,
  LogOut,
  AlertCircle,
  Sparkles,
  Wifi,
  WifiOff,
  RefreshCw,
  Plus,
  LogIn,
  UserCheck,
  Shield,
  ExternalLink,
  Link2,
  Share2,
  UserX,
  XCircle,
  Zap,
  Sliders,
} from 'lucide-react';
import { RoomRulesModal } from '../components/room/RoomRulesModal';
import { StressTestModal } from '../components/dev/StressTestModal';

interface OnlineMultiplayerScreenProps {
  onBack: () => void;
  onOpenFriends?: () => void;
}

const COLOR_MAP: Record<PlayerColor, { name: string; bg: string; border: string; text: string; dot: string; emoji: string }> = {
  RED: {
    name: 'Crimson Red',
    bg: 'bg-rose-500/15',
    border: 'border-rose-500/40',
    text: 'text-rose-400',
    dot: 'bg-rose-500',
    emoji: '🔴',
  },
  GREEN: {
    name: 'Emerald Green',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/40',
    text: 'text-emerald-400',
    dot: 'bg-emerald-500',
    emoji: '🟢',
  },
  YELLOW: {
    name: 'Solar Yellow',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/40',
    text: 'text-amber-400',
    dot: 'bg-amber-500',
    emoji: '🟡',
  },
  BLUE: {
    name: 'Royal Blue',
    bg: 'bg-sky-500/15',
    border: 'border-sky-500/40',
    text: 'text-sky-400',
    dot: 'bg-sky-500',
    emoji: '🔵',
  },
};

const SLOT_COLORS: PlayerColor[] = ['RED', 'GREEN', 'YELLOW', 'BLUE'];

export const OnlineMultiplayerScreen: React.FC<OnlineMultiplayerScreenProps> = ({
  onBack,
  onOpenFriends,
}) => {
  const [room, setRoom] = useState<Room | null>(roomService.getRoom());
  const [status, setStatus] = useState<ConnectionStatus>(roomService.getStatus());
  const [presence, setPresence] = useState<PresenceInfo>(presenceService.getPresenceInfo());
  const [error, setError] = useState<string | null>(roomService.getError());
  const [mmState, setMmState] = useState<MatchmakingState>(roomService.getMatchmakingState());

  const [activeTab, setActiveTab] = useState<'JOIN' | 'CREATE'>('CREATE');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [sharedSuccess, setSharedSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInviteFriendsOpen, setIsInviteFriendsOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isStressTestOpen, setIsStressTestOpen] = useState(false);

  // Tab player info
  const playerInfo = roomService.getPlayerInfo();
  const [customName, setCustomName] = useState(playerInfo.name);

  // Auto-detect invite link from URL
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room');
      if (urlRoom && urlRoom.length === 6 && !roomService.getRoom()) {
        setJoinCodeInput(urlRoom.toUpperCase());
        setActiveTab('JOIN');
      }
    } catch {
      // ignore
    }
  }, []);

  // Subscribe to real-time room updates
  useEffect(() => {
    const unsubRoom = roomService.subscribe((r) => {
      setRoom(r);
      setIsSubmitting(false);
    });
    const unsubStatus = roomService.subscribeStatus((s) => setStatus(s));
    const unsubPresence = presenceService.subscribe((p) => setPresence(p));
    const unsubError = roomService.subscribeError((err) => {
      setError(err);
      if (err) setIsSubmitting(false);
    });
    const unsubMm = roomService.subscribeMatchmaking((st) => setMmState(st));

    return () => {
      unsubRoom();
      unsubStatus();
      unsubPresence();
      unsubError();
      unsubMm();
    };
  }, []);

  const handleQuickMatch = async () => {
    if (customName.trim()) {
      roomService.setCustomPlayerName(customName.trim());
    }
    setError(null);
    await roomService.enterMatchmaking();
  };

  const handleCancelMatchmaking = () => {
    roomService.cancelMatchmaking();
  };

  const handleCreateRoom = async () => {
    if (customName.trim()) {
      roomService.setCustomPlayerName(customName.trim());
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await roomService.createRoom();
    } catch {
      setIsSubmitting(false);
    }
  };

  const handleJoinRoom = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = joinCodeInput.trim().toUpperCase();
    if (cleanCode.length !== 6) {
      setError('Please enter a valid 6-character room code.');
      return;
    }
    if (customName.trim()) {
      roomService.setCustomPlayerName(customName.trim());
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await roomService.joinRoom(cleanCode);
    } catch {
      setIsSubmitting(false);
    }
  };

  const handleCopyRoomCode = () => {
    if (!room) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(room.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyInviteLink = () => {
    if (!room) return;
    const url = roomService.getInviteUrl(room.code);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleShareRoom = async () => {
    const res = await roomService.shareRoom();
    if (res.success) {
      setSharedSuccess(true);
      setTimeout(() => setSharedSuccess(false), 2000);
    }
  };

  const handleOpenTestTab = () => {
    if (!room) return;
    const url = roomService.getInviteUrl(room.code);
    window.open(url, '_blank');
  };

  const handleToggleReady = () => {
    if (!room) return;
    const myPlayer = room.players.find((p) => p.id === playerInfo.id);
    if (!myPlayer) return;
    roomService.toggleReady(!myPlayer.isReady);
  };

  const handleStartGame = () => {
    roomService.startGame();
  };

  const handleLeaveRoom = () => {
    roomService.leaveRoom();
  };

  const handleKickPlayer = (targetPlayerId: string) => {
    roomService.kickPlayer(targetPlayerId);
  };

  const handleCloseRoom = () => {
    if (window.confirm('Are you sure you want to close this room? All players will be disconnected.')) {
      roomService.closeRoom();
    }
  };

  const myPlayer = room?.players.find((p) => p.id === playerInfo.id);
  const isHost = myPlayer?.isHost || false;

  // Unready players (excluding host)
  const unreadyPlayers = room?.players.filter((p) => !p.isHost && !p.isReady) || [];
  const hasMinPlayers = (room?.players.length || 0) >= (room?.minPlayers || 2);
  const canHostStart = room?.state === 'READY';

  // RENDER: Active Online Match View
  if (room && (room.state === 'PLAYING' || room.state === 'FINISHED') && room.gameState) {
    return (
      <OnlineGameArena
        initialRoom={room}
        onLeaveMatch={() => {
          setRoom(null);
          onBack();
        }}
      />
    );
  }

  // RENDER: Active Room Lobby View
  if (room) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-4 sm:p-6 select-none overflow-y-auto relative">
        {/* Real-time Matchmaking Matched Overlay */}
        {(mmState.status === 'SEARCHING' || mmState.status === 'MATCHED') && (
          <MatchmakingOverlay state={mmState} onCancel={handleCancelMatchmaking} />
        )}

        {/* Match Starting Countdown Overlay */}
        {room.state === 'STARTING' && (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-4">
            <div className="flex flex-col items-center gap-4 text-center animate-in zoom-in-95 duration-300">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-5xl font-black text-white shadow-[0_0_50px_rgba(245,158,11,0.6)] animate-pulse">
                {room.countdown ?? 3}
              </div>
              <h2 className="text-3xl font-black font-display tracking-wider text-white uppercase">
                MATCH STARTING!
              </h2>
              <p className="text-sm font-semibold text-amber-300 animate-pulse">
                Synchronizing board & launching royal arena...
              </p>
            </div>
          </div>
        )}
        {/* Top Room Navigation Bar */}
        <header className="w-full max-w-3xl flex items-center justify-between py-2 mb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLeaveRoom}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-rose-400 hover:bg-rose-950/40 hover:border-rose-500/40 transition-colors cursor-pointer text-xs sm:text-sm font-semibold"
            >
              <LogOut className="w-4 h-4" />
              <span>Leave Room</span>
            </button>

            {isHost && (
              <button
                type="button"
                onClick={handleCloseRoom}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 hover:text-white hover:bg-rose-900/60 transition-colors cursor-pointer text-xs sm:text-sm font-semibold"
                title="Close room for all players"
              >
                <XCircle className="w-4 h-4 text-rose-400" />
                <span>Close Room</span>
              </button>
            )}
          </div>

          {/* Connection Status Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs">
            {status === 'CONNECTED' && (
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Sync {presence.latencyMs > 0 ? `• ${presence.latencyMs}ms` : ''}
              </span>
            )}
            {status === 'RECONNECTING' && (
              <span className="flex items-center gap-1.5 text-amber-400 font-bold animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Reconnecting...
              </span>
            )}
            {status === 'DISCONNECTED' && (
              <span className="flex items-center gap-1.5 text-rose-400 font-bold">
                <WifiOff className="w-3 h-3" />
                Offline
              </span>
            )}
            {status === 'CONNECTING' && (
              <span className="flex items-center gap-1.5 text-sky-400 font-bold">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Connecting...
              </span>
            )}
          </div>
        </header>

        {/* Main Room Card */}
        <main className="w-full max-w-3xl bg-slate-900/95 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-md flex flex-col gap-5">
          {/* Header Title */}
          <div className="text-center border-b border-slate-800/80 pb-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1">
              Ludo Royale Multiplayer
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-display uppercase tracking-wider text-white">
              ONLINE LOBBY
            </h1>
          </div>

          {/* Room Code & State Banner */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800">
            <div className="text-center sm:text-left">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1.5">
                <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                ROOM CODE
              </div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                <span className="text-3xl sm:text-4xl font-black font-mono tracking-widest text-amber-300">
                  {room.code}
                </span>

                <button
                  type="button"
                  onClick={handleCopyRoomCode}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 transition-all cursor-pointer font-black text-xs uppercase tracking-wider shadow-sm"
                  title="Copy 6-character room code to clipboard"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">Room code copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>COPY CODE</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/40 text-blue-300 transition-all cursor-pointer font-bold text-xs uppercase tracking-wider shadow-sm"
                  title="Copy direct invite link"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-3.5 h-3.5" />
                      <span>COPY INVITE</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsInviteFriendsOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 transition-all cursor-pointer font-black text-xs uppercase tracking-wider shadow-sm"
                  title="Invite online friends directly"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>INVITE FRIENDS</span>
                </button>

                <button
                  type="button"
                  id="btn-room-rules-lobby"
                  onClick={() => setIsRulesModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 transition-all cursor-pointer font-bold text-xs"
                  title="Configure lobby game rules"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Room Rules</span>
                  {room.settings && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-200">
                      {room.settings.maxPlayers || room.maxPlayers}P
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleShareRoom}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/40 text-purple-300 transition-all cursor-pointer font-bold text-xs"
                  title="Share room invitation"
                >
                  {sharedSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Shared!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share Room</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleOpenTestTab}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 text-indigo-300 transition-all cursor-pointer font-bold text-xs"
                  title="Open a new browser tab to test as another player"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>2nd Player Tab</span>
                </button>

                {import.meta.env.DEV && (
                  <button
                    type="button"
                    onClick={() => setIsStressTestOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-300 transition-all cursor-pointer font-bold text-xs"
                    title="Dev-Only Multiplayer Stress Test Suite"
                  >
                    <Zap className="w-3.5 h-3.5 text-rose-400" />
                    <span>Stress Test</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Share this 6-character code with friends to join your match.
              </p>
            </div>

            {/* Room State Badge */}
            <div className="flex flex-col items-center sm:items-end">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                PLAYERS {room.players.length}/{room.maxPlayers}
              </span>
              {room.state === 'WAITING' && (
                <div className="px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>WAITING ({room.players.length}/4)</span>
                </div>
              )}
              {room.state === 'READY' && (
                <div className="px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>READY TO START</span>
                </div>
              )}
              {room.state === 'STARTING' && (
                <div className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 animate-pulse shadow-lg">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>STARTING IN {room.countdown ?? 3}s</span>
                </div>
              )}
              {room.state === 'PLAYING' && (
                <div className="px-3.5 py-1.5 rounded-full bg-indigo-500/30 border border-indigo-400/50 text-indigo-300 font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5" />
                  <span>GAME IN PROGRESS</span>
                </div>
              )}
              {room.state === 'FINISHED' && (
                <div className="px-3.5 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-black text-xs uppercase tracking-wider">
                  MATCH FINISHED
                </div>
              )}
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Countdown Overlay Alert when STARTING */}
          {room.state === 'STARTING' && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-amber-500/20 border border-amber-400/50 flex items-center justify-center gap-3 text-center">
              <Sparkles className="w-6 h-6 text-amber-300 animate-spin" />
              <div>
                <h3 className="text-base font-black text-amber-300">
                  LAUNCHING MATCH IN {room.countdown ?? 3}...
                </h3>
                <p className="text-xs text-slate-300">
                  Hold tight, all players are synchronized!
                </p>
              </div>
            </div>
          )}

          {/* Connected Players Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                PLAYERS {room.players.length}/{room.maxPlayers}
              </h3>
              <span className="text-[11px] text-slate-500">
                Min {room.minPlayers} players needed to start
              </span>
            </div>

            {/* Player Slot Grid (Dynamic 2, 3, or 4 based on room settings) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: room.maxPlayers || room.settings?.maxPlayers || 4 }, (_, i) => i).map((slotIndex) => {
                const player = room.players[slotIndex];
                if (player) {
                  const isCurrentClient = player.id === playerInfo.id;
                  const colorConfig = COLOR_MAP[player.color];

                  return (
                    <div
                      key={player.id}
                      className={`p-4 rounded-2xl border transition-all flex items-center gap-3 relative overflow-hidden ${
                        colorConfig.bg
                      } ${colorConfig.border} ${
                        isCurrentClient ? 'ring-2 ring-amber-400/60 shadow-lg' : ''
                      }`}
                    >
                      {/* Avatar with Color Emoji */}
                      <div className="relative">
                        <Avatar avatar={player.avatar} color={player.color} size="md" />
                        <span className="absolute -bottom-1 -left-1 text-sm select-none" title={colorConfig.name}>
                          {colorConfig.emoji}
                        </span>
                        {player.isHost && (
                          <span
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-md"
                            title="Room Host"
                          >
                            <Crown className="w-3 h-3 stroke-[2.5]" />
                          </span>
                        )}
                      </div>

                      {/* Player Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm select-none">{colorConfig.emoji}</span>
                          <span className="font-bold text-sm text-white truncate">
                            {player.name}
                          </span>
                          {typeof player.level === 'number' && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 border border-amber-500/30">
                              Lv.{player.level}
                            </span>
                          )}
                          {isCurrentClient && (
                            <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-400 text-slate-950">
                              YOU
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-xs font-semibold ${colorConfig.text}`}>
                            {colorConfig.name}
                          </span>
                          <span className="text-slate-600">•</span>
                          {player.isConnected ? (
                            <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                              🟢 Online
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                              ⚪ Offline
                            </span>
                          )}
                          {player.tokenSkin && player.tokenSkin !== 'classic' && (
                            <>
                              <span className="text-slate-600">•</span>
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30">
                                🎨 {player.tokenSkin}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Host Actions & Ready Status */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Remove Player Button (Host Only, for non-host players) */}
                        {isHost && !player.isHost && (
                          <button
                            type="button"
                            onClick={() => handleKickPlayer(player.id)}
                            title={`Remove ${player.name} from room`}
                            className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 hover:text-white transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span className="text-[10px] uppercase font-bold">Remove</span>
                          </button>
                        )}

                        {/* Ready / Host Badge */}
                        {player.isHost ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 font-bold text-xs uppercase tracking-wider">
                              <Crown className="w-3 h-3 text-amber-400" />
                              HOST 👑
                            </span>
                            <span className="text-[10px] font-bold text-emerald-400">READY</span>
                          </div>
                        ) : player.isReady ? (
                          <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-bold text-xs uppercase tracking-wider">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            READY
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 font-bold text-xs uppercase tracking-wider">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            NOT READY
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }

                // Empty Slot
                const slotColor = SLOT_COLORS[slotIndex];
                const slotEmoji = COLOR_MAP[slotColor].emoji;

                return (
                  <div
                    key={`empty-slot-${slotIndex}`}
                    className="p-4 rounded-2xl border-2 border-dashed border-slate-800 bg-slate-950/40 flex items-center gap-3 text-slate-600"
                  >
                    <div className="w-11 h-11 rounded-2xl border border-dashed border-slate-800 flex items-center justify-center text-sm font-mono">
                      {slotEmoji}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                        <span>{slotEmoji}</span>
                        <span>Waiting for player...</span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        Share room code <strong className="text-slate-400">{room.code}</strong> to join
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Bar */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 mt-2">
            {isHost ? (
              // HOST CONTROLS
              <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-center sm:text-left">
                  <div className="text-xs font-bold text-amber-300 flex items-center justify-center sm:justify-start gap-1">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    Host Controls 👑
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {!hasMinPlayers
                      ? 'Waiting for at least 2 players to join before starting.'
                      : unreadyPlayers.length > 0
                      ? `Waiting for ${unreadyPlayers.map((p) => p.name).join(', ')} to get ready.`
                      : 'All players are ready! You can now start the match.'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStartGame}
                  disabled={!canHostStart || room.state === 'STARTING' || room.state === 'PLAYING'}
                  className={`w-full sm:w-auto px-7 py-3.5 rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
                    canHostStart && room.state !== 'STARTING' && room.state !== 'PLAYING'
                      ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-slate-950 hover:brightness-110 active:scale-95 shadow-emerald-500/30'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                  }`}
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>START GAME</span>
                </button>
              </div>
            ) : (
              // NON-HOST CONTROLS
              <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-center sm:text-left">
                  <div className="text-xs font-bold text-slate-300 flex items-center justify-center sm:justify-start gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-sky-400" />
                    Player Status
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {myPlayer?.isReady
                      ? 'You are READY. Waiting for host to launch the match.'
                      : 'Click READY when you are set to play!'}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleToggleReady}
                    disabled={room.state === 'STARTING' || room.state === 'PLAYING'}
                    className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
                      myPlayer?.isReady
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                        : 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-slate-950 hover:brightness-110 active:scale-95 shadow-emerald-500/30'
                    }`}
                  >
                    {myPlayer?.isReady ? (
                      <>
                        <Clock className="w-4 h-4" />
                        <span>CANCEL READY</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>READY</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleLeaveRoom}
                    className="px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-all font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">LEAVE</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>

        <footer className="text-xs text-slate-500 py-3">
          Ludo Royale Real-Time WebSocket Infrastructure • Authoritative Host Sync
        </footer>

        {/* Invite Friends Drawer */}
        <InviteFriendsDrawer
          roomCode={room.code}
          isOpen={isInviteFriendsOpen}
          onClose={() => setIsInviteFriendsOpen(false)}
          onOpenFriendsScreen={() => {
            setIsInviteFriendsOpen(false);
            if (onOpenFriends) onOpenFriends();
          }}
        />

        {/* Room Rules Configuration Modal */}
        <RoomRulesModal
          isOpen={isRulesModalOpen}
          onClose={() => setIsRulesModalOpen(false)}
          room={room}
          onUpdateRules={(settings) => roomService.updateRoomSettings(settings)}
          isHost={isHost}
        />

        {/* Dev Stress Test Modal */}
        {import.meta.env.DEV && (
          <StressTestModal
            isOpen={isStressTestOpen}
            onClose={() => setIsStressTestOpen(false)}
          />
        )}
      </div>
    );
  }

  // RENDER: Room Lobby (Create / Join Tabs)
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-4 sm:p-6 select-none overflow-y-auto relative">
      {/* Real-time Matchmaking Modal */}
      {(mmState.status === 'SEARCHING' || mmState.status === 'MATCHED') && (
        <MatchmakingOverlay state={mmState} onCancel={handleCancelMatchmaking} />
      )}

      {/* Top Header */}
      <header className="w-full max-w-xl flex items-center justify-between py-2 mb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer text-xs sm:text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        <h1 className="text-xl sm:text-2xl font-bold font-display text-sky-400 flex items-center gap-2">
          <Radio className="w-5 h-5 text-sky-400 animate-pulse" />
          Room Lobby
        </h1>

        <div className="flex items-center gap-2">
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={() => setIsStressTestOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-300 transition-all cursor-pointer font-bold text-xs"
              title="Dev-Only Multiplayer Stress Test Suite"
            >
              <Zap className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Stress Test</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Lobby Form Container */}
      <main className="w-full max-w-xl bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md flex flex-col gap-6">
        {/* Hero Header */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-sky-500/15 border border-sky-400/40 text-sky-400 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-sky-500/10">
            <Users className="w-8 h-8" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black font-display text-white">
            Custom Match Rooms
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-sm mx-auto">
            Host a room for up to 4 players or enter an existing code to join friends.
          </p>
        </div>

        {/* Tab Player Identity Customization (Supports Multi-tab Testing) */}
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-3">
          <Avatar avatar={playerInfo.avatar} color="YELLOW" size="sm" />
          <div className="flex-1 min-w-0">
            <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Your Player Name (This Tab)
            </label>
            <input
              type="text"
              value={customName}
              maxLength={16}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Enter player name"
              className="w-full bg-transparent text-sm font-bold text-white focus:outline-none placeholder-slate-600 mt-0.5"
            />
          </div>
        </div>

        {/* QUICK MATCH HERO ACTION */}
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-sky-950/80 via-slate-900 to-indigo-950/80 border border-sky-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="text-center sm:text-left z-10">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black tracking-wider uppercase border border-emerald-500/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE QUEUE
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Auto-Matching</span>
            </div>
            <h3 className="text-base sm:text-lg font-black font-display text-white mt-1">
              Find Online Match
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 max-w-xs">
              Instantly pair with other online players. 100% real opponents, Elo ranked.
            </p>
          </div>

          <button
            id="quick-match-button"
            type="button"
            onClick={handleQuickMatch}
            disabled={isSubmitting || mmState.status !== 'IDLE'}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-b from-sky-400 via-sky-500 to-indigo-600 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-sky-500/25 cursor-pointer z-10 whitespace-nowrap"
          >
            <span className="text-base">🎮</span>
            <span>QUICK MATCH</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-[1px] flex-1 bg-slate-800" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">OR HOST PRIVATE ROOM</span>
          <div className="h-[1px] flex-1 bg-slate-800" />
        </div>

        {/* Create / Join Navigation Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-slate-950 border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setActiveTab('CREATE');
              setError(null);
            }}
            className={`py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'CREATE'
                ? 'bg-sky-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>CREATE ROOM</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('JOIN');
              setError(null);
            }}
            className={`py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'JOIN'
                ? 'bg-sky-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>JOIN ROOM</span>
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* TAB 1: CREATE ROOM */}
        {activeTab === 'CREATE' && (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-left space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <Crown className="w-4 h-4 text-amber-400" />
                <span>Host Privileges:</span>
              </div>
              <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                <li>Instant 6-character room code generated for friends</li>
                <li>Supports 2 to 4 live players with auto color assignment</li>
                <li>Authoritative start trigger once all players are Ready</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={handleCreateRoom}
              disabled={isSubmitting}
              className="w-full py-4 rounded-2xl bg-gradient-to-b from-sky-400 to-sky-600 text-slate-950 font-black text-base uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(56,189,248,0.3)] hover:brightness-110 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Creating Room...</span>
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                  <span>CREATE NEW ROOM</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* TAB 2: JOIN ROOM */}
        {activeTab === 'JOIN' && (
          <form onSubmit={handleJoinRoom} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 text-left">
                Enter 6-Character Room Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. ROYAL8"
                  className="w-full py-3.5 px-4 bg-slate-950 border border-slate-800 focus:border-sky-400 rounded-2xl text-center text-2xl font-black font-mono tracking-widest text-amber-300 uppercase placeholder-slate-700 focus:outline-none transition-colors"
                  autoFocus
                />
              </div>
              <span className="text-[11px] text-slate-500 block text-center mt-1.5">
                Ask your host friend for their 6-character code
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || joinCodeInput.trim().length !== 6}
              className="w-full py-4 rounded-2xl bg-gradient-to-b from-amber-400 to-amber-600 text-slate-950 font-black text-base uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(251,191,36,0.3)] hover:brightness-110 active:scale-98 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Joining Room...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5 stroke-[2.5]" />
                  <span>JOIN ROOM</span>
                </>
              )}
            </button>
          </form>
        )}
      </main>

      <footer className="text-xs text-slate-500 py-3">
        Tested for multi-tab sessions • Real WebSocket Server on Port 3000
      </footer>

      {/* Dev Stress Test Modal */}
      {import.meta.env.DEV && (
        <StressTestModal
          isOpen={isStressTestOpen}
          onClose={() => setIsStressTestOpen(false)}
        />
      )}
    </div>
  );
};
