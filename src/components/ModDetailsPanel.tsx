import { useUIStore } from '../stores';
import { useGetMods, useDeleteMod, useToggleModEnabled, useToggleFavorite, useGetAllCostumes } from '../hooks/useMods';
import type { Costume, ModInfo } from '../types/mod.types';
import { ScrollArea } from './ui/scroll-area';
import { X, Edit, Trash2, FolderOpen, Star, Copy, Check, MoreHorizontal, ChevronDown } from 'lucide-react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { openPath } from '@tauri-apps/plugin-opener';
import { dirname } from '@tauri-apps/api/path';
import { useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { c, tint, categoryColor, getCharacterIconPath, getCostumeIconSrc, addonDisplayName } from '../shared/rivals-tokens';
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
  mod: ModInfo,
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
  const heroGlow = useDominantColor(mod?.thumbnailPath ? convertFileSrc(mod.thumbnailPath) : null);

  if (!mod) return null;

  const costume = getCostumeForMod(mod, allCostumes);

  // Family: add-ons attached to this mod, or the parent if this IS an add-on
  const addons = (mods ?? []).filter((m) => m.metadata.parentModId === mod.id);
  const parentMod = mod.metadata.parentModId ? (mods ?? []).find((m) => m.id === mod.metadata.parentModId) ?? null : null;

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

  // Category/NSFW kickers + author — shown on dark glass over art, or inline
  // above the title when there's no artwork to fight with.
  const tagCluster = (
    <>
      <span className="kicker-tag rivals-condensed" style={{ color: catColor }}>
        <CategoryIcon category={mod.category} stroke={catColor} size={11} />
        {mod.category}
      </span>
      {mod.metadata.isNsfw && (
        <span className="kicker-tag rivals-condensed" style={{ color: 'var(--rivals-nsfw-bright)' }}>
          <WarnIcon stroke="var(--rivals-nsfw-bright)" size={11} />
          NSFW
        </span>
      )}
      {mod.metadata.author && (
        <span className="rivals-mono" style={{ color: c.ink3, fontSize: 10.5, letterSpacing: '0.09em', textTransform: 'uppercase' }}>
          By {mod.metadata.author}
        </span>
      )}
    </>
  );

  const heroTitle = (
    <>
      <h2 className="rivals-condensed" style={{ color: c.ink, fontSize: 44, fontWeight: 800, lineHeight: 1, letterSpacing: '0.005em', textTransform: 'uppercase', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
        {mod.metadata.title || mod.name}
      </h2>
      {mod.metadata.subtitle && (
        <p className="rivals-display mt-1.5" style={{ color: c.ink2, fontSize: 15, fontStyle: 'italic', fontWeight: 500 }}>{mod.metadata.subtitle}</p>
      )}
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
        style={{ background: c.bg, borderLeft: `1px solid ${c.line2}`, boxShadow: '-8px 0 30px rgba(0,0,0,0.5)', ['--glow-color' as string]: heroGlow ?? c.accent }}
      >
        {/* Hero area — thumbnail with close button overlaid */}
        <div className="relative flex-shrink-0">
          {thumbnailSrc ? (
            <div className="relative h-[300px] overflow-hidden">
              <img src={thumbnailSrc} alt={mod.name} className="w-full h-full object-cover" />
              {/* Gradient fade at bottom into the panel bg */}
              <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${c.bg}, ${tint(c.bg, 20)} 40%, transparent)` }} />
              <div className="absolute bottom-0 left-0 right-0 p-6 pb-5" style={{ paddingRight: 210 }}>
                {heroTitle}
              </div>
              {/* Tags + author on dark glass, bottom-right — always legible */}
              <div className="art-tag-plate is-right">
                {tagCluster}
              </div>
            </div>
          ) : (
            <div className="p-6 pt-14 pb-5">
              <div className="flex items-center flex-wrap" style={{ gap: 14, marginBottom: 8 }}>
                {tagCluster}
              </div>
              {heroTitle}
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

        {/* Artwork-tinted seam between hero and actions */}
        <div aria-hidden className="card-glow-seam" />

        {/* Action bar — primary actions, directly under the hero */}
        <div className="flex items-center gap-2 px-6 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${c.line}`, background: c.panel }}>
          {/* Power rail — same language as the cards, sized as the primary action */}
          <button
            onClick={handleToggleEnabled}
            className={`power-rail rivals-condensed flex-1 cursor-pointer ${mod.enabled ? 'is-on' : 'is-off'}`}
          >
            <span className="power-dot" />
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

            {/* Credits line: hero portrait(s) + NAME ⫽ costume, panel-scaled */}
            {mod.character && (
              <div className="card-credits" style={{ animation: 'metadata-fade-in 420ms cubic-bezier(0.22,1,0.36,1) 90ms both' }}>
                <RingAvatar src={getCharacterIconPath(mod.character)} alt={mod.character} size={52} />
                {costume && costume.name !== 'Default' && (
                  <span style={{ marginLeft: -20, flexShrink: 0, display: 'inline-flex' }}>
                    <RingAvatar src={getCostumeIconSrc(costume)} alt={costume.name} size={52} />
                  </span>
                )}
                <span className="rivals-condensed truncate" style={{ color: c.ink, fontSize: 21, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', flexShrink: 0 }}>
                  {mod.character}
                </span>
                <span className="card-credits-slash" style={{ height: 22 }} />
                <span className="rivals-display truncate" style={{ color: c.ink3, fontSize: 16, fontStyle: 'italic' }}>
                  {costume?.name ?? 'Default'}
                </span>
              </div>
            )}

            {/* Part of: this mod is an add-on — link back to its parent */}
            {parentMod && (
              <div style={{ animation: 'metadata-fade-in 420ms cubic-bezier(0.22,1,0.36,1) 130ms both' }}>
                <h4 className="rivals-mono mb-2.5" style={{ color: c.ink3, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>Part Of</h4>
                <button
                  onClick={() => setSelectedModId(parentMod.id)}
                  className="w-full flex items-center gap-3 rounded-lg cursor-pointer transition-colors"
                  style={{ padding: '8px 10px', background: c.panel, border: `1px solid ${c.line}`, textAlign: 'left' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = tint(c.accent, 40); }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = c.line; }}
                >
                  {parentMod.thumbnailPath ? (
                    <img src={convertFileSrc(parentMod.thumbnailPath)} alt="" loading="lazy" style={{ width: 64, height: 36, borderRadius: 5, objectFit: 'cover', border: `1px solid ${c.line2}`, flexShrink: 0 }} />
                  ) : (
                    <span style={{ width: 64, height: 36, borderRadius: 5, border: `1px solid ${c.line2}`, display: 'grid', placeItems: 'center', color: c.ink3, flexShrink: 0 }}>—</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate" style={{ color: c.ink, fontFamily: c.font, fontSize: 13.5, fontWeight: 600 }}>{parentMod.metadata.title || parentMod.name}</div>
                    <div className="rivals-mono" style={{ color: c.ink3, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>
                      Open base mod
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: c.ink3, transform: 'rotate(-90deg)' }} />
                </button>
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

            {/* Spec sheet — hairline rows instead of boxed tiles */}
            <div style={{ animation: 'metadata-fade-in 420ms cubic-bezier(0.22,1,0.36,1) 250ms both' }}>
              {[
                { label: 'Version', value: mod.metadata.version ? `v${mod.metadata.version}` : '—' },
                { label: 'Size', value: formatFileSize(mod.fileSize) },
                { label: 'Installed', value: new Date(mod.installDate).toLocaleDateString() },
                { label: 'Updated', value: new Date(mod.metadata.updatedAt).toLocaleDateString() },
              ].map((stat, i) => (
                <div
                  key={stat.label}
                  className="flex items-baseline justify-between"
                  style={{ padding: '9px 2px', borderTop: i === 0 ? 'none' : `1px solid ${c.line}` }}
                >
                  <span className="rivals-mono" style={{ color: c.ink3, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{stat.label}</span>
                  <span className="rivals-mono" style={{ color: c.ink, fontSize: 13.5, fontWeight: 600 }}>{stat.value}</span>
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

            {/* Add-ons attached to this mod — at the bottom, roomy rows */}
            {addons.length > 0 && (
              <div style={{ animation: 'metadata-fade-in 420ms cubic-bezier(0.22,1,0.36,1) 470ms both' }}>
                <h4 className="rivals-mono mb-3" style={{ color: c.ink3, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>
                  Add-ons
                  <span style={{ color: c.muted, marginLeft: 6 }}>{addons.length}</span>
                </h4>
                <div className="space-y-1.5">
                  {addons.map((a) => {
                    const on = a.enabled && mod.enabled;
                    return (
                      <div
                        key={a.id}
                        onClick={() => setSelectedModId(a.id)}
                        className="flex items-center gap-3.5 rounded-lg cursor-pointer transition-colors"
                        style={{ padding: '9px 10px' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = tint(c.warn, 8); }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        {a.thumbnailPath ? (
                          <img src={convertFileSrc(a.thumbnailPath)} alt="" loading="lazy" style={{ width: 72, height: 41, borderRadius: 6, objectFit: 'cover', border: `1px solid ${c.line2}`, flexShrink: 0, opacity: a.enabled ? 1 : 0.45, filter: a.enabled ? 'none' : 'grayscale(0.7)', transition: 'opacity 200ms ease, filter 200ms ease' }} />
                        ) : (
                          <span style={{ width: 72, height: 41, borderRadius: 6, border: `1px solid ${c.line2}`, display: 'grid', placeItems: 'center', color: c.ink3, flexShrink: 0, opacity: a.enabled ? 1 : 0.45 }}>+</span>
                        )}
                        <div className="min-w-0 flex-1" style={{ opacity: a.enabled ? 1 : 0.5, transition: 'opacity 200ms ease' }}>
                          <div className="truncate" style={{ color: mod.enabled ? c.ink : c.ink3, fontFamily: c.font, fontSize: 14.5, fontWeight: 600 }}>
                            {addonDisplayName(a.metadata.title || a.name, mod.metadata.title || mod.name)}
                          </div>
                          <div className="flex items-center gap-2.5" style={{ marginTop: 3 }}>
                            <span className="kicker-tag rivals-condensed" style={{ color: categoryColor(a.category), fontSize: 10.5, gap: 4 }}>
                              <CategoryIcon category={a.category} stroke={categoryColor(a.category)} size={10} />
                              {a.category}
                            </span>
                            <span className="rivals-mono" style={{ color: c.ink3, fontSize: 11.5 }}>{formatFileSize(a.fileSize)}</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); if (mod.enabled) toggleEnabled.mutate(a.id); }}
                          disabled={!mod.enabled}
                          data-tip={!mod.enabled ? 'Enable this mod first' : undefined}
                          className="rivals-mono inline-flex items-center gap-1.5 flex-shrink-0"
                          style={{ padding: '4px 5px', background: 'transparent', border: 'none', color: on ? c.ok : mod.enabled ? c.ink3 : c.muted, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, cursor: mod.enabled ? 'pointer' : 'not-allowed', opacity: mod.enabled ? 1 : 0.55 }}
                        >
                          <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: on ? c.ok : 'transparent', boxShadow: on ? `0 0 7px ${tint(c.ok, 90)}` : `inset 0 0 0 1.5px ${mod.enabled ? c.ink3 : c.muted}` }} />
                          {a.enabled ? 'On' : 'Off'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
