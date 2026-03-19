import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { useUIStore } from '../stores';
import { APP_VERSION } from '../shared/constants';
import { ChevronDown, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
}

export function ChangelogDialog() {
  const { changelogDialogOpen, setChangelogDialogOpen } = useUIStore();

  const [releases, setReleases] = useState<GitHubRelease[]>([]);
  const [isLoadingReleases, setIsLoadingReleases] = useState(false);
  const [expandedReleases, setExpandedReleases] = useState<Set<string>>(new Set(['v' + APP_VERSION]));

  // Fetch releases from GitHub API
  useEffect(() => {
    if (changelogDialogOpen && releases.length === 0) {
      fetchReleases();
    }
  }, [changelogDialogOpen]);

  const fetchReleases = async () => {
    setIsLoadingReleases(true);
    try {
      const response = await fetch('https://api.github.com/repos/Jaten-shii/marvel-rivals-mod-manager/releases');
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }
      const data: GitHubRelease[] = await response.json();
      setReleases(data);
    } catch (error) {
      console.error('[ChangelogDialog] Failed to fetch releases:', error);
      toast.error('Failed to load changelog', {
        description: 'Could not fetch releases from GitHub',
      });
    } finally {
      setIsLoadingReleases(false);
    }
  };

  const toggleRelease = (tagName: string) => {
    setExpandedReleases((prev) => {
      const next = new Set(prev);
      if (next.has(tagName)) {
        next.delete(tagName);
      } else {
        next.add(tagName);
      }
      return next;
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatChangelog = (body: string) => {
    const lines = body.split('\n');
    const elements: React.JSX.Element[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const trimmed = line.trim();

      if (trimmed === '') {
        elements.push(<div key={i} className="h-2" />);
        continue;
      }

      if (trimmed.match(/^###\s+/)) {
        const text = trimmed.replace(/^###\s+/, '');
        elements.push(
          <h3 key={i} className="text-sm font-semibold mt-4 mb-2 text-foreground/90">
            {text}
          </h3>
        );
        continue;
      }

      if (trimmed.match(/^##\s+/)) {
        const text = trimmed.replace(/^##\s+/, '');
        elements.push(
          <h2 key={i} className="text-base font-bold mt-5 mb-2 text-foreground">
            {text}
          </h2>
        );
        continue;
      }

      if (trimmed.match(/^#\s+/) && !trimmed.startsWith('##')) {
        const text = trimmed.replace(/^#\s+/, '');
        elements.push(
          <h1 key={i} className="text-lg font-bold mt-4 mb-3 text-foreground">
            {text}
          </h1>
        );
        continue;
      }

      if (trimmed.match(/^[-*]\s+/)) {
        const cleanedText = trimmed
          .replace(/^[-*]\s+/, '')
          .replace(/^\*\*(.+?)\*\*:?\s*/, '$1: ')
          .replace(/\*\*(.+?)\*\*/g, '$1');
        elements.push(
          <li key={i} className="ml-5 text-sm text-foreground/70 leading-relaxed mb-1 list-disc">
            {cleanedText}
          </li>
        );
        continue;
      }

      if (trimmed.includes('**')) {
        const styledText = trimmed.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
        elements.push(
          <p key={i} className="text-sm text-foreground/70 leading-relaxed mb-2" dangerouslySetInnerHTML={{ __html: styledText }} />
        );
        continue;
      }

      elements.push(
        <p key={i} className="text-sm text-foreground/70 leading-relaxed mb-2">{trimmed}</p>
      );
    }

    return elements;
  };

  return (
    <Dialog open={changelogDialogOpen} onOpenChange={setChangelogDialogOpen}>
      <DialogContent className="!max-w-5xl w-[85vw] p-0 gap-0 rounded-2xl overflow-hidden" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", sans-serif' }}>
        <div className="px-6 pt-6 pb-4 border-b border-border/40">
          <DialogTitle className="text-3xl font-bold tracking-tight">
            Changelog
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-0.5">
            v{APP_VERSION} — Release notes and version history
          </DialogDescription>
        </div>

        <ScrollArea className="h-[calc(85vh-120px)] max-h-[650px]">
          <div className="px-6 py-5">
          {isLoadingReleases ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : releases.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">No releases found</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[9px] top-3 bottom-3 w-px bg-border/50" />

              <div className="space-y-1">
                {releases.map((release, index) => {
                  const isExpanded = expandedReleases.has(release.tag_name);
                  const isCurrentVersion = release.tag_name === 'v' + APP_VERSION || release.tag_name === APP_VERSION;

                  return (
                    <div
                      key={release.tag_name}
                      className="relative pl-9"
                      style={{ animation: `metadata-fade-in 300ms ease-out ${Math.min(index, 10) * 40}ms both` }}
                    >
                      {/* Timeline dot */}
                      <div className={`absolute left-0 top-4 w-[19px] h-[19px] rounded-full border-2 z-10 ${
                        isCurrentVersion
                          ? 'bg-primary border-primary shadow-[0_0_10px_rgba(var(--primary),0.4)]'
                          : 'bg-card border-border/60'
                      }`} />

                      <div className={`rounded-xl overflow-hidden transition-colors duration-200 ${
                        isCurrentVersion ? 'bg-primary/5' : 'hover:bg-muted/20'
                      }`}>
                        {/* Release Header */}
                        <button
                          onClick={() => toggleRelease(release.tag_name)}
                          className="w-full flex items-center justify-between px-4 py-3 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-foreground">{release.tag_name}</span>
                            {isCurrentVersion && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                                Current
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground/60">
                              {formatDate(release.published_at)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <a
                              href={release.html_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 hover:bg-muted/40 rounded-lg transition-colors"
                              title="View on GitHub"
                            >
                              <ExternalLink className="w-4 h-4 text-muted-foreground/50 hover:text-foreground" />
                            </a>
                            <div className={`p-1 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                              <ChevronDown className="w-5 h-5 text-muted-foreground/50" />
                            </div>
                          </div>
                        </button>

                        {/* Release Body — always mounted, animated via grid */}
                        <div
                          className="grid transition-[grid-template-rows,opacity] duration-350 ease-out"
                          style={{
                            gridTemplateRows: isExpanded ? '1fr' : '0fr',
                            opacity: isExpanded ? 1 : 0,
                            transitionDuration: '350ms',
                          }}
                        >
                          <div className="overflow-hidden">
                            <div className="px-4 pb-4 pt-1">
                              <div className="rounded-xl bg-muted/15 p-4">
                                {release.body ? formatChangelog(release.body) : (
                                  <p className="text-sm text-muted-foreground italic">No changelog provided</p>
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
