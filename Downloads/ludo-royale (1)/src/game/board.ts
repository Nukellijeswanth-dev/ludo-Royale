import { PlayerColor } from '../types/gameTypes';

export const BOARD_SIZE = 15;
export const TOKEN_CELL_RATIO = 0.70; // 70% of cell diameter, stays completely inside cell
export const DEBUG_BOARD = false; // Dev debug overlay toggle

export interface CellCoord {
  row: number; // 0 to 14
  col: number; // 0 to 14
}

export interface VisualPosition {
  xPercent: number;
  yPercent: number;
  row: number;
  col: number;
}

export interface ClusterOffset {
  offsetXPercent: number; // Percentage of cell width (-50 to +50)
  offsetYPercent: number; // Percentage of cell height (-50 to +50)
  scale: number;          // Scale factor (0.5 to 1.0)
}

// Starting cell coordinates for each player on the 15x15 grid
export const START_CELLS: Record<PlayerColor, CellCoord> = {
  RED: { row: 6, col: 1 },
  GREEN: { row: 1, col: 8 },
  YELLOW: { row: 8, col: 13 },
  BLUE: { row: 13, col: 6 },
};

// 52 Common Track Coordinates (clockwise starting from Red Start at row 6, col 1)
export const COMMON_TRACK: CellCoord[] = [
  { row: 6, col: 1 },  // 0: Red Start (SAFE)
  { row: 6, col: 2 },  // 1
  { row: 6, col: 3 },  // 2
  { row: 6, col: 4 },  // 3
  { row: 6, col: 5 },  // 4
  { row: 5, col: 6 },  // 5
  { row: 4, col: 6 },  // 6
  { row: 3, col: 6 },  // 7
  { row: 2, col: 6 },  // 8: SAFE Star
  { row: 1, col: 6 },  // 9
  { row: 0, col: 6 },  // 10
  { row: 0, col: 7 },  // 11
  { row: 0, col: 8 },  // 12
  { row: 1, col: 8 },  // 13: Green Start (SAFE)
  { row: 2, col: 8 },  // 14
  { row: 3, col: 8 },  // 15
  { row: 4, col: 8 },  // 16
  { row: 5, col: 8 },  // 17
  { row: 6, col: 9 },  // 18
  { row: 6, col: 10 }, // 19
  { row: 6, col: 11 }, // 20
  { row: 6, col: 12 }, // 21: SAFE Star
  { row: 6, col: 13 }, // 22
  { row: 6, col: 14 }, // 23
  { row: 7, col: 14 }, // 24
  { row: 8, col: 14 }, // 25
  { row: 8, col: 13 }, // 26: Yellow Start (SAFE)
  { row: 8, col: 12 }, // 27
  { row: 8, col: 11 }, // 28
  { row: 8, col: 10 }, // 29
  { row: 8, col: 9 },  // 30
  { row: 9, col: 8 },  // 31
  { row: 10, col: 8 }, // 32
  { row: 11, col: 8 }, // 33
  { row: 12, col: 8 }, // 34: SAFE Star
  { row: 13, col: 8 }, // 35
  { row: 14, col: 8 }, // 36
  { row: 14, col: 7 }, // 37
  { row: 14, col: 6 }, // 38
  { row: 13, col: 6 }, // 39: Blue Start (SAFE)
  { row: 12, col: 6 }, // 40
  { row: 11, col: 6 }, // 41
  { row: 10, col: 6 }, // 42
  { row: 9, col: 6 },  // 43
  { row: 8, col: 5 },  // 44
  { row: 8, col: 4 },  // 45
  { row: 8, col: 3 },  // 46
  { row: 8, col: 2 },  // 47: SAFE Star
  { row: 8, col: 1 },  // 48
  { row: 8, col: 0 },  // 49
  { row: 7, col: 0 },  // 50
  { row: 6, col: 0 },  // 51
];

export const START_INDICES: Record<PlayerColor, number> = {
  RED: 0,
  GREEN: 13,
  YELLOW: 26,
  BLUE: 39,
};

export const SAFE_TRACK_INDICES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Home Stretch paths (positions 51..55) - exactly 5 colored walkway cells per player
export const HOME_PATHS: Record<PlayerColor, CellCoord[]> = {
  RED: [
    { row: 7, col: 1 }, // 51
    { row: 7, col: 2 }, // 52
    { row: 7, col: 3 }, // 53
    { row: 7, col: 4 }, // 54
    { row: 7, col: 5 }, // 55
  ],
  GREEN: [
    { row: 1, col: 7 }, // 51
    { row: 2, col: 7 }, // 52
    { row: 3, col: 7 }, // 53
    { row: 4, col: 7 }, // 54
    { row: 5, col: 7 }, // 55
  ],
  YELLOW: [
    { row: 7, col: 13 }, // 51
    { row: 7, col: 12 }, // 52
    { row: 7, col: 11 }, // 53
    { row: 7, col: 10 }, // 54
    { row: 7, col: 9 },  // 55
  ],
  BLUE: [
    { row: 13, col: 7 }, // 51
    { row: 12, col: 7 }, // 52
    { row: 11, col: 7 }, // 53
    { row: 10, col: 7 }, // 54
    { row: 9, col: 7 },  // 55
  ],
};

