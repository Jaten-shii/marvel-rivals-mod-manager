import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { useUIStore } from '../stores';
import { APP_VERSION } from '../shared/constants';
import { ChevronDown, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { c, tint } from '../shared/rivals-tokens';
import { renderChangelog } from './changelog-markdown';

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function ChangelogDialog() {
  const { changelogDialogOpen, setChangelogDialogOpen } = useUIStore();
  const [releases, setReleases] = useState<GitHubRelease[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['v' + APP_VERSION]));

  useEffect(() => {
    if (changelogDialogOpen && releases.length === 0) fetchReleases();
  }, [changelogDialogOpen]);

  const fetchReleases = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('https://api.github.com/repos/Jaten-shii/marvel-rivals-mod-manager/releases');
      if (!res.ok) throw new Error(`GitHub API error: ${res.statusText}`);
      setReleases(await res.json());
    } catch (error) {
      console.error('[ChangelogDialog] Failed to fetch releases:', error);
      toast.error('Failed to load changelog', { description: 'Could not fetch releases from GitHub' });
    } finally {
      setIsLoading(false);
    }
  };

  const toggle = (tag: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });

  return (
    <Dialog open={changelogDialogOpen} onOpenChange={setChangelogDialogOpen}>
      <DialogContent
        className="!max-w-4xl w-[85vw] p-0 gap-0 overflow-hidden"
        style={{ background: c.bg, border: `1px solid ${c.line2}`, borderRadius: 16 }}
      >
        {/* Header */}
        <div style={{ padding: '22px 28px', borderBottom: `1px solid ${c.line}`, background: c.panel }}>
          <DialogTitle asChild>
            <h2 className="rivals-display" style={{ color: c.ink, fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em' }}>Changelog</h2>
          </DialogTitle>
          <DialogDescription asChild>
            <p className="rivals-mono" style={{ color: c.ink3, fontSize: 11.5, marginTop: 2 }}>v{APP_VERSION} · release notes &amp; version history</p>
          </DialogDescription>
        </div>

        <ScrollArea type="always" className="sidebar-scroll" style={{ height: 'min(650px, calc(85vh - 120px))' }}>
          <div style={{ padding: '20px 28px' }}>
            {isLoading ? (
              <div className="flex items-center justify-center" style={{ padding: '64px 0' }}>
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: c.ink3 }} />
              </div>
            ) : releases.length === 0 ? (
              <div className="flex items-center justify-center" style={{ padding: '64px 0' }}>
                <p style={{ color: c.ink3, fontFamily: c.font, fontSize: 13 }}>No releases found</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div style={{ position: 'absolute', left: 9, top: 14, bottom: 14, width: 1, background: c.line2 }} />

                <div className="flex flex-col gap-1">
                  {releases.map((release, index) => {
                    const isExpanded = expanded.has(release.tag_name);
                    const isCurrent = release.tag_name === 'v' + APP_VERSION || release.tag_name === APP_VERSION;
                    return (
                      <div
                        key={release.tag_name}
                        className="relative"
                        style={{ paddingLeft: 36, animation: `metadata-fade-in 360ms ease-out ${Math.min(index, 12) * 75}ms both` }}
                      >
                        {/* Timeline dot */}
                        <div
                          style={{
                            position: 'absolute', left: 1, top: 16, width: 18, height: 18, borderRadius: '50%', zIndex: 1,
                            background: isCurrent ? c.accent : c.panel,
                            border: `2px solid ${isCurrent ? c.accent : c.line2}`,
                            boxShadow: isCurrent ? `0 0 10px ${tint(c.accent, 60)}` : 'none',
                          }}
                        />
                        <div style={{ borderRadius: 12, overflow: 'hidden', background: isCurrent ? tint(c.accent, 7) : 'transparent', border: `1px solid ${isCurrent ? tint(c.accent, 20) : 'transparent'}` }}>
                          <button
                            onClick={() => toggle(release.tag_name)}
                            className="w-full flex items-center justify-between transition-colors"
                            style={{ padding: '12px 16px' }}
                            onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = tint(c.accent, 7); }}
                            onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
                          >
                            <div className="flex items-center gap-3">
                              <span className="rivals-display" style={{ color: c.ink, fontSize: 18, fontWeight: 600 }}>{release.tag_name}</span>
                              {isCurrent && (
                                <span className="rivals-mono" style={{ padding: '2px 8px', borderRadius: 999, background: tint(c.accent, 20), color: c.accent, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Current</span>
                              )}
                              <span className="rivals-mono" style={{ color: c.muted, fontSize: 11 }}>{formatDate(release.published_at)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <a
                                href={release.html_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 rounded-lg transition-colors"
                                style={{ color: c.ink3 }}
                                title="View on GitHub"
                                onMouseEnter={(e) => { e.currentTarget.style.background = tint(c.accent, 12); e.currentTarget.style.color = c.accent as string; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.ink3 as string; }}
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                              <ChevronDown className="w-5 h-5" style={{ color: c.ink3, transition: 'transform 200ms ease', transform: isExpanded ? 'rotate(180deg)' : 'none' }} />
                            </div>
                          </button>

                          {/* Body — animated grid */}
                          <div className="grid" style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr', opacity: isExpanded ? 1 : 0, transition: 'grid-template-rows 320ms ease, opacity 320ms ease' }}>
                            <div className="overflow-hidden">
                              <div style={{ padding: '4px 16px 16px' }}>
                                <div style={{ background: c.panel, border: `1px solid ${c.line}`, borderRadius: 12, padding: 16 }}>
                                  {release.body ? renderChangelog(release.body, isExpanded) : (
                                    <p style={{ color: c.ink3, fontFamily: c.font, fontSize: 13, fontStyle: 'italic' }}>No changelog provided</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
