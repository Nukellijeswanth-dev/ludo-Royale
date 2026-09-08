import {
  FriendUserInfo,
  FriendSearchPlayer,
  GameInvitation,
} from '../types/friendTypes';
import { roomService } from './roomService';
import { authService } from './authService';

export interface FriendsState {
  friends: FriendUserInfo[];
  incomingRequests: FriendUserInfo[];
  outgoingRequests: FriendUserInfo[];
  blocked: FriendUserInfo[];
  activeInvitations: GameInvitation[];
  isLoading: boolean;
  error: string | null;
}

type FriendServiceListener = (state: FriendsState) => void;

class FriendService {
  private state: FriendsState = {
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    blocked: [],
    activeInvitations: [],
    isLoading: false,
    error: null,
  };

  private listeners: Set<FriendServiceListener> = new Set();
  private pollInterval: NodeJS.Timeout | null = null;
  private currentToast: { id: string; message: string; type: 'info' | 'success' | 'warning' } | null = null;
  private toastListeners: Set<(toast: { id: string; message: string; type: 'info' | 'success' | 'warning' } | null) => void> = new Set();

  constructor() {
    this.setupWebSocketListeners();
    // Periodically refresh active invitations and check expiration
    setInterval(() => {
      this.pruneExpiredInvitations();
    }, 5000);
  }

  private setupWebSocketListeners(): void {
    roomService.onFriendRequest((req) => {
      this.showToast(`Friend request received from ${req.displayName}!`, 'info');
      this.refresh();
    });

    roomService.onFriendUpdate((update) => {
      if (update.action === 'ACCEPTED') {
        this.showToast('Friend request accepted!', 'success');
      }
      this.refresh();
    });

    roomService.onFriendPresence((playerId, isOnline) => {
      // Update presence instantly in memory
      let changed = false;
      const updatedFriends = this.state.friends.map((f) => {
        if (f.playerId === playerId) {
          changed = true;
          return { ...f, isOnline };
        }
        return f;
      });

      if (changed) {
        // Re-sort: online first, then name
        updatedFriends.sort((a, b) => {
          if (a.isOnline && !b.isOnline) return -1;
          if (!a.isOnline && b.isOnline) return 1;
          return a.displayName.localeCompare(b.displayName);
        });
        this.state = { ...this.state, friends: updatedFriends };
        this.notify();
      }
    });

    roomService.onGameInvite((invitation) => {
      // Check if already in active invitations
      if (!this.state.activeInvitations.some((i) => i.invitationId === invitation.invitationId)) {
        this.state = {
          ...this.state,
          activeInvitations: [invitation, ...this.state.activeInvitations],
        };
        this.notify();
      }
    });

    roomService.onGameInviteResponse((resp) => {
      if (resp.message) {
        this.showToast(resp.message, resp.status === 'ACCEPTED' ? 'success' : 'info');
      }
    });
  }

  public showToast(message: string, type: 'info' | 'success' | 'warning' = 'info'): void {
    const toast = { id: `t_${Date.now()}`, message, type };
    this.currentToast = toast;
    this.toastListeners.forEach((fn) => fn(toast));
    setTimeout(() => {
      if (this.currentToast?.id === toast.id) {
        this.currentToast = null;
        this.toastListeners.forEach((fn) => fn(null));
      }
    }, 4000);
  }

  public onToast(fn: (toast: { id: string; message: string; type: 'info' | 'success' | 'warning' } | null) => void): () => void {
    this.toastListeners.add(fn);
    fn(this.currentToast);
    return () => this.toastListeners.delete(fn);
  }

