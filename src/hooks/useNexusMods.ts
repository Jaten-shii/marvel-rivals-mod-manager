import { useState, useEffect, useCallback, useRef } from 'react';
import { onOpenUrl, getCurrent } from '@tauri-apps/plugin-deep-link';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';

// ── NXM URL Parsing ─────────────────────────────────────────────────────────

export interface NxmLink {
  game: string;
  modId: number;
  fileId: number;
  key: string;
  expires: number;
}

/**
 * Parse an nxm:// URL into its components
 * Format: nxm://marvelrivals/mods/123/files/456?key=abc&expires=123456
 */
export function parseNxmUrl(url: string): NxmLink | null {
  try {
    // nxm://marvelrivals/mods/123/files/456?key=abc&expires=123456
    const match = url.match(/^nxm:\/\/([^/]+)\/mods\/(\d+)\/files\/(\d+)\?(.+)$/);
    if (!match) return null;

    const [, game, modIdStr, fileIdStr, queryString] = match;
    if (!game || !modIdStr || !fileIdStr || !queryString) return null;

    const params = new URLSearchParams(queryString);
    const key = params.get('key');
    const expires = params.get('expires');

    if (!key || !expires) return null;

    return {
      game,
      modId: parseInt(modIdStr, 10),
      fileId: parseInt(fileIdStr, 10),
      key,
      expires: parseInt(expires, 10),
    };
  } catch {
    return null;
  }
}

// ── Nexus API Key Storage ───────────────────────────────────────────────────
// Uses both localStorage (for immediate access) and backend preferences (for persistence)

const NEXUS_API_KEY_STORAGE = 'nexus_api_key';

export function getNexusApiKey(): string | null {
  return localStorage.getItem(NEXUS_API_KEY_STORAGE);
}

export function setNexusApiKey(key: string) {
  localStorage.setItem(NEXUS_API_KEY_STORAGE, key);
}

export function clearNexusApiKey() {
  localStorage.removeItem(NEXUS_API_KEY_STORAGE);
}

/** Sync API key from backend preferences to localStorage on app start */
export function syncNexusApiKeyFromPreferences(nexusApiKey?: string) {
  if (nexusApiKey) {
    localStorage.setItem(NEXUS_API_KEY_STORAGE, nexusApiKey);
  }
}

// ── Nexus API Calls ─────────────────────────────────────────────────────────

const NEXUS_API_BASE = 'https://api.nexusmods.com/v1';

