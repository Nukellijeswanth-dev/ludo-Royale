import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types/playerTypes';
import { CustomizationItem, UserGameSettings } from '../types/customizationTypes';
import { playerProfileService, DEFAULT_AVATARS } from '../services/playerProfileService';
import { audio } from '../audio/audioManager';
import { Avatar } from '../components/common/Avatar';
import { getTokenSkinStyle, getBoardThemeStyle } from '../game/customizationStyles';
import { PlayerColor } from '../types/gameTypes';
import {
  ArrowLeft,
  Coins,
  Sparkles,
  Check,
  Lock,
  ShoppingBag,
  Palette,
  Sliders,
  Volume2,
  VolumeX,
  Music,
  Vibrate,
  Zap,
  Bell,
  CheckCircle2,
  AlertCircle,
  Eye,
  Crown,
} from 'lucide-react';

interface CustomizationScreenProps {
  onBack: () => void;
  initialTab?: 'AVATARS' | 'TOKENS' | 'THEMES' | 'SETTINGS';
}

export const CustomizationScreen: React.FC<CustomizationScreenProps> = ({
  onBack,
  initialTab = 'AVATARS',
}) => {
  const [activeTab, setActiveTab] = useState<'AVATARS' | 'TOKENS' | 'THEMES' | 'SETTINGS'>(initialTab);
  const [profile, setProfile] = useState<UserProfile>(() => playerProfileService.getProfile());
  const [settings, setSettings] = useState<UserGameSettings>(() => playerProfileService.getGameSettings());

  // Store Catalog
  const [tokenSkins, setTokenSkins] = useState<CustomizationItem[]>(() => playerProfileService.getTokenSkins());
  const [boardThemes, setBoardThemes] = useState<CustomizationItem[]>(() => playerProfileService.getBoardThemes());

  // Modal / Confirm state
  const [pendingItem, setPendingItem] = useState<CustomizationItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Keep state synced with service
  useEffect(() => {
    const unsub = playerProfileService.subscribe((updated) => {
      setProfile(updated);
      setSettings(playerProfileService.getGameSettings());
      setTokenSkins(playerProfileService.getTokenSkins());
      setBoardThemes(playerProfileService.getBoardThemes());
    });
    return () => unsub();
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Avatar Selection
  const handleSelectAvatar = async (avatar: string) => {
    const result = await playerProfileService.selectItem(avatar, 'AVATAR');
    if (result.success) {
      showToast(`Equipped avatar ${avatar}`);
    } else {
      showToast(result.error || 'Failed to select avatar', 'error');
    }
  };

  // Token Skin Selection & Purchase
  const handleEquipTokenSkin = async (item: CustomizationItem) => {
    const result = await playerProfileService.selectItem(item.id, 'TOKEN_SKIN');
    if (result.success) {
      showToast(`Equipped ${item.name} token skin!`);
    } else {
      showToast(result.error || 'Failed to equip token skin', 'error');
    }
  };

  const handleConfirmPurchase = async () => {
    if (!pendingItem) return;
    setIsProcessing(true);
    const result = await playerProfileService.purchaseItem(pendingItem.id, pendingItem.type);
    setIsProcessing(false);
    if (result.success) {
      showToast(`Successfully unlocked ${pendingItem.name}!`);
      setPendingItem(null);
    } else {
      showToast(result.error || 'Failed to complete purchase', 'error');
    }
  };

  // Board Theme Selection
  const handleEquipBoardTheme = async (item: CustomizationItem) => {
    const result = await playerProfileService.selectItem(item.id, 'BOARD_THEME');
    if (result.success) {
      showToast(`Applied ${item.name} board theme!`);
    } else {
      showToast(result.error || 'Failed to apply board theme', 'error');
    }
  };

  // Settings Updates
  const handleToggleSetting = async (key: keyof UserGameSettings) => {
    const updatedVal = !settings[key];
    const newSettings = { ...settings, [key]: updatedVal };
    setSettings(newSettings);

    if (key === 'soundEnabled') {
      audio.setSoundEnabled(updatedVal);
    } else if (key === 'musicEnabled') {
      audio.setMusicEnabled(updatedVal);
    }

    await playerProfileService.updateSettings(newSettings);
    showToast('Settings saved');
  };

  // Preview colors for token preview
  const previewColors: PlayerColor[] = ['RED', 'GREEN', 'YELLOW', 'BLUE'];

  return (
    <div className="min-h-screen bg-[#050510] text-slate-100 flex flex-col items-center justify-between p-4 sm:p-6 select-none overflow-y-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          id="customization-toast"
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border shadow-2xl backdrop-blur-md transition-all duration-300 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200'
              : 'bg-rose-950/90 border-rose-400 text-rose-200'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          )}
          <span className="text-xs sm:text-sm font-bold">{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="w-full max-w-4xl flex items-center justify-between py-2 mb-4">
        <button
          type="button"
          id="btn-back-customization"
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xs sm:text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h1 className="text-xl sm:text-2xl font-black font-display bg-gradient-to-r from-amber-300 via-rose-300 to-indigo-300 bg-clip-text text-transparent">
            Ludo Customization & Store
          </h1>
        </div>

        {/* Real Live Coin Balance */}
        <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-300 shadow-sm">
          <Coins className="w-4 h-4 text-amber-400" />
          <span className="text-xs sm:text-sm font-black tracking-wide">
            {profile.coins.toLocaleString()}
          </span>
        </div>
      </header>

      {/* Main Container Card */}
      <main className="w-full max-w-4xl bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-md flex flex-col gap-6">
        {/* Navigation Tabs */}
        <div className="grid grid-cols-4 gap-2 p-1.5 rounded-2xl bg-slate-950 border border-white/5">
          <button
            type="button"
            id="tab-avatars"
            onClick={() => setActiveTab('AVATARS')}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'AVATARS'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="text-base">🙂</span>
            <span>Avatars</span>
          </button>

          <button
            type="button"
            id="tab-token-skins"
            onClick={() => setActiveTab('TOKENS')}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'TOKENS'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="text-base">🔴</span>
            <span>Token Skins</span>
          </button>

          <button
            type="button"
            id="tab-board-themes"
            onClick={() => setActiveTab('THEMES')}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'THEMES'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Board Themes</span>
          </button>

          <button
            type="button"
            id="tab-settings"
            onClick={() => setActiveTab('SETTINGS')}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'SETTINGS'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Game Settings</span>
          </button>
        </div>

        {/* 1. PLAYER AVATARS TAB */}
        {activeTab === 'AVATARS' && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
              <div className="flex items-center gap-3">
                <Avatar
                  avatar={profile.avatar}
                  size="lg"
                  className="ring-4 ring-amber-400/80 shadow-lg"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-white">Active Avatar</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      EQUIPPED
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Displayed in online lobbies, games, player cards, and chat.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
                Built-in & Unlocked Avatars
              </h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                {DEFAULT_AVATARS.map((av) => {
                  const isSelected = profile.avatar === av;
                  return (
                    <button
                      key={av}
                      type="button"
                      onClick={() => handleSelectAvatar(av)}
                      className={`relative aspect-square rounded-2xl flex items-center justify-center text-3xl sm:text-4xl transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/20 border-2 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-105'
                          : 'bg-slate-950/80 border border-slate-800 hover:border-slate-700 hover:scale-105 hover:bg-slate-900'
                      }`}
                    >
                      <span>{av}</span>
                      {isSelected && (
                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-md">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 2. TOKEN SKINS TAB */}
        {activeTab === 'TOKENS' && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
              <div>
                <h3 className="text-sm font-black text-white">Equipped Token Skin</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Your custom tokens are rendered during matches and visible to opponents.
                </p>
              </div>

              {/* Live Preview of Equipped Skin on 4 colors */}
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800">
                {previewColors.map((color) => {
                  const style = getTokenSkinStyle(profile.selectedTokenSkin || 'classic', color);
                  return (
                    <div
                      key={color}
                      style={{ background: style.gradient }}
                      className={`w-7 h-7 rounded-full border-2 ${style.bezel} flex items-center justify-center shadow-md`}
                    >
                      {style.centerEmoji ? (
                        <span className="text-[9px] leading-none">{style.centerEmoji}</span>
                      ) : (
                        <div className={`w-2 h-2 rounded-full ${style.centerDot}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {tokenSkins.map((item) => {
                const isEquipped = (profile.selectedTokenSkin || 'classic') === item.id;
                const isOwned = item.isOwned || (profile.unlockedTokenSkins || []).includes(item.id) || item.price === 0;
                const canAfford = profile.coins >= item.price;

                return (
                  <div
                    key={item.id}
                    id={`token-skin-card-${item.id}`}
                    className={`flex flex-col justify-between p-4 rounded-2xl border transition-all ${
                      isEquipped
                        ? 'bg-gradient-to-b from-amber-500/10 to-slate-950 border-amber-400/80 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Header: Name and Rarity */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-mono">
                          {item.rarity || 'COMMON'}
                        </span>
                        {isEquipped && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                            EQUIPPED
                          </span>
                        )}
                      </div>

                      <h4 className="text-base font-black text-white">{item.name}</h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.description}</p>
                    </div>

                    {/* Interactive Visual Preview on 4 Colors */}
                    <div className="my-4 py-3 px-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-around">
                      {previewColors.map((col) => {
                        const previewStyle = getTokenSkinStyle(item.id, col);
                        return (
                          <div
                            key={col}
                            style={{ background: previewStyle.gradient }}
                            className={`w-9 h-9 rounded-full border-2 ${previewStyle.bezel} flex items-center justify-center shadow-lg transition-transform hover:scale-110`}
                          >
                            <div className={`w-4 h-4 rounded-full border ${previewStyle.centerRing} flex items-center justify-center shadow-inner`}>
                              {previewStyle.centerEmoji ? (
                                <span className="text-[10px] leading-none">{previewStyle.centerEmoji}</span>
                              ) : (
                                <div className={`w-1.5 h-1.5 rounded-full ${previewStyle.centerDot}`} />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Action Button: Equip vs Buy */}
                    <div>
                      {isEquipped ? (
                        <button
                          type="button"
                          disabled
                          className="w-full py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-default"
                        >
                          <Check className="w-4 h-4" />
                          <span>CURRENTLY EQUIPPED</span>
                        </button>
                      ) : isOwned ? (
                        <button
                          type="button"
                          onClick={() => handleEquipTokenSkin(item)}
                          className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          <span>EQUIP SKIN</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPendingItem(item)}
                          disabled={!canAfford}
                          className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md ${
                            canAfford
                              ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 cursor-pointer shadow-amber-500/20'
                              : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                          }`}
                        >
                          <Coins className="w-4 h-4" />
                          <span>{item.price.toLocaleString()} COINS</span>
                          {!canAfford && <span className="text-[10px] opacity-75">(NOT ENOUGH)</span>}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. BOARD THEMES TAB */}
        {activeTab === 'THEMES' && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
              <div>
                <h3 className="text-sm font-black text-white">Equipped Board Theme</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Transforms your board frame, finish zone, and walkway styling.
                </p>
              </div>

              <div className="text-xs font-black px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/40">
                {getBoardThemeStyle(profile.selectedTheme || 'classic').name}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {boardThemes.map((themeItem) => {
                const isEquipped = (profile.selectedTheme || 'classic') === themeItem.id;
                const isOwned = themeItem.isOwned || (profile.unlockedThemes || []).includes(themeItem.id) || themeItem.price === 0;
                const canAfford = profile.coins >= themeItem.price;
                const visualTheme = getBoardThemeStyle(themeItem.id);

                return (
                  <div
                    key={themeItem.id}
                    id={`board-theme-card-${themeItem.id}`}
                    className={`flex flex-col justify-between p-4 rounded-2xl border transition-all ${
                      isEquipped
                        ? 'bg-gradient-to-b from-amber-500/10 to-slate-950 border-amber-400/80 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Header */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-mono">
                          {themeItem.rarity || 'RARE'}
                        </span>
                        {isEquipped && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                            ACTIVE
                          </span>
                        )}
                      </div>

                      <h4 className="text-base font-black text-white">{themeItem.name}</h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{themeItem.description}</p>
                    </div>

                    {/* Miniature Theme Swatch Showcase */}
                    <div className="my-4 p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col gap-2">
                      <div className={`h-10 rounded-lg flex items-center justify-between px-3 ${visualTheme.frameClass}`}>
                        <span className="text-[10px] font-black text-white/80 uppercase tracking-wider">
                          Border Frame
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs">⭐</span>
                          <span className="text-xs">👑</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-center">
                        <div className="p-1 rounded bg-rose-500/20 text-[9px] font-bold text-rose-300">RED</div>
                        <div className="p-1 rounded bg-emerald-500/20 text-[9px] font-bold text-emerald-300">GRN</div>
                        <div className="p-1 rounded bg-amber-500/20 text-[9px] font-bold text-amber-300">YEL</div>
                        <div className="p-1 rounded bg-sky-500/20 text-[9px] font-bold text-sky-300">BLU</div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div>
                      {isEquipped ? (
                        <button
                          type="button"
                          disabled
                          className="w-full py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-default"
                        >
                          <Check className="w-4 h-4" />
                          <span>CURRENTLY ACTIVE</span>
                        </button>
                      ) : isOwned ? (
                        <button
                          type="button"
                          onClick={() => handleEquipBoardTheme(themeItem)}
                          className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          <span>APPLY THEME</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPendingItem(themeItem)}
                          disabled={!canAfford}
                          className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md ${
                            canAfford
                              ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 cursor-pointer shadow-amber-500/20'
                              : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                          }`}
                        >
                          <Coins className="w-4 h-4" />
                          <span>{themeItem.price.toLocaleString()} COINS</span>
                          {!canAfford && <span className="text-[10px] opacity-75">(NOT ENOUGH)</span>}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. USER GAME SETTINGS TAB */}
        {activeTab === 'SETTINGS' && (
          <div className="flex flex-col gap-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">
              Audio & Tactical Preferences
            </h3>

            {/* Sound Effects Toggle */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-amber-400">
                  {settings.soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-slate-500" />}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">Sound Effects</h4>
                  <p className="text-xs text-slate-400">Rolls, token hops, captures, and victory fanfare</p>
                </div>
              </div>
              <button
                type="button"
                id="toggle-sound-effects"
                onClick={() => handleToggleSetting('soundEnabled')}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  settings.soundEnabled ? 'bg-amber-500' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                    settings.soundEnabled ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Background Music Ambience Toggle */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-rose-400">
                  <Music className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">Background Music</h4>
                  <p className="text-xs text-slate-400">Relaxing ambient synth chords during matches</p>
                </div>
              </div>
              <button
                type="button"
                id="toggle-music"
                onClick={() => handleToggleSetting('musicEnabled')}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  settings.musicEnabled ? 'bg-rose-500' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                    settings.musicEnabled ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Vibration / Haptic Feedback Toggle */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sky-400">
                  <Vibrate className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">Vibration Feedback</h4>
                  <p className="text-xs text-slate-400">Haptic rumble on dice rolls and piece captures</p>
                </div>
              </div>
              <button
                type="button"
                id="toggle-vibration"
                onClick={() => handleToggleSetting('vibrationEnabled')}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  settings.vibrationEnabled ? 'bg-sky-500' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                    settings.vibrationEnabled ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Smooth Animations Toggle */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-indigo-400">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">Smooth Animations</h4>
                  <p className="text-xs text-slate-400">High frame-rate 3D token physics and glowing paths</p>
                </div>
              </div>
              <button
                type="button"
                id="toggle-smooth-anim"
                onClick={() => handleToggleSetting('smoothAnimations')}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  settings.smoothAnimations ? 'bg-indigo-600' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                    settings.smoothAnimations ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Game Notifications Toggle */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">In-Game Notifications</h4>
                  <p className="text-xs text-slate-400">Alerts for your turn, opponent reactions, and invites</p>
                </div>
              </div>
              <button
                type="button"
                id="toggle-notifications"
                onClick={() => handleToggleSetting('notificationsEnabled')}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  settings.notificationsEnabled ? 'bg-emerald-500' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                    settings.notificationsEnabled ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Confirmation Purchase Modal */}
      {pendingItem && (
        <div
          id="purchase-modal-overlay"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center mb-4">
              <ShoppingBag className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-black text-white">Unlock {pendingItem.name}?</h3>
            <p className="text-xs text-slate-400 mt-1 mb-5">{pendingItem.description}</p>

            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800 mb-6 w-full justify-between">
              <span className="text-xs text-slate-400 font-bold">Cost:</span>
              <div className="flex items-center gap-1.5 text-amber-300 font-black">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>{pendingItem.price.toLocaleString()} coins</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full">
              <button
                type="button"
                onClick={() => setPendingItem(null)}
                disabled={isProcessing}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                id="btn-confirm-purchase"
                onClick={handleConfirmPurchase}
                disabled={isProcessing}
                className="py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                {isProcessing ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirm Buy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Branding */}
      <footer className="w-full max-w-4xl text-center text-xs text-slate-500 font-medium py-2">
        Customizations are permanently saved and synchronized across all game modes.
      </footer>
    </div>
  );
};
