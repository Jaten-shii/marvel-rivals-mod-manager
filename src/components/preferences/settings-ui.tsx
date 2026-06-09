/**
 * Warm-Dark Editorial settings primitives — shared across all preference panes
 * so the Settings modal matches the rest of the app (Fraunces headings,
 * Quicksand body, JetBrains Mono micro-labels, warm-dark surfaces, accent).
 */
import * as React from 'react';
import { c, tint } from '@/shared/rivals-tokens';

/** A titled group: mono uppercase label + optional icon, then content. */
export function SettingsSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 px-0.5">
        {icon && <span style={{ color: c.accent, display: 'inline-flex' }}>{icon}</span>}
        <h3 style={{ color: c.ink3, fontFamily: c.mono, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>
          {title}
        </h3>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/** Recessed warm-dark card that holds setting rows. `pad` overrides padding. */
export function SettingsCard({ children, className = '', pad = 6 }: { children: React.ReactNode; className?: string; pad?: number }) {
  return (
    <div className={className} style={{ background: c.panel, border: `1px solid ${c.line}`, borderRadius: 12, padding: pad }}>
      {children}
    </div>
  );
}

/** A label + description block (left side of a row). */
export function FieldLabel({ label, description }: { label: string; description?: string }) {
  return (
    <div className="space-y-0.5">
      <div style={{ color: c.ink, fontFamily: c.font, fontSize: 13.5, fontWeight: 600 }}>{label}</div>
      {description && <div style={{ color: c.ink3, fontFamily: c.font, fontSize: 12 }}>{description}</div>}
    </div>
  );
}

/** Toggle row with label/description on the left and a control on the right. */
export function SettingRow({
  label,
  description,
  control,
}: {
  label: string;
  description?: string;
  control: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-lg transition-all duration-200"
      style={{ padding: '12px 14px', boxShadow: 'inset 0 0 0 0 transparent' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = tint(c.accent, 6); e.currentTarget.style.boxShadow = `inset 2px 0 0 ${tint(c.accent, 60)}` }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'inset 0 0 0 0 transparent' }}
    >
      <FieldLabel label={label} description={description} />
      <div className="flex-shrink-0">{control}</div>
    </div>
  );
}

/** A selectable tile (theme/font/intensity pickers). */
export function ChoiceTile({
  active,
  onClick,
  disabled,
  children,
  activeColor,
  className = '',
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  activeColor?: string;
  className?: string;
}) {
  const ring = activeColor ?? c.accent;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`settings-tile group relative flex flex-col items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={{
        borderRadius: 12,
        padding: 16,
        background: active ? tint(ring, 14) : c.panel,
        border: `1px solid ${active ? ring : c.line}`,
        boxShadow: active ? `0 0 0 1px ${ring}` : 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={(e) => { if (!active && !disabled) e.currentTarget.style.borderColor = c.line2 }}
      onMouseLeave={(e) => { if (!active && !disabled) e.currentTarget.style.borderColor = c.line }}
    >
      {active && (
        <span className="absolute" style={{ top: 8, right: 8, color: ring }}>
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </span>
      )}
      {children}
    </button>
  );
}
