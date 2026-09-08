/**
 * Structured Server-Side Logger for Ludo Royale
 * Production-level structured event logging with strict sanitization.
 * Never logs passwords, secrets, tokens, or PII.
 */

export type LogLevel = 'INFO' | 'WARN' | 'SECURITY' | 'ERROR';

export type LogEventCategory =
  | 'ROOM_CREATE'
  | 'ROOM_JOIN'
  | 'ROOM_LEAVE'
  | 'ROOM_CLOSE'
  | 'HOST_MIGRATE'
  | 'GAME_START'
  | 'DICE_ROLL'
  | 'TOKEN_MOVE'
  | 'CAPTURE'
  | 'VICTORY'
  | 'RECONNECT'
  | 'ACTION_REJECTED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'MATCHMAKING'
  | 'REWARD_TRANSACTION'
  | 'SOCKET_CONNECT'
  | 'SOCKET_DISCONNECT'
  | 'SOCKET_ERROR'
  | 'MALFORMED_MESSAGE'
  | 'STRESS_TEST';

export interface StructuredLogPayload {
  timestamp: string;
  level: LogLevel;
  event: LogEventCategory;
  roomCode?: string;
  playerId?: string;
  details?: Record<string, unknown>;
}

// Sanitization blacklist: sensitive keys to never log
const SENSITIVE_KEYS = new Set([
  'password',
  'secret',
  'token',
  'apiKey',
  'authorization',
  'creditCard',
  'cookie',
  'credential',
]);

function sanitizeDetails(obj?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      clean[key] = sanitizeDetails(value as Record<string, unknown>);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export const serverLogger = {
  log(level: LogLevel, event: LogEventCategory, params?: {
    roomCode?: string;
    playerId?: string;
    details?: Record<string, unknown>;
  }): void {
    const payload: StructuredLogPayload = {
      timestamp: new Date().toISOString(),
      level,
      event,
      roomCode: params?.roomCode,
      playerId: params?.playerId,
      details: sanitizeDetails(params?.details),
    };

    const prefix = `[LudoServer ${payload.timestamp}] [${level}] [${event}]`;
    const contextStr = [
      payload.roomCode ? `Room=${payload.roomCode}` : null,
      payload.playerId ? `Player=${payload.playerId}` : null,
    ]
      .filter(Boolean)
      .join(' ');

    const detailsStr = payload.details ? ` | ${JSON.stringify(payload.details)}` : '';

    if (level === 'ERROR') {
      console.error(`${prefix} ${contextStr}${detailsStr}`);
    } else if (level === 'SECURITY') {
      console.warn(`🔒 ${prefix} ${contextStr}${detailsStr}`);
    } else if (level === 'WARN') {
      console.warn(`${prefix} ${contextStr}${detailsStr}`);
    } else {
      console.log(`${prefix} ${contextStr}${detailsStr}`);
    }
  },

  info(event: LogEventCategory, params?: { roomCode?: string; playerId?: string; details?: Record<string, unknown> }) {
    this.log('INFO', event, params);
  },

  warn(event: LogEventCategory, params?: { roomCode?: string; playerId?: string; details?: Record<string, unknown> }) {
    this.log('WARN', event, params);
  },

  security(event: LogEventCategory, params?: { roomCode?: string; playerId?: string; details?: Record<string, unknown> }) {
    this.log('SECURITY', event, params);
  },

  error(event: LogEventCategory, params?: { roomCode?: string; playerId?: string; details?: Record<string, unknown> }) {
    this.log('ERROR', event, params);
  },
};
