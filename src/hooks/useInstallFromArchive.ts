import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import type { DetectedMod } from '../components/ModSelectionDialog';
import type { ModCategory, Character } from '../types/mod.types';
import { sanitizeFolderName } from '../utils/sanitize';

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
      setState((prev) => ({ ...prev, isExtracting: true }));

      const detected = await invoke<DetectedMod[]>('extract_and_detect_mods', {
        archivePath,
      });

      return detected;
    },
    onSuccess: (detected) => {
      setState((prev) => ({
        ...prev,
        isExtracting: false,
        detectedMods: detected,
        currentModIndex: 0,
      }));
    },
    onError: (error) => {
      console.error('Failed to extract archive:', error);

      const errorMsg = String(error);

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
    }) => {
      // Build folder name from category, character, and mod name
      const folderParts: string[] = [sanitizeFolderName(setup.category)];

      if (setup.character) {
        folderParts.push(sanitizeFolderName(setup.character));
      }

      folderParts.push(sanitizeFolderName(setup.modName));

      const folderName = folderParts.join('/');

      // Install the mod to the organized folder
      const modInfo = await invoke('install_mod_to_folder', {
        filePath: pakFile,
        folderName,
      });

      // Update the mod's metadata with category, character, and costume
      await invoke('update_mod_metadata', {
        modId: (modInfo as any).id,
        metadata: {
          ...(modInfo as any).metadata,
          title: setup.modName,
          category: setup.category,
          character: setup.character,
          costume: setup.costume,
        },
      });

      return modInfo;
    },
    onSuccess: () => {
      // Invalidate mods query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['mods'] });
    },
    onError: (error) => {
      console.error('Failed to install mod:', error);
      toast.error(`Failed to install mod: ${error}`);
    },
  });

  // Helper function to reset state
  const reset = () => {
    setState({
      isExtracting: false,
      detectedMods: [],
      currentModIndex: 0,
      currentModSetup: null,
      currentPakFile: null,
    });
  };

  // Helper function to set current mod for setup
  const prepareNextMod = (index: number) => {
    if (index < state.detectedMods.length) {
      setState((prev) => ({
        ...prev,
        currentModIndex: index,
        currentPakFile: state.detectedMods[index]!.pakFile,
      }));
      return true;
    }
    return false;
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
