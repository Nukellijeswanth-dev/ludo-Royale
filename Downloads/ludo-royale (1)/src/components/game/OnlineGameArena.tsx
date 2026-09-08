import React, { useState, useEffect, useMemo, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Room, RoomPlayer } from '../../types/roomTypes';
import { Player, PlayerColor, GameEventNotification } from '../../types/gameTypes';
import { roomService, ReactionPayload, ChatPayload } from '../../services/roomService';
import { presenceService, PresenceInfo } from '../../services/presenceService';
import { audio } from '../../audio/audioManager';
import { LudoBoard } from '../board/LudoBoard';
import { Dice } from './Dice';
import { PlayerCard } from './PlayerCard';
import { TurnIndicator } from './TurnIndicator';
import { MobilePlayerBar } from './MobilePlayerBar';
import { GameEventToast } from './GameEventToast';
import { ReactionBar } from '../social/ReactionBar';
import { QuickChat } from '../social/QuickChat';
import { ChatPanel } from '../social/ChatPanel';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Avatar } from '../common/Avatar';
import {
  Crown,
  Radio,
  Copy,
  Check,
  LogOut,
  Volume2,
  VolumeX,
  Trophy,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Flame,
  Swords,
  Home,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';

interface OnlineGameArenaProps {
  initialRoom: Room;
  onLeaveMatch: () => void;
}

export const OnlineGameArena: React.FC<OnlineGameArenaProps> = ({
  initialRoom,
  onLeaveMatch,
}) => {
  const [room, setRoom] = useState<Room>(initialRoom);
  const [presence, setPresence] = useState<PresenceInfo>(presenceService.getPresenceInfo());
  const [soundOn, setSoundOn] = useState<boolean>(audio.isSoundEnabled());
  const [floatingReactions, setFloatingReactions] = useState<ReactionPayload[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatPayload[]>([]);
  const [activeToastEvent, setActiveToastEvent] = useState<GameEventNotification | null>(null);
  const [showForfeitModal, setShowForfeitModal] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Chat panel state
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<ChatPayload[]>(roomService.getChatHistory());
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const isChatOpenRef = useRef<boolean>(false);

  const playerInfo = roomService.getPlayerInfo();
  const gameState = room.gameState;

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
    if (isChatOpen) {
      setUnreadCount(0);
    }
  }, [isChatOpen]);

  // Track previous state values for sounds
  const prevRollingRef = useRef<boolean>(false);
  const prevStepRef = useRef<number | null>(null);
  const victoryTriggeredRef = useRef<boolean>(false);

  // Subscribe to room updates
  useEffect(() => {
    const activeTimers: NodeJS.Timeout[] = [];

    const unsubRoom = roomService.subscribe((updated) => {
      if (updated) {
        setRoom(updated);
      }
    });

    const unsubPresence = presenceService.subscribe((p) => setPresence(p));

    const unsubEvents = roomService.subscribeGameEvent((event) => {
      setActiveToastEvent(event);
      const timer = setTimeout(() => {
        setActiveToastEvent((prev) => (prev?.id === event.id ? null : prev));
      }, 2500);
      activeTimers.push(timer);

      if (event.type === 'ROLL_SIX') audio.playSixRolled();
      else if (event.type === 'CAPTURE') audio.playCapture();
      else if (event.type === 'TOKEN_HOME') audio.playTokenFinished();
      else if (event.type === 'VICTORY') audio.playWin();
    });

    const unsubReactions = roomService.subscribeReaction((r) => {
      setFloatingReactions((prev) => [...prev, r]);
      const timer = setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((item) => item.id !== r.id));
      }, 2500);
      activeTimers.push(timer);
    });

    const unsubChatHistory = roomService.subscribeChatHistory((history) => {
      setChatHistory(history);
    });

    const unsubChat = roomService.subscribeChat((c) => {
      setChatMessages((prev) => [...prev, c]);
      const timer = setTimeout(() => {
        setChatMessages((prev) => prev.filter((item) => item.id !== c.id));
      }, 3500);
      activeTimers.push(timer);

      // Increment unread count if chat is closed and message is not mine
      if (!isChatOpenRef.current && c.playerId !== playerInfo.id) {
        setUnreadCount((prev) => prev + 1);
      }
    });

    // Request full history from server
    roomService.requestChatHistory();

    return () => {
      activeTimers.forEach((t) => clearTimeout(t));
      unsubRoom();
      unsubPresence();
      unsubEvents();
      unsubReactions();
      unsubChat();
      unsubChatHistory();
    };
  }, []);

  // Play sound on dice roll start
  useEffect(() => {
    if (gameState?.diceRolling && !prevRollingRef.current) {
      audio.playDiceRoll();
    }
    prevRollingRef.current = gameState?.diceRolling || false;
  }, [gameState?.diceRolling]);

  // Play sound on step movement
  useEffect(() => {
    const currentStep = gameState?.movingTokenStep?.stepIndex ?? null;
    if (currentStep !== null && currentStep !== prevStepRef.current) {
      audio.playTokenMove();
    }
    prevStepRef.current = currentStep;
  }, [gameState?.movingTokenStep]);

  // Trigger celebration on victory
  useEffect(() => {
    if (gameState?.winner && !victoryTriggeredRef.current) {
      victoryTriggeredRef.current = true;
      audio.playWin();

      // Confetti burst
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#EF4444', '#10B981', '#F59E0B', '#3B82F6', '#EC4899'],
      });

      const timer = setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
        });
        confetti({
          particleCount: 60,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
        });
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [gameState?.winner]);

  // Derive active player
  const activePlayers = gameState?.players || [];
  const currentPlayer = activePlayers[gameState?.currentPlayerIndex || 0];
  const isMyTurn = currentPlayer?.id === playerInfo.id;
  const myPlayerInRoom = room.players.find((p) => p.id === playerInfo.id);
  const isHost = myPlayerInRoom?.isHost || false;

  // Can the current user roll the dice?
  const canRoll =
    isMyTurn &&
    gameState?.status === 'IDLE' &&
    !gameState?.diceRolling &&
    !gameState?.winner &&
    gameState?.animatingTokenId === null &&
    !gameState?.diceRolled;

  // Actions
  const handleRollDice = () => {
    if (!canRoll) return;
    roomService.rollDice();
  };

  const handleSelectToken = (tokenId: number) => {
    if (!isMyTurn) return;
    if (gameState?.status !== 'WAITING_MOVE') return;
    roomService.moveToken(tokenId);
  };

  const handleSendChatMessage = (text: string) => {
    roomService.sendChatMessage(text);
  };

  const handleSendReaction = (emoji: string) => {
    roomService.sendReaction(emoji);
  };

  const handleSendQuickChat = (text: string) => {
    roomService.sendQuickChat(text);
  };

  const handleToggleSound = () => {
    const next = !soundOn;
    audio.setSoundEnabled(next);
    setSoundOn(next);
  };

  const handleCopyRoomCode = () => {
    if (!room?.code) return;
    navigator.clipboard.writeText(room.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleConfirmForfeit = () => {
    setShowForfeitModal(false);
    roomService.leaveRoom();
    onLeaveMatch();
  };

  // Map players to exact physical corners:
  // Red = Top-Left, Green = Top-Right, Yellow = Bottom-Right, Blue = Bottom-Left
  const redPlayer = useMemo(
    () => activePlayers.find((p) => p.color === 'RED'),
    [activePlayers]
  );
  const greenPlayer = useMemo(
    () => activePlayers.find((p) => p.color === 'GREEN'),
    [activePlayers]
  );
  const yellowPlayer = useMemo(
    () => activePlayers.find((p) => p.color === 'YELLOW'),
    [activePlayers]
  );
  const bluePlayer = useMemo(
    () => activePlayers.find((p) => p.color === 'BLUE'),
    [activePlayers]
  );

  // If match has concluded, show winner summary
  const winner = gameState?.winner;
  const isMeWinner = winner?.id === playerInfo.id;

  return (
    <div className="relative w-full h-screen max-h-screen overflow-hidden bg-[#050510] text-white flex flex-col justify-between p-2 sm:p-3 select-none">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Real-Time Toast Banner (Captures, Sixes, Safe Zones, Home) */}
      <GameEventToast event={activeToastEvent} />

      {/* Floating Animated Reactions & Chat */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
        {floatingReactions.map((r) => (
          <div
            key={r.id}
            className="absolute bottom-28 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none animate-in fade-in zoom-in-75 slide-in-from-bottom-6 duration-300"
          >
            <span className="text-4xl sm:text-5xl filter drop-shadow-[0_0_20px_rgba(251,191,36,0.7)] animate-bounce">
              {r.emoji}
            </span>
            <span className="mt-1 px-2.5 py-0.5 rounded-full bg-slate-900/95 border border-amber-400/40 text-[10px] sm:text-xs font-bold text-amber-200 shadow-xl backdrop-blur-md">
              {r.playerName}
            </span>
          </div>
        ))}

        {chatMessages.map((chat) => (
          <div
            key={chat.id}
            className="absolute bottom-40 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-amber-400/60 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold text-amber-200 shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in zoom-in-90 slide-in-from-bottom-4 duration-200"
          >
            <span className="text-white/80 font-normal">{chat.playerName || 'Player'}:</span>
            <span>"{chat.message || chat.text}"</span>
          </div>
        ))}
      </div>

      {/* Top Header Controls Bar */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between gap-2 py-1 z-20 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowForfeitModal(true)}
            className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-rose-400 hover:bg-rose-950/40 hover:border-rose-500/40 transition-colors flex items-center gap-1.5 text-xs sm:text-sm font-bold cursor-pointer shadow"
            title="Leave / Forfeit match"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Leave Match</span>
          </button>

          <button
            type="button"
            onClick={handleToggleSound}
            aria-label="Toggle Sound"
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shadow"
          >
            {soundOn ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>
        </div>

        {/* Room Code & Server Sync Badge */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyRoomCode}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-amber-400/50 text-slate-300 text-xs font-mono font-bold transition-all cursor-pointer"
            title="Click to copy Room Code"
          >
            <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
            <span>ROOM:</span>
            <span className="text-amber-300 tracking-wider">{room.code}</span>
            {copiedCode ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live Sync {presence.latencyMs > 0 ? `• ${presence.latencyMs}ms` : ''}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            id="btn-toggle-chat"
            onClick={() => {
              setIsChatOpen(!isChatOpen);
              if (!isChatOpen) setUnreadCount(0);
            }}
            className="relative p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-amber-300 hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs sm:text-sm font-bold cursor-pointer shadow"
            title="Open In-Game Chat"
          >
            <MessageSquare className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Chat</span>
            {unreadCount > 0 && (
              <span
                id="chat-unread-badge"
                className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-black shadow-lg animate-pulse"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <QuickChat onSendChat={handleSendQuickChat} disabled={false} />
        </div>
      </header>

      {/* Mobile Player Summary Strip */}
      <MobilePlayerBar
        players={activePlayers}
        currentPlayerIndex={gameState?.currentPlayerIndex || 0}
      />

      {/* Turn Indicator & Live Status */}
      <div className="w-full max-w-2xl mx-auto my-0.5 z-10 flex-shrink-0">
        <TurnIndicator
          currentPlayer={currentPlayer}
          status={gameState?.status || 'IDLE'}
          lastActionText={gameState?.lastActionText || 'Waiting for action...'}
          diceValue={gameState?.diceValue || null}
          extraTurnGranted={gameState?.extraTurnGranted || false}
        />
        {/* Real-time Online Turn Helper Prompt */}
        <div className="text-center mt-1">
          {isMyTurn ? (
            <span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-amber-300 bg-amber-500/20 px-3 py-0.5 rounded-full border border-amber-400/50 animate-pulse">
              <Sparkles className="w-3 h-3 text-amber-300" />
              {gameState?.status === 'WAITING_MOVE'
                ? 'Select a glowing token to move'
                : 'Your turn — roll the dice!'}
            </span>
          ) : (
            <span className="text-[11px] font-medium text-slate-400">
              Waiting for <strong className="text-slate-200">{currentPlayer?.name || 'player'}</strong> to make a move...
            </span>
          )}
        </div>
      </div>

      {/* Main Board Arena Layout */}
      <main className="w-full max-w-5xl mx-auto flex-1 flex flex-col lg:flex-row items-center justify-center gap-2 sm:gap-4 my-auto z-10 min-h-0 overflow-hidden">
        {/* DESKTOP LEFT COLUMN: Red & Blue */}
        <div className="hidden lg:flex w-44 xl:w-52 flex-col justify-between h-[min(65vh,520px)] flex-shrink-0 py-2">
          {redPlayer ? (
            <PlayerCard
              player={redPlayer}
              isCurrentTurn={currentPlayer?.id === redPlayer.id}
            />
          ) : (
            <div className="p-3 rounded-2xl border border-slate-800 bg-slate-900/40 text-slate-500 text-xs font-bold text-center">
              Slot Red (Empty)
            </div>
          )}

          {bluePlayer ? (
            <PlayerCard
              player={bluePlayer}
              isCurrentTurn={currentPlayer?.id === bluePlayer.id}
            />
          ) : (
            <div className="p-3 rounded-2xl border border-slate-800 bg-slate-900/40 text-slate-500 text-xs font-bold text-center">
              Slot Blue (Empty)
            </div>
          )}
        </div>

        {/* CENTER COLUMN: Central Board & Controls */}
        <div className="flex flex-col items-center justify-center gap-2 flex-1 max-w-[min(90vw,520px)] sm:max-w-[min(70vh,520px)]">
          <div className="w-full aspect-square relative">
            <LudoBoard
              players={activePlayers}
              validMoves={isMyTurn ? gameState?.validMoves || [] : []}
              onSelectToken={handleSelectToken}
              movingTokenStep={gameState?.movingTokenStep || null}
              activeCaptureAnim={gameState?.activeCaptureAnim || null}
            />
          </div>

          {/* Action Hub: Interactive 3D Dice */}
          <div className="w-full flex items-center justify-center gap-3 py-1">
            <Dice
              value={gameState?.diceValue || null}
              rolling={gameState?.diceRolling || false}
              canRoll={canRoll}
              currentColor={currentPlayer?.color || 'RED'}
              playerName={currentPlayer?.name}
              onRoll={handleRollDice}
              needsTokenSelection={isMyTurn && gameState?.status === 'WAITING_MOVE'}
            />
          </div>
        </div>

        {/* DESKTOP RIGHT COLUMN: Green & Yellow */}
        <div className="hidden lg:flex w-44 xl:w-52 flex-col justify-between h-[min(65vh,520px)] flex-shrink-0 py-2">
          {greenPlayer ? (
            <PlayerCard
              player={greenPlayer}
              isCurrentTurn={currentPlayer?.id === greenPlayer.id}
            />
          ) : (
            <div className="p-3 rounded-2xl border border-slate-800 bg-slate-900/40 text-slate-500 text-xs font-bold text-center">
              Slot Green (Empty)
            </div>
          )}

          {yellowPlayer ? (
            <PlayerCard
              player={yellowPlayer}
              isCurrentTurn={currentPlayer?.id === yellowPlayer.id}
            />
          ) : (
            <div className="p-3 rounded-2xl border border-slate-800 bg-slate-900/40 text-slate-500 text-xs font-bold text-center">
              Slot Yellow (Empty)
            </div>
          )}
        </div>
      </main>

      {/* Bottom Social Reactions Toolbar */}
      <footer className="w-full max-w-md mx-auto py-1 z-20 flex-shrink-0 flex items-center justify-center">
        <ReactionBar onSendReaction={handleSendReaction} />
      </footer>

      {/* Forfeit Confirmation Modal */}
      <Modal
        isOpen={showForfeitModal}
        onClose={() => setShowForfeitModal(false)}
        title="Leave Match"
        size="sm"
      >
        <div className="p-5 text-center flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Forfeit this match?</h3>
            <p className="text-xs text-slate-400 mt-1">
              Leaving an ongoing match will forfeit your position. Remaining players will continue.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowForfeitModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={handleConfirmForfeit}
            >
              Leave
            </Button>
          </div>
        </div>
      </Modal>

      {/* Victory Celebration Modal */}
      {winner && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-400/60 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(245,158,11,0.35)] flex flex-col items-center text-center gap-5 animate-in fade-in zoom-in duration-300">
            {/* Crown & Trophy Icon */}
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Trophy className="w-10 h-10 text-amber-400 animate-bounce" />
              </div>
              <Crown className="w-8 h-8 text-amber-300 absolute -top-4 -right-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" />
            </div>

            {/* Title & Winner Identity */}
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-amber-400 mb-1 flex items-center justify-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                ROYAL CHAMPION
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black font-display text-white">
                {isMeWinner ? 'YOU WON THE MATCH!' : `${winner.name} WINS!`}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {isMeWinner
                  ? 'All 4 tokens guided home triumphantly!'
                  : 'Congratulations to the victor of the royal arena!'}
              </p>
            </div>

            {/* Winner Player Card */}
            <div className="w-full p-4 rounded-2xl bg-slate-900 border border-amber-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar avatar={winner.avatar} color={winner.color} size="md" />
                <div className="text-left">
                  <div className="text-sm font-bold text-white flex items-center gap-1">
                    <span>{winner.name}</span>
                    {isMeWinner && (
                      <span className="text-[10px] font-black text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    Captures: <strong className="text-amber-300">{winner.captures}</strong> • Home: <strong className="text-emerald-400">4/4</strong>
                  </div>
                </div>
              </div>
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>

            {/* Match Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
              <Button
                variant="primary"
                className="w-full"
                onClick={() => {
                  roomService.leaveRoom();
                  onLeaveMatch();
                }}
              >
                <Home className="w-4 h-4 mr-1.5" />
                Return to Lobby / Home
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-out / Floating In-Game Chat Panel */}
      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={chatHistory}
        onSendMessage={handleSendChatMessage}
        myPlayerId={playerInfo.id}
      />
    </div>
  );
};
