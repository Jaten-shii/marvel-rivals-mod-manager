/**
 * Warm-Dark Editorial design system — pure tokens & helpers (no JSX).
 *
 * Kept separate from rivals-design.tsx so that file exports only components
 * (React Fast Refresh requirement). The `c` palette maps to CSS variables
 * defined in index.css: surfaces are fixed warm-dark; accents follow the app's
 * swappable accent (--primary). Use `tint()` for translucent accent fills.
 */

import { convertFileSrc } from '@tauri-apps/api/core';

// Palette tokens — every value is a CSS var so the swappable accent flows through.
export const c = {
  bg: 'var(--rivals-bg)',
  titlebar: 'var(--rivals-titlebar)',
  panel: 'var(--rivals-panel)',
  panelHi: 'var(--rivals-panel-hi)',
  line: 'var(--rivals-line)',
  line2: 'var(--rivals-line2)',
  ink: 'var(--rivals-ink)',
  ink2: 'var(--rivals-ink2)',
  ink3: 'var(--rivals-ink3)',
  muted: 'var(--rivals-muted)',
  accent: 'var(--rivals-accent)',
  accent2: 'var(--rivals-accent2)',
  onAccent: 'var(--rivals-on-accent)',
  ok: 'var(--rivals-ok)',
  warn: 'var(--rivals-warn)',
  err: 'var(--rivals-err)',
  nsfw: 'var(--rivals-nsfw)',
  font: 'var(--rivals-font)',
  mono: 'var(--rivals-mono)',
  display: 'var(--rivals-display)',
  condensed: 'var(--rivals-condensed)',
} as const;

/** Translucent version of any token color. pct is 0–100 (opacity of the color). */
export function tint(color: string, pct: number): string {
  return `color-mix(in oklch, ${color} ${pct}%, transparent)`;
}

/** Category → swatch/pill color token. */
export function categoryColor(category: string): string {
  switch (category) {
    case 'Audio':
      return 'var(--rivals-cat-audio)';
    case 'UI':
      return 'var(--rivals-cat-ui)';
    case 'Gameplay':
      return 'var(--rivals-cat-gameplay)';
    case 'Skins':
    case 'Skin':
    default:
      return 'var(--rivals-cat-skin)';
  }
}

/** Split a mod title into its main name and an optional italic "variant" prefix. */
export function parseTitleParts(title: string): { main: string; variant: string | null } {
  const bracketMatch = title.match(/^(.+?)\s*\[([^\]]+)\](.*)$/);
  if (bracketMatch && bracketMatch[1]) {
    return { main: bracketMatch[1].trim(), variant: `[${bracketMatch[2]}]${bracketMatch[3] || ''}` };
  }
  const dashMatch = title.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch && dashMatch[1] && dashMatch[2]) {
    return { main: dashMatch[1].trim(), variant: dashMatch[2].trim() };
  }
  return { main: title, variant: null };
}

/** Format a byte count to a short human string. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

const CHAR_ICON_OVERRIDES: Record<string, string> = {
  'Adam Warlock': 'Adam.png',
  'Jeff the Land Shark': 'Jeff.png',
  'The Punisher': 'Punisher.png',
  'Mister Fantastic': 'Mr. Fantastic.png',
  'Cloak and Dagger': 'Cloak & Dagger.png',
  'Spider-Man': 'Spider-Man.png',
  'Star-Lord': 'Star-Lord.png',
};

export function getCharacterIconPath(character: string | null | undefined): string {
  if (!character) return '/assets/character-icons/default.png';
  const file = CHAR_ICON_OVERRIDES[character] || `${character}.png`;
  return `/assets/character-icons/${file}`;
}

/**
 * Resolve a costume's icon URL. Costumes bundled with this build load from the
 * app's static assets; costumes synced after release load from app data via
 * the asset protocol.
 */
export function getCostumeIconSrc(costume: { imagePath: string; localIconPath?: string }): string {
  if (costume.localIconPath) return convertFileSrc(costume.localIconPath);
  return `/assets/costume-icons/${costume.imagePath}`;
}
