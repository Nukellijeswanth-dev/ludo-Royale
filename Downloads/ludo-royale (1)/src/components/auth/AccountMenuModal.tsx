import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authService, AuthUser } from '../../services/authService';
import { playerProfileService } from '../../services/playerProfileService';
import { calculateLevel } from '../../game/scoring';
import { MatchHistoryModal } from './MatchHistoryModal';

interface AccountMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth: () => void;
  onOpenProfile?: () => void;
}

export const AccountMenuModal: React.FC<AccountMenuModalProps> = ({
  isOpen,
  onClose,
  onOpenAuth,
  onOpenProfile,
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const user = authService.getUser();
  const profile = playerProfileService.getProfile();
  const isAuthenticated = authService.isAuthenticated();

  const levelInfo = calculateLevel(profile.xp);

  if (!isOpen) return null;

  const handleLogout = async () => {
    await authService.logout();
    onClose();
  };

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative w-full max-w-sm bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border border-amber-500/30 rounded-2xl shadow-2xl p-6 text-white overflow-hidden"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
            >
              ✕
            </button>

            {/* Profile Info */}
            <div className="flex flex-col items-center text-center mt-2 mb-6">
              <div className="relative">
                <div className="w-18 h-18 text-4xl bg-gradient-to-br from-amber-500/20 to-yellow-500/10 border-2 border-amber-400/80 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                  {profile.avatar || user?.avatar || '👑'}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs px-2 py-0.5 rounded-full border border-slate-900 shadow">
                  Lv.{profile.level}
                </div>
              </div>

              <h3 className="text-lg font-bold text-white mt-4">
                {user?.displayName || profile.username || 'Royale Player'}
              </h3>
              {user?.email && (
                <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
              )}

              {/* Status Badge */}
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {isAuthenticated ? 'Authenticated' : 'Guest Account'}
                </span>
                {user?.provider && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 uppercase font-semibold">
                    {user.provider}
                  </span>
                )}
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 gap-2.5 mb-5">
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 text-center">
                <span className="text-xs text-slate-400 block mb-1">Coins</span>
                <div className="flex items-center justify-center gap-1 text-amber-400 font-bold text-sm">
                  <span>🪙</span>
                  <span>{profile.coins.toLocaleString()}</span>
                </div>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 text-center">
                <span className="text-xs text-slate-400 block mb-1">Skill Rating</span>
                <div className="flex items-center justify-center gap-1 text-yellow-400 font-bold text-sm">
                  <span>⭐</span>
                  <span>{profile.rating || 1200}</span>
                </div>
              </div>
            </div>

            {/* Level Progress */}
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3 mb-5">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-400">Level {levelInfo.level} Progress</span>
                <span className="text-amber-300 font-semibold">{levelInfo.progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-300"
                  style={{ width: `${levelInfo.progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>{levelInfo.xpInLevel} XP</span>
                <span>{levelInfo.xpNeededForLevel} XP Needed</span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2.5">
              <button
                onClick={() => setShowHistory(true)}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-xl text-sm font-semibold flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span>📜</span>
                  <span>Match History</span>
                </div>
                <span className="text-slate-400 text-xs">→</span>
              </button>

              {onOpenProfile && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenProfile();
                  }}
                  className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-xl text-sm font-semibold flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span>⚙️</span>
                    <span>Profile & Customization</span>
                  </div>
                  <span className="text-slate-400 text-xs">→</span>
                </button>
              )}

              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="w-full py-2.5 px-4 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 rounded-xl text-sm font-semibold text-red-300 flex items-center justify-center gap-2 transition-colors mt-4"
                >
                  <span>🚪</span>
                  <span>Log Out</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    onClose();
                    onOpenAuth();
                  }}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 mt-4"
                >
                  <span>🔐</span>
                  <span>Sign In / Create Account</span>
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      <MatchHistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        playerId={profile.id}
      />
    </>
  );
};
