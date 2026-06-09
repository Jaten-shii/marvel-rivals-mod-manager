import { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { useUIStore } from '../stores';
import { useUpdater } from '../hooks/useUpdater';
import { Download, RefreshCw, Loader2, CheckCircle2, Sparkles, ArrowUp } from 'lucide-react';
import { c, tint } from '../shared/rivals-tokens';
import { renderChangelog } from './changelog-markdown';

function formatDate(dateString: string) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function UpdateDialog() {
  const { updateDialogOpen, setUpdateDialogOpen } = useUIStore();
  const { isChecking, isDownloading, downloadProgress, availableUpdate, currentVersion, checkForUpdates, downloadAndInstall, restartApp } = useUpdater();

  const hasCheckedInDialog = useRef(false);

  useEffect(() => {
    if (updateDialogOpen) hasCheckedInDialog.current = false;
  }, [updateDialogOpen]);

  useEffect(() => {
    if (updateDialogOpen && !availableUpdate && !isChecking && !hasCheckedInDialog.current) {
      hasCheckedInDialog.current = true;
      checkForUpdates(false);
    }
  }, [updateDialogOpen, availableUpdate, isChecking]);

  const updateInstalled = downloadProgress === 100 && !isDownloading;

  const primaryBtn = (label: React.ReactNode, onClick?: () => void, disabled?: boolean) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn-primary inline-flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      style={{ padding: '9px 16px', borderRadius: 9, background: c.accent, color: c.onAccent, border: 'none', fontFamily: c.font, fontSize: 13, fontWeight: 600 }}
    >
      {label}
    </button>
  );

  const ghostBtn = (label: string, onClick: () => void) => (
    <button
      onClick={onClick}
      className="btn-outline cursor-pointer"
      style={{ padding: '9px 16px', borderRadius: 9, background: 'transparent', color: c.ink2, border: `1px solid ${c.line2}`, fontFamily: c.font, fontSize: 13, fontWeight: 600 }}
    >
      {label}
    </button>
  );

  return (
    <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
      <DialogContent
        className="!max-w-2xl w-[85vw] p-0 gap-0 overflow-hidden"
        style={{ background: c.bg, border: `1px solid ${c.line2}`, borderRadius: 16 }}
      >
        {/* Header */}
        <div className="flex items-center gap-3" style={{ padding: '20px 24px', borderBottom: `1px solid ${c.line}`, background: c.panel }}>
          <div className="grid place-items-center" style={{ width: 40, height: 40, borderRadius: 10, background: tint(c.accent, 14), color: c.accent }}>
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <DialogTitle asChild>
              <h2 className="rivals-display" style={{ color: c.ink, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>Check for Updates</h2>
            </DialogTitle>
            <DialogDescription asChild>
              <p className="rivals-mono" style={{ color: c.ink3, fontSize: 11.5, marginTop: 2 }}>Current version · v{currentVersion}</p>
            </DialogDescription>
          </div>
        </div>

        {/* Checking */}
        {isChecking && (
          <div className="flex flex-col items-center justify-center gap-4" style={{ padding: '64px 24px', animation: 'metadata-fade-in 300ms ease-out both' }}>
            <div className="grid place-items-center" style={{ width: 80, height: 80, borderRadius: 20, background: tint(c.accent, 12) }}>
              <Loader2 className="w-10 h-10 animate-spin" style={{ color: c.accent }} />
            </div>
            <p style={{ color: c.ink3, fontFamily: c.font, fontSize: 13 }}>Checking for updates…</p>
          </div>
        )}

        {/* Up to date */}
        {!isChecking && !availableUpdate && !updateInstalled && (
          <div className="flex flex-col items-center justify-center gap-5" style={{ padding: '56px 24px' }}>
            <div className="grid place-items-center" style={{ width: 80, height: 80, borderRadius: 20, background: tint(c.ok, 12), animation: 'icon-pop-in 400ms ease-out both' }}>
              <CheckCircle2 className="w-10 h-10" style={{ color: c.ok }} />
            </div>
            <div className="text-center">
              <h3 className="rivals-display" style={{ color: c.ink, fontSize: 20, fontWeight: 600 }}>You&apos;re up to date</h3>
              <p style={{ color: c.ink3, fontFamily: c.font, fontSize: 13, marginTop: 4 }}>Running the latest version.</p>
            </div>
            {primaryBtn(<><RefreshCw className="btn-glyph w-4 h-4" /> Check Again</>, () => checkForUpdates())}
          </div>
        )}

        {/* Update available */}
        {!isChecking && availableUpdate && !updateInstalled && (
          <div>
            {/* Banner */}
            <div className="flex items-center gap-3.5" style={{ margin: '20px 24px 0', padding: 16, borderRadius: 12, background: tint(c.accent, 10), border: `1px solid ${tint(c.accent, 25)}`, animation: 'metadata-fade-in 340ms ease-out both' }}>
              <div className="grid place-items-center flex-shrink-0 update-pill" style={{ width: 48, height: 48, borderRadius: 12, background: c.accent2, color: '#fff' }}>
                <span className="update-arrow"><ArrowUp className="w-6 h-6" strokeWidth={2.5} /></span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="rivals-display flex items-center gap-2" style={{ color: c.ink, fontSize: 19, fontWeight: 600 }}>
                  v{availableUpdate.version} available
                  <Sparkles className="w-4 h-4" style={{ color: c.accent }} />
                </h3>
                {availableUpdate.date && (
                  <p className="rivals-mono" style={{ color: c.ink3, fontSize: 11, marginTop: 2 }}>Released {formatDate(availableUpdate.date)}</p>
                )}
              </div>
            </div>

            {/* Changelog */}
            {availableUpdate.body && (
              <div style={{ padding: '16px 24px 0', animation: 'metadata-fade-in 340ms ease-out 120ms both' }}>
                <h4 className="rivals-mono" style={{ color: c.ink3, fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>What&apos;s New</h4>
                <ScrollArea type="always" className="sidebar-scroll" style={{ height: 210 }}>
                  <div style={{ background: c.panel, border: `1px solid ${c.line}`, borderRadius: 12, padding: 16, marginRight: 8 }}>
                    {renderChangelog(availableUpdate.body, true)}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Download progress */}
            {isDownloading && (
              <div style={{ padding: '16px 24px 0' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                  <span style={{ color: c.ink3, fontFamily: c.font, fontSize: 13 }}>Downloading…</span>
                  <span className="rivals-mono" style={{ color: c.ink, fontSize: 13, fontWeight: 600 }}>{downloadProgress}%</span>
                </div>
                <div style={{ height: 8, background: c.line, borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${downloadProgress}%`, height: '100%', background: c.accent, transition: 'width .3s ease' }} />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5" style={{ padding: '20px 24px', animation: 'metadata-fade-in 340ms ease-out 240ms both' }}>
              {ghostBtn('Later', () => setUpdateDialogOpen(false))}
              {isDownloading
                ? primaryBtn(<><Loader2 className="w-4 h-4 animate-spin" /> Downloading…</>, undefined, true)
                : primaryBtn(<><Download className="btn-glyph w-4 h-4" /> Download &amp; Install</>, downloadAndInstall)}
            </div>
          </div>
        )}

        {/* Installed */}
        {updateInstalled && (
          <div className="flex flex-col items-center justify-center gap-5" style={{ padding: '56px 24px' }}>
            <div className="grid place-items-center" style={{ width: 80, height: 80, borderRadius: 20, background: tint(c.ok, 12), animation: 'icon-pop-in 400ms ease-out both' }}>
              <CheckCircle2 className="w-10 h-10" style={{ color: c.ok }} />
            </div>
            <div className="text-center">
              <h3 className="rivals-display" style={{ color: c.ink, fontSize: 20, fontWeight: 600 }}>Update installed</h3>
              <p style={{ color: c.ink3, fontFamily: c.font, fontSize: 13, marginTop: 4 }}>Restart to apply the update.</p>
            </div>
            <div className="flex items-center gap-2.5">
              {ghostBtn('Later', () => setUpdateDialogOpen(false))}
              {primaryBtn(<><RefreshCw className="btn-glyph w-4 h-4" /> Restart Now</>, restartApp)}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