// Canonical 4-slot home base yard coordinates on the 15x15 grid
// Each home base occupies a 6x6 quadrant.
// The sockets sit symmetrically at 1-cell margins from the quadrant borders.
export const HOME_SLOT_COORDINATES: Record<PlayerColor, [CellCoord, CellCoord, CellCoord, CellCoord]> = {
  RED: [
    { row: 1, col: 1 },
    { row: 1, col: 4 },
    { row: 4, col: 1 },
    { row: 4, col: 4 },
  ],
  GREEN: [
    { row: 1, col: 10 },
    { row: 1, col: 13 },
    { row: 4, col: 10 },
    { row: 4, col: 13 },
  ],
  YELLOW: [
    { row: 10, col: 10 },
    { row: 10, col: 13 },
    { row: 13, col: 10 },
    { row: 13, col: 13 },
  ],
  BLUE: [
    { row: 10, col: 1 },
    { row: 10, col: 4 },
    { row: 13, col: 1 },
    { row: 13, col: 4 },
  ],
};

// Backwards compatibility alias for HOME_SLOT_COORDINATES
export const YARD_POSITIONS = HOME_SLOT_COORDINATES;

// Canonical finish area quadrant slots (position 56: Finished)
// Sits neatly inside each player's colored triangle of the 3x3 center area (rows 6..8, cols 6..8)
// positioned without colliding with the central crown medallion or diagonal boundaries.
export const FINISH_SLOT_COORDINATES: Record<PlayerColor, [CellCoord, CellCoord, CellCoord, CellCoord]> = {
  RED: [
    { row: 6.75, col: 6.3 },
    { row: 7.25, col: 6.3 },
    { row: 6.85, col: 6.6 },
    { row: 7.15, col: 6.6 },
  ],
  GREEN: [
    { row: 6.3, col: 6.75 },
    { row: 6.3, col: 7.25 },
    { row: 6.6, col: 6.85 },
    { row: 6.6, col: 7.15 },
  ],
  YELLOW: [
    { row: 6.75, col: 7.7 },
    { row: 7.25, col: 7.7 },
    { row: 6.85, col: 7.4 },
    { row: 7.15, col: 7.4 },
  ],
  BLUE: [
    { row: 7.7, col: 6.75 },
    { row: 7.7, col: 7.25 },
    { row: 7.4, col: 6.85 },
    { row: 7.4, col: 7.15 },
  ],
};

/**
 * Validates and clamps a cell coordinate to the 15x15 board.
 */
export function getCellCoordinate(row: number, col: number): CellCoord {
  return {
    row: Math.max(0, Math.min(BOARD_SIZE - 1, row)),
    col: Math.max(0, Math.min(BOARD_SIZE - 1, col)),
  };
}

/**
 * Single source of truth for token grid position.
 * Maps player color and logical position (-1, 0..50, 51..55, 56) to canonical 15x15 board coordinates.
 */
export function getTokenGridPosition(
  color: PlayerColor,
  position: number,
  tokenIndex: number = 0
): CellCoord {
  // In yard base (-1)
  if (position === -1) {
    const safeIdx = Math.max(0, Math.min(3, tokenIndex));
    return HOME_SLOT_COORDINATES[color][safeIdx];
  }

  // Finished in center finish (56)
  if (position >= 56) {
    const safeIdx = Math.max(0, Math.min(3, tokenIndex));
    return FINISH_SLOT_COORDINATES[color][safeIdx];
  }

  // In colored home stretch (51..55)
  if (position >= 51) {
    const homeIndex = Math.min(position - 51, 4);
    return HOME_PATHS[color][homeIndex];
  }

  // On common track (0..50 relative to player)
  const startIndex = START_INDICES[color];
  const globalIndex = (startIndex + position) % 52;
  return COMMON_TRACK[globalIndex];
}

/**
 * Canonical alias for getTokenGridPosition
 */
export function getTokenCoordinates(
  color: PlayerColor,
  position: number,
  tokenIndex: number = 0
): CellCoord {
  return getTokenGridPosition(color, position, tokenIndex);
}

/**
 * Reusable alias for canonical board coordinates.
 */
export function getBoardCoordinate(
  color: PlayerColor,
  position: number,
  tokenIndex: number = 0
): CellCoord {
  return getTokenGridPosition(color, position, tokenIndex);
}

/**
 * Calculates visual percentage position on the canonical 15x15 board.
 * Formula: ((coord + 0.5) / 15) * 100%
 */
export function getVisualTokenPosition(
  row: number,
  col: number
): VisualPosition {
  return {
    row,
    col,
    xPercent: ((col + 0.5) / BOARD_SIZE) * 100,
    yPercent: ((row + 0.5) / BOARD_SIZE) * 100,
  };
}

