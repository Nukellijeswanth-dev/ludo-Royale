import React, { useState, useEffect } from 'react';
import { Room, RoomSettings } from '../../types/roomTypes';
import {
  X,
  Sliders,
  Users,
  Zap,
  Play,
  Check,
  ShieldAlert,
  Info,
} from 'lucide-react';

interface RoomRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  onUpdateRules: (settings: Partial<RoomSettings>) => void;
  isHost: boolean;
}

export const RoomRulesModal: React.FC<RoomRulesModalProps> = ({
  isOpen,
  onClose,
  room,
  onUpdateRules,
  isHost,
}) => {
  const currentSettings = room.settings || {
    maxPlayers: room.maxPlayers || 4,
    autoMoveSingleToken: false,
    quickDice: false,
  };

  const [maxPlayers, setMaxPlayers] = useState<number>(currentSettings.maxPlayers || room.maxPlayers || 4);
  const [autoMove, setAutoMove] = useState<boolean>(!!currentSettings.autoMoveSingleToken);
  const [quickDice, setQuickDice] = useState<boolean>(!!currentSettings.quickDice);

  useEffect(() => {
    if (room.settings) {
      setMaxPlayers(room.settings.maxPlayers || room.maxPlayers || 4);
      setAutoMove(!!room.settings.autoMoveSingleToken);
      setQuickDice(!!room.settings.quickDice);
    }
  }, [room.settings, room.maxPlayers]);

  if (!isOpen) return null;

  const isPlaying = room.state === 'PLAYING';
  const isRanked = !!room.isMatchmaking;

  const handleSave = () => {
    if (!isHost || isPlaying || isRanked) return;
    onUpdateRules({
      maxPlayers,
      autoMoveSingleToken: autoMove,
      quickDice,
    });
    onClose();
  };

  return (
    <div
      id="room-rules-modal-overlay"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 text-slate-100 animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-300">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Custom Room Rules</h3>
              <p className="text-xs text-slate-400">
                {isHost ? 'Configure lobby game parameters' : 'Current lobby parameters (Host Only)'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning if ranked/quick match */}
        {isRanked && (
          <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>Ranked Quick Match rules are strictly standardized and cannot be modified.</span>
          </div>
        )}

        {/* Warning if playing */}
        {isPlaying && (
          <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 flex-shrink-0" />
            <span>Rules are locked while a game is currently in progress.</span>
          </div>
        )}

        {/* Form Controls */}
        <div className="flex flex-col gap-4">
          {/* Max Players Selector */}
          <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-slate-200">Max Players Capacity</span>
              </div>
              <span className="text-xs font-black text-amber-300">{maxPlayers} Players</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Limit the room size to 2, 3, or 4 players before the game begins.
            </p>

            <div className="grid grid-cols-3 gap-2 mt-1">
              {[2, 3, 4].map((count) => {
                const disabled = !isHost || isPlaying || isRanked || room.players.length > count;
                const isSelected = maxPlayers === count;
                return (
                  <button
                    key={count}
                    type="button"
                    disabled={disabled}
                    onClick={() => setMaxPlayers(count)}
                    className={`py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                        : disabled
                        ? 'bg-slate-900/50 text-slate-600 border-slate-800 cursor-not-allowed'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {count} Players
                  </button>
                );
              })}
            </div>
            {room.players.length > maxPlayers && (
              <span className="text-[10px] text-rose-400">
                Cannot set lower than currently connected players ({room.players.length}).
              </span>
            )}
          </div>

          {/* Auto-Move Single Token Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">Auto-Move Lone Token</h4>
                <p className="text-[11px] text-slate-400">
                  Automatically hops when only one valid move is available
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={!isHost || isPlaying || isRanked}
              onClick={() => setAutoMove((prev) => !prev)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                !isHost || isPlaying || isRanked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              } ${autoMove ? 'bg-emerald-500' : 'bg-slate-800'}`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  autoMove ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Quick Dice Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-amber-400">
                <Play className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">Quick Dice Roll Pace</h4>
                <p className="text-[11px] text-slate-400">
                  Accelerated rolling animation for faster overall match tempo
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={!isHost || isPlaying || isRanked}
              onClick={() => setQuickDice((prev) => !prev)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                !isHost || isPlaying || isRanked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              } ${quickDice ? 'bg-amber-500' : 'bg-slate-800'}`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  quickDice ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
          >
            {isHost ? 'Cancel' : 'Close'}
          </button>

          {isHost && !isPlaying && !isRanked && (
            <button
              type="button"
              id="btn-save-room-rules"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer shadow-md transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Save Rules</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
