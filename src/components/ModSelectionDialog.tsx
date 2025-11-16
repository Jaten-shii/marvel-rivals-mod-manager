import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';

export interface DetectedMod {
  pakFile: string;
  associatedFiles: string[];
  size: number;
}

interface ModSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detectedMods: DetectedMod[];
  onConfirm: (selectedMods: DetectedMod[]) => void;
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// Extract filename from full path
function getFileName(path: string | undefined): string {
  if (!path) return 'Unknown';
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export function ModSelectionDialog({ open, onOpenChange, detectedMods, onConfirm }: ModSelectionDialogProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(detectedMods.map((_, index) => index))
  );

  const toggleSelection = (index: number) => {
    const newSelection = new Set(selectedIndices);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedIndices(newSelection);
  };

  const selectAll = () => {
    setSelectedIndices(new Set(detectedMods.map((_, index) => index)));
  };

  const deselectAll = () => {
    setSelectedIndices(new Set());
  };

  const handleConfirm = () => {
    const selectedMods = detectedMods.filter((_, index) => selectedIndices.has(index));
    onConfirm(selectedMods);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Mods to Install</DialogTitle>
          <DialogDescription>
            This archive contains {detectedMods.length} mod{detectedMods.length !== 1 ? 's' : ''}. Select which ones you want to install.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Select All/None buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              disabled={selectedIndices.size === detectedMods.length}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deselectAll}
              disabled={selectedIndices.size === 0}
            >
              Deselect All
            </Button>
            <div className="ml-auto text-sm text-muted-foreground">
              {selectedIndices.size} of {detectedMods.length} selected
            </div>
          </div>

          {/* Mod list */}
          <ScrollArea className="h-[400px] rounded-md border border-border">
            <div className="p-4 space-y-2">
              {detectedMods.map((mod, index) => {
                const isSelected = selectedIndices.has(index);
                const fileName = getFileName(mod.pakFile);
                const hasAssociatedFiles = mod.associatedFiles.length > 0;

                return (
                  <div
                    key={index}
                    className={`flex items-start gap-3 p-3 rounded-md border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-primary/10 border-primary/50'
                        : 'bg-card border-border hover:bg-accent'
                    }`}
                    onClick={() => toggleSelection(index)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelection(index)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-foreground truncate">
                        {fileName}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Size: {formatFileSize(mod.size)}
                        {hasAssociatedFiles && (
                          <span className="ml-2">
                            • {mod.associatedFiles.length} associated file{mod.associatedFiles.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {hasAssociatedFiles && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {mod.associatedFiles.map((file, i) => (
                            <div key={i} className="truncate">
                              + {getFileName(file)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selectedIndices.size === 0}>
            Install {selectedIndices.size} Mod{selectedIndices.size !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
