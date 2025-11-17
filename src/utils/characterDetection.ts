import type { Character } from '../types/mod.types';

// All Marvel Rivals characters with common variations
const CHARACTER_PATTERNS: Record<string, string[]> = {
  'Adam Warlock': ['adam', 'warlock', 'adamwarlock'],
  'Angela': ['angela'],
  'Black Panther': ['black-panther', 'blackpanther', 'panther', 't-challa', 'tchalla'],
  'Black Widow': ['black-widow', 'blackwidow', 'widow', 'natasha'],
  'Blade': ['blade', 'eric', 'brooks'],
  'Captain America': ['captain-america', 'captainamerica', 'cap', 'steve', 'rogers'],
  'Cloak and Dagger': ['cloak-dagger', 'cloakanddagger', 'cloak', 'dagger', 'tandy', 'tyrone'],
  'Daredevil': ['daredevil', 'matt', 'murdock'],
  'Doctor Strange': ['doctor-strange', 'doctorstrange', 'strange', 'stephen'],
  'Emma Frost': ['emma', 'frost', 'emmafrost'],
  'Gambit': ['gambit', 'remy', 'lebeau'],
  'Groot': ['groot'],
  'Hawkeye': ['hawkeye', 'clint', 'barton'],
  'Hela': ['hela'],
  'Hulk': ['hulk', 'bruce', 'banner'],
  'Human Torch': ['human-torch', 'humantorch', 'torch', 'johnny', 'storm'],
  'Invisible Woman': ['invisible-woman', 'invisiblewoman', 'invisible', 'sue', 'storm'],
  'Iron Fist': ['iron-fist', 'ironfist', 'danny', 'rand'],
  'Iron Man': ['iron-man', 'ironman', 'tony', 'stark'],
  'Jeff the Land Shark': ['jeff', 'landshark', 'shark'],
  'Loki': ['loki'],
  'Luna Snow': ['luna', 'snow', 'lunasnow'],
  'Magik': ['magik', 'illyana'],
  'Magneto': ['magneto', 'erik', 'magnus'],
  'Mantis': ['mantis'],
  'Mister Fantastic': ['mister-fantastic', 'misterfantastic', 'fantastic', 'reed', 'richards'],
  'Moon Knight': ['moon-knight', 'moonknight', 'marc', 'spector'],
  'Namor': ['namor'],
  'Peni Parker': ['peni', 'parker', 'peniparker', 'sp-dr', 'spdr'],
  'Phoenix': ['phoenix', 'jean', 'grey'],
  'Psylocke': ['psylocke', 'betsy', 'braddock'],
  'Rocket Raccoon': ['rocket', 'raccoon', 'rocketraccoon'],
  'Scarlet Witch': ['scarlet-witch', 'scarletwitch', 'wanda'],
  'Spider-Man': ['spider-man', 'spiderman', 'peter', 'parker', 'miles', 'morales'],
  'Squirrel Girl': ['squirrel', 'girl', 'squirrelgirl', 'doreen'],
  'Star-Lord': ['star-lord', 'starlord', 'peter', 'quill'],
  'Storm': ['storm', 'ororo'],
  'The Punisher': ['punisher', 'frank', 'castle'],
  'The Thing': ['thing', 'ben', 'grimm'],
  'Thor': ['thor', 'odinson'],
  'Ultron': ['ultron'],
  'Venom': ['venom', 'eddie', 'brock'],
  'Winter Soldier': ['winter-soldier', 'wintersoldier', 'bucky', 'barnes'],
  'Wolverine': ['wolverine', 'logan', 'weapon-x'],
};

/**
 * Attempts to detect a character name from a file path or mod name
 * Returns the detected character or null if no match found
 */
export function detectCharacterFromPath(path: string): Character | null {
  if (!path) return null;

  // Normalize the path: lowercase, replace separators with spaces
  const normalized = path
    .toLowerCase()
    .replace(/[_\-\/\\]/g, ' ')
    .replace(/\.pak$/i, '');

  console.log('[characterDetection] Analyzing path:', path);
  console.log('[characterDetection] Normalized:', normalized);

  // Check each character pattern
  for (const [character, patterns] of Object.entries(CHARACTER_PATTERNS)) {
    for (const pattern of patterns) {
      // First try word boundary match (e.g., "widow" in "black widow")
      const wordBoundaryRegex = new RegExp(`\\b${pattern}\\b`, 'i');
      if (wordBoundaryRegex.test(normalized)) {
        console.log('[characterDetection] Matched character:', character, 'with pattern (word boundary):', pattern);
        return character as Character;
      }

      // Also try substring match (e.g., "widow" in "thiccwidow")
      // This catches cases where the character name is part of a compound word
      if (normalized.includes(pattern)) {
        console.log('[characterDetection] Matched character:', character, 'with pattern (substring):', pattern);
        return character as Character;
      }
    }
  }

  console.log('[characterDetection] No character detected');
  return null;
}

/**
 * Detects character from multiple sources (pak file, folder path, mod name)
 * Returns the first match found
 */
export function detectCharacterFromMultipleSources(
  pakFile: string,
  folderPath?: string,
  modName?: string
): Character | null {
  // Try pak file name first
  let detected = detectCharacterFromPath(pakFile);
  if (detected) return detected;

  // Try folder path
  if (folderPath) {
    detected = detectCharacterFromPath(folderPath);
    if (detected) return detected;
  }

  // Try mod name
  if (modName) {
    detected = detectCharacterFromPath(modName);
    if (detected) return detected;
  }

  return null;
}
