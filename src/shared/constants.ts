export const ENVIRONMENT = {
  IS_DEV: (
    process.env.NODE_ENV === 'development' &&
    process.env.ELECTRON_IS_DEV !== 'false' &&
    !process.env.ELECTRON_IS_PACKAGED
  ),
  IS_PRODUCTION: (
    process.env.NODE_ENV === 'production' ||
    process.env.ELECTRON_IS_DEV === 'false' ||
    process.env.ELECTRON_IS_PACKAGED === 'true'
  ),
  // Safe fallback for build validation
  NODE_ENV: process.env.NODE_ENV || 'production'
}

export const PLATFORM = {
  IS_MAC: process.platform === 'darwin',
  IS_WINDOWS: process.platform === 'win32',
  IS_LINUX: process.platform === 'linux',
}

// ===== Marvel Rivals Mod Manager Constants =====

export const APP_INFO = {
  NAME: 'Marvel Rivals Mod Manager',
  VERSION: '1.0.0',
  AUTHOR: 'Marvel Rivals Mod Manager',
  DESCRIPTION: 'Professional mod manager for Marvel Rivals',
}

// Default game installation paths
export const DEFAULT_GAME_PATHS = {
  STEAM_DEFAULT: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\MarvelRivals',
  STEAM_ALTERNATIVE: 'C:\\Steam\\steamapps\\common\\MarvelRivals',
  EPIC_DEFAULT: 'C:\\Program Files\\Epic Games\\MarvelRivals',
  MODS_SUBPATH: 'MarvelGame\\Marvel\\Content\\Paks\\~mods',
}

// AppData structure
export const APPDATA_STRUCTURE = {
  ROOT: 'Marvel Rivals Mod Manager',
  METADATA: 'metadata',
  THUMBNAILS: 'thumbnails',
  SETTINGS: 'settings.json',
  LOGS: 'logs',
}

// Supported file extensions
export const SUPPORTED_EXTENSIONS = {
  MOD_FILES: ['.pak', '.ucas', '.utoc'],
  ARCHIVE_FILES: ['.zip', '.rar', '.7z'],
  IMAGE_FILES: ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
  ALL_SUPPORTED: ['.pak', '.ucas', '.utoc', '.zip', '.rar', '.7z'],
}

// Category configuration with colors and descriptions
export const CATEGORIES = {
  UI: {
    name: 'UI',
    color: '#3b82f6', // Blue
    description: 'User interface modifications and HUD changes',
    keywords: ['ui', 'hud', 'interface', 'menu', 'overlay', 'crosshair', 'reticle']
  },
  Audio: {
    name: 'Audio',
    color: '#10b981', // Green
    description: 'Sound effects, music, and audio modifications',
    keywords: ['audio', 'sound', 'music', 'sfx', 'voice', 'ambient', 'soundtrack']
  },
  Skins: {
    name: 'Skins',
    color: '#f59e0b', // Orange
    description: 'Character skins, costumes, and visual modifications',
    keywords: ['skin', 'costume', 'outfit', 'appearance', 'visual', 'texture', 'material']
  },
  Gameplay: {
    name: 'Gameplay',
    color: '#ef4444', // Red
    description: 'Gameplay mechanics, balance, and functional changes',
    keywords: ['gameplay', 'balance', 'mechanic', 'ability', 'stat', 'damage', 'health']
  }
} as const

