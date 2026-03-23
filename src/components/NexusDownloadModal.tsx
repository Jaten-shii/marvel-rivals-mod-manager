import { Download, CheckCircle2, AlertCircle, Loader2, X, ExternalLink } from 'lucide-react';
import type { NxmDownloadStatus } from '../hooks/useNexusMods';

interface NexusDownloadModalProps {
  status: NxmDownloadStatus;
  modName: string;
  progress: number;
  error: string;
  onDismiss: () => void;
}

export function NexusDownloadModal({ status, modName, progress, error, onDismiss }: NexusDownloadModalProps) {
  if (status === 'idle') return null;

  const statusConfig = {
    'fetching-info': {
      icon: <Loader2 className="w-7 h-7 animate-spin text-orange-400" />,
      label: 'Fetching mod info...',
      sublabel: 'Connecting to Nexus Mods API',
    },
    'downloading': {
      icon: <Download className="w-7 h-7 text-orange-400" style={{ animation: 'metadata-fade-in 300ms ease-out both' }} />,
      label: 'Downloading...',
      sublabel: 'Fetching from Nexus CDN',
    },
    'installing': {
      icon: <Loader2 className="w-7 h-7 animate-spin text-amber-400" />,
      label: 'Installing...',
      sublabel: 'Extracting and setting up mod',
    },
    'done': {
      icon: <CheckCircle2 className="w-7 h-7 text-green-400" />,
      label: 'Download Complete',
      sublabel: 'Mod is ready to configure',
    },
    'error': {
      icon: <AlertCircle className="w-7 h-7 text-red-400" />,
      label: 'Download Failed',
      sublabel: 'Something went wrong',
    },
  };

  const config = statusConfig[status];
  const isActive = status === 'fetching-info' || status === 'downloading' || status === 'installing';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[99] bg-black/40 backdrop-blur-[3px]" />

      {/* Modal */}
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{ animation: 'metadata-fade-in 250ms ease-out both' }}
      >
        <div className="w-[520px] bg-card rounded-2xl shadow-[0_12px_50px_rgba(0,0,0,0.6)] overflow-hidden" style={{ animation: 'icon-pop-in 350ms ease-out both' }}>

          {/* Nexus branding header */}
          <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />

          {/* Header */}
          <div className="px-6 pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-orange-400/80 font-medium uppercase tracking-wider">
                <ExternalLink className="w-3.5 h-3.5" />
                Nexus Mods
              </div>
              {(status === 'done' || status === 'error') && (
                <button
                  onClick={onDismiss}
                  className="p-1.5 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Separator */}
          <div className="mx-6 h-px bg-border/30" />

          {/* Content */}
          <div className="px-6 py-5">
            <div className="flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  status === 'done' ? 'bg-green-500/10' :
                  status === 'error' ? 'bg-red-500/10' :
                  'bg-orange-500/10'
                }`}
                style={{ animation: 'icon-pop-in 400ms ease-out 100ms both' }}
              >
                {config.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-foreground truncate" style={{ animation: 'metadata-fade-in 300ms ease-out 150ms both' }}>
                  {modName}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5" style={{ animation: 'metadata-fade-in 300ms ease-out 200ms both' }}>
                  {config.label}
                </p>
              </div>
            </div>

            {/* Progress section */}
            {isActive && (
              <div className="mt-5" style={{ animation: 'metadata-fade-in 300ms ease-out 250ms both' }}>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>{config.sublabel}</span>
                  <span className="font-bold text-foreground text-sm tabular-nums">{progress}%</span>
                </div>
                <div className="w-full h-2.5 bg-muted/20 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      status === 'installing'
                        ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                        : 'bg-gradient-to-r from-orange-500 to-amber-400'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {/* Step indicators */}
                <div className="flex items-center gap-3 mt-3">
                  <StepDot active={status === 'fetching-info'} done={status !== 'fetching-info'} label="Fetch" />
                  <div className="flex-1 h-px bg-border/30" />
                  <StepDot active={status === 'downloading'} done={status === 'installing'} label="Download" />
                  <div className="flex-1 h-px bg-border/30" />
                  <StepDot active={status === 'installing'} done={false} label="Install" />
                </div>
              </div>
            )}

            {/* Done state */}
            {status === 'done' && (
              <div className="mt-4 p-3 rounded-xl bg-green-500/5 border border-green-500/10" style={{ animation: 'metadata-fade-in 300ms ease-out both' }}>
                <p className="text-sm text-green-400">{config.sublabel}</p>
              </div>
            )}

            {/* Error state */}
            {status === 'error' && (
              <div className="mt-4 space-y-3" style={{ animation: 'metadata-fade-in 300ms ease-out both' }}>
                <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                  <p className="text-sm text-red-400 break-words">{error}</p>
                </div>
                <button
                  onClick={onDismiss}
                  className="w-full h-9 text-sm rounded-xl bg-muted/20 text-foreground hover:bg-muted/30 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>

          {/* Bottom branding */}
          <div className="h-0.5 bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
        </div>
      </div>
    </>
  );
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
        active ? 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.5)]' :
        done ? 'bg-orange-400/50' :
        'bg-muted/30'
      }`} />
      <span className={`text-[10px] transition-colors ${
        active ? 'text-orange-400 font-medium' :
        done ? 'text-muted-foreground' :
        'text-muted-foreground/40'
      }`}>{label}</span>
    </div>
  );
}
