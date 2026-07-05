import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X, ArrowRight } from 'lucide-react';
import { c, tint } from '../shared/rivals-tokens';
import { useModConflicts } from '../hooks/useMods';
import type { ModConflict } from '../types/mod.types';

/**
 * Toolbar button that surfaces mod conflicts. Shows an alert icon with a count
 * badge when enabled mods override the same game assets; clicking opens a panel
 * listing each clash, which mods are involved, what overlaps (Body Mesh, Hair,
 * etc.), and which mod wins (loads first).
 */
export function ConflictsButton() {
  const { data: conflicts = [] } = useModConflicts();
  const [open, setOpen] = useState(false);

  const count = conflicts.length;
  if (count === 0) return null; // nothing to warn about, hide entirely

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="icon-btn flex items-center gap-1.5 h-8 px-2.5 rounded-[7px] cursor-pointer relative"
        data-tip={`${count} mod conflict${count === 1 ? '' : 's'} detected`}
        data-tip-side="bottom"
        style={{
          background: tint(c.warn, 16),
          border: `1px solid ${tint(c.warn, 45)}`,
          color: c.warn,
        }}
      >
        <AlertTriangle className="w-4 h-4" />
        <span style={{ fontFamily: c.font, fontSize: 12.5, fontWeight: 700 }}>{count}</span>
      </button>

      {open && createPortal(<ConflictsPanel conflicts={conflicts} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function ConflictsPanel({ conflicts, onClose }: { conflicts: ModConflict[]; onClose: () => void }) {
  return (
    <>
      <div
        className="fixed inset-0 z-[99]"
        style={{ background: 'color-mix(in oklch, black 45%, transparent)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{ animation: 'metadata-fade-in 220ms ease-out both' }}
        onClick={onClose}
      >
        <div
          className="flex flex-col rounded-[12px] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 'min(680px, 100%)',
            maxHeight: '82vh',
            background: c.panel,
            border: `1px solid ${tint(c.warn, 30)}`,
            boxShadow: '0 24px 70px rgba(0,0,0,0.55)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2.5 px-5 py-4"
            style={{ borderBottom: `1px solid var(--rivals-line)` }}
          >
            <AlertTriangle className="w-5 h-5" style={{ color: c.warn }} />
            <div className="flex flex-col">
              <span style={{ color: c.ink, fontFamily: c.font, fontSize: 16, fontWeight: 700 }}>
                Mod Conflicts
              </span>
              <span style={{ color: c.ink3, fontFamily: c.font, fontSize: 12.5 }}>
                {conflicts.length} clash{conflicts.length === 1 ? '' : 'es'} where enabled mods overwrite the same files
              </span>
            </div>
            <button
              onClick={onClose}
              className="ml-auto grid place-items-center cursor-pointer"
              style={{ width: 30, height: 30, borderRadius: 7, color: c.ink3 }}
              data-tip="Close" aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* List */}
          <div className="flex flex-col gap-3 px-5 py-4 overflow-y-auto">
            {conflicts.map((cf, i) => (
              <ConflictRow key={i} conflict={cf} />
            ))}
          </div>

          {/* Footer note */}
          <div
            className="px-5 py-3"
            style={{ borderTop: `1px solid var(--rivals-line)`, color: c.ink3, fontFamily: c.font, fontSize: 12 }}
          >
            The mod that loads first wins shared files. To resolve a clash, disable one of the mods.
          </div>
        </div>
      </div>
    </>
  );
}

function ConflictRow({ conflict }: { conflict: ModConflict }) {
  return (
    <div
      className="flex flex-col gap-2 rounded-[9px] p-3.5"
      style={{ background: c.panelHi, border: `1px solid var(--rivals-line)` }}
    >
      {/* Kinds */}
      <div className="flex items-center flex-wrap gap-1.5">
        {conflict.kinds.map((k) => (
          <span
            key={k}
            className="inline-flex items-center"
            style={{
              padding: '1.5px 9px',
              borderRadius: 999,
              background: tint(c.warn, 18),
              color: c.warn,
              border: `1px solid ${tint(c.warn, 40)}`,
              fontFamily: c.font,
              fontSize: 11.5,
              fontWeight: 600,
            }}
          >
            {k}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', color: c.ink3, fontFamily: c.font, fontSize: 11.5 }}>
          {conflict.assets.length} file{conflict.assets.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Mods involved */}
      <div className="flex items-center flex-wrap gap-2">
        {conflict.mods.map((m, idx) => (
          <span key={m.id} className="inline-flex items-center gap-2">
            {idx > 0 && <ArrowRight className="w-3.5 h-3.5" style={{ color: c.ink3 }} />}
            <span
              className="inline-flex items-center gap-1.5"
              style={{ color: m.wins ? c.ink : c.ink2, fontFamily: c.font, fontSize: 13.5, fontWeight: m.wins ? 700 : 500 }}
            >
              {m.title}
              {m.wins && (
                <span
                  style={{
                    padding: '0px 7px',
                    borderRadius: 999,
                    background: tint(c.accent, 22),
                    color: c.accent,
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}
                >
                  wins
                </span>
              )}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
