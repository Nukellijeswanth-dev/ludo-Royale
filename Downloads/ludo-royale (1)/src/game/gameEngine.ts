import {
  GameState,
  Player,
  PlayerColor,
  Token,
  GameMode,
  AIDifficulty,
  Reaction,
  QuickChatMessage,
  AICommentary,
  VisualStep,
  CaptureAnimation,
  GameEventNotification,
  GameEventType,
} from '../types/gameTypes';
import { canTokenMove, getValidMoves, findCapturableTokens, hasPlayerWon, MAX_POSITION } from './rules';
import { getGlobalTrackIndex, getAnimatedPath, getBoardCoordinate, SAFE_TRACK_INDICES } from './board';
import { selectAIMove } from './ai';
import { audio } from '../audio/audioManager';
import { db } from '../database/database';

export const INITIAL_COLORS: PlayerColor[] = ['RED', 'GREEN', 'YELLOW', 'BLUE'];

export function createInitialTokens(playerIndex: number, color: PlayerColor): Token[] {
  return [0, 1, 2, 3].map((tokenIdx) => ({
    id: playerIndex * 4 + tokenIdx,
    playerIndex,
    color,
    tokenIndex: tokenIdx,
    position: -1, // in yard
    globalTrackIndex: -1,
    isYard: true,
    isHome: false,
    stepCount: 0,
  }));
}

export interface PlayerSetupConfig {
  name: string;
  color: PlayerColor;
  avatar: string;
  isAI: boolean;
  aiDifficulty: AIDifficulty;
}

type StateListener = (state: GameState) => void;
type ReactionListener = (reaction: Reaction) => void;
type ChatListener = (chat: QuickChatMessage) => void;
type CommentaryListener = (comm: AICommentary) => void;
type EventNotificationListener = (event: GameEventNotification) => void;

class GameEngine {
  private state: GameState;
  private listeners: Set<StateListener> = new Set();
  private reactionListeners: Set<ReactionListener> = new Set();
  private chatListeners: Set<ChatListener> = new Set();
  private commentaryListeners: Set<CommentaryListener> = new Set();
  private eventListeners: Set<EventNotificationListener> = new Set();
  private aiTimeout: any = null;
  private autoNextTurnTimeout: any = null;
  private rollTimeout: any = null;
  private activeTimers: Set<any> = new Set();
  private animationSessionId: number = 0;
  private prePauseStatus: GameState['gameStatus'] = 'IDLE';

  constructor() {
    this.state = this.getInitialState();
  }

