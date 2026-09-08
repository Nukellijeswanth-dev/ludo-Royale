import React, { useState, useEffect, useMemo } from 'react';
import { gameEngine } from '../game/gameEngine';
import { GameState, AICommentary, Reaction, QuickChatMessage } from '../types/gameTypes';
import { LudoBoard } from '../components/board/LudoBoard';
import { Dice } from '../components/game/Dice';
import { PlayerCard } from '../components/game/PlayerCard';
import { TurnIndicator } from '../components/game/TurnIndicator';
import { MobilePlayerBar } from '../components/game/MobilePlayerBar';
import { GameEventToast } from '../components/game/GameEventToast';
import { ReactionBar } from '../components/social/ReactionBar';
import { QuickChat } from '../components/social/QuickChat';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import { audio } from '../audio/audioManager';
import { Pause, Play, RotateCcw, Home, Volume2, VolumeX, Settings as SettingsIcon, Bot } from 'lucide-react';

interface GameScreenProps {
  onReturnHome: () => void;
  onOpenSettings: () => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  onReturnHome,
  onOpenSettings,
}) => {
  const [state, setState] = useState<GameState>(gameEngine.getState());
  const [floatingReactions, setFloatingReactions] = useState<Reaction[]>([]);
  const [chatMessages, setChatMessages] = useState<QuickChatMessage[]>([]);
  const [latestCommentary, setLatestCommentary] = useState<AICommentary | null>(null);
  const [showPauseModal, setShowPauseModal] = useState<boolean>(false);
  const [soundOn, setSoundOn] = useState<boolean>(audio.isSoundEnabled());

  // Subscribe to game engine state changes
  useEffect(() => {
    const unsubState = gameEngine.subscribe((newState) => {
      setState(newState);
    });

    const unsubReaction = gameEngine.subscribeReactions((reaction) => {
      setFloatingReactions((prev) => [...prev, reaction]);
      setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((r) => r.id !== reaction.id));
      }, 2500);
    });

    const unsubChat = gameEngine.subscribeChat((chat) => {
      setChatMessages((prev) => [...prev, chat]);
      setTimeout(() => {
        setChatMessages((prev) => prev.filter((c) => c.id !== chat.id));
      }, 3500);
    });

    const unsubCommentary = gameEngine.subscribeCommentary((comm) => {
      setLatestCommentary(comm);
    });

    return () => {
      unsubState();
      unsubReaction();
      unsubChat();
      unsubCommentary();
    };
  }, []);

  const currentPlayer = state.players[state.currentPlayerIndex];
  const isHumanTurn = !currentPlayer?.isAI;
  const canRoll =
    isHumanTurn &&
    state.gameStatus === 'IDLE' &&
    !state.diceRolling &&
    !state.winner &&
    state.animatingTokenId === null;

  const handleRollDice = () => {
    if (!canRoll) return;
    gameEngine.rollDice();
  };

  const handleSelectToken = (tokenId: number) => {
    if (!isHumanTurn) return;
    if (state.gameStatus !== 'WAITING_MOVE') return;
    gameEngine.moveToken(tokenId);
  };

  const handlePause = () => {
    gameEngine.pauseGame();
    setShowPauseModal(true);
  };

  const handleResume = () => {
    setShowPauseModal(false);
    gameEngine.resumeGame();
  };

  const handleRestart = () => {
    setShowPauseModal(false);
    gameEngine.restartMatch();
  };

  const handleSendReaction = (emoji: string) => {
    if (!currentPlayer) return;
    gameEngine.sendReaction(currentPlayer.id, emoji);
  };

  const handleSendQuickChat = (text: string) => {
    if (!currentPlayer) return;
    gameEngine.sendQuickChat(currentPlayer.id, text);
  };

  const handleToggleSound = () => {
    const next = !soundOn;
    audio.setSoundEnabled(next);
    setSoundOn(next);
  };

  // Map players to exact physical corners:
  // Red = Top-Left, Green = Top-Right, Yellow = Bottom-Right, Blue = Bottom-Left
  const redPlayer = useMemo(
    () => state.players.find((p) => p.color === 'RED') || state.players[0],
    [state.players]
  );
  const greenPlayer = useMemo(
    () => state.players.find((p) => p.color === 'GREEN') || state.players[1],
    [state.players]
  );
  const yellowPlayer = useMemo(
    () => state.players.find((p) => p.color === 'YELLOW') || state.players[2],
    [state.players]
  );
  const bluePlayer = useMemo(
    () => state.players.find((p) => p.color === 'BLUE') || state.players[3],
    [state.players]
  );

  return (
    <div className="relative w-full h-screen max-h-screen overflow-hidden bg-[#050510] text-white flex flex-col justify-between p-2 sm:p-3 select-none">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Dynamic Game Event Toast Banner (Six, Extra Turn, Capture, Safe, Home, Victory) */}
      <GameEventToast />

      {/* Floating Animated Reactions */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
        {floatingReactions.map((r) => (
          <div
            key={r.id}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 text-4xl sm:text-5xl animate-bounce drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]"
          >
            {r.emoji}
          </div>
        ))}

        {/* Floating Quick Chat Bubbles */}
        {chatMessages.map((chat) => (
          <div
            key={chat.id}
            className="absolute bottom-28 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-amber-400/60 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold text-amber-200 shadow-2xl backdrop-blur-md flex items-center gap-2 animate-bounce"
          >
            <span className="text-white/80 font-normal">{chat.playerName}:</span>
            <span>"{chat.text}"</span>
          </div>
        ))}
      </div>

      {/* Top Header Controls Bar */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between gap-2 py-1 z-20 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePause}
            className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs sm:text-sm font-bold cursor-pointer shadow"
          >
            <Pause className="w-4 h-4" />
            <span className="hidden sm:inline">Pause</span>
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

        <h2 className="text-xs sm:text-sm md:text-base font-black tracking-widest text-amber-300 uppercase select-none">
          LUDO ROYALE
        </h2>

        <div className="flex items-center gap-1.5">
          <QuickChat onSendChat={handleSendQuickChat} disabled={!currentPlayer} />
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shadow"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile Player Summary Strip (Clean 4-capsule bar) */}
      <MobilePlayerBar
        players={state.players}
        currentPlayerIndex={state.currentPlayerIndex}
      />

      {/* Turn Indicator & Commentary Pill */}
      <div className="w-full max-w-2xl mx-auto my-0.5 z-10 flex-shrink-0">
        <TurnIndicator
          currentPlayer={currentPlayer}
          status={state.gameStatus}
          lastActionText={state.lastActionText}
          diceValue={state.diceValue}
          extraTurnGranted={state.extraTurnGranted}
        />
        {latestCommentary && (
          <div className="mt-0.5 text-center text-[10px] sm:text-xs text-amber-300/80 italic truncate px-2">
            "{latestCommentary.text}"
          </div>
        )}
      </div>

      {/* Main Board Arena Layout */}
      <main className="w-full max-w-5xl mx-auto flex-1 flex flex-col lg:flex-row items-center justify-center gap-2 sm:gap-4 my-auto z-10 min-h-0 overflow-hidden">
        {/* DESKTOP LEFT COLUMN: Red (Top-Left) & Blue (Bottom-Left) */}
        <div className="hidden lg:flex w-44 xl:w-52 flex-col justify-between h-[min(65vh,520px)] flex-shrink-0 py-2">
          {redPlayer && (
            <PlayerCard
              player={redPlayer}
              isCurrentTurn={state.players[state.currentPlayerIndex]?.id === redPlayer.id}
              compact={false}
            />
          )}
          {bluePlayer && (
            <PlayerCard
              player={bluePlayer}
              isCurrentTurn={state.players[state.currentPlayerIndex]?.id === bluePlayer.id}
              compact={false}
            />
          )}
        </div>

        {/* CENTER COLUMN: The 15x15 Ludo Board + Anchored Action Console */}
        <div className="flex-1 flex flex-col items-center justify-center gap-1.5 sm:gap-2 w-full max-w-[500px] min-h-0">
          {/* Ludo Board */}
          <div className="w-[min(94vw,min(56vh,480px))] aspect-square flex-shrink-0">
            <LudoBoard
              players={state.players}
              validMoves={isHumanTurn ? state.validMoves : []}
              onSelectToken={handleSelectToken}
              movingTokenStep={state.movingTokenStep}
              activeCaptureAnim={state.activeCaptureAnim}
            />
          </div>

          {/* DEDICATED ANCHORED ACTION DOCK (DICE + REACTIONS) */}
          <div className="w-full max-w-[480px] flex items-center justify-center gap-2 sm:gap-4 px-2 py-1 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl flex-shrink-0">
            <ReactionBar onReact={handleSendReaction} disabled={!currentPlayer} />

            <Dice
              value={state.diceValue}
              rolling={state.diceRolling}
              canRoll={canRoll}
              currentColor={currentPlayer?.color}
              playerName={currentPlayer?.name}
              onRoll={handleRollDice}
              disabled={!isHumanTurn}
              needsTokenSelection={isHumanTurn && state.gameStatus === 'WAITING_MOVE' && state.validMoves.length > 0}
            />
          </div>
        </div>

        {/* DESKTOP RIGHT COLUMN: Green (Top-Right) & Yellow (Bottom-Right) */}
        <div className="hidden lg:flex w-44 xl:w-52 flex-col justify-between h-[min(65vh,520px)] flex-shrink-0 py-2">
          {greenPlayer && (
            <PlayerCard
              player={greenPlayer}
              isCurrentTurn={state.players[state.currentPlayerIndex]?.id === greenPlayer.id}
              compact={false}
            />
          )}
          {yellowPlayer && (
            <PlayerCard
              player={yellowPlayer}
              isCurrentTurn={state.players[state.currentPlayerIndex]?.id === yellowPlayer.id}
              compact={false}
            />
          )}
        </div>
      </main>

      {/* Pause Menu Modal */}
      <Modal
        isOpen={showPauseModal}
        onClose={handleResume}
        title="Game Paused"
        maxWidth="sm"
      >
        <div className="flex flex-col gap-3 pt-2">
          <Button
            size="lg"
            variant="primary"
            onClick={handleResume}
            className="w-full justify-center"
          >
            <Play className="w-5 h-5 mr-2" /> Resume Game
          </Button>

          <Button
            size="lg"
            variant="secondary"
            onClick={handleRestart}
            className="w-full justify-center"
          >
            <RotateCcw className="w-5 h-5 mr-2" /> Restart Match
          </Button>

          <Button
            size="lg"
            variant="danger"
            onClick={onReturnHome}
            className="w-full justify-center"
          >
            <Home className="w-5 h-5 mr-2" /> Exit to Main Menu
          </Button>
        </div>
      </Modal>
    </div>
  );
};
