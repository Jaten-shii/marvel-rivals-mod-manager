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
export function RingAvatar({ src, alt, size }: { src: string; alt: string; size: number }) {
  const dominant = useDominantColor(src);
  const ring = dominant ? `color-mix(in oklch, ${dominant} 65%, transparent)` : tint(c.accent, 35);
  const glow = dominant ?? 'var(--rivals-accent)';
  return (
    <span
      className="rivals-ring grid place-items-center flex-shrink-0"
      style={{ width: size, height: size, padding: 2, background: c.bg, border: `2px solid ${ring}`, boxSizing: 'border-box', borderRadius: '50%', ['--ring-glow' as never]: glow, transition: 'box-shadow 200ms ease, border-color 200ms ease' }}
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