// Character information with icon paths
export const CHARACTERS = {
  'Adam': {
    name: 'Adam',
    displayName: 'Adam Warlock',
    iconPath: 'Assets/character-icons/Adam.png',
    role: 'Strategist',
    keywords: ['adam', 'warlock', 'strategist']
  },
  'Black Panther': {
    name: 'Black Panther',
    displayName: 'Black Panther',
    iconPath: 'Assets/character-icons/Black Panther.png',
    role: 'Duelist',
    keywords: ['black', 'panther', 'tchalla', 'wakanda', 'duelist']
  },
  'Black Widow': {
    name: 'Black Widow',
    displayName: 'Black Widow',
    iconPath: 'Assets/character-icons/Black Widow.png',
    role: 'Duelist',
    keywords: ['black', 'widow', 'natasha', 'romanoff', 'duelist']
  },
  'Bruce Banner': {
    name: 'Bruce Banner',
    displayName: 'Bruce Banner',
    iconPath: 'Assets/character-icons/Bruce Banner.png',
    role: 'Strategist',
    keywords: ['bruce', 'banner', 'hulk', 'strategist']
  },
  'Captain America': {
    name: 'Captain America',
    displayName: 'Captain America',
    iconPath: 'Assets/character-icons/Captain America.png',
    role: 'Vanguard',
    keywords: ['captain', 'america', 'steve', 'rogers', 'shield', 'vanguard']
  },
  'Cloak & Dagger': {
    name: 'Cloak & Dagger',
    displayName: 'Cloak & Dagger',
    iconPath: 'Assets/character-icons/Cloak & Dagger.png',
    role: 'Duelist',
    keywords: ['cloak', 'dagger', 'tyrone', 'tandy', 'duelist']
  },
  'Doctor Strange': {
    name: 'Doctor Strange',
    displayName: 'Doctor Strange',
    iconPath: 'Assets/character-icons/Doctor Strange.png',
    role: 'Vanguard',
    keywords: ['doctor', 'strange', 'stephen', 'sorcerer', 'vanguard']
  },
  'Emma Frost': {
    name: 'Emma Frost',
    displayName: 'Emma Frost',
    iconPath: 'Assets/character-icons/Emma Frost.png',
    role: 'Strategist',
    keywords: ['emma', 'frost', 'white', 'queen', 'strategist']
  },
  'Groot': {
    name: 'Groot',
    displayName: 'Groot',
    iconPath: 'Assets/character-icons/Groot.png',
    role: 'Vanguard',
    keywords: ['groot', 'tree', 'guardian', 'vanguard']
  },
  'Hawkeye': {
    name: 'Hawkeye',
    displayName: 'Hawkeye',
    iconPath: 'Assets/character-icons/Hawkeye.png',
    role: 'Duelist',
    keywords: ['hawkeye', 'clint', 'barton', 'archer', 'duelist']
  },
  'Hela': {
    name: 'Hela',
    displayName: 'Hela',
    iconPath: 'Assets/character-icons/Hela.png',
    role: 'Duelist',
    keywords: ['hela', 'goddess', 'death', 'asgard', 'duelist']
  },
  'Hulk': {
    name: 'Hulk',
    displayName: 'Hulk',
    iconPath: 'Assets/character-icons/Hulk.png',
    role: 'Vanguard',
    keywords: ['hulk', 'bruce', 'banner', 'green', 'vanguard']
  },
  'Human Torch': {
    name: 'Human Torch',
    displayName: 'Human Torch',
    iconPath: 'Assets/character-icons/Human Torch.png',
    role: 'Duelist',
    keywords: ['human', 'torch', 'johnny', 'storm', 'fire', 'duelist']
  },
  'Invisible Woman': {
    name: 'Invisible Woman',
    displayName: 'Invisible Woman',
    iconPath: 'Assets/character-icons/Invisible Woman.png',
    role: 'Strategist',
    keywords: ['invisible', 'woman', 'sue', 'storm', 'strategist']
  },
  'Iron Fist': {
    name: 'Iron Fist',
    displayName: 'Iron Fist',
    iconPath: 'Assets/character-icons/Iron Fist.png',
    role: 'Vanguard',
    keywords: ['iron', 'fist', 'danny', 'rand', 'vanguard']
  },
  'Iron Man': {
    name: 'Iron Man',
    displayName: 'Iron Man',
    iconPath: 'Assets/character-icons/Iron Man.png',
    role: 'Duelist',
    keywords: ['iron', 'man', 'tony', 'stark', 'duelist']
  },
  'Jeff': {
    name: 'Jeff',
    displayName: 'Jeff the Land Shark',
    iconPath: 'Assets/character-icons/Jeff.png',
    role: 'Strategist',
    keywords: ['jeff', 'land', 'shark', 'strategist']
  },
  'Loki': {
    name: 'Loki',
    displayName: 'Loki',
    iconPath: 'Assets/character-icons/Loki.png',
    role: 'Strategist',
    keywords: ['loki', 'trickster', 'asgard', 'strategist']
  },
  'Luna Snow': {
    name: 'Luna Snow',
    displayName: 'Luna Snow',
    iconPath: 'Assets/character-icons/Luna Snow.png',
    role: 'Strategist',
    keywords: ['luna', 'snow', 'ice', 'strategist']
  },
  'Magik': {
    name: 'Magik',
    displayName: 'Magik',
    iconPath: 'Assets/character-icons/Magik.png',
    role: 'Duelist',
    keywords: ['magik', 'illyana', 'rasputin', 'duelist']
  },
  'Magneto': {
    name: 'Magneto',
    displayName: 'Magneto',
    iconPath: 'Assets/character-icons/Magneto.png',
    role: 'Vanguard',
    keywords: ['magneto', 'erik', 'lehnsherr', 'metal', 'vanguard']
  },
  'Mantis': {
    name: 'Mantis',
    displayName: 'Mantis',
    iconPath: 'Assets/character-icons/Mantis.png',
    role: 'Strategist',
    keywords: ['mantis', 'guardian', 'strategist']
  },
  'Moon Knight': {
    name: 'Moon Knight',
    displayName: 'Moon Knight',
    iconPath: 'Assets/character-icons/Moon Knight.png',
    role: 'Duelist',
    keywords: ['moon', 'knight', 'marc', 'spector', 'duelist']
  },
  'Mr. Fantastic': {
    name: 'Mr. Fantastic',
    displayName: 'Mr. Fantastic',
    iconPath: 'Assets/character-icons/Mr. Fantastic.png',
    role: 'Duelist',
    keywords: ['mr', 'fantastic', 'reed', 'richards', 'stretch', 'duelist']
  },
  'Namor': {
    name: 'Namor',
    displayName: 'Namor',
    iconPath: 'Assets/character-icons/Namor.png',
    role: 'Duelist',
    keywords: ['namor', 'submariner', 'atlantis', 'duelist']
  },
  'Peni Parker': {
    name: 'Peni Parker',
    displayName: 'Peni Parker',
    iconPath: 'Assets/character-icons/Peni Parker.png',
    role: 'Vanguard',
    keywords: ['peni', 'parker', 'sp//dr', 'spider', 'vanguard']
  },
  'Phoenix': {
    name: 'Phoenix',
    displayName: 'Phoenix',
    iconPath: 'Assets/character-icons/Phoenix.png',
    role: 'Duelist',
    keywords: ['phoenix', 'jean', 'grey', 'fire', 'duelist']
  },
  'Psylocke': {
    name: 'Psylocke',
    displayName: 'Psylocke',
    iconPath: 'Assets/character-icons/Psylocke.png',
    role: 'Duelist',
    keywords: ['psylocke', 'betsy', 'braddock', 'psychic', 'duelist']
  },
  'Punisher': {
    name: 'Punisher',
    displayName: 'Punisher',
    iconPath: 'Assets/character-icons/Punisher.png',
    role: 'Duelist',
    keywords: ['punisher', 'frank', 'castle', 'duelist']
  },
  'Rocket Raccoon': {
    name: 'Rocket Raccoon',
    displayName: 'Rocket Raccoon',
    iconPath: 'Assets/character-icons/Rocket Raccoon.png',
    role: 'Strategist',
    keywords: ['rocket', 'raccoon', 'guardian', 'strategist']
  },
  'Scarlet Witch': {
    name: 'Scarlet Witch',
    displayName: 'Scarlet Witch',
    iconPath: 'Assets/character-icons/Scarlet Witch.png',
    role: 'Duelist',
    keywords: ['scarlet', 'witch', 'wanda', 'maximoff', 'duelist']
  },
  'Spider-Man': {
    name: 'Spider-Man',
    displayName: 'Spider-Man',
    iconPath: 'Assets/character-icons/Spider-Man.png',
    role: 'Duelist',
    keywords: ['spider', 'man', 'peter', 'parker', 'duelist']
  },
  'Squirrel Girl': {
    name: 'Squirrel Girl',
    displayName: 'Squirrel Girl',
    iconPath: 'Assets/character-icons/Squirrel Girl.png',
    role: 'Duelist',
    keywords: ['squirrel', 'girl', 'doreen', 'green', 'duelist']
  },
  'Star-Lord': {
    name: 'Star-Lord',
    displayName: 'Star-Lord',
    iconPath: 'Assets/character-icons/Star-Lord.png',
    role: 'Duelist',
    keywords: ['star', 'lord', 'peter', 'quill', 'guardian', 'duelist']
  },
  'Storm': {
    name: 'Storm',
    displayName: 'Storm',
    iconPath: 'Assets/character-icons/Storm.png',
    role: 'Duelist',
    keywords: ['storm', 'ororo', 'munroe', 'weather', 'duelist']
  },
  'The Thing': {
    name: 'The Thing',
    displayName: 'The Thing',
    iconPath: 'Assets/character-icons/The Thing.png',
    role: 'Vanguard',
    keywords: ['thing', 'ben', 'grimm', 'rock', 'vanguard']
  },
  'Thor': {
    name: 'Thor',
    displayName: 'Thor',
    iconPath: 'Assets/character-icons/Thor.png',
    role: 'Vanguard',
    keywords: ['thor', 'odinson', 'hammer', 'asgard', 'vanguard']
  },
  'Ultron': {
    name: 'Ultron',
    displayName: 'Ultron',
    iconPath: 'Assets/character-icons/Ultron.png',
    role: 'Vanguard',
    keywords: ['ultron', 'robot', 'ai', 'vanguard']
  },
  'Venom': {
    name: 'Venom',
    displayName: 'Venom',
    iconPath: 'Assets/character-icons/Venom.png',
    role: 'Vanguard',
    keywords: ['venom', 'symbiote', 'eddie', 'brock', 'vanguard']
  },
  'Winter Soldier': {
    name: 'Winter Soldier',
    displayName: 'Winter Soldier',
    iconPath: 'Assets/character-icons/Winter Soldier.png',
    role: 'Duelist',
    keywords: ['winter', 'soldier', 'bucky', 'barnes', 'duelist']
  },
  'Wolverine': {
    name: 'Wolverine',
    displayName: 'Wolverine',
    iconPath: 'Assets/character-icons/Wolverine.png',
    role: 'Duelist',
    keywords: ['wolverine', 'logan', 'james', 'howlett', 'duelist']
  }
} as const