async function nexusFetch(endpoint: string, apiKey: string) {
  const response = await fetch(`${NEXUS_API_BASE}${endpoint}`, {
    headers: {
      'APIKEY': apiKey,
      'Application-Name': 'Marvel Rivals Mod Manager',
      'Application-Version': '5.2.0',
    },
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('Invalid API key');
    if (response.status === 429) throw new Error('Rate limited — try again in a moment');
    throw new Error(`Nexus API error: ${response.status}`);
  }

  return response.json();
}

export async function getModInfo(apiKey: string, gameId: string, modId: number) {
  return nexusFetch(`/games/${gameId}/mods/${modId}.json`, apiKey);
}

export async function getDownloadUrl(apiKey: string, gameId: string, modId: number, fileId: number, key: string, expires: number) {
  return nexusFetch(
    `/games/${gameId}/mods/${modId}/files/${fileId}/download_link.json?key=${key}&expires=${expires}`,
    apiKey,
  );
}

// ── NXM Deep Link Hook ─────────────────────────────────────────────────────

export type NxmDownloadStatus = 'idle' | 'fetching-info' | 'downloading' | 'installing' | 'done' | 'error';

export function useNxmDeepLink() {
  const [pendingNxmLink, setPendingNxmLink] = useState<NxmLink | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState<NxmDownloadStatus>('idle');
  const [downloadModName, setDownloadModName] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const listenerSetup = useRef(false);

  const handleNxmUrl = useCallback((url: string) => {
    if (!url.startsWith('nxm://')) return;
    console.log('[NXM] Processing URL:', url);

    const parsed = parseNxmUrl(url);
    if (parsed) {
      if (parsed.game !== 'marvelrivals') {
        toast.error('This mod is not for Marvel Rivals');
        return;
      }
      console.log('[NXM] Parsed link:', parsed);
      setPendingNxmLink(parsed);
    } else {
      toast.error('Invalid NXM download link');
    }
  }, []);

  // Listen for nxm:// deep links from all sources
  useEffect(() => {
    if (listenerSetup.current) return;
    listenerSetup.current = true;

    // Source 0: Check if app was launched via a deep link (cold start)
    getCurrent().then((urls) => {
      if (urls && urls.length > 0) {
        console.log('[NXM] App launched with deep link (cold start):', urls);
        for (const url of urls) {
          handleNxmUrl(String(url));
        }
      }
    }).catch(err => {
      console.error('[NXM] Failed to get startup URLs:', err);
    });

    // Source 1: Tauri deep-link plugin (app opened fresh from NXM link, late listener)
    onOpenUrl((urls) => {
      console.log('[NXM] Deep link received (onOpenUrl):', urls);
      for (const url of urls) {
        handleNxmUrl(url);
      }
    }).catch(err => {
      console.error('[NXM] Failed to register deep link listener:', err);
    });

    // Source 2: Single-instance forwarding (app already running, second instance sends URL)
    listen<string>('deep-link-received', (event) => {
      console.log('[NXM] Deep link received (single-instance):', event.payload);
      handleNxmUrl(event.payload);
    }).catch(err => {
      console.error('[NXM] Failed to register single-instance listener:', err);
    });
  }, [handleNxmUrl]);

  const downloadAndInstall = useCallback(async (nxmLink: NxmLink) => {
    const apiKey = getNexusApiKey();
    if (!apiKey) {
      toast.error('Nexus Mods API key required', {
        description: 'Go to Settings → Nexus Mods to add your API key',
      });
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadError('');
    setDownloadStatus('fetching-info');
    setDownloadModName(`Mod #${nxmLink.modId}`);

    try {
      // 1. Get mod info
      let modName = `Mod #${nxmLink.modId}`;
      let modImageUrl: string | null = null;
      let modAuthor: string | null = null;
      let modDescription: string | null = null;
      try {
        const modInfo = await getModInfo(apiKey, nxmLink.game, nxmLink.modId);
        modName = modInfo.name || modName;
        modImageUrl = modInfo.picture_url || null;
        modAuthor = modInfo.author || modInfo.uploaded_by || null;
        modDescription = modInfo.summary || null;
        setDownloadModName(modName);
      } catch {
        // Non-fatal
      }

      // 2. Get download URL
      setDownloadStatus('downloading');
      setDownloadProgress(0);
      const downloadLinks = await getDownloadUrl(
        apiKey, nxmLink.game, nxmLink.modId, nxmLink.fileId, nxmLink.key, nxmLink.expires,
      );

      if (!downloadLinks || downloadLinks.length === 0) {
        throw new Error('No download links available');
      }

      const downloadUrl = downloadLinks[0].URI;
      console.log('[NXM] Download URL:', downloadUrl);

      // Listen for real download progress from Rust backend
      const unlisten = await listen<number>('nexus-download-progress', (event) => {
        setDownloadProgress(event.payload);
      });

      // 3. Download via Rust backend with streaming progress
      const filePath = await invoke<string>('download_nexus_mod', {
        url: downloadUrl,
        modName,
      });

      unlisten();
      setDownloadProgress(100);

      // 4. Store Nexus metadata for the metadata dialog to pick up
      try {
        localStorage.setItem('nexus_pending_mod_name', modName);
        localStorage.setItem('nexus_pending_mod_author', modAuthor || '');
        localStorage.setItem('nexus_pending_mod_description', modDescription || '');
        localStorage.setItem('nexus_pending_nexus_mod_id', String(nxmLink.modId));
        if (modImageUrl) {
          localStorage.setItem('nexus_pending_thumbnail', modImageUrl);
        }
      } catch {
        // Non-fatal
      }

      setDownloadProgress(90);
      setDownloadStatus('installing');

      // 5. Emit event so ModManager can handle the install flow
      await invoke('install_mod_from_path', { filePath });

      setDownloadProgress(100);
      setDownloadStatus('done');

      // Auto-dismiss after a moment
      setTimeout(() => {
        setDownloadStatus('idle');
        setIsDownloading(false);
        setDownloadProgress(0);
        setPendingNxmLink(null);
      }, 2000);
    } catch (error) {
      console.error('[NXM] Download failed:', error);
      setDownloadError(String(error));
      setDownloadStatus('error');
      // Keep modal open on error so user can see what went wrong
    }
  }, []);

  // Auto-download when a pending link comes in
  useEffect(() => {
    if (pendingNxmLink && !isDownloading) {
      downloadAndInstall(pendingNxmLink);
    }
  }, [pendingNxmLink, isDownloading, downloadAndInstall]);

  const dismissDownload = useCallback(() => {
    setDownloadStatus('idle');
    setIsDownloading(false);
    setDownloadProgress(0);
    setPendingNxmLink(null);
    setDownloadError('');
  }, []);

  return {
    isDownloading,
    downloadProgress,
    downloadStatus,
    downloadModName,
    downloadError,
    pendingNxmLink,
    dismissDownload,
  };
}
