import React, { useState, useEffect } from 'react';
import { Users, X, Gamepad2, Check, UserPlus } from 'lucide-react';
import { friendService, FriendsState } from '../../services/friendService';
import { FriendUserInfo } from '../../types/friendTypes';

interface InviteFriendsDrawerProps {
  roomCode: string;
  isOpen: boolean;
  onClose: () => void;
  onOpenFriendsScreen?: () => void;
}

export const InviteFriendsDrawer: React.FC<InviteFriendsDrawerProps> = ({
  roomCode,
  isOpen,
  onClose,
  onOpenFriendsScreen,
}) => {
  const [state, setState] = useState<FriendsState>(friendService.getState());
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [sentMap, setSentMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsub = friendService.subscribe((s) => setState(s));
    friendService.refresh();
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const onlineFriends = state.friends.filter((f) => f.isOnline);

  const handleInvite = async (friend: FriendUserInfo) => {
    setInvitingId(friend.playerId);
    const res = await friendService.sendGameInvite(friend.playerId, roomCode);
    setInvitingId(null);
    if (res.success) {
      setSentMap((prev) => ({ ...prev, [friend.playerId]: true }));
      setTimeout(() => {
        setSentMap((prev) => ({ ...prev, [friend.playerId]: false }));
      }, 5000);
    }
  };

  return (
    <div className="fixed inset-0 z-[9995] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl text-white flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-white uppercase tracking-wider">
                Invite Online Friends
              </h3>
              <p className="text-[11px] text-slate-400">
                Room <span className="font-mono font-bold text-amber-400">{roomCode}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Online friends list */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1 min-h-[160px]">
          {onlineFriends.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <span className="text-3xl mb-2">😴</span>
              <p className="text-sm font-bold text-white mb-1">No Friends Online</p>
              <p className="text-xs text-slate-400 max-w-xs mb-4">
                None of your friends are currently online. You can also share the room code or copy the invite link!
              </p>
              {onOpenFriendsScreen && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenFriendsScreen();
                  }}
                  className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Find & Add Friends</span>
                </button>
              )}
            </div>
          ) : (
            onlineFriends.map((friend) => (
              <div
                key={friend.playerId}
                className="bg-slate-800/80 border border-white/10 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl">
                      {friend.avatar || '👑'}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-xs sm:text-sm text-white">
                        {friend.displayName}
                      </h4>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                        L{friend.level}
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-semibold">🟢 Online</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleInvite(friend)}
                  disabled={invitingId === friend.playerId}
                  className={`py-2 px-3.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-md ${
                    sentMap[friend.playerId]
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black'
                  }`}
                >
                  {sentMap[friend.playerId] ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>SENT ✓</span>
                    </>
                  ) : invitingId === friend.playerId ? (
                    <span>...</span>
                  ) : (
                    <>
                      <Gamepad2 className="w-3.5 h-3.5" />
                      <span>INVITE</span>
                    </>
                  )}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="pt-4 mt-3 border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
