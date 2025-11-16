import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { useUIStore } from '../stores';
import { APP_VERSION } from '../shared/constants';
import { ChevronDown, ChevronUp, ExternalLink, Loader2 } from 'lucide-react';
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
      // Fetch releases from GitHub API
      const response = await fetch('https://api.github.com/repos/Jaten-shii/marvel-rivals-mod-manager/releases');

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const data: GitHubRelease[] = await response.json();
      setReleases(data);
      console.log('[ChangelogDialog] Fetched', data.length, 'releases');
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
    // Enhanced markdown-to-HTML conversion for changelog text
    const lines = body.split('\n');
    const elements: React.JSX.Element[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const trimmed = line.trim();

      // Skip completely empty lines
      if (trimmed === '') {
        elements.push(<div key={i} className="h-2" />);
        continue;
      }

      // Handle headers with triple ###
      if (trimmed.match(/^###\s+/)) {
        const text = trimmed.replace(/^###\s+/, '');
        elements.push(
          <h3 key={i} className="text-base font-semibold mt-4 mb-2 text-foreground/90">
            {text}
          </h3>
        );
        continue;
      }

      // Handle headers with double ##
      if (trimmed.match(/^##\s+/)) {
        const text = trimmed.replace(/^##\s+/, '');
        elements.push(
          <h2 key={i} className="text-lg font-bold mt-6 mb-3 text-foreground border-b border-border/50 pb-2">
            {text}
          </h2>
        );
        continue;
      }

      // Handle headers with single #
      if (trimmed.match(/^#\s+/) && !trimmed.startsWith('##')) {
        const text = trimmed.replace(/^#\s+/, '');
        elements.push(
          <h1 key={i} className="text-xl font-bold mt-4 mb-3 text-foreground">
            {text}
          </h1>
        );
        continue;
      }

      // Handle list items
      if (trimmed.match(/^[-*]\s+/)) {
        const cleanedText = trimmed
          .replace(/^[-*]\s+/, '')
          .replace(/^\*\*(.+?)\*\*:?\s*/, '$1: ')
          .replace(/\*\*(.+?)\*\*/g, '$1');
        elements.push(
          <li key={i} className="ml-6 text-sm text-foreground/80 leading-relaxed mb-1 list-disc">
            {cleanedText}
          </li>
        );
        continue;
      }

      // Handle regular text with bold markdown
      if (trimmed.includes('**')) {
        const styledText = trimmed.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
        elements.push(
          <p key={i} className="text-sm text-foreground/80 leading-relaxed mb-2" dangerouslySetInnerHTML={{ __html: styledText }} />
        );
        continue;
      }

      // Regular text
      elements.push(
        <p key={i} className="text-sm text-foreground/80 leading-relaxed mb-2">{trimmed}</p>
      );
    }

    return elements;
  };

  return (
    <Dialog open={changelogDialogOpen} onOpenChange={setChangelogDialogOpen}>
      <DialogContent className="!max-w-6xl w-[90vw] p-0 gap-0" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", sans-serif' }}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            Changelog
            <span className="text-sm font-normal text-muted-foreground">v{APP_VERSION}</span>
          </DialogTitle>
          <DialogDescription>
            View release notes and version history
          </DialogDescription>
        </DialogHeader>

        {/* Releases List */}
        <ScrollArea className="h-[calc(90vh-140px)] max-h-[700px]">
          <div className="space-y-3 px-6 py-4">
          {isLoadingReleases ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : releases.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">No releases found</p>
            </div>
          ) : (
            releases.map((release) => {
              const isExpanded = expandedReleases.has(release.tag_name);
              const isCurrentVersion = release.tag_name === 'v' + APP_VERSION || release.tag_name === APP_VERSION;

              return (
                <div
                  key={release.tag_name}
                  className={`border border-border rounded-lg overflow-hidden ${
                    isCurrentVersion ? 'border-green-500/50 bg-green-500/5' : ''
                  }`}
                >
                  {/* Release Header */}
                  <button
                    onClick={() => toggleRelease(release.tag_name)}
                    className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{release.tag_name}</span>
                        {isCurrentVersion && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-500 border border-green-500/30">
                            Current
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(release.published_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={release.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 hover:bg-accent rounded-md transition-colors"
                        title="View on GitHub"
                      >
                        <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </a>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Release Body (Changelog) */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-border">
                      <div className="max-w-none">
                        {release.body ? formatChangelog(release.body) : (
                          <p className="text-sm text-muted-foreground italic">No changelog provided</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
