import React, { useState, useEffect } from 'react';
import { UserProfile, Achievement } from '../types/playerTypes';
import { db } from '../database/database';
import { playerProfileService, DEFAULT_AVATARS, validateUsername } from '../services/playerProfileService';
import { Avatar } from '../components/common/Avatar';
import { ProgressBar } from '../components/common/ProgressBar';
import {
  ArrowLeft,
  Trophy,
  Swords,
  Flame,
  Coins,
  Award,
  Calendar,
  ShieldCheck,
  Edit2,
  Check,
  X,
  Copy,
  Clock,
  Lock,
  CheckCircle2,
  Sparkles,
  Target,
  UserCheck,
  LogOut,
  History,
} from 'lucide-react';
import { authService } from '../services/authService';
import { AuthModal } from '../components/auth/AuthModal';
import { MatchHistoryModal } from '../components/auth/MatchHistoryModal';

interface ProfileProps {
  profile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
  onBack: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ profile, onUpdateProfile, onBack }) => {
  const [currentProfile, setCurrentProfile] = useState<UserProfile>(profile);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState(profile.username || profile.name);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showMatchHistoryModal, setShowMatchHistoryModal] = useState(false);
  const [authState, setAuthState] = useState(authService.getState());

  // Subscribe to persistent profile changes and auth state
  useEffect(() => {
    setCurrentProfile(playerProfileService.getProfile());
    const unsubProfile = playerProfileService.subscribe((updated) => {
      setCurrentProfile(updated);
      onUpdateProfile(updated);
    });
    const unsubAuth = authService.subscribe((state) => {
      setAuthState(state);
      setCurrentProfile(playerProfileService.getProfile());
    });
    return () => {
      unsubProfile();
      unsubAuth();
    };
  }, [onUpdateProfile]);

  const levelInfo = playerProfileService.getLevelInfo();
  const totalGames = currentProfile.totalGames ?? currentProfile.gamesPlayed ?? 0;
  const wins = currentProfile.wins ?? currentProfile.gamesWon ?? 0;
  const losses = currentProfile.losses ?? currentProfile.gamesLost ?? 0;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const currentStreak = currentProfile.currentWinStreak ?? currentProfile.winStreak ?? 0;
  const bestStreak = currentProfile.bestWinStreak ?? currentProfile.bestStreak ?? 0;
  const highestScore = currentProfile.highestScore ?? 0;
  const captures = currentProfile.captures ?? 0;
  const achievements: Achievement[] = playerProfileService.getAchievements();
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  // Format total play time into human readable hours & minutes
  const formatPlayTime = (seconds: number): string => {
    if (!seconds || seconds < 60) return `${Math.max(1, Math.round(seconds || 0))}s`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
  };

  const handleCopyId = () => {
    if (navigator.clipboard && currentProfile.id) {
      navigator.clipboard.writeText(currentProfile.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleUsernameChange = (value: string) => {
    setUsernameInput(value);
    const validation = validateUsername(value);
    if (!validation.isValid) {
      setUsernameError(validation.error || 'Invalid username');
    } else {
      setUsernameError(null);
    }
  };

  const handleSaveUsername = () => {
    const result = playerProfileService.updateUsername(usernameInput);
    if (result.success && result.profile) {
      setCurrentProfile(result.profile);
      onUpdateProfile(result.profile);
      setIsEditingUsername(false);
      setUsernameError(null);
    } else {
      setUsernameError(result.error || 'Failed to update username');
    }
  };

  const handleSelectAvatar = (av: string) => {
    const updated = playerProfileService.updateAvatar(av);
    setCurrentProfile(updated);
    onUpdateProfile(updated);
    setShowAvatarPicker(false);
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
            Player Profile
          </h1>
        </div>

        {/* Real Coin Balance */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-300 shadow-sm">
          <Coins className="w-4 h-4 text-amber-400" />
          <span className="text-xs sm:text-sm font-black tracking-wide">
            {currentProfile.coins.toLocaleString()}
          </span>
        </div>
      </header>

      {/* Main Profile Dossier */}
      <main className="w-full max-w-3xl bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-md flex flex-col gap-6">
        {/* Profile Card Hero Banner */}
        <div className="flex flex-col sm:flex-row items-center gap-5 p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 relative">
          {/* Avatar with click-to-change button */}
          <div
            onClick={() => setShowAvatarPicker(true)}
            className="cursor-pointer group relative flex-shrink-0"
            title="Choose Avatar"
          >
            <Avatar
              avatar={currentProfile.avatar}
              size="xl"
              className="ring-4 ring-amber-400/80 group-hover:scale-105 transition-transform shadow-xl"
            />
            <span className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-slate-900 border border-amber-400/80 text-amber-300 shadow-lg group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
              <Edit2 className="w-3.5 h-3.5" />
            </span>
          </div>

          <div className="flex-1 text-center sm:text-left min-w-0 w-full">
            {/* Username display and in-place editor */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-center sm:justify-start gap-2">
              {isEditingUsername ? (
                <div className="flex flex-col gap-1 w-full max-w-sm">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={usernameInput}
                      maxLength={16}
                      onChange={(e) => handleUsernameChange(e.target.value)}
                      placeholder="Enter username"
                      className={`w-full bg-slate-950 border ${
                        usernameError ? 'border-rose-500' : 'border-amber-400'
                      } px-3 py-1.5 rounded-xl text-base font-bold text-white focus:outline-none`}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveUsername}
                      disabled={!!usernameError || !usernameInput.trim()}
                      className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold transition-all shadow"
                      title="Save Username"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingUsername(false);
                        setUsernameInput(currentProfile.username || currentProfile.name);
                        setUsernameError(null);
                      }}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-all"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[11px] px-1">
                    <span className={usernameError ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
                      {usernameError || '3-16 characters, letters, numbers, spaces'}
                    </span>
                    <span className="text-slate-500">{usernameInput.length}/16</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <h2 className="text-2xl sm:text-3xl font-black font-display text-white tracking-tight">
                    {currentProfile.username || currentProfile.name}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setUsernameInput(currentProfile.username || currentProfile.name);
                      setIsEditingUsername(true);
                      setUsernameError(null);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800/80 transition-colors"
                    title="Edit Username"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-black text-xs uppercase tracking-wider">
                    {currentProfile.rank}
                  </span>
                </div>
              )}
            </div>

            {/* User ID and Member Details */}
            <div className="text-xs text-slate-400 mt-1.5 flex flex-wrap items-center justify-center sm:justify-start gap-3">
              <button
                type="button"
                onClick={handleCopyId}
                className="flex items-center gap-1 hover:text-amber-300 transition-colors group cursor-pointer"
                title="Click to copy Player ID"
              >
                <span className="font-mono text-[11px] text-slate-400 group-hover:text-amber-300">
                  ID: {currentProfile.id}
                </span>
                {copiedId ? (
                  <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5">
                    <Check className="w-3 h-3" /> Copied!
                  </span>
                ) : (
                  <Copy className="w-3 h-3 text-slate-500 group-hover:text-amber-300" />
                )}
              </button>

              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                Play time: <strong className="text-slate-300">{formatPlayTime(currentProfile.totalPlayTime)}</strong>
              </span>

              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                Joined: {new Date(currentProfile.createdAt).toLocaleDateString()}
              </span>
            </div>

            {/* Level & XP Progression Bar */}
            <div className="mt-4 max-w-lg bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3 shadow-inner">
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span className="flex items-center gap-1.5 text-amber-300">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span className="uppercase tracking-wider">Level {levelInfo.level}</span>
                </span>
                <span className="text-slate-300 font-mono">
                  {levelInfo.currentLevelXp.toLocaleString()} / {levelInfo.xpRequiredForNext.toLocaleString()} XP
                </span>
              </div>

              {/* Progress Track */}
              <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800 shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 rounded-full transition-all duration-700 shadow-sm"
                  style={{ width: `${levelInfo.progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 font-medium">
                <span>{levelInfo.progressPercent}% of current level completed</span>
                <span>Total XP: {currentProfile.xp.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Key Statistics Grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-amber-400" />
              Combat Statistics
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">
              Rating: {currentProfile.rating}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* 1. Games */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 text-center flex flex-col items-center justify-center">
              <div className="text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-1 uppercase tracking-wider">
                <Trophy className="w-3.5 h-3.5 text-amber-400" /> Total Games
              </div>
              <div className="text-xl font-black text-slate-100 mt-1 font-display">
                {totalGames}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                {wins}W • {losses}L
              </div>
            </div>

            {/* 2. Wins */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 text-center flex flex-col items-center justify-center">
              <div className="text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-1 uppercase tracking-wider">
                <Award className="w-3.5 h-3.5 text-amber-300" /> Wins
              </div>
              <div className="text-xl font-black text-amber-300 mt-1 font-display">
                {wins}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                Victories Earned
              </div>
            </div>

            {/* 3. Win Rate */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 text-center flex flex-col items-center justify-center">
              <div className="text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-1 uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Win Rate
              </div>
              <div className="text-xl font-black text-emerald-400 mt-1 font-display">
                {winRate}%
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                Win Percentage
              </div>
            </div>

            {/* 4. Captures */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 text-center flex flex-col items-center justify-center">
              <div className="text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-1 uppercase tracking-wider">
                <Swords className="w-3.5 h-3.5 text-rose-400" /> Captures
              </div>
              <div className="text-xl font-black text-rose-300 mt-1 font-display">
                {captures}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                Tokens Knocked Out
              </div>
            </div>

            {/* 5. Best Score */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 text-center flex flex-col items-center justify-center">
              <div className="text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-1 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Best Score
              </div>
              <div className="text-xl font-black text-indigo-300 mt-1 font-display">
                {highestScore.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                Match Record
              </div>
            </div>

            {/* 6. Win Streak */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 text-center flex flex-col items-center justify-center">
              <div className="text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-1 uppercase tracking-wider">
                <Flame className="w-3.5 h-3.5 text-amber-500" /> Win Streak
              </div>
              <div className="text-xl font-black text-amber-400 mt-1 font-display">
                {currentStreak}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                All-time Best: {bestStreak}
              </div>
            </div>
          </div>
        </div>

        {/* Account & Security Section */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-200">
                  {authState.isAuthenticated
                    ? authState.user?.displayName || currentProfile.username
                    : 'Guest Player'}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    authState.isAuthenticated
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  {authState.isAuthenticated
                    ? `Linked (${authState.user?.provider || 'verified'})`
                    : 'Guest Account'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {authState.isAuthenticated && authState.user?.email
                  ? authState.user.email
                  : 'Sign in to save your rating, achievements, and unlocked items'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setShowMatchHistoryModal(true)}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-amber-400" />
              <span>Match History</span>
            </button>

            {authState.isAuthenticated ? (
              <button
                type="button"
                onClick={() => authService.logout()}
                className="px-3.5 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Sign In / Link</span>
              </button>
            )}
          </div>
        </div>

        {/* Achievements Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              Achievements ({unlockedCount} / {achievements.length})
            </h3>
            <span className="text-[11px] font-bold text-amber-400">
              {Math.round((unlockedCount / (achievements.length || 1)) * 100)}% Complete
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
            {achievements.map((ach) => {
              const isUnlocked = ach.unlocked;
              const progress = ach.progress || 0;
              const percent = Math.min(100, Math.round((progress / ach.target) * 100));

              return (
                <div
                  key={ach.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                    isUnlocked
                      ? 'bg-gradient-to-r from-amber-950/30 via-slate-950 to-slate-950 border-amber-500/40 shadow-md'
                      : 'bg-slate-950/70 border-slate-800/80 opacity-80'
                  }`}
                >
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl border flex-shrink-0 ${
                      isUnlocked
                        ? 'bg-amber-500/20 border-amber-400/60 shadow-lg ring-1 ring-amber-400/30'
                        : 'bg-slate-900 border-slate-800 text-slate-500 grayscale'
                    }`}
                  >
                    {ach.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4
                        className={`text-xs sm:text-sm font-bold truncate ${
                          isUnlocked ? 'text-amber-300' : 'text-slate-200'
                        }`}
                      >
                        {ach.title}
                      </h4>
                      {isUnlocked ? (
                        <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-300 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/40">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Done
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 text-[9px] font-bold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                          <Lock className="w-2.5 h-2.5" /> {percent}%
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug line-clamp-2">
                      {ach.description}
                    </p>

                    {/* Reward badges */}
                    <div className="flex items-center gap-2 mt-2 text-[10px] font-bold">
                      <span className="text-amber-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 flex items-center gap-1">
                        <Coins className="w-2.5 h-2.5 text-amber-400" />
                        +{ach.rewardCoins}
                      </span>
                      <span className="text-indigo-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                        +{ach.rewardXp} XP
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Default Avatar Selection Modal */}
      {showAvatarPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-amber-300 font-display flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                Select Avatar
              </h3>
              <button
                type="button"
                onClick={() => setShowAvatarPicker(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {DEFAULT_AVATARS.map((av) => {
                const isSelected = currentProfile.avatar === av;
                return (
                  <button
                    key={av}
                    type="button"
                    onClick={() => handleSelectAvatar(av)}
                    className={`w-14 h-14 rounded-2xl border text-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer relative shadow ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400 shadow-amber-500/30'
                        : 'bg-slate-950 border-slate-800 hover:border-amber-400/60'
                    }`}
                  >
                    {av}
                    {isSelected && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowAvatarPicker(false)}
              className="w-full mt-5 py-2.5 text-xs font-bold text-slate-400 hover:text-white bg-slate-950 rounded-xl border border-slate-800 uppercase tracking-wider transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setCurrentProfile(playerProfileService.getProfile());
          onUpdateProfile(playerProfileService.getProfile());
        }}
      />

      <MatchHistoryModal
        isOpen={showMatchHistoryModal}
        onClose={() => setShowMatchHistoryModal(false)}
        playerId={currentProfile.id}
      />

      <footer className="text-xs text-slate-500 py-3">
        Royal Career Record • Encrypted Local Vault
      </footer>
    </div>
  );
};
