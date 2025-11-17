import { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { useUIStore } from '../stores';
import { useUpdater } from '../hooks/useUpdater';
import { Download, RefreshCw, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

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

  // Auto-check for updates when dialog opens (only once per dialog session)
  useEffect(() => {
    if (updateDialogOpen) {
      // Reset check flag when dialog opens
      hasCheckedInDialog.current = false;
    }
  }, [updateDialogOpen]);

  useEffect(() => {
    if (updateDialogOpen && !availableUpdate && !isChecking && !hasCheckedInDialog.current) {
      hasCheckedInDialog.current = true;
      checkForUpdates(false); // Explicitly not silent - show toast
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

  const updateInstalled = downloadProgress === 100 && !isDownloading;

  return (
    <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
      <DialogContent className="!max-w-5xl w-[85vw]" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", sans-serif' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Check for Updates
          </DialogTitle>
          <DialogDescription>
            Current version: v{currentVersion}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Checking State */}
          {isChecking && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Checking for updates...</p>
            </div>
          )}

          {/* No Update Available */}
          {!isChecking && !availableUpdate && !updateInstalled && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">You're up to date!</h3>
                <p className="text-sm text-muted-foreground">
                  You are running the latest version (v{currentVersion})
                </p>
              </div>
              <Button
                onClick={() => checkForUpdates()}
                className="gap-2 bg-[#191F24] hover:bg-primary/20 text-foreground hover:text-primary border border-border hover:border-primary/40 transition-all duration-200"
              >
                <RefreshCw className="w-4 h-4" />
                Check Again
              </Button>
            </div>
          )}

          {/* Update Available */}
          {!isChecking && availableUpdate && !updateInstalled && (
            <div className="space-y-4">
              {/* Update Header */}
              <div className="flex items-start gap-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-blue-500" />
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="text-lg font-semibold text-blue-500">Update Available</h3>
                  <p className="text-sm text-muted-foreground">
                    Version {availableUpdate.version} is now available
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Released {formatDate(availableUpdate.date)}
                  </p>
                </div>
              </div>

              {/* Changelog */}
              {availableUpdate.body && (
                <div className="border border-border rounded-lg p-4">
                  <h4 className="text-sm font-semibold mb-3 text-foreground">What's New</h4>
                  <ScrollArea className="h-64">
                    <div className="max-w-none pr-4">
                      {formatChangelog(availableUpdate.body)}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Download Progress */}
              {isDownloading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Downloading update...</span>
                    <span className="font-medium">{downloadProgress}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setUpdateDialogOpen(false)}>
                  Later
                </Button>
                {isDownloading ? (
                  <Button disabled className="gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Downloading...
                  </Button>
                ) : (
                  <Button onClick={downloadAndInstall} className="gap-2">
                    <Download className="w-4 h-4" />
                    Download & Install
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Update Installed - Ready to Restart */}
          {updateInstalled && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">Update Installed!</h3>
                <p className="text-sm text-muted-foreground">
                  Restart the app to apply the update
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setUpdateDialogOpen(false)}>
                  Restart Later
                </Button>
                <Button onClick={restartApp} className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Restart Now
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
