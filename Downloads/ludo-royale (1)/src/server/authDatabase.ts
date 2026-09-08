import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { playerDb, PlayerProfile } from './playerDatabase';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatar: string;
  provider: 'local' | 'google';
  passwordHash?: string;
  salt?: string;
  googleId?: string;
  createdAt: string;
  lastLoginAt: string;
}

export interface SafeUser {
  id: string;
  email: string;
  displayName: string;
  avatar: string;
  provider: 'local' | 'google';
  createdAt: string;
  lastLoginAt: string;
}

export interface AuthSession {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number; // ms timestamp
}

export interface AuthResult {
  success: boolean;
  user?: SafeUser;
  token?: string;
  profile?: PlayerProfile;
  error?: string;
}

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export class AuthDatabase {
  private dataDir: string;
  private usersFile: string;
  private sessionsFile: string;

  private users: Map<string, AuthUser> = new Map(); // key: userId
  private usersByEmail: Map<string, string> = new Map(); // key: lowercased email -> userId
  private sessions: Map<string, AuthSession> = new Map(); // key: token

  constructor(dataDir = path.join(process.cwd(), 'data')) {
    this.dataDir = dataDir;
    this.usersFile = path.join(dataDir, 'users.json');
    this.sessionsFile = path.join(dataDir, 'sessions.json');
    this.init();

    // Clean up expired sessions periodically every hour
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 60 * 1000);
  }

  private init(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      // 1. Load users
      if (fs.existsSync(this.usersFile)) {
        const raw = fs.readFileSync(this.usersFile, 'utf-8');
        const list: AuthUser[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const u of list) {
            this.users.set(u.id, u);
            this.usersByEmail.set(u.email.toLowerCase(), u.id);
          }
        }
      }

      // 2. Load sessions
      if (fs.existsSync(this.sessionsFile)) {
        const raw = fs.readFileSync(this.sessionsFile, 'utf-8');
        const list: AuthSession[] = JSON.parse(raw);
        const now = Date.now();
        if (Array.isArray(list)) {
          for (const s of list) {
            if (s.expiresAt > now) {
              this.sessions.set(s.token, s);
            }
          }
        }
      }

      // Seed initial default accounts if empty
      if (this.users.size === 0) {
        this.seedInitialUsers();
      }
    } catch (err) {
      console.error('[AuthDatabase] Error during initialization:', err);
    }
  }

  private saveUsers(): void {
    try {
      const list = Array.from(this.users.values());
      fs.writeFileSync(this.usersFile, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error('[AuthDatabase] Failed to write users file:', err);
    }
  }

  private saveSessions(): void {
    try {
      const list = Array.from(this.sessions.values());
      fs.writeFileSync(this.sessionsFile, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error('[AuthDatabase] Failed to write sessions file:', err);
    }
  }

  private seedInitialUsers(): void {
    // Seed default player Jeswanth for local development demo
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = crypto.scryptSync('password123', salt, 64).toString('hex');
    const user: AuthUser = {
      id: 'usr_jeswanth_1',
      email: 'jeswanth@ludoroyale.com',
      displayName: 'Jeswanth',
      avatar: '👑',
      provider: 'local',
      passwordHash,
      salt,
      createdAt: '2026-01-15T00:00:00.000Z',
      lastLoginAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    this.usersByEmail.set(user.email.toLowerCase(), user.id);
    this.saveUsers();
  }

  /**
   * Cryptographically safe password hash comparison
   */
  private verifyPassword(password: string, salt: string, expectedHash: string): boolean {
    try {
      const hash = crypto.scryptSync(password, salt, 64).toString('hex');
      const hashBuffer = Buffer.from(hash, 'hex');
      const expectedBuffer = Buffer.from(expectedHash, 'hex');
      if (hashBuffer.length !== expectedBuffer.length) {
        return false;
      }
      return crypto.timingSafeEqual(hashBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Strips sensitive authentication fields before sending to client
   */
  private toSafeUser(user: AuthUser): SafeUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatar: user.avatar,
      provider: user.provider,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  /**
   * Generates a secure session token and persists it
   */
  private createSession(userId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const session: AuthSession = {
      token,
      userId,
      createdAt: now,
      expiresAt: now + SESSION_DURATION_MS,
    };
    this.sessions.set(token, session);
    this.saveSessions();
    return token;
  }

  /**
   * Register a new user with email and password
   */
  public register(params: {
    email: string;
    password: string;
    displayName: string;
    avatar?: string;
  }): AuthResult {
    const email = (params.email || '').trim().toLowerCase();
    const password = params.password || '';
    const displayName = (params.displayName || '').trim() || 'Player';
    const avatar = params.avatar || '👑';

    // Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    if (this.usersByEmail.has(email)) {
      return { success: false, error: 'An account with this email already exists. Please log in.' };
    }

    // Hash password with unique salt
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');

    const userId = `usr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const nowIso = new Date().toISOString();

    const newUser: AuthUser = {
      id: userId,
      email,
      displayName,
      avatar,
      provider: 'local',
      passwordHash,
      salt,
      createdAt: nowIso,
      lastLoginAt: nowIso,
    };

    this.users.set(userId, newUser);
    this.usersByEmail.set(email, userId);
    this.saveUsers();

    // Auto-create initial profile with starting stats
    const profile = playerDb.getOrCreateProfile({
      playerId: userId,
      displayName,
      avatar,
      email,
    });

    const token = this.createSession(userId);

    return {
      success: true,
      user: this.toSafeUser(newUser),
      token,
      profile,
    };
  }

  /**
   * Authenticate user with email and password
   */
  public login(params: { email: string; password: string }): AuthResult {
    const email = (params.email || '').trim().toLowerCase();
    const password = params.password || '';

    if (!email || !password) {
      return { success: false, error: 'Email and password are required.' };
    }

    const userId = this.usersByEmail.get(email);
    if (!userId) {
      return { success: false, error: 'Invalid email or password.' };
    }

    const user = this.users.get(userId);
    if (!user || !user.passwordHash || !user.salt) {
      if (user?.provider === 'google') {
        return { success: false, error: 'This account uses Google Sign-In. Please sign in with Google.' };
      }
      return { success: false, error: 'Invalid credentials.' };
    }

    const isMatch = this.verifyPassword(password, user.salt, user.passwordHash);
    if (!isMatch) {
      return { success: false, error: 'Invalid email or password.' };
    }

    user.lastLoginAt = new Date().toISOString();
    this.saveUsers();

    const profile = playerDb.getOrCreateProfile({
      playerId: user.id,
      displayName: user.displayName,
      avatar: user.avatar,
      email: user.email,
    });

    const token = this.createSession(user.id);

    return {
      success: true,
      user: this.toSafeUser(user),
      token,
      profile,
    };
  }

  /**
   * Google Sign-In / OAuth Identity Linking
   */
  public loginWithGoogle(params: {
    email: string;
    displayName: string;
    avatar?: string;
    googleId?: string;
  }): AuthResult {
    const email = (params.email || '').trim().toLowerCase();
    if (!email) {
      return { success: false, error: 'Google email is required.' };
    }

    const displayName = (params.displayName || '').trim() || 'Google Player';
    const avatar = params.avatar || '👑';
    const googleId = params.googleId || `g_${Date.now()}`;
    const nowIso = new Date().toISOString();

    let user: AuthUser;

    const existingUserId = this.usersByEmail.get(email);
    if (existingUserId && this.users.has(existingUserId)) {
      user = this.users.get(existingUserId)!;
      user.googleId = googleId;
      user.lastLoginAt = nowIso;
      this.saveUsers();
    } else {
      const userId = `usr_g_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      user = {
        id: userId,
        email,
        displayName,
        avatar,
        provider: 'google',
        googleId,
        createdAt: nowIso,
        lastLoginAt: nowIso,
      };
      this.users.set(userId, user);
      this.usersByEmail.set(email, userId);
      this.saveUsers();
    }

    const profile = playerDb.getOrCreateProfile({
      playerId: user.id,
      displayName: user.displayName,
      avatar: user.avatar,
      email: user.email,
    });

    const token = this.createSession(user.id);

    return {
      success: true,
      user: this.toSafeUser(user),
      token,
      profile,
    };
  }

  /**
   * Verifies an active session token and returns the authenticated user & profile
   */
  public verifySession(token: string): { user: SafeUser; profile: PlayerProfile } | null {
    if (!token) return null;

    const session = this.sessions.get(token);
    if (!session) return null;

    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(token);
      this.saveSessions();
      return null;
    }

    const user = this.users.get(session.userId);
    if (!user) {
      this.sessions.delete(token);
      this.saveSessions();
      return null;
    }

    const profile = playerDb.getProfile(user.id) || playerDb.getOrCreateProfile({
      playerId: user.id,
      displayName: user.displayName,
      avatar: user.avatar,
      email: user.email,
    });

    return {
      user: this.toSafeUser(user),
      profile,
    };
  }

  /**
   * Logout user by invalidating session token
   */
  public logout(token: string): boolean {
    if (!token) return false;
    const existed = this.sessions.delete(token);
    if (existed) {
      this.saveSessions();
    }
    return existed;
  }

  /**
   * Cleans up expired session tokens
   */
  public cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [token, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        this.sessions.delete(token);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      this.saveSessions();
    }
  }

  public getUserById(id: string): SafeUser | null {
    const u = this.users.get(id);
    return u ? this.toSafeUser(u) : null;
  }
}

export const authDb = new AuthDatabase();
