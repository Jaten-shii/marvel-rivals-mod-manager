import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueries, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { openUrl } from '@tauri-apps/plugin-opener';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { ArrowLeft, ExternalLink, Download, Heart } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { useUIStore } from '../stores';
import { useUIStore as usePrefsStore } from '@/store/ui-store';
import { c, tint, formatFileSize } from '../shared/rivals-tokens';
import { WarnIcon } from '../shared/rivals-design';
import {
  getNexusApiKey,
  getUpdatedMods,
  getLatestAdded,
  getModInfo,
  getModFiles,
  validateNexusUser,
  getPremiumDownloadLink,
  type NexusModSummary,
  type NexusFileEntry,
} from '../hooks/useNexusMods';

// Feed skeleton: the exact 10 newest mods (pre-hydrated, primed into the
// detail cache) followed by every mod touched this month by activity.
async function fetchDiscoverFeed(apiKey: string, queryClient: QueryClient) {
  const [latest, rows] = await Promise.all([
    getLatestAdded(apiKey, GAME).catch(() => [] as Awaited<ReturnType<typeof getLatestAdded>>),
    getUpdatedMods(apiKey, GAME, '1m'),
  ]);
  // latest_added returns full mod objects — seed the detail cache so the
  // top of the feed costs zero extra requests
  for (const m of latest) {
    if (m?.mod_id) queryClient.setQueryData(['nexus', 'mod', m.mod_id], m);
  }
  const sorted = [...rows].sort((a, b) => b.latest_mod_activity - a.latest_mod_activity);
  const seen = new Set<number>();
  const merged: { mod_id: number; latest_mod_activity: number }[] = [];
  for (const m of latest) {
    if (m?.mod_id && !seen.has(m.mod_id)) {
      seen.add(m.mod_id);
      merged.push({ mod_id: m.mod_id, latest_mod_activity: m.updated_timestamp ?? 0 });
    }
  }
  for (const r of sorted) {
    if (!seen.has(r.mod_id)) {
      seen.add(r.mod_id);
      merged.push(r);
    }
  }
  return { rows: merged };
}

const GAME = 'marvelrivals';
const PAGE_SIZE = 20;

