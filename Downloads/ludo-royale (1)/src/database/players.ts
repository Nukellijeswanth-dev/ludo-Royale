import { db } from './database';
import { UserProfile } from '../types/playerTypes';

export function getPlayerProfile(): UserProfile {
  return db.getProfile();
}

export function updatePlayerProfile(profile: UserProfile): void {
  db.saveProfile(profile);
}
