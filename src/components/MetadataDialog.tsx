import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../stores';
import { useGetMods, useUpdateModMetadata, useGetCostumesForCharacter } from '../hooks/useMods';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { ModCategory, Character } from '../types/mod.types';
import { ALL_CHARACTERS, MOD_CATEGORIES } from '../shared/constants';
import { Upload, Download, Clipboard, Image as ImageIcon, Check, Loader2, Pencil } from 'lucide-react';
import { c, tint, categoryColor, getCostumeIconSrc } from '../shared/rivals-tokens';
import { useDominantColor } from '../hooks/useDominantColor';
import { convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { ImageCropDialog } from './ImageCropDialog';
import { toast } from 'sonner';
import { detectCharacterFromPath } from '../utils/characterDetection';

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

// Round avatar whose ring is tinted by the image's most prominent color.
// An outer wrapper adds transparent room so the hover glow paints INSIDE the
// element's own footprint (never clipped by the overflow-hidden select boxes).
function RingAvatar({ src, alt, size }: { src: string; alt: string; size: number }) {
  const dominant = useDominantColor(src);
  const ring = dominant ? `color-mix(in oklch, ${dominant} 65%, transparent)` : tint(c.accent, 35);
  const glow = dominant ?? 'var(--rivals-accent)';
  return (
    <span className="ring-avatar flex-shrink-0" style={{ ['--ring-glow' as string]: glow }}>
      <span
        className="ring-avatar-ring rounded-full grid place-items-center"
        style={{ width: size, height: size, padding: 2, background: c.bg, border: `2px solid ${ring}`, boxSizing: 'border-box', transition: 'box-shadow 200ms ease, border-color 200ms ease' }}
      >
        <img
          src={src}
          alt={alt}
          className="rounded-full object-cover w-full h-full"
          style={{ boxShadow: `0 0 0 1px ${c.line}` }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </span>
    </span>
  );
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
  const [parentModId, setParentModId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [parentSearchQuery, setParentSearchQuery] = useState('');
  const [showParentPicker, setShowParentPicker] = useState(false);
  const parentInputRef = useRef<HTMLInputElement>(null);
  const [parentPickerPos, setParentPickerPos] = useState({ top: 0, left: 0, width: 0 });

  const updateParentPickerPos = () => {
    if (parentInputRef.current) {
      const rect = parentInputRef.current.getBoundingClientRect();
      setParentPickerPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  };

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

  // Check if subtitle contains "Add-on"
  const isAddon = subtitle.toLowerCase().includes('add-on');

  // Potential parent mods (exclude self, exclude other addons, filter by character if set)
  const parentModCandidates = useMemo(() => {
    if (!mods || !mod) return [];
    return mods
      .filter(m => {
        if (m.id === mod.id) return false;
        if (m.metadata.subtitle?.toLowerCase().includes('add-on')) return false;
        if (character && m.character !== character) return false;
        return true;
      })
      .sort((a, b) => (a.metadata.title || a.name).localeCompare(b.metadata.title || b.name));
  }, [mods, mod, character]);

  // Filtered parent mods based on search
  const filteredParentMods = useMemo(() => {
    if (!parentSearchQuery.trim()) return parentModCandidates;
    const q = parentSearchQuery.toLowerCase();
    return parentModCandidates.filter(m =>
      (m.metadata.title || m.name).toLowerCase().includes(q) ||
      (m.metadata.author || '').toLowerCase().includes(q) ||
      (m.character || '').toLowerCase().includes(q)
    );
  }, [parentModCandidates, parentSearchQuery]);

  // Get the selected parent mod info
  const selectedParentMod = useMemo(() => {
    if (!parentModId || !mods) return null;
    return mods.find(m => m.id === parentModId) || null;
  }, [parentModId, mods]);

  // Fetch costumes for selected character
  const { data: costumes = [], isLoading: isLoadingCostumes } = useGetCostumesForCharacter(character || null);

  // Currently selected costume object (for the select trigger preview)
  const selectedCostume = costume ? costumes.find(c => c.id === costume) : undefined;


  // Auto-detect costume from Nexus mod name once costumes load
  useEffect(() => {
    const pendingMatch = localStorage.getItem('nexus_pending_costume_match');
    if (pendingMatch && costumes.length > 0 && !costume) {
      const modNameLower = pendingMatch.toLowerCase();

      // Try to find a matching costume by name
      const matched = costumes.find(c => {
        if (c.isDefault) return false;
        const costumeName = c.name.toLowerCase();
        // Check if the costume name appears in the mod name
        return modNameLower.includes(costumeName) ||
          modNameLower.includes(costumeName.replace(/\s+/g, '-')) ||
          modNameLower.includes(costumeName.replace(/\s+/g, ''));
      });

      if (matched) {
        setCostume(matched.id);
        setCostumeLoadedFromMod(true);
        console.log('[MetadataDialog] Auto-detected costume from Nexus name:', matched.name);
      }

      localStorage.removeItem('nexus_pending_costume_match');
    }
  }, [costumes, costume]);

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
      setParentModId(mod.metadata.parentModId || null);
      setHasChanges(false);

      // Check for pending Nexus Mods data (from "Download with Manager")
      const nexusThumbnail = localStorage.getItem('nexus_pending_thumbnail');
      const nexusModName = localStorage.getItem('nexus_pending_mod_name');
      const nexusAuthor = localStorage.getItem('nexus_pending_mod_author');
      const nexusDescription = localStorage.getItem('nexus_pending_mod_description');

      if (nexusModName && !mod.metadata.author) {
        // This is likely the mod we just downloaded from Nexus — auto-fill
        if (nexusModName) setTitle(nexusModName);
        if (nexusAuthor) setAuthor(nexusAuthor);
        if (nexusDescription) setDescription(nexusDescription);

        // Auto-detect character from Nexus mod name
        const detectedChar = detectCharacterFromPath(nexusModName);
        if (detectedChar && detectedChar !== 'All Characters') {
          setCharacter(detectedChar);
          console.log('[MetadataDialog] Auto-detected character from Nexus name:', detectedChar);

          // Try to detect costume from mod name
          // We'll match against costume data after the character is set
          // Store the mod name for costume matching in the next render cycle
          localStorage.setItem('nexus_pending_costume_match', nexusModName);
        }

        // Auto-download thumbnail from Nexus
        if (nexusThumbnail) {
          setImageUrl(nexusThumbnail);
          (async () => {
            try {
              await invoke<string>('download_and_save_thumbnail', {
                modId: mod.id,
                url: nexusThumbnail,
                cropData: null,
              });
              setThumbnailTimestamp(Date.now());
              await queryClient.refetchQueries({ queryKey: ['mods', 'list'] });
            } catch (err) {
              console.error('[MetadataDialog] Failed to auto-download Nexus thumbnail:', err);
            }
          })();
        }

        setHasChanges(true);

        // Clear the pending data
        localStorage.removeItem('nexus_pending_thumbnail');
        localStorage.removeItem('nexus_pending_mod_name');
        localStorage.removeItem('nexus_pending_mod_author');
        localStorage.removeItem('nexus_pending_mod_description');
        localStorage.removeItem('nexus_pending_nexus_mod_id');
      }

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
        isNsfw !== mod.metadata.isNsfw ||
        (parentModId || null) !== (mod.metadata.parentModId || null);
      setHasChanges(changed);
    }
  }, [mod, title, subtitle, author, description, category, character, costume, isNsfw, parentModId]);

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

    const updatedMod = await updateMetadata.mutateAsync({
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
        parentModId: parentModId || null,
      },
    });

    // If the mod ID changed (due to folder rename), update any addons pointing to the old ID
    if (updatedMod && updatedMod.updatedMod.id !== mod.id && mods) {
      const newId = updatedMod.updatedMod.id;
      const addonsToMigrate = mods.filter(m => m.metadata.parentModId === mod.id);
      for (const addon of addonsToMigrate) {
        try {
          await updateMetadata.mutateAsync({
            modId: addon.id,
            metadata: {
              ...addon.metadata,
              parentModId: newId,
            },
          });
          console.log(`[MetadataDialog] Migrated addon "${addon.name}" to new parent ID: ${newId}`);
        } catch (err) {
          console.error(`[MetadataDialog] Failed to migrate addon "${addon.name}":`, err);
        }
      }
    }

    setMetadataDialogOpen(false);
  };

  const handleClose = async () => {
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

      // Force refetch mods to update card thumbnails
      await queryClient.refetchQueries({ queryKey: ['mods', 'list'] });
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
      <DialogContent
        className="w-[92vw] sm:max-w-[1500px] max-h-[85vh] p-0 overflow-hidden overflow-x-hidden flex flex-col"
        style={{ background: c.bg, border: `1px solid ${c.line2}`, borderRadius: 16 }}
      >
        {!mod ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin" style={{ color: c.accent }} />
            <p style={{ color: c.ink3, fontFamily: c.font }}>Loading mod data…</p>
          </div>
        ) : (
          <>
        {/* Header */}
        <div className="flex items-center gap-3" style={{ padding: '18px 24px', borderBottom: `1px solid ${c.line}`, background: c.panel }}>
          <div className="grid place-items-center" style={{ width: 40, height: 40, borderRadius: 10, background: tint(c.accent, 14), color: c.accent }}>
            <Pencil className="w-5 h-5" />
          </div>
          <div>
            <DialogTitle asChild>
              <h2 className="rivals-display" style={{ color: c.ink, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>Edit Mod Metadata</h2>
            </DialogTitle>
            <DialogDescription asChild>
              <p className="rivals-mono" style={{ color: c.ink3, fontSize: 11.5, marginTop: 2 }}>Update mod information &amp; thumbnail</p>
            </DialogDescription>
          </div>
        </div>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-[540px_1fr] flex-1 min-h-0 overflow-x-hidden">
          {/* Left Column - Thumbnail */}
          <div className="px-6 py-5 overflow-y-auto" style={{ borderRight: `1px solid ${c.line}`, background: c.panel }}>
            <div className="space-y-4" style={{ animation: 'metadata-fade-in 400ms ease-out both' }}>
              <div>
                <h3 className="rivals-mono" style={{ color: 'var(--rivals-ink3)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>Thumbnail Preview</h3>
                <p className="mt-1" style={{ color: c.ink3, fontFamily: c.font, fontSize: 11.5 }}>16:9 aspect ratio recommended</p>
              </div>

              {/* Current Thumbnail */}
              <div className="aspect-video overflow-hidden" style={{ background: c.bg, borderRadius: 12, border: `1px solid ${c.line2}` }}>
                {thumbnailSrcWithCache ? (
                  <img
                    src={thumbnailSrcWithCache}
                    alt="Mod thumbnail"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ color: c.muted }}>
                    <div className="text-center">
                      <ImageIcon className="w-14 h-14 mx-auto mb-2 opacity-60" />
                      <p style={{ fontFamily: c.mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>No thumbnail</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload and Paste Buttons (Side by Side) */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleUploadImage}
                  disabled={isUploadingThumbnail}
                  className="thumb-btn up px-4 py-3 rounded-lg text-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                  style={{ fontFamily: c.font }}
                >
                  {isUploadingThumbnail ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="thumb-btn-icon w-4 h-4" />
                  )}
                  {isUploadingThumbnail ? 'Uploading…' : 'Upload Image'}
                </button>

                <button
                  onClick={handlePasteFromClipboard}
                  disabled={isUploadingThumbnail}
                  className="thumb-btn px-4 py-3 rounded-lg text-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                  style={{ fontFamily: c.font }}
                >
                  {isUploadingThumbnail ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Clipboard className="thumb-btn-icon w-4 h-4" />
                  )}
                  {isUploadingThumbnail ? 'Processing…' : 'Paste Clipboard'}
                </button>
              </div>

              {/* OR Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px" style={{ background: c.line }}></div>
                <span style={{ color: c.muted, fontFamily: c.mono, fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase' }}>or</span>
                <div className="flex-1 h-px" style={{ background: c.line }}></div>
              </div>

              {/* URL Input */}
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.png"
                style={{ background: c.bg, borderColor: c.line2 }} className="rivals-input h-11 text-sm rounded-lg"
              />

              {/* Download from URL Button */}
              <button
                onClick={handleDownloadFromUrl}
                disabled={isUploadingThumbnail || !imageUrl.trim()}
                className="thumb-btn down w-full px-4 py-3 rounded-lg text-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                style={{ fontFamily: c.font }}
              >
                {isUploadingThumbnail ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="thumb-btn-icon w-4 h-4" />
                )}
                {isUploadingThumbnail ? 'Processing…' : 'Download from URL'}
              </button>
            </div>
          </div>

          {/* Right Column - Metadata */}
          <div className="px-6 py-4 overflow-y-auto">
            <div className="space-y-4">
              {/* Basic Information */}
              <div className="space-y-2.5" style={{ animation: 'metadata-fade-in 400ms ease-out 100ms both' }}>
                <h3 className="rivals-mono" style={{ color: 'var(--rivals-ink3)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>Basic Information</h3>

                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="title" className="rivals-font" style={{ color: 'var(--rivals-ink2)', fontSize: 12.5, fontWeight: 600 }}>
                    Name <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Mod name"
                    style={{ background: c.bg, borderColor: c.line2 }} className="rivals-input h-9 text-sm rounded-lg"
                    autoComplete="off"
                  />
                </div>

                {/* Subtitle with preset chips */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="subtitle" className="rivals-font" style={{ color: 'var(--rivals-ink2)', fontSize: 12.5, fontWeight: 600 }}>
                      Subtitle
                    </Label>
                    {subtitle && (
                      <button
                        type="button"
                        onClick={() => setSubtitle('')}
                        className="rivals-mono inline-flex items-center gap-1 cursor-pointer transition-colors"
                        style={{ color: c.ink3, fontSize: 10, letterSpacing: '0.06em' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = c.nsfw as string)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = c.ink3 as string)}
                      >
                        ✕ Clear
                      </button>
                    )}
                  </div>
                  <Input
                    id="subtitle"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Click presets below or type custom..."
                    style={{ background: c.bg, borderColor: c.line2 }} className="rivals-input h-9 text-sm rounded-lg"
                    autoComplete="off"
                  />
                  {/* Compact preset chips — uniform grid for symmetry */}
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
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
                          className={`preset-pill w-full px-3 py-1.5 text-[11.5px] font-medium rounded-full border transition-all duration-200 ${
                            isSelected
                              ? 'bg-orange-500/25 text-orange-400'
                              : 'bg-[var(--rivals-bg)] text-[var(--rivals-ink3)] hover:text-orange-400 hover:bg-orange-500/15'
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
                          className={`preset-pill w-full px-3 py-1.5 text-[11.5px] font-medium rounded-full border transition-all duration-200 ${
                            isSelected
                              ? 'bg-emerald-500/25 text-emerald-400'
                              : 'bg-[var(--rivals-bg)] text-[var(--rivals-ink3)] hover:text-emerald-400 hover:bg-emerald-500/15'
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
                          className={`preset-pill w-full px-3 py-1.5 text-[11.5px] font-medium rounded-full border transition-all duration-200 ${
                            isSelected
                              ? 'bg-cyan-500/25 text-cyan-400'
                              : 'bg-[var(--rivals-bg)] text-[var(--rivals-ink3)] hover:text-cyan-400 hover:bg-cyan-500/15'
                          }`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                    {/* Audio presets (purple) */}
                    {['Voice', 'Ult Voice', 'Ultimate Music', 'SFX'].map((preset) => {
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
                          className={`preset-pill w-full px-3 py-1.5 text-[11.5px] font-medium rounded-full border transition-all duration-200 ${
                            isSelected
                              ? 'bg-purple-500/25 text-purple-400'
                              : 'bg-[var(--rivals-bg)] text-[var(--rivals-ink3)] hover:text-purple-400 hover:bg-purple-500/15'
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
                          className={`preset-pill w-full px-3 py-1.5 text-[11.5px] font-medium rounded-full border transition-all duration-200 ${
                            isSelected
                              ? 'bg-blue-500/25 text-blue-400'
                              : 'bg-[var(--rivals-bg)] text-[var(--rivals-ink3)] hover:text-blue-400 hover:bg-blue-500/15'
                          }`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Author with autocomplete */}
                <div className="space-y-2 relative">
                  <Label htmlFor="author" className="rivals-font" style={{ color: 'var(--rivals-ink2)', fontSize: 12.5, fontWeight: 600 }}>
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
                    style={{ background: c.bg, borderColor: c.line2 }} className="rivals-input h-9 text-sm rounded-lg"
                    autoComplete="off"
                  />
                  {/* Author suggestions dropdown */}
                  {showAuthorSuggestions && filteredAuthors.length > 0 && (
                    <div
                      className="absolute z-50 w-full mt-1 rounded-lg overflow-hidden py-1 overflow-y-auto thin-scrollbar"
                      style={{ background: c.panel, border: `1px solid ${c.line2}`, boxShadow: '0 12px 28px rgba(0,0,0,0.5)', maxHeight: 200 }}
                    >
                      {filteredAuthors.map((authorName) => (
                        <button
                          key={authorName}
                          type="button"
                          className="w-full px-3 py-2 text-left transition-colors"
                          style={{ color: c.ink2, fontFamily: c.font, fontSize: 13 }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = tint(c.accent, 12); e.currentTarget.style.color = c.accent as string; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.ink2 as string; }}
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
                  )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="rivals-font" style={{ color: 'var(--rivals-ink2)', fontSize: 12.5, fontWeight: 600 }}>
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter mod description..."
                    rows={2}
                    style={{ background: c.bg, borderColor: c.line2 }} className="rivals-input text-sm resize-none rounded-lg"
                  />
                </div>
              </div>

              {/* Category & Character */}
              <div className="space-y-2.5" style={{ animation: 'metadata-fade-in 400ms ease-out 200ms both' }}>
                <h3 className="rivals-mono" style={{ color: 'var(--rivals-ink3)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>Category & Character</h3>

                {/* Grid: narrower Category, wider Character + Costume */}
                <div className="grid gap-3 min-w-0" style={{ gridTemplateColumns: '0.75fr 1.15fr 1.15fr' }}>
                  {/* Category */}
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="category" className="rivals-font" style={{ color: 'var(--rivals-ink2)', fontSize: 12.5, fontWeight: 600 }}>
                      Category
                    </Label>
                    <Select value={category} onValueChange={(value) => setCategory(value as ModCategory)}>
                      <SelectTrigger id="category" style={{ background: c.bg, borderColor: c.line2, height: 56 }} className="hover:brightness-110 transition-all rounded-lg">
                        <SelectValue>
                          <div className="flex items-center gap-2">
                            <span style={{ width: 9, height: 9, borderRadius: 3, background: categoryColor(category), flex: '0 0 auto', boxShadow: `0 0 6px ${tint(categoryColor(category), 70)}` }} />
                            <span style={{ fontSize: 15 }}>{category}</span>
                          </div>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent style={{ background: c.panel, borderColor: c.line2 }}>
                        {MOD_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            <div className="flex items-center gap-2">
                              <span style={{ width: 9, height: 9, borderRadius: 3, background: categoryColor(cat), flex: '0 0 auto' }} />
                              <span>{cat}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Character */}
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="character" className="rivals-font" style={{ color: 'var(--rivals-ink2)', fontSize: 12.5, fontWeight: 600 }}>
                      Character
                    </Label>
                    <Select value={character || 'none'} onValueChange={(value) => {
                      setCharacter(value === 'none' ? '' : value as Character);
                      setCostumeLoadedFromMod(false); // Reset so new character auto-selects default costume
                    }}>
                      <SelectTrigger id="character" style={{ background: c.bg, borderColor: c.line2, height: 56 }} className="hover:brightness-110 transition-all rounded-lg">
                        <SelectValue placeholder="Select character">
                          {character ? (
                            <div className="ring-row flex items-center gap-2.5 min-w-0">
                              <RingAvatar src={getCharacterIconPath(character)} alt={character} size={40} />
                              <span className="truncate" style={{ fontSize: 15 }}>{character}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Select character</span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent style={{ background: c.panel, borderColor: c.line2 }} className="max-h-[320px] scroll-smooth">
                        <SelectItem value="none">
                          <span className="text-muted-foreground">None</span>
                        </SelectItem>
                        {ALL_CHARACTERS.map((char) => (
                          <SelectItem key={char} value={char}>
                            <div className="ring-row flex items-center gap-2.5 min-w-0 max-w-full">
                              <RingAvatar src={getCharacterIconPath(char)} alt={char} size={36} />
                              <span className="truncate flex-1" style={{ fontSize: 14 }}>{char}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Costume - Show always but disabled if no character */}
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="costume" className="rivals-font" style={{ color: 'var(--rivals-ink2)', fontSize: 12.5, fontWeight: 600 }}>
                      Costume / Skin
                    </Label>
                    <Select
                      value={costume || 'none'}
                      onValueChange={(value) => setCostume(value === 'none' ? '' : value)}
                      disabled={!character || character === 'All Characters'}
                    >
                      <SelectTrigger
                        id="costume"
                        style={{ background: c.bg, borderColor: c.line2, height: 56 }} className="hover:brightness-110 transition-all rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <SelectValue placeholder={!character ? "Select character first" : "Select costume"}>
                          {selectedCostume ? (
                            <div className="ring-row flex items-center gap-2.5 min-w-0">
                              <RingAvatar
                                src={getCostumeIconSrc(selectedCostume)}
                                alt={selectedCostume.name}
                                size={40}
                              />
                              <span className="truncate" style={{ fontSize: 15 }}>{selectedCostume.name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">
                              {!character ? "Select character first" : "Select costume"}
                            </span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent style={{ background: c.panel, borderColor: c.line2 }} className="max-h-[320px] scroll-smooth">
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
                              <div className="ring-row flex items-center gap-2.5 min-w-0 max-w-full">
                                <RingAvatar src={getCostumeIconSrc(costumeItem)} alt={costumeItem.name} size={36} />
                                <span className="truncate flex-1" style={{ fontSize: 14 }}>{costumeItem.name}</span>
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

                {/* NSFW Toggle — full-card switch that lights up red when active */}
                <button
                  type="button"
                  onClick={() => setIsNsfw(!isNsfw)}
                  className={`nsfw-toggle w-full flex items-center gap-3 p-3.5 rounded-xl text-left cursor-pointer ${isNsfw ? 'is-on' : ''}`}
                  style={{ animation: 'metadata-fade-in 400ms ease-out 300ms both' }}
                >
                  {/* animated checkbox */}
                  <span className="nsfw-box grid place-items-center flex-shrink-0" style={{ width: 22, height: 22, borderRadius: 7 }}>
                    <svg className="nsfw-check w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="nsfw-warn" style={{ fontSize: 13 }}>⚠</span>
                      <span className="nsfw-title" style={{ fontFamily: c.font, fontSize: 13.5, fontWeight: 600 }}>NSFW Content (18+)</span>
                    </div>
                    <p style={{ color: c.ink3, fontFamily: c.font, fontSize: 11.5, marginTop: 2 }}>
                      Mark this mod as containing Not Safe For Work content
                    </p>
                  </div>
                </button>
              </div>

              {/* Parent Mod Picker — only visible when Add-on is in subtitle */}
              {isAddon && (
                <div className="space-y-3" style={{ animation: 'metadata-fade-in 300ms ease-out both' }}>
                  <h3 className="rivals-mono" style={{ color: 'var(--rivals-ink3)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>Parent Mod</h3>

                  {selectedParentMod ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: c.panel, border: `1px solid ${c.line2}` }}>
                      {selectedParentMod.thumbnailPath && (
                        <img
                          src={convertFileSrc(selectedParentMod.thumbnailPath)}
                          alt=""
                          className="rounded-lg object-cover flex-shrink-0"
                          style={{ width: 72, height: 40, border: `1px solid ${c.line2}` }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="truncate" style={{ color: c.ink, fontFamily: c.font, fontSize: 13.5, fontWeight: 600 }}>
                          {selectedParentMod.metadata.title || selectedParentMod.name}
                        </p>
                        <p className="truncate" style={{ color: c.ink3, fontFamily: c.font, fontSize: 11.5 }}>
                          {selectedParentMod.character || selectedParentMod.category}
                          {selectedParentMod.metadata.author && ` · ${selectedParentMod.metadata.author}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setParentModId(null)}
                        className="transition-colors px-2.5 py-1.5 rounded-lg"
                        style={{ color: c.ink3, fontFamily: c.font, fontSize: 12, fontWeight: 600 }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = tint(c.nsfw, 12); e.currentTarget.style.color = c.nsfw as string; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.ink3 as string; }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        ref={parentInputRef}
                        type="text"
                        value={parentSearchQuery}
                        onChange={(e) => {
                          setParentSearchQuery(e.target.value);
                          setShowParentPicker(true);
                        }}
                        onFocus={() => { updateParentPickerPos(); setShowParentPicker(true); }}
                        placeholder="Search for parent mod…"
                        onBlur={() => setTimeout(() => setShowParentPicker(false), 200)}
                        className="rivals-input w-full px-3 py-2.5 text-sm rounded-lg outline-none transition-colors"
                        style={{ background: c.bg, border: `1px solid ${c.line2}` }}
                      />
                      {createPortal(
                        <div
                          onMouseDown={(e) => e.preventDefault()}
                          onWheel={(e) => e.stopPropagation()}
                          className="fixed z-[9999] rounded-lg"
                          style={{
                            background: c.panel,
                            border: `1px solid ${c.line2}`,
                            boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
                            opacity: showParentPicker ? 1 : 0,
                            transform: showParentPicker ? 'translateY(0)' : 'translateY(-8px)',
                            pointerEvents: showParentPicker ? 'auto' : 'none',
                            transition: 'opacity 200ms ease, transform 200ms ease',
                            top: parentPickerPos.top,
                            left: parentPickerPos.left,
                            width: parentPickerPos.width || 'auto',
                          }}
                        >
                          <div
                            className="max-h-[200px] overflow-y-auto overscroll-contain thin-scrollbar p-1"
                            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}
                            onWheel={(e) => e.stopPropagation()}
                          >
                            {filteredParentMods.length === 0 ? (
                              <div className="px-3 py-4 text-center" style={{ color: c.ink3, fontFamily: c.font, fontSize: 12 }}>
                                No mods found
                              </div>
                            ) : (
                              filteredParentMods.map((m) => (
                                <button
                                  key={m.id}
                                  type="button"
                                  className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-md transition-colors"
                                  onMouseEnter={(e) => (e.currentTarget.style.background = tint(c.accent, 12))}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    setParentModId(m.id);
                                    setParentSearchQuery('');
                                    setShowParentPicker(false);
                                  }}
                                >
                                  {m.thumbnailPath ? (
                                    <img
                                      src={convertFileSrc(m.thumbnailPath)}
                                      alt=""
                                      className="rounded-md object-cover flex-shrink-0"
                                      style={{ width: 56, height: 32, border: `1px solid ${c.line2}` }}
                                    />
                                  ) : (
                                    <div className="rounded-md flex items-center justify-center flex-shrink-0" style={{ width: 56, height: 32, background: c.bg, border: `1px solid ${c.line2}`, color: c.muted, fontSize: 12 }}>
                                      ?
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="truncate" style={{ color: c.ink, fontFamily: c.font, fontSize: 13, fontWeight: 500 }}>
                                      {m.metadata.title || m.name}
                                    </p>
                                    <p className="truncate" style={{ color: c.ink3, fontFamily: c.font, fontSize: 11.5 }}>
                                      {m.character || m.category}
                                      {m.metadata.author && ` · ${m.metadata.author}`}
                                    </p>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>,
                        document.body
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5" style={{ borderTop: `1px solid ${c.line}`, background: c.panel }}>
          <div className="flex items-center gap-2">
            {hasChanges ? (
              <span className="rivals-mono" style={{ color: c.warn, fontSize: 12, letterSpacing: '0.04em' }}>● Unsaved changes</span>
            ) : (
              <div className="flex items-center gap-1.5 rivals-mono" style={{ color: c.ok, fontSize: 12, letterSpacing: '0.04em' }}>
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
            <button
              onClick={handleClose}
              className="btn-outline cursor-pointer"
              style={{ padding: '9px 18px', borderRadius: 9, background: 'transparent', color: c.ink2, border: `1px solid ${c.line2}`, fontFamily: c.font, fontSize: 13, fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={updateMetadata.isPending || !hasChanges}
              className="btn-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ padding: '9px 18px', borderRadius: 9, background: c.accent, color: c.onAccent, border: 'none', fontFamily: c.font, fontSize: 13, fontWeight: 600 }}
            >
              {updateMetadata.isPending ? 'Saving…' : 'Save Changes'}
            </button>
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
