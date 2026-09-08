import { Token, Player, PlayerColor } from '../types/gameTypes';
import { isPositionSafe, getGlobalTrackIndex } from './board';

export const MAX_POSITION = 56; // 56 is the center finish position

/**
 * Checks if a specific token can make a legal move given the dice roll.
 */
export function canTokenMove(token: Token, diceValue: number): boolean {
  // If token is already in center (finished), it cannot move
  if (token.isHome || token.position >= MAX_POSITION) {
    return false;
  }

  // If token is in yard, it can ONLY move if dice roll is 6
  if (token.position === -1) {
    return diceValue === 6;
  }

  // If token is on the board or in home stretch, it can move if target position <= MAX_POSITION
  const targetPosition = token.position + diceValue;
  return targetPosition <= MAX_POSITION;
}

/**
 * Returns all token IDs that can legally move for the given player and dice roll.
 */
export function getValidMoves(player: Player, diceValue: number): number[] {
  return player.tokens
    .filter((token) => canTokenMove(token, diceValue))
    .map((token) => token.id);
}

/**
 * Checks if a destination position would result in capturing any opponent tokens.
 * Returns array of captured tokens.
 */
export function findCapturableTokens(
  movingPlayerColor: PlayerColor,
  targetRelativePos: number,
  allPlayers: Player[]
): Token[] {
  // Captures can only occur on common track (0..50) and never on safe cells
  if (targetRelativePos < 0 || targetRelativePos > 50) {
    return [];
  }

  // If the target position is a safe cell, no capture can occur
  if (isPositionSafe(movingPlayerColor, targetRelativePos)) {
    return [];
  }

  const targetGlobalIndex = getGlobalTrackIndex(movingPlayerColor, targetRelativePos);
  const captured: Token[] = [];

  for (const player of allPlayers) {
    if (player.color === movingPlayerColor || !player.isActive) continue;

    for (const token of player.tokens) {
      if (token.position >= 0 && token.position <= 50) {
        const tokenGlobalIndex = getGlobalTrackIndex(token.color, token.position);
        if (tokenGlobalIndex === targetGlobalIndex) {
          captured.push(token);
        }
      }
    }
  }

  return captured;
}

/**
 * Checks if a player has won (all 4 tokens finished at MAX_POSITION).
 */
export function hasPlayerWon(player: Player): boolean {
  return player.tokens.every((t) => t.isHome || t.position >= MAX_POSITION);
}

/**
 * Calculates how many tokens have reached the home center.
 */
export function getFinishedTokensCount(player: Player): number {
  return player.tokens.filter((t) => t.isHome || t.position >= MAX_POSITION).length;
}

/**
 * Calculates remaining active tokens (in yard or still on board).
 */
export function getRemainingTokensCount(player: Player): number {
  return 4 - getFinishedTokensCount(player);
}