/**
 * Multi-token clustering offset calculation.
 * Ensures that 1, 2, 3, or 4 tokens occupying the same cell remain
 * 100% inside that cell without overflowing into adjacent cells.
 */
export function getTokenClusterOffset(
  tokenIndex: number,
  tokenCount: number
): ClusterOffset {
  if (tokenCount <= 1) {
    return { offsetXPercent: 0, offsetYPercent: 0, scale: 1.0 };
  }

  if (tokenCount === 2) {
    // Horizontal separation
    const offsets = [
      { x: -16, y: 0 },
      { x: 16, y: 0 },
    ];
    const off = offsets[tokenIndex % 2];
    return { offsetXPercent: off.x, offsetYPercent: off.y, scale: 0.74 };
  }

  if (tokenCount === 3) {
    // Triangle arrangement
    const offsets = [
      { x: 0, y: -16 },
      { x: -16, y: 14 },
      { x: 16, y: 14 },
    ];
    const off = offsets[tokenIndex % 3];
    return { offsetXPercent: off.x, offsetYPercent: off.y, scale: 0.66 };
  }

  // 4 tokens: 2x2 grid
  const offsets = [
    { x: -15, y: -15 },
    { x: 15, y: -15 },
    { x: -15, y: 15 },
    { x: 15, y: 15 },
  ];
  const off = offsets[tokenIndex % 4];
  return { offsetXPercent: off.x, offsetYPercent: off.y, scale: 0.60 };
}

/**
 * Returns full path coordinates for a player from start (0) to finish (56).
 */
export function getPathForPlayer(color: PlayerColor): CellCoord[] {
  const path: CellCoord[] = [];
  for (let pos = 0; pos <= 56; pos++) {
    path.push(getTokenGridPosition(color, pos, 0));
  }
  return path;
}

/**
 * Precalculated player paths for quick lookup
 */
export const PLAYER_PATHS: Record<PlayerColor, CellCoord[]> = {
  RED: getPathForPlayer('RED'),
  GREEN: getPathForPlayer('GREEN'),
  YELLOW: getPathForPlayer('YELLOW'),
  BLUE: getPathForPlayer('BLUE'),
};

/**
 * Calculates intermediate cell coordinates for a movement animation.
 * Moves sequentially step-by-step through each cell center.
 */
export function getAnimatedPath(
  color: PlayerColor,
  fromPos: number,
  toPos: number,
  tokenIndex: number = 0
): CellCoord[] {
  const path: CellCoord[] = [];
  if (fromPos === -1) {
    // Moving from yard slot directly to start cell (pos 0)
    path.push(getTokenGridPosition(color, 0, tokenIndex));
    return path;
  }
  for (let p = fromPos + 1; p <= toPos; p++) {
    path.push(getTokenGridPosition(color, p, tokenIndex));
  }
  return path;
}

/**
 * Converts relative position (0..50) of a player to the global track index (0..51)
 */
export function getGlobalTrackIndex(color: PlayerColor, position: number): number {
  if (position < 0 || position > 50) return -1;
  return (START_INDICES[color] + position) % 52;
}

/**
 * Checks if a relative position for a player falls on a safe cell
 */
export function isPositionSafe(color: PlayerColor, position: number): boolean {
  if (position < 0) return true; // yard is safe
  if (position >= 51) return true; // home stretch is safe from capture
  const globalIndex = getGlobalTrackIndex(color, position);
  return SAFE_TRACK_INDICES.has(globalIndex);
}

export const COLOR_THEMES: Record<
  PlayerColor,
  {
    bg: string;
    border: string;
    primary: string;
    light: string;
    dark: string;
    ring: string;
    badge: string;
    gradient: string;
    hex: string;
  }
> = {
  RED: {
    bg: 'bg-red-500',
    border: 'border-red-500',
    primary: 'text-red-500',
    light: 'bg-red-400',
    dark: 'bg-red-700',
    ring: 'ring-red-400',
    badge: 'bg-red-500/20 text-red-300 border-red-500/40',
    gradient: 'from-red-500 to-rose-600',
    hex: '#ef4444',
  },
  GREEN: {
    bg: 'bg-emerald-500',
    border: 'border-emerald-500',
    primary: 'text-emerald-500',
    light: 'bg-emerald-400',
    dark: 'bg-emerald-700',
    ring: 'ring-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    gradient: 'from-emerald-500 to-teal-600',
    hex: '#10b981',
  },
  YELLOW: {
    bg: 'bg-amber-400',
    border: 'border-amber-400',
    primary: 'text-amber-400',
    light: 'bg-amber-300',
    dark: 'bg-amber-600',
    ring: 'ring-amber-300',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    gradient: 'from-amber-400 to-yellow-500',
    hex: '#f59e0b',
  },
  BLUE: {
    bg: 'bg-sky-500',
    border: 'border-sky-500',
    primary: 'text-sky-500',
    light: 'bg-sky-400',
    dark: 'bg-sky-700',
    ring: 'ring-sky-400',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    gradient: 'from-sky-500 to-blue-600',
    hex: '#0284c7',
  },
};

