import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Inbox,
  ShieldAlert,
  Search,
  Check,
  X,
  UserMinus,
  Ban,
  Gamepad2,
  ArrowLeft,
  RefreshCw,
  Clock,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { friendService, FriendsState } from '../services/friendService';
import { authService } from '../services/authService';
import { roomService } from '../services/roomService';
import { FriendUserInfo, FriendSearchPlayer } from '../types/friendTypes';

interface FriendsScreenProps {
  onBack: () => void;
  onNavigateToRoom?: (roomCode: string) => void;
}

type TabType = 'FRIENDS' | 'REQUESTS' | 'ADD' | 'BLOCKED';

export const FriendsScreen: React.FC<FriendsScreenProps> = ({ onBack, onNavigateToRoom }) => {
  const [activeTab, setActiveTab] = useState<TabType>('FRIENDS');
  const [state, setState] = useState<FriendsState>(friendService.getState());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendSearchPlayer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Confirmation dialog state for Remove or Block
  const [confirmModal, setConfirmModal] = useState<{
    type: 'REMOVE' | 'BLOCK';
    friendshipId?: string;
    targetPlayerId: string;
    displayName: string;
  } | null>(null);

  const [invitingFriendId, setInvitingFriendId] = useState<string | null>(null);
  const [inviteSuccessMap, setInviteSuccessMap] = useState<Record<string, boolean>>({});

  const myPlayerId = authService.getPlayerId();
  const currentRoom = roomService.getRoom();

  useEffect(() => {
    const unsub = friendService.subscribe((newState) => {
      setState(newState);
    });
    friendService.refresh();
    return () => unsub();
  }, []);

  // Handle player search
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    try {
      const results = await friendService.searchPlayers(query);
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError('No players found matching your query.');
      }
    } catch {
      setSearchError('Failed to search players.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async (targetPlayerId: string) => {
    const res = await friendService.sendFriendRequest(targetPlayerId);
    if (res.success) {
      // Update local search result status
      setSearchResults((prev) =>
        prev.map((p) =>
          p.playerId === targetPlayerId
            ? { ...p, relationshipStatus: 'REQUEST_SENT' }
            : p
        )
      );
    }
  };

  const handleRespondRequest = async (friendshipId: string, action: 'ACCEPT' | 'DECLINE') => {
    await friendService.respondFriendRequest(friendshipId, action);
  };

  const handleConfirmAction = async () => {
    if (!confirmModal) return;
    if (confirmModal.type === 'REMOVE' && confirmModal.friendshipId) {
      await friendService.removeFriend(confirmModal.friendshipId);
    } else if (confirmModal.type === 'BLOCK') {
      await friendService.blockPlayer(confirmModal.targetPlayerId);
    }
    setConfirmModal(null);
  };

  const handleUnblock = async (targetPlayerId: string) => {
    await friendService.unblockPlayer(targetPlayerId);
  };

  const handleInviteFriend = async (friend: FriendUserInfo) => {
    setInvitingFriendId(friend.playerId);

    let roomCode = currentRoom?.code;

    // If host is already in a room that hasn't started, use it
    if (!roomCode || currentRoom?.state === 'PLAYING') {
      // Create a new room automatically
      try {
        await roomService.createRoom();
        const newRoom = roomService.getRoom();
        roomCode = newRoom?.code;
      } catch {
        friendService.showToast('Failed to create room for invitation.', 'warning');
        setInvitingFriendId(null);
        return;
      }
    }

    if (roomCode) {
      const res = await friendService.sendGameInvite(friend.playerId, roomCode);
      if (res.success) {
        setInviteSuccessMap((prev) => ({ ...prev, [friend.playerId]: true }));
        setTimeout(() => {
          setInviteSuccessMap((prev) => ({ ...prev, [friend.playerId]: false }));
        }, 4000);

        if (onNavigateToRoom) {
          onNavigateToRoom(roomCode);
        }
      }
    }

    setInvitingFriendId(null);
  };

  const onlineFriendsCount = state.friends.filter((f) => f.isOnline).length;
  const pendingRequestsCount = state.incomingRequests.length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col items-center p-4 sm:p-6 pb-24">
      {/* Top Header */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 py-2 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all border border-white/10 cursor-pointer shadow-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Back</span>
        </button>

        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-black tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400">
            Friends & Social
          </h1>
          <p className="text-[11px] font-medium text-slate-400">
            {onlineFriendsCount} Online • Real Player Network
          </p>
        </div>

        <button
          type="button"
          onClick={() => friendService.refresh()}
          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all border border-white/10 cursor-pointer shadow-lg"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="w-full max-w-2xl grid grid-cols-4 gap-1.5 p-1.5 bg-slate-900/90 border border-white/10 rounded-2xl mb-6 shadow-xl backdrop-blur-md">
        <button
          type="button"
          onClick={() => setActiveTab('FRIENDS')}
          className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'FRIENDS'
              ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Friends</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/20">
            {state.friends.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('REQUESTS')}
          className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 relative cursor-pointer ${
            activeTab === 'REQUESTS'
              ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Requests</span>
          {pendingRequestsCount > 0 ? (
            <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 animate-pulse">
              {pendingRequestsCount}
            </span>
          ) : (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/20">
              0
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ADD')}
          className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'ADD'
              ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Add</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('BLOCKED')}
          className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'BLOCKED'
              ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Blocked</span>
          {state.blocked.length > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/20">
              {state.blocked.length}
            </span>
          )}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-2xl flex-1 flex flex-col">
        {/* ================= TAB 1: MY FRIENDS ================= */}
        {activeTab === 'FRIENDS' && (
          <div className="flex flex-col gap-3">
            {state.friends.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-900/60 rounded-3xl border border-white/10 text-center backdrop-blur-md">
                <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-400/30 flex items-center justify-center mb-4 text-indigo-400">
                  <Users className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black text-white mb-1">No Friends Yet</h3>
                <p className="text-xs text-slate-400 max-w-xs mb-6">
                  Add friends by their username or unique player ID to see their real-time online status and invite them to matches!
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('ADD')}
                  className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Find Players</span>
                </button>
              </div>
            ) : (
              state.friends.map((friend) => (
                <div
                  key={friend.friendshipId}
                  className="bg-slate-900/80 hover:bg-slate-900 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-lg transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl shadow-inner">
                        {friend.avatar || '👑'}
                      </div>
                      {/* Real presence indicator */}
                      <span
                        className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                          friend.isOnline ? 'bg-emerald-400 ring-2 ring-emerald-500/50' : 'bg-slate-500'
                        }`}
                        title={friend.isOnline ? 'Online' : 'Offline'}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-sm text-white truncate">
                          {friend.displayName}
                        </h4>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/30">
                          LVL {friend.level}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>Rating: <strong className="text-slate-200">{friend.rating}</strong></span>
                        <span>•</span>
                        <span className={`font-semibold flex items-center gap-1 ${friend.isOnline ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {friend.isOnline ? '🟢 Online' : '⚪ Offline'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Invite Button */}
                    <button
                      type="button"
                      onClick={() => handleInviteFriend(friend)}
                      disabled={!friend.isOnline || invitingFriendId === friend.playerId}
                      className={`py-2 px-3.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-md ${
                        inviteSuccessMap[friend.playerId]
                          ? 'bg-emerald-600 text-white'
                          : friend.isOnline
                          ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black'
                          : 'bg-white/5 text-slate-500 cursor-not-allowed border border-white/5'
                      }`}
                      title={friend.isOnline ? 'Invite to game' : 'Player is currently offline'}
                    >
                      <Gamepad2 className="w-3.5 h-3.5" />
                      <span>
                        {inviteSuccessMap[friend.playerId]
                          ? 'SENT ✓'
                          : invitingFriendId === friend.playerId
                          ? '...'
                          : 'INVITE'}
                      </span>
                    </button>

                    {/* Remove Action */}
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmModal({
                          type: 'REMOVE',
                          friendshipId: friend.friendshipId,
                          targetPlayerId: friend.playerId,
                          displayName: friend.displayName,
                        })
                      }
                      className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-white/10 transition-all cursor-pointer"
                      title="Remove friend"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>

                    {/* Block Action */}
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmModal({
                          type: 'BLOCK',
                          targetPlayerId: friend.playerId,
                          displayName: friend.displayName,
                        })
                      }
                      className="p-2 rounded-xl bg-white/5 hover:bg-slate-800 text-slate-400 hover:text-amber-400 border border-white/10 transition-all cursor-pointer"
                      title="Block player"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ================= TAB 2: FRIEND REQUESTS ================= */}
        {activeTab === 'REQUESTS' && (
          <div className="flex flex-col gap-6">
            {/* Incoming Requests */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Inbox className="w-4 h-4" />
                  <span>Incoming Requests ({state.incomingRequests.length})</span>
                </h3>
              </div>

              {state.incomingRequests.length === 0 ? (
                <div className="py-8 px-4 bg-slate-900/60 rounded-2xl border border-white/10 text-center text-xs text-slate-400">
                  No incoming friend requests.
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {state.incomingRequests.map((req) => (
                    <div
                      key={req.friendshipId}
                      className="bg-slate-900/80 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-2xl">
                          {req.avatar || '👑'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-sm text-white">
                              {req.displayName}
                            </h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30">
                              LVL {req.level}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">Rating: {req.rating}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRespondRequest(req.friendshipId, 'DECLINE')}
                          className="py-2 px-3.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-200 border border-white/10 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespondRequest(req.friendshipId, 'ACCEPT')}
                          className="py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>Accept</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Outgoing Requests */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>Pending Sent Requests ({state.outgoingRequests.length})</span>
                </h3>
              </div>

              {state.outgoingRequests.length === 0 ? (
                <div className="py-6 px-4 bg-slate-900/40 rounded-2xl border border-white/5 text-center text-xs text-slate-500">
                  No outgoing pending requests.
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {state.outgoingRequests.map((req) => (
                    <div
                      key={req.friendshipId}
                      className="bg-slate-900/60 border border-white/10 rounded-2xl p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl">
                          {req.avatar || '👑'}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-white">{req.displayName}</h4>
                          <p className="text-[11px] text-slate-400">Level {req.level} • Waiting for player response</p>
                        </div>
                      </div>

                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/10 text-slate-300">
                        Pending...
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 3: ADD FRIEND ================= */}
        {activeTab === 'ADD' && (
          <div className="flex flex-col gap-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter player ID or username..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-white/15 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
                />
              </div>

              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="py-3 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg transition-all disabled:opacity-50 cursor-pointer shrink-0"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </form>

            {searchError && (
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-amber-300 text-center">
                {searchError}
              </div>
            )}

            {/* Results list */}
            <div className="flex flex-col gap-2.5 mt-2">
              {searchResults.map((player) => (
                <div
                  key={player.playerId}
                  className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl">
                        {player.avatar || '👑'}
                      </div>
                      <span
                        className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                          player.isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                        }`}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-sm text-white truncate">
                          {player.displayName}
                        </h4>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                          LVL {player.level}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>Rating: {player.rating}</span>
                        <span>•</span>
                        <span className={player.isOnline ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                          {player.isOnline ? '🟢 Online' : '⚪ Offline'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {player.relationshipStatus === 'FRIENDS' ? (
                      <span className="py-2 px-3 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Friends
                      </span>
                    ) : player.relationshipStatus === 'REQUEST_SENT' ? (
                      <span className="py-2 px-3 rounded-xl bg-white/10 text-slate-300 text-xs font-semibold">
                        Sent ✓
                      </span>
                    ) : player.relationshipStatus === 'REQUEST_RECEIVED' ? (
                      <button
                        type="button"
                        onClick={() => setActiveTab('REQUESTS')}
                        className="py-2 px-3.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs uppercase"
                      >
                        Respond
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendRequest(player.playerId)}
                        className="py-2 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>Add Friend</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 4: BLOCKED PLAYERS ================= */}
        {activeTab === 'BLOCKED' && (
          <div className="flex flex-col gap-3">
            {state.blocked.length === 0 ? (
              <div className="py-12 px-4 bg-slate-900/60 rounded-2xl border border-white/10 text-center text-xs text-slate-400">
                You have not blocked any players.
              </div>
            ) : (
              state.blocked.map((b) => (
                <div
                  key={b.playerId}
                  className="bg-slate-900/80 border border-rose-500/20 rounded-2xl p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-400/20 flex items-center justify-center text-xl">
                      {b.avatar || '👑'}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">{b.displayName}</h4>
                      <p className="text-[11px] text-slate-400">Blocked Player</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUnblock(b.playerId)}
                    className="py-2 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Unblock
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-white/10 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto mb-4 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black text-white mb-2">
              {confirmModal.type === 'REMOVE' ? 'Remove Friend?' : 'Block Player?'}
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              {confirmModal.type === 'REMOVE'
                ? `Are you sure you want to remove ${confirmModal.displayName} from your friends?`
                : `Are you sure you want to block ${confirmModal.displayName}? They will not be able to send friend requests or invite you to games.`}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmAction}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer"
              >
                {confirmModal.type === 'REMOVE' ? 'Remove' : 'Block'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
