import { useUIStore } from '../stores';
import { useGetMods, useDeleteMod, useToggleModEnabled, useToggleFavorite, useGetAllCostumes } from '../hooks/useMods';
import type { Costume } from '../types/mod.types';
import { ScrollArea } from './ui/scroll-area';
import { X, Edit, Trash2, FolderOpen, Power, PowerOff, Star, Monitor, Volume2, Shirt, Gamepad2, Copy, Check } from 'lucide-react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { openPath } from '@tauri-apps/plugin-opener';
import { dirname } from '@tauri-apps/api/path';
import { motion, AnimatePresence } from 'framer-motion';
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
    .replace(/\[img\](.*?)\[\/img\]/gi, '<img src="$1" alt="Mod image" class="max-w-[300px] my-2 rounded border border-border" style="image-rendering: -webkit-optimize-contrast; backface-visibility: hidden; transform: translateZ(0);" />') // Convert [img] to actual images
    .replace(/\[url=(.*?)\](.*?)\[\/url\]/gi, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary underline">$2</a>') // Convert [url] to links
    .replace(/\[list\]/gi, '<ul class="list-disc list-inside my-2">') // Convert [list] to HTML list
    .replace(/\[\/list\]/gi, '</ul>')
    .replace(/\[\*\]/gi, '<li>') // Convert [*] to list items
    .replace(/\[b\](.*?)\[\/b\]/gi, '<strong>$1</strong>') // Convert bold tags
    .replace(/\[i\](.*?)\[\/i\]/gi, '<em>$1</em>') // Convert italic tags
    .replace(/\[u\](.*?)\[\/u\]/gi, '<u>$1</u>') // Convert underline tags
    .replace(/\[.*?\]/g, '') // Remove any other BBCode tags
    .replace(/(<br\/>){3,}/g, '<br/><br/>') // Collapse 3+ line breaks to 2
    .trim();
}

