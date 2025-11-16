import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { ModCategory, Character } from '../types/mod.types';
import { ALL_CHARACTERS, MOD_CATEGORIES } from '../shared/constants';
import { useGetCostumesForCharacter } from '../hooks/useMods';
import { Monitor, Volume2, Shirt, Gamepad2 } from 'lucide-react';
import { sanitizeFolderName, extractModNameFromPath } from '../utils/sanitize';

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

interface InitialModSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pakFileName: string;
  onConfirm: (setup: {
    modName: string;
    category: ModCategory;
    character: Character | null;
    costume: string | null;
  }) => void;
}

export function InitialModSetupDialog({
  open,
  onOpenChange,
  pakFileName,
  onConfirm,
}: InitialModSetupDialogProps) {
  // Extract initial mod name from pak file name
  const initialModName = extractModNameFromPath(pakFileName);

  const [modName, setModName] = useState(initialModName);
  const [category, setCategory] = useState<ModCategory>('Skins');
  const [character, setCharacter] = useState<Character | 'none'>('none');
  const [costume, setCostume] = useState<string>('none');

  // Fetch costumes for selected character
  const { data: costumes = [] } = useGetCostumesForCharacter(character === 'none' ? null : character);

  // Reset state when dialog opens with new pak file
  useEffect(() => {
    if (open) {
      const newName = extractModNameFromPath(pakFileName);
      setModName(newName);
      setCategory('Skins');
      setCharacter('none');
      setCostume('none');
    }
  }, [open, pakFileName]);

  // Clear costume when character changes
  useEffect(() => {
    if (character === 'none') {
      setCostume('none');
    }
  }, [character]);

  const handleConfirm = () => {
    onConfirm({
      modName: modName.trim() || 'Untitled Mod',
      category,
      character: character === 'none' ? null : character,
      costume: costume === 'none' ? null : costume,
    });
    onOpenChange(false);
  };

  const sanitizedName = sanitizeFolderName(modName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Set Up Mod</DialogTitle>
          <DialogDescription>
            Configure the mod name and details. The mod name will be used as the folder name.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1">
          {/* Mod Name */}
          <div className="space-y-2">
            <Label htmlFor="mod-name">Mod Name *</Label>
            <Input
              id="mod-name"
              value={modName}
              onChange={(e) => setModName(e.target.value)}
              placeholder="Enter mod name"
              className="w-full"
            />
            {modName && sanitizedName !== modName && (
              <p className="text-xs text-muted-foreground">
                Folder name: <span className="font-mono">{sanitizedName}</span>
              </p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as ModCategory)}>
              <SelectTrigger id="category" className="w-full">
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
          <div className="space-y-2">
            <Label htmlFor="character">Character (Optional)</Label>
            <Select value={character} onValueChange={(value) => setCharacter(value as Character)}>
              <SelectTrigger id="character" className="w-full">
                <SelectValue placeholder="Select a character" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {ALL_CHARACTERS.map((char) => (
                  <SelectItem key={char} value={char}>
                    {char}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Costume/Skin */}
          {character !== 'none' && (
            <div className="space-y-2">
              <Label htmlFor="costume">Costume / Skin (Optional)</Label>
              <Select value={costume} onValueChange={setCostume} disabled={(character as Character | 'none') === 'none' || costumes.length === 0}>
                <SelectTrigger id="costume" className="w-full">
                  <SelectValue placeholder={costumes.length === 0 ? "No costumes available" : "Select a costume"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {costumes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <span>{c.name}</span>
                        {c.isDefault && <span className="text-xs text-muted-foreground">(Default)</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* File info */}
          <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-2">
            <div>
              <p className="text-xs font-medium text-foreground mb-1">Source File</p>
              <p className="text-xs text-muted-foreground font-mono break-all">{pakFileName}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-foreground mb-1">Installation Path</p>
              <p className="text-xs text-muted-foreground font-mono">
                {character !== 'none'
                  ? `~mods/${category}/${character}/${sanitizedName}/`
                  : `~mods/${category}/${sanitizedName}/`
                }
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!modName.trim()}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
