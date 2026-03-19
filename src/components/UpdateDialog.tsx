import { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { useUIStore } from '../stores';
import { useUpdater } from '../hooks/useUpdater';
import { Download, RefreshCw, Loader2, CheckCircle2, Sparkles } from 'lucide-react';

export function UpdateDialog() {
  const { updateDialogOpen, setUpdateDialogOpen } = useUIStore();
  const {
    isChecking,
    isDownloading,
    downloadProgress,
    availableUpdate,
    currentVersion,
    checkForUpdates,
    downloadAndInstall,
    restartApp,
  } = useUpdater();

  const hasCheckedInDialog = useRef(false);

  useEffect(() => {
    if (updateDialogOpen) {
      hasCheckedInDialog.current = false;
    }
  }, [updateDialogOpen]);

  useEffect(() => {
    if (updateDialogOpen && !availableUpdate && !isChecking && !hasCheckedInDialog.current) {
      hasCheckedInDialog.current = true;
      checkForUpdates(false);
    }
  }, [updateDialogOpen, availableUpdate, isChecking]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatChangelog = (body: string | null) => {
    if (!body) return null;

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
          <h3 key={i} className="text-sm font-semibold mt-4 mb-2 text-foreground/90">{text}</h3>
        );
        continue;
      }

      if (trimmed.match(/^##\s+/)) {
        const text = trimmed.replace(/^##\s+/, '');
        elements.push(
          <h2 key={i} className="text-base font-bold mt-5 mb-2 text-foreground">{text}</h2>
        );
        continue;
      }

      if (trimmed.match(/^#\s+/) && !trimmed.startsWith('##')) {
        const text = trimmed.replace(/^#\s+/, '');
        elements.push(
          <h1 key={i} className="text-lg font-bold mt-4 mb-3 text-foreground">{text}</h1>
        );
        continue;
      }

      if (trimmed.match(/^[-*]\s+/)) {
        const cleanedText = trimmed
          .replace(/^[-*]\s+/, '')
          .replace(/^\*\*(.+?)\*\*:?\s*/, '$1: ')
          .replace(/\*\*(.+?)\*\*/g, '$1');
        elements.push(
          <li key={i} className="ml-5 text-sm text-foreground/70 leading-relaxed mb-1 list-disc">{cleanedText}</li>
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

  const updateInstalled = downloadProgress === 100 && !isDownloading;

  return (
    <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
      <DialogContent className="!max-w-2xl w-[85vw] p-0 gap-0 rounded-2xl overflow-hidden" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", sans-serif' }}>
        <div className="px-6 pt-6 pb-5 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">Check for Updates</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                Current version: v{currentVersion}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Checking State */}
        {isChecking && (
          <div className="flex flex-col items-center justify-center px-6 py-16 space-y-4" style={{ animation: 'metadata-fade-in 300ms ease-out both' }}>
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center" style={{ animation: 'icon-pop-in 400ms ease-out both' }}>
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
            <p className="text-sm text-muted-foreground" style={{ animation: 'metadata-fade-in 300ms ease-out 200ms both' }}>Checking for updates...</p>
          </div>
        )}

        {/* No Update Available */}
        {!isChecking && !availableUpdate && !updateInstalled && (
          <div className="flex flex-col items-center justify-center px-6 py-16 space-y-6">
            <div className="w-20 h-20 rounded-2xl bg-green-500/10 flex items-center justify-center" style={{ animation: 'icon-pop-in 400ms ease-out both, pulse-glow 3s ease-in-out 600ms infinite' }}>
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <div className="text-center space-y-1.5" style={{ animation: 'metadata-fade-in 300ms ease-out 200ms both' }}>
              <h3 className="text-xl font-bold">You're up to date!</h3>
              <p className="text-sm text-muted-foreground">
                Running the latest version
              </p>
            </div>
            <button
              onClick={() => checkForUpdates()}
              className="group flex items-center gap-2.5 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all duration-200"
              style={{ animation: 'metadata-fade-in 300ms ease-out 400ms both' }}
            >
              <RefreshCw className="w-4 h-4 transition-transform duration-500 group-hover:rotate-180" />
              Check Again
            </button>
          </div>
        )}

        {/* Update Available */}
        {!isChecking && availableUpdate && !updateInstalled && (
          <div className="space-y-0" style={{ animation: 'metadata-fade-in 300ms ease-out both' }}>
            {/* Update banner */}
            <div className="mx-6 p-4 rounded-xl bg-primary/8 border border-primary/15">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-foreground">
                    v{availableUpdate.version} Available
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Released {formatDate(availableUpdate.date)}
                  </p>
                </div>
              </div>
            </div>

            {/* Changelog */}
            {availableUpdate.body && (
              <div className="px-6 pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">What's New</h4>
                <ScrollArea className="h-52">
                  <div className="pr-4 rounded-xl bg-muted/15 p-4">
                    {formatChangelog(availableUpdate.body)}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Download Progress */}
            {isDownloading && (
              <div className="px-6 pt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Downloading...</span>
                  <span className="font-bold text-foreground">{downloadProgress}%</span>
                </div>
                <div className="w-full bg-muted/30 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 px-6 py-4">
              <Button
                variant="outline"
                onClick={() => setUpdateDialogOpen(false)}
                className="rounded-xl border-border/40"
              >
                Later
              </Button>
              {isDownloading ? (
                <Button disabled className="gap-2 rounded-xl">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Downloading...
                </Button>
              ) : (
                <Button onClick={downloadAndInstall} className="gap-2 rounded-xl">
                  <Download className="w-4 h-4" />
                  Download & Install
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Update Installed */}
        {updateInstalled && (
          <div className="flex flex-col items-center justify-center px-6 py-16 space-y-6">
            <div className="w-20 h-20 rounded-2xl bg-green-500/10 flex items-center justify-center" style={{ animation: 'icon-pop-in 400ms ease-out both, pulse-glow 3s ease-in-out 600ms infinite' }}>
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <div className="text-center space-y-1.5" style={{ animation: 'metadata-fade-in 300ms ease-out 200ms both' }}>
              <h3 className="text-xl font-bold">Update Installed!</h3>
              <p className="text-sm text-muted-foreground">
                Restart to apply the update
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setUpdateDialogOpen(false)}
                className="rounded-xl border-border/40"
              >
                Later
              </Button>
              <Button onClick={restartApp} className="gap-2 rounded-xl">
                <RefreshCw className="w-4 h-4" />
                Restart Now
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
