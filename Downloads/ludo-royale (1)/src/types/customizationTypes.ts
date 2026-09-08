export type TokenSkinId = 'classic' | 'royal' | 'neon' | 'fire' | 'ice' | 'galaxy';
export type BoardThemeId = 'classic' | 'royal' | 'night' | 'neon';
export type CustomizationItemType = 'AVATAR' | 'TOKEN_SKIN' | 'BOARD_THEME';

export interface CustomizationItem {
  id: string;
  type: CustomizationItemType;
  name: string;
  description: string;
  price: number; // 0 for default/free
  icon: string;
  badge?: string;
}

export interface UserGameSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  vibrationEnabled: boolean;
  animationsEnabled: boolean;
  notificationsEnabled: boolean;
  smoothAnimations?: boolean;
}

export interface RoomRuleSettings {
  maxPlayers: number; // 2 to 4
  autoMove: boolean; // Auto-move if only 1 legal move
  quickDice: boolean; // Faster dice animation
}

export const BUILTIN_AVATARS: string[] = [
  '🙂', '😎', '🤖', '👑',
  '🔥', '🎮', '🐯', '🦁',
  '🐼', '🐸', '🦊', '🐲',
];

export const TOKEN_SKINS_CATALOG: CustomizationItem[] = [
  {
    id: 'classic',
    type: 'TOKEN_SKIN',
    name: 'Classic Spheres',
    description: 'The iconic traditional tournament tokens with polished 3D spheres',
    price: 0,
    icon: '🔴',
    badge: 'Standard',
  },
  {
    id: 'royal',
    type: 'TOKEN_SKIN',
    name: 'Royal Crown',
    description: 'Gilded gold-plated metallic bezel with royal insignia and majestic sheen',
    price: 500,
    icon: '👑',
    badge: 'Popular',
  },
  {
    id: 'neon',
    type: 'TOKEN_SKIN',
    name: 'Cyber Neon',
    description: 'Electric synthwave laser glow with ultra-bright luminous halos',
    price: 1000,
    icon: '⚡',
    badge: 'Vibrant',
  },
  {
    id: 'fire',
    type: 'TOKEN_SKIN',
    name: 'Blazing Ember',
    description: 'Molten volcanic core with radiating solar flares and heat waves',
    price: 1500,
    icon: '🔥',
    badge: 'Animated',
  },
  {
    id: 'ice',
    type: 'TOKEN_SKIN',
    name: 'Frost Crystal',
    description: 'Glacial diamond cut edges with sub-zero sparkling luminescent frost',
    price: 1500,
    icon: '❄️',
    badge: 'Cool',
  },
  {
    id: 'galaxy',
    type: 'TOKEN_SKIN',
    name: 'Cosmic Nebula',
    description: 'Deep celestial star cluster with stellar shimmer and astral starlight',
    price: 2500,
    icon: '🌌',
    badge: 'Legendary',
  },
];

export const BOARD_THEMES_CATALOG: CustomizationItem[] = [
  {
    id: 'classic',
    type: 'BOARD_THEME',
    name: 'Classic Royale',
    description: 'Rich dark slate board frame with high-contrast quadrants',
    price: 0,
    icon: '🎯',
    badge: 'Default',
  },
  {
    id: 'royal',
    type: 'BOARD_THEME',
    name: 'Royal Palace',
    description: 'Velvet obsidian finish with ornate gilded gold filigree borders',
    price: 1000,
    icon: '🏛️',
    badge: 'Luxury',
  },
  {
    id: 'night',
    type: 'BOARD_THEME',
    name: 'Midnight Oasis',
    description: 'Deep starlit night sky with glowing starry walkway paths',
    price: 1500,
    icon: '🌙',
    badge: 'Atmospheric',
  },
  {
    id: 'neon',
    type: 'BOARD_THEME',
    name: 'Neon Arcade',
    description: 'Retro-futuristic synthwave grid with glowing electric tracks',
    price: 2000,
    icon: '🕹️',
    badge: 'Cyberpunk',
  },
];
