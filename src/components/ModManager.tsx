import { useEffect, useState } from 'react';
import { useGetAppSettings } from '../hooks/useSettings';
import { useFileWatcher } from '../hooks/useFileWatcher';
import { TitleBar } from './TitleBar';
import { Toolbar } from './Toolbar';
import { ModList } from './ModList';
import { Sidebar } from './Sidebar';
import { PreferencesDialog } from './preferences/PreferencesDialog';
import { MetadataDialog } from './MetadataDialog';
import { ChangelogDialog } from './ChangelogDialog';
import { UpdateDialog } from './UpdateDialog';
import { ModDetailsPanel } from './ModDetailsPanel';
import { DropZone } from './DropZone';
import { ModSelectionDialog, type DetectedMod } from './ModSelectionDialog';
import { useUIStore } from '../stores';
import { useInstallFromArchive } from '../hooks/useInstallFromArchive';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';

export function ModManager() {
  const { data: settings, isLoading, error } = useGetAppSettings();
  const { leftSidebarOpen, selectedModId, metadataDialogOpen, setMetadataDialogOpen } = useUIStore();

  // Archive installation workflow state
  const [showModSelectionDialog, setShowModSelectionDialog] = useState(false);
  const [selectedModsToInstall, setSelectedModsToInstall] = useState<DetectedMod[]>([]);
  const [currentModIndexInInstallation, setCurrentModIndexInInstallation] = useState(0);
  const [isInInstallationSequence, setIsInInstallationSequence] = useState(false);

  const {
    isExtracting,
    detectedMods,
    currentPakFile,
    extractAndDetect,
    installSingleMod,
    reset: resetArchiveInstallation,
    prepareNextMod,
  } = useInstallFromArchive();

  // Start file watcher when we have a game directory
  const modsDirectory = settings?.gameDirectory
    ? `${settings.gameDirectory}\\MarvelGame\\Marvel\\Content\\Paks\\~mods`
    : null;

  useFileWatcher(modsDirectory, !!modsDirectory);

  useEffect(() => {
    if (modsDirectory) {
      console.log('[ModManager] Watching mods directory:', modsDirectory);
    }
    if (settings) {
      console.log('[ModManager] Settings loaded:', settings);
    }
  }, [modsDirectory, settings]);

  // Automatically organize loose mods on app startup
  useEffect(() => {
    if (modsDirectory) {
      const organizeMods = async () => {
        try {
          console.log('[ModManager] Auto-organizing loose mods...');
          const count = await invoke<number>('organize_mods');
          if (count > 0) {
            console.log(`[ModManager] Auto-organized ${count} loose mod(s)`);
            toast.success(`Auto-organized ${count} loose mod(s) into folders`);
          }
        } catch (error) {
          console.error('[ModManager] Failed to auto-organize mods:', error);
          // Don't show error toast on startup - just log it
        }
      };

      organizeMods();
    }
  }, [modsDirectory]); // Only run when modsDirectory becomes available

  // When extraction completes, show mod selection dialog
  useEffect(() => {
    if (!isExtracting && detectedMods.length > 0) {
      if (detectedMods.length === 1) {
        // Single mod: skip selection, install and edit
        installAndEditMod(detectedMods);
      } else {
        // Multiple mods: show selection dialog
        setShowModSelectionDialog(true);
      }
    }
  }, [isExtracting, detectedMods]);

  // Watch for metadata dialog closing during installation sequence
  useEffect(() => {
    if (!metadataDialogOpen && isInInstallationSequence && selectedModsToInstall.length > 0) {
      // Dialog was closed, continue to next mod
      const nextIndex = currentModIndexInInstallation;
      if (nextIndex < selectedModsToInstall.length) {
        // Small delay before next installation
        setTimeout(() => {
          installNextModInSequence(selectedModsToInstall, nextIndex);
        }, 500);
      } else {
        // All mods done
        toast.success(`Successfully installed ${selectedModsToInstall.length} mod(s)!`);
        setIsInInstallationSequence(false);
        resetArchiveInstallation();
        setSelectedModsToInstall([]);
        setCurrentModIndexInInstallation(0);
      }
    }
  }, [metadataDialogOpen]);

  // Install mods and open metadata editor for each
  const installAndEditMod = async (modsToInstall: DetectedMod[]) => {
    setSelectedModsToInstall(modsToInstall);
    setCurrentModIndexInInstallation(0);
    setIsInInstallationSequence(true);

    // Start installing first mod
    await installNextModInSequence(modsToInstall, 0);
  };

  // Sequential function to install mods one by one
  const installNextModInSequence = async (modsToInstall: DetectedMod[], index: number) => {
    if (index >= modsToInstall.length) {
      // Should not reach here - completion is handled in the useEffect
      return;
    }

    const currentMod = modsToInstall[index];
    if (!currentMod) return;

    prepareNextMod(index);

    try {
      // Install mod with default metadata
      const modInfo: any = await installSingleMod({
        pakFile: currentPakFile || currentMod.pakFile,
        setup: {
          modName: currentMod.pakFile.split(/[\\/]/).pop()?.replace(/\.pak$/i, '') || 'Untitled Mod',
          category: 'Skins',
          character: null,
          costume: null,
        },
      });

      // Open metadata dialog for the newly installed mod
      if (modInfo && modInfo.id) {
        setMetadataDialogOpen(true, modInfo.id);

        // Update index for next mod (when dialog closes)
        setCurrentModIndexInInstallation(index + 1);

        toast.success(
          modsToInstall.length > 1
            ? `Installed mod ${index + 1} of ${modsToInstall.length}. Edit metadata and close dialog to continue.`
            : 'Mod installed! Edit metadata and close when done.'
        );
      }
    } catch (error) {
      console.error('Installation failed:', error);
      toast.error(`Failed to install mod: ${error}`);

      // Move to next mod on error
      setCurrentModIndexInInstallation(index + 1);
      if (index + 1 < modsToInstall.length) {
        setTimeout(() => {
          installNextModInSequence(modsToInstall, index + 1);
        }, 500);
      } else {
        // Last mod failed, end sequence
        setIsInInstallationSequence(false);
        resetArchiveInstallation();
        setSelectedModsToInstall([]);
        setCurrentModIndexInInstallation(0);
      }
    }
  };

  // Handle file drop
  const handleFileDrop = (filePaths: string[]) => {
    if (filePaths.length === 0) return;

    // Only process the first file for now
    const filePath = filePaths[0];
    if (!filePath) return;

    const ext = filePath.split('.').pop()?.toLowerCase();

    if (ext === 'zip' || ext === '7z' || ext === 'rar') {
      // Archive file: extract and detect mods
      toast.info('Extracting archive...');
      extractAndDetect(filePath);
    } else if (ext === 'pak') {
      // Direct pak file: treat as single mod
      toast.info('Installing mod...');
      // TODO: Handle direct pak file installation
    }
  };

  // Handle mod selection confirmation
  const handleModSelectionConfirm = (selectedMods: DetectedMod[]) => {
    setShowModSelectionDialog(false);
    installAndEditMod(selectedMods);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Loading Marvel Rivals Mod Manager</h2>
          <p className="text-muted-foreground">Please wait...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2 text-destructive">Error Loading Settings</h2>
          <p className="text-muted-foreground">{String(error)}</p>
        </div>
      </div>
    );
  }

  if (!settings?.gameDirectory) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Welcome to Marvel Rivals Mod Manager</h2>
          <p className="text-muted-foreground mb-6">
            No game directory configured yet. Please set up your Marvel Rivals game directory in the
            settings.
          </p>
          <p className="text-sm text-muted-foreground">
            Default location: C:\Program Files (x86)\Steam\steamapps\common\MarvelRivals
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <DropZone onDrop={handleFileDrop}>
        <div className="flex flex-col h-screen bg-background">
          {/* Custom Title Bar */}
          <TitleBar />

          {/* Toolbar */}
          <Toolbar onArchiveSelect={handleFileDrop} />

          {/* Main Content - Sidebar + Mod List */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar */}
            {leftSidebarOpen && (
              <div className="w-64 flex-shrink-0">
                <Sidebar />
              </div>
            )}

            {/* Mod List */}
            <div className="flex-1 overflow-hidden">
              <ModList />
            </div>
          </div>
        </div>
      </DropZone>

      {/* Dialogs */}
      <PreferencesDialog />
      <MetadataDialog />
      <ChangelogDialog />
      <UpdateDialog />

      {/* Archive Installation Dialogs */}
      <ModSelectionDialog
        open={showModSelectionDialog}
        onOpenChange={setShowModSelectionDialog}
        detectedMods={detectedMods}
        onConfirm={handleModSelectionConfirm}
      />

      {/* Mod Details Panel - slides in from right when mod is selected */}
      {selectedModId && <ModDetailsPanel />}
    </>
  );
}
