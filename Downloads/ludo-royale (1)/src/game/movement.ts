import { Token, PlayerColor, MoveStep } from '../types/gameTypes';
import { getTokenCoordinates } from './board';
import { MAX_POSITION } from './rules';

/**
 * Computes all intermediate steps for a token moving from its current position
 * according to the dice roll. Used for smooth, step-by-step visual animation.
 */
export function generateMovementPath(
  token: Token,
  diceValue: number
): MoveStep[] {
  const steps: MoveStep[] = [];
  const color = token.color;

  // Bringing token out of yard (from -1 to 0)
  if (token.position === -1) {
    if (diceValue === 6) {
      const coord = getTokenCoordinates(color, 0, token.tokenIndex);
      steps.push({
        tokenIndex: token.tokenIndex,
        color,
        fromPosition: -1,
        toPosition: 0,
        row: coord.row,
        col: coord.col,
      });
    }
    return steps;
  }

  // Moving along board / home stretch
  const startPos = token.position;
  const targetPos = Math.min(startPos + diceValue, MAX_POSITION);

  for (let pos = startPos + 1; pos <= targetPos; pos++) {
    const coord = getTokenCoordinates(color, pos, token.tokenIndex);
    steps.push({
      tokenIndex: token.tokenIndex,
      color,
      fromPosition: pos - 1,
      toPosition: pos,
      row: coord.row,
      col: coord.col,
    });
  }

  return steps;
}
