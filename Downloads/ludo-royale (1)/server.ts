import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { Room, RoomPlayer, ClientMessage, ServerMessage, RoomState, SynchronizedGameState, ChatMessage } from './src/types/roomTypes';
import { Player, Token, PlayerColor, GameEventNotification } from './src/types/gameTypes';
import { getValidMoves, findCapturableTokens, hasPlayerWon, MAX_POSITION } from './src/game/rules';
import { getGlobalTrackIndex, getAnimatedPath, getBoardCoordinate, SAFE_TRACK_INDICES } from './src/game/board';
import { playerDb, MatchPlayerResult } from './src/server/playerDatabase';
import { matchmakingService } from './src/server/matchmakingService';
import { friendsDb } from './src/server/friendsDatabase';
import { serverLogger } from './src/server/logger';
import { rateLimiter } from './src/server/rateLimiter';
import { runServerStressTest } from './src/server/stressTestEngine';
import { authDb } from './src/server/authDatabase';
import { matchHistoryDb, PersistentMatchRecord } from './src/server/matchHistoryDatabase';
import {
  TOKEN_SKINS_CATALOG,
  BOARD_THEMES_CATALOG,
  BUILTIN_AVATARS,
  CustomizationItem,
  UserGameSettings,
} from './src/types/customizationTypes';

const PORT = 3000;
const ALL_COLORS: PlayerColor[] = ['RED', 'GREEN', 'YELLOW', 'BLUE'];

// Generate 6-character room codes avoiding ambiguous characters (0, O, 1, I)
function generateRoomCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const rooms = new Map<string, Room>();
const clientMeta = new Map<
  WebSocket,
  { roomCode?: string; playerId?: string; authenticatedUserId?: string; sessionToken?: string }
>();
const disconnectTimers = new Map<string, NodeJS.Timeout>(); // key: `${roomCode}_${playerId}`
const roomSockets = new Map<string, Set<WebSocket>>(); // key: roomCode -> Set of active WebSockets

function addSocketToRoom(roomCode: string, ws: WebSocket): void {
  let sockets = roomSockets.get(roomCode);
  if (!sockets) {
    sockets = new Set();
    roomSockets.set(roomCode, sockets);
  }
  sockets.add(ws);
}

function removeSocketFromRoom(roomCode: string, ws: WebSocket): void {
  const sockets = roomSockets.get(roomCode);
  if (sockets) {
    sockets.delete(ws);
    if (sockets.size === 0) {
      roomSockets.delete(roomCode);
    }
  }
}

function removeSocketFromAllRooms(ws: WebSocket): void {
  for (const [code, sockets] of roomSockets.entries()) {
    if (sockets.has(ws)) {
      sockets.delete(ws);
      if (sockets.size === 0) {
        roomSockets.delete(code);
      }
    }
  }
}

function clearRoomDisconnectTimers(roomCode: string): void {
  const prefix = `${roomCode}_`;
  for (const [key, timer] of disconnectTimers.entries()) {
    if (key.startsWith(prefix)) {
      clearTimeout(timer);
      disconnectTimers.delete(key);
    }
  }
}

function getAvailableColor(room: Room): PlayerColor {
  const usedColors = new Set(room.players.map((p) => p.color));
  for (const c of ALL_COLORS) {
    if (!usedColors.has(c)) return c;
  }
  return ALL_COLORS[room.players.length % ALL_COLORS.length];
}

function createRoomPlayer(params: {
  id: string;
  name: string;
  avatar: string;
  color: PlayerColor;
  isHost: boolean;
  isReady?: boolean;
  level?: number;
  xp?: number;
  coins?: number;
}): RoomPlayer {
  // Authoritative persistent profile from database
  const profile = playerDb.getOrCreateProfile({
    playerId: params.id,
    displayName: params.name,
    avatar: params.avatar,
  });

  const cleanName = (profile.displayName || params.name || (params.isHost ? 'Host Player' : 'Player')).trim().substring(0, 20);
  return {
    id: params.id,
    playerId: params.id,
    name: cleanName,
    displayName: cleanName,
    avatar: profile.avatar || params.avatar,
    color: params.color,
    isHost: params.isHost,
    isReady: params.isReady ?? params.isHost,
    isConnected: true,
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
    level: profile.level,
    xp: profile.xp,
    coins: profile.coins,
    tokenSkin: profile.selectedTokenSkin || 'classic',
  };
}

function createRoomObject(code: string, hostPlayer: RoomPlayer): Room {
  const now = Date.now();
  return {
    id: `room_${code}`,
    roomId: `room_${code}`,
    code,
    roomCode: code,
    hostId: hostPlayer.id,
    state: 'WAITING',
    status: 'WAITING',
    maxPlayers: 4,
    minPlayers: 2,
    players: [hostPlayer],
    settings: {
      maxPlayers: 4,
      autoMove: true,
      quickDice: false,
    },
    joinLock: false,
    isActionProcessing: false,
    actionNonce: `${code}_T0_${now.toString(36)}`,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
  };
}

function createInitialTokens(playerIndex: number, color: PlayerColor): Token[] {
  return [0, 1, 2, 3].map((tokenIdx) => ({
    id: playerIndex * 4 + tokenIdx,
    playerIndex,
    color,
    tokenIndex: tokenIdx,
    position: -1, // In Yard (-1)
    globalTrackIndex: -1,
    isYard: true,
    isHome: false,
    stepCount: 0,
  }));
}

function initializeGameState(room: Room): SynchronizedGameState {
  const players: Player[] = room.players.map((rp, idx) => ({
    id: rp.id,
    name: rp.name,
    color: rp.color,
    avatar: rp.avatar,
    tokenSkin: rp.tokenSkin || 'classic',
    isAI: false,
    aiDifficulty: 'MEDIUM',
    tokens: createInitialTokens(idx, rp.color),
    score: 0,
    captures: 0,
    tokensFinished: 0,
    winStreak: 0,
    isActive: true,
  }));

  const allTokens = players.flatMap((p) => p.tokens);

  return {
    matchId: `match_${room.code}_${Date.now()}`,
    matchStartTime: Date.now(),
    status: 'IDLE',
    currentPlayerId: players[0].id,
    currentPlayerIndex: 0,
    currentPlayerColor: players[0].color,
    turnNumber: 1,
    actionNonce: `${room.code}_T1_${Date.now().toString(36)}`,
    diceValue: null,
    diceRolling: false,
    diceRolled: false,
    players,
    tokens: allTokens,
    validMoves: [],
    winner: null,
    winningOrder: [],
    lastActionText: `${players[0].name}'s turn to roll!`,
    consecutiveSixes: 0,
    extraTurnGranted: false,
    animatingTokenId: null,
    movingTokenStep: null,
    activeCaptureAnim: null,
    captureEvent: null,
    updatedAt: Date.now(),
  };
}

function calculateRoomState(room: Room): RoomState {
  if (room.state === 'STARTING' || room.state === 'PLAYING' || room.state === 'FINISHED' || room.state === 'CLOSED') {
    return room.state;
  }

  const activePlayers = room.players.filter((p) => p.isConnected);
  // Need at least 2 players
  if (activePlayers.length < room.minPlayers) {
    return 'WAITING';
  }

  // All non-host players must be ready, and host is ready by default
  const nonHostPlayers = activePlayers.filter((p) => !p.isHost);
  const allReady = nonHostPlayers.length > 0 && nonHostPlayers.every((p) => p.isReady);

  return allReady ? 'READY' : 'WAITING';
}