export function ModDetailsPanel() {
  const { selectedModId, setSelectedModId, setMetadataDialogOpen } = useUIStore();
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

  const handleClose = () => {
    setSelectedModId(null);
  };

  const handleEditMetadata = () => {
    setMetadataDialogOpen(true, mod.id);
  };

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

      // Refresh the mod list to show updated metadata
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
      {/* Backdrop - click to close */}
      <div
        className="fixed inset-0 bg-black/20 z-30"
        onClick={handleClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-[700px] bg-card border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Mod Details</h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-md hover:bg-accent transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content with AnimatePresence for smooth transitions */}
        <ScrollArea className="flex-1 min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={mod.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="p-4 space-y-4"
            >
          {/* Thumbnail */}
          {thumbnailSrc && (
            <div className="w-full h-[337px] bg-black/50 rounded-lg border border-border overflow-hidden">
              <img
                src={thumbnailSrc}
                alt={mod.name}
                className="w-full h-full object-cover"
                style={{
                  imageRendering: '-webkit-optimize-contrast',
                  backfaceVisibility: 'hidden',
                  transform: 'translateZ(0)'
                }}
              />
            </div>
          )}

          {/* Title */}
          <div className="pb-4 border-b border-border">
            <h3 className="text-xl font-bold text-foreground">{mod.metadata.title || mod.name}</h3>
            {mod.metadata.author && (
              <p className="text-sm text-muted-foreground mt-1">by {mod.metadata.author}</p>
            )}
          </div>

          {/* Category Badge */}
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs font-medium border flex items-center gap-1 ${category.color}`}>
              <CategoryIcon className="w-3 h-3" />
              {mod.category}
            </span>
            {mod.metadata.isNsfw && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                NSFW
              </span>
            )}
          </div>

          {/* Character Section */}
          {mod.character && (
            <div className="space-y-2 pb-4 border-b border-border">
              <h4 className="text-sm font-semibold text-foreground">Character:</h4>
              <div className="flex items-center gap-2">
                <img
                  src={getCharacterIconPath(mod.character)}
                  alt={mod.character}
                  className="w-8 h-8 rounded-full object-cover border-2 border-border"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                <span className="text-sm font-medium text-foreground">{mod.character}</span>
              </div>
            </div>
          )}

          {/* Costume Section */}
          {costume && (
            <div className="space-y-2 pb-4 border-b border-border">
              <h4 className="text-sm font-semibold text-foreground">Costume / Skin:</h4>
              <div className="flex items-center gap-2">
                <img
                  src={`/assets/costume-icons/${costume.imagePath}`}
                  alt={costume.name}
                  className="w-10 h-10 rounded object-cover border-2 border-border"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{costume.name}</span>
                  {costume.isDefault && (
                    <span className="text-xs text-gray-400">(Default costume)</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          {mod.metadata.description && (
            <div className="space-y-2 pb-4 border-b border-border">
              <h4 className="text-sm font-semibold text-foreground">Description:</h4>
              <div
                className="text-sm text-foreground/90"
                dangerouslySetInnerHTML={{ __html: processDescription(mod.metadata.description) }}
              />
            </div>
          )}

          {/* Info */}
          <div className="space-y-2 pb-4 border-b border-border">
            <h4 className="text-sm font-semibold text-foreground">Information:</h4>
            <div className="bg-black/20 rounded-2xl p-6 mx-auto w-fit border border-white/5">
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-20">
                  <span className="text-foreground/70 font-medium w-32">Status</span>
                  <span className={mod.enabled ? 'text-green-400' : 'text-foreground/60'}>
                    {mod.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center gap-20">
                  <span className="text-foreground/70 font-medium w-32">Size</span>
                  <span className="text-foreground">{formatFileSize(mod.fileSize)}</span>
                </div>
                {mod.metadata.version && (
                  <div className="flex items-center gap-20">
                    <span className="text-foreground/70 font-medium w-32">Version</span>
                    <span className="text-foreground">{mod.metadata.version}</span>
                  </div>
                )}
                <div className="flex items-center gap-20">
                  <span className="text-foreground/70 font-medium w-32">Installed Date</span>
                  <span className="text-foreground">
                    {new Date(mod.installDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-20">
                  <span className="text-foreground/70 font-medium w-32">Last Updated</span>
                  <span className="text-foreground">
                    {new Date(mod.metadata.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Associated Files */}
          <div className="space-y-2 pb-4 border-b border-border">
            <h4 className="text-sm font-semibold text-foreground">Associated Files:</h4>
            <div className="space-y-1">
              {mod.associatedFiles.map((filePath, index) => {
                const fileName = filePath.split(/[\\/]/).pop() || filePath;
                return (
                  <div key={index} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    <span className="text-foreground break-all">{fileName}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mod ID Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">Mod ID:</h4>
              <button
                onClick={handleCopyId}
                className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3 h-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <div className="bg-black/20 rounded-lg p-3 border border-white/5">
              <code className="text-xs text-foreground/70 break-all">{mod.id}</code>
            </div>

            {/* Restore from Old ID */}
            {!isEditingId ? (
              <button
                onClick={() => setIsEditingId(true)}
                className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                <Edit className="w-3 h-3" />
                Restore metadata from old ID
              </button>
            ) : (
              <div className="space-y-2 mt-2">
                <input
                  type="text"
                  value={oldModId}
                  onChange={(e) => setOldModId(e.target.value)}
                  placeholder="Enter old mod ID (e.g., f9394fe2370df8de)"
                  className="w-full h-8 px-2 text-xs font-sans bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
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
                    This will copy all metadata and thumbnails from the old ID to this mod.
                  </p>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => {
                        setIsEditingId(false);
                        setOldModId('');
                      }}
                      className="h-8 px-3 text-xs font-sans bg-background border border-border rounded-md hover:bg-accent transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRestoreFromOldId}
                      className="h-8 px-3 text-xs font-sans bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                    >
                      Restore
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          </motion.div>
          </AnimatePresence>
        </ScrollArea>

        {/* Actions */}
      <div className="p-4 border-t border-border space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleEditMetadata}
            className="h-7 text-xs font-sans rounded-md gap-1 px-2.5 border bg-background text-white flex items-center justify-center group transition-all duration-200 hover:bg-primary/20 hover:text-primary hover:border-primary/40"
          >
            <Edit className="w-3.5 h-3.5 transition-transform duration-200 group-hover:rotate-12" />
            Edit
          </button>
          <button
            onClick={handleToggleFavorite}
            className={`h-7 text-xs font-sans rounded-md gap-1 px-2.5 border bg-background flex items-center justify-center group transition-all duration-200 ${
              mod.isFavorite
                ? 'text-yellow-400 border-yellow-400 hover:bg-yellow-400/20 hover:text-yellow-300 hover:border-yellow-300'
                : 'text-white hover:bg-yellow-400/20 hover:text-yellow-400 hover:border-yellow-400/40'
            }`}
          >
            <Star className={`w-3.5 h-3.5 transition-transform duration-200 group-hover:rotate-12 ${mod.isFavorite ? 'fill-yellow-400' : ''}`} />
            {mod.isFavorite ? 'Unfavorite' : 'Favorite'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleToggleEnabled}
            className={`h-7 text-xs font-sans rounded-md gap-1 px-2.5 border bg-background text-white flex items-center justify-center group transition-all duration-200 ${
              mod.enabled
                ? 'hover:bg-red-400/20 hover:text-red-400 hover:border-red-400/40'
                : 'hover:bg-green-400/20 hover:text-green-400 hover:border-green-400/40'
            }`}
          >
            {mod.enabled
              ? <PowerOff className="w-3.5 h-3.5 transition-transform duration-200 group-hover:rotate-12" />
              : <Power className="w-3.5 h-3.5 transition-transform duration-200 group-hover:rotate-12" />
            }
            {mod.enabled ? 'Disable' : 'Enable'}
          </button>
          <button
            onClick={handleShowInFolder}
            className="h-7 text-xs font-sans rounded-md gap-1 px-2.5 border bg-background text-white flex items-center justify-center group transition-all duration-200 hover:bg-primary/20 hover:text-primary hover:border-primary/40"
          >
            <FolderOpen className="w-3.5 h-3.5 transition-transform duration-200 group-hover:rotate-12" />
            Show in Folder
          </button>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleteMod.isPending}
          className="w-full h-7 text-xs font-sans rounded-md gap-1 px-2.5 border bg-background text-white flex items-center justify-center group transition-all duration-200 hover:bg-red-400/20 hover:text-red-400 hover:border-red-400/40 disabled:opacity-50 disabled:pointer-events-none"
        >
          <Trash2 className="w-3.5 h-3.5 transition-transform duration-200 group-hover:rotate-12" />
          {deleteMod.isPending ? 'Deleting...' : 'Delete Mod'}
        </button>
      </div>
      </div>
    </>
  );
}
