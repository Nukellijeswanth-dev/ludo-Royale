import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types/playerTypes';
import { Avatar } from '../components/common/Avatar';
import { Button } from '../components/common/Button';
import {
  Users,
  Bot,
  Globe,
  Trophy,
  User,
  Settings as SettingsIcon,
  Crown,
  Coins,
  Flame,
  Award,
  Sparkles,
  UserPlus,
  Palette,
} from 'lucide-react';
import { calculateLevel } from '../game/scoring';
import { roomService } from '../services/roomService';
import { friendService } from '../services/friendService';
import { authService } from '../services/authService';
import { AuthModal } from '../components/auth/AuthModal';
import { AccountMenuModal } from '../components/auth/AccountMenuModal';

interface HomeScreenProps {
  profile: UserProfile;
  onNavigate: (
    screen:
      | 'PLAYER_SETUP_LOCAL'
      | 'PLAYER_SETUP_AI'
      | 'ONLINE_MULTIPLAYER'
      | 'LEADERBOARD'
      | 'PROFILE'
      | 'ACHIEVEMENTS'
      | 'SETTINGS'
      | 'FRIENDS'
      | 'CUSTOMIZATION'
  ) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ profile, onNavigate }) => {
  const levelInfo = calculateLevel(profile.xp);
  const [friendReqCount, setFriendReqCount] = useState(0);
  const [onlineFriendsCount, setOnlineFriendsCount] = useState(0);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authState, setAuthState] = useState(authService.getState());

  useEffect(() => {
    const unsubFriends = friendService.subscribe((s) => {
      setFriendReqCount(s.incomingRequests.length);
      setOnlineFriendsCount(s.friends.filter((f) => f.isOnline).length);
    });
    const unsubAuth = authService.subscribe(setAuthState);
    friendService.refresh();
    return () => {
      unsubFriends();
      unsubAuth();
    };
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-between p-4 sm:p-6 select-none overflow-hidden bg-[#050510] text-white">
      {/* Sleek Radial Background Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.15),transparent_60%)]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[radial-gradient(circle_at_50%_100%,rgba(239,68,68,0.1),transparent_60%)]" />
        {/* Subtle floating dice & star */}
        <div className="absolute top-16 left-12 text-3xl opacity-20 animate-bounce duration-1000">
          🎲
        </div>
        <div className="absolute bottom-24 right-16 text-3xl opacity-20 animate-pulse">
          ♔
        </div>
      </div>

      {/* Top Header with Player Stats Bar */}
      <header className="relative w-full max-w-4xl flex items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-white/5 border border-white/10 shadow-2xl backdrop-blur-md z-10">
        {/* User profile summary - opens Account Menu */}
        <div
          onClick={() => setShowAccountMenu(true)}
          className="flex items-center gap-3 cursor-pointer group"
          title="Open Account Menu"
        >
          <Avatar
            avatar={profile.avatar}
            size="md"
            className="group-hover:scale-105 transition-transform"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm sm:text-base text-white group-hover:text-amber-300 transition-colors">
                {profile.username || profile.name}
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30">
                LVL {levelInfo.level}
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              {profile.rank} • Rating {profile.rating}
            </div>
          </div>
        </div>

        {/* Currency & Streak widgets */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Win Streak */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 border border-white/10" title="Win Streak">
            <Flame className="w-4 h-4 text-rose-400 fill-rose-400/30" />
            <span className="text-xs sm:text-sm font-bold text-rose-300">
              {profile.currentWinStreak ?? profile.winStreak ?? 0}
            </span>
          </div>

          {/* Virtual Coins */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 border border-white/10">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="text-xs sm:text-sm font-bold text-amber-300">
              {profile.coins.toLocaleString()}
            </span>
          </div>

          {/* Quick Sign-In button for guests */}
          {!authState.isAuthenticated && (
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold transition-all cursor-pointer shadow-sm"
              title="Sign in to save your game data"
            >
              <span>👑</span>
              <span>Sign In</span>
            </button>
          )}

          {/* Friends Hub Icon */}
          <button
            type="button"
            onClick={() => onNavigate('FRIENDS')}
            aria-label="Friends"
            title="Friends & Social"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer relative"
          >
            <Users className="w-4 h-4 text-indigo-300" />
            {friendReqCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-slate-950 font-black text-[9px] flex items-center justify-center animate-pulse">
                {friendReqCount}
              </span>
            )}
          </button>

          {/* Quick Settings Icon */}
          <button
            type="button"
            onClick={() => onNavigate('SETTINGS')}
            aria-label="Settings"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Hero & Action Hub */}
      <main className="relative flex flex-col items-center justify-center my-auto py-6 w-full max-w-md z-10 text-center">
        {/* Emblem Crown Badge */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-amber-400 via-rose-500 to-indigo-500 p-0.5 shadow-2xl shadow-amber-500/30 mb-4 flex items-center justify-center animate-pulse">
          <div className="w-full h-full rounded-[22px] bg-[#050510] flex items-center justify-center border border-white/20">
            <Crown className="w-10 h-10 sm:w-12 sm:h-12 text-amber-400 drop-shadow" />
          </div>
        </div>

        <h1 className="text-4xl sm:text-5xl font-black tracking-tight font-display bg-gradient-to-r from-amber-300 via-rose-300 to-indigo-300 bg-clip-text text-transparent">
          LUDO ROYALE
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 font-medium tracking-wide mt-1 mb-8">
          Classic Strategic Board Gaming Reimagined
        </p>

        {/* Primary Play Action Buttons */}
        <div className="w-full flex flex-col gap-3.5">
          <button
            type="button"
            onClick={() => onNavigate('PLAYER_SETUP_LOCAL')}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-600 text-black font-black text-base sm:text-lg flex items-center justify-center gap-3 shadow-[0_10px_25px_rgba(217,119,6,0.35)] hover:brightness-110 active:translate-y-0.5 transition-all uppercase tracking-wider border-t-2 border-white/40 cursor-pointer"
          >
            <Users className="w-5 h-5" />
            <span>PLAY LOCAL</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('PLAYER_SETUP_AI')}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-b from-blue-500 to-indigo-600 text-white font-black text-base sm:text-lg flex items-center justify-center gap-3 shadow-[0_10px_25px_rgba(59,130,246,0.35)] hover:brightness-110 active:translate-y-0.5 transition-all uppercase tracking-wider border-t-2 border-white/30 cursor-pointer"
          >
            <Bot className="w-5 h-5" />
            <span>PLAY WITH AI</span>
          </button>

          <button
            id="home-quick-match-button"
            type="button"
            onClick={() => {
              onNavigate('ONLINE_MULTIPLAYER');
              setTimeout(() => {
                roomService.enterMatchmaking();
              }, 50);
            }}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-500 text-white font-black text-base sm:text-lg flex items-center justify-center gap-3 shadow-[0_10px_25px_rgba(56,189,248,0.35)] hover:brightness-110 active:translate-y-0.5 transition-all uppercase tracking-wider border-t-2 border-white/40 cursor-pointer"
          >
            <span className="text-xl">🎮</span>
            <span>QUICK MATCH</span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-mono ml-auto">
              ONLINE
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('ONLINE_MULTIPLAYER')}
            className="w-full py-3.5 px-6 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-3 border border-white/10 shadow-xl transition-all cursor-pointer"
          >
            <Globe className="w-5 h-5 text-sky-400" />
            <span>ONLINE ROOMS (CUSTOM)</span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-mono">
              LIVE
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('FRIENDS')}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-purple-950/50 to-indigo-950/60 hover:bg-indigo-900/40 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-3 border border-indigo-500/30 shadow-xl transition-all cursor-pointer relative"
          >
            <Users className="w-5 h-5 text-indigo-400" />
            <span>FRIENDS & SOCIAL</span>
            {onlineFriendsCount > 0 && (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-mono ml-auto">
                {onlineFriendsCount} ONLINE
              </span>
            )}
            {friendReqCount > 0 && (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono ml-auto animate-pulse">
                {friendReqCount} NEW
              </span>
            )}
          </button>
        </div>

        {/* Secondary Hub Navigation (Leaderboard, Friends, Profile, Badges, Settings) */}
        <div className="grid grid-cols-5 gap-2 w-full mt-6">
          <button
            type="button"
            onClick={() => onNavigate('LEADERBOARD')}
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-amber-300 transition-all cursor-pointer shadow-lg backdrop-blur-sm"
          >
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            <span className="text-[10px] sm:text-[11px] font-bold">Ranks</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('FRIENDS')}
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-indigo-300 transition-all cursor-pointer shadow-lg backdrop-blur-sm relative"
          >
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
            <span className="text-[10px] sm:text-[11px] font-bold">Friends</span>
            {friendReqCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-slate-950 font-black text-[9px] flex items-center justify-center animate-pulse">
                {friendReqCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('PROFILE')}
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-indigo-300 transition-all cursor-pointer shadow-lg backdrop-blur-sm"
          >
            <User className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
            <span className="text-[10px] sm:text-[11px] font-bold">Profile</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('ACHIEVEMENTS')}
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-emerald-300 transition-all cursor-pointer shadow-lg backdrop-blur-sm"
          >
            <Award className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            <span className="text-[10px] sm:text-[11px] font-bold">Badges</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('SETTINGS')}
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-rose-300 transition-all cursor-pointer shadow-lg backdrop-blur-sm"
          >
            <SettingsIcon className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" />
            <span className="text-[10px] sm:text-[11px] font-bold">Settings</span>
          </button>
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="relative text-xs text-slate-500 font-medium z-10 py-2">
        LUDO ROYALE • Commercial Quality Strategy Engine
      </footer>

      {/* Account Menu Modal */}
      <AccountMenuModal
        isOpen={showAccountMenu}
        onClose={() => setShowAccountMenu(false)}
        onOpenAuth={() => setShowAuthModal(true)}
        onOpenProfile={() => onNavigate('PROFILE')}
      />

      {/* Auth Modal (Login / Register) */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
};
