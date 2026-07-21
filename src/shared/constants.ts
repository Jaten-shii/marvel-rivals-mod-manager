import type { Character, ModCategory } from '../types/mod.types';

// App version (synchronized with package.json)
export const APP_VERSION = '8.1.0';

// All Marvel Rivals characters in alphabetical order
export const ALL_CHARACTERS: Character[] = [
  'All Characters',
  'Adam Warlock',
  'Angela',
  'Black Panther',
  'Black Widow',
  'Black Cat',
  'Blade',
  'Captain America',
  'Cloak and Dagger',
  'Cyclops',
  'Daredevil',
  'Deadpool',
  'Devil Dinosaur',
  'Doctor Strange',
  'Elsa Bloodstone',
  'Emma Frost',
  'Gambit',
  'Groot',
  'Hawkeye',
  'Hela',
  'Hulk',
  'Human Torch',
  'Invisible Woman',
  'Iron Fist',
  'Iron Man',
  'Jeff the Land Shark',
  'Jubilee',
  'Loki',
  'Luna Snow',
  'Magik',
  'Magneto',
  'Mantis',
  'Mister Fantastic',
  'Moon Knight',
  'Namor',
  'Peni Parker',
  'Phoenix',
  'Psylocke',
  'Rocket Raccoon',
  'Rogue',
  'Scarlet Witch',
  'Spider-Man',
  'Squirrel Girl',
  'Star-Lord',
  'Storm',
  'The Punisher',
  'The Thing',
  'Thor',
  'Ultron',
  'Venom',
  'Winter Soldier',
  'White Fox',
  'Wolverine',
];

// Mod categories in display order
export const MOD_CATEGORIES: ModCategory[] = ['UI', 'Audio', 'Skins', 'Gameplay'];

// ── Character roles (Season 9 roster) ──
// Deadpool is triple-role in game; listed under his original Duelist slot.
export type CharacterRole = 'Vanguard' | 'Duelist' | 'Strategist';
export type PlayableCharacter = Exclude<Character, 'All Characters'>;

export const ROLE_ORDER: CharacterRole[] = ['Vanguard', 'Duelist', 'Strategist'];

// Role identity colors (match the game's role iconography)
export const ROLE_COLORS: Record<CharacterRole, string> = {
  Vanguard: '#5b9bd0',
  Duelist: '#d95f52',
  Strategist: '#5bbd8b',
};

export const CHARACTER_ROLES: Record<CharacterRole, PlayableCharacter[]> = {
  Vanguard: [
    'Angela', 'Captain America', 'Devil Dinosaur', 'Doctor Strange', 'Emma Frost',
    'Groot', 'Hulk', 'Magneto', 'Peni Parker', 'Rogue', 'The Thing', 'Thor', 'Venom',
  ],
  Duelist: [
    'Black Cat', 'Black Panther', 'Black Widow', 'Blade', 'Cyclops', 'Daredevil',
    'Deadpool', 'Elsa Bloodstone', 'Hawkeye', 'Hela', 'Human Torch', 'Iron Fist',
    'Iron Man', 'Magik', 'Mister Fantastic', 'Moon Knight', 'Namor', 'Phoenix',
    'Psylocke', 'Scarlet Witch', 'Spider-Man', 'Squirrel Girl', 'Star-Lord', 'Storm',
    'The Punisher', 'Winter Soldier', 'Wolverine',
  ],
  Strategist: [
    'Adam Warlock', 'Cloak and Dagger', 'Gambit', 'Invisible Woman',
    'Jeff the Land Shark', 'Jubilee', 'Loki', 'Luna Snow', 'Mantis',
    'Rocket Raccoon', 'Ultron', 'White Fox',
  ],
};
