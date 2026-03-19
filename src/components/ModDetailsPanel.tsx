import { useUIStore } from '../stores';
import { useGetMods, useDeleteMod, useToggleModEnabled, useToggleFavorite, useGetAllCostumes } from '../hooks/useMods';
import type { Costume } from '../types/mod.types';
import { ScrollArea } from './ui/scroll-area';
import { X, Edit, Trash2, FolderOpen, Power, PowerOff, Star, Monitor, Volume2, Shirt, Gamepad2, Copy, Check } from 'lucide-react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { openPath } from '@tauri-apps/plugin-opener';
import { dirname } from '@tauri-apps/api/path';
import { useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

// Helper function to get character icon path
function getCharacterIconPath(character: string): string {
  const iconMap: Record<string, string> = {
    'Adam Warlock': 'Adam.png',
    'Jeff the Land Shark': 'Jeff.png',
    'The Punisher': 'Punisher.png',
    'Mister Fantastic': 'Mr. Fantastic.png',
    'Cloak and Dagger': 'Cloak & Dagger.png',
    'Spider-Man': 'Spider-Man.png',
    'Star-Lord': 'Star-Lord.png',
  };
  const iconFileName = iconMap[character] || `${character}.png`;
  return `/assets/character-icons/${iconFileName}`;
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

  const categoryConfig = {
    UI: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Monitor },
    Audio: { color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Volume2 },
    Skins: { color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: Shirt },
    Gameplay: { color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: Gamepad2 },
  };

  const category = categoryConfig[mod.category];
  const CategoryIcon = category.icon;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-30 backdrop-blur-[2px]"
        onClick={handleClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-[700px] bg-card z-50 flex flex-col animate-in slide-in-from-right duration-200 shadow-[-8px_0_30px_rgba(0,0,0,0.3)]">

        {/* Hero area — thumbnail with close button overlaid */}
        <div className="relative flex-shrink-0">
          {thumbnailSrc ? (
            <div className="relative h-[300px] overflow-hidden">
              <img
                src={thumbnailSrc}
                alt={mod.name}
                className="w-full h-full object-cover"
              />
              {/* Gradient fade at bottom */}
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
              {/* Title overlaid on thumbnail */}
              <div className="absolute bottom-0 left-0 right-0 p-6 pb-5">
                <h2 className="text-2xl font-extrabold text-white leading-tight tracking-tight">
                  {mod.metadata.title || mod.name}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 ${category.color}`}>
                    <CategoryIcon className="w-3 h-3" />
                    {mod.category}
                  </span>
                  {mod.metadata.isNsfw && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                      NSFW
                    </span>
                  )}
                  {mod.metadata.subtitle && (
                    <span className="text-xs text-foreground/50">{mod.metadata.subtitle}</span>
                  )}
                </div>
                {mod.metadata.author && (
                  <p className="text-sm text-foreground/60 mt-1.5">by {mod.metadata.author}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 pt-14 pb-5">
              <h2 className="text-2xl font-extrabold text-white leading-tight tracking-tight">
                {mod.metadata.title || mod.name}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 ${category.color}`}>
                  <CategoryIcon className="w-3 h-3" />
                  {mod.category}
                </span>
                {mod.metadata.isNsfw && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                    NSFW
                  </span>
                )}
              </div>
              {mod.metadata.author && (
                <p className="text-sm text-foreground/60 mt-1.5">by {mod.metadata.author}</p>
              )}
            </div>
          )}

          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors z-10"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-5 space-y-6">

            {/* Character + Costume row */}
            {mod.character && (
              <div className="flex items-center gap-5" style={{ animation: 'metadata-fade-in 300ms ease-out 100ms both' }}>
                <div className="flex items-center gap-3">
                  <img
                    src={getCharacterIconPath(mod.character)}
                    alt={mod.character}
                    className="w-14 h-14 rounded-full object-cover border-2 border-border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Character</p>
                    <p className="text-base font-semibold text-foreground">{mod.character}</p>
                  </div>
                </div>

                {costume && (
                  <>
                    <div className="w-px h-10 bg-border/40" />
                    <div className="flex items-center gap-3">
                      <img
                        src={`/assets/costume-icons/${costume.imagePath}`}
                        alt={costume.name}
                        className="w-12 h-12 rounded-full object-cover border border-border/60"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Costume</p>
                        <p className="text-sm font-medium text-foreground">{costume.name}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Description */}
            {mod.metadata.description && (
              <div style={{ animation: 'metadata-fade-in 300ms ease-out 150ms both' }}>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Description</h4>
                <div
                  className="text-sm text-foreground/80 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: processDescription(mod.metadata.description) }}
                />
              </div>
            )}

            {/* Info grid */}
            <div style={{ animation: 'metadata-fade-in 300ms ease-out 200ms both' }}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Information</h4>
              <div className="rounded-xl bg-muted/15 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className={`text-sm font-medium ${mod.enabled ? 'text-green-400' : 'text-red-400'}`}>
                    {mod.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Size</span>
                  <span className="text-sm text-foreground">{formatFileSize(mod.fileSize)}</span>
                </div>
                {mod.metadata.version && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Version</span>
                    <span className="text-sm text-foreground">{mod.metadata.version}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Installed</span>
                  <span className="text-sm text-foreground">{new Date(mod.installDate).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Last Updated</span>
                  <span className="text-sm text-foreground">{new Date(mod.metadata.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Associated Files */}
            {mod.associatedFiles.length > 0 && (
              <div style={{ animation: 'metadata-fade-in 300ms ease-out 250ms both' }}>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Associated Files</h4>
                <div className="space-y-1.5">
                  {mod.associatedFiles.map((filePath, index) => {
                    const fileName = filePath.split(/[\\/]/).pop() || filePath;
                    return (
                      <div key={index} className="flex items-center gap-2.5 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                        <span className="text-foreground/70 break-all">{fileName}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mod ID */}
            <div style={{ animation: 'metadata-fade-in 300ms ease-out 300ms both' }}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mod ID</h4>
                <button
                  onClick={handleCopyId}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                >
                  {isCopied ? (
                    <><Check className="w-3.5 h-3.5" /> Copied</>
                  ) : (
                    <><Copy className="w-3.5 h-3.5" /> Copy</>
                  )}
                </button>
              </div>
              <div className="rounded-xl bg-muted/15 px-4 py-3">
                <code className="text-xs text-foreground/60 break-all">{mod.id}</code>
              </div>

              {/* Restore from Old ID */}
              {!isEditingId ? (
                <button
                  onClick={() => setIsEditingId(true)}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 mt-2"
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
                    className="w-full h-10 px-3 text-sm bg-muted/15 border border-border/40 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRestoreFromOldId();
                      if (e.key === 'Escape') {
                        setIsEditingId(false);
                        setOldModId('');
                      }
                    }}
                  />
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-muted-foreground flex-1">
                      Copy metadata and thumbnails from the old ID to this mod.
                    </p>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => { setIsEditingId(false); setOldModId(''); }}
                        className="h-8 px-3 text-xs rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRestoreFromOldId}
                        className="h-8 px-3 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Action buttons */}
        <div className="p-4 border-t border-border/40 space-y-2 flex-shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleEditMetadata}
              className="h-9 text-sm rounded-xl gap-2 px-3 bg-muted/20 text-foreground flex items-center justify-center group transition-all duration-200 hover:bg-primary/15 hover:text-primary"
            >
              <Edit className="w-4 h-4 transition-transform duration-200 group-hover:rotate-12" />
              Edit
            </button>
            <button
              onClick={handleToggleFavorite}
              className={`h-9 text-sm rounded-xl gap-2 px-3 bg-muted/20 flex items-center justify-center group transition-all duration-200 ${
                mod.isFavorite
                  ? 'text-yellow-400 hover:bg-yellow-400/15'
                  : 'text-foreground hover:bg-yellow-400/15 hover:text-yellow-400'
              }`}
            >
              <Star className={`w-4 h-4 transition-transform duration-200 group-hover:rotate-12 ${mod.isFavorite ? 'fill-yellow-400' : ''}`} />
              {mod.isFavorite ? 'Unfavorite' : 'Favorite'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleToggleEnabled}
              className={`h-9 text-sm rounded-xl gap-2 px-3 bg-muted/20 text-foreground flex items-center justify-center group transition-all duration-200 ${
                mod.enabled
                  ? 'hover:bg-red-400/15 hover:text-red-400'
                  : 'hover:bg-green-400/15 hover:text-green-400'
              }`}
            >
              {mod.enabled
                ? <PowerOff className="w-4 h-4 transition-transform duration-200 group-hover:rotate-12" />
                : <Power className="w-4 h-4 transition-transform duration-200 group-hover:rotate-12" />
              }
              {mod.enabled ? 'Disable' : 'Enable'}
            </button>
            <button
              onClick={handleShowInFolder}
              className="h-9 text-sm rounded-xl gap-2 px-3 bg-muted/20 text-foreground flex items-center justify-center group transition-all duration-200 hover:bg-primary/15 hover:text-primary"
            >
              <FolderOpen className="w-4 h-4 transition-transform duration-200 group-hover:rotate-12" />
              Show in Folder
            </button>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleteMod.isPending}
            className="w-full h-9 text-sm rounded-xl gap-2 px-3 bg-muted/20 text-foreground flex items-center justify-center group transition-all duration-200 hover:bg-red-500/15 hover:text-red-400 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Trash2 className="w-4 h-4 transition-transform duration-200 group-hover:rotate-12" />
            {deleteMod.isPending ? 'Deleting...' : 'Delete Mod'}
          </button>
        </div>
      </div>
    </>
  );
}
