import React, { useState, useEffect } from 'react';
import { UserProfile, GameSettings } from './types/playerTypes';
import { Player, GameMode } from './types/gameTypes';
import { db } from './database/database';
import { playerProfileService } from './services/playerProfileService';
import { gameEngine, PlayerSetupConfig } from './game/gameEngine';
import { audio } from './audio/audioManager';

import { SplashScreen } from './screens/SplashScreen';
import { HomeScreen } from './screens/HomeScreen';
import { PlayerSetup } from './screens/PlayerSetup';
import { GameScreen } from './screens/GameScreen';
import { WinnerScreen } from './screens/WinnerScreen';
import { Leaderboard } from './screens/Leaderboard';
import { Profile } from './screens/Profile';
import { Achievements } from './screens/Achievements';
import { Settings } from './screens/Settings';
import { OnlineMultiplayerScreen } from './screens/OnlineMultiplayerScreen';
import { FriendsScreen } from './screens/FriendsScreen';
import { GameInviteNotification } from './components/invitations/GameInviteNotification';
import { roomService } from './services/roomService';
import { authService } from './services/authService';

type ScreenType =
  | 'SPLASH'
  | 'HOME'
  | 'PLAYER_SETUP'
  | 'GAME'
  | 'LEADERBOARD'
  | 'PROFILE'
  | 'ACHIEVEMENTS'
  | 'SETTINGS'
  | 'ONLINE_MULTIPLAYER'
  | 'FRIENDS';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('room') || sessionStorage.getItem('ludo_royale_active_room_code')) {
        return 'ONLINE_MULTIPLAYER';
      }
    } catch {
      // ignore
    }
    return 'HOME';
  });
  const [setupMode, setSetupMode] = useState<'LOCAL' | 'AI'>('LOCAL');
  const [profile, setProfile] = useState<UserProfile>(() => playerProfileService.getProfile());
  const [settings, setSettings] = useState<GameSettings>(() => db.getSettings());
  const [winner, setWinner] = useState<Player | null>(null);
  const [lastConfigs, setLastConfigs] = useState<PlayerSetupConfig[]>([]);
  const [lastMode, setLastMode] = useState<GameMode>('LOCAL');

  // Restore persistent user session and keep App profile in sync
  useEffect(() => {
    authService.restoreSession();

    const unsubProfile = playerProfileService.subscribe((updated) => {
      setProfile(updated);
    });
    const unsubAuth = authService.subscribe(() => {
      setProfile(playerProfileService.getProfile());
    });

    return () => {
      unsubProfile();
      unsubAuth();
    };
  }, []);

  // Initialize audio on first click anywhere in the window
  useEffect(() => {
    const handleFirstInteraction = () => {
      audio.init();
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  // Listen to game engine events for winner state
  useEffect(() => {
    const unsubscribe = gameEngine.subscribe((state) => {
      if (state.winner && state.gameStatus === 'GAME_OVER') {
        setWinner(state.winner);
      } else {
        setWinner(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen for real-time invite acceptance joins from WebSocket
  useEffect(() => {
    const unsub = roomService.onInviteAcceptedJoin(() => {
      setCurrentScreen('ONLINE_MULTIPLAYER');
    });
    return () => unsub();
  }, []);

  const handleStartGame = (configs: PlayerSetupConfig[], mode: GameMode) => {
    setLastConfigs(configs);
    setLastMode(mode);
    setWinner(null);
    gameEngine.startNewGame(configs, mode);
    setCurrentScreen('GAME');
  };

  const handlePlayAgain = () => {
    setWinner(null);
    if (lastConfigs.length > 0) {
      gameEngine.startNewGame(lastConfigs, lastMode);
    } else {
      setCurrentScreen('PLAYER_SETUP');
    }
  };

  const handleHome = () => {
    setWinner(null);
    setProfile(db.getProfile());
    setCurrentScreen('HOME');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Active Screen View */}
      {currentScreen === 'SPLASH' && (
        <SplashScreen onEnter={() => setCurrentScreen('HOME')} />
      )}

      {currentScreen === 'HOME' && (
        <HomeScreen
          profile={profile}
          onNavigate={(target) => {
            if (target === 'PLAYER_SETUP_LOCAL') {
              setSetupMode('LOCAL');
              setCurrentScreen('PLAYER_SETUP');
            } else if (target === 'PLAYER_SETUP_AI') {
              setSetupMode('AI');
              setCurrentScreen('PLAYER_SETUP');
            } else {
              setCurrentScreen(target);
            }
          }}
        />
      )}

      {currentScreen === 'PLAYER_SETUP' && (
        <PlayerSetup
          initialMode={setupMode}
          onStartGame={handleStartGame}
          onBack={() => setCurrentScreen('HOME')}
        />
      )}

      {currentScreen === 'GAME' && (
        <GameScreen
          onHome={handleHome}
          onOpenSettings={() => setCurrentScreen('SETTINGS')}
        />
      )}

      {currentScreen === 'LEADERBOARD' && (
        <Leaderboard onBack={() => setCurrentScreen('HOME')} />
      )}

      {currentScreen === 'PROFILE' && (
        <Profile
          profile={profile}
          onUpdateProfile={setProfile}
          onBack={() => setCurrentScreen('HOME')}
        />
      )}

      {currentScreen === 'ACHIEVEMENTS' && (
        <Achievements onBack={() => setCurrentScreen('HOME')} />
      )}

      {currentScreen === 'SETTINGS' && (
        <Settings
          settings={settings}
          onUpdateSettings={setSettings}
          onBack={() => {
            // Return to game if a match is active, else to home
            if (gameEngine.getState().gameStatus !== 'GAME_OVER' && currentScreen === 'GAME') {
              setCurrentScreen('GAME');
            } else {
              setCurrentScreen('HOME');
            }
          }}
        />
      )}

      {currentScreen === 'ONLINE_MULTIPLAYER' && (
        <OnlineMultiplayerScreen
          onBack={() => setCurrentScreen('HOME')}
          onOpenFriends={() => setCurrentScreen('FRIENDS')}
        />
      )}

      {currentScreen === 'FRIENDS' && (
        <FriendsScreen
          onBack={() => setCurrentScreen('HOME')}
          onNavigateToRoom={() => setCurrentScreen('ONLINE_MULTIPLAYER')}
        />
      )}

      {/* Global Game Invite & Notification Overlay */}
      <GameInviteNotification
        onAcceptInvite={() => setCurrentScreen('ONLINE_MULTIPLAYER')}
      />

      {/* Winner Modal Screen Overlay (Appears as soon as any player guides all 4 tokens home) */}
      {winner && (
        <WinnerScreen
          winner={winner}
          onPlayAgain={handlePlayAgain}
          onHome={handleHome}
          onLeaderboard={() => {
            setWinner(null);
            setCurrentScreen('LEADERBOARD');
          }}
        />
      )}
    </div>
  );
}