  public subscribe(listener: FriendServiceListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn({ ...this.state }));
  }

  public getState(): FriendsState {
    return { ...this.state };
  }

  public async refresh(): Promise<void> {
    const playerId = authService.getPlayerId();
    if (!playerId) return;

    try {
      // Load friends and invitations in parallel
      const [friendsRes, invitesRes] = await Promise.all([
        fetch(`/api/friends?playerId=${encodeURIComponent(playerId)}`),
        fetch(`/api/invitations/active?playerId=${encodeURIComponent(playerId)}`),
      ]);

      if (friendsRes.ok) {
        const data = await friendsRes.json();
        let invites: GameInvitation[] = [];
        if (invitesRes.ok) {
          const invData = await invitesRes.json();
          invites = invData.invitations || [];
        }

        this.state = {
          ...this.state,
          friends: data.friends || [],
          incomingRequests: data.incomingRequests || [],
          outgoingRequests: data.outgoingRequests || [],
          blocked: data.blocked || [],
          activeInvitations: invites,
          isLoading: false,
          error: null,
        };
        this.notify();
      }
    } catch (err: any) {
      console.warn('[FriendService] Refresh failed:', err);
    }
  }

  public async searchPlayers(query: string): Promise<FriendSearchPlayer[]> {
    const currentUserId = authService.getPlayerId();
    if (!query.trim() || !currentUserId) return [];

    try {
      const res = await fetch(
        `/api/players/search?query=${encodeURIComponent(query.trim())}&currentUserId=${encodeURIComponent(currentUserId)}`
      );
      if (res.ok) {
        const data = await res.json();
        return data.players || [];
      }
      return [];
    } catch (err) {
      console.error('[FriendService] search error:', err);
      return [];
    }
  }

  public async sendFriendRequest(receiverId: string): Promise<{ success: boolean; message: string }> {
    const requesterId = authService.getPlayerId();
    if (!requesterId) return { success: false, message: 'You must be logged in.' };

    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId, receiverId }),
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        await this.refresh();
      } else {
        this.showToast(data.message || 'Failed to send request', 'warning');
      }
      return data;
    } catch (err: any) {
      const msg = err.message || 'Network error';
      this.showToast(msg, 'warning');
      return { success: false, message: msg };
    }
  }

  public async respondFriendRequest(
    friendshipId: string,
    action: 'ACCEPT' | 'DECLINE'
  ): Promise<{ success: boolean; message: string }> {
    const userId = authService.getPlayerId();
    if (!userId) return { success: false, message: 'You must be logged in.' };

    try {
      const res = await fetch('/api/friends/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, friendshipId, action }),
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, action === 'ACCEPT' ? 'success' : 'info');
        await this.refresh();
      } else {
        this.showToast(data.message || 'Failed to respond', 'warning');
      }
      return data;
    } catch (err: any) {
      const msg = err.message || 'Network error';
      return { success: false, message: msg };
    }
  }

  public async removeFriend(friendshipId: string): Promise<{ success: boolean; message: string }> {
    const userId = authService.getPlayerId();
    if (!userId) return { success: false, message: 'You must be logged in.' };

    try {
      const res = await fetch('/api/friends/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, friendshipId }),
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'info');
        await this.refresh();
      }
      return data;
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error' };
    }
  }

  public async blockPlayer(targetPlayerId: string): Promise<{ success: boolean; message: string }> {
    const userId = authService.getPlayerId();
    if (!userId) return { success: false, message: 'You must be logged in.' };

    try {
      const res = await fetch('/api/friends/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, targetPlayerId, action: 'BLOCK' }),
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'info');
        await this.refresh();
      }
      return data;
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error' };
    }
  }

  public async unblockPlayer(targetPlayerId: string): Promise<{ success: boolean; message: string }> {
    const userId = authService.getPlayerId();
    if (!userId) return { success: false, message: 'You must be logged in.' };

    try {
      const res = await fetch('/api/friends/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, targetPlayerId, action: 'UNBLOCK' }),
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'info');
        await this.refresh();
      }
      return data;
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error' };
    }
  }

  public async sendGameInvite(receiverId: string, roomCode: string): Promise<{ success: boolean; message: string }> {
    const senderId = authService.getPlayerId();
    if (!senderId) return { success: false, message: 'You must be logged in.' };

    try {
      const res = await fetch('/api/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId, receiverId, roomCode }),
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
      } else {
        this.showToast(data.message || 'Failed to send invite', 'warning');
      }
      return data;
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error' };
    }
  }

  public async respondGameInvite(
    invitationId: string,
    action: 'ACCEPT' | 'DECLINE'
  ): Promise<{ success: boolean; message: string; roomCode?: string }> {
    const receiverId = authService.getPlayerId();
    if (!receiverId) return { success: false, message: 'You must be logged in.' };

    // Remove from local list immediately
    this.dismissInvitation(invitationId);

    try {
      const res = await fetch('/api/invitations/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId, receiverId, action }),
      });
      const data = await res.json();
      if (!data.success) {
        this.showToast(data.message || 'Invitation failed', 'warning');
      }
      return data;
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error' };
    }
  }

  public dismissInvitation(invitationId: string): void {
    this.state = {
      ...this.state,
      activeInvitations: this.state.activeInvitations.filter((i) => i.invitationId !== invitationId),
    };
    this.notify();
  }

  private pruneExpiredInvitations(): void {
    const now = Date.now();
    const valid = this.state.activeInvitations.filter((i) => now <= i.expiresAt);
    if (valid.length !== this.state.activeInvitations.length) {
      this.state = { ...this.state, activeInvitations: valid };
      this.notify();
    }
  }
}

export const friendService = new FriendService();