function sendTo(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcastRoom(room: Room, wss?: WebSocketServer): void {
  room.lastActivityAt = Date.now();
  room.updatedAt = Date.now();
  room.status = room.state;
  room.roomCode = room.code;
  room.roomId = room.id;

  const sockets = roomSockets.get(room.code);
  if (sockets && sockets.size > 0) {
    for (const client of sockets) {
      if (client.readyState === WebSocket.OPEN) {
        const meta = clientMeta.get(client);
        try {
          client.send(
            JSON.stringify({
              type: 'ROOM_STATE',
              room,
              myPlayerId: meta?.playerId,
            })
          );
        } catch {
          // Socket write failed
        }
      } else {
        sockets.delete(client);
      }
    }
  } else if (wss) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        const meta = clientMeta.get(client);
        if (meta && meta.roomCode === room.code) {
          client.send(
            JSON.stringify({
              type: 'ROOM_STATE',
              room,
              myPlayerId: meta.playerId,
            })
          );
        }
      }
    });
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Periodic room expiration & cleanup (every 30 seconds)
  setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms.entries()) {
      // Clean up rooms older than 2 hours
      if (now - room.createdAt > 2 * 60 * 60 * 1000) {
        room.state = 'CLOSED';
        broadcastRoom(room, wss);
        clearRoomDisconnectTimers(code);
        roomSockets.delete(code);
        rooms.delete(code);
        serverLogger.info('ROOM_CLOSE', { roomCode: code, details: { reason: 'Expired >2 hours' } });
        continue;
      }

      // Clean up rooms with 0 players
      if (room.players.length === 0) {
        clearRoomDisconnectTimers(code);
        roomSockets.delete(code);
        rooms.delete(code);
        serverLogger.info('ROOM_CLOSE', { roomCode: code, details: { reason: 'Empty room' } });
        continue;
      }

      // Clean up waiting rooms where all players have been disconnected for > 2 minutes
      if (room.state === 'WAITING' || room.state === 'READY') {
        const allDisconnected = room.players.every((p) => !p.isConnected);
        const oldestDisconnect = Math.min(...room.players.map((p) => p.lastSeenAt));
        if (allDisconnected && now - oldestDisconnect > 2 * 60 * 1000) {
          clearRoomDisconnectTimers(code);
          roomSockets.delete(code);
          rooms.delete(code);
          serverLogger.info('ROOM_CLOSE', { roomCode: code, details: { reason: 'All waiting players disconnected >2min' } });
          continue;
        }
      }

      // Clean up abandoned matches where all players have been disconnected for > 2 minutes
      if (room.state === 'PLAYING' || room.state === 'FINISHED') {
        const allDisconnected = room.players.every((p) => !p.isConnected);
        const oldestDisconnect = Math.min(...room.players.map((p) => p.lastSeenAt));
        if (allDisconnected && now - oldestDisconnect > 2 * 60 * 1000) {
          clearRoomDisconnectTimers(code);
          roomSockets.delete(code);
          rooms.delete(code);
          serverLogger.info('ROOM_CLOSE', { roomCode: code, details: { reason: 'Match abandoned by all players >2min' } });
          continue;
        }
      }
    }
  }, 30000);

  function startRoomCountdown(room: Room) {
    if (room.state === 'STARTING' || room.state === 'PLAYING' || room.state === 'CLOSED') {
      return;
    }

    room.state = 'STARTING';
    room.countdown = 3;
    room.lastActivityAt = Date.now();
    serverLogger.info('GAME_START', { roomCode: room.code, details: { stage: 'COUNTDOWN_STARTED', players: room.players.length } });
    broadcastRoom(room, wss);

    const countdownInterval = setInterval(() => {
      if (!rooms.has(room.code)) {
        clearInterval(countdownInterval);
        return;
      }

      // Abort countdown if active players drop below minPlayers
      const connectedCount = room.players.filter((p) => p.isConnected).length;
      if (connectedCount < room.minPlayers) {
        clearInterval(countdownInterval);
        room.state = 'WAITING';
        room.status = 'WAITING';
        room.countdown = undefined;
        room.lastActivityAt = Date.now();
        broadcastRoom(room, wss);
        broadcastSystemMessage(room, 'Match countdown cancelled: not enough active players in room.', wss);
        return;
      }

      if (room.countdown && room.countdown > 1) {
        room.countdown -= 1;
        room.lastActivityAt = Date.now();
        broadcastRoom(room, wss);
      } else {
        clearInterval(countdownInterval);
        room.state = 'PLAYING';
        room.status = 'PLAYING';
        room.countdown = undefined;
        room.startedAt = Date.now();
        room.lastActivityAt = Date.now();
        if (!room.gameState) {
          room.gameState = initializeGameState(room);
        }
        serverLogger.info('GAME_START', { roomCode: room.code, details: { stage: 'MATCH_STARTED', matchId: room.gameState.matchId } });
        broadcastRoom(room, wss);

        // Broadcast GAME_STARTED event
        const gameStartedMsg = JSON.stringify({ type: 'GAME_STARTED', room });
        const sockets = roomSockets.get(room.code);
        if (sockets && sockets.size > 0) {
          for (const client of sockets) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(gameStartedMsg);
            }
          }
        } else {
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              const meta = clientMeta.get(client);
              if (meta && meta.roomCode === room.code) {
                client.send(gameStartedMsg);
              }
            }
          });
        }
      }
    }, 1000);
  }

  // Initialize Matchmaking Service with server context
  matchmakingService.setContext({
    rooms,
    clientMeta,
    createRoomPlayer,
    createRoomObject,
    generateRoomCode,
    broadcastRoom: (room) => broadcastRoom(room, wss),
    startRoomCountdown: (room) => startRoomCountdown(room),
    addSocketToRoom: (code, ws) => addSocketToRoom(code, ws),
  });

  // REST API Endpoints (Parity with WebSockets for maximum resilience)
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', roomsCount: rooms.size });
  });

  app.get('/api/matchmaking/status', (req, res) => {
    res.json({ inQueue: matchmakingService.getQueueSize() });
  });

  app.post('/api/matchmaking/cancel', (req, res) => {
    const { playerId } = req.body;
    if (playerId) {
      matchmakingService.cancelQueue(playerId);
      serverLogger.info('MATCHMAKING', { playerId, details: { action: 'CANCEL_QUEUE' } });
    }
    res.json({ success: true });
  });

  // Development-Only Stress Test Route (Never enabled in production)
  if (process.env.NODE_ENV !== 'production') {
    app.post('/api/dev/stress-test', async (req, res) => {
      try {
        const { scenario } = req.body;
        const result = await runServerStressTest(scenario);
        res.json(result);
      } catch (err: any) {
        res.status(500).json({ error: err.message || 'Stress test failed' });
      }
    });
  }

  app.get('/api/rooms/:code', (req, res) => {
    const code = (req.params.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json({
      code: room.code,
      state: room.state,
      playerCount: room.players.length,
      maxPlayers: room.maxPlayers,
    });
  });

  app.get('/api/rooms/:code/state', (req, res) => {
    const code = (req.params.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    const { playerId } = req.query;
    if (playerId && typeof playerId === 'string') {
      const player = room.players.find((p) => p.id === playerId);
      if (player) {
        player.lastSeenAt = Date.now();
        player.isConnected = true;
      }
    }
    res.json({ room });
  });

  app.post('/api/rooms/create', (req, res) => {
    const { playerId, playerName, playerAvatar, level, xp } = req.body;
    if (!playerId) {
      return res.status(400).json({ error: 'Missing playerId' });
    }

    const rateCheck = rateLimiter.roomOps.check(playerId);
    if (!rateCheck.allowed) {
      return res.status(429).json({ error: rateCheck.reason || 'Too many room operations. Please slow down.' });
    }

    let code = generateRoomCode();
    while (rooms.has(code)) {
      code = generateRoomCode();
    }

    const hostPlayer = createRoomPlayer({
      id: playerId,
      name: playerName || 'Host Player',
      avatar: playerAvatar || '👑',
      color: 'RED',
      isHost: true,
      isReady: true,
      level,
      xp,
    });

    const newRoom = createRoomObject(code, hostPlayer);
    rooms.set(code, newRoom);
    serverLogger.info('ROOM_CREATE', { roomCode: code, playerId });
    broadcastRoom(newRoom, wss);
    res.json({ room: newRoom, myPlayerId: playerId });
  });

  app.post('/api/rooms/join', (req, res) => {
    const { roomCode, playerId, playerName, playerAvatar, level, xp } = req.body;
    if (!playerId) {
      return res.status(400).json({ error: 'Missing playerId' });
    }

    const rateCheck = rateLimiter.roomOps.check(playerId);
    if (!rateCheck.allowed) {
      return res.status(429).json({ error: rateCheck.reason || 'Too many room operations. Please slow down.' });
    }

    const code = (roomCode || '').trim().toUpperCase();
    if (!code || code.length !== 6) {
      return res.status(400).json({ error: 'Invalid room code. Please enter a 6-character code.' });
    }

    const room = rooms.get(code);
    if (!room) {
      return res.status(404).json({ error: `Room "${code}" not found. Check code and try again.` });
    }

    if (room.state === 'PLAYING' || room.state === 'FINISHED') {
      return res.status(400).json({ error: 'This game has already started.' });
    }

    if (room.state === 'CLOSED') {
      return res.status(400).json({ error: 'This room is closed.' });
    }

    const existingPlayer = room.players.find((p) => p.id === playerId);
    if (existingPlayer) {
      const timerKey = `${code}_${playerId}`;
      if (disconnectTimers.has(timerKey)) {
        clearTimeout(disconnectTimers.get(timerKey)!);
        disconnectTimers.delete(timerKey);
      }
      existingPlayer.isConnected = true;
      existingPlayer.name = (playerName || existingPlayer.name).trim().substring(0, 20);
      existingPlayer.displayName = existingPlayer.name;
      existingPlayer.avatar = playerAvatar || existingPlayer.avatar;
      existingPlayer.lastSeenAt = Date.now();
      if (typeof level === 'number') existingPlayer.level = level;
      if (typeof xp === 'number') existingPlayer.xp = xp;

      room.state = calculateRoomState(room);
      room.status = room.state;
      room.updatedAt = Date.now();
      broadcastRoom(room, wss);
      return res.json({ room, myPlayerId: playerId });
    }

    if (room.players.length >= room.maxPlayers) {
      return res.status(400).json({ error: 'Room is full (Maximum 4 players).' });
    }

    const requestedColor = req.body.color as PlayerColor;
    const usedColors = new Set(room.players.map((p) => p.color));
    const assignedColor = requestedColor && !usedColors.has(requestedColor) ? requestedColor : getAvailableColor(room);

    const newPlayer = createRoomPlayer({
      id: playerId,
      name: playerName || `Player ${room.players.length + 1}`,
      avatar: playerAvatar || '⚡',
      color: assignedColor,
      isHost: false,
      isReady: false,
      level,
      xp,
    });

    room.players.push(newPlayer);
    serverLogger.info('ROOM_JOIN', { roomCode: code, playerId });
    room.state = calculateRoomState(room);
    room.status = room.state;
    room.updatedAt = Date.now();
    broadcastRoom(room, wss);
    res.json({ room, myPlayerId: playerId });
  });

  app.post('/api/rooms/ready', (req, res) => {
    const { roomCode, playerId, isReady } = req.body;
    const code = (roomCode || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (room.state === 'STARTING' || room.state === 'PLAYING' || room.state === 'CLOSED') {
      return res.json({ room });
    }

    const player = room.players.find((p) => p.id === playerId);
    if (player && !player.isHost) {
      player.isReady = !!isReady;
      player.lastSeenAt = Date.now();
      player.isConnected = true;
      room.state = calculateRoomState(room);
      room.status = room.state;
      room.updatedAt = Date.now();
      broadcastRoom(room, wss);
    }
    res.json({ room });
  });

  app.post('/api/rooms/start', (req, res) => {
    const { roomCode, playerId } = req.body;
    const code = (roomCode || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (room.hostId !== playerId) {
      return res.status(403).json({ error: 'Only the room host can start the game.' });
    }

    if (room.state === 'STARTING' || room.state === 'PLAYING') {
      return res.json({ room }); // Already starting/playing, prevent double start
    }

    if (calculateRoomState(room) !== 'READY') {
      return res.status(400).json({ error: 'Cannot start game: All players must be ready and at least 2 players are required.' });
    }

    startRoomCountdown(room);
    res.json({ room });
  });

  app.post('/api/rooms/kick', (req, res) => {
    const { roomCode, hostPlayerId, targetPlayerId } = req.body;
    const code = (roomCode || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (room.hostId !== hostPlayerId) {
      return res.status(403).json({ error: 'Only the room host can remove players.' });
    }

    if (targetPlayerId === room.hostId) {
      return res.status(400).json({ error: 'The host cannot be kicked.' });
    }

    // Notify kicked player if connected
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        const meta = clientMeta.get(client);
        if (meta && meta.roomCode === code && meta.playerId === targetPlayerId) {
          client.send(JSON.stringify({ type: 'ROOM_LEFT', message: 'You were removed from the room by the host.' }));
          clientMeta.set(client, {});
        }
      }
    });

    removePlayerFromRoom(room, targetPlayerId, wss);
    res.json({ success: true, room });
  });

  app.post('/api/rooms/close', (req, res) => {
    const { roomCode, hostPlayerId } = req.body;
    const code = (roomCode || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (room.hostId !== hostPlayerId) {
      return res.status(403).json({ error: 'Only the room host can close the room.' });
    }

    room.state = 'CLOSED';
    room.status = 'CLOSED';
    room.updatedAt = Date.now();

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        const meta = clientMeta.get(client);
        if (meta && meta.roomCode === code) {
          client.send(JSON.stringify({ type: 'ROOM_CLOSED', message: 'The room was closed by the host.' }));
          clientMeta.set(client, {});
        }
      }
    });

    rooms.delete(code);
    res.json({ success: true });
  });

  app.post('/api/rooms/leave', (req, res) => {
    const { roomCode, playerId } = req.body;
    const code = (roomCode || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (room) {
      removePlayerFromRoom(room, playerId, wss);
    }
    res.json({ success: true });
  });

  app.post('/api/rooms/:code/roll', (req, res) => {
    const code = (req.params.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const { playerId, actionNonce } = req.body;
    if (!playerId) return res.status(400).json({ error: 'playerId required' });

    const rateCheck = rateLimiter.actions.check(playerId);
    if (!rateCheck.allowed) {
      return res.status(429).json({ error: rateCheck.reason || 'Actions submitted too quickly.' });
    }

    const result = handleRollDice(room, playerId, wss, actionNonce);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ success: true, room });
  });

  app.post('/api/rooms/:code/move', async (req, res) => {
    const code = (req.params.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const { playerId, tokenId, actionNonce } = req.body;
    if (!playerId || typeof tokenId !== 'number') {
      return res.status(400).json({ error: 'playerId and tokenId required' });
    }

    const rateCheck = rateLimiter.actions.check(playerId);
    if (!rateCheck.allowed) {
      return res.status(429).json({ error: rateCheck.reason || 'Actions submitted too quickly.' });
    }

    const result = await handleMoveToken(room, playerId, tokenId, wss, actionNonce);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ success: true, room });
  });

  app.post('/api/rooms/:code/react', (req, res) => {
    const code = (req.params.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const { playerId, emoji } = req.body;
    if (!playerId || !emoji) return res.status(400).json({ error: 'playerId and emoji required' });
    handleSendReaction(room, playerId, emoji, wss);
    res.json({ success: true });
  });

  app.post('/api/rooms/:code/chat', (req, res) => {
    const code = (req.params.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const { playerId, text, message } = req.body;
    const msgText = message || text;
    if (!playerId || !msgText) return res.status(400).json({ error: 'playerId and message required' });
    const result = handleSendChat(room, playerId, msgText, wss);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ success: true });
  });

  app.get('/api/rooms/:code/messages', (req, res) => {
    const code = (req.params.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json({ messages: room.chatHistory || [] });
  });

  // ==================== AUTHENTICATION REST ENDPOINTS ====================
  app.post('/api/auth/register', (req, res) => {
    const { email, password, username, avatar } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const result = authDb.registerWithPassword({ email, password, username, avatar });
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const profile = playerDb.getOrCreateProfile({
      playerId: result.user!.id,
      displayName: result.user!.displayName,
      avatar: result.user!.avatar,
      email: result.user!.email,
    });
    res.json({
      success: true,
      user: result.user,
      token: result.token,
      profile,
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const result = authDb.loginWithPassword(email, password);
    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }
    const profile = playerDb.getOrCreateProfile({
      playerId: result.user!.id,
      displayName: result.user!.displayName,
      avatar: result.user!.avatar,
      email: result.user!.email,
    });
    res.json({
      success: true,
      user: result.user,
      token: result.token,
      profile,
    });
  });

  app.post('/api/auth/google', (req, res) => {
    const { googleId, email, name, avatar } = req.body;
    if (!googleId || !email) {
      return res.status(400).json({ error: 'Google account details missing.' });
    }
    const result = authDb.loginWithGoogle({ googleId, email, name, avatar });
    const profile = playerDb.getOrCreateProfile({
      playerId: result.user.id,
      displayName: result.user.displayName,
      avatar: result.user.avatar,
      email: result.user.email,
    });
    res.json({
      success: true,
      user: result.user,
      token: result.token,
      profile,
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = req.body.token || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined);
    if (token) {
      authDb.invalidateSession(token);
    }
    res.json({ success: true });
  });

  app.get('/api/auth/session', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = (req.query.token as string) || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined);
    if (!token) {
      return res.status(401).json({ error: 'No session token provided.' });
    }
    const session = authDb.validateSession(token);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }
    const user = authDb.getUserById(session.userId);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }
    const profile = playerDb.getOrCreateProfile({
      playerId: user.id,
      displayName: user.displayName,
      avatar: user.avatar,
      email: user.email,
    });
    res.json({
      success: true,
      user: authDb.sanitizeUser(user),
      profile,
    });
  });

  // Persistent Player Profile REST Endpoints
  app.get('/api/profiles/:playerId', (req, res) => {
    const profile = playerDb.getProfile(req.params.playerId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json({ profile });
  });

  app.post('/api/profiles', (req, res) => {
    const { playerId, displayName, avatar, email } = req.body;
    if (!playerId) {
      return res.status(400).json({ error: 'playerId required' });
    }
    const profile = playerDb.getOrCreateProfile({
      playerId,
      displayName,
      avatar,
      email,
    });
    res.json({ profile });
  });

  app.patch('/api/profiles/:playerId', (req, res) => {
    const { displayName, avatar, selectedTokenSkin, selectedTheme, gameSettings } = req.body;
    const profile = playerDb.updateProfile(req.params.playerId, {
      displayName,
      avatar,
      selectedTokenSkin,
      selectedTheme,
      gameSettings,
    });
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json({ profile });
  });

  // Real Persistent Online Leaderboard Endpoint
  app.get('/api/leaderboard', (req, res) => {
    const category = (req.query.category as any) || 'wins';
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const playerId = (req.query.playerId as string) || undefined;
    const data = playerDb.getLeaderboard(category, limit, playerId);
    res.json(data);
  });

  // Match History REST Endpoint
  app.get('/api/matches/history/:playerId', (req, res) => {
    const playerId = req.params.playerId;
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const history = matchHistoryDb.getPlayerMatchHistory(playerId, limit);
    res.json({ success: true, history });
  });

  // Server-authoritative match reward endpoint for offline/local games with duplicate protection
  app.post('/api/matches/complete', (req, res) => {
    const { matchId, playerId, rank, captures } = req.body;
    if (!matchId || !playerId) {
      return res.status(400).json({ error: 'matchId and playerId required' });
    }
    const outcome = playerDb.processSingleMatchReward({
      matchId,
      playerId,
      rank: typeof rank === 'number' ? rank : 4,
      captures: typeof captures === 'number' ? captures : 0,
    });
    res.json(outcome);
  });

  // ==================== CUSTOMIZATION & STORE REST ENDPOINTS ====================
  app.get('/api/customization/catalog', (_req, res) => {
    res.json({
      success: true,
      tokenSkins: TOKEN_SKINS_CATALOG,
      boardThemes: BOARD_THEMES_CATALOG,
      avatars: BUILTIN_AVATARS,
    });
  });

  app.post('/api/customization/buy', (req, res) => {
    const { playerId, itemId, itemType } = req.body;
    if (!playerId || !itemId || !itemType) {
      return res.status(400).json({ error: 'playerId, itemId, and itemType are required' });
    }

    const result = playerDb.purchaseCustomizationItem(playerId, itemId, itemType);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Reflect purchased cosmetic if player is in waiting room
    for (const room of rooms.values()) {
      if (room.state === 'WAITING' || room.state === 'READY') {
        const p = room.players.find((rp) => rp.id === playerId);
        if (p) {
          if (itemType === 'TOKEN_SKIN') p.tokenSkin = itemId;
          if (itemType === 'AVATAR') p.avatar = itemId;
          p.coins = result.profile?.coins ?? p.coins;
          broadcastRoom(room, wss);
        }
      }
    }

    res.json({
      success: true,
      message: result.message,
      profile: result.profile,
      item: result.item,
    });
  });

  app.post('/api/customization/select', (req, res) => {
    const { playerId, itemType, itemId } = req.body;
    if (!playerId || !itemType || !itemId) {
      return res.status(400).json({ error: 'playerId, itemType, and itemId are required' });
    }

    // Check if player is currently in an active PLAYING game - prevent cosmetic disruption during active gameplay
    for (const room of rooms.values()) {
      if (room.state === 'PLAYING') {
        const inMatch = room.players.some((p) => p.id === playerId);
        if (inMatch) {
          return res.status(400).json({
            error: 'Cannot change customization during an active game. Please finish your match first.',
          });
        }
      }
    }

    const result = playerDb.selectCustomizationItem(playerId, itemType, itemId);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // If player is in a room lobby, reflect updated cosmetic selection
    for (const room of rooms.values()) {
      if (room.state === 'WAITING' || room.state === 'READY') {
        const p = room.players.find((rp) => rp.id === playerId);
        if (p) {
          if (itemType === 'TOKEN_SKIN') p.tokenSkin = itemId;
          if (itemType === 'AVATAR') p.avatar = itemId;
          broadcastRoom(room, wss);
        }
      }
    }

    res.json({
      success: true,
      profile: result.profile,
    });
  });

  // User Game Settings
  app.get('/api/settings', (req, res) => {
    const playerId = req.query.playerId as string;
    if (!playerId) {
      return res.status(400).json({ error: 'playerId query param required' });
    }
    const profile = playerDb.getProfile(playerId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json({ success: true, settings: profile.gameSettings });
  });

  app.post('/api/settings', (req, res) => {
    const { playerId, settings } = req.body;
    if (!playerId || !settings) {
      return res.status(400).json({ error: 'playerId and settings required' });
    }
    const result = playerDb.updateGameSettings(playerId, settings);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  });

  // Room rules settings update endpoint
  app.post('/api/rooms/:code/settings', (req, res) => {
    const code = (req.params.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (room.isMatchmaking) {
      return res.status(400).json({ error: 'Quick Match rules are standardized and cannot be modified.' });
    }

    const { hostPlayerId, settings } = req.body;
    if (room.hostId !== hostPlayerId) {
      return res.status(403).json({ error: 'Only the room host can modify game rules.' });
    }

    if (room.state === 'PLAYING') {
      return res.status(400).json({ error: 'Game rules cannot be modified during an active game.' });
    }

    if (!room.settings) {
      room.settings = { maxPlayers: 4, autoMove: true, quickDice: false };
    }

    if (settings) {
      if (typeof settings.maxPlayers === 'number') {
        const mp = Math.min(4, Math.max(2, Math.floor(settings.maxPlayers)));
        if (mp < room.players.length) {
          return res.status(400).json({
            error: `Cannot set max players to ${mp} because ${room.players.length} players are currently in the room.`,
          });
        }
        room.maxPlayers = mp;
        room.settings.maxPlayers = mp;
      }
      if (typeof settings.autoMove === 'boolean') {
        room.settings.autoMove = settings.autoMove;
      }
      if (typeof settings.quickDice === 'boolean') {
        room.settings.quickDice = settings.quickDice;
      }
    }

    room.state = calculateRoomState(room);
    room.status = room.state;
    room.updatedAt = Date.now();
    broadcastRoom(room, wss);
    res.json({ success: true, room });
  });

  // ==================== FRIENDS & INVITATIONS REST ENDPOINTS ====================
  app.get('/api/friends', (req, res) => {
    const playerId = (req.query.playerId as string) || '';
    if (!playerId) {
      return res.status(400).json({ error: 'playerId query parameter is required' });
    }
    const data = friendsDb.getFriendsData(playerId);
    res.json({ success: true, ...data });
  });

  app.get('/api/players/search', (req, res) => {
    const query = (req.query.query as string) || '';
    const currentUserId = (req.query.currentUserId as string) || '';
    const players = friendsDb.searchPlayers(currentUserId, query);
    res.json({ success: true, players });
  });

  app.post('/api/friends/request', (req, res) => {
    const { requesterId, receiverId } = req.body;
    if (!requesterId || !receiverId) {
      return res.status(400).json({ error: 'requesterId and receiverId are required' });
    }
    const outcome = friendsDb.sendFriendRequest(requesterId, receiverId);
    res.json(outcome);
  });

  app.post('/api/friends/respond', (req, res) => {
    const { userId, friendshipId, action } = req.body;
    if (!userId || !friendshipId || !action) {
      return res.status(400).json({ error: 'userId, friendshipId, and action required' });
    }
    const outcome = friendsDb.respondFriendRequest(userId, friendshipId, action);
    res.json(outcome);
  });

  app.post('/api/friends/remove', (req, res) => {
    const { userId, friendshipId } = req.body;
    if (!userId || !friendshipId) {
      return res.status(400).json({ error: 'userId and friendshipId required' });
    }
    const outcome = friendsDb.removeFriend(userId, friendshipId);
    res.json(outcome);
  });

  app.post('/api/friends/block', (req, res) => {
    const { userId, targetPlayerId, action } = req.body;
    if (!userId || !targetPlayerId) {
      return res.status(400).json({ error: 'userId and targetPlayerId required' });
    }
    const outcome =
      action === 'UNBLOCK'
        ? friendsDb.unblockPlayer(userId, targetPlayerId)
        : friendsDb.blockPlayer(userId, targetPlayerId);
    res.json(outcome);
  });

  app.post('/api/invitations/send', (req, res) => {
    const { senderId, receiverId, roomCode } = req.body;
    if (!senderId || !receiverId || !roomCode) {
      return res.status(400).json({ error: 'senderId, receiverId, and roomCode required' });
    }
    const outcome = friendsDb.createGameInvitation({
      senderId,
      receiverId,
      roomCode: (roomCode || '').trim().toUpperCase(),
      roomsMap: rooms,
    });
    res.json(outcome);
  });

  app.post('/api/invitations/respond', (req, res) => {
    const { invitationId, receiverId, action } = req.body;
    if (!invitationId || !receiverId || !action) {
      return res.status(400).json({ error: 'invitationId, receiverId, and action required' });
    }
    const outcome = friendsDb.respondGameInvitation({
      invitationId,
      receiverId,
      action,
      roomsMap: rooms,
      wss,
      clientMeta,
      broadcastRoom,
      createRoomPlayer,
      calculateRoomState,
    });
    res.json(outcome);
  });

  app.get('/api/invitations/active', (req, res) => {
    const playerId = (req.query.playerId as string) || '';
    if (!playerId) {
      return res.status(400).json({ error: 'playerId query parameter required' });
    }
    const invitations = friendsDb.getActiveInvitations(playerId);
    res.json({ success: true, invitations });
  });

  wss.on('connection', (ws: WebSocket, req) => {
    const clientIp = req.socket?.remoteAddress;
    const meta: { roomCode?: string; playerId?: string; authenticatedUserId?: string; sessionToken?: string } = {};

    try {
      const url = new URL(req.url || '', 'http://localhost');
      const token = url.searchParams.get('token');
      if (token) {
        const session = authDb.validateSession(token);
        if (session) {
          meta.authenticatedUserId = session.userId;
          meta.playerId = session.userId;
          meta.sessionToken = token;
          friendsDb.registerSocket(session.userId, ws);
          const user = authDb.getUserById(session.userId);
          const profile = playerDb.getOrCreateProfile({
            playerId: session.userId,
            displayName: user?.displayName,
            avatar: user?.avatar,
            email: user?.email,
          });
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              sendTo(ws, {
                type: 'AUTHENTICATED',
                user: user ? authDb.sanitizeUser(user) : undefined,
                profile,
              });
            }
          }, 30);
        }
      }
    } catch {
      // Ignored
    }

    clientMeta.set(ws, meta);
    serverLogger.info('SOCKET_CONNECT', { details: { ip: clientIp, authenticated: !!meta.authenticatedUserId } });

    ws.on('message', (rawData: any) => {
      // 1. Message size limit: 16,384 bytes (16KB)
      const byteLength = Buffer.isBuffer(rawData)
        ? rawData.length
        : typeof rawData === 'string'
        ? Buffer.byteLength(rawData, 'utf8')
        : 0;

      if (byteLength > 16384) {
        serverLogger.warn('MALFORMED_MESSAGE', {
          details: { reason: 'Payload exceeds 16KB limit', byteLength },
        });
        sendTo(ws, { type: 'ERROR', message: 'Message payload size limit exceeded (max 16KB).' });
        return;
      }

      // 2. Safe JSON Parse
      let msg: any;
      try {
        const text = rawData.toString();
        msg = JSON.parse(text);
      } catch (err) {
        serverLogger.warn('MALFORMED_MESSAGE', { details: { reason: 'JSON parsing failed' } });
        sendTo(ws, { type: 'ERROR', message: 'Malformed JSON payload.' });
        return;
      }

      // 3. Structural validation
      if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
        serverLogger.warn('MALFORMED_MESSAGE', { details: { reason: 'Message must be an object with string type' } });
        sendTo(ws, { type: 'ERROR', message: 'Invalid message structure.' });
        return;
      }

      handleClientMessage(ws, msg, wss);
    });

    ws.on('close', (code, reason) => {
      matchmakingService.handleDisconnect(ws);
      const meta = clientMeta.get(ws);
      serverLogger.info('SOCKET_DISCONNECT', {
        roomCode: meta?.roomCode,
        playerId: meta?.playerId,
        details: { code, reason: reason ? reason.toString() : '' },
      });
      if (meta && meta.playerId) {
        friendsDb.unregisterSocket(meta.playerId, ws);
      }
      if (meta && meta.roomCode && meta.playerId) {
        handleDisconnect(meta.roomCode, meta.playerId, wss);
      }
      clientMeta.delete(ws);
    });

    ws.on('error', (err) => {
      serverLogger.warn('SOCKET_ERROR', { details: { error: err.message } });
    });
  });

  function handleDisconnect(roomCode: string, playerId: string, wss: WebSocketServer) {
    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find((p) => p.id === playerId);
    if (!player) return;

    player.isConnected = false;
    player.lastSeenAt = Date.now();
    room.state = calculateRoomState(room);
    broadcastRoom(room, wss);
    broadcastSystemMessage(room, `${player.name} disconnected`, wss);

    // Set a 30s grace period for reconnection
    const timerKey = `${roomCode}_${playerId}`;
    if (disconnectTimers.has(timerKey)) {
      clearTimeout(disconnectTimers.get(timerKey)!);
    }

    const timer = setTimeout(() => {
      disconnectTimers.delete(timerKey);
      // If still disconnected after 30s, remove player
      const r = rooms.get(roomCode);
      if (!r) return;
      const p = r.players.find((item) => item.id === playerId);
      if (p && !p.isConnected) {
        removePlayerFromRoom(r, playerId, wss);
      }
    }, 30000);

    disconnectTimers.set(timerKey, timer);
  }

  function removePlayerFromRoom(room: Room, playerId: string, wss: WebSocketServer) {
    const playerIndex = room.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1) return;

    const leavingPlayer = room.players[playerIndex];
    const leavingName = leavingPlayer ? leavingPlayer.name : 'A player';
    const wasHost = leavingPlayer?.isHost;
    room.players.splice(playerIndex, 1);

    broadcastSystemMessage(room, `${leavingName} left the game`, wss);

    if (room.players.length === 0) {
      rooms.delete(room.code);
      return;
    }

    // Reassign host if host left
    if (wasHost && room.players.length > 0) {
      room.players[0].isHost = true;
      room.players[0].isReady = true;
      const oldHost = room.hostId;
      room.hostId = room.players[0].id;
      serverLogger.info('HOST_MIGRATE', { roomCode: room.code, details: { previousHost: oldHost, newHost: room.hostId } });
    }

    // Handle game in progress abandonment
    if (room.state === 'PLAYING' && room.gameState) {
      const gs = room.gameState;
      const gsPlayer = gs.players.find((p) => p.id === playerId);
      if (gsPlayer) {
        gsPlayer.isActive = false;
      }

      const activePlayers = gs.players.filter((p) => p.isActive);
      if (activePlayers.length <= 1 && !gs.winner) {
        const survivor = activePlayers[0] || gs.players[0];
        gs.winner = survivor;
        gs.status = 'GAME_OVER';
        room.state = 'FINISHED';
        room.status = 'FINISHED';
        gs.lastActionText = `👑 ${survivor.name} wins by forfeit! All other players left.`;
        broadcastSystemMessage(room, `${survivor.name} won the game!`, wss);
        broadcastGameEvent(
          room,
          {
            id: `ev_${Date.now()}`,
            type: 'VICTORY',
            title: 'VICTORY BY FORFEIT',
            subtitle: `${survivor.name} wins because opponent left the match!`,
            color: survivor.color,
            icon: '👑',
            timestamp: Date.now(),
          },
          wss
        );

        // Server-authoritative match reward on forfeit
        const forfeitResults: MatchPlayerResult[] = [
          { playerId: survivor.id, rank: 1, captures: survivor.captures },
          ...gs.players
            .filter((p) => p.id !== survivor.id)
            .map((p, idx) => ({
              playerId: p.id,
              rank: idx + 2,
              captures: p.captures,
            })),
        ];
        const rewardOutcomes = playerDb.processMatchRewards(gs.matchId, forfeitResults);

        // Record persistent match history
        const ratingChanges: Record<string, { previousRating: number; newRating: number; delta: number }> = {};
        const xpEarned: Record<string, number> = {};
        const coinsEarned: Record<string, number> = {};
        for (const [pId, rew] of Object.entries(rewardOutcomes)) {
          ratingChanges[pId] = {
            previousRating: rew.newRating - rew.ratingDelta,
            newRating: rew.newRating,
            delta: rew.ratingDelta,
          };
          xpEarned[pId] = rew.xpEarned;
          coinsEarned[pId] = rew.coinsEarned;
        }

        matchHistoryDb.recordMatch({
          matchId: gs.matchId,
          timestamp: Date.now(),
          dateIso: new Date().toISOString(),
          durationSeconds: Math.max(1, Math.round((Date.now() - (room.startedAt || Date.now())) / 1000)),
          roomCode: room.code,
          winnerId: survivor.id,
          winnerName: survivor.name,
          winnerColor: survivor.color,
          players: gs.players.map((p) => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            color: p.color,
            level: p.level || 1,
            captures: p.captures,
            rank: p.id === survivor.id ? 1 : 2,
          })),
          playerColors: Object.fromEntries(gs.players.map((p) => [p.id, p.color])),
          finalRankings: forfeitResults.map((r) => ({
            playerId: r.playerId,
            rank: r.rank,
            captures: r.captures,
          })),
          ratingChanges,
          xpEarned,
          coinsEarned,
        });

        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            const meta = clientMeta.get(client);
            if (meta && meta.roomCode === room.code) {
              const userReward = meta.playerId ? rewardOutcomes[meta.playerId] : undefined;
              client.send(
                JSON.stringify({
                  type: 'MATCH_REWARDS',
                  matchId: gs.matchId,
                  rewards: rewardOutcomes,
                  profile: userReward?.profile,
                })
              );
            }
          }
        });
      } else if (gs.currentPlayerId === playerId) {
        room.isActionProcessing = false;
        advanceServerTurn(room, wss);
      }
    } else {
      room.state = calculateRoomState(room);
    }

    broadcastRoom(room, wss);
  }

  function handleClientMessage(ws: WebSocket, msg: ClientMessage, wss: WebSocketServer) {
    const existingMeta = clientMeta.get(ws) || {};
    const anyMsg = msg as any;

    // Check for inline session token in message payload
    if (anyMsg.token && typeof anyMsg.token === 'string') {
      const session = authDb.validateSession(anyMsg.token);
      if (session) {
        existingMeta.authenticatedUserId = session.userId;
        existingMeta.playerId = session.userId;
        existingMeta.sessionToken = anyMsg.token;
        friendsDb.registerSocket(session.userId, ws);
      }
    }

    if ('playerId' in msg && typeof msg.playerId === 'string' && msg.playerId) {
      if (existingMeta.authenticatedUserId && existingMeta.authenticatedUserId !== msg.playerId) {
        serverLogger.security('ACTION_REJECTED', {
          roomCode: existingMeta.roomCode,
          playerId: existingMeta.playerId,
          details: {
            reason: 'Authenticated user spoofing attempt',
            claimedId: msg.playerId,
            authenticatedId: existingMeta.authenticatedUserId,
            action: msg.type,
          },
        });
        sendTo(ws, {
          type: 'ACTION_REJECTED',
          action: msg.type,
          reason: 'Unauthorized: cannot act as another player on an authenticated connection.',
        });
        return;
      }

      if (existingMeta.playerId && existingMeta.playerId !== msg.playerId) {
        serverLogger.security('ACTION_REJECTED', {
          roomCode: existingMeta.roomCode,
          playerId: existingMeta.playerId,
          details: { reason: 'Identity spoofing attempt', claimedId: msg.playerId, socketId: existingMeta.playerId, action: msg.type },
        });
        sendTo(ws, { type: 'ACTION_REJECTED', action: msg.type, reason: 'Identity validation failed: socket player ID mismatch.' });
        return;
      }
      friendsDb.registerSocket(msg.playerId, ws);
      clientMeta.set(ws, { ...existingMeta, playerId: msg.playerId });
    }

    switch (msg.type) {
      case 'PING': {
        sendTo(ws, { type: 'PONG' });
        break;
      }

      case 'AUTHENTICATE': {
        const token = anyMsg.token;
        if (!token) {
          sendTo(ws, { type: 'ERROR', message: 'No authentication token provided.' });
          break;
        }
        const session = authDb.validateSession(token);
        if (!session) {
          sendTo(ws, { type: 'ERROR', message: 'Invalid or expired session token.' });
          break;
        }
        const user = authDb.getUserById(session.userId);
        const profile = playerDb.getOrCreateProfile({
          playerId: session.userId,
          displayName: user?.displayName,
          avatar: user?.avatar,
          email: user?.email,
        });
        existingMeta.authenticatedUserId = session.userId;
        existingMeta.playerId = session.userId;
        existingMeta.sessionToken = token;
        clientMeta.set(ws, existingMeta);
        friendsDb.registerSocket(session.userId, ws);
        sendTo(ws, {
          type: 'AUTHENTICATED',
          user: user ? authDb.sanitizeUser(user) : undefined,
          profile,
        });
        break;
      }

      case 'IDENTIFY': {
        const anyMsg = msg as any;
        friendsDb.registerSocket(msg.playerId, ws);
        const meta = clientMeta.get(ws) || {};
        clientMeta.set(ws, { ...meta, playerId: msg.playerId });
        const name = anyMsg.displayName || anyMsg.username || anyMsg.playerName || anyMsg.name || 'Player';
        playerDb.getOrCreateProfile({
          playerId: msg.playerId,
          displayName: name,
          avatar: anyMsg.avatar || anyMsg.playerAvatar || '👑',
        });
        break;
      }

      case 'SEND_FRIEND_REQUEST': {
        friendsDb.registerSocket(msg.requesterId, ws);
        const res = friendsDb.sendFriendRequest(msg.requesterId, msg.receiverId);
        if (!res.success) {
          sendTo(ws, { type: 'ERROR', message: res.message });
        }
        break;
      }

      case 'RESPOND_FRIEND_REQUEST': {
        friendsDb.registerSocket(msg.userId, ws);
        const res = friendsDb.respondFriendRequest(msg.userId, msg.friendshipId, msg.action);
        if (!res.success) {
          sendTo(ws, { type: 'ERROR', message: res.message });
        }
        break;
      }

      case 'REMOVE_FRIEND': {
        friendsDb.registerSocket(msg.userId, ws);
        const res = friendsDb.removeFriend(msg.userId, msg.friendshipId);
        if (!res.success) {
          sendTo(ws, { type: 'ERROR', message: res.message });
        }
        break;
      }

      case 'BLOCK_PLAYER': {
        friendsDb.registerSocket(msg.userId, ws);
        const res = friendsDb.blockPlayer(msg.userId, msg.targetPlayerId);
        if (!res.success) {
          sendTo(ws, { type: 'ERROR', message: res.message });
        }
        break;
      }

      case 'UNBLOCK_PLAYER': {
        friendsDb.registerSocket(msg.userId, ws);
        const res = friendsDb.unblockPlayer(msg.userId, msg.targetPlayerId);
        if (!res.success) {
          sendTo(ws, { type: 'ERROR', message: res.message });
        }
        break;
      }

      case 'SEND_GAME_INVITE': {
        friendsDb.registerSocket(msg.senderId, ws);
        const res = friendsDb.createGameInvitation({
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          roomCode: msg.roomCode,
          roomsMap: rooms,
        });
        sendTo(ws, {
          type: 'GAME_INVITE_RESPONSE',
          invitationId: res.invitation?.invitationId || '',
          status: res.success ? 'PENDING' : 'FAILED',
          message: res.message,
        });
        break;
      }

      case 'RESPOND_GAME_INVITE': {
        friendsDb.registerSocket(msg.receiverId, ws);
        const res = friendsDb.respondGameInvitation({
          invitationId: msg.invitationId,
          receiverId: msg.receiverId,
          action: msg.action,
          roomsMap: rooms,
          wss,
          clientMeta,
          broadcastRoom,
          createRoomPlayer,
          calculateRoomState,
        });
        if (!res.success) {
          sendTo(ws, { type: 'ERROR', message: res.message });
        }
        break;
      }

      case 'ENTER_MATCHMAKING': {
        matchmakingService.enterQueue({
          playerId: msg.playerId,
          displayName: msg.playerName,
          avatar: msg.playerAvatar,
          level: msg.level,
          rating: msg.rating,
          xp: msg.xp,
          coins: msg.coins,
          ws,
        });
        break;
      }

      case 'CANCEL_MATCHMAKING': {
        matchmakingService.cancelQueue(msg.playerId);
        break;
      }

      case 'CREATE_ROOM': {
        const anyMsg = msg as any;
        const meta = clientMeta.get(ws) || {};
        const pId = anyMsg.playerId || meta.playerId || `usr_${Date.now()}`;
        const rateCheck = rateLimiter.roomOps.check(pId);
        if (!rateCheck.allowed) {
          sendTo(ws, { type: 'ERROR', message: rateCheck.reason || 'Too many room operations. Please slow down.' });
          return;
        }

        let code = generateRoomCode();
        while (rooms.has(code)) {
          code = generateRoomCode();
        }

        const hostPlayer = createRoomPlayer({
          id: pId,
          name: anyMsg.playerName || anyMsg.hostName || anyMsg.displayName || 'Host Player',
          avatar: anyMsg.playerAvatar || anyMsg.avatar || '👑',
          color: (anyMsg.color as PlayerColor) || 'RED',
          isHost: true,
          isReady: true,
          level: msg.level,
          xp: msg.xp,
        });

        const newRoom = createRoomObject(code, hostPlayer);
        rooms.set(code, newRoom);
        clientMeta.set(ws, { roomCode: code, playerId: pId });
        addSocketToRoom(code, ws);
        serverLogger.info('ROOM_CREATE', { roomCode: code, playerId: pId });

        sendTo(ws, {
          type: 'ROOM_STATE',
          room: newRoom,
          myPlayerId: pId,
        });
        break;
      }

      case 'JOIN_ROOM': {
        const anyMsg = msg as any;
        const meta = clientMeta.get(ws) || {};
        const pId = anyMsg.playerId || meta.playerId || `usr_${Date.now()}`;
        const rateCheck = rateLimiter.roomOps.check(pId);
        if (!rateCheck.allowed) {
          sendTo(ws, { type: 'ERROR', message: rateCheck.reason || 'Too many room operations. Please slow down.' });
          return;
        }

        const code = (anyMsg.roomCode || anyMsg.code || '').trim().toUpperCase();
        if (!code || code.length !== 6) {
          sendTo(ws, { type: 'ERROR', message: 'Invalid room code. Please enter a 6-character code.' });
          return;
        }

        const room = rooms.get(code);
        if (!room) {
          sendTo(ws, { type: 'ERROR', message: `Room "${code}" not found. Check code and try again.` });
          return;
        }

        if (room.state === 'PLAYING' || room.state === 'FINISHED') {
          sendTo(ws, { type: 'ERROR', message: 'This game has already started.' });
          return;
        }

        if (room.state === 'CLOSED') {
          sendTo(ws, { type: 'ERROR', message: 'This room is closed.' });
          return;
        }

        // Check if player is already in this room (reconnection or duplicate tab)
        const existingPlayer = room.players.find((p) => p.id === pId);
        if (existingPlayer) {
          const timerKey = `${code}_${pId}`;
          if (disconnectTimers.has(timerKey)) {
            clearTimeout(disconnectTimers.get(timerKey)!);
            disconnectTimers.delete(timerKey);
          }

          existingPlayer.isConnected = true;
          existingPlayer.name = (anyMsg.playerName || anyMsg.displayName || existingPlayer.name).trim().substring(0, 20);
          existingPlayer.displayName = existingPlayer.name;
          existingPlayer.avatar = anyMsg.playerAvatar || anyMsg.avatar || existingPlayer.avatar;
          existingPlayer.lastSeenAt = Date.now();
          if (typeof msg.level === 'number') existingPlayer.level = msg.level;
          if (typeof msg.xp === 'number') existingPlayer.xp = msg.xp;

          clientMeta.set(ws, { roomCode: code, playerId: pId });
          addSocketToRoom(code, ws);
          room.state = calculateRoomState(room);
          room.status = room.state;
          room.updatedAt = Date.now();
          broadcastRoom(room, wss);
          broadcastSystemMessage(room, `${existingPlayer.name} reconnected`, wss);
          return;
        }

        if (room.players.length >= room.maxPlayers) {
          sendTo(ws, { type: 'ERROR', message: 'Room is full (Maximum 4 players).' });
          return;
        }

        const requestedColor = anyMsg.color as PlayerColor;
        const usedColors = new Set(room.players.map((p) => p.color));
        const color = requestedColor && !usedColors.has(requestedColor) ? requestedColor : getAvailableColor(room);

        const newPlayer = createRoomPlayer({
          id: pId,
          name: anyMsg.playerName || anyMsg.displayName || `Player ${room.players.length + 1}`,
          avatar: anyMsg.playerAvatar || anyMsg.avatar || '⚡',
          color,
          isHost: false,
          isReady: false,
          level: msg.level,
          xp: msg.xp,
        });

        room.players.push(newPlayer);
        clientMeta.set(ws, { roomCode: code, playerId: pId });
        addSocketToRoom(code, ws);
        serverLogger.info('ROOM_JOIN', { roomCode: code, playerId: pId });
        room.state = calculateRoomState(room);
        room.status = room.state;
        room.updatedAt = Date.now();
        broadcastRoom(room, wss);
        broadcastSystemMessage(room, `${newPlayer.name} joined the room`, wss);
        break;
      }

      case 'RECONNECT': {
        const code = (msg.roomCode || '').trim().toUpperCase();
        const room = rooms.get(code);

        if (!room) {
          sendTo(ws, { type: 'ROOM_LEFT', message: 'Room no longer exists.' });
          return;
        }

        const player = room.players.find((p) => p.id === msg.playerId);
        if (!player) {
          sendTo(ws, { type: 'ROOM_LEFT', message: 'You are no longer in this room.' });
          return;
        }

        const timerKey = `${code}_${msg.playerId}`;
        if (disconnectTimers.has(timerKey)) {
          clearTimeout(disconnectTimers.get(timerKey)!);
          disconnectTimers.delete(timerKey);
        }

        // Refresh authoritative profile on reconnect
        const profile = playerDb.getOrCreateProfile({
          playerId: msg.playerId,
          displayName: msg.playerName,
          avatar: msg.playerAvatar,
        });

        player.isConnected = true;
        player.name = (profile.displayName || msg.playerName || player.name).trim().substring(0, 20);
        player.displayName = player.name;
        player.avatar = profile.avatar || msg.playerAvatar || player.avatar;
        player.level = profile.level;
        player.xp = profile.xp;
        player.coins = profile.coins;
        player.lastSeenAt = Date.now();

        clientMeta.set(ws, { roomCode: code, playerId: msg.playerId });
        addSocketToRoom(code, ws);
        room.state = calculateRoomState(room);
        room.status = room.state;
        room.updatedAt = Date.now();
        serverLogger.info('RECONNECT', { roomCode: code, playerId: msg.playerId });
        sendTo(ws, { type: 'ROOM_STATE', room, myPlayerId: msg.playerId });
        broadcastRoom(room, wss);
        broadcastSystemMessage(room, `${player.name} reconnected`, wss);
        break;
      }

      case 'TOGGLE_READY': {
        const code = (msg.roomCode || '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) return;

        if (room.state === 'STARTING' || room.state === 'PLAYING' || room.state === 'CLOSED') {
          return;
        }

        const player = room.players.find((p) => p.id === msg.playerId);
        if (!player || player.isHost) return; // Host ready status is managed by room readiness

        player.isReady = !!msg.isReady;
        player.isConnected = true;
        player.lastSeenAt = Date.now();
        room.state = calculateRoomState(room);
        room.status = room.state;
        room.updatedAt = Date.now();
        broadcastRoom(room, wss);
        break;
      }

      case 'START_GAME': {
        const code = (msg.roomCode || '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) return;

        if (room.hostId !== msg.playerId) {
          sendTo(ws, { type: 'ERROR', message: 'Only the room host can start the game.' });
          return;
        }

        if (room.state === 'STARTING' || room.state === 'PLAYING') {
          return; // Prevent duplicate trigger
        }

        const calculatedState = calculateRoomState(room);
        if (calculatedState !== 'READY') {
          sendTo(ws, { type: 'ERROR', message: 'Cannot start game: All players must be ready and at least 2 players are required.' });
          return;
        }

        startRoomCountdown(room);
        break;
      }

      case 'UPDATE_ROOM_SETTINGS': {
        const code = (msg.roomCode || '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) {
          sendTo(ws, { type: 'ERROR', message: 'Room not found' });
          return;
        }

        if (room.isMatchmaking) {
          sendTo(ws, { type: 'ERROR', message: 'Quick Match rules are standardized and cannot be modified.' });
          return;
        }

        if (room.hostId !== msg.hostPlayerId) {
          sendTo(ws, { type: 'ERROR', message: 'Only the room host can modify game rules.' });
          return;
        }

        if (room.state === 'PLAYING') {
          sendTo(ws, { type: 'ERROR', message: 'Game rules cannot be changed during an active game.' });
          return;
        }

        if (!room.settings) {
          room.settings = { maxPlayers: 4, autoMove: true, quickDice: false };
        }

        if (msg.settings) {
          if (typeof msg.settings.maxPlayers === 'number') {
            const mp = Math.min(4, Math.max(2, Math.floor(msg.settings.maxPlayers)));
            if (mp < room.players.length) {
              sendTo(ws, {
                type: 'ERROR',
                message: `Cannot set max players to ${mp} because ${room.players.length} players are currently in the room.`,
              });
              return;
            }
            room.maxPlayers = mp;
            room.settings.maxPlayers = mp;
          }
          if (typeof msg.settings.autoMove === 'boolean') {
            room.settings.autoMove = msg.settings.autoMove;
          }
          if (typeof msg.settings.quickDice === 'boolean') {
            room.settings.quickDice = msg.settings.quickDice;
          }
        }

        room.state = calculateRoomState(room);
        room.status = room.state;
        room.updatedAt = Date.now();
        broadcastRoom(room, wss);
        break;
      }

      case 'KICK_PLAYER': {
        const code = (msg.roomCode || '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) return;

        if (room.hostId !== msg.hostPlayerId) {
          sendTo(ws, { type: 'ERROR', message: 'Only the room host can remove players.' });
          return;
        }

        if (msg.targetPlayerId === room.hostId) {
          sendTo(ws, { type: 'ERROR', message: 'The host cannot be removed.' });
          return;
        }

        // Notify kicked player if connected
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            const meta = clientMeta.get(client);
            if (meta && meta.roomCode === code && meta.playerId === msg.targetPlayerId) {
              client.send(JSON.stringify({ type: 'ROOM_LEFT', message: 'You were removed from the room by the host.' }));
              clientMeta.set(client, {});
            }
          }
        });

        removePlayerFromRoom(room, msg.targetPlayerId, wss);
        break;
      }

      case 'CLOSE_ROOM': {
        const code = (msg.roomCode || '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) return;

        if (room.hostId !== msg.hostPlayerId) {
          sendTo(ws, { type: 'ERROR', message: 'Only the room host can close the room.' });
          return;
        }

        room.state = 'CLOSED';
        room.status = 'CLOSED';
        room.updatedAt = Date.now();
        serverLogger.info('ROOM_CLOSE', { roomCode: code, playerId: msg.hostPlayerId });

        const sockets = roomSockets.get(code);
        if (sockets) {
          for (const client of sockets) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'ROOM_CLOSED', message: 'The room was closed by the host.' }));
              clientMeta.set(client, {});
            }
          }
          sockets.clear();
          roomSockets.delete(code);
        } else {
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              const meta = clientMeta.get(client);
              if (meta && meta.roomCode === code) {
                client.send(JSON.stringify({ type: 'ROOM_CLOSED', message: 'The room was closed by the host.' }));
                clientMeta.set(client, {});
              }
            }
          });
        }

        clearRoomDisconnectTimers(code);
        rooms.delete(code);
        break;
      }

      case 'LEAVE_ROOM': {
        const meta = clientMeta.get(ws) || {};
        const code = (msg.roomCode || meta.roomCode || '').trim().toUpperCase();
        const pId = msg.playerId || meta.playerId;
        const room = rooms.get(code);

        removeSocketFromRoom(code, ws);
        if (pId) {
          clientMeta.set(ws, { playerId: pId });
        } else {
          clientMeta.set(ws, {});
        }
        sendTo(ws, { type: 'ROOM_LEFT', message: 'You left the room.' });

        if (!room || !pId) return;
        removePlayerFromRoom(room, pId, wss);
        break;
      }

      case 'ROLL_DICE': {
        const code = (msg.roomCode || '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) {
          sendTo(ws, { type: 'ERROR', message: 'Room not found.' });
          return;
        }

        const meta = clientMeta.get(ws);
        if (meta && meta.roomCode && meta.roomCode !== code) {
          serverLogger.security('ACTION_REJECTED', {
            roomCode: code,
            playerId: msg.playerId,
            details: { action: 'ROLL_DICE', reason: 'Socket room mismatch' },
          });
          sendTo(ws, { type: 'ACTION_REJECTED', action: 'ROLL_DICE', reason: 'Unauthorized: invalid room session.' });
          return;
        }

        const rateCheck = rateLimiter.actions.check(msg.playerId);
        if (!rateCheck.allowed) {
          serverLogger.warn('RATE_LIMIT_EXCEEDED', {
            roomCode: code,
            playerId: msg.playerId,
            details: { action: 'ROLL_DICE', reason: rateCheck.reason },
          });
          sendTo(ws, {
            type: 'ACTION_REJECTED',
            action: 'ROLL_DICE',
            reason: rateCheck.reason || 'Actions submitted too quickly.',
          });
          return;
        }

        const res = handleRollDice(room, msg.playerId, wss, msg.actionNonce);
        if (!res.success && res.error) {
          sendTo(ws, { type: 'ACTION_REJECTED', action: 'ROLL_DICE', reason: res.error });
        }
        break;
      }

      case 'MOVE_TOKEN': {
        const code = (msg.roomCode || '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) {
          sendTo(ws, { type: 'ERROR', message: 'Room not found.' });
          return;
        }

        const meta = clientMeta.get(ws);
        if (meta && meta.roomCode && meta.roomCode !== code) {
          serverLogger.security('ACTION_REJECTED', {
            roomCode: code,
            playerId: msg.playerId,
            details: { action: 'MOVE_TOKEN', reason: 'Socket room mismatch' },
          });
          sendTo(ws, { type: 'ACTION_REJECTED', action: 'MOVE_TOKEN', reason: 'Unauthorized: invalid room session.' });
          return;
        }

        const rateCheck = rateLimiter.actions.check(msg.playerId);
        if (!rateCheck.allowed) {
          serverLogger.warn('RATE_LIMIT_EXCEEDED', {
            roomCode: code,
            playerId: msg.playerId,
            details: { action: 'MOVE_TOKEN', reason: rateCheck.reason },
          });
          sendTo(ws, {
            type: 'ACTION_REJECTED',
            action: 'MOVE_TOKEN',
            reason: rateCheck.reason || 'Actions submitted too quickly.',
          });
          return;
        }

        handleMoveToken(room, msg.playerId, msg.tokenId, wss, msg.actionNonce).then((res) => {
          if (!res.success && res.error) {
            sendTo(ws, { type: 'ACTION_REJECTED', action: 'MOVE_TOKEN', reason: res.error });
          }
        });
        break;
      }

      case 'SEND_REACTION': {
        const code = (msg.roomCode || '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) return;
        const rxCheck = rateLimiter.reactions.check(msg.playerId);
        if (!rxCheck.allowed) return; // Drop spam reactions silently
        handleSendReaction(room, msg.playerId, msg.emoji, wss);
        break;
      }

      case 'SEND_CHAT':
      case 'SEND_CHAT_MESSAGE': {
        const code = (msg.roomCode || '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) return;
        const msgText = ('message' in msg && msg.message ? msg.message : ('text' in msg ? msg.text : '')) || '';
        handleSendChat(room, msg.playerId, msgText, wss, ws);
        break;
      }

      case 'GET_CHAT_HISTORY': {
        const code = (msg.roomCode || '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) return;
        sendTo(ws, {
          type: 'CHAT_HISTORY',
          roomCode: code,
          messages: room.chatHistory || [],
        });
        break;
      }
    }
  }

  function broadcastSystemMessage(room: Room, text: string, wss: WebSocketServer): void {
    const msgId = `sys_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const chatMsg: ChatMessage = {
      messageId: msgId,
      id: msgId,
      message: text,
      text: text,
      timestamp: now,
      isSystem: true,
    };

    room.chatHistory = room.chatHistory || [];
    room.chatHistory.push(chatMsg);
    if (room.chatHistory.length > 50) {
      room.chatHistory.shift();
    }

    const broadcastMsg: ServerMessage = {
      type: 'CHAT_MESSAGE',
      ...chatMsg,
    };

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        const meta = clientMeta.get(client);
        if (meta && meta.roomCode === room.code) {
          client.send(JSON.stringify(broadcastMsg));
        }
      }
    });
  }

  function broadcastGameEvent(room: Room, event: GameEventNotification, wss: WebSocketServer) {
    const msg: ServerMessage = {
      type: 'GAME_EVENT',
      event,
    };

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        const meta = clientMeta.get(client);
        if (meta && meta.roomCode === room.code) {
          client.send(JSON.stringify(msg));
        }
      }
    });
  }

  function handleSendReaction(room: Room, playerId: string, emoji: string, wss: WebSocketServer) {
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return;

    const msg: ServerMessage = {
      type: 'REACTION',
      playerId,
      playerName: player.name,
      color: player.color,
      emoji,
      id: `rx_${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
    };

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        const meta = clientMeta.get(client);
        if (meta && meta.roomCode === room.code) {
          client.send(JSON.stringify(msg));
        }
      }
    });
  }

  function handleSendChat(
    room: Room,
    playerId: string,
    rawText: string,
    wss: WebSocketServer,
    senderWs?: WebSocket
  ): { success: boolean; error?: string } {
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return { success: false, error: 'Player not in room' };

    const cleanText = (rawText || '').trim();
    if (!cleanText) return { success: false, error: 'Message cannot be empty' };

    if (cleanText.length > 200) {
      if (senderWs && senderWs.readyState === WebSocket.OPEN) {
        senderWs.send(JSON.stringify({ type: 'ERROR', message: 'Message exceeds 200 character limit.' }));
      }
      return { success: false, error: 'Message exceeds 200 character limit' };
    }

    // Rate Limiting using sliding-window rateLimiter
    const chatCheck = rateLimiter.chat.check(playerId);
    if (!chatCheck.allowed) {
      if (senderWs && senderWs.readyState === WebSocket.OPEN) {
        senderWs.send(JSON.stringify({ type: 'ERROR', message: chatCheck.reason || 'You are typing too fast. Please slow down.' }));
      }
      return { success: false, error: chatCheck.reason || 'Rate limit reached. Please wait a moment.' };
    }

    const now = Date.now();

    const msgId = `chat_${now}_${Math.random().toString(36).substring(2, 7)}`;
    const chatMsg: ChatMessage = {
      messageId: msgId,
      id: msgId,
      playerId: player.id,
      playerName: player.name,
      playerColor: player.color,
      color: player.color,
      message: cleanText,
      text: cleanText,
      timestamp: now,
      isSystem: false,
    };

    room.chatHistory = room.chatHistory || [];
    room.chatHistory.push(chatMsg);
    if (room.chatHistory.length > 50) {
      room.chatHistory.shift();
    }

    const broadcastMsg: ServerMessage = {
      type: 'CHAT_MESSAGE',
      ...chatMsg,
    };

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        const meta = clientMeta.get(client);
        if (meta && meta.roomCode === room.code) {
          client.send(JSON.stringify(broadcastMsg));
        }
      }
    });

    return { success: true };
  }

  function advanceServerTurn(room: Room, wss: WebSocketServer): void {
    if (!room.gameState || room.gameState.winner) return;

    const gs = room.gameState;
    let nextIndex = (gs.currentPlayerIndex + 1) % gs.players.length;
    let attempts = 0;
    while (!gs.players[nextIndex].isActive && attempts < gs.players.length) {
      nextIndex = (nextIndex + 1) % gs.players.length;
      attempts++;
    }

    gs.currentPlayerIndex = nextIndex;
    gs.currentPlayerId = gs.players[nextIndex].id;
    gs.currentPlayerColor = gs.players[nextIndex].color;
    gs.diceValue = null;
    gs.diceRolling = false;
    gs.diceRolled = false;
    gs.validMoves = [];
    gs.status = 'IDLE';
    gs.turnNumber += 1;
    gs.consecutiveSixes = 0;
    gs.extraTurnGranted = false;
    gs.animatingTokenId = null;
    gs.movingTokenStep = null;
    gs.activeCaptureAnim = null;
    gs.actionNonce = `${room.code}_T${gs.turnNumber}_${Date.now().toString(36)}`;
    room.actionNonce = gs.actionNonce;
    room.isActionProcessing = false;

    const nextPlayer = gs.players[nextIndex];
    gs.lastActionText = `${nextPlayer.name}'s turn (${nextPlayer.color})`;
    gs.updatedAt = Date.now();
    broadcastRoom(room, wss);
  }

  function handleRollDice(
    room: Room,
    playerId: string,
    wss: WebSocketServer,
    actionNonce?: string
  ): { success: boolean; error?: string } {
    if (room.state !== 'PLAYING' || !room.gameState) {
      return { success: false, error: 'Game is not currently active.' };
    }

    const gs = room.gameState;
    if (gs.winner) {
      return { success: false, error: 'Game is already finished.' };
    }

    if (actionNonce && gs.actionNonce && actionNonce !== gs.actionNonce) {
      serverLogger.security('ACTION_REJECTED', {
        roomCode: room.code,
        playerId,
        details: { action: 'ROLL_DICE', reason: 'Stale actionNonce / replay detected', clientNonce: actionNonce, serverNonce: gs.actionNonce },
      });
      return { success: false, error: 'Action out of sync or replayed. Please wait for current turn.' };
    }

    if (gs.currentPlayerId !== playerId) {
      serverLogger.security('ACTION_REJECTED', {
        roomCode: room.code,
        playerId,
        details: { action: 'ROLL_DICE', reason: 'Not current turn player', expectedPlayerId: gs.currentPlayerId },
      });
      return { success: false, error: 'It is not your turn to roll!' };
    }

    if (gs.status !== 'IDLE' || gs.diceRolling) {
      return { success: false, error: 'Cannot roll right now. Status: ' + gs.status };
    }

    if (gs.diceRolled) {
      return { success: false, error: 'Dice already rolled for this turn.' };
    }

    if (room.isActionProcessing) {
      return { success: false, error: 'Another action is currently in progress.' };
    }

    room.isActionProcessing = true;
    gs.status = 'ROLLING';
    gs.diceRolling = true;
    gs.diceValue = null;
    gs.validMoves = [];
    gs.updatedAt = Date.now();
    broadcastRoom(room, wss);

    serverLogger.info('DICE_ROLL', {
      roomCode: room.code,
      playerId,
      details: { turn: gs.turnNumber },
    });

    // Authoritative random roll generated by the server after animation
    setTimeout(() => {
      try {
        if (!rooms.has(room.code) || room.state !== 'PLAYING' || !room.gameState) return;
        const currentGs = room.gameState;
        if (currentGs.currentPlayerId !== playerId) return;

        const roll = Math.floor(Math.random() * 6) + 1;
        currentGs.diceRolling = false;
        currentGs.diceValue = roll;
        currentGs.diceRolled = true;

        const currentPlayer = currentGs.players[currentGs.currentPlayerIndex];
        if (!currentPlayer) return;

        let consecutive = currentGs.consecutiveSixes;
        if (roll === 6) {
          consecutive += 1;
        } else {
          consecutive = 0;
        }
        currentGs.consecutiveSixes = consecutive;

        // 3 consecutive sixes rule: Turn passes to next player
        if (consecutive === 3) {
          currentGs.lastActionText = `3 consecutive sixes! ${currentPlayer.name} loses their turn.`;
          currentGs.validMoves = [];
          currentGs.consecutiveSixes = 0;
          currentGs.status = 'IDLE';
          currentGs.updatedAt = Date.now();
          broadcastRoom(room, wss);

          setTimeout(() => {
            advanceServerTurn(room, wss);
          }, 1200);
          return;
        }

        // Authoritative valid moves calculation using existing rules
        const validMoves = getValidMoves(currentPlayer, roll);
        currentGs.validMoves = validMoves;

        if (roll === 6) {
          broadcastGameEvent(
            room,
            {
              id: `ev_${Date.now()}`,
              type: 'ROLL_SIX',
              title: 'SIX!',
              subtitle: `${currentPlayer.name} rolled a 6! Extra turn granted.`,
              color: currentPlayer.color,
              icon: '🎲',
              timestamp: Date.now(),
            },
            wss
          );
        }

        if (validMoves.length === 0) {
          currentGs.status = 'IDLE';
          currentGs.lastActionText = `${currentPlayer.name} rolled a ${roll} - No valid moves!`;
          currentGs.updatedAt = Date.now();
          broadcastRoom(room, wss);

          setTimeout(() => {
            advanceServerTurn(room, wss);
          }, 1200);
          return;
        }

        currentGs.status = 'WAITING_MOVE';
        currentGs.lastActionText = `${currentPlayer.name} rolled a ${roll}! Select a token to move.`;
        currentGs.updatedAt = Date.now();
        broadcastRoom(room, wss);
      } finally {
        room.isActionProcessing = false;
      }
    }, 450);

    return { success: true };
  }

  async function handleMoveToken(
    room: Room,
    playerId: string,
    tokenId: number,
    wss: WebSocketServer,
    actionNonce?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (room.state !== 'PLAYING' || !room.gameState) {
      return { success: false, error: 'Game is not active.' };
    }

    const gs = room.gameState;
    if (gs.winner) {
      return { success: false, error: 'Game has already ended.' };
    }

    if (typeof tokenId !== 'number' || !Number.isInteger(tokenId) || tokenId < 0 || tokenId > 15) {
      serverLogger.security('ACTION_REJECTED', {
        roomCode: room.code,
        playerId,
        details: { action: 'MOVE_TOKEN', reason: 'Invalid tokenId bounds', tokenId },
      });
      return { success: false, error: 'Invalid token selected.' };
    }

    if (actionNonce && gs.actionNonce && actionNonce !== gs.actionNonce) {
      serverLogger.security('ACTION_REJECTED', {
        roomCode: room.code,
        playerId,
        details: { action: 'MOVE_TOKEN', reason: 'Stale actionNonce / replay detected', clientNonce: actionNonce, serverNonce: gs.actionNonce },
      });
      return { success: false, error: 'Action out of sync or replayed. Please wait for current turn.' };
    }

    if (gs.currentPlayerId !== playerId) {
      serverLogger.security('ACTION_REJECTED', {
        roomCode: room.code,
        playerId,
        details: { action: 'MOVE_TOKEN', reason: 'Not current turn player', expectedPlayerId: gs.currentPlayerId },
      });
      return { success: false, error: 'It is not your turn!' };
    }

    if (gs.status !== 'WAITING_MOVE') {
      return { success: false, error: 'Not waiting for token move. Current status: ' + gs.status };
    }

    if (!gs.diceRolled || gs.diceValue === null) {
      return { success: false, error: 'Dice not rolled yet.' };
    }

    if (!gs.validMoves.includes(tokenId)) {
      serverLogger.warn('ACTION_REJECTED', {
        roomCode: room.code,
        playerId,
        details: { action: 'MOVE_TOKEN', tokenId, validMoves: gs.validMoves },
      });
      return { success: false, error: 'Invalid move for this token.' };
    }

    if (room.isActionProcessing) {
      return { success: false, error: 'Another action is currently in progress.' };
    }

    room.isActionProcessing = true;
    try {
      const currentPlayer = gs.players[gs.currentPlayerIndex];
      if (!currentPlayer) return { success: false, error: 'Player not found.' };

      const token = currentPlayer.tokens.find((t) => t.id === tokenId);
      if (!token) return { success: false, error: 'Token not found.' };

    const diceVal = gs.diceValue;
    const previousPos = token.position;
    let targetPos: number;

    if (previousPos === -1) {
      if (diceVal !== 6) return { success: false, error: 'Must roll 6 to leave yard.' };
      targetPos = 0; // Brought onto starting square
    } else {
      targetPos = previousPos + diceVal;
      if (targetPos > MAX_POSITION) {
        return { success: false, error: 'Move exceeds finish.' };
      }
    }

    // Authoritative movement execution
    gs.status = 'MOVING';
    gs.validMoves = [];
    gs.animatingTokenId = tokenId;
    gs.updatedAt = Date.now();
    broadcastRoom(room, wss);

    // Broadcast step-by-step visual path animation
    const pathCoords = getAnimatedPath(token.color, previousPos, targetPos, token.tokenIndex);
    for (let i = 0; i < pathCoords.length; i++) {
      const coord = pathCoords[i];
      gs.movingTokenStep = {
        tokenId,
        row: coord.row,
        col: coord.col,
        stepIndex: i,
        totalSteps: pathCoords.length,
        isHop: true,
      };
      broadcastRoom(room, wss);
      await new Promise((r) => setTimeout(r, 130));
    }

    // Land token
    token.position = targetPos;
    token.isYard = false;
    token.stepCount += diceVal;
    token.globalTrackIndex =
      targetPos >= 0 && targetPos <= 50 ? getGlobalTrackIndex(token.color, targetPos) : -1;
    gs.movingTokenStep = null;
    gs.animatingTokenId = null;

    serverLogger.info('TOKEN_MOVE', {
      roomCode: room.code,
      playerId,
      details: { tokenId, previousPos, targetPos, diceVal },
    });

    let grantedExtraTurn = diceVal === 6;

    // Check if reached home center (56)
    if (targetPos === MAX_POSITION) {
      token.isHome = true;
      currentPlayer.tokensFinished += 1;
      currentPlayer.score += 100;
      grantedExtraTurn = true;
      gs.lastActionText = `🌟 ${currentPlayer.name}'s token reached Home!`;
      broadcastGameEvent(
        room,
        {
          id: `ev_${Date.now()}`,
          type: 'TOKEN_HOME',
          title: 'TOKEN HOME!',
          subtitle: `${currentPlayer.name} guided a token (${currentPlayer.tokensFinished}/4) to center!`,
          color: currentPlayer.color,
          icon: '🏠',
          timestamp: Date.now(),
        },
        wss
      );
    }

    // Check capture on common track (0..50)
    let captureOccurred = false;
    if (targetPos >= 0 && targetPos <= 50) {
      const capturedTokens = findCapturableTokens(currentPlayer.color, targetPos, gs.players);
      if (capturedTokens.length > 0) {
        captureOccurred = true;
        grantedExtraTurn = true; // Capture awards extra turn

        for (const capToken of capturedTokens) {
          const victimPlayer = gs.players[capToken.playerIndex];
          currentPlayer.captures += 1;
          currentPlayer.score += 50;

          const landingCoord = getBoardCoordinate(token.color, targetPos, token.tokenIndex);
          const yardTargetCoord = getBoardCoordinate(capToken.color, -1, capToken.tokenIndex);

          gs.captureEvent = {
            attackerColor: currentPlayer.color,
            attackerName: currentPlayer.name,
            victimColor: victimPlayer.color,
            victimName: victimPlayer.name,
            timestamp: Date.now(),
          };

          gs.activeCaptureAnim = {
            victimTokenId: capToken.id,
            victimColor: capToken.color,
            fromRow: landingCoord.row,
            fromCol: landingCoord.col,
            toRow: yardTargetCoord.row,
            toCol: yardTargetCoord.col,
            timestamp: Date.now(),
          };

          gs.lastActionText = `💥 ${currentPlayer.name} captured ${victimPlayer.name}'s token!`;
          serverLogger.info('CAPTURE', {
            roomCode: room.code,
            playerId,
            details: { victimPlayerId: victimPlayer.id, victimColor: victimPlayer.color, targetPos },
          });
          broadcastGameEvent(
            room,
            {
              id: `ev_${Date.now()}`,
              type: 'CAPTURE',
              title: 'CAPTURE!',
              subtitle: `${currentPlayer.name} captured ${victimPlayer.name}! +50 Score`,
              color: currentPlayer.color,
              icon: '💥',
              timestamp: Date.now(),
            },
            wss
          );
          broadcastRoom(room, wss);

          await new Promise((r) => setTimeout(r, 450));

          capToken.position = -1;
          capToken.isYard = true;
          capToken.stepCount = 0;
          capToken.globalTrackIndex = -1;
          gs.activeCaptureAnim = null;
          broadcastRoom(room, wss);
        }
      } else if (token.globalTrackIndex !== -1 && SAFE_TRACK_INDICES.has(token.globalTrackIndex)) {
        broadcastGameEvent(
          room,
          {
            id: `ev_${Date.now()}`,
            type: 'SAFE_CELL',
            title: 'SAFE STAR!',
            subtitle: `${currentPlayer.name}'s token is protected on star`,
            color: currentPlayer.color,
            icon: '⭐',
            timestamp: Date.now(),
          },
          wss
        );
      }
    }

    // Update synchronized token list
    gs.tokens = gs.players.flatMap((p) => p.tokens);

    // Check win condition
    if (hasPlayerWon(currentPlayer)) {
      gs.winner = currentPlayer;
      gs.status = 'GAME_OVER';
      room.state = 'FINISHED';
      room.status = 'FINISHED';
      if (!gs.winningOrder.includes(currentPlayer.id)) {
        gs.winningOrder.push(currentPlayer.id);
      }
      gs.lastActionText = `👑 ${currentPlayer.name} wins the match!`;
      broadcastSystemMessage(room, `${currentPlayer.name} won the game!`, wss);

      // Server-Authoritative Match Reward Calculation & Duplicate Protection
      const finalResults: MatchPlayerResult[] = [
        {
          playerId: currentPlayer.id,
          rank: 1,
          captures: currentPlayer.captures,
        },
      ];

      const remainingPlayers = gs.players.filter((p) => p.id !== currentPlayer.id);
      remainingPlayers.sort((a, b) => {
        const tf = b.tokensFinished - a.tokensFinished;
        if (tf !== 0) return tf;
        const sc = b.score - a.score;
        if (sc !== 0) return sc;
        return b.captures - a.captures;
      });

      remainingPlayers.forEach((p, idx) => {
        finalResults.push({
          playerId: p.id,
          rank: idx + 2,
          captures: p.captures,
        });
      });

      const rewardOutcomes = playerDb.processMatchRewards(gs.matchId, finalResults);

      // Record persistent match history
      const ratingChanges: Record<string, { previousRating: number; newRating: number; delta: number }> = {};
      const xpEarned: Record<string, number> = {};
      const coinsEarned: Record<string, number> = {};
      for (const [pId, rew] of Object.entries(rewardOutcomes)) {
        ratingChanges[pId] = {
          previousRating: rew.newRating - rew.ratingDelta,
          newRating: rew.newRating,
          delta: rew.ratingDelta,
        };
        xpEarned[pId] = rew.xpEarned;
        coinsEarned[pId] = rew.coinsEarned;
      }

      matchHistoryDb.recordMatch({
        matchId: gs.matchId,
        timestamp: Date.now(),
        dateIso: new Date().toISOString(),
        durationSeconds: Math.max(1, Math.round((Date.now() - (room.startedAt || Date.now())) / 1000)),
        roomCode: room.code,
        winnerId: currentPlayer.id,
        winnerName: currentPlayer.name,
        winnerColor: currentPlayer.color,
        players: gs.players.map((p) => {
          const res = finalResults.find((r) => r.playerId === p.id);
          return {
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            color: p.color,
            level: p.level || 1,
            captures: p.captures,
            rank: res ? res.rank : 2,
          };
        }),
        playerColors: Object.fromEntries(gs.players.map((p) => [p.id, p.color])),
        finalRankings: finalResults.map((r) => ({
          playerId: r.playerId,
          rank: r.rank,
          captures: r.captures,
        })),
        ratingChanges,
        xpEarned,
        coinsEarned,
      });

      serverLogger.info('VICTORY', {
        roomCode: room.code,
        playerId: currentPlayer.id,
        details: { matchId: gs.matchId, rank: 1, score: currentPlayer.score },
      });
      serverLogger.info('REWARD_TRANSACTION', {
        roomCode: room.code,
        playerId: currentPlayer.id,
        details: { matchId: gs.matchId, rewards: rewardOutcomes },
      });

      broadcastGameEvent(
        room,
        {
          id: `ev_${Date.now()}`,
          type: 'VICTORY',
          title: 'VICTORY!',
          subtitle: `${currentPlayer.name} is the Ludo Royale Champion!`,
          color: currentPlayer.color,
          icon: '👑',
          timestamp: Date.now(),
        },
        wss
      );

      // Send MATCH_REWARDS to connected sockets
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          const meta = clientMeta.get(client);
          if (meta && meta.roomCode === room.code) {
            const userReward = meta.playerId ? rewardOutcomes[meta.playerId] : undefined;
            client.send(
              JSON.stringify({
                type: 'MATCH_REWARDS',
                matchId: gs.matchId,
                rewards: rewardOutcomes,
                profile: userReward?.profile,
              })
            );
          }
        }
      });

      gs.updatedAt = Date.now();
      broadcastRoom(room, wss);
      return { success: true };
    }

    // Extra turn or next turn
    if (grantedExtraTurn) {
      gs.status = 'IDLE';
      gs.diceValue = null;
      gs.diceRolled = false;
      gs.extraTurnGranted = true;
      gs.turnNumber += 1;
      gs.actionNonce = `${room.code}_T${gs.turnNumber}_${Date.now().toString(36)}`;
      room.actionNonce = gs.actionNonce;

      if (diceVal === 6) {
        gs.lastActionText = `${currentPlayer.name} rolled a 6 and gets another turn!`;
        broadcastGameEvent(
          room,
          {
            id: `ev_${Date.now()}`,
            type: 'EXTRA_TURN',
            title: 'BONUS ROLL!',
            subtitle: `${currentPlayer.name} rolled a 6 and rolls again!`,
            color: currentPlayer.color,
            icon: '🔥',
            timestamp: Date.now(),
          },
          wss
        );
      } else if (captureOccurred) {
        gs.lastActionText = `${currentPlayer.name} captured a token and earned a bonus roll!`;
        broadcastGameEvent(
          room,
          {
            id: `ev_${Date.now()}`,
            type: 'EXTRA_TURN',
            title: 'BONUS ROLL!',
            subtitle: `${currentPlayer.name} captured a token! Bonus roll awarded.`,
            color: currentPlayer.color,
            icon: '🔥',
            timestamp: Date.now(),
          },
          wss
        );
      } else {
        gs.lastActionText = `${currentPlayer.name} reached Home and earned a bonus roll!`;
        broadcastGameEvent(
          room,
          {
            id: `ev_${Date.now()}`,
            type: 'EXTRA_TURN',
            title: 'BONUS ROLL!',
            subtitle: `${currentPlayer.name} reached home! Bonus roll awarded.`,
            color: currentPlayer.color,
            icon: '🔥',
            timestamp: Date.now(),
          },
          wss
        );
      }

      gs.updatedAt = Date.now();
      broadcastRoom(room, wss);
    } else {
      advanceServerTurn(room, wss);
    }

    return { success: true };
    } finally {
      room.isActionProcessing = false;
    }
  }

  // Vite middleware in dev, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Ludo Royale Server running on http://localhost:${PORT}`);
  });
}

startServer();
