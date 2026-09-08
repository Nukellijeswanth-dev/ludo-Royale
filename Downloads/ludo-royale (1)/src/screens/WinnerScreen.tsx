import React, { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Player } from '../types/gameTypes';
import { Avatar } from '../components/common/Avatar';
import { Button } from '../components/common/Button';
import { Trophy, Coins, Award, Flame, Swords, RotateCcw, Home as HomeIcon, Sparkles } from 'lucide-react';
import { calculateRewards } from '../game/scoring';
import { db } from '../database/database';
import { gameEngine } from '../game/gameEngine';
import { playerProfileService, MatchCompletionResult } from '../services/playerProfileService';

interface WinnerScreenProps {
  winner: Player;
  onPlayAgain: () => void;
  onHome: () => void;
  onLeaderboard: () => void;
}

export const WinnerScreen: React.FC<WinnerScreenProps> = ({
  winner,
  onPlayAgain,
  onHome,
  onLeaderboard,
}) => {
  const [completionResult, setCompletionResult] = useState<MatchCompletionResult | null>(null);
  const recordedRef = useRef(false);

  // Identify human player in current game
  const currentGameState = gameEngine.getState();
  const humanPlayer = currentGameState.players.find((p) => !p.isAI) || winner;
  const isHumanWinner = humanPlayer.id === winner.id;

  const fallbackRewards = useMemo(
    () => calculateRewards(isHumanWinner ? 1 : 2, humanPlayer.captures, humanPlayer.tokensFinished, humanPlayer.winStreak),
    [isHumanWinner, humanPlayer.captures, humanPlayer.tokensFinished, humanPlayer.winStreak]
  );

  useEffect(() => {
    if (recordedRef.current) return;
    recordedRef.current = true;

    const matchDuration = Math.max(15, Math.round((Date.now() - (currentGameState.matchStartTime || Date.now())) / 1000));

    // Record game completion atomically and idempotently
    const result = playerProfileService.recordGameCompletion({
      matchId: currentGameState.matchId,
      playerWon: isHumanWinner,
      captures: humanPlayer.captures,
      tokensFinished: humanPlayer.tokensFinished,
      matchScore: humanPlayer.score,
      matchDurationSeconds: matchDuration,
      rank: isHumanWinner ? 1 : 2,
    });

    setCompletionResult(result);

    // Save game record in match history with all participants
    if (!result.isDuplicate) {
      const matchPlayers = currentGameState.players.length > 0 ? currentGameState.players : [winner];
      db.saveGameRecord({
        id: currentGameState.matchId || `game_${Date.now()}`,
        winner: winner.name,
        winnerColor: winner.color,
        mode: currentGameState.mode || 'LOCAL',
        playersCount: matchPlayers.length,
        players: matchPlayers.map((p) => ({
          name: p.name,
          color: p.color,
          captures: p.captures,
          tokensFinished: p.tokensFinished,
          isWinner: p.id === winner.id,
          isAI: p.isAI,
        })),
        durationSeconds: matchDuration,
        date: new Date().toISOString(),
      });
    }

    // Launch celebratory confetti bursts
    if (isHumanWinner) {
      const end = Date.now() + 2500;
      const colors = ['#f59e0b', '#ef4444', '#10b981', '#0284c7', '#ec4899'];

      const frame = () => {
        confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors,
        });
        confetti({
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }
  }, [winner, isHumanWinner, humanPlayer, currentGameState]);

  const activeRewards = completionResult ? completionResult.rewards : fallbackRewards;
  const leveledUp = completionResult?.leveledUp;
  const newLevel = completionResult?.newLevel;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in zoom-in-95 duration-300 select-none">
      <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-950 to-black border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 text-center text-slate-100 shadow-2xl shadow-amber-500/20 overflow-hidden">
        {/* Top celebratory rays */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/20 blur-3xl rounded-full pointer-events-none" />

        {/* Victory Ribbon & Trophy */}
        <div className="relative inline-flex flex-col items-center mb-4">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-600 p-1 shadow-2xl shadow-amber-500/50 flex items-center justify-center animate-bounce">
            <div className="w-full h-full rounded-[22px] bg-slate-950 flex items-center justify-center border border-amber-300/40">
              <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-amber-400" />
            </div>
          </div>
          <span className={`mt-3 px-3 py-1 rounded-full border font-black text-xs uppercase tracking-widest ${
            isHumanWinner 
              ? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
              : 'bg-slate-800/80 border-slate-700 text-slate-300'
          }`}>
            {isHumanWinner ? '🎉 VICTORY ROYALE!' : 'MATCH FINISHED'}
          </span>
        </div>

        {/* Winner identity */}
        <div className="flex flex-col items-center gap-2 mb-4">
          <Avatar avatar={winner.avatar} color={winner.color} size="xl" />
          <h2 className="text-2xl sm:text-3xl font-black font-display text-white tracking-tight">
            {winner.name}
          </h2>
          <p className="text-xs sm:text-sm font-semibold text-amber-400/90">
            {isHumanWinner ? 'You are the Ludo Champion!' : `${winner.name} claimed victory!`}
          </p>
        </div>

        {/* Level Up Notification Banner */}
        {leveledUp && (
          <div className="mb-4 p-2.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/30 to-amber-500/20 border border-amber-400/50 flex items-center justify-center gap-2 shadow-lg">
            <Sparkles className="w-5 h-5 text-amber-300 animate-spin" />
            <span className="text-sm font-black text-amber-300">
              LEVEL UP! You reached Level {newLevel}!
            </span>
          </div>
        )}

        {/* Reward summary cards */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="flex items-center justify-center gap-2.5 p-3 rounded-2xl bg-amber-950/40 border border-amber-500/30">
            <Coins className="w-5 h-5 text-amber-400" />
            <div className="text-left">
              <div className="text-[10px] uppercase font-bold text-amber-300">Coins Earned</div>
              <div className="text-base font-black text-white">+{activeRewards.coinsEarned}</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2.5 p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30">
            <Award className="w-5 h-5 text-indigo-400" />
            <div className="text-left">
              <div className="text-[10px] uppercase font-bold text-indigo-300">XP Gained</div>
              <div className="text-base font-black text-white">+{activeRewards.xpEarned}</div>
            </div>
          </div>
        </div>

        {/* Match Statistics */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 mb-6 text-center">
          <div>
            <div className="text-[10px] font-bold text-slate-400 flex items-center justify-center gap-1">
              <Trophy className="w-3 h-3 text-amber-400" /> Placement
            </div>
            <div className="text-sm font-black text-slate-200 mt-0.5">
              {isHumanWinner ? '#1 👑' : '#2 🥈'}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 flex items-center justify-center gap-1">
              <Swords className="w-3 h-3 text-rose-400" /> Captures
            </div>
            <div className="text-sm font-black text-rose-300 mt-0.5">{humanPlayer.captures}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 flex items-center justify-center gap-1">
              <Flame className="w-3 h-3 text-amber-400" /> Streak
            </div>
            <div className="text-sm font-black text-amber-300 mt-0.5">
              {isHumanWinner ? humanPlayer.winStreak + 1 : 0}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          <Button
            size="lg"
            variant="primary"
            onClick={onPlayAgain}
            className="w-full py-3.5 flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>PLAY AGAIN</span>
          </Button>

          <div className="grid grid-cols-2 gap-2.5">
            <Button
              size="md"
              variant="secondary"
              onClick={onLeaderboard}
              className="flex items-center justify-center gap-1.5"
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Leaderboard</span>
            </Button>

            <Button
              size="md"
              variant="secondary"
              onClick={onHome}
              className="flex items-center justify-center gap-1.5"
            >
              <HomeIcon className="w-4 h-4 text-slate-300" />
              <span>Home</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
