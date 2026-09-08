import React, { useState, useEffect } from 'react';
import { LeaderboardEntry } from '../types/playerTypes';
import { playerProfileService } from '../services/playerProfileService';
import { Avatar } from '../components/common/Avatar';
import { ArrowLeft, Trophy, Flame, Swords, Coins, Sparkles, RefreshCw, Award } from 'lucide-react';

type LeaderboardCategory = 'rating' | 'wins' | 'xp' | 'coins' | 'captures';

interface LeaderboardProps {
  onBack: () => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ onBack }) => {
  const [category, setCategory] = useState<LeaderboardCategory>('rating');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number>(1);
  const [totalPlayers, setTotalPlayers] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const currentProfile = playerProfileService.getProfile();

  const loadLeaderboardData = async (cat: LeaderboardCategory) => {
    setIsLoading(true);
    try {
      const data = await playerProfileService.fetchLeaderboard(cat, 50);
      setEntries(data.entries || []);
      const userRank = typeof data.myRank === 'object' ? data.myRank?.rank : data.myRank;
      setMyRank(userRank || 1);
      setTotalPlayers(data.totalPlayers || data.entries?.length || 0);
    } catch (err) {
      console.warn('Failed to load leaderboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboardData(category);
  }, [category]);

  const categories: { id: LeaderboardCategory; label: string; icon: any }[] = [
    { id: 'rating', label: 'Top Rating', icon: Award },
    { id: 'wins', label: 'Most Wins', icon: Trophy },
    { id: 'xp', label: 'Highest XP', icon: Sparkles },
    { id: 'coins', label: 'Most Coins', icon: Coins },
    { id: 'captures', label: 'Captures', icon: Swords },
  ];

  const getMetricDisplay = (entry: LeaderboardEntry, cat: LeaderboardCategory) => {
    switch (cat) {
      case 'rating':
        return `${entry.rating ?? 1200} Rating (Lv ${entry.level})`;
      case 'wins':
        return `${entry.wins.toLocaleString()} Wins (${entry.winRate || 0}%)`;
      case 'xp':
        return `${entry.xp.toLocaleString()} XP (Lv ${entry.level})`;
      case 'coins':
        return `${(entry.coins ?? 0).toLocaleString()} Coins`;
      case 'captures':
        return `${entry.captures.toLocaleString()} Captures`;
      default:
        return `${entry.wins} Wins`;
    }
  };

  const getPrimaryMetricNumber = (entry: LeaderboardEntry, cat: LeaderboardCategory) => {
    switch (cat) {
      case 'rating':
        return `⭐ ${entry.rating ?? 1200}`;
      case 'wins':
        return `${entry.wins}W`;
      case 'xp':
        return `${entry.xp.toLocaleString()} XP`;
      case 'coins':
        return `🪙 ${(entry.coins ?? 0).toLocaleString()}`;
      case 'captures':
        return `⚔️ ${entry.captures}`;
      default:
        return `${entry.wins}`;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-4 sm:p-6 select-none overflow-y-auto">
      {/* Top Header */}
      <header className="w-full max-w-3xl flex items-center justify-between py-2 mb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer text-xs sm:text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          <h1 className="text-xl sm:text-2xl font-bold font-display text-amber-300">
            Hall of Legends
          </h1>
        </div>

        <button
          type="button"
          onClick={() => loadLeaderboardData(category)}
          disabled={isLoading}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-50"
          title="Refresh rankings"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
        </button>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-3xl bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl backdrop-blur-md flex flex-col gap-5">
        {/* Category Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-slate-950 rounded-2xl border border-slate-800">
          {categories.map((c) => {
            const Icon = c.icon;
            const isActive = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`py-2.5 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-md scale-[1.02]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-amber-400'}`} />
                <span className="truncate">{c.label}</span>
              </button>
            );
          })}
        </div>

        {/* Current Player Standings Bar */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/40 border border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 font-black text-xs">
              #{myRank}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs sm:text-sm text-slate-100">
                  {currentProfile.username} (You)
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                  LVL {currentProfile.level}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                {getMetricDisplay(currentProfile as any, category)}
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-black text-amber-400">
              {getPrimaryMetricNumber(currentProfile as any, category)}
            </span>
          </div>
        </div>

        {/* Top 3 Podium Cards */}
        {entries.length >= 3 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-2 pb-2 items-end">
            {/* #2 Silver */}
            {entries[1] && (
              <div className="flex flex-col items-center bg-slate-950/80 border border-slate-800 rounded-2xl p-3 sm:p-4 text-center order-1">
                <span className="text-2xl sm:text-3xl mb-1">🥈</span>
                <Avatar avatar={entries[1].avatar} size="md" />
                <h4 className="font-bold text-xs sm:text-sm text-slate-200 mt-2 truncate w-full">
                  {entries[1].displayName || entries[1].name}
                </h4>
                <span className="text-[11px] text-slate-400 font-semibold">
                  Lv {entries[1].level}
                </span>
                <span className="text-xs text-amber-400 font-extrabold mt-1">
                  {getPrimaryMetricNumber(entries[1], category)}
                </span>
              </div>
            )}

            {/* #1 Gold Champion */}
            {entries[0] && (
              <div className="flex flex-col items-center bg-gradient-to-b from-amber-950/50 to-slate-950 border-2 border-amber-500/60 rounded-2xl p-4 sm:p-5 text-center order-2 scale-105 shadow-xl shadow-amber-500/10">
                <span className="text-3xl sm:text-4xl mb-1 animate-bounce">👑</span>
                <Avatar avatar={entries[0].avatar} size="lg" className="ring-2 ring-amber-400" />
                <h4 className="font-black text-sm sm:text-base text-amber-300 mt-2 truncate w-full">
                  {entries[0].displayName || entries[0].name}
                </h4>
                <span className="text-[11px] text-amber-400/90 font-bold">
                  Lv {entries[0].level}
                </span>
                <span className="text-xs sm:text-sm text-amber-300 font-black mt-1">
                  {getPrimaryMetricNumber(entries[0], category)}
                </span>
              </div>
            )}

            {/* #3 Bronze */}
            {entries[2] && (
              <div className="flex flex-col items-center bg-slate-950/80 border border-slate-800 rounded-2xl p-3 sm:p-4 text-center order-3">
                <span className="text-2xl sm:text-3xl mb-1">🥉</span>
                <Avatar avatar={entries[2].avatar} size="md" />
                <h4 className="font-bold text-xs sm:text-sm text-slate-200 mt-2 truncate w-full">
                  {entries[2].displayName || entries[2].name}
                </h4>
                <span className="text-[11px] text-slate-400 font-semibold">
                  Lv {entries[2].level}
                </span>
                <span className="text-xs text-amber-400 font-extrabold mt-1">
                  {getPrimaryMetricNumber(entries[2], category)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* List of Entries */}
        <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
          {entries.map((item, idx) => {
            const isMe = item.id === currentProfile.id || item.playerId === currentProfile.id;
            return (
              <div
                key={item.id || idx}
                className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                  isMe
                    ? 'bg-amber-950/40 border-amber-500/60 ring-1 ring-amber-400/40'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="w-8 text-center font-black text-sm sm:text-base text-slate-400">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                </div>

                <Avatar avatar={item.avatar} size="sm" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs sm:text-sm text-slate-100 truncate">
                      {item.displayName || item.name} {isMe && '(You)'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 font-semibold">
                      LVL {item.level}
                    </span>
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
                    {getMetricDisplay(item, category)}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs sm:text-sm font-black text-amber-300">
                    {getPrimaryMetricNumber(item, category)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Rating {item.rating}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="text-xs text-slate-500 py-3 text-center">
        Real-time persistent online leaderboard • Verified by Server
      </footer>
    </div>
  );
};