function timeAgo(unixSeconds?: number): string {
  if (!unixSeconds) return '—';
  const days = Math.floor((Date.now() / 1000 - unixSeconds) / 86400);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// Minimal BBCode → HTML for Nexus descriptions (same rules as the details panel)
function processDescription(description: string): string {
  return description
    .replace(/<br\s*\/?>/gi, '<br/>')
    .replace(/\[img\](.*?)\[\/img\]/gi, '')
    .replace(/\[url=(.*?)\](.*?)\[\/url\]/gi, '$2')
    .replace(/\[list\]/gi, '<ul class="list-disc list-inside my-2">')
    .replace(/\[\/list\]/gi, '</ul>')
    .replace(/\[\*\]/gi, '<li>')
    .replace(/\[b\](.*?)\[\/b\]/gi, '<strong>$1</strong>')
    .replace(/\[i\](.*?)\[\/i\]/gi, '<em>$1</em>')
    .replace(/\[u\](.*?)\[\/u\]/gi, '<u>$1</u>')
    .replace(/\[.*?\]/g, '')
    .replace(/(<br\/>){3,}/g, '<br/><br/>')
    .trim();
}

export function NexusDiscoverDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const apiKey = getNexusApiKey();
  const showNsfw = useUIStore((s) => s.filters.showNsfw);
  const setPreferencesOpen = usePrefsStore((s) => s.setPreferencesOpen);

  const [pages, setPages] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [feedSort, setFeedSort] = useState<'newest' | 'updated'>('newest');

  // Who's browsing — premium accounts get direct API download links
  const { data: user } = useQuery({
    queryKey: ['nexus', 'user'],
    queryFn: () => validateNexusUser(apiKey ?? ''),
    enabled: open && !!apiKey,
    staleTime: 1000 * 60 * 60 * 24,
    retry: false,
  });
  const isPremium = !!user?.is_premium;

  const queryClient = useQueryClient();
  const { data: updatedIds, isLoading: idsLoading, error: idsError } = useQuery({
    queryKey: ['nexus', 'feed', '1m'],
    queryFn: () => fetchDiscoverFeed(apiKey ?? '', queryClient),
    enabled: open && !!apiKey,
    staleTime: 1000 * 60 * 30,
    retry: false,
  });

  // Newest mode walks mod IDs downward from the highest known id — Nexus ids
  // are sequential per game, so this is exact release order with no month
  // ceiling. Gaps (hidden/removed mods) 404 and simply get skipped.
  const topId = useMemo(() => Math.max(0, ...(updatedIds?.rows ?? []).map((r) => r.mod_id)), [updatedIds]);
  const visibleIds = useMemo(() => {
    if (feedSort === 'newest') {
      if (!topId) return [];
      const count = Math.min(pages * PAGE_SIZE, topId);
      return Array.from({ length: count }, (_, i) => ({ mod_id: topId - i }));
    }
    return (updatedIds?.rows ?? []).slice(0, pages * PAGE_SIZE);
  }, [updatedIds, pages, feedSort, topId]);

  // Hydrate details per mod — individually cached so revisits are free
  const detailQueries = useQueries({
    queries: visibleIds.map((row) => ({
      queryKey: ['nexus', 'mod', row.mod_id],
      queryFn: () => getModInfo(apiKey ?? '', GAME, row.mod_id) as Promise<NexusModSummary>,
      enabled: open && !!apiKey,
      staleTime: 1000 * 60 * 60 * 6,
      gcTime: 1000 * 60 * 60 * 24,
      retry: false,
    })),
  });

  const feed = useMemo(() => {
    const mods: NexusModSummary[] = [];
    for (const q of detailQueries) {
      const m = q.data;
      if (!m) continue;
      if (m.status && m.status !== 'published') continue;
      if (m.available === false) continue;
      if (!showNsfw && m.contains_adult_content) continue;
      mods.push(m);
    }
    mods.sort((a, b) =>
      feedSort === 'newest'
        ? (b.created_timestamp ?? 0) - (a.created_timestamp ?? 0)
        : (b.updated_timestamp ?? 0) - (a.updated_timestamp ?? 0)
    );
    return mods;
  }, [detailQueries, showNsfw, feedSort]);

  const stillHydrating = detailQueries.some((q) => q.isLoading);
  const canLoadMore =
    feedSort === 'newest'
      ? topId - pages * PAGE_SIZE > 0
      : (updatedIds?.rows.length ?? 0) > pages * PAGE_SIZE;

  // Gap ids (hidden/removed mods) and the NSFW lock can thin a page below a
  // full screen. Quietly deepen the pool until it's respectably full,
  // bounded to keep API usage sane.
  useEffect(() => {
    if (!open || feedSort !== 'newest' || stillHydrating) return;
    if (feed.length >= 12 || !canLoadMore || pages >= 6) return;
    queueMicrotask(() => setPages((p) => p + 1));
  }, [open, feedSort, stillHydrating, feed.length, canLoadMore, pages]);

  const selected = selectedId ? feed.find((m) => m.mod_id === selectedId) : null;

  // Files for the selected mod
  const { data: filesData, isLoading: filesLoading } = useQuery({
    queryKey: ['nexus', 'files', selectedId],
    queryFn: () => getModFiles(apiKey ?? '', GAME, selectedId ?? 0),
    enabled: open && !!apiKey && !!selectedId,
    staleTime: 1000 * 60 * 30,
    retry: false,
  });
  const files = (filesData?.files ?? []).filter(
    (f) => f.category_name && !['OLD_VERSION', 'ARCHIVED'].includes(f.category_name.toUpperCase())
  );

  const handleOpenOnNexus = (modId: number) => {
    openUrl(`https://www.nexusmods.com/${GAME}/mods/${modId}?tab=files`);
  };

  // Premium path: fetch the direct link and hand it to the existing pipeline
  const handleDirectInstall = async (mod: NexusModSummary, file: NexusFileEntry) => {
    if (!apiKey) return;
    try {
      toast.info(`Starting download: ${file.name}`);
      const links = await getPremiumDownloadLink(apiKey, GAME, mod.mod_id, file.file_id);
      const uri = Array.isArray(links) && links.length > 0 ? links[0].URI : null;
      if (!uri) throw new Error('No download link returned');

      // Same pending-metadata handoff the nxm:// flow uses
      try {
        localStorage.setItem('nexus_pending_mod_name', mod.name || `Mod #${mod.mod_id}`);
        localStorage.setItem('nexus_pending_mod_author', mod.author || mod.uploaded_by || '');
        localStorage.setItem('nexus_pending_mod_description', mod.summary || '');
        localStorage.setItem('nexus_pending_nexus_mod_id', String(mod.mod_id));
        if (mod.picture_url) localStorage.setItem('nexus_pending_thumbnail', mod.picture_url);
      } catch { /* non-fatal */ }

      const filePath = await invoke<string>('download_nexus_mod', { url: uri, modName: mod.name || `Mod #${mod.mod_id}` });
      await invoke('install_mod_from_path', { filePath });
      onOpenChange(false); // hand the stage to the install flow's dialogs
    } catch (error) {
      const msg = String(error);
      if (msg.includes('403') || msg.toLowerCase().includes('premium')) {
        toast.error('Direct downloads need Nexus Premium — opening the mod page instead');
        handleOpenOnNexus(mod.mod_id);
      } else {
        console.error('[NexusDiscover] Direct install failed:', error);
        toast.error(`Download failed: ${msg}`);
      }
    }
  };

  const monoLabel = { color: c.ink3, fontFamily: c.mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' } as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-hidden p-0 md:max-h-[780px] md:max-w-[1160px]"
        style={{ background: c.bg, border: `1px solid ${c.line2}`, borderRadius: 16 }}
      >
        <DialogTitle className="sr-only">Discover Nexus Mods</DialogTitle>
        <DialogDescription className="sr-only">Browse the newest Marvel Rivals mods from Nexus Mods.</DialogDescription>

        <div className="flex flex-col" style={{ height: 780 }}>
          {/* Header */}
          {/* Right padding clears the dialog's built-in close X */}
          <header className="flex items-center gap-3 flex-shrink-0" style={{ padding: '16px 62px 16px 24px', borderBottom: `1px solid ${c.line}`, background: c.panel }}>
            {selected && (
              <button
                onClick={() => setSelectedId(null)}
                className="grid place-items-center cursor-pointer flex-shrink-0"
                style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', color: c.ink2, border: `1px solid ${c.line2}` }}
                aria-label="Back to feed"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <div className="rivals-condensed truncate" style={{ color: c.ink, fontSize: 24, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase', lineHeight: 1.1 }}>
                {selected ? selected.name || `Mod #${selected.mod_id}` : 'Discover'}
              </div>
              <div className="rivals-mono" style={{ ...monoLabel, marginTop: 2 }}>
                {selected
                  ? `by ${selected.author || selected.uploaded_by || 'unknown'}`
                  : 'nexusmods.com · new & updated this month'}
              </div>
            </div>
            <div className="flex items-center gap-2" style={{ marginLeft: 'auto', flexShrink: 0 }}>
              {isPremium && (
                <span className="rivals-mono" style={{ padding: '3px 9px', borderRadius: 999, background: tint(c.warn, 14), color: c.warn, border: `1px solid ${tint(c.warn, 40)}`, fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
                  Premium
                </span>
              )}
              <button
                onClick={() => (selected ? handleOpenOnNexus(selected.mod_id) : openUrl(`https://www.nexusmods.com/games/${GAME}/mods`))}
                className="inline-flex items-center gap-2 cursor-pointer"
                style={{ padding: '7px 12px', borderRadius: 7, background: 'transparent', color: c.ink2, border: `1px solid ${c.line2}`, fontFamily: c.font, fontSize: 12.5 }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Website
              </button>
            </div>
          </header>

          {/* Body */}
          <ScrollArea className="flex-1 min-h-0 sidebar-scroll">
            {!apiKey ? (
              <div className="flex flex-col items-center justify-center text-center" style={{ padding: '110px 40px' }}>
                <div className="rivals-condensed" style={{ color: c.ink2, fontSize: 24, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  API key required
                </div>
                <p style={{ color: c.ink3, fontFamily: c.font, fontSize: 13.5, marginTop: 8, maxWidth: 420 }}>
                  Browsing needs your free personal Nexus Mods API key. The settings page walks you through getting one in about a minute.
                </p>
                <button
                  onClick={() => { onOpenChange(false); setPreferencesOpen(true); }}
                  className="cursor-pointer"
                  style={{ marginTop: 18, padding: '9px 18px', borderRadius: 8, background: c.accent, color: c.onAccent, border: 'none', fontFamily: c.font, fontSize: 13.5, fontWeight: 600 }}
                >
                  Open Settings
                </button>
              </div>
            ) : selected ? (
              /* ── Mod detail ── */
              <div style={{ padding: 24 }}>
                {selected.picture_url && (
                  <div className="relative overflow-hidden" style={{ borderRadius: 12, border: `1px solid ${c.line}` }}>
                    <img src={selected.picture_url} alt="" className="w-full object-cover" style={{ maxHeight: 340 }} />
                    {selected.contains_adult_content && (
                      <div className="art-tag-plate">
                        <span className="kicker-tag rivals-condensed" style={{ color: 'var(--rivals-nsfw-bright)' }}>
                          <WarnIcon stroke="var(--rivals-nsfw-bright)" size={11} />
                          NSFW
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Spec strip */}
                <div className="flex items-center flex-wrap" style={{ gap: 22, marginTop: 16 }}>
                  {[
                    { label: 'Version', value: selected.version ? `v${selected.version}` : '—' },
                    { label: 'Endorsements', value: String(selected.endorsement_count ?? 0) },
                    { label: 'Downloads', value: String(selected.mod_downloads ?? 0) },
                    { label: 'Updated', value: timeAgo(selected.updated_timestamp) },
                  ].map((s) => (
                    <div key={s.label}>
                      <div className="rivals-mono" style={monoLabel}>{s.label}</div>
                      <div className="rivals-mono" style={{ color: c.ink, fontSize: 14, fontWeight: 600, marginTop: 2 }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {selected.summary && (
                  <p className="rivals-display" style={{ color: c.ink2, fontSize: 15.5, fontStyle: 'italic', marginTop: 16, lineHeight: 1.5 }}>
                    {selected.summary}
                  </p>
                )}

                {selected.description && (
                  <div
                    style={{ color: c.ink2, fontFamily: c.font, fontSize: 13.5, lineHeight: 1.65, marginTop: 14 }}
                    dangerouslySetInnerHTML={{ __html: processDescription(selected.description) }}
                  />
                )}

                {/* Files */}
                <h4 className="rivals-mono" style={{ ...monoLabel, fontWeight: 600, marginTop: 26, marginBottom: 10 }}>
                  Files {files.length > 0 && <span style={{ color: c.muted, marginLeft: 6 }}>{files.length}</span>}
                </h4>
                {filesLoading ? (
                  <p style={{ color: c.ink3, fontFamily: c.font, fontSize: 12.5, fontStyle: 'italic' }}>Loading files…</p>
                ) : files.length === 0 ? (
                  <p style={{ color: c.ink3, fontFamily: c.font, fontSize: 12.5, fontStyle: 'italic' }}>No downloadable files listed.</p>
                ) : (
                  <div className="space-y-1.5">
                    {files.map((f) => (
                      <div key={f.file_id} className="flex items-center gap-3 rounded-lg" style={{ padding: '10px 12px', background: c.panel, border: `1px solid ${c.line}` }}>
                        <div className="min-w-0 flex-1">
                          <div className="truncate" style={{ color: c.ink, fontFamily: c.font, fontSize: 13.5, fontWeight: 600 }}>{f.name}</div>
                          <div className="rivals-mono" style={{ color: c.ink3, fontSize: 10.5, marginTop: 2 }}>
                            {f.category_name || 'FILE'} · {f.version ? `v${f.version} · ` : ''}{formatFileSize((f.size_kb ?? 0) * 1024)} · {timeAgo(f.uploaded_timestamp)}
                          </div>
                        </div>
                        <button
                          onClick={() => (isPremium ? handleDirectInstall(selected, f) : handleOpenOnNexus(selected.mod_id))}
                          className="inline-flex items-center gap-2 cursor-pointer flex-shrink-0"
                          style={{ padding: '7px 13px', borderRadius: 7, background: tint(c.accent, 12), color: c.accent, border: `1px solid ${tint(c.accent, 40)}`, fontFamily: c.font, fontSize: 12.5, fontWeight: 600 }}
                        >
                          <Download className="w-3.5 h-3.5" />
                          {isPremium ? 'Install' : 'Get on Nexus'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* ── Feed ── */
              <div style={{ padding: 24 }}>
                {idsError ? (
                  <p style={{ color: c.err, fontFamily: c.font, fontSize: 13 }}>Couldn&rsquo;t reach Nexus Mods: {String(idsError)}</p>
                ) : idsLoading ? (
                  <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {Array.from({ length: 9 }, (_, i) => (
                      <div key={i}>
                        <div className="skel" style={{ width: '100%', aspectRatio: '16/9', borderRadius: 10 }} />
                        <div className="skel" style={{ width: '70%', height: 13, borderRadius: 6, marginTop: 9 }} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {/* Feed ordering */}
                    <div className="flex items-center" style={{ gap: 6, marginBottom: 14 }}>
                      {([['newest', 'Newest Releases'], ['updated', 'Recently Updated']] as const).map(([mode, label]) => {
                        const active = feedSort === mode;
                        return (
                          <button
                            key={mode}
                            onClick={() => setFeedSort(mode)}
                            className="rivals-mono cursor-pointer"
                            style={{
                              padding: '5px 12px',
                              borderRadius: 6,
                              border: 'none',
                              textTransform: 'uppercase',
                              letterSpacing: '0.09em',
                              fontSize: 10,
                              fontWeight: 700,
                              background: active ? tint(c.accent, 14) : 'transparent',
                              color: active ? c.accent : c.ink3,
                              transition: 'background 150ms ease, color 150ms ease',
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                      <span className="rivals-mono" style={{ marginLeft: 'auto', color: c.muted, fontSize: 10.5 }}>
                        {feed.length} shown
                      </span>
                    </div>
                    <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                      {feed.map((m) => (
                        <button
                          key={m.mod_id}
                          onClick={() => setSelectedId(m.mod_id)}
                          className="discover-card text-left cursor-pointer overflow-hidden flex flex-col"
                          style={{ background: c.panel, border: `1px solid ${c.line}`, borderRadius: 12, padding: 0 }}
                        >
                          <div style={{ aspectRatio: '16/9', background: c.bg, overflow: 'hidden', position: 'relative' }}>
                            {m.picture_url ? (
                              <img src={m.picture_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full grid place-items-center rivals-mono" style={{ color: c.muted, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                no preview
                              </div>
                            )}
                            {m.contains_adult_content && (
                              <div className="art-tag-plate" style={{ gap: 6, padding: '4px 12px 4px 9px' }}>
                                <span className="kicker-tag rivals-condensed" style={{ color: 'var(--rivals-nsfw-bright)', fontSize: 9.5 }}>
                                  <WarnIcon stroke="var(--rivals-nsfw-bright)" size={9} />
                                  NSFW
                                </span>
                              </div>
                            )}
                          </div>
                          <div style={{ padding: '10px 13px 12px' }}>
                            <div className="rivals-condensed truncate" style={{ color: c.ink, fontSize: 17, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                              {m.name || `Mod #${m.mod_id}`}
                            </div>
                            <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
                              <span className="rivals-mono truncate" style={{ color: c.ink3, fontSize: 10.5 }}>
                                {m.author || m.uploaded_by || 'unknown'}
                              </span>
                              <span className="rivals-mono inline-flex items-center gap-1 flex-shrink-0" style={{ color: c.ink3, fontSize: 10.5, marginLeft: 'auto' }}>
                                <Heart className="w-3 h-3" style={{ color: c.err }} />
                                {m.endorsement_count ?? 0}
                              </span>
                              <span className="rivals-mono flex-shrink-0" style={{ color: c.muted, fontSize: 10.5 }}>
                                {timeAgo(feedSort === 'newest' ? m.created_timestamp : m.updated_timestamp)}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    {(stillHydrating || canLoadMore) && (
                      <div className="flex justify-center" style={{ marginTop: 20 }}>
                        <button
                          onClick={() => setPages((p) => p + 1)}
                          disabled={stillHydrating}
                          className="cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ padding: '9px 22px', borderRadius: 8, background: 'transparent', color: c.ink2, border: `1px solid ${c.line2}`, fontFamily: c.font, fontSize: 13, fontWeight: 600 }}
                        >
                          {stillHydrating ? 'Loading…' : 'Load More'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
