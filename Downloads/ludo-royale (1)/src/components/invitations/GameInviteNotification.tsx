import React, { useState, useEffect } from 'react';
import { GameInvitation } from '../../types/friendTypes';
import { friendService } from '../../services/friendService';
import { roomService } from '../../services/roomService';
import { Check, X, Bell, Gamepad2, Clock, AlertCircle } from 'lucide-react';

interface GameInviteNotificationProps {
  onAcceptInvite: (roomCode: string) => void;
}

export const GameInviteNotification: React.FC<GameInviteNotificationProps> = ({ onAcceptInvite }) => {
  const [invitations, setInvitations] = useState<GameInvitation[]>([]);
  const [toast, setToast] = useState<{ id: string; message: string; type: 'info' | 'success' | 'warning' } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubFriends = friendService.subscribe((state) => {
      setInvitations(state.activeInvitations);
    });

    const unsubToast = friendService.onToast((t) => {
      setToast(t);
    });

    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      unsubFriends();
      unsubToast();
      clearInterval(timer);
    };
  }, []);

  const handleAccept = async (inv: GameInvitation) => {
    setAcceptingId(inv.invitationId);
    const result = await friendService.respondGameInvite(inv.invitationId, 'ACCEPT');
    setAcceptingId(null);
    if (result.success && result.roomCode) {
      onAcceptInvite(result.roomCode);
    }
  };

  const handleDecline = async (inv: GameInvitation) => {
    await friendService.respondGameInvite(inv.invitationId, 'DECLINE');
  };

  return (
    <>
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-[9999] max-w-sm w-full animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`p-4 rounded-2xl shadow-2xl backdrop-blur-xl border flex items-center gap-3 text-white ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100'
                : toast.type === 'warning'
                ? 'bg-amber-950/90 border-amber-500/40 text-amber-100'
                : 'bg-slate-900/90 border-indigo-500/40 text-indigo-100'
            }`}
          >
            {toast.type === 'success' ? (
              <Check className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : toast.type === 'warning' ? (
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            ) : (
              <Bell className="w-5 h-5 text-indigo-400 shrink-0" />
            )}
            <span className="text-sm font-semibold">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Active Game Invitations (Bottom Right / Floating Banner) */}
      {invitations.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[9998] flex flex-col gap-3 max-w-md w-full px-4 sm:px-0">
          {invitations.map((inv) => {
            const timeLeft = Math.max(0, Math.ceil((inv.expiresAt - now) / 1000));
            const progress = Math.max(0, Math.min(100, (timeLeft / 60) * 100));
            const isAccepting = acceptingId === inv.invitationId;

            if (timeLeft <= 0) return null;

            return (
              <div
                key={inv.invitationId}
                className="bg-slate-900/95 border-2 border-amber-500/60 rounded-3xl p-4 sm:p-5 shadow-2xl backdrop-blur-xl text-white relative overflow-hidden transition-all"
              >
                {/* Progress bar countdown */}
                <div
                  className="absolute bottom-0 left-0 h-1.5 bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-1000"
                  style={{ width: `${progress}%` }}
                />

                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-2xl shadow-inner">
                      {inv.senderAvatar || '👑'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-amber-400 tracking-wider uppercase flex items-center gap-1">
                          <Gamepad2 className="w-3.5 h-3.5" /> GAME INVITE
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" /> {timeLeft}s
                        </span>
                      </div>
                      <h4 className="font-extrabold text-base text-white leading-snug">
                        {inv.senderName}
                      </h4>
                      <p className="text-xs text-slate-300">
                        invited you to play Ludo • Room <span className="font-mono font-bold text-amber-300">{inv.roomCode}</span>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDecline(inv)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all"
                    title="Decline invite"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => handleDecline(inv)}
                    disabled={isAccepting}
                    className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                  >
                    Decline
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAccept(inv)}
                    disabled={isAccepting}
                    className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isAccepting ? (
                      <span>Joining...</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>ACCEPT</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};
