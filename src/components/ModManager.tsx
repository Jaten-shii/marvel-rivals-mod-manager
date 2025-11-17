import { useEffect, useState } from 'react';
import { useGetAppSettings } from '../hooks/useSettings';
import { useFileWatcher } from '../hooks/useFileWatcher';
import { useGetMods } from '../hooks/useMods';
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
import { detectCharacterFromMultipleSources } from '../utils/characterDetection';

// Global lock to prevent duplicate processing across HMR instances
declare global {
  interface Window {
    __modManagerProcessingLock?: {
      isProcessing: boolean;
      lastDropKey: string;
      lastDropTime: number;
    };
  }
}

export function ModManager() {
  const { data: settings, isLoading, error } = useGetAppSettings();
  const { leftSidebarOpen, selectedModId, metadataDialogOpen, setMetadataDialogOpen } = useUIStore();
  const { data: mods, isRefetching } = useGetMods();

  // Archive installation workflow state
  const [showModSelectionDialog, setShowModSelectionDialog] = useState(false);
  const [selectedModsToInstall, setSelectedModsToInstall] = useState<DetectedMod[]>([]);
  const [currentModIndexInInstallation, setCurrentModIndexInInstallation] = useState(0);
  const [isInInstallationSequence, setIsInInstallationSequence] = useState(false);
  const [hasOpenedDialogForCurrentMod, setHasOpenedDialogForCurrentMod] = useState(false);
  const [expectedModFilePath, setExpectedModFilePath] = useState<string | null>(null);

  // Archive queue for processing multiple archives sequentially
  const [archiveQueue, setArchiveQueue] = useState<string[]>([]);
  const [isProcessingArchive, setIsProcessingArchive] = useState(false);

  const {
    isExtracting,
    detectedMods,
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

  // Automatically organize loose mods, merge duplicates, and migrate metadata on app startup
  useEffect(() => {
    if (modsDirectory) {
      const organizeMods = async () => {
        try {
          // Step 1: Migrate metadata from old filename-based IDs to new path-based IDs
          console.log('[ModManager] Migrating metadata to new ID system...');
          const migratedCount = await invoke<number>('migrate_metadata_to_path_ids');
          if (migratedCount > 0) {
            console.log(`[ModManager] Migrated ${migratedCount} mod(s) metadata`);
            toast.success(`Migrated metadata for ${migratedCount} mod(s)`, { duration: 5000 });
          }

          // Step 2: Organize loose mods
          console.log('[ModManager] Auto-organizing loose mods...');
          const count = await invoke<number>('organize_mods');
          if (count > 0) {
            console.log(`[ModManager] Auto-organized ${count} loose mod(s)`);
            toast.success(`Auto-organized ${count} loose mod(s) into folders`);
          }

          // Step 3: Merge duplicate folders (e.g., "Black Widow" and "Black-Widow")
          console.log('[ModManager] Checking for duplicate character folders...');
          const mergedCount = await invoke<number>('merge_duplicate_folders');
          if (mergedCount > 0) {
            console.log(`[ModManager] Merged ${mergedCount} duplicate folder(s)`);
            toast.success(`Merged ${mergedCount} duplicate character folder(s)`);
          }

          // Step 4: Log total mods found
          console.log('[ModManager] Startup complete - counting mods...');
          await invoke('log_total_mods_found');
        } catch (error) {
          console.error('[ModManager] Failed to auto-organize mods:', error);
          // Don't show error toast on startup - just log it
        }
      };

      organizeMods();
    }
  }, [modsDirectory]); // Only run when modsDirectory becomes available

  // Process archive queue sequentially
  useEffect(() => {
    // Only process if we have archives in queue, not currently processing, and not in an installation sequence
    if (archiveQueue.length > 0 && !isProcessingArchive && !isInInstallationSequence && !isExtracting) {
      const nextArchive = archiveQueue[0];

      // Initialize global extraction lock if needed
      if (!window.__archiveExtractionLock) {
        window.__archiveExtractionLock = {
          currentlyExtracting: new Set<string>(),
        };
      }

      // Double-check extraction lock before processing (protects against old HMR instances)
      if (nextArchive && window.__archiveExtractionLock.currentlyExtracting.has(nextArchive)) {
        console.log('[ModManager] [EXTRACTION GUARD] Archive already being extracted by another instance, clearing from queue');
        setArchiveQueue(prev => prev.slice(1));
        return;
      }

      if (!nextArchive) {
        console.error('[ModManager] Next archive is undefined, clearing from queue');
        setArchiveQueue(prev => prev.slice(1));
        return;
      }

      console.log('[ModManager] Processing next archive from queue:', nextArchive, `(${archiveQueue.length} remaining)`);

      // Remove from queue
      setArchiveQueue(prev => prev.slice(1));
      setIsProcessingArchive(true);

      // Show progress toast
      const remaining = archiveQueue.length - 1;
      if (remaining > 0) {
        toast.info(`Extracting archive... (${remaining} more in queue)`);
      } else {
        toast.info('Extracting archive...');
      }

      // Extract the archive
      extractAndDetect(nextArchive);
    }
  }, [archiveQueue, isProcessingArchive, isInInstallationSequence, isExtracting]);

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
    // CRITICAL FIX: Only proceed if dialog was actually opened for this mod
    // Without this check, the effect fires immediately when sequence starts (dialog is false, sequence is true)
    if (!metadataDialogOpen && isInInstallationSequence && hasOpenedDialogForCurrentMod && selectedModsToInstall.length > 0) {
      console.log('[ModManager] Metadata dialog closed. Current index:', currentModIndexInInstallation, 'Total mods:', selectedModsToInstall.length);

      // Reset dialog opened flag for next mod
      setHasOpenedDialogForCurrentMod(false);

      // Dialog was closed, continue to next mod
      const nextIndex = currentModIndexInInstallation;
      if (nextIndex < selectedModsToInstall.length) {
        console.log('[ModManager] Installing next mod at index:', nextIndex);
        installNextModInSequence(selectedModsToInstall, nextIndex);
      } else {
        // All mods from current archive done
        console.log('[ModManager] All mods installed successfully!');
        toast.success(`Successfully installed ${selectedModsToInstall.length} mod(s)!`);
        setIsInInstallationSequence(false);
        setHasOpenedDialogForCurrentMod(false);
        resetArchiveInstallation();
        setSelectedModsToInstall([]);
        setCurrentModIndexInInstallation(0);
        setIsProcessingArchive(false);

        // Check if there are more archives in the queue
        if (archiveQueue.length > 0) {
          console.log('[ModManager] More archives in queue:', archiveQueue.length);
          // The useEffect for processing the queue will pick up the next archive
        }
      }
    }
  }, [metadataDialogOpen, isInInstallationSequence, hasOpenedDialogForCurrentMod, currentModIndexInInstallation, selectedModsToInstall, archiveQueue.length]);

  // Watch for refetch completion to find mod by file path and open dialog
  useEffect(() => {
    // Only proceed if we're expecting a mod and refetch just completed
    if (!isRefetching && expectedModFilePath && mods) {
      console.log('[ModManager] Refetch completed, looking for mod with file path:', expectedModFilePath);

      // Normalize path for comparison (handle mixed slashes)
      const normalizePathForComparison = (path: string) => {
        return path.toLowerCase().replace(/\//g, '\\');
      };

      const normalizedExpected = normalizePathForComparison(expectedModFilePath);
      console.log('[ModManager] Normalized expected path:', normalizedExpected);

      // Find the mod by matching the normalized file path
      const installedMod = mods.find(mod => {
        const normalizedModPath = normalizePathForComparison(mod.filePath);
        console.log('[ModManager] Comparing:', normalizedModPath, 'vs', normalizedExpected);
        return normalizedModPath.includes(normalizedExpected) || normalizedExpected.includes(normalizedModPath);
      });

      if (installedMod) {
        console.log('[ModManager] Found mod by file path! ID:', installedMod.id, 'Name:', installedMod.name);

        // Clear the expected path
        setExpectedModFilePath(null);

        // Open the dialog with the correct ID from the fresh scan
        setHasOpenedDialogForCurrentMod(true);
        setMetadataDialogOpen(true, installedMod.id);

        toast.success(
          selectedModsToInstall.length > 1
            ? `Installed mod ${currentModIndexInInstallation} of ${selectedModsToInstall.length}. Edit metadata and close dialog to continue.`
            : 'Mod installed! Edit metadata and close when done.'
        );
      } else {
        console.error('[ModManager] Failed to find mod by file path after refetch:', expectedModFilePath);
        console.error('[ModManager] Available mod paths:', mods.map(m => m.filePath));
        setExpectedModFilePath(null);
        toast.error('Failed to locate installed mod. Please refresh and try again.');
      }
    }
  }, [isRefetching, expectedModFilePath, mods, selectedModsToInstall.length, currentModIndexInInstallation]);

  // Install mods and open metadata editor for each
  const installAndEditMod = async (modsToInstall: DetectedMod[]) => {
    setSelectedModsToInstall(modsToInstall);
    setCurrentModIndexInInstallation(0);
    setIsInInstallationSequence(true);
    setHasOpenedDialogForCurrentMod(false); // Reset flag for new sequence

    // Start installing first mod
    await installNextModInSequence(modsToInstall, 0);
  };

  // Sequential function to install mods one by one
  const installNextModInSequence = async (modsToInstall: DetectedMod[], index: number) => {
    console.log('[ModManager] installNextModInSequence called with index:', index, 'of', modsToInstall.length);

    if (index >= modsToInstall.length) {
      console.log('[ModManager] Index out of bounds, returning');
      // Should not reach here - completion is handled in the useEffect
      return;
    }

    const currentMod = modsToInstall[index];
    if (!currentMod) {
      console.log('[ModManager] No mod found at index', index);
      return;
    }

    console.log('[ModManager] Installing mod:', currentMod.pakFile);
    console.log('[ModManager] All mods in sequence:', modsToInstall.map(m => m.pakFile));

    // CRITICAL FIX: Pass the mod object directly to prepareNextMod
    // This ensures we use the user-selected mod, not an indexed lookup into all detected mods
    prepareNextMod(currentMod);

    // CRITICAL FIX: Use the mod's pakFile directly from the modsToInstall array
    // No need for state updates or setTimeout race conditions
    const pakFileToInstall = currentMod.pakFile;
    console.log('[ModManager] Final pak file to install:', pakFileToInstall);

    // Auto-detect character from pak file name and folder path
    const modName = currentMod.pakFile.split(/[\\/]/).pop()?.replace(/\.pak$/i, '') || 'Untitled Mod';
    const detectedCharacter = detectCharacterFromMultipleSources(
      currentMod.pakFile,
      undefined,
      modName
    );

    if (detectedCharacter) {
      console.log('[ModManager] Auto-detected character:', detectedCharacter);
      toast.info(`Auto-detected character: ${detectedCharacter}`);
    } else {
      console.log('[ModManager] No character auto-detected');
    }

    try {
      // Install mod with auto-detected character to avoid Skins/ folder duplication
      const modInfo: any = await installSingleMod({
        pakFile: pakFileToInstall,
        setup: {
          modName,
          category: 'Skins',
          character: detectedCharacter,
          costume: null,
        },
      });

      // Store file path to find mod after refetch
      if (modInfo && modInfo.filePath) {
        console.log('[ModManager] Mod installed successfully:', modInfo.id, modInfo.name);
        console.log('[ModManager] File path:', modInfo.filePath);
        console.log('[ModManager] Waiting for refetch to complete to open dialog for mod at index:', index);

        // Update index for next mod (when dialog closes)
        setCurrentModIndexInInstallation(index + 1);
        console.log('[ModManager] Set next index to:', index + 1);

        // Store the file path - the useEffect will find the mod after refetch and open the dialog
        setExpectedModFilePath(modInfo.filePath);
        console.log('[ModManager] Stored expected file path, waiting for refetch...');
      }
    } catch (error) {
      console.error('[ModManager] Installation failed:', error);
      console.error('[ModManager] Failed to install from:', pakFileToInstall);
      console.error('[ModManager] Mod details:', currentMod);

      const errorMessage = String(error);
      if (errorMessage.includes('file not found') || errorMessage.includes('Invalid file path')) {
        toast.error(`File not found: ${currentMod.pakFile.split(/[\\/]/).pop()}`);
      } else {
        toast.error(`Failed to install mod: ${error}`);
      }

      // Move to next mod on error
      setCurrentModIndexInInstallation(index + 1);
      if (index + 1 < modsToInstall.length) {
        installNextModInSequence(modsToInstall, index + 1);
      } else {
        // Last mod failed, end sequence
        setIsInInstallationSequence(false);
        setHasOpenedDialogForCurrentMod(false);
        resetArchiveInstallation();
        setSelectedModsToInstall([]);
        setCurrentModIndexInInstallation(0);
      }
    }
  };

  // Handle file drop with global lock to prevent HMR duplicate processing
  const handleFileDrop = (filePaths: string[]) => {
    if (filePaths.length === 0) return;

    // Initialize global lock if needed
    if (!window.__modManagerProcessingLock) {
      window.__modManagerProcessingLock = {
        isProcessing: false,
        lastDropKey: '',
        lastDropTime: 0,
      };
    }

    const lock = window.__modManagerProcessingLock;
    const dropKey = filePaths.join('|');
    const now = Date.now();

    // Check if this is a duplicate drop (within 2 seconds)
    if (lock.lastDropKey === dropKey && now - lock.lastDropTime < 2000) {
      console.log('[ModManager] [GLOBAL LOCK] Ignoring duplicate drop event');
      return;
    }

    // Check if another instance is already processing
    if (lock.isProcessing) {
      console.log('[ModManager] [GLOBAL LOCK] Another instance is processing, ignoring drop');
      return;
    }

    // Acquire the lock
    console.log('[ModManager] [GLOBAL LOCK] Acquired processing lock');
    lock.isProcessing = true;
    lock.lastDropKey = dropKey;
    lock.lastDropTime = now;

    console.log('[ModManager] Files dropped:', filePaths.length, filePaths);

    // Reset any ongoing installation sequence to start fresh
    if (isInInstallationSequence || archiveQueue.length > 0) {
      console.log('[ModManager] Resetting ongoing installation sequence and queue');
      setIsInInstallationSequence(false);
      setSelectedModsToInstall([]);
      setCurrentModIndexInInstallation(0);
      setHasOpenedDialogForCurrentMod(false);
      setArchiveQueue([]);
      setIsProcessingArchive(false);
      resetArchiveInstallation();
    }

    // Separate archives and pak files
    const archives: string[] = [];
    const pakFiles: string[] = [];

    for (const filePath of filePaths) {
      const ext = filePath.split('.').pop()?.toLowerCase();
      if (ext === 'zip' || ext === '7z' || ext === 'rar') {
        archives.push(filePath);
      } else if (ext === 'pak') {
        pakFiles.push(filePath);
      }
    }

    // Handle pak files (can be batched together)
    if (pakFiles.length > 0) {
      console.log('[ModManager] Installing', pakFiles.length, 'pak file(s)');
      if (pakFiles.length === 1) {
        toast.info('Installing mod...');
      } else {
        toast.info(`Installing ${pakFiles.length} mods...`);
      }

      const detectedMods: DetectedMod[] = pakFiles.map(pakFile => ({
        pakFile,
        associatedFiles: [pakFile],
        size: 0,
      }));

      installAndEditMod(detectedMods);

      // Release lock after pak installation starts
      setTimeout(() => {
        if (window.__modManagerProcessingLock) {
          console.log('[ModManager] [GLOBAL LOCK] Released processing lock (pak files)');
          window.__modManagerProcessingLock.isProcessing = false;
        }
      }, 500);
    }

    // Handle archives - add to queue for sequential processing
    if (archives.length > 0) {
      console.log('[ModManager] Adding', archives.length, 'archive(s) to queue');

      if (archives.length === 1) {
        toast.info('Processing archive...');
      } else {
        toast.success(`${archives.length} archives queued - will process sequentially`);
      }

      // Add all archives to the queue
      setArchiveQueue(prev => [...prev, ...archives]);

      // Release lock after a short delay (queue processing will handle the rest)
      setTimeout(() => {
        if (window.__modManagerProcessingLock) {
          console.log('[ModManager] [GLOBAL LOCK] Released processing lock (archives queued)');
          window.__modManagerProcessingLock.isProcessing = false;
        }
      }, 500);
    }

    // If no files matched, release lock immediately
    if (pakFiles.length === 0 && archives.length === 0) {
      console.log('[ModManager] [GLOBAL LOCK] No valid files, releasing lock');
      lock.isProcessing = false;
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
