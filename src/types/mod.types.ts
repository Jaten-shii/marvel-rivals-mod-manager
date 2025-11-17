/**
 * Type definitions for Marvel Rivals Mod Manager
 * These types match the Rust backend types defined in src-tauri/src/types.rs
 */

// ===== Mod Category =====
export type ModCategory = 'UI' | 'Audio' | 'Skins' | 'Gameplay';

// ===== Marvel Rivals Characters =====
export type Character =
  // Vanguards (9 total)
  | 'Captain America'
  | 'Doctor Strange'
  | 'Groot'
  | 'Hulk'
  | 'Magneto'
  | 'Peni Parker'
  | 'The Thing'
  | 'Thor'
  | 'Venom'
  // Duelists (24 total)
  | 'Angela'
  | 'Blade'
  | 'Black Panther'
  | 'Black Widow'
  | 'Daredevil'
  | 'Emma Frost'
  | 'Gambit'
  | 'Hawkeye'
  | 'Hela'
  | 'Human Torch'
  | 'Iron Fist'
  | 'Magik'
  | 'Mister Fantastic'
  | 'Moon Knight'
  | 'Namor'
  | 'Phoenix'
  | 'Psylocke'
  | 'Scarlet Witch'
  | 'Spider-Man'
  | 'Squirrel Girl'
  | 'Star-Lord'
  | 'Storm'
  | 'The Punisher'
  | 'Ultron'
  | 'Winter Soldier'
  | 'Wolverine'
  // Strategists (9 total)
  | 'Adam Warlock'
  | 'Cloak and Dagger'
  | 'Invisible Woman'
  | 'Iron Man'
  | 'Jeff the Land Shark'
  | 'Loki'
  | 'Luna Snow'
  | 'Mantis'
  | 'Rocket Raccoon';

// ===== Costume/Skin Types =====
export interface Costume {
  id: string; // Unique identifier (e.g., "symbiote", "2099")
  name: string; // Display name (e.g., "Symbiote Suit", "Spider-Man 2099")
  imagePath: string; // Path to costume icon image
  isDefault?: boolean; // Whether this is the default/classic skin
}

// ===== Mod Metadata =====
export interface ModMetadata {
  title: string;
  description: string;
  author: string | null;
  version: string | null;
  tags: string[];
  category: ModCategory;
  character: Character | null;
  costume: string | null; // Costume ID (e.g., "symbiote", "2099")
  isFavorite: boolean;
  isNsfw: boolean;
  createdAt: string; // ISO 8601 datetime
  updatedAt: string; // ISO 8601 datetime
  installDate: string; // ISO 8601 datetime
  profileIds: string[] | null;
  nexusModId: number | null;
  nexusFileId: number | null;
  nexusVersion: string | null;
}

// ===== Mod Info =====
export interface ModInfo {
  id: string;
  name: string;
  category: ModCategory;
  character: Character | null;
  enabled: boolean;
  isFavorite: boolean;
  filePath: string;
  thumbnailPath: string | null;
  metadata: ModMetadata;
  fileSize: number;
  installDate: string; // ISO 8601 datetime
  lastModified: string; // ISO 8601 datetime
  originalFileName: string;
  associatedFiles: string[];
}

// ===== App Settings =====
export interface AppSettings {
  gameDirectory: string | null;
  modDirectory: string | null;
  theme: string;
  autoOrganize: boolean;
  autoDetectGameDir: boolean;
  autoCheckUpdates: boolean;
}

// ===== Progress Types =====
export interface ModInstallProgress {
  currentFile: string;
  current: number;
  total: number;
  status: string;
}

export interface ModOrganizationProgress {
  currentFile: string;
  current: number;
  total: number;
  status: string;
  movedCount: number;
  errorCount: number;
  errors: string[];
}

export interface OrganizationResult {
  totalMods: number;
  movedMods: number;
  errorCount: number;
  errors: string[];
  duration: number;
}

export interface ExtractionProgress {
  currentFile: string;
  current: number;
  total: number;
  bytesExtracted: number;
}

// ===== Statistics Types =====
export interface AppStats {
  totalMods: number;
  enabledMods: number;
  disabledMods: number;
  totalSize: number;
}

export interface CategoryStats {
  category: ModCategory;
  count: number;
  enabled: number;
  disabled: number;
}

export interface CharacterStats {
  character: Character;
  count: number;
  enabled: number;
  disabled: number;
}

// ===== Filter Types =====
export interface ModFilters {
  search: string;
  category: ModCategory | null;
  character: Character | null;
  showEnabled: boolean;
  showDisabled: boolean;
  showFavorites: boolean;
  showNsfw: boolean;
}

// ===== UI State Types =====
export type ViewMode = 'grid' | 'list';
export type ThemeMode = 'dark-classic' | 'light-classic' | 'forest' | 'ruby' | 'ice' | 'system';

export interface UIState {
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  viewMode: ViewMode;
  selectedModId: string | null;
  filters: ModFilters;
}
