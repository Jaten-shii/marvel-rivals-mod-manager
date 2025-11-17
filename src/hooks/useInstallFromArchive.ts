import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import type { DetectedMod } from '../components/ModSelectionDialog';
import type { ModCategory, Character, ModInfo } from '../types/mod.types';
import { sanitizeFolderName } from '../utils/sanitize';

// Global extraction lock to prevent duplicate extractions across HMR instances
declare global {
  interface Window {
    __archiveExtractionLock?: {
      currentlyExtracting: Set<string>;
    };
  }
}

interface ModSetup {
  modName: string;
  category: ModCategory;
  character: Character | null;
  costume: string | null;
}

interface InstallFromArchiveState {
  isExtracting: boolean;
  detectedMods: DetectedMod[];
  currentModIndex: number;
  currentModSetup: ModSetup | null;
  currentPakFile: string | null;
}

export function useInstallFromArchive() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<InstallFromArchiveState>({
    isExtracting: false,
    detectedMods: [],
    currentModIndex: 0,
    currentModSetup: null,
    currentPakFile: null,
  });

  // Step 1: Extract and detect mods in the archive
  const extractAndDetect = useMutation({
    mutationFn: async (archivePath: string) => {
      // Initialize global extraction lock if needed
      if (!window.__archiveExtractionLock) {
        window.__archiveExtractionLock = {
          currentlyExtracting: new Set<string>(),
        };
      }

      const lock = window.__archiveExtractionLock;

      // Check if this archive is already being extracted
      if (lock.currentlyExtracting.has(archivePath)) {
        console.log('[useInstallFromArchive] [EXTRACTION LOCK] Archive already being extracted, aborting:', archivePath);
        throw new Error('Archive is already being processed');
      }

      // Add to extraction set
      console.log('[useInstallFromArchive] [EXTRACTION LOCK] Starting extraction:', archivePath);
      lock.currentlyExtracting.add(archivePath);

      try {
        setState((prev) => ({ ...prev, isExtracting: true }));

        const detected = await invoke<DetectedMod[]>('extract_and_detect_mods', {
          archivePath,
        });

        console.log('[useInstallFromArchive] Extraction complete. Detected mods:', detected.length);
        console.log('[useInstallFromArchive] Mod details:', detected.map(m => ({
          pakFile: m.pakFile,
          associatedFiles: m.associatedFiles.length,
          size: m.size,
        })));

        return detected;
      } finally {
        // Always remove from extraction set, even on error
        lock.currentlyExtracting.delete(archivePath);
        console.log('[useInstallFromArchive] [EXTRACTION LOCK] Released extraction lock');
      }
    },
    onSuccess: (detected) => {
      console.log('[useInstallFromArchive] Setting state with detected mods');
      setState((prev) => {
        const newState = {
          ...prev,
          isExtracting: false,
          detectedMods: detected,
          currentModIndex: 0,
          currentPakFile: null, // Reset currentPakFile to ensure no stale references
        };
        console.log('[useInstallFromArchive] New state after extraction:', {
          detectedMods: newState.detectedMods.length,
          currentModIndex: newState.currentModIndex,
          currentPakFile: newState.currentPakFile,
        });
        return newState;
      });
    },
    onError: (error) => {
      const errorMsg = String(error);

      // Don't show error for "already being processed" - this is expected when blocking duplicates
      if (errorMsg.includes('already being processed')) {
        console.log('[useInstallFromArchive] Archive already being processed by another instance, silently ignoring');
        setState((prev) => ({ ...prev, isExtracting: false }));
        return;
      }

      // Don't show "Could not create file" errors - these happen when old HMR instances
      // try to extract simultaneously and fail due to file locks
      if (errorMsg.includes('Could not create file')) {
        console.log('[useInstallFromArchive] [HMR GUARD] Suppressing "Could not create file" error from old HMR instance');
        setState((prev) => ({ ...prev, isExtracting: false }));
        return;
      }

      console.error('Failed to extract archive:', error);

      // Provide helpful error messages based on error type
      if (errorMsg.includes('BadSignature') && errorMsg.includes('Rar')) {
        toast.error(
          'RAR format not supported. Please extract the RAR file manually or convert to ZIP format.',
          { duration: 6000 }
        );
      } else if (errorMsg.includes('password') || errorMsg.includes('encrypted')) {
        toast.error('Password-protected archives are not supported. Please extract manually.');
      } else {
        toast.error(`Failed to extract archive: ${error}`);
      }

      setState((prev) => ({ ...prev, isExtracting: false }));
    },
  });

  // Step 2: Install a single mod with its setup
  const installSingleMod = useMutation({
    mutationFn: async ({
      pakFile,
      setup,
    }: {
      pakFile: string;
      setup: ModSetup;
    }): Promise<ModInfo> => {
      console.log('[useInstallFromArchive] installSingleMod called with:', {
        pakFile,
        setup,
      });

      // Build folder name from category, character, and mod name
      // All categories include character subfolder when character is specified
      const folderParts: string[] = [sanitizeFolderName(setup.category)];

      // Include character subfolder if character is specified
      if (setup.character) {
        folderParts.push(sanitizeFolderName(setup.character));
      }

      folderParts.push(sanitizeFolderName(setup.modName));

      const folderName = folderParts.join('/');
      console.log('[useInstallFromArchive] Target folder:', folderName);

      // ATOMIC OPERATION: Install mod with metadata in one call (no delays needed!)
      console.log('[useInstallFromArchive] Installing mod with metadata atomically...');

      const metadata = {
        title: setup.modName,
        description: '',
        author: null,
        version: null,
        tags: [],
        category: setup.category,
        character: setup.character,
        costume: setup.costume,
        isFavorite: false,
        isNsfw: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        installDate: new Date().toISOString(),
        profileIds: null,
        nexusModId: null,
        nexusFileId: null,
        nexusVersion: null,
      };

      const modInfo = await invoke<ModInfo>('install_mod_to_folder_with_metadata', {
        filePath: pakFile,
        folderName,
        metadata,
      });

      console.log('[useInstallFromArchive] Mod installed with metadata:', modInfo.id, modInfo.name);
      return modInfo;
    },
    onSuccess: (newMod: ModInfo) => {
      console.log('[useInstallFromArchive] Mod installed successfully:', newMod.id, newMod.name);
      console.log('[useInstallFromArchive] File path:', newMod.filePath);

      // DON'T manually add to cache - the file watcher will trigger a refetch
      // and we need to use the ID from that fresh scan to avoid ID mismatches
      // Just invalidate the cache to trigger a refetch
      console.log('[useInstallFromArchive] Invalidating mods cache to trigger refetch...');
      queryClient.invalidateQueries({ queryKey: ['mods', 'list'] });
    },
    onError: (error) => {
      console.error('Failed to install mod:', error);
      toast.error(`Failed to install mod: ${error}`);
    },
  });

  // Helper function to reset state
  const reset = () => {
    console.log('[useInstallFromArchive] Resetting state');
    setState({
      isExtracting: false,
      detectedMods: [],
      currentModIndex: 0,
      currentModSetup: null,
      currentPakFile: null,
    });
  };

  // Helper function to set current mod for setup
  // CRITICAL FIX: Accept the mod object directly instead of indexing into detectedMods
  // This ensures we only install user-selected mods, not all detected mods
  const prepareNextMod = (mod: DetectedMod) => {
    setState((prev) => {
      console.log('[useInstallFromArchive] prepareNextMod:', {
        pakFile: mod.pakFile,
      });

      return {
        ...prev,
        currentPakFile: mod.pakFile,
      };
    });

    return true;
  };

  return {
    // State
    isExtracting: state.isExtracting,
    detectedMods: state.detectedMods,
    currentModIndex: state.currentModIndex,
    currentPakFile: state.currentPakFile,
    isInstalling: installSingleMod.isPending,

    // Mutations
    extractAndDetect: extractAndDetect.mutate,
    installSingleMod: installSingleMod.mutateAsync,

    // Helpers
    reset,
    prepareNextMod,
  };
}
