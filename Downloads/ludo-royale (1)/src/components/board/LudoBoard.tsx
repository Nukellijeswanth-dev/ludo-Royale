import React, { useMemo, useState, useEffect } from 'react';
import { Player, PlayerColor, VisualStep, CaptureAnimation } from '../../types/gameTypes';
import { HomeArea } from './HomeArea';
import { FinishArea } from './FinishArea';
import { BoardCell, CellType } from './BoardCell';
import { TokenLayer } from './TokenLayer';
import { DEBUG_BOARD } from '../../game/board';
import { getBoardThemeStyle } from '../../game/customizationStyles';
import { playerProfileService } from '../../services/playerProfileService';

interface LudoBoardProps {
  players: Player[];
  validMoves: number[];
  onSelectToken: (tokenId: number) => void;
  movingTokenStep?: VisualStep | null;
  activeCaptureAnim?: CaptureAnimation | null;
  className?: string;
  themeId?: string;
}

export const LudoBoard: React.FC<LudoBoardProps> = ({
  players,
  validMoves,
  onSelectToken,
  movingTokenStep = null,
  activeCaptureAnim = null,
  className = '',
  themeId,
}) => {
  const [debugMode, setDebugMode] = useState<boolean>(DEBUG_BOARD);
  const [activeTheme, setActiveTheme] = useState<string>(() => {
    return themeId || playerProfileService.getProfile().selectedTheme || 'classic';
  });

  useEffect(() => {
    if (themeId) {
      setActiveTheme(themeId);
      return;
    }
    const unsub = playerProfileService.subscribe((p) => {
      setActiveTheme(p.selectedTheme || 'classic');
    });
    return () => unsub();
  }, [themeId]);

  const themeStyle = useMemo(() => getBoardThemeStyle(activeTheme), [activeTheme]);

  const allTokens = useMemo(() => {
    return players.flatMap((p) => p.tokens);
  }, [players]);

  const getPlayerByColor = (color: PlayerColor) =>
    players.find((p) => p.color === color);

  // Generate the 72 walkway cells that form the cross
  const walkwayCells = useMemo(() => {
    const cells: { row: number; col: number; type: CellType }[] = [];

    const isInsideBase = (r: number, c: number) => {
      if (r < 6 && c < 6) return true; // Red base
      if (r < 6 && c > 8) return true; // Green base
      if (r > 8 && c < 6) return true; // Blue base
      if (r > 8 && c > 8) return true; // Yellow base
      return false;
    };

    const isCenter = (r: number, c: number) => {
      return r >= 6 && r <= 8 && c >= 6 && c <= 8;
    };

    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        if (isInsideBase(r, c) || isCenter(r, c)) continue;

        let type: CellType = 'COMMON';

        // Star Cells (Safe positions)
        if (r === 2 && c === 6) type = 'SAFE_STAR';
        else if (r === 6 && c === 12) type = 'SAFE_STAR';
        else if (r === 12 && c === 8) type = 'SAFE_STAR';
        else if (r === 8 && c === 2) type = 'SAFE_STAR';

        // Start Cells
        else if (r === 6 && c === 1) type = 'START_RED';
        else if (r === 1 && c === 8) type = 'START_GREEN';
        else if (r === 8 && c === 13) type = 'START_YELLOW';
        else if (r === 13 && c === 6) type = 'START_BLUE';

        // Home Stretches
        else if (r === 7 && c >= 1 && c <= 5) type = 'HOME_RED';
        else if (c === 7 && r >= 1 && r <= 5) type = 'HOME_GREEN';
        else if (r === 7 && c >= 9 && c <= 13) type = 'HOME_YELLOW';
        else if (c === 7 && r >= 9 && r <= 13) type = 'HOME_BLUE';

        cells.push({ row: r, col: c, type });
      }
    }

    return cells;
  }, []);

  return (
    <div
      id="ludo-board-frame"
      className={`relative w-full max-w-[480px] sm:max-w-[510px] md:max-w-[540px] aspect-square mx-auto p-1.5 sm:p-2 rounded-2xl select-none transition-all duration-300 ${themeStyle.frameClass} ${className}`}
    >
      {/* 15x15 Canonical Game Board Grid: Strictly gap-0, p-0 for mathematical alignment */}
      <div
        id="ludo-grid"
        className={`relative w-full h-full grid rounded-xl overflow-hidden transition-all duration-300 ${themeStyle.gridClass}`}
        style={{
          gridTemplateColumns: 'repeat(15, minmax(0, 1fr))',
          gridTemplateRows: 'repeat(15, minmax(0, 1fr))',
        }}
      >
        {/* Red Home Base (Top-Left: rows 1..6, cols 1..6) */}
        <div style={{ gridRow: '1 / span 6', gridColumn: '1 / span 6' }}>
          <HomeArea
            player={getPlayerByColor('RED')}
            color="RED"
            tokens={getPlayerByColor('RED')?.tokens || []}
            gridAreaClass="w-full h-full"
          />
        </div>

        {/* Green Home Base (Top-Right: rows 1..6, cols 10..15) */}
        <div style={{ gridRow: '1 / span 6', gridColumn: '10 / span 6' }}>
          <HomeArea
            player={getPlayerByColor('GREEN')}
            color="GREEN"
            tokens={getPlayerByColor('GREEN')?.tokens || []}
            gridAreaClass="w-full h-full"
          />
        </div>

        {/* Center Finish Area (Center: rows 7..9, cols 7..9) */}
        <div style={{ gridRow: '7 / span 3', gridColumn: '7 / span 3' }}>
          <FinishArea
            players={players}
            allTokens={allTokens}
            gridAreaClass="w-full h-full"
          />
        </div>

        {/* Blue Home Base (Bottom-Left: rows 10..15, cols 1..6) */}
        <div style={{ gridRow: '10 / span 6', gridColumn: '1 / span 6' }}>
          <HomeArea
            player={getPlayerByColor('BLUE')}
            color="BLUE"
            tokens={getPlayerByColor('BLUE')?.tokens || []}
            gridAreaClass="w-full h-full"
          />
        </div>

        {/* Yellow Home Base (Bottom-Right: rows 10..15, cols 10..15) */}
        <div style={{ gridRow: '10 / span 6', gridColumn: '10 / span 6' }}>
          <HomeArea
            player={getPlayerByColor('YELLOW')}
            color="YELLOW"
            tokens={getPlayerByColor('YELLOW')?.tokens || []}
            gridAreaClass="w-full h-full"
          />
        </div>

        {/* 72 Walkway Grid Cells */}
        {walkwayCells.map((cell) => (
          <BoardCell
            key={`${cell.row}_${cell.col}`}
            row={cell.row}
            col={cell.col}
            cellType={cell.type}
            showDebug={debugMode}
          />
        ))}

        {/* Dedicated Continuous Token Animation Overlay */}
        <TokenLayer
          players={players}
          validMoves={validMoves}
          onSelectToken={onSelectToken}
          movingTokenStep={movingTokenStep}
          activeCaptureAnim={activeCaptureAnim}
          showDebug={debugMode}
        />
      </div>

      {/* Dev Coordinate Debug Toggle (Requirement 19) */}
      <button
        type="button"
        id="btn-toggle-debug-grid"
        onClick={() => setDebugMode((prev) => !prev)}
        title="Toggle Board Coordinate Debug Grid"
        className="absolute -bottom-6 right-2 text-[9px] font-mono text-slate-500 hover:text-amber-400 transition-colors bg-slate-900/80 px-2 py-0.5 rounded border border-white/10"
      >
        {debugMode ? 'GRID DEBUG: ON' : 'GRID DEBUG: OFF'}
      </button>
    </div>
  );
};

