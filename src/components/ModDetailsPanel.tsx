import { useUIStore } from '../stores';
import { useGetMods, useDeleteMod, useToggleModEnabled, useToggleFavorite, useGetAllCostumes } from '../hooks/useMods';
import type { Costume } from '../types/mod.types';
import { ScrollArea } from './ui/scroll-area';
import { X, Edit, Trash2, FolderOpen, Power, PowerOff, Star, Copy, Check, MoreHorizontal, ChevronDown } from 'lucide-react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { openPath } from '@tauri-apps/plugin-opener';
import { dirname } from '@tauri-apps/api/path';
import { useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { c, tint, categoryColor, getCharacterIconPath, getCostumeIconSrc } from '../shared/rivals-tokens';
import { CategoryIcon, WarnIcon } from '../shared/rivals-design';
import { useDominantColor } from '../hooks/useDominantColor';

// Round avatar with a ring in the image's dominant color.
function RingAvatar({ src, alt, size }: { src: string; alt: string; size: number }) {
  const dominant = useDominantColor(src);
  const ring = dominant ? `color-mix(in oklch, ${dominant} 65%, transparent)` : tint(c.accent, 35);
  return (
    <span className="rounded-full grid place-items-center flex-shrink-0" style={{ width: size, height: size, padding: 2, background: c.bg, border: `2px solid ${ring}`, boxSizing: 'border-box' }}>
      <img
        src={src}
        alt={alt}
        className="rounded-full object-cover w-full h-full"
        style={{ boxShadow: `0 0 0 1px ${c.line}` }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    </span>
  );
}

// Helper function to get costume for a mod
function getCostumeForMod(
  mod: any,
  allCostumes: Record<string, Costume[]> | undefined
): Costume | null {
  if (!mod.character || !mod.metadata.costume || !allCostumes) return null;
  const characterCostumes = allCostumes[mod.character];
  if (!characterCostumes) return null;
  return characterCostumes.find(c => c.id === mod.metadata.costume) || null;
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// Helper function to process description and convert BBCode to HTML
function processDescription(description: string): string {
  return description
    .replace(/<br\s*\/?>/gi, '<br/>')
    .replace(/<\/p>/gi, '<br/>')
    .replace(/<p>/gi, '')
    .replace(/\[img\](.*?)\[\/img\]/gi, '<img src="$1" alt="Mod image" class="max-w-[300px] my-2 rounded border border-border" />')
    .replace(/\[url=(.*?)\](.*?)\[\/url\]/gi, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary underline">$2</a>')
    .replace(/\[list\]/gi, '<ul class="list-disc list-inside my-2">')
    .replace(/\[\/list\]/gi, '</ul>')
    .replace(/\[\*\]/gi, '<li>')
    .replace(/\[b\](.*?)\[\/b\]/gi, '<strong>$1</strong>')
    .replace(/\[i\](.*?)\[\/i\]/gi, '<em>$1</em>')
    .replace(/\[u\](.*?)\[\/u\]/gi, '<u>$1</u>')
    .replace(/\[.*?\]/g, '')
    .replace(/(<br\/>){3,}/g, '<br/><br/>')
    .trim();
}

export function ModDetailsPanel() {
  const selectedModId = useUIStore((state) => state.selectedModId);
  const setSelectedModId = useUIStore((state) => state.setSelectedModId);
  const setMetadataDialogOpen = useUIStore((state) => state.setMetadataDialogOpen);
  const { data: mods } = useGetMods();
  const deleteMod = useDeleteMod();
  const toggleEnabled = useToggleModEnabled();
  const toggleFavorite = useToggleFavorite();
  const { data: allCostumes } = useGetAllCostumes();
  const queryClient = useQueryClient();

  const [isEditingId, setIsEditingId] = useState(false);
  const [oldModId, setOldModId] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [showOverflow, setShowOverflow] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showIdSection, setShowIdSection] = useState(false);

  const mod = mods?.find((m) => m.id === selectedModId);

  if (!mod) return null;

  const costume = getCostumeForMod(mod, allCostumes);

  const handleClose = () => setSelectedModId(null);

  const handleEditMetadata = () => setMetadataDialogOpen(true, mod.id);

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete "${mod.name}"?`)) {
      await deleteMod.mutateAsync(mod.id);
      setSelectedModId(null);
    }
  };

  const handleToggleEnabled = async () => {
    await toggleEnabled.mutateAsync(mod.id);
  };

  const handleToggleFavorite = async () => {
    await toggleFavorite.mutateAsync(mod.id);
  };

  const handleShowInFolder = async () => {
    try {
      const dir = await dirname(mod.filePath);
      await openPath(dir);
    } catch (error) {
      console.error('Failed to open folder:', error);
    }
  };

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(mod.id);
      setIsCopied(true);
      toast.success('Mod ID copied to clipboard');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy ID:', error);
      toast.error('Failed to copy ID to clipboard');
    }
  };

  const handleRestoreFromOldId = async () => {
    if (!oldModId.trim()) {
      toast.error('Please enter an old mod ID');
      return;
    }
    try {
      await invoke('copy_metadata_from_old_id', {
        currentModId: mod.id,
        oldModId: oldModId.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ['mods', 'list'] });
      toast.success('Successfully restored metadata from old ID!');
      setIsEditingId(false);
      setOldModId('');
    } catch (error) {
      console.error('Failed to restore metadata:', error);
      toast.error(String(error));
    }
  };

  const thumbnailSrc = mod.thumbnailPath ? convertFileSrc(mod.thumbnailPath) : null;
  const catColor = categoryColor(mod.category);

  const HeroTitle = () => (
    <>
      <h2 className="rivals-condensed" style={{ color: c.ink, fontSize: 44, fontWeight: 800, lineHeight: 1, letterSpacing: '0.005em', textTransform: 'uppercase', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
        {mod.metadata.title || mod.name}
      </h2>
      {mod.metadata.subtitle && (
        <p className="mt-1.5" style={{ color: c.ink2, fontFamily: c.font, fontSize: 13.5, fontStyle: 'italic' }}>{mod.metadata.subtitle}</p>
      )}
      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        <span className="inline-flex items-center gap-1" style={{ padding: '2px 8px', borderRadius: 999, background: tint(catColor, 16), color: catColor, border: `1px solid ${tint(catColor, 40)}`, fontFamily: c.font, fontSize: 11, fontWeight: 600 }}>
          <CategoryIcon category={mod.category} stroke={catColor} size={10} />
          {mod.category}
        </span>
        {mod.metadata.isNsfw && (
          <span className="inline-flex items-center gap-1" style={{ padding: '2px 8px', borderRadius: 999, background: tint(c.nsfw, 18), color: 'var(--rivals-nsfw-bright)', border: `1px solid ${tint(c.nsfw, 45)}`, fontFamily: c.font, fontSize: 11, fontWeight: 600 }}>
            <WarnIcon stroke="var(--rivals-nsfw-bright)" size={10} />
            NSFW
          </span>
        )}
        {mod.metadata.author && (
          <span style={{ color: c.ink3, fontFamily: c.font, fontSize: 12.5 }}>
            <span style={{ color: c.muted }}>·</span> by <span style={{ color: c.ink2, fontWeight: 500 }}>{mod.metadata.author}</span>
          </span>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 backdrop-blur-[2px]"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className="fixed inset-y-0 right-0 w-[700px] z-50 flex flex-col animate-in slide-in-from-right duration-200"
        style={{ background: c.bg, borderLeft: `1px solid ${c.line2}`, boxShadow: '-8px 0 30px rgba(0,0,0,0.5)' }}
      >
        {/* Hero area — thumbnail with close button overlaid */}
        <div className="relative flex-shrink-0">
          {thumbnailSrc ? (
            <div className="relative h-[300px] overflow-hidden">
              <img src={thumbnailSrc} alt={mod.name} className="w-full h-full object-cover" />
              {/* Gradient fade at bottom into the panel bg */}
              <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${c.bg}, ${tint(c.bg, 20)} 40%, transparent)` }} />
              <div className="absolute bottom-0 left-0 right-0 p-6 pb-5">
                <HeroTitle />
              </div>
            </div>
          ) : (
            <div className="p-6 pt-14 pb-5">
              <HeroTitle />
            </div>
          )}

          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 grid place-items-center transition-colors z-10"
            style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', color: c.ink2, border: `1px solid ${c.line2}` }}
            onMouseEnter={(e) => { e.currentTarget.style.background = tint(c.nsfw, 25); e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.5)'; e.currentTarget.style.color = c.ink2 as string; }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action bar — primary actions, directly under the hero */}
        <div className="flex items-center gap-2 px-6 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${c.line}`, background: c.panel }}>
          {/* Big Enable toggle */}
          <button
            onClick={handleToggleEnabled}
            className="detail-btn rivals-condensed flex-1 h-11 px-4 rounded-lg gap-2 flex items-center justify-center cursor-pointer"
            style={{
              ['--btn-hue' as string]: mod.enabled ? c.ok : c.accent,
              background: mod.enabled ? c.accent : 'transparent',
              color: mod.enabled ? c.onAccent : c.ink,
              border: `1px solid ${mod.enabled ? c.accent : c.line2}`,
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {mod.enabled ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
            {mod.enabled ? 'Enabled' : 'Disabled'}
          </button>

          {/* Favorite */}
          <button
            onClick={handleToggleFavorite}
            className="detail-btn grid place-items-center cursor-pointer"
            title={mod.isFavorite ? 'Unfavorite' : 'Favorite'}
            style={{
              ['--btn-hue' as string]: c.warn,
              width: 44, height: 44, borderRadius: 9,
              background: mod.isFavorite ? tint(c.warn, 16) : c.bg,
              color: mod.isFavorite ? c.warn : c.ink2,
              border: `1px solid ${mod.isFavorite ? tint(c.warn, 45) : c.line2}`,
            }}
          >
            <span className="detail-btn-icon inline-flex"><Star className="w-5 h-5" style={mod.isFavorite ? { fill: c.warn } : undefined} /></span>
          </button>

          {/* Edit */}
          <button
            onClick={handleEditMetadata}
            className="detail-btn grid place-items-center cursor-pointer"
            title="Edit metadata"
            style={{ ['--btn-hue' as string]: c.accent, width: 44, height: 44, borderRadius: 9, background: c.bg, color: c.ink2, border: `1px solid ${c.line2}` }}
          >
            <span className="detail-btn-icon inline-flex"><Edit className="w-5 h-5" /></span>
          </button>

          {/* Overflow (Folder / Delete) */}
          <div className="relative">
            <button
              onClick={() => setShowOverflow((s) => !s)}
              className="detail-btn grid place-items-center cursor-pointer"
              title="More actions"
              style={{ ['--btn-hue' as string]: c.accent, width: 44, height: 44, borderRadius: 9, background: showOverflow ? tint(c.accent, 14) : c.bg, color: showOverflow ? c.accent : c.ink2, border: `1px solid ${showOverflow ? tint(c.accent, 45) : c.line2}` }}
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {showOverflow && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowOverflow(false)} />
                <div className="menu-pop absolute right-0 mt-1.5 z-50 overflow-hidden py-1" style={{ minWidth: 180, background: c.panel, border: `1px solid ${c.line2}`, borderRadius: 10, boxShadow: '0 12px 28px rgba(0,0,0,0.5)' }}>
                  <button
                    onClick={() => { setShowOverflow(false); handleShowInFolder(); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 transition-colors"
                    style={{ color: c.ink2, fontFamily: c.font, fontSize: 13 }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = tint(c.accent, 12); e.currentTarget.style.color = c.accent as string; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.ink2 as string; }}
                  >
                    <FolderOpen className="w-4 h-4" /> Show in Folder
                  </button>
                  <button
                    onClick={() => { setShowOverflow(false); handleDelete(); }}
                    disabled={deleteMod.isPending}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 transition-colors disabled:opacity-50"
                    style={{ color: c.nsfw, fontFamily: c.font, fontSize: 13, fontWeight: 600 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = tint(c.nsfw, 14))}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Trash2 className="w-4 h-4" /> {deleteMod.isPending ? 'Deleting…' : 'Delete Mod'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-5 space-y-6">

            {/* Character + Costume row */}
            {mod.character && (
              <div className="flex items-center gap-5" style={{ animation: 'metadata-fade-in 420ms cubic-bezier(0.22,1,0.36,1) 90ms both' }}>
                <div className="flex items-center gap-3">
                  <RingAvatar src={getCharacterIconPath(mod.character)} alt={mod.character} size={56} />
                  <div>
                    <p className="rivals-mono" style={{ color: c.ink3, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Character</p>
                    <p style={{ color: c.ink, fontFamily: c.font, fontSize: 15, fontWeight: 600 }}>{mod.character}</p>
                  </div>
                </div>

                {costume && (
                  <>
                    <div className="w-px h-10" style={{ background: c.line }} />
                    <div className="flex items-center gap-3">
                      <RingAvatar src={getCostumeIconSrc(costume)} alt={costume.name} size={48} />
                      <div>
                        <p className="rivals-mono" style={{ color: c.ink3, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Costume</p>
                        <p style={{ color: c.ink, fontFamily: c.font, fontSize: 14, fontWeight: 500 }}>{costume.name}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Description */}
            {mod.metadata.description && (
              <div style={{ animation: 'metadata-fade-in 420ms cubic-bezier(0.22,1,0.36,1) 170ms both' }}>
                <h4 className="rivals-mono mb-3" style={{ color: c.ink3, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>Description</h4>
                <div
                  style={{ color: c.ink2, fontFamily: c.font, fontSize: 15, lineHeight: 1.6 }}
                  dangerouslySetInnerHTML={{ __html: processDescription(mod.metadata.description) }}
                />
              </div>
            )}

            {/* Stat chips */}
            <div className="grid grid-cols-2 gap-2.5" style={{ animation: 'metadata-fade-in 420ms cubic-bezier(0.22,1,0.36,1) 250ms both' }}>
              {[
                { label: 'Version', value: mod.metadata.version ? `v${mod.metadata.version}` : '—' },
                { label: 'Size', value: formatFileSize(mod.fileSize) },
                { label: 'Installed', value: new Date(mod.installDate).toLocaleDateString() },
                { label: 'Updated', value: new Date(mod.metadata.updatedAt).toLocaleDateString() },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg px-3.5 py-2.5" style={{ background: c.panel, border: `1px solid ${c.line}` }}>
                  <div className="rivals-mono" style={{ color: c.ink3, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{stat.label}</div>
                  <div className="rivals-mono mt-0.5" style={{ color: c.ink, fontSize: 14, fontWeight: 600 }}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Associated Files */}
            {mod.associatedFiles.length > 0 && (
              <div style={{ animation: 'metadata-fade-in 420ms cubic-bezier(0.22,1,0.36,1) 330ms both' }}>
                <button onClick={() => setShowFiles((s) => !s)} className="w-full flex items-center justify-between mb-3">
                  <h4 className="rivals-mono" style={{ color: c.ink3, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>
                    Associated Files
                    <span className="rivals-mono" style={{ color: c.muted, marginLeft: 6 }}>{mod.associatedFiles.length}</span>
                  </h4>
                  <ChevronDown className="w-4 h-4" style={{ color: c.ink3, transition: 'transform 200ms ease', transform: showFiles ? 'rotate(180deg)' : 'none' }} />
                </button>
                <div className="grid" style={{ gridTemplateRows: showFiles ? '1fr' : '0fr', transition: 'grid-template-rows 280ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
                  <div className="overflow-hidden">
                    <div className="space-y-1.5 pb-0.5">
                      {mod.associatedFiles.map((filePath, index) => {
                        const fileName = filePath.split(/[\\/]/).pop() || filePath;
                        return (
                          <div
                            key={index}
                            className="flex items-center gap-2.5"
                            style={showFiles ? { animation: `metadata-fade-in 320ms cubic-bezier(0.22,1,0.36,1) ${index * 45}ms both` } : undefined}
                          >
                            <div className="flex-shrink-0" style={{ width: 6, height: 6, borderRadius: '50%', background: c.ok, boxShadow: `0 0 5px ${tint(c.ok, 70)}` }} />
                            <span className="break-all" style={{ color: c.ink2, fontFamily: c.mono, fontSize: 12 }}>{fileName}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Mod ID */}
            <div style={{ animation: 'metadata-fade-in 420ms cubic-bezier(0.22,1,0.36,1) 410ms both' }}>
              <button
                onClick={() => setShowIdSection((s) => !s)}
                className="w-full flex items-center justify-between mb-3"
              >
                <h4 className="rivals-mono" style={{ color: c.ink3, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>Mod ID &amp; Recovery</h4>
                <ChevronDown className="w-4 h-4" style={{ color: c.ink3, transition: 'transform 200ms ease', transform: showIdSection ? 'rotate(180deg)' : 'none' }} />
              </button>
              <div className="grid" style={{ gridTemplateRows: showIdSection ? '1fr' : '0fr', transition: 'grid-template-rows 280ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
                <div className="overflow-hidden">
              <div className="flex items-center justify-start mb-2">
                <button
                  onClick={handleCopyId}
                  className="flex items-center gap-1.5 transition-colors"
                  style={{ color: isCopied ? c.ok : c.ink3, fontFamily: c.font, fontSize: 12 }}
                  onMouseEnter={(e) => { if (!isCopied) e.currentTarget.style.color = c.accent as string; }}
                  onMouseLeave={(e) => { if (!isCopied) e.currentTarget.style.color = c.ink3 as string; }}
                >
                  {isCopied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy ID</>}
                </button>
              </div>
              <div className="rounded-lg px-4 py-3" style={{ background: c.panel, border: `1px solid ${c.line}` }}>
                <code className="break-all" style={{ color: c.ink3, fontFamily: c.mono, fontSize: 11.5 }}>{mod.id}</code>
              </div>

              {/* Restore from Old ID */}
              {!isEditingId ? (
                <button
                  onClick={() => setIsEditingId(true)}
                  className="flex items-center gap-1.5 mt-2 transition-colors"
                  style={{ color: c.ink3, fontFamily: c.font, fontSize: 12 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = c.accent as string)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = c.ink3 as string)}
                >
                  <Edit className="w-3 h-3" />
                  Restore metadata from old ID
                </button>
              ) : (
                <div className="space-y-2 mt-3">
                  <input
                    type="text"
                    value={oldModId}
                    onChange={(e) => setOldModId(e.target.value)}
                    placeholder="Enter old mod ID"
                    className="rivals-input w-full h-10 px-3 text-sm rounded-lg outline-none"
                    style={{ background: c.bg, border: `1px solid ${c.line2}`, fontFamily: c.mono }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRestoreFromOldId();
                      if (e.key === 'Escape') { setIsEditingId(false); setOldModId(''); }
                    }}
                  />
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex-1" style={{ color: c.ink3, fontFamily: c.font, fontSize: 11.5 }}>
                      Copy metadata and thumbnails from the old ID to this mod.
                    </p>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => { setIsEditingId(false); setOldModId(''); }}
                        className="btn-outline h-8 px-3 cursor-pointer"
                        style={{ borderRadius: 8, background: 'transparent', color: c.ink2, border: `1px solid ${c.line2}`, fontFamily: c.font, fontSize: 12, fontWeight: 600 }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRestoreFromOldId}
                        className="btn-primary h-8 px-3 cursor-pointer"
                        style={{ borderRadius: 8, background: c.accent, color: c.onAccent, border: 'none', fontFamily: c.font, fontSize: 12, fontWeight: 600 }}
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                </div>
              )}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
