import { db } from './database';
import { GameHistoryRecord } from '../types/playerTypes';

export function getPastGames(): GameHistoryRecord[] {
  return db.getGameHistory();
}

export function saveCompletedGame(record: GameHistoryRecord): void {
  db.saveGameRecord(record);
}
