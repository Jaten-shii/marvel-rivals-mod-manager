import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { ModCategory, Character } from '../types/mod.types';
import { ALL_CHARACTERS, MOD_CATEGORIES } from '../shared/constants';
import { useGetCostumesForCharacter, useGetMods } from '../hooks/useMods';
import { Monitor, Volume2, Shirt, Gamepad2, AlertTriangle, PackagePlus } from 'lucide-react';
import { sanitizeFolderName, extractModNameFromPath } from '../utils/sanitize';
import { c, tint, categoryColor } from '../shared/rivals-tokens';

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

const labelStyle: React.CSSProperties = {
  color: c.ink3,
  fontSize: 11,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  fontWeight: 600,
};

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

  // Fetch existing mods to check for duplicates
  const { data: existingMods = [] } = useGetMods();

  // Check for duplicate mods with same name + character + costume
  const duplicateMod = existingMods.find((m) => {
    const sameTitle = m.metadata.title.toLowerCase() === modName.trim().toLowerCase();
    const sameCharacter = (m.character || '') === (character === 'none' ? '' : character);
    const sameCostume = (m.metadata.costume || '') === (costume === 'none' ? '' : costume);
    return sameTitle && sameCharacter && sameCostume;
  });

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

  // Auto-select Default costume when character changes, or clear if no character
  useEffect(() => {
    if (character === 'none') {
      setCostume('none');
    } else if (costumes.length > 0) {
      // Find the default costume (marked with isDefault) or first costume
      const defaultCostume = costumes.find(c => c.isDefault);
      if (defaultCostume) {
        setCostume(defaultCostume.id);
      }
    }
  }, [character, costumes]);

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
  const installPath =
    character !== 'none'
      ? `~mods/${category}/${character}/${sanitizedName}${costume !== 'none' ? `-${costumes.find(c => c.id === costume)?.name || costume}` : ''}/`
      : `~mods/${category}/${sanitizedName}/`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[620px] max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col"
        style={{ background: c.bg, border: `1px solid ${c.line2}`, borderRadius: 16 }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 flex-shrink-0" style={{ padding: '20px 24px', borderBottom: `1px solid ${c.line}`, background: c.panel }}>
          <div
            className="grid place-items-center flex-shrink-0"
            style={{ width: 44, height: 44, borderRadius: 11, background: tint(c.accent, 18), color: c.accent, border: `1px solid ${tint(c.accent, 40)}` }}
          >
            <PackagePlus className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <DialogTitle asChild>
              <h2 className="rivals-display" style={{ color: c.ink, fontSize: 23, fontWeight: 600, letterSpacing: '-0.01em' }}>
                Set Up Mod
              </h2>
            </DialogTitle>
            <DialogDescription asChild>
              <p className="rivals-mono" style={{ color: c.ink3, fontSize: 11.5, marginTop: 2 }}>
                name it, tag it, and it lands in the right folder
              </p>
            </DialogDescription>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto sidebar-scroll flex flex-col gap-5" style={{ padding: '22px 24px' }}>
          {/* Mod Name */}
          <div className="flex flex-col gap-2" style={{ animation: 'metadata-fade-in 300ms ease-out both' }}>
            <label htmlFor="mod-name" className="rivals-mono" style={labelStyle}>
              Mod Name
            </label>
            <input
              id="mod-name"
              type="text"
              value={modName}
              onChange={(e) => setModName(e.target.value)}
              placeholder="Enter mod name…"
              autoFocus
              className="w-full outline-none transition-colors"
              style={{ padding: '11px 14px', borderRadius: 10, background: c.panel, color: c.ink, border: `1px solid ${c.line2}`, fontFamily: c.font, fontSize: 15 }}
              onFocus={(e) => { e.currentTarget.style.borderColor = c.accent as string; e.currentTarget.style.boxShadow = `0 0 0 3px ${tint(c.accent, 18)}`; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = c.line2; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Category & Character side by side */}
          <div className="grid grid-cols-2 gap-4" style={{ animation: 'metadata-fade-in 300ms ease-out 60ms both' }}>
            <div className="flex flex-col gap-2">
              <label htmlFor="category" className="rivals-mono" style={labelStyle}>
                Category
              </label>
              <Select value={category} onValueChange={(value) => setCategory(value as ModCategory)}>
                <SelectTrigger id="category" className="w-full rounded-lg" style={{ background: c.panel, borderColor: c.line2, height: 44 }}>
                  <SelectValue>
                    <div className="flex items-center gap-2.5">
                      <span style={{ color: categoryColor(category), display: 'inline-flex' }}>{getCategoryIcon(category)}</span>
                      <span>{category}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent style={{ background: c.panel, borderColor: c.line2 }}>
                  {MOD_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      <div className="flex items-center gap-2.5">
                        <span style={{ color: categoryColor(cat), display: 'inline-flex' }}>{getCategoryIcon(cat)}</span>
                        <span>{cat}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="character" className="rivals-mono" style={labelStyle}>
                Character <span style={{ opacity: 0.55, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </label>
              <Select value={character} onValueChange={(value) => setCharacter(value as Character)}>
                <SelectTrigger id="character" className="w-full rounded-lg" style={{ background: c.panel, borderColor: c.line2, height: 44 }}>
                  <SelectValue placeholder="Select a character" />
                </SelectTrigger>
                <SelectContent style={{ background: c.panel, borderColor: c.line2 }} className="max-h-[300px]">
                  <SelectItem value="none">
                    <span className="text-muted-foreground">None</span>
                  </SelectItem>
                  {ALL_CHARACTERS.map((char) => (
                    <SelectItem key={char} value={char}>
                      {char}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Costume/Skin */}
          {character !== 'none' && (
            <div className="flex flex-col gap-2" style={{ animation: 'metadata-fade-in 300ms ease-out both' }}>
              <label htmlFor="costume" className="rivals-mono" style={labelStyle}>
                Costume / Skin <span style={{ opacity: 0.55, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </label>
              <Select value={costume} onValueChange={setCostume} disabled={costumes.length === 0}>
                <SelectTrigger id="costume" className="w-full rounded-lg" style={{ background: c.panel, borderColor: c.line2, height: 44 }}>
                  <SelectValue placeholder={costumes.length === 0 ? 'No costumes available' : 'Select a costume'} />
                </SelectTrigger>
                <SelectContent style={{ background: c.panel, borderColor: c.line2 }} className="max-h-[300px]">
                  <SelectItem value="none">
                    <span className="text-muted-foreground">None</span>
                  </SelectItem>
                  {costumes.map((costumeItem) => (
                    <SelectItem key={costumeItem.id} value={costumeItem.id}>
                      <div className="flex items-center gap-2">
                        <span>{costumeItem.name}</span>
                        {costumeItem.isDefault && (
                          <span className="text-xs text-muted-foreground">(Default)</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* File info */}
          <div
            className="flex flex-col gap-3"
            style={{ padding: 14, borderRadius: 10, background: c.panel, border: `1px solid ${c.line}`, animation: 'metadata-fade-in 300ms ease-out 120ms both' }}
          >
            <div>
              <p className="rivals-mono" style={{ ...labelStyle, fontSize: 10 }}>Source File</p>
              <p className="rivals-mono break-all" style={{ color: c.ink3, fontSize: 11.5, marginTop: 4 }}>{pakFileName}</p>
            </div>
            <div>
              <p className="rivals-mono" style={{ ...labelStyle, fontSize: 10 }}>Installs To</p>
              <p className="rivals-mono break-all" style={{ color: c.ink2, fontSize: 11.5, marginTop: 4 }}>
                <span style={{ color: c.accent }}>{installPath}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2.5 flex-shrink-0" style={{ padding: '16px 24px', borderTop: `1px solid ${c.line}`, background: c.panel }}>
          {duplicateMod && (
            <span
              className="inline-flex items-center gap-2 min-w-0"
              style={{ padding: '6px 12px', borderRadius: 999, background: tint(c.warn, 12), border: `1px solid ${tint(c.warn, 35)}`, color: c.warn, fontFamily: c.font, fontSize: 12 }}
            >
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">
                A mod with this name already exists
                {character !== 'none' ? ` for ${character}` : ''}
              </span>
            </span>
          )}
          <div className="ml-auto flex items-center gap-2.5 flex-shrink-0">
            <button
              onClick={() => onOpenChange(false)}
              className="btn-outline cursor-pointer"
              style={{ padding: '10px 20px', borderRadius: 9, background: 'transparent', color: c.ink2, border: `1px solid ${c.line2}`, fontFamily: c.font, fontSize: 13.5, fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!modName.trim()}
              className="btn-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ padding: '10px 20px', borderRadius: 9, background: c.accent, color: c.onAccent, border: 'none', fontFamily: c.font, fontSize: 13.5, fontWeight: 600 }}
            >
              Continue
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
