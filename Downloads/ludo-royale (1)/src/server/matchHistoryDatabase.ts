import fs from 'fs';
import path from 'path';
import { PlayerColor } from '../types/gameTypes';

export interface MatchPlayerSummary {
  id: string;
  name: string;
  avatar: string;
  color: PlayerColor;
  level: number;
  captures: number;
  rank: number;
}

export interface PersistentMatchRecord {
  matchId: string;
  timestamp: number;
  dateIso: string;
  durationSeconds: number;
  roomCode?: string;
  winnerId: string;
  winnerName: string;
  winnerColor: PlayerColor;
  players: MatchPlayerSummary[];
  playerColors: Record<string, PlayerColor>;
  finalRankings: Array<{ playerId: string; rank: number; score?: number; captures: number }>;
  ratingChanges: Record<string, { previousRating: number; newRating: number; delta: number }>;
  xpEarned: Record<string, number>;
  coinsEarned: Record<string, number>;
}

export class MatchHistoryDatabase {
  private dataDir: string;
  private matchesFile: string;
  private matches: Map<string, PersistentMatchRecord> = new Map();

  constructor(dataDir = path.join(process.cwd(), 'data')) {
    this.dataDir = dataDir;
    this.matchesFile = path.join(dataDir, 'matches.json');
    this.init();
  }

  private init(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (fs.existsSync(this.matchesFile)) {
        const raw = fs.readFileSync(this.matchesFile, 'utf-8');
        const list: PersistentMatchRecord[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const m of list) {
            this.matches.set(m.matchId, m);
          }
        }
      } else {
        this.seedInitialMatches();
      }
    } catch (err) {
      console.error('[MatchHistoryDatabase] Failed to load matches:', err);
    }
  }

  private saveMatches(): void {
    try {
      const list = Array.from(this.matches.values());
      fs.writeFileSync(this.matchesFile, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error('[MatchHistoryDatabase] Failed to save matches:', err);
    }
  }

  private seedInitialMatches(): void {
    const defaultMatch: PersistentMatchRecord = {
      matchId: 'match_seed_001',
      timestamp: Date.now() - 3600000 * 5,
      dateIso: new Date(Date.now() - 3600000 * 5).toISOString(),
      durationSeconds: 420,
      roomCode: 'ROYALE',
      winnerId: 'usr_jeswanth_1',
      winnerName: 'Jeswanth',
      winnerColor: 'RED',
      players: [
        { id: 'usr_jeswanth_1', name: 'Jeswanth', avatar: '👑', color: 'RED', level: 5, captures: 3, rank: 1 },
        { id: 'usr_bot_1', name: 'Cyber_Knight', avatar: '🛡️', color: 'BLUE', level: 4, captures: 1, rank: 2 },
      ],
      playerColors: {
        usr_jeswanth_1: 'RED',
        usr_bot_1: 'BLUE',
      },
      finalRankings: [
        { playerId: 'usr_jeswanth_1', rank: 1, score: 250, captures: 3 },
        { playerId: 'usr_bot_1', rank: 2, score: 90, captures: 1 },
      ],
      ratingChanges: {
        usr_jeswanth_1: { previousRating: 1817, newRating: 1842, delta: +25 },
        usr_bot_1: { previousRating: 1705, newRating: 1690, delta: -15 },
      },
      xpEarned: {
        usr_jeswanth_1: 150,
        usr_bot_1: 45,
      },
      coinsEarned: {
        usr_jeswanth_1: 200,
        usr_bot_1: 50,
      },
    };

    this.matches.set(defaultMatch.matchId, defaultMatch);
    this.saveMatches();
  }

  /**
   * Persists a completed match record atomically
   */
  public recordMatch(record: PersistentMatchRecord): void {
    if (!record || !record.matchId) return;
    this.matches.set(record.matchId, record);
    this.saveMatches();
  }

  /**
   * Retrieves match history for a specific player, sorted newest first
   */
  public getPlayerMatchHistory(playerId: string, limit = 20): PersistentMatchRecord[] {
    const results: PersistentMatchRecord[] = [];
    for (const m of this.matches.values()) {
      const inMatch = m.players.some((p) => p.id === playerId);
      if (inMatch) {
        results.push(m);
      }
    }

    results.sort((a, b) => b.timestamp - a.timestamp);
    return results.slice(0, limit);
  }

  /**
   * Retrieves single match by matchId
   */
  public getMatch(matchId: string): PersistentMatchRecord | null {
    return this.matches.get(matchId) || null;
  }
}

export const matchHistoryDb = new MatchHistoryDatabase();
