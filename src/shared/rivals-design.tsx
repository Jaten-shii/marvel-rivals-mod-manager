/**
 * Warm-Dark Editorial design system — shared component atoms (JSX).
 *
 * Pure tokens/helpers live in rivals-tokens.ts (so this file can export only
 * components, satisfying React Fast Refresh). Import `c`, `tint`, etc. from
 * rivals-tokens; import these SVG icons and HeroChip from here.
 */
import { c, tint, getCharacterIconPath } from './rivals-tokens';
import { useDominantColor } from '../hooks/useDominantColor';

interface IconProps {
  stroke?: string;
  size?: number;
}

export function ShirtIcon({ stroke = 'currentColor', size = 11 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 2.5 L3 4 L1.5 6.5 L3 7.8 L4.2 7 V13.5 H11.8 V7 L13 7.8 L14.5 6.5 L13 4 L10.5 2.5" />
      <path d="M5.5 2.5 C6.2 4 9.8 4 10.5 2.5" />
    </svg>
  );
}

export function SpeakerIcon({ stroke = 'currentColor', size = 10 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6 H6 L10 3 V13 L6 10 H3 Z" />
      <path d="M12 5.5 C13.5 7 13.5 9 12 10.5" />
    </svg>
  );
}

export function FrameIcon({ stroke = 'currentColor', size = 10 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
      <path d="M2.5 6 H13.5 M6 13.5 V6" />
    </svg>
  );
}

export function ControllerIcon({ stroke = 'currentColor', size = 11 }: IconProps) {
  return (
    <svg width={size} height={(size * 10) / 11} viewBox="0 0 18 14" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3 H13 C15.2 3 16.5 4.5 16.5 6.5 C16.5 9 15 11 13 11 C12 11 11.3 10.3 10.5 9.5 H7.5 C6.7 10.3 6 11 5 11 C3 11 1.5 9 1.5 6.5 C1.5 4.5 2.8 3 5 3 Z" />
      <path d="M4 6 V8 M3 7 H5" />
      <circle cx="12" cy="6" r="0.6" fill={stroke} />
      <circle cx="13.5" cy="7.5" r="0.6" fill={stroke} />
    </svg>
  );
}

export function WarnIcon({ stroke = 'currentColor', size = 10 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2 L14.5 13.5 H1.5 Z" />
      <path d="M8 6.5 V9.5" />
      <circle cx="8" cy="11.5" r="0.6" fill={stroke} />
    </svg>
  );
}

export function PlusIcon({ stroke = 'currentColor', size = 10 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
      <path d="M8 3 V13 M3 8 H13" />
    </svg>
  );
}

export function ArrowIcon({ stroke = 'currentColor', size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8 H13 M9 4 L13 8 L9 12" />
    </svg>
  );
}

/** Category pill icon by category name. */
export function CategoryIcon({ category, stroke, size }: { category: string; stroke?: string; size?: number }) {
  switch (category) {
    case 'Audio':
      return <SpeakerIcon stroke={stroke} size={size} />;
    case 'UI':
      return <FrameIcon stroke={stroke} size={size} />;
    case 'Gameplay':
      return <ControllerIcon stroke={stroke} size={size} />;
    case 'Skins':
    case 'Skin':
    default:
      return <ShirtIcon stroke={stroke} size={size} />;
  }
}

/**
 * Round character avatar. Uses the real character icon, falling back to a
 * tinted initials chip if the image is missing. `ring` draws an inset accent
 * border for the active state.
 */