// Default application settings
export const DEFAULT_SETTINGS = {
  gameDirectory: '',
  theme: 'dark' as const,
  defaultViewMode: 'grid' as const,
  sortBy: 'name' as const,
  sortOrder: 'asc' as const,
  autoOrganize: true,
  autoDetectCategory: true,
  autoDetectCharacter: true,
  showThumbnails: true,
  enableAnimations: true,
  checkForUpdates: true,
  firstLaunch: true,
}

// Theme configurations
export const THEMES = {
  light: {
    name: 'Light',
    description: 'Clean light theme for better visibility'
  },
  dark: {
    name: 'Dark',
    description: 'Default dark theme with vibrant accents'
  },
  glass: {
    name: 'Glass',
    description: 'Translucent glass effect with backdrop blur'
  }
} as const

// Animation durations (in milliseconds)
export const ANIMATIONS = {
  FAST: 150,
  NORMAL: 250,
  SLOW: 350,
  PANEL_SLIDE: 300,
  HOVER_SCALE: 200,
  THEME_TRANSITION: 400,
}

// File size limits and formatting
export const FILE_LIMITS = {
  MAX_MOD_SIZE: 1024 * 1024 * 1024, // 1GB
  MAX_THUMBNAIL_SIZE: 10 * 1024 * 1024, // 10MB
  THUMBNAIL_DIMENSIONS: { width: 256, height: 256 },
}

