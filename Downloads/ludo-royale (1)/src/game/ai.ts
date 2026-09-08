import { Player, Token, AIDifficulty } from '../types/gameTypes';
import { MAX_POSITION, findCapturableTokens, canTokenMove } from './rules';
import { isPositionSafe, getGlobalTrackIndex } from './board';

/**
 * Evaluates valid moves for an AI player and selects the best token ID to move.
 */
export function selectAIMove(
  aiPlayer: Player,
  validTokenIds: number[],
  diceValue: number,
  allPlayers: Player[],
  difficulty: AIDifficulty = 'MEDIUM'
): number | null {
  if (validTokenIds.length === 0) return null;
  if (validTokenIds.length === 1) return validTokenIds[0];

  const validTokens = aiPlayer.tokens.filter((t) => validTokenIds.includes(t.id));

  // EASY: Random selection with minor preference to bring out token on 6
  if (difficulty === 'EASY') {
    // 60% chance to bring token out on 6 if available, otherwise random
    if (diceValue === 6) {
      const yardToken = validTokens.find((t) => t.position === -1);
      if (yardToken && Math.random() < 0.6) {
        return yardToken.id;
      }
    }
    const randomIndex = Math.floor(Math.random() * validTokens.length);
    return validTokens[randomIndex].id;
  }

  // MEDIUM & HARD: Heuristic Evaluation
  let bestToken: Token = validTokens[0];
  let highestScore = -Infinity;

  for (const token of validTokens) {
    let score = 0;
    const currentPos = token.position;
    const targetPos = currentPos === -1 ? 0 : currentPos + diceValue;

    // 1. CAPTURE OPPONENT: Massive priority
    const captures = findCapturableTokens(aiPlayer.color, targetPos, allPlayers);
    if (captures.length > 0) {
      score += difficulty === 'HARD' ? 1200 : 600;
    }

    // 2. REACHING HOME FINISH (position 56)
    if (targetPos === MAX_POSITION) {
      score += difficulty === 'HARD' ? 1000 : 500;
    }

    // 3. ENTERING HOME STRETCH (safe from all opponents)
    if (targetPos >= 51 && currentPos < 51) {
      score += difficulty === 'HARD' ? 400 : 250;
    }

    // 4. ENTERING SAFE CELL (Stars / Starts)
    if (targetPos <= 50 && isPositionSafe(aiPlayer.color, targetPos)) {
      score += difficulty === 'HARD' ? 300 : 180;
    }

    // 5. BRINGING NEW TOKEN OUT OF YARD ON 6
    if (currentPos === -1 && diceValue === 6) {
      // If we don't have many active tokens on board, bringing out is great
      const activeTokensOnBoard = aiPlayer.tokens.filter(
        (t) => t.position >= 0 && t.position < MAX_POSITION
      ).length;

      if (activeTokensOnBoard === 0) {
        score += 800; // Must get out!
      } else if (activeTokensOnBoard === 1) {
        score += 350;
      } else {
        score += 200;
      }
    }

    // 6. ESCAPING DANGER (Token currently in danger on unsafe cell)
    if (currentPos >= 0 && currentPos <= 50 && !isPositionSafe(aiPlayer.color, currentPos)) {
      const isCurrentlyInDanger = checkOpponentsCanCapture(token, allPlayers);
      if (isCurrentlyInDanger) {
        score += difficulty === 'HARD' ? 500 : 250;
      }
    }

    // 7. AVOIDING LANDING IN DANGER (Hard mode only)
    if (difficulty === 'HARD' && targetPos <= 50 && !isPositionSafe(aiPlayer.color, targetPos)) {
      const willBeInDanger = checkPositionWillBeInDanger(aiPlayer.color, targetPos, allPlayers);
      if (willBeInDanger) {
        score -= 350; // Penalty for landing in danger zone
      }
    }

    // 8. PROGRESSION BONUS (Prefer advancing tokens further ahead)
    score += targetPos * (difficulty === 'HARD' ? 3 : 2);

    // Slight noise to make AI feel natural and non-deterministic
    score += Math.random() * 15;

    if (score > highestScore) {
      highestScore = score;
      bestToken = token;
    }
  }

  return bestToken.id;
}

/**
 * Checks if any opponent token can capture this token on their next roll (distance 1..6)
 */
function checkOpponentsCanCapture(token: Token, allPlayers: Player[]): boolean {
  const myGlobalIndex = getGlobalTrackIndex(token.color, token.position);

  for (const player of allPlayers) {
    if (player.color === token.color || !player.isActive) continue;

    for (const oppToken of player.tokens) {
      if (oppToken.position >= 0 && oppToken.position <= 50) {
        const oppGlobalIndex = getGlobalTrackIndex(oppToken.color, oppToken.position);
        const distance = (myGlobalIndex - oppGlobalIndex + 52) % 52;
        if (distance >= 1 && distance <= 6) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Checks if target position on track would be within 1-6 distance of an opponent token
 */
function checkPositionWillBeInDanger(
  myColor: Player['color'],
  targetRelativePos: number,
  allPlayers: Player[]
): boolean {
  const targetGlobalIndex = getGlobalTrackIndex(myColor, targetRelativePos);

  for (const player of allPlayers) {
    if (player.color === myColor || !player.isActive) continue;

    for (const oppToken of player.tokens) {
      if (oppToken.position >= 0 && oppToken.position <= 50) {
        const oppGlobalIndex = getGlobalTrackIndex(oppToken.color, oppToken.position);
        const distance = (targetGlobalIndex - oppGlobalIndex + 52) % 52;
        if (distance >= 1 && distance <= 6) {
          return true;
        }
      }
    }
  }

  return false;
}
