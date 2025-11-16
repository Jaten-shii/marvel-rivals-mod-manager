import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../stores';
import { useGetMods, useUpdateModMetadata, useGetCostumesForCharacter } from '../hooks/useMods';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { ModCategory, Character } from '../types/mod.types';
import { ALL_CHARACTERS, MOD_CATEGORIES } from '../shared/constants';
import { Upload, Download, Image as ImageIcon, FileText, Users, Check, Monitor, Volume2, Shirt, Gamepad2, Loader2 } from 'lucide-react';
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

  // Fetch costumes for selected character
  const { data: costumes = [], isLoading: isLoadingCostumes } = useGetCostumesForCharacter(character || null);

  // Debug logging for costume loading
  useEffect(() => {
    if (character) {
      console.log('[MetadataDialog] Selected character:', character);
      console.log('[MetadataDialog] Loading costumes:', isLoadingCostumes);
      console.log('[MetadataDialog] Costumes loaded:', costumes.length, costumes);
    }
  }, [character, costumes, isLoadingCostumes]);

  // Thumbnail state
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState('');
  const [cropImageFile, setCropImageFile] = useState<string | null>(null);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [thumbnailTimestamp, setThumbnailTimestamp] = useState(Date.now());

  // Debug: Log thumbnail changes
  useEffect(() => {
    console.log('[MetadataDialog] Thumbnail state changed:', {
      modId: mod?.id,
      thumbnailPath: mod?.thumbnailPath,
      timestamp: thumbnailTimestamp,
      finalSrc: mod?.thumbnailPath ? `${convertFileSrc(mod.thumbnailPath)}?t=${thumbnailTimestamp}` : null,
    });
  }, [mod?.thumbnailPath, thumbnailTimestamp, mod?.id]);

  // Load mod data when dialog opens (only when dialog opens, not on every mod update)
  useEffect(() => {
    if (metadataDialogOpen && mod) {
      setTitle(mod.metadata.title || mod.name);
      setAuthor(mod.metadata.author || '');
      setVersion(mod.metadata.version || '');
      setDescription(mod.metadata.description || '');
      setTags(mod.metadata.tags?.join(', ') || '');
      setCategory(mod.category);
      setCharacter(mod.character || '');
      setCostume(mod.metadata.costume || '');
      setIsNsfw(mod.metadata.isNsfw);
      setHasChanges(false);

      // Reset crop dialog state
      setShowCropDialog(false);
      setCropImageUrl('');
      setCropImageFile(null);
    }
  }, [metadataDialogOpen, metadataDialogModId]);

  // Clear costume when character changes
  useEffect(() => {
    if (!character) {
      setCostume('');
    }
  }, [character]);

  // Track changes
  useEffect(() => {
    if (mod) {
      const changed =
        title !== (mod.metadata.title || mod.name) ||
        author !== (mod.metadata.author || '') ||
        description !== (mod.metadata.description || '') ||
        category !== mod.category ||
        (character || '') !== (mod.character || '') ||
        (costume || '') !== (mod.metadata.costume || '') ||
        isNsfw !== mod.metadata.isNsfw;
      setHasChanges(changed);
    }
  }, [mod, title, author, description, category, character, costume, isNsfw]);

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

    setMetadataDialogOpen(false);
  };

  const handleClose = () => {
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

  // Handle crop complete
  const handleCropComplete = async (cropData: { x: number; y: number; width: number; height: number }) => {
    if (!mod) return;

    console.log('[MetadataDialog] Starting crop complete for mod:', mod.id);
    setIsUploadingThumbnail(true);
    setShowCropDialog(false);

    try {
      let thumbnailPath: string;

      if (cropImageFile) {
        // Upload from file
        console.log('[MetadataDialog] Saving thumbnail from file:', cropImageFile);
        thumbnailPath = await invoke<string>('save_thumbnail_from_file', {
          modId: mod.id,
          filePath: cropImageFile,
          cropData,
        });
      } else {
        // Download from URL
        console.log('[MetadataDialog] Downloading thumbnail from URL:', cropImageUrl);
        thumbnailPath = await invoke<string>('download_and_save_thumbnail', {
          modId: mod.id,
          url: cropImageUrl,
          cropData,
        });
      }

      console.log('[MetadataDialog] Thumbnail saved, path returned:', thumbnailPath);

      toast.success('Thumbnail saved successfully');

      // Update timestamp to bust cache
      const newTimestamp = Date.now();
      console.log('[MetadataDialog] Updating timestamp to:', newTimestamp);
      setThumbnailTimestamp(newTimestamp);

      // Refresh mods query - backend will automatically find the new thumbnail
      console.log('[MetadataDialog] Invalidating mods query...');
      await queryClient.invalidateQueries({ queryKey: ['mods', 'list'] });
      console.log('[MetadataDialog] Query invalidated successfully');
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

  if (!mod) return null;

  const thumbnailSrc = mod.thumbnailPath ? convertFileSrc(mod.thumbnailPath) : null;
  const thumbnailSrcWithCache = thumbnailSrc ? `${thumbnailSrc}?t=${thumbnailTimestamp}` : null;

  console.log('[MetadataDialog] Rendering with thumbnail:', {
    modId: mod.id,
    rawPath: mod.thumbnailPath,
    convertedSrc: thumbnailSrc,
    withCache: thumbnailSrcWithCache,
  });

  return (
    <>
    <Dialog open={metadataDialogOpen && !showCropDialog} onOpenChange={handleClose}>
      <DialogContent className="w-[90vw] sm:max-w-[1200px] max-h-[90vh] p-0 overflow-hidden bg-[#1a1f2e] overflow-x-hidden">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border">
          <DialogTitle className="text-2xl font-bold text-white">Edit Mod Metadata</DialogTitle>
          <DialogDescription className="text-gray-400 mt-1">
            Update mod information and thumbnail
          </DialogDescription>
        </div>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-[400px_1fr] h-[600px] overflow-x-hidden">
          {/* Left Column - Thumbnail */}
          <div className="p-6 border-r border-border overflow-y-auto bg-[#151a26]">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-gray-300 mb-2">
                <ImageIcon className="w-5 h-5" />
                <h3 className="font-semibold">Thumbnail Preview</h3>
              </div>
              <p className="text-xs text-gray-500">16:9 aspect ratio recommended</p>

              {/* Current Thumbnail */}
              <div className="aspect-video bg-black/50 rounded-lg overflow-hidden border border-border">
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

              {/* Upload Button */}
              <button
                onClick={handleUploadImage}
                disabled={isUploadingThumbnail}
                className="w-full px-4 py-2.5 bg-[#1a1a1a] text-white rounded-md text-sm border border-transparent transition-all flex items-center justify-center gap-2 cursor-pointer group hover:bg-primary/20 hover:text-primary hover:border-primary/40 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isUploadingThumbnail ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 transition-transform duration-200 group-hover:rotate-12" />
                )}
                {isUploadingThumbnail ? 'Uploading...' : 'Upload Image'}
              </button>

              {/* OR Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border"></div>
                <span className="text-xs text-gray-500">OR</span>
                <div className="flex-1 h-px bg-border"></div>
              </div>

              {/* URL Input */}
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.png"
                className="bg-[#1a1a1a] border-border"
              />

              {/* Download from URL Button */}
              <button
                onClick={handleDownloadFromUrl}
                disabled={isUploadingThumbnail || !imageUrl.trim()}
                className="w-full px-4 py-2.5 bg-[#1a1a1a] text-white rounded-md text-sm border border-transparent transition-all flex items-center justify-center gap-2 cursor-pointer group hover:bg-primary/20 hover:text-primary hover:border-primary/40 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isUploadingThumbnail ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 transition-transform duration-200 group-hover:rotate-12" />
                )}
                {isUploadingThumbnail ? 'Processing...' : 'Download from URL'}
              </button>
            </div>
          </div>

          {/* Right Column - Metadata */}
          <div className="p-6 overflow-y-auto overflow-x-hidden">
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary mb-3">
                  <FileText className="w-5 h-5" />
                  <h3 className="font-semibold">Basic Information</h3>
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm font-medium text-gray-300">
                    Name <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Mod name"
                    className="bg-[#1a1a1a] border-border"
                  />
                </div>

                {/* Author */}
                <div className="space-y-2">
                  <Label htmlFor="author" className="text-sm font-medium text-gray-300">
                    Author
                  </Label>
                  <Input
                    id="author"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Mod author name..."
                    className="bg-[#1a1a1a] border-border"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium text-gray-300">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter mod description..."
                    rows={4}
                    className="bg-[#1a1a1a] border-border resize-none"
                  />
                </div>
              </div>

              {/* Category & Character */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary mb-3">
                  <Users className="w-5 h-5" />
                  <h3 className="font-semibold">Category & Character</h3>
                </div>

                {/* Horizontal Grid for Category, Character, and Costume */}
                <div className="grid grid-cols-3 gap-3 min-w-0">
                  {/* Category */}
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="category" className="text-sm font-medium text-gray-300">
                      Category
                    </Label>
                    <Select value={category} onValueChange={(value) => setCategory(value as ModCategory)}>
                      <SelectTrigger id="category" className="bg-[#1a1a1a] border-border hover:bg-[#2a2a2a] transition-colors">
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
                    <Label htmlFor="character" className="text-sm font-medium text-gray-300">
                      Character
                    </Label>
                    <Select value={character || 'none'} onValueChange={(value) => setCharacter(value === 'none' ? '' : value as Character)}>
                      <SelectTrigger id="character" className="bg-[#1a1a1a] border-border hover:bg-[#2a2a2a] transition-colors">
                        <SelectValue placeholder="Select character">
                          {character ? (
                            <div className="flex items-center gap-2 overflow-hidden">
                              <img
                                src={getCharacterIconPath(character)}
                                alt={character}
                                className="w-5 h-5 rounded-full object-cover border border-border flex-shrink-0"
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
                                className="w-5 h-5 rounded-full object-cover border border-border flex-shrink-0"
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
                    <Label htmlFor="costume" className="text-sm font-medium text-gray-300">
                      Costume / Skin
                    </Label>
                    <Select
                      value={costume || 'none'}
                      onValueChange={(value) => setCostume(value === 'none' ? '' : value)}
                      disabled={!character}
                    >
                      <SelectTrigger
                        id="costume"
                        className="bg-[#1a1a1a] border-border hover:bg-[#2a2a2a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <SelectValue placeholder={!character ? "Select character first" : "Select costume"}>
                          {costume && costumes.find(c => c.id === costume) ? (
                            <div className="flex items-center gap-2 overflow-hidden">
                              <img
                                src={`/assets/costume-icons/${costumes.find(c => c.id === costume)?.imagePath}`}
                                alt={costumes.find(c => c.id === costume)?.name}
                                className="w-6 h-6 rounded object-cover border border-border flex-shrink-0"
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
                                  className="w-6 h-6 rounded object-cover border border-border flex-shrink-0"
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
                <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/5 border border-red-500/20">
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
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-[#151a26]">
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
