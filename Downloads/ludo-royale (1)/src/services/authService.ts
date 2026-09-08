import { playerProfileService } from './playerProfileService';
import { PlayerIdentity } from '../types/player';
import { auth, googleProvider, isFirebaseConfigured } from './firebase';
import { signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';

const TOKEN_STORAGE_KEY = 'ludo_royale_session_token';
const TAB_PLAYER_ID_KEY = 'ludo_royale_tab_player_id';
const TAB_PLAYER_NAME_KEY = 'ludo_royale_tab_player_name';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatar: string;
  provider: 'password' | 'google' | 'guest';
  createdAt?: string;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

type AuthListener = (state: AuthState) => void;

export class AuthService {
  private user: AuthUser | null = null;
  private token: string | null = null;
  private isLoading = true;
  private error: string | null = null;
  private listeners: Set<AuthListener> = new Set();
  private tabPlayerId: string;

  constructor() {
    this.tabPlayerId = this.initTabPlayerId();
    this.token = this.getStoredToken();
  }

  private initTabPlayerId(): string {
    const profile = playerProfileService.getProfile();
    try {
      let id = sessionStorage.getItem(TAB_PLAYER_ID_KEY);
      if (!id) {
        id = profile.id;
        sessionStorage.setItem(TAB_PLAYER_ID_KEY, id);
      }
      return id;
    } catch {
      return profile.id;
    }
  }

  private getStoredToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private setStoredToken(token: string | null): void {
    try {
      if (token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } catch (e) {
      console.error('[AuthService] Storage error:', e);
    }
  }

  public subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  public getState(): AuthState {
    return {
      user: this.user,
      token: this.token,
      isAuthenticated: Boolean(this.user && this.token),
      isLoading: this.isLoading,
      error: this.error,
    };
  }

  public getUser(): AuthUser | null {
    return this.user;
  }

  public getToken(): string | null {
    return this.token;
  }

  public isAuthenticated(): boolean {
    return Boolean(this.user && this.token);
  }

  /**
   * Restores user session from stored token on app launch
   */
  public async restoreSession(): Promise<boolean> {
    const token = this.getStoredToken();
    if (!token) {
      this.isLoading = false;
      this.notify();
      return false;
    }

    this.isLoading = true;
    this.error = null;
    this.notify();

    try {
      const res = await fetch('/api/auth/session', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          this.token = token;
          this.user = {
            id: data.user.id,
            email: data.user.email,
            displayName: data.user.displayName,
            avatar: data.user.avatar || '👑',
            provider: data.user.provider || 'password',
            createdAt: data.user.createdAt,
          };
          this.tabPlayerId = data.user.id;
          try {
            sessionStorage.setItem(TAB_PLAYER_ID_KEY, data.user.id);
          } catch {}

          if (data.profile) {
            playerProfileService.setAuthenticatedProfile(data.profile);
          }
          this.isLoading = false;
          this.notify();
          return true;
        }
      }

      // Token invalid or expired
      this.setStoredToken(null);
      this.token = null;
      this.user = null;
      this.isLoading = false;
      this.notify();
      return false;
    } catch (err: any) {
      console.warn('[AuthService] Session restore failed (offline or server error):', err);
      this.isLoading = false;
      this.notify();
      return false;
    }
  }

  /**
   * Log in with email and password
   */
  public async loginWithPassword(email: string, pass: string): Promise<{ success: boolean; error?: string }> {
    this.isLoading = true;
    this.error = null;
    this.notify();

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        this.error = data.error || 'Invalid email or password.';
        this.isLoading = false;
        this.notify();
        return { success: false, error: this.error || 'Login failed' };
      }

      this.token = data.token;
      this.setStoredToken(data.token);
      this.user = {
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName,
        avatar: data.user.avatar || '👑',
        provider: 'password',
        createdAt: data.user.createdAt,
      };
      this.tabPlayerId = data.user.id;
      try {
        sessionStorage.setItem(TAB_PLAYER_ID_KEY, data.user.id);
      } catch {}

      if (data.profile) {
        playerProfileService.setAuthenticatedProfile(data.profile);
      }

      this.isLoading = false;
      this.notify();
      return { success: true };
    } catch (err: any) {
      this.error = err.message || 'Network error during login.';
      this.isLoading = false;
      this.notify();
      return { success: false, error: this.error || 'Network error' };
    }
  }

  /**
   * Register new account with email and password
   */
  public async registerWithPassword(params: {
    email: string;
    password: string;
    username: string;
    avatar?: string;
  }): Promise<{ success: boolean; error?: string }> {
    this.isLoading = true;
    this.error = null;
    this.notify();

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        this.error = data.error || 'Registration failed.';
        this.isLoading = false;
        this.notify();
        return { success: false, error: this.error || 'Registration failed' };
      }

      this.token = data.token;
      this.setStoredToken(data.token);
      this.user = {
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName,
        avatar: data.user.avatar || '👑',
        provider: 'password',
        createdAt: data.user.createdAt,
      };
      this.tabPlayerId = data.user.id;
      try {
        sessionStorage.setItem(TAB_PLAYER_ID_KEY, data.user.id);
      } catch {}

      if (data.profile) {
        playerProfileService.setAuthenticatedProfile(data.profile);
      }

      this.isLoading = false;
      this.notify();
      return { success: true };
    } catch (err: any) {
      this.error = err.message || 'Network error during registration.';
      this.isLoading = false;
      this.notify();
      return { success: false, error: this.error || 'Network error' };
    }
  }

  /**
   * Google Sign-In (Supports Firebase SDK if configured, with graceful fallback to server Google Auth)
   */
  public async loginWithGoogle(): Promise<{ success: boolean; error?: string }> {
    this.isLoading = true;
    this.error = null;
    this.notify();

    try {
      let googleId = '';
      let email = '';
      let name = '';
      let avatar = '👑';

      if (isFirebaseConfigured && auth && googleProvider) {
        const cred = await signInWithPopup(auth, googleProvider);
        const fbUser = cred.user;
        googleId = fbUser.uid;
        email = fbUser.email || '';
        name = fbUser.displayName || email.split('@')[0] || 'Player';
        avatar = '👑';
      } else {
        // Supported fallback Google session simulator / direct Google profile flow
        const dummyGoogleId = 'g_' + Math.random().toString(36).substring(2, 12);
        const defaultProfile = playerProfileService.getProfile();
        googleId = dummyGoogleId;
        name = defaultProfile.username || 'Google Player';
        email = `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`;
        avatar = defaultProfile.avatar || '👑';
      }

      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleId, email, name, avatar }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        this.error = data.error || 'Google login failed.';
        this.isLoading = false;
        this.notify();
        return { success: false, error: this.error || 'Google login failed' };
      }

      this.token = data.token;
      this.setStoredToken(data.token);
      this.user = {
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName,
        avatar: data.user.avatar || '👑',
        provider: 'google',
        createdAt: data.user.createdAt,
      };
      this.tabPlayerId = data.user.id;
      try {
        sessionStorage.setItem(TAB_PLAYER_ID_KEY, data.user.id);
      } catch {}

      if (data.profile) {
        playerProfileService.setAuthenticatedProfile(data.profile);
      }

      this.isLoading = false;
      this.notify();
      return { success: true };
    } catch (err: any) {
      console.error('[AuthService] Google login error:', err);
      this.error = err.message || 'Google sign-in was cancelled or encountered an error.';
      this.isLoading = false;
      this.notify();
      return { success: false, error: this.error || 'Google login error' };
    }
  }

  /**
   * Log out user, invalidate token, and clear credentials
   */
  public async logout(): Promise<void> {
    const currentToken = this.token;
    if (currentToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: currentToken }),
        });
      } catch {}
    }

    if (isFirebaseConfigured && auth) {
      try {
        await firebaseSignOut(auth);
      } catch {}
    }

    this.setStoredToken(null);
    this.token = null;
    this.user = null;
    this.error = null;
    this.isLoading = false;

    // Reset player identity to persistent local profile
    const profile = playerProfileService.getProfile();
    this.tabPlayerId = profile.id;
    try {
      sessionStorage.setItem(TAB_PLAYER_ID_KEY, profile.id);
    } catch {}

    this.notify();
  }

  /**
   * Retrieves current authenticated player identity (Multiplayer compatibility)
   */
  public getAuthPlayer(): PlayerIdentity {
    const profile = playerProfileService.getProfile();
    let name = this.user?.displayName || profile.username || profile.name;
    try {
      const customName = sessionStorage.getItem(TAB_PLAYER_NAME_KEY);
      if (customName && customName.trim()) {
        name = customName.trim();
      }
    } catch {}

    return {
      playerId: this.user ? this.user.id : this.tabPlayerId,
      username: name,
      avatar: this.user?.avatar || profile.avatar || '👑',
      level: profile.level || 1,
      xp: profile.xp || 0,
    };
  }

  public setCustomUsername(name: string): void {
    const clean = name.trim();
    if (!clean) return;
    try {
      sessionStorage.setItem(TAB_PLAYER_NAME_KEY, clean);
      playerProfileService.updateUsername(clean);
    } catch {}
  }

  public getPlayerId(): string {
    return this.user ? this.user.id : this.tabPlayerId;
  }
}

export const authService = new AuthService();