export function HeroChip({
  name,
  size = 28,
  ring = 'transparent',
}: {
  name: string;
  size?: number;
  ring?: string;
}) {
  const initials = name
    .split(/[\s·]+/)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <span style={{ position: 'relative', width: size, height: size, flex: '0 0 auto', display: 'inline-block' }}>
      <img
        src={getCharacterIconPath(name)}
        alt={name}
        loading="lazy"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          boxShadow: `inset 0 0 0 1.5px ${ring}`,
          border: `1px solid ${c.line}`,
          display: 'block',
        }}
        onError={(e) => {
          const t = e.target as HTMLImageElement;
          t.style.display = 'none';
          const fb = t.nextElementSibling as HTMLElement | null;
          if (fb) fb.style.display = 'flex';
        }}
      />
      <span
        style={{
          display: 'none',
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${c.line2}, ${c.line})`,
          color: c.ink2,
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'ui-sans-serif, system-ui',
          fontWeight: 700,
          fontSize: size * 0.36,
          boxShadow: `inset 0 0 0 1.5px ${ring}`,
        }}
      >
        {initials}
      </span>
    </span>
  );
}

/**
 * Round avatar whose ring is tinted by the image's most prominent color, with a
 * matching outward glow on hover. Used for character/costume icons. `src` is a
 * full image URL. Falls back to the accent color while the color resolves.
 */
export function RingAvatar({ src, alt, size, active }: { src: string; alt: string; size: number; active?: boolean }) {
  const dominant = useDominantColor(src);
  const ring = dominant ? `color-mix(in oklch, ${dominant} 65%, transparent)` : tint(c.accent, 35);
  const glow = dominant ?? 'var(--rivals-accent)';
  return (
    <span
      className={`rivals-ring grid place-items-center flex-shrink-0${active ? ' is-active' : ''}`}
      style={{ width: size, height: size, padding: 2, background: c.bg, border: `2px solid ${ring}`, boxSizing: 'border-box', borderRadius: '50%', ['--ring-glow' as never]: glow, transition: 'box-shadow 200ms ease, border-color 200ms ease, transform 200ms ease' }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="rounded-full object-cover w-full h-full"
        style={{ boxShadow: `0 0 0 1px ${c.line}` }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    </span>
  );
}

// ── Sidebar category icons ────────────────────────────────────────────────────
// Larger, layered marks for the Categories list, one per category, drawn in the
// category's own color. Each has a hover micro-animation driven by the parent
// row's `.cat-row:hover` (see App.css): the shirt tilts and its chest emblem
// glints, the speaker thumps while its waves ripple, the UI panels fan apart,
// the gamepad rumbles and its buttons flash.

/** Skins — a hero-suit shirt with a chest emblem that glints on hover. */
export function CatSkinsIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg className="cat-ic cat-ic-skins" width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <g className="mask-body">
        <path d="M7 3.4 L4.1 5 L2.4 8 L4.4 9.3 L5.7 8.4 V16.2 H14.3 V8.4 L15.6 9.3 L17.6 8 L15.9 5 L13 3.4" />
        <path d="M7 3.4 C7.9 5.2 12.1 5.2 13 3.4" />
        <path className="mask-eye" d="M10 9.4 L11.1 11.3 L10 13.2 L8.9 11.3 Z" fill={color} fillOpacity="0" stroke="none" />
      </g>
    </svg>
  );
}

/** Audio — speaker cone with ripple waves. */
export function CatAudioIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg className="cat-ic cat-ic-audio" width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path className="spk-body" d="M2.8 7.6 H5.9 L9.9 4.2 V15.8 L5.9 12.4 H2.8 Z" />
      <path className="spk-wave spk-wave-1" d="M12.4 7.5 C13.8 8.9 13.8 11.1 12.4 12.5" />
      <path className="spk-wave spk-wave-2" d="M14.6 5.4 C17 7.9 17 12.1 14.6 14.6" />
    </svg>
  );
}

/** UI — two layered interface panels. */
export function CatUIIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg className="cat-ic cat-ic-ui" width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <g className="ui-back">
        <rect x="5.6" y="2.8" width="11.6" height="9.6" rx="1.8" opacity="0.55" />
      </g>
      <g className="ui-front">
        <rect x="2.8" y="6.4" width="11.6" height="10" rx="1.8" fill="var(--rivals-bg)" />
        <path d="M5.1 9.2 H9.7" />
        <circle cx="5.8" cy="12.6" r="0.85" fill={color} stroke="none" />
        <path d="M7.7 12.6 H12.1" strokeWidth="1.1" opacity="0.7" />
      </g>
    </svg>
  );
}

/** Gameplay — a gamepad. */
export function CatGameplayIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg className="cat-ic cat-ic-pad" width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <g className="pad-body">
        <path d="M5.6 5.8 H14.4 C16.7 5.8 18.1 7.4 18.1 9.7 C18.1 12.4 16.6 14.4 14.7 14.4 C13.6 14.4 12.8 13.6 12 12.8 H8 C7.2 13.6 6.4 14.4 5.3 14.4 C3.4 14.4 1.9 12.4 1.9 9.7 C1.9 7.4 3.3 5.8 5.6 5.8 Z" />
        <path className="pad-dpad" d="M5.7 8.4 V10.9 M4.4 9.65 H7" />
        <circle className="pad-btn pad-btn-a" cx="13" cy="10.7" r="0.9" fill={color} stroke="none" opacity="0.8" />
        <circle className="pad-btn pad-btn-b" cx="14.9" cy="8.7" r="0.9" fill={color} stroke="none" opacity="0.8" />
      </g>
    </svg>
  );
}

/** Sidebar category icon by category name. */
export function SidebarCategoryIcon({ category, color, size = 18 }: { category: string; color: string; size?: number }) {
  switch (category) {
    case 'Audio':
      return <CatAudioIcon color={color} size={size} />;
    case 'UI':
      return <CatUIIcon color={color} size={size} />;
    case 'Gameplay':
      return <CatGameplayIcon color={color} size={size} />;
    case 'Skins':
    default:
      return <CatSkinsIcon color={color} size={size} />;
  }
}
