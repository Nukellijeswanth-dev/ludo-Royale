import React, { useMemo, useState, useEffect } from 'react';
import { Player, Token as TokenType, PlayerColor, VisualStep, CaptureAnimation } from '../../types/gameTypes';
import {
  BOARD_SIZE,
  TOKEN_CELL_RATIO,
  getTokenGridPosition,
  getTokenClusterOffset,
} from '../../game/board';
import { getTokenSkinStyle } from '../../game/customizationStyles';

interface TokenLayerProps {
  players: Player[];
  validMoves: number[];
  onSelectToken: (tokenId: number) => void;
  movingTokenStep: VisualStep | null;
  activeCaptureAnim: CaptureAnimation | null;
  showDebug?: boolean;
}

export const TokenLayer: React.FC<TokenLayerProps> = ({
  players,
  validMoves,
  onSelectToken,
  movingTokenStep,
  activeCaptureAnim,
  showDebug = false,
}) => {
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);

  // Clear selected token once movement starts
  useEffect(() => {
    if (movingTokenStep) {
      setSelectedTokenId(null);
    }
  }, [movingTokenStep]);

  // Collect all tokens from active players
  const allTokens = useMemo(() => {
    return players.filter((p) => p.isActive).flatMap((p) => p.tokens);
  }, [players]);

  // Group static tokens by cell coordinates to calculate cluster/stack offsets
  const cellGroups = useMemo(() => {
    const groups = new Map<string, number[]>();

    allTokens.forEach((t) => {
      // Tokens currently hopping or animating are in motion above the board
      if (movingTokenStep && movingTokenStep.tokenId === t.id) return;
      if (activeCaptureAnim && activeCaptureAnim.victimTokenId === t.id) return;

      const coord = getTokenGridPosition(t.color, t.position, t.tokenIndex);
      const key = `${coord.row.toFixed(2)}_${coord.col.toFixed(2)}`;
      const list = groups.get(key) || [];
      list.push(t.id);
      groups.set(key, list);
    });

    return groups;
  }, [allTokens, movingTokenStep, activeCaptureAnim]);

  // Modern high-fidelity token gradient themes
  const tokenGradients: Record<PlayerColor, string> = {
    RED: 'radial-gradient(circle at 35% 32%, #ff6b6b 0%, #dc2626 55%, #770b0b 100%)',
    GREEN: 'radial-gradient(circle at 35% 32%, #6ee7b7 0%, #16a34a 55%, #0d4a22 100%)',
    YELLOW: 'radial-gradient(circle at 35% 32%, #fde047 0%, #eab308 55%, #713f12 100%)',
    BLUE: 'radial-gradient(circle at 35% 32%, #7dd3fc 0%, #2563eb 55%, #172554 100%)',
  };

  const bezelColors: Record<PlayerColor, string> = {
    RED: 'border-amber-300/80 shadow-[0_2px_8px_rgba(224,36,36,0.5)]',
    GREEN: 'border-amber-300/80 shadow-[0_2px_8px_rgba(22,163,74,0.5)]',
    YELLOW: 'border-amber-300/90 shadow-[0_2px_8px_rgba(234,179,8,0.5)]',
    BLUE: 'border-amber-300/80 shadow-[0_2px_8px_rgba(37,99,235,0.5)]',
  };

  // Canonical token size as percentage of board width (70% of cell size)
  const tokenSizePercent = (100 / BOARD_SIZE) * TOKEN_CELL_RATIO;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-visible">
      {allTokens.map((token) => {
        const isMoving = movingTokenStep !== null && movingTokenStep.tokenId === token.id;
        const isCaptured = activeCaptureAnim !== null && activeCaptureAnim.victimTokenId === token.id;
        const isValid = validMoves.includes(token.id);

        let row: number;
        let col: number;
        let isHopping = false;

        if (isMoving && movingTokenStep) {
          row = movingTokenStep.row;
          col = movingTokenStep.col;
          isHopping = true;
        } else if (isCaptured && activeCaptureAnim) {
          // Animating towards home base slot
          row = activeCaptureAnim.toRow;
          col = activeCaptureAnim.toCol;
        } else {
          const coord = getTokenGridPosition(token.color, token.position, token.tokenIndex);
          row = coord.row;
          col = coord.col;
        }

        // Calculate multi-token clustering offset for shared cells
        const key = `${row.toFixed(2)}_${col.toFixed(2)}`;
        const group = cellGroups.get(key) || [];
        const stackIndex = group.indexOf(token.id);
        const stackCount = group.length;

        // In yard (-1) or finish (56), tokens have dedicated slot coordinates, so no clustering needed
        const needsClustering = !isMoving && !isCaptured && token.position >= 0 && token.position < 56;
        const cluster = needsClustering && stackCount > 1 && stackIndex >= 0
          ? getTokenClusterOffset(stackIndex, stackCount)
          : { offsetXPercent: 0, offsetYPercent: 0, scale: 1.0 };

        // Cell-relative offset: offsetXPercent is -50 to +50% of 1 cell width
        const colWithOffset = col + (cluster.offsetXPercent / 100);
        const rowWithOffset = row + (cluster.offsetYPercent / 100);

        // Canonical token center coordinate in board percentage
        const leftPercent = ((colWithOffset + 0.5) / BOARD_SIZE) * 100;
        const topPercent = ((rowWithOffset + 0.5) / BOARD_SIZE) * 100;

        // Z-Index ordering (Requirement 23)
        const isSelected = selectedTokenId === token.id;
        let zIndex = 15;
        if (isMoving || isSelected) zIndex = 50;
        else if (isValid) zIndex = 35;
        else if (token.position >= 56) zIndex = 20;

        // Final piece scale factor
        let visualScale = cluster.scale;
        if (isSelected) visualScale *= 1.22;
        else if (isHopping) visualScale *= 1.20;
        else if (isCaptured) visualScale *= 0.68;
        else if (isValid) visualScale *= 1.08;

        const ownerPlayer = players.find((p) => p.color === token.color);
        const skinId = ownerPlayer?.tokenSkin || 'classic';
        const skinStyle = getTokenSkinStyle(skinId, token.color);

        return (
          <div
            key={token.id}
            id={`token-${token.id}`}
            style={{
              left: `${leftPercent}%`,
              top: `${topPercent}%`,
              width: `${tokenSizePercent}%`,
              height: `${tokenSizePercent}%`,
              zIndex,
              transform: 'translate(-50%, -50%)',
              willChange: isMoving || isCaptured ? 'left, top, transform' : 'auto',
              transition: isCaptured
                ? 'left 450ms cubic-bezier(0.25, 1, 0.5, 1), top 450ms cubic-bezier(0.25, 1, 0.5, 1)'
                : isMoving
                ? 'left 160ms cubic-bezier(0.25, 1, 0.5, 1), top 160ms cubic-bezier(0.25, 1, 0.5, 1)'
                : 'left 200ms ease, top 200ms ease',
            }}
            className="absolute pointer-events-none flex items-center justify-center"
          >
            {/* Ripple Beacon ring radiating outward for selectable tokens */}
            {isValid && !isMoving && !isSelected && (
              <div className="absolute inset-0 rounded-full border border-amber-300/80 token-ripple-effect pointer-events-none" />
            )}

            {/* Soft contact drop shadow beneath token with 3D height reaction */}
            <div
              className={`absolute rounded-full bg-black/75 transition-all duration-150 pointer-events-none ${
                isHopping
                  ? 'w-full h-full opacity-30 translate-y-3.5 scale-65 blur-[3px]'
                  : isSelected
                  ? 'w-full h-full opacity-50 translate-y-2 scale-85 blur-[2px]'
                  : 'w-[92%] h-[92%] opacity-80 translate-y-0.5 scale-95 blur-[1.5px]'
              }`}
            />

            {/* Main Tactile 3D Token Piece */}
            <button
              type="button"
              id={`btn-token-${token.id}`}
              disabled={!isValid}
              onClick={(e) => {
                e.stopPropagation();
                if (isValid) {
                  setSelectedTokenId(token.id);
                  onSelectToken(token.id);
                }
              }}
              aria-label={`${token.color} Token ${token.tokenIndex + 1}${isValid ? ' - click to move' : ''}`}
              style={{
                background: skinStyle.gradient,
                transform: `scale(${visualScale}) ${isHopping ? 'translateY(-30%)' : ''} ${isCaptured ? 'rotate(-360deg)' : ''}`,
                willChange: isMoving || isCaptured ? 'transform' : 'auto',
                transition: isMoving
                  ? 'transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                  : 'transform 180ms ease',
              }}
              className={`relative w-full h-full rounded-full flex items-center justify-center border-2 ${
                skinStyle.bezel
              } select-none ${
                isSelected
                  ? 'pointer-events-auto cursor-pointer ring-4 ring-amber-300 ring-offset-2 ring-offset-slate-950 shadow-[0_0_24px_rgba(251,191,36,1)] scale-110'
                  : isValid
                  ? 'pointer-events-auto cursor-pointer ring-3 ring-amber-300 ring-offset-1 ring-offset-slate-950 shadow-[0_0_14px_rgba(251,191,36,0.95)] token-selectable-anim'
                  : 'pointer-events-none'
              }`}
            >
              {/* Specular highlight reflection */}
              <div className="absolute top-[8%] left-[12%] w-[38%] h-[24%] rounded-full bg-white/65 blur-[0.3px] pointer-events-none" />

              {/* Inner metallic core with emblem or star pin */}
              <div className={`w-[54%] h-[54%] rounded-full border ${skinStyle.centerRing} flex items-center justify-center shadow-inner pointer-events-none`}>
                {skinStyle.centerEmoji ? (
                  <span className="text-[9px] sm:text-[11px] leading-none select-none drop-shadow-sm">
                    {skinStyle.centerEmoji}
                  </span>
                ) : (
                  <div className={`w-[40%] h-[40%] rounded-full ${skinStyle.centerDot}`} />
                )}
              </div>

              {/* Pulsing selection beacon for movable pieces */}
              {isValid && !isSelected && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 sm:h-3 sm:w-3 pointer-events-none">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-90" />
                  <span className="relative inline-flex rounded-full h-full w-full bg-amber-300 border border-slate-950 shadow-md" />
                </span>
              )}
            </button>

            {/* Development-only Debug Label (Requirement 19) */}
            {showDebug && (
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-black/90 text-[7px] text-amber-300 font-mono px-1 py-0.2 rounded border border-amber-400/50 pointer-events-none whitespace-nowrap z-50">
                {token.color[0]}{token.tokenIndex + 1}: p{token.position} ({row.toFixed(0)},{col.toFixed(0)})
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