// Validation patterns
export const VALIDATION = {
  MOD_NAME_PATTERN: /^[a-zA-Z0-9\s\-_\(\)]+$/,
  VERSION_PATTERN: /^\d+\.\d+\.\d+$/,
  URL_PATTERN: /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i,
}

// Error messages
export const ERROR_MESSAGES = {
  GAME_NOT_FOUND: 'Marvel Rivals installation not found. Please select the game directory manually.',
  MODS_FOLDER_NOT_WRITABLE: 'Cannot write to mods folder. Please check permissions.',
  INVALID_MOD_FILE: 'Invalid mod file. Supported formats: .pak, .ucas, .utoc, .zip, .rar, .7z',
  INVALID_ARCHIVE: 'Cannot extract archive. File may be corrupted or password protected.',
  DUPLICATE_MOD: 'A mod with this name already exists.',
  FILE_TOO_LARGE: 'File is too large. Maximum size is 1GB.',
  INVALID_THUMBNAIL: 'Invalid image format. Supported formats: PNG, JPG, GIF, WebP.',
  NETWORK_ERROR: 'Unable to download thumbnail. Please check your internet connection.',
}

// Success messages
export const SUCCESS_MESSAGES = {
  MOD_INSTALLED: 'Mod installed successfully!',
  MOD_ENABLED: 'Mod enabled successfully!',
  MOD_DISABLED: 'Mod disabled successfully!',
  MOD_DELETED: 'Mod deleted successfully!',
  SETTINGS_SAVED: 'Settings saved successfully!',
  GAME_DIRECTORY_DETECTED: 'Game directory detected automatically!',
  THUMBNAIL_SAVED: 'Thumbnail saved successfully!',
}

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  TOGGLE_THEME: 'Ctrl+T',
  TOGGLE_VIEW_MODE: 'Ctrl+Shift+V',
  OPEN_SETTINGS: 'Ctrl+,',
  REFRESH_MODS: 'F5',
  SEARCH_FOCUS: 'Ctrl+F',
  SELECT_ALL: 'Ctrl+A',
}
