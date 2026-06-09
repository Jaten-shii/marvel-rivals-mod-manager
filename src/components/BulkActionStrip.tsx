import { useState } from 'react';
import { CircleCheck, CircleX, FolderCog, Trash2, Settings } from 'lucide-react';
import { useUIStore } from '@/stores';
import { useGetMods, useSetModsEnabled, useDeleteMod } from '@/hooks/useMods';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import { c, tint } from '@/shared/rivals-tokens';

interface BulkToggleProgress {
  current: number;
  total: number;
  enabled: boolean;
}

/** Format a seconds estimate as a short human string ("~12s", "~1m 30s"). */
function formatEta(seconds: number): string {
  if (seconds < 1) return 'almost done';
  if (seconds < 60) return `~${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return s > 0 ? `~${m}m ${s}s` : `~${m}m`;
}

type BulkOp = 'enable' | 'disable' | 'delete' | 'disableNsfw';

/**
 * Horizontal bulk-action strip shown below the section header (Cards/Gallery).
 * Operates on the NSFW-respecting set of mods (matches the sidebar's old Tools).
 * Self-contained: owns its progress + confirm dialogs.
 */
export function BulkActionStrip() {
  const filters = useUIStore((s) => s.filters);
  const { data: mods } = useGetMods();
  const setModsEnabled = useSetModsEnabled();
  const deleteMod = useDeleteMod();

  const [showProgress, setShowProgress] = useState(false);
  const [op, setOp] = useState<BulkOp>('enable');
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [eta, setEta] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const visible = (mods ?? []).filter((m) => filters.showNsfw || !m.metadata.isNsfw);
  const hasNsfw = visible.some((m) => m.metadata.isNsfw);

  async function runToggle(list: typeof visible, enabled: boolean, kind: BulkOp) {
    if (list.length === 0) {
      toast.info(enabled ? 'All mods already enabled' : 'All mods already disabled');
      return;
    }
    setOp(kind);
    setTotal(list.length);
    setCurrent(0);
    setEta(null);
    setShowProgress(true);

    // The backend emits one progress event per mod. Use the elapsed time and
    // the per-mod rate so far to estimate how long the rest will take.
    const startedAt = performance.now();
    const unlisten = await listen<BulkToggleProgress>('bulk-toggle-progress', (event) => {
      const { current: done, total: t } = event.payload;
      setCurrent(done);
      setTotal(t);
      if (done > 0 && done < t) {
        const elapsed = (performance.now() - startedAt) / 1000;
        const perMod = elapsed / done;
        setEta(formatEta(perMod * (t - done)));
      } else {
        setEta(null);
      }
    });

    try {
      // One backend call handles the whole batch and one refetch re-syncs the UI.
      const { count } = await setModsEnabled.mutateAsync({ modIds: list.map((m) => m.id), enabled });
      toast.success(`${enabled ? 'Enabled' : 'Disabled'} ${count} mod${count !== 1 ? 's' : ''}`);
    } catch (e) {
      console.error('Bulk toggle failed:', e);
    } finally {
      unlisten();
      setShowProgress(false);
    }
  }

  const handleEnableAll = () => runToggle(visible.filter((m) => !m.enabled), true, 'enable');
  const handleDisableAll = () => runToggle(visible.filter((m) => m.enabled), false, 'disable');
  const handleDisableNsfw = () => runToggle(visible.filter((m) => m.metadata.isNsfw && m.enabled), false, 'disableNsfw');

  const handleOrganize = async () => {
    try {
      toast.info('Organizing loose mods…');
      const count = await invoke<number>('organize_mods');
      toast.success(count > 0 ? `Organized ${count} loose mod(s)` : 'No loose mods found');
    } catch (e) {
      console.error('Failed to organize mods:', e);
      toast.error(`Failed to organize mods: ${e}`);
    }
  };

  const confirmDeleteAll = async () => {
    setShowDeleteConfirm(false);
    setOp('delete');
    setTotal(visible.length);
    setCurrent(0);
    setShowProgress(true);
    let ok = 0;
    let i = 0;
    for (const mod of visible) {
      try {
        await deleteMod.mutateAsync(mod.id);
        ok++;
      } catch (e) {
        console.error(`Failed to delete ${mod.name}:`, e);
      }
      setCurrent(++i);
    }
    setShowProgress(false);
    toast.success(`Deleted ${ok} mod${ok !== 1 ? 's' : ''}`);
  };

  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  const ghost = (hue: string, onClick: () => void, icon: React.ReactNode, label: string) => (
    <button
      onClick={onClick}
      className="bulk-btn inline-flex items-center gap-1.5 cursor-pointer"
      style={{ ['--bulk-hue' as string]: hue, fontFamily: c.font }}
    >
      <span className="bulk-btn-icon inline-flex">{icon}</span>
      {label}
    </button>
  );

  return (
    <>
      <div
        className="flex items-center gap-2 mx-[22px] mt-2"
        style={{ background: c.panel, border: `1px solid ${c.line}`, borderRadius: 8, padding: '8px 12px' }}
      >
        <span style={{ color: c.ink3, fontFamily: c.mono, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Bulk</span>
        <span style={{ width: 1, height: 18, background: c.line }} />
        {ghost(c.ok, handleEnableAll, <CircleCheck className="h-3.5 w-3.5" />, 'Enable all')}
        {ghost(c.warn, handleDisableAll, <CircleX className="h-3.5 w-3.5" />, 'Disable all')}
        {hasNsfw && filters.showNsfw && ghost(c.err, handleDisableNsfw, <CircleX className="h-3.5 w-3.5" />, 'Disable NSFW')}
        {ghost(c.accent, handleOrganize, <FolderCog className="h-3.5 w-3.5" />, 'Organize')}
        {ghost(c.err, () => setShowDeleteConfirm(true), <Trash2 className="h-3.5 w-3.5" />, 'Delete all')}
        <span className="ml-auto" style={{ color: c.ink3, fontFamily: c.mono, fontSize: 11 }}>
          Applies to all visible mods
        </span>
      </div>

      {/* Progress dialog */}
      {showProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md rounded-lg p-6 animate-in zoom-in-95 duration-200" style={{ background: c.panel, border: `1px solid ${c.line2}` }}>
            <div className="flex items-center gap-3 mb-4">
              <Settings className="w-5 h-5 animate-spin" style={{ color: c.accent }} />
              <h2 className="rivals-display" style={{ color: c.ink, fontSize: 18, fontWeight: 600 }}>
                {op === 'enable' && 'Enabling Mods'}
                {op === 'disable' && 'Disabling Mods'}
                {op === 'disableNsfw' && 'Disabling NSFW Mods'}
                {op === 'delete' && 'Deleting Mods'}
              </h2>
            </div>
            <div style={{ height: 10, background: c.line, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: op === 'delete' ? c.err : op === 'enable' ? c.ok : c.warn, transition: 'width .25s ease' }} />
            </div>
            <div className="flex justify-between mt-2" style={{ color: c.ink3, fontFamily: c.mono, fontSize: 12 }}>
              <span>
                {current} of {total}
                {op !== 'delete' && eta ? ` · ${eta}` : '…'}
              </span>
              <span>{pct}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md rounded-lg p-6 animate-in zoom-in-95 duration-200" style={{ background: c.panel, border: `1px solid ${c.line2}` }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="grid place-items-center" style={{ width: 40, height: 40, borderRadius: 999, background: tint(c.err, 18) }}>
                <Trash2 className="h-5 w-5" style={{ color: c.err }} />
              </div>
              <h2 className="rivals-display" style={{ color: c.ink, fontSize: 18, fontWeight: 600 }}>Delete All Mods</h2>
            </div>
            <p style={{ color: c.ink2, fontFamily: c.font, fontSize: 13 }} className="mb-4">
              Are you sure you want to delete all {visible.length} mod{visible.length !== 1 ? 's' : ''}? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 cursor-pointer"
                style={{ padding: '8px 0', borderRadius: 6, background: 'transparent', color: c.ink2, border: `1px solid ${c.line2}`, fontFamily: c.font, fontSize: 13, fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteAll}
                className="flex-1 cursor-pointer"
                style={{ padding: '8px 0', borderRadius: 6, background: c.err, color: '#fff', border: 'none', fontFamily: c.font, fontSize: 13, fontWeight: 600 }}
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
