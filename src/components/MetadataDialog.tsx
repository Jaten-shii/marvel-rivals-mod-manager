import { useState, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../stores';
import { useGetMods, useUpdateModMetadata, useGetCostumesForCharacter } from '../hooks/useMods';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ScrollArea } from './ui/scroll-area';
import type { ModCategory, Character } from '../types/mod.types';
import { ALL_CHARACTERS, MOD_CATEGORIES } from '../shared/constants';
import { Upload, Download, Clipboard, Image as ImageIcon, Check, Monitor, Volume2, Shirt, Gamepad2, Loader2 } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { ImageCropDialog } from './ImageCropDialog';
import { toast } from 'sonner';

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

// Helper function to get category icon
function getCategoryIcon(category: ModCategory) {
  switch (category) {
    case 'UI':
      return <Monitor className="w-4 h-4" />;
    case 'Audio':
      return <Volume2 className="w-4 h-4" />;
    case 'Skins':
      return <Shirt className="w-4 h-4" />;
    case 'Gameplay':
      return <Gamepad2 className="w-4 h-4" />;
    default:
      return null;
  }
}

export function MetadataDialog() {
  const { metadataDialogOpen, metadataDialogModId, setMetadataDialogOpen } = useUIStore();
  const { data: mods } = useGetMods();
  const updateMetadata = useUpdateModMetadata();
  const queryClient = useQueryClient();

  const mod = mods?.find((m) => m.id === metadataDialogModId);

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [author, setAuthor] = useState('');
  const [version, setVersion] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [category, setCategory] = useState<ModCategory>('Skins');
  const [character, setCharacter] = useState<Character | ''>('');
  const [costume, setCostume] = useState<string>('');
  const [isNsfw, setIsNsfw] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Author autocomplete state
  const [showAuthorSuggestions, setShowAuthorSuggestions] = useState(false);
  const authorInputRef = useRef<HTMLInputElement>(null);

  // Track if costume was loaded from mod (to prevent auto-select overriding it)
  const [costumeLoadedFromMod, setCostumeLoadedFromMod] = useState(false);

  // Get unique authors from all mods for autocomplete
  const uniqueAuthors = useMemo(() => {
    if (!mods) return [];
    const authors = mods
      .map(m => m.metadata.author)
      .filter((a): a is string => !!a && a.trim() !== '')
      .map(a => a.trim());
    return [...new Set(authors)].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }, [mods]);

  // Filter authors based on current input
  const filteredAuthors = useMemo(() => {
    if (!author.trim()) return uniqueAuthors;
    const searchLower = author.toLowerCase();
    return uniqueAuthors.filter(a => a.toLowerCase().includes(searchLower));
  }, [author, uniqueAuthors]);

  // Fetch costumes for selected character
  const { data: costumes = [], isLoading: isLoadingCostumes } = useGetCostumesForCharacter(character || null);


  // Thumbnail state
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState('');
  const [cropImageFile, setCropImageFile] = useState<string | null>(null);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [thumbnailTimestamp, setThumbnailTimestamp] = useState(Date.now());


  // Load mod data when dialog opens (only when dialog opens, not on every mod update)
  useEffect(() => {
    if (metadataDialogOpen && mod) {
      setTitle(mod.metadata.title || mod.name);
      setSubtitle(mod.metadata.subtitle || '');
      setAuthor(mod.metadata.author || '');
      setVersion(mod.metadata.version || '');
      setDescription(mod.metadata.description || '');
      setTags(mod.metadata.tags?.join(', ') || '');
      setCategory(mod.category);
      setCharacter(mod.character || '');
      setCostume(mod.metadata.costume || '');
      setCostumeLoadedFromMod(!!mod.metadata.costume); // Track if costume came from mod
      setIsNsfw(mod.metadata.isNsfw);
      setHasChanges(false);

      // Reset crop dialog state
      setShowCropDialog(false);
      setCropImageUrl('');
      setCropImageFile(null);
    }
  }, [metadataDialogOpen, metadataDialogModId, mod?.id]);

  // Auto-select Default costume when character changes (only if costume wasn't already set from mod)
  useEffect(() => {
    if (!character || character === 'All Characters') {
      setCostume('');
      setCostumeLoadedFromMod(false);
    } else if (!costume && !costumeLoadedFromMod && costumes.length > 0) {
      // If character is set but no costume and costume wasn't loaded from mod, auto-select the default costume
      const defaultCostume = costumes.find(c => c.isDefault);
      if (defaultCostume) {
        setCostume(defaultCostume.id);
      }
    }
  }, [character, costumes, costume, costumeLoadedFromMod]);

  // Pre-request clipboard permission when dialog opens
  useEffect(() => {
    if (metadataDialogOpen && navigator.clipboard && navigator.clipboard.read) {
      // Silently request clipboard permission in the background
      navigator.clipboard.read().catch(() => {
        // Permission denied or not supported - fail silently
        // The permission prompt will show when user clicks the paste button
      });
    }
  }, [metadataDialogOpen]);

  // Add keyboard shortcut for paste (Ctrl+V)
  useEffect(() => {
    if (!metadataDialogOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+V (Windows/Linux) or Cmd+V (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        // Don't interfere with paste in input fields
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }

        // Trigger clipboard paste
        e.preventDefault();
        handlePasteFromClipboard();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [metadataDialogOpen]);

  // Track changes
  useEffect(() => {
    if (mod) {
      const changed =
        title !== (mod.metadata.title || mod.name) ||
        subtitle !== (mod.metadata.subtitle || '') ||
        author !== (mod.metadata.author || '') ||
        description !== (mod.metadata.description || '') ||
        category !== mod.category ||
        (character || '') !== (mod.character || '') ||
        (costume || '') !== (mod.metadata.costume || '') ||
        isNsfw !== mod.metadata.isNsfw;
      setHasChanges(changed);
    }
  }, [mod, title, subtitle, author, description, category, character, costume, isNsfw]);

  // Check for duplicate mods with same name + character + costume
  const duplicateMod = mods?.find((m) => {
    if (!mod || m.id === mod.id) return false; // Don't compare with self

    // Normalize values for comparison
    const sameTitle = m.metadata.title.toLowerCase() === title.toLowerCase();
    const sameCharacter = (m.character || '') === (character || '');
    const sameCostume = (m.metadata.costume || '') === (costume || '');

    return sameTitle && sameCharacter && sameCostume;
  });

  const handleSave = async () => {
    if (!mod) return;

    const tagsArray = tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    await updateMetadata.mutateAsync({
      modId: mod.id,
      metadata: {
        ...mod.metadata,
        title,
        subtitle: subtitle || null,
        author: author || null,
        version: version || null,
        description,
        tags: tagsArray,
        category,
        character: character || null,
        costume: costume || null,
        isNsfw,
      },
    });

    // The backend's update_metadata already handles folder reorganization
    // when character/category/title changes, so we don't need to call organize_mods

    setMetadataDialogOpen(false);
  };

  const handleClose = async () => {
    // If user is canceling during a multi-mod installation and hasn't made changes,
    // we should delete the mod that was just installed (orphaned files)
    if (mod && !hasChanges) {

      // Check if this mod was just installed (metadata is still mostly default)
      // Fresh installs have: no author, no description, no tags, default category (Skins), no character
      const isFreshInstall =
        !mod.metadata.author &&
        !mod.metadata.description &&
        (!mod.metadata.tags || mod.metadata.tags.length === 0) &&
        mod.category === 'Skins' &&
        !mod.character;

      if (isFreshInstall) {
        try {
          await invoke('delete_mod', { modId: mod.id });
          // Remove from cache using optimistic update (same query key as useGetMods)
          queryClient.setQueryData(['mods', 'list'], (oldMods: any[] = []) => {
            return oldMods.filter(m => m.id !== mod.id);
          });
          toast.info('Cancelled installation - mod removed');
        } catch (error) {
          console.error('[MetadataDialog] Failed to delete orphaned mod:', error);
        }
      }
    }

    setMetadataDialogOpen(false);
  };

  // Handle upload image from file
  const handleUploadImage = async () => {
    try {
      const file = await open({
        multiple: false,
        filters: [
          {
            name: 'Image',
            extensions: ['png', 'jpg', 'jpeg', 'webp'],
          },
        ],
      });

      if (file) {
        // Show crop dialog with the selected file
        setCropImageFile(file as string);
        setCropImageUrl(convertFileSrc(file as string));
        setShowCropDialog(true);
      }
    } catch (error) {
      console.error('Failed to select image:', error);
      toast.error('Failed to select image');
    }
  };

  // Handle download image from URL
  const handleDownloadFromUrl = async () => {
    if (!imageUrl.trim()) {
      toast.error('Please enter an image URL');
      return;
    }

    try {
      // Validate URL
      const url = new URL(imageUrl.trim());
      if (!url.protocol.startsWith('http')) {
        toast.error('Invalid URL protocol. Use http or https');
        return;
      }

      // Show crop dialog with the URL
      setCropImageUrl(imageUrl.trim());
      setCropImageFile(null);
      setShowCropDialog(true);
    } catch (error) {
      console.error('Invalid URL:', error);
      toast.error('Invalid URL format');
    }
  };

  // Handle paste image from clipboard
  const handlePasteFromClipboard = async () => {
    try {
      // Check if clipboard API is supported
      if (!navigator.clipboard || !navigator.clipboard.read) {
        toast.error('Clipboard access not supported in your browser');
        return;
      }

      // Read clipboard
      const clipboardItems = await navigator.clipboard.read();

      for (const item of clipboardItems) {
        // Find image type
        const imageType = item.types.find(type => type.startsWith('image/'));

        if (imageType) {
          const blob = await item.getType(imageType);

          // Convert blob to data URL so Rust can download it
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;

            // Show crop dialog with the data URL
            setCropImageUrl(dataUrl);
            setCropImageFile(null);
            setShowCropDialog(true);

          };
          reader.readAsDataURL(blob);

          return;
        }
      }

      toast.error('No image found in clipboard');
    } catch (error) {
      console.error('Failed to paste from clipboard:', error);
      toast.error('Failed to paste image. Make sure you have copied an image.');
    }
  };

  // Handle crop complete
  const handleCropComplete = async (cropData: { x: number; y: number; width: number; height: number }) => {
    if (!mod) return;

    setIsUploadingThumbnail(true);
    setShowCropDialog(false);

    try {
      if (cropImageFile) {
        await invoke<string>('save_thumbnail_from_file', {
          modId: mod.id,
          filePath: cropImageFile,
          cropData,
        });
      } else {
        await invoke<string>('download_and_save_thumbnail', {
          modId: mod.id,
          url: cropImageUrl,
          cropData,
        });
      }

      toast.success('Thumbnail saved successfully');

      // Update timestamp to bust cache
      setThumbnailTimestamp(Date.now());

      // Refresh mods query
      await queryClient.invalidateQueries({ queryKey: ['mods', 'list'] });
    } catch (error) {
      console.error('Failed to save thumbnail:', error);
      toast.error('Failed to save thumbnail: ' + String(error));
    } finally {
      setIsUploadingThumbnail(false);
      setCropImageUrl('');
      setCropImageFile(null);
      setImageUrl('');
    }
  };

  // Handle crop cancel
  const handleCropCancel = () => {
    setShowCropDialog(false);
    setCropImageUrl('');
    setCropImageFile(null);
  };

  const thumbnailSrc = mod?.thumbnailPath ? convertFileSrc(mod.thumbnailPath) : null;
  const thumbnailSrcWithCache = thumbnailSrc ? `${thumbnailSrc}?t=${thumbnailTimestamp}` : null;

  return (
    <>
    <Dialog open={metadataDialogOpen && !showCropDialog} onOpenChange={handleClose}>
      <DialogContent className="w-[90vw] sm:max-w-[1400px] max-h-[90vh] p-0 overflow-hidden bg-card overflow-x-hidden rounded-2xl">
        {!mod ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-gray-400">Loading mod data...</p>
          </div>
        ) : (
          <>
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-border/40">
          <DialogTitle className="text-2xl font-bold text-white tracking-tight">Edit Mod Metadata</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-0.5">
            Update mod information and thumbnail
          </DialogDescription>
        </div>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-[440px_1fr] h-[720px] overflow-x-hidden">
          {/* Left Column - Thumbnail */}
          <div className="px-6 py-5 border-r border-border/40 overflow-y-auto bg-background/50">
            <div className="space-y-4" style={{ animation: 'metadata-fade-in 400ms ease-out both' }}>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Thumbnail Preview</h3>
                <p className="text-xs text-muted-foreground/60 mt-1">16:9 aspect ratio recommended</p>
              </div>

              {/* Current Thumbnail */}
              <div className="aspect-video bg-black/40 rounded-xl overflow-hidden ring-1 ring-white/5">
                {thumbnailSrcWithCache ? (
                  <img
                    src={thumbnailSrcWithCache}
                    alt="Mod thumbnail"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No thumbnail</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload and Paste Buttons (Side by Side) */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleUploadImage}
                  disabled={isUploadingThumbnail}
                  className="px-4 py-3 bg-muted/40 text-foreground rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer group hover:bg-primary/15 hover:text-primary disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isUploadingThumbnail ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 transition-transform duration-200 group-hover:-translate-y-0.5" />
                  )}
                  {isUploadingThumbnail ? 'Uploading...' : 'Upload Image'}
                </button>

                <button
                  onClick={handlePasteFromClipboard}
                  disabled={isUploadingThumbnail}
                  className="px-4 py-3 bg-muted/40 text-foreground rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer group hover:bg-primary/15 hover:text-primary disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isUploadingThumbnail ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Clipboard className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                  )}
                  {isUploadingThumbnail ? 'Processing...' : 'Paste Clipboard'}
                </button>
              </div>

              {/* OR Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-border/40"></div>
                <span className="text-[11px] text-muted-foreground/50 uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-border/40"></div>
              </div>

              {/* URL Input */}
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.png"
                className="bg-muted/30 border-border/40 h-11 text-sm rounded-xl"
              />

              {/* Download from URL Button */}
              <button
                onClick={handleDownloadFromUrl}
                disabled={isUploadingThumbnail || !imageUrl.trim()}
                className="w-full px-4 py-3 bg-muted/40 text-foreground rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer group hover:bg-primary/15 hover:text-primary disabled:opacity-50 disabled:pointer-events-none"
              >
                {isUploadingThumbnail ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 transition-transform duration-200 group-hover:translate-y-0.5" />
                )}
                {isUploadingThumbnail ? 'Processing...' : 'Download from URL'}
              </button>
            </div>
          </div>

          {/* Right Column - Metadata */}
          <div className="px-6 py-5 overflow-y-auto overflow-x-hidden">
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4" style={{ animation: 'metadata-fade-in 400ms ease-out 100ms both' }}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Basic Information</h3>

                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm font-medium text-foreground">
                    Name <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Mod name"
                    className="bg-muted/30 border-border/40 h-11 text-base rounded-xl"
                    autoComplete="off"
                  />
                </div>

                {/* Subtitle with preset chips */}
                <div className="space-y-2">
                  <Label htmlFor="subtitle" className="text-sm font-medium text-foreground">
                    Subtitle
                  </Label>
                  <Input
                    id="subtitle"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Click presets below or type custom..."
                    className="bg-muted/30 border-border/40 h-11 text-base rounded-xl"
                    autoComplete="off"
                  />
                  {/* Compact preset chips */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {/* Type presets (orange) */}
                    {['Add-on'].map((preset) => {
                      const isSelected = subtitle.includes(preset);
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              // Remove preset
                              setSubtitle(prev => prev.replace(new RegExp(`${preset} • |${preset}| • ${preset}`, 'g'), '').trim());
                            } else {
                              setSubtitle(prev => prev ? `${preset} • ${prev}` : preset);
                            }
                          }}
                          className={`px-3 py-1 text-xs rounded-full transition-all duration-200 ${
                            isSelected
                              ? 'bg-orange-500/25 text-orange-400'
                              : 'bg-muted text-gray-500 hover:text-orange-400 hover:bg-orange-500/15'
                          }`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                    {/* Skin presets (green) */}
                    {['Retexture', 'Remesh'].map((preset) => {
                      const isSelected = subtitle.includes(preset);
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSubtitle(prev => prev.replace(new RegExp(` • ${preset}|${preset} • |${preset}`, 'g'), '').trim());
                            } else {
                              setSubtitle(prev => prev ? `${prev} • ${preset}` : preset);
                            }
                          }}
                          className={`px-3 py-1 text-xs rounded-full transition-all duration-200 ${
                            isSelected
                              ? 'bg-emerald-500/25 text-emerald-400'
                              : 'bg-muted text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/15'
                          }`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                    {/* UI presets (cyan) */}
                    {['Icons', 'MVP Frame', 'Portrait'].map((preset) => {
                      const isSelected = subtitle.includes(preset);
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSubtitle(prev => prev.replace(new RegExp(` • ${preset}|${preset} • |${preset}`, 'g'), '').trim());
                            } else {
                              setSubtitle(prev => prev ? `${prev} • ${preset}` : preset);
                            }
                          }}
                          className={`px-3 py-1 text-xs rounded-full transition-all duration-200 ${
                            isSelected
                              ? 'bg-cyan-500/25 text-cyan-400'
                              : 'bg-muted text-gray-500 hover:text-cyan-400 hover:bg-cyan-500/15'
                          }`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                    {/* Audio presets (purple) */}
                    {['Voice', 'Ult Voice', 'Ult Music', 'SFX'].map((preset) => {
                      const isSelected = subtitle.includes(preset);
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSubtitle(prev => prev.replace(new RegExp(` • ${preset}|${preset} • |${preset}`, 'g'), '').trim());
                            } else {
                              setSubtitle(prev => prev ? `${prev} • ${preset}` : preset);
                            }
                          }}
                          className={`px-3 py-1 text-xs rounded-full transition-all duration-200 ${
                            isSelected
                              ? 'bg-purple-500/25 text-purple-400'
                              : 'bg-muted text-gray-500 hover:text-purple-400 hover:bg-purple-500/15'
                          }`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                    {/* Scope presets (blue) */}
                    {['Lobby Only', 'In-Game Only'].map((preset) => {
                      const isSelected = subtitle.includes(preset);
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSubtitle(prev => prev.replace(new RegExp(` • ${preset}|${preset} • |${preset}`, 'g'), '').trim());
                            } else {
                              setSubtitle(prev => prev ? `${prev} • ${preset}` : preset);
                            }
                          }}
                          className={`px-3 py-1 text-xs rounded-full transition-all duration-200 ${
                            isSelected
                              ? 'bg-blue-500/25 text-blue-400'
                              : 'bg-muted text-gray-500 hover:text-blue-400 hover:bg-blue-500/15'
                          }`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                    {/* Clear */}
                    {subtitle && (
                      <button
                        type="button"
                        onClick={() => setSubtitle('')}
                        className="px-2 py-0.5 text-[11px] rounded bg-muted text-gray-500 hover:text-red-400 hover:bg-red-500/15 transition-all"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Author with autocomplete */}
                <div className="space-y-2 relative">
                  <Label htmlFor="author" className="text-sm font-medium text-foreground">
                    Author
                  </Label>
                  <Input
                    ref={authorInputRef}
                    id="author"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    onFocus={() => setShowAuthorSuggestions(true)}
                    onBlur={() => {
                      // Delay hiding to allow click on suggestion
                      setTimeout(() => setShowAuthorSuggestions(false), 150);
                    }}
                    placeholder="Mod author name..."
                    className="bg-muted/30 border-border/40 h-11 text-base rounded-xl"
                    autoComplete="off"
                  />
                  {/* Author suggestions dropdown */}
                  {showAuthorSuggestions && filteredAuthors.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-card border border-border/40 rounded-xl shadow-lg overflow-hidden">
                      <ScrollArea className="h-[200px]">
                        <div className="py-1">
                          {filteredAuthors.map((authorName) => (
                            <button
                              key={authorName}
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-primary/20 text-gray-300 hover:text-white transition-colors"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setAuthor(authorName);
                                setShowAuthorSuggestions(false);
                              }}
                            >
                              {authorName}
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium text-foreground">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter mod description..."
                    rows={3}
                    className="bg-muted/30 border-border/40 text-base resize-none rounded-xl"
                  />
                </div>
              </div>

              {/* Category & Character */}
              <div className="space-y-4" style={{ animation: 'metadata-fade-in 400ms ease-out 200ms both' }}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category & Character</h3>

                {/* Horizontal Grid for Category, Character, and Costume */}
                <div className="grid grid-cols-3 gap-3 min-w-0">
                  {/* Category */}
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="category" className="text-sm font-medium text-foreground">
                      Category
                    </Label>
                    <Select value={category} onValueChange={(value) => setCategory(value as ModCategory)}>
                      <SelectTrigger id="category" className="bg-muted/30 border-border/40 hover:bg-muted/50 transition-colors h-11 rounded-xl">
                        <SelectValue>
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(category)}
                            <span>{category}</span>
                          </div>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {MOD_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            <div className="flex items-center gap-2">
                              {getCategoryIcon(cat)}
                              <span>{cat}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Character */}
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="character" className="text-sm font-medium text-foreground">
                      Character
                    </Label>
                    <Select value={character || 'none'} onValueChange={(value) => {
                      setCharacter(value === 'none' ? '' : value as Character);
                      setCostumeLoadedFromMod(false); // Reset so new character auto-selects default costume
                    }}>
                      <SelectTrigger id="character" className="bg-muted/30 border-border/40 hover:bg-muted/50 transition-colors h-11 rounded-xl">
                        <SelectValue placeholder="Select character">
                          {character ? (
                            <div className="flex items-center gap-2 overflow-hidden">
                              <img
                                src={getCharacterIconPath(character)}
                                alt={character}
                                className="w-8 h-8 rounded-full object-cover border border-border flex-shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                              <span className="truncate">{character}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Select character</span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px] scroll-smooth">
                        <SelectItem value="none">
                          <span className="text-muted-foreground">None</span>
                        </SelectItem>
                        {ALL_CHARACTERS.map((char) => (
                          <SelectItem key={char} value={char}>
                            <div className="flex items-center gap-2 overflow-hidden max-w-full">
                              <img
                                src={getCharacterIconPath(char)}
                                alt={char}
                                className="w-8 h-8 rounded-full object-cover border border-border flex-shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                              <span className="truncate flex-1">{char}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Costume - Show always but disabled if no character */}
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="costume" className="text-sm font-medium text-foreground">
                      Costume / Skin
                    </Label>
                    <Select
                      value={costume || 'none'}
                      onValueChange={(value) => setCostume(value === 'none' ? '' : value)}
                      disabled={!character || character === 'All Characters'}
                    >
                      <SelectTrigger
                        id="costume"
                        className="bg-muted/30 border-border/40 hover:bg-muted/50 transition-colors h-11 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <SelectValue placeholder={!character ? "Select character first" : "Select costume"}>
                          {costume && costumes.find(c => c.id === costume) ? (
                            <div className="flex items-center gap-2 overflow-hidden">
                              <img
                                src={`/assets/costume-icons/${costumes.find(c => c.id === costume)?.imagePath}`}
                                alt={costumes.find(c => c.id === costume)?.name}
                                className="w-8 h-8 rounded-full object-cover border border-border flex-shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                              <span className="truncate">{costumes.find(c => c.id === costume)?.name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">
                              {!character ? "Select character first" : "Select costume"}
                            </span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px] scroll-smooth">
                        <SelectItem value="none">
                          <span className="text-muted-foreground">None</span>
                        </SelectItem>
                        {isLoadingCostumes ? (
                          <div className="flex items-center justify-center p-4">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : costumes.length > 0 ? (
                          costumes.map((costumeItem) => (
                            <SelectItem key={costumeItem.id} value={costumeItem.id}>
                              <div className="flex items-center gap-2 overflow-hidden max-w-full">
                                <img
                                  src={`/assets/costume-icons/${costumeItem.imagePath}`}
                                  alt={costumeItem.name}
                                  className="w-8 h-8 rounded-full object-cover border border-border flex-shrink-0"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                                <span className="truncate flex-1">{costumeItem.name}</span>
                                {costumeItem.isDefault && (
                                  <span className="text-xs text-muted-foreground flex-shrink-0">(Default)</span>
                                )}
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <div className="flex items-center justify-center p-4 text-muted-foreground text-sm">
                            No costumes available
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* NSFW Toggle */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/10" style={{ animation: 'metadata-fade-in 400ms ease-out 300ms both' }}>
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      id="nsfw"
                      checked={isNsfw}
                      onChange={(e) => setIsNsfw(e.target.checked)}
                      className="peer sr-only"
                    />
                    <label
                      htmlFor="nsfw"
                      className="w-4 h-4 mt-0.5 rounded border-2 border-red-400 bg-transparent cursor-pointer flex items-center justify-center peer-checked:bg-red-400 peer-checked:border-red-400 transition-colors"
                    >
                      {isNsfw && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </label>
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="nsfw" className="cursor-pointer text-red-400 font-medium text-sm">
                      NSFW Content (18+)
                    </Label>
                    <p className="text-xs text-gray-500 mt-1">
                      Mark this mod as containing Not Safe For Work content
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-border/40 bg-background/50">
          <div className="flex items-center gap-2">
            {hasChanges ? (
              <span className="text-sm text-yellow-400">Unsaved changes</span>
            ) : (
              <div className="flex items-center gap-2 text-sm text-green-400">
                <Check className="w-4 h-4" />
                No changes
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Duplicate warning */}
            {duplicateMod && (
              <div className="flex items-center gap-2 text-amber-500 text-sm mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>Another mod exists with this name{character ? ` for ${character}` : ''}{costume ? ` (${costumes.find(c => c.id === costume)?.name || costume})` : ''}</span>
              </div>
            )}
            <Button variant="outline" onClick={handleClose} className="border-border">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMetadata.isPending || !hasChanges}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {updateMetadata.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
        </>
        )}
      </DialogContent>
    </Dialog>

      {/* Crop Dialog */}
      {showCropDialog && cropImageUrl && (
        <ImageCropDialog
          imageUrl={cropImageUrl}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </>
  );
}