  private getInitialState(): GameState {
    return {
      matchId: `match_${Date.now()}`,
      matchStartTime: Date.now(),
      players: [],
      currentPlayerIndex: 0,
      diceValue: null,
      diceRolling: false,
      validMoves: [],
      winner: null,
      gameStatus: 'IDLE',
      turnNumber: 1,
      consecutiveSixes: 0,
      lastActionText: 'Welcome to Ludo Royale! Roll the dice to begin.',
      captureEvent: null,
      mode: 'LOCAL',
      extraTurnGranted: false,
      animatingTokenId: null,
      movingTokenStep: null,
      activeCaptureAnim: null,
    };
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  public subscribeReactions(listener: ReactionListener): () => void {
    this.reactionListeners.add(listener);
    return () => this.reactionListeners.delete(listener);
  }

  public subscribeChat(listener: ChatListener): () => void {
    this.chatListeners.add(listener);
    return () => this.chatListeners.delete(listener);
  }

  public subscribeCommentary(listener: CommentaryListener): () => void {
    this.commentaryListeners.add(listener);
    return () => this.commentaryListeners.delete(listener);
  }

  public subscribeEvents(listener: EventNotificationListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  public emitEvent(
    type: GameEventType,
    title: string,
    subtitle: string | undefined,
    color: PlayerColor,
    icon: string
  ) {
    const event: GameEventNotification = {
      id: `event_${Date.now()}_${Math.random()}`,
      type,
      title,
      subtitle,
      color,
      icon,
      timestamp: Date.now(),
    };
    this.eventListeners.forEach((l) => l(event));
  }

  private notify() {
    this.listeners.forEach((l) => l({ ...this.state }));
  }

  public getState(): GameState {
    return this.state;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.activeTimers.delete(timer);
        resolve();
      }, ms);
      this.activeTimers.add(timer);
    });
  }

  public restartMatch() {
    if (!this.state.players.length) return;
    const configs: PlayerSetupConfig[] = this.state.players.map((p) => ({
      name: p.name,
      color: p.color,
      avatar: p.avatar,
      isAI: p.isAI,
      aiDifficulty: p.aiDifficulty,
    }));
    this.startNewGame(configs, this.state.mode);
  }

  public startNewGame(configs: PlayerSetupConfig[], mode: GameMode = 'LOCAL') {
    this.clearTimeouts();
    this.animationSessionId++;

    const matchId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const matchStartTime = Date.now();

    const players: Player[] = configs.map((cfg, idx) => ({
      id: `player_${idx}_${Date.now()}`,
      name: cfg.name || `Player ${idx + 1}`,
      color: cfg.color,
      avatar: cfg.avatar || '🎲',
      isAI: cfg.isAI,
      aiDifficulty: cfg.aiDifficulty,
      tokens: createInitialTokens(idx, cfg.color),
      score: 0,
      captures: 0,
      tokensFinished: 0,
      winStreak: 0,
      isActive: true,
    }));

    this.state = {
      matchId,
      matchStartTime,
      players,
      currentPlayerIndex: 0,
      diceValue: null,
      diceRolling: false,
      validMoves: [],
      winner: null,
      gameStatus: 'IDLE',
      turnNumber: 1,
      consecutiveSixes: 0,
      lastActionText: `${players[0].name}'s turn to roll!`,
      captureEvent: null,
      mode,
      extraTurnGranted: false,
      animatingTokenId: null,
      movingTokenStep: null,
      activeCaptureAnim: null,
    };

    this.notify();
    this.sendCommentary(
      `Game started! ${players[0].name} (${players[0].color}) has the first move. Roll a 6 to bring a token out!`,
      'START'
    );

    // If first player is AI, trigger its turn
    if (players[0].isAI) {
      this.scheduleAITurn();
    }
  }

  public rollDice(): void {
    if (
      this.state.gameStatus !== 'IDLE' ||
      this.state.diceRolling ||
      this.state.winner ||
      this.state.animatingTokenId !== null
    ) {
      return;
    }

    const currentPlayer = this.state.players[this.state.currentPlayerIndex];
    if (!currentPlayer || !currentPlayer.isActive) return;

    this.state.diceRolling = true;
    this.state.diceValue = null;
    this.state.gameStatus = 'ROLLING';
    this.notify();

    audio.playDiceRoll();

    // Roll animation delay (approx 450ms)
    this.rollTimeout = setTimeout(() => {
      this.rollTimeout = null;
      if (this.state.winner) return;

      const roll = Math.floor(Math.random() * 6) + 1;
      this.state.diceValue = roll;
      this.state.diceRolling = false;

      let consecutive = this.state.consecutiveSixes;
      if (roll === 6) {
        consecutive += 1;
        db.recordSixRolled();
        audio.playSixRolled();
      } else {
        consecutive = 0;
      }
      this.state.consecutiveSixes = consecutive;

      // Check for 3 consecutive sixes rule
      if (consecutive === 3) {
        this.state.lastActionText = `3 consecutive sixes! ${currentPlayer.name} loses their turn.`;
        this.sendCommentary(`Unbelievable! 3 consecutive sixes! Turn passes to the next player.`, 'INFO');
        this.state.validMoves = [];
        this.state.consecutiveSixes = 0;
        this.notify();

        this.autoNextTurnTimeout = setTimeout(() => {
          this.nextTurn();
        }, 1200);
        return;
      }

      // Calculate valid moves
      const validMoves = getValidMoves(currentPlayer, roll);
      this.state.validMoves = validMoves;

      if (roll === 6) {
        this.emitEvent('ROLL_SIX', 'SIX!', `${currentPlayer.name} rolled a 6! Extra turn granted.`, currentPlayer.color, '🎲');
        this.sendCommentary(
          `Great roll! ${currentPlayer.name} rolled a 6! Brings out a token or advances!`,
          'ROLL_SIX'
        );
      }

      if (validMoves.length === 0) {
        this.state.gameStatus = 'IDLE';
        this.state.lastActionText = `${currentPlayer.name} rolled a ${roll} - No valid moves!`;
        this.notify();

        // Delay and auto advance turn
        this.autoNextTurnTimeout = setTimeout(() => {
          this.nextTurn();
        }, 1100);
        return;
      }

      this.state.gameStatus = 'WAITING_MOVE';
      this.state.lastActionText = `${currentPlayer.name} rolled a ${roll}! Select a token to move.`;
      this.notify();

      // If currentPlayer is AI, pick best move after natural thinking delay
      if (currentPlayer.isAI) {
        this.aiTimeout = setTimeout(() => {
          const chosenTokenId = selectAIMove(
            currentPlayer,
            validMoves,
            roll,
            this.state.players,
            currentPlayer.aiDifficulty
          );
          if (chosenTokenId !== null) {
            this.moveToken(chosenTokenId);
          }
        }, 850);
      }
    }, 450);
  }

  public async moveToken(tokenId: number): Promise<void> {
    if (
      this.state.gameStatus !== 'WAITING_MOVE' ||
      !this.state.validMoves.includes(tokenId) ||
      this.state.animatingTokenId !== null
    ) {
      return;
    }

    const currentPlayer = this.state.players[this.state.currentPlayerIndex];
    const token = currentPlayer.tokens.find((t) => t.id === tokenId);
    if (!token) return;

    const diceVal = this.state.diceValue || 1;
    this.state.gameStatus = 'MOVING';
    this.state.validMoves = [];
    this.state.animatingTokenId = tokenId;
    this.notify();

    const previousPos = token.position;
    let targetPos: number;

    if (previousPos === -1) {
      targetPos = 0; // Brought onto board
    } else {
      if (previousPos + diceVal > MAX_POSITION) {
        this.state.gameStatus = 'WAITING_MOVE';
        this.state.animatingTokenId = null;
        this.notify();
        return;
      }
      targetPos = previousPos + diceVal;
    }

    // Capture animation session
    const currentSession = ++this.animationSessionId;
    const pathCoords = getAnimatedPath(token.color, previousPos, targetPos, token.tokenIndex);

    // Visually step through each intermediate cell with physical hopping
    for (let i = 0; i < pathCoords.length; i++) {
      if (this.animationSessionId !== currentSession) return;

      const coord = pathCoords[i];
      this.state.movingTokenStep = {
        tokenId,
        row: coord.row,
        col: coord.col,
        stepIndex: i,
        totalSteps: pathCoords.length,
        isHop: true,
      };
      this.notify();

      audio.playTokenHop(i);

      // Duration per cell hop (165ms gives crisp, visible, natural stepping)
      await this.sleep(165);
    }

    if (this.animationSessionId !== currentSession) return;

    // Land on destination
    audio.playTokenLand();
    await this.sleep(110);

    // Apply logical board position update
    token.position = targetPos;
    token.isYard = false;
    token.stepCount += diceVal;
    token.globalTrackIndex = targetPos >= 0 && targetPos <= 50 ? getGlobalTrackIndex(token.color, targetPos) : -1;

    let grantedExtraTurn = diceVal === 6;

    // Check if token reached home center (56)
    if (targetPos === MAX_POSITION) {
      token.isHome = true;
      currentPlayer.tokensFinished += 1;
      currentPlayer.score += 100;
      audio.playTokenFinished();
      this.state.lastActionText = `🌟 ${currentPlayer.name}'s token reached Home!`;
      this.emitEvent('TOKEN_HOME', 'HOME!', `${currentPlayer.name} guided token (${currentPlayer.tokensFinished}/4) to center!`, currentPlayer.color, '🏠');
      this.sendCommentary(`Superb! ${currentPlayer.name} guided a token into the home center!`, 'WIN');
      grantedExtraTurn = true; // finishing token grants extra turn in classic ludo
      await this.sleep(300);
    }

    // Check for opponent capture on common track (0..50)
    let captureEventOccurred = false;
    if (targetPos >= 0 && targetPos <= 50) {
      const capturedTokens = findCapturableTokens(currentPlayer.color, targetPos, this.state.players);
      if (capturedTokens.length > 0) {
        captureEventOccurred = true;
        grantedExtraTurn = true; // Capture grants extra turn

        for (const capToken of capturedTokens) {
          if (this.animationSessionId !== currentSession) return;

          const victimPlayer = this.state.players[capToken.playerIndex];
          currentPlayer.captures += 1;
          currentPlayer.score += 50;

          const landingCoord = getBoardCoordinate(token.color, targetPos, token.tokenIndex);
          const yardTargetCoord = getBoardCoordinate(capToken.color, -1, capToken.tokenIndex);

          this.state.captureEvent = {
            attackerColor: currentPlayer.color,
            attackerName: currentPlayer.name,
            victimColor: victimPlayer.color,
            victimName: victimPlayer.name,
            timestamp: Date.now(),
          };

          this.state.activeCaptureAnim = {
            victimTokenId: capToken.id,
            victimColor: capToken.color,
            fromRow: landingCoord.row,
            fromCol: landingCoord.col,
            toRow: yardTargetCoord.row,
            toCol: yardTargetCoord.col,
            timestamp: Date.now(),
          };

          this.state.lastActionText = `💥 ${currentPlayer.name} captured ${victimPlayer.name}'s token!`;
          this.emitEvent('CAPTURE', 'CAPTURE!', `${currentPlayer.name} captured ${victimPlayer.name}! +50 Score`, currentPlayer.color, '💥');
          this.sendCommentary(`BOOM! ${currentPlayer.name} captured ${victimPlayer.name}'s token!`, 'CAPTURE');
          audio.playCapture();
          this.notify();

          // Recoil & swoosh back to base
          await this.sleep(450);

          capToken.position = -1;
          capToken.isYard = true;
          capToken.stepCount = 0;
          capToken.globalTrackIndex = -1;
          this.state.activeCaptureAnim = null;
          this.notify();
        }
      } else {
        // Safe cell landing check
        if (token.globalTrackIndex !== -1 && SAFE_TRACK_INDICES.has(token.globalTrackIndex)) {
          this.emitEvent('SAFE_CELL', 'SAFE!', `${currentPlayer.name}'s token is protected on star`, currentPlayer.color, '⭐');
        }
      }
    }

    // Check win condition
    if (hasPlayerWon(currentPlayer)) {
      this.state.animatingTokenId = null;
      this.state.movingTokenStep = null;
      this.state.lastActionText = `👑 ${currentPlayer.name} wins the match!`;
      this.emitEvent('VICTORY', 'VICTORY!', `${currentPlayer.name} is the Ludo Royale Champion!`, currentPlayer.color, '👑');
      this.sendCommentary(`🎉 Fantastic game! ${currentPlayer.name} is the Ludo Royale Champion!`, 'WIN');
      audio.playWin();
      this.notify();

      // Delay transition so finish celebration and victory banner on the board can complete
      await this.sleep(1200);
      this.state.winner = currentPlayer;
      this.state.gameStatus = 'GAME_OVER';
      this.notify();
      return;
    }

    // Conclude move
    this.state.animatingTokenId = null;
    this.state.movingTokenStep = null;
    this.state.extraTurnGranted = grantedExtraTurn;

    if (grantedExtraTurn) {
      this.state.gameStatus = 'IDLE';
      this.state.diceValue = null;
      if (diceVal === 6) {
        this.state.lastActionText = `${currentPlayer.name} rolled a 6 and gets another turn!`;
        this.emitEvent('EXTRA_TURN', 'EXTRA TURN!', `${currentPlayer.name} rolled a 6 and rolls again!`, currentPlayer.color, '🔥');
      } else if (captureEventOccurred) {
        this.state.lastActionText = `${currentPlayer.name} captured a token and earned an extra turn!`;
        this.emitEvent('EXTRA_TURN', 'EXTRA TURN!', `${currentPlayer.name} earned a bonus roll for capture!`, currentPlayer.color, '🔥');
      } else {
        this.state.lastActionText = `${currentPlayer.name} reached Home and earned an extra turn!`;
        this.emitEvent('EXTRA_TURN', 'EXTRA TURN!', `${currentPlayer.name} earned a bonus roll for home finish!`, currentPlayer.color, '🔥');
      }
      this.notify();

      if (currentPlayer.isAI) {
        this.scheduleAITurn();
      }
    } else {
      this.nextTurn();
    }
  }

  public nextTurn(): void {
    if (this.state.winner) return;
    this.clearTimeouts();

    let nextIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length;
    // Skip non-active players if any
    let attempts = 0;
    while (!this.state.players[nextIndex].isActive && attempts < this.state.players.length) {
      nextIndex = (nextIndex + 1) % this.state.players.length;
      attempts++;
    }

    this.state.currentPlayerIndex = nextIndex;
    this.state.diceValue = null;
    this.state.validMoves = [];
    this.state.gameStatus = 'IDLE';
    this.state.turnNumber += 1;
    this.state.consecutiveSixes = 0;
    this.state.extraTurnGranted = false;
    this.state.animatingTokenId = null;
    this.state.movingTokenStep = null;
    this.state.activeCaptureAnim = null;

    const nextPlayer = this.state.players[nextIndex];
    this.state.lastActionText = `${nextPlayer.name}'s turn (${nextPlayer.color})`;
    this.notify();

    if (nextPlayer.isAI) {
      this.scheduleAITurn();
    }
  }

  private scheduleAITurn() {
    this.clearTimeouts();
    this.aiTimeout = setTimeout(() => {
      if (this.state.gameStatus === 'IDLE' && !this.state.winner && this.state.animatingTokenId === null) {
        this.rollDice();
      }
    }, 850);
  }

  public sendReaction(playerId: string, emoji: string) {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return;

    audio.playReaction();
    const reaction: Reaction = {
      id: `rx_${Date.now()}_${Math.random()}`,
      playerId,
      playerName: player.name,
      color: player.color,
      emoji,
      timestamp: Date.now(),
    };

    this.reactionListeners.forEach((l) => l(reaction));
  }

  public sendQuickChat(playerId: string, text: string) {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return;

    audio.playReaction();
    const chat: QuickChatMessage = {
      id: `chat_${Date.now()}_${Math.random()}`,
      playerId,
      playerName: player.name,
      color: player.color,
      text,
      timestamp: Date.now(),
    };

    this.chatListeners.forEach((l) => l(chat));
  }

  public sendCommentary(text: string, type: AICommentary['type']) {
    const comm: AICommentary = {
      id: `comm_${Date.now()}`,
      text,
      type,
      timestamp: Date.now(),
    };
    this.commentaryListeners.forEach((l) => l(comm));
  }

  public pauseGame() {
    if (this.state.gameStatus !== 'GAME_OVER' && this.state.gameStatus !== 'PAUSED') {
      this.prePauseStatus = this.state.gameStatus;
      this.state.gameStatus = 'PAUSED';
      this.clearTimeouts();
      this.notify();
    }
  }

  public resumeGame() {
    if (this.state.gameStatus === 'PAUSED') {
      let restoredStatus = this.prePauseStatus === 'PAUSED' ? 'IDLE' : this.prePauseStatus;
      if (restoredStatus === 'ROLLING') {
        restoredStatus = 'IDLE';
        this.state.diceRolling = false;
        this.state.diceValue = null;
      }
      this.state.gameStatus = restoredStatus;
      this.notify();

      const current = this.state.players[this.state.currentPlayerIndex];
      if (current && current.isAI) {
        if (restoredStatus === 'WAITING_MOVE' && this.state.validMoves.length > 0 && this.state.diceValue !== null) {
          this.aiTimeout = setTimeout(() => {
            const chosenTokenId = selectAIMove(
              current,
              this.state.validMoves,
              this.state.diceValue!,
              this.state.players,
              current.aiDifficulty
            );
            if (chosenTokenId !== null) {
              this.moveToken(chosenTokenId);
            }
          }, 650);
        } else if (restoredStatus === 'IDLE') {
          this.scheduleAITurn();
        }
      }
    }
  }

  private clearTimeouts() {
    if (this.rollTimeout) {
      clearTimeout(this.rollTimeout);
      this.rollTimeout = null;
    }
    if (this.aiTimeout) {
      clearTimeout(this.aiTimeout);
      this.aiTimeout = null;
    }
    if (this.autoNextTurnTimeout) {
      clearTimeout(this.autoNextTurnTimeout);
      this.autoNextTurnTimeout = null;
    }
    this.activeTimers.forEach((timer) => clearTimeout(timer));
    this.activeTimers.clear();
  }
}

export const gameEngine = new GameEngine();
