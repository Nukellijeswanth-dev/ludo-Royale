import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PersistentMatchRecord } from '../../server/matchHistoryDatabase';

interface MatchHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerId: string;
}

export const MatchHistoryModal: React.FC<MatchHistoryModalProps> = ({
  isOpen,
  onClose,
  playerId,
}) => {
  const [history, setHistory] = useState<PersistentMatchRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !playerId) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetch(`/api/matches/history/${playerId}?limit=25`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          if (data.success && Array.isArray(data.history)) {
            setHistory(data.history);
          } else {
            setHistory([]);
          }
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError('Failed to load match history.');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, playerId]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-xl max-h-[85vh] bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border border-amber-500/30 rounded-2xl shadow-2xl flex flex-col text-white overflow-hidden"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📜</span>
              <div>
                <h3 className="font-bold text-lg text-amber-300">Match History</h3>
                <p className="text-xs text-slate-400">Past competitive matches & rating changes</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3 scrollbar-thin">
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading match history...</span>
              </div>
            ) : error ? (
              <div className="py-10 text-center text-red-400 text-sm">{error}</div>
            ) : history.length === 0 ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                <span className="text-4xl">🎲</span>
                <p className="text-sm font-semibold text-slate-300">No match records yet</p>
                <p className="text-xs text-slate-500 max-w-xs">
                  Play quick matches or room games to log your rating and battle history!
                </p>
              </div>
            ) : (
              history.map((record) => {
                const myRankInfo = record.finalRankings?.find((r) => r.playerId === playerId);
                const rank = myRankInfo?.rank ?? (record.winnerId === playerId ? 1 : 2);
                const isWon = rank === 1;
                const ratingChange = record.ratingChanges?.[playerId]?.delta ?? 0;
                const xpWon = record.xpEarned?.[playerId] ?? 0;
                const coinsWon = record.coinsEarned?.[playerId] ?? 0;
                const dateStr = new Date(record.timestamp).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={record.matchId}
                    className={`p-4 rounded-xl border transition-all ${
                      isWon
                        ? 'bg-amber-950/20 border-amber-500/40'
                        : 'bg-slate-800/40 border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{isWon ? '👑' : rank === 2 ? '🥈' : '🥉'}</span>
                        <span className="font-bold text-sm">
                          {isWon ? (
                            <span className="text-amber-300">VICTORY (1st Place)</span>
                          ) : (
                            <span className="text-slate-300">Rank #{rank}</span>
                          )}
                        </span>
                        {record.roomCode && (
                          <span className="text-[10px] px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-400">
                            Room {record.roomCode}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">{dateStr}</span>
                    </div>

                    {/* Participants */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-slate-400">Players:</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {record.players?.map((p) => (
                          <div
                            key={p.id}
                            className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg border ${
                              p.id === playerId
                                ? 'bg-amber-500/20 border-amber-400/40 text-amber-200'
                                : 'bg-slate-800/60 border-slate-700 text-slate-300'
                            }`}
                          >
                            <span>{p.avatar}</span>
                            <span className="font-medium max-w-[90px] truncate">{p.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Rewards & Rating deltas */}
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
                      <div className="flex items-center gap-3">
                        <span className="text-amber-400 font-semibold flex items-center gap-1">
                          🪙 +{coinsWon}
                        </span>
                        <span className="text-blue-400 font-semibold flex items-center gap-1">
                          ⚡ +{xpWon} XP
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">Rating:</span>
                        <span
                          className={`font-bold ${
                            ratingChange >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {ratingChange >= 0 ? `+${ratingChange}` : ratingChange}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
