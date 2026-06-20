import { Download, CheckCircle2, AlertCircle, Loader2, X, ExternalLink } from 'lucide-react'
import type { NxmDownloadStatus } from '../hooks/useNexusMods'
import { c, tint } from '../shared/rivals-tokens'

// Nexus Mods brand orange, kept on purpose so the source is recognizable
const NEXUS = '#f97316'
const NEXUS_LIGHT = '#fbbf24'

interface NexusDownloadModalProps {
  status: NxmDownloadStatus
  modName: string
  progress: number
  error: string
  onDismiss: () => void
}

export function NexusDownloadModal({ status, modName, progress, error, onDismiss }: NexusDownloadModalProps) {
  if (status === 'idle') return null

  const statusConfig = {
    'fetching-info': {
      icon: <Loader2 className="w-7 h-7 animate-spin" style={{ color: NEXUS }} />,
      label: 'Fetching mod info…',
      sublabel: 'Connecting to Nexus Mods API',
      tile: tint(NEXUS, 14),
    },
    downloading: {
      icon: <Download className="w-7 h-7 dz-bob" style={{ color: NEXUS }} />,
      label: 'Downloading…',
      sublabel: 'Fetching from Nexus CDN',
      tile: tint(NEXUS, 14),
    },
    installing: {
      icon: <Loader2 className="w-7 h-7 animate-spin" style={{ color: NEXUS_LIGHT }} />,
      label: 'Installing…',
      sublabel: 'Extracting and setting up mod',
      tile: tint(NEXUS_LIGHT, 14),
    },
    done: {
      icon: <CheckCircle2 className="w-7 h-7" style={{ color: c.ok }} />,
      label: 'Download Complete',
      sublabel: 'Mod is ready to configure',
      tile: tint(c.ok, 14),
    },
    error: {
      icon: <AlertCircle className="w-7 h-7" style={{ color: c.err }} />,
      label: 'Download Failed',
      sublabel: 'Something went wrong',
      tile: tint(c.err, 14),
    },
  }

  const config = statusConfig[status]
  const isActive = status === 'fetching-info' || status === 'downloading' || status === 'installing'

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[99]" style={{ background: 'color-mix(in oklch, black 45%, transparent)', backdropFilter: 'blur(4px)' }} />

      {/* Modal */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ animation: 'metadata-fade-in 250ms ease-out both' }}>
        <div
          className="w-[520px] overflow-hidden"
          style={{
            background: c.bg,
            border: `1px solid ${c.line2}`,
            borderRadius: 16,
            boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.7)',
            animation: 'icon-pop-in 350ms ease-out both',
          }}
        >
          {/* Nexus brand strip */}
          <div style={{ height: 3, background: `linear-gradient(90deg, ${NEXUS}, ${NEXUS_LIGHT}, ${NEXUS})` }} />

          {/* Header */}
          <div className="flex items-center justify-between" style={{ padding: '14px 22px', background: c.panel, borderBottom: `1px solid ${c.line}` }}>
            <span
              className="rivals-mono inline-flex items-center gap-2"
              style={{ color: NEXUS, fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase' }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Nexus Mods
            </span>
            {(status === 'done' || status === 'error') && (
              <button
                onClick={onDismiss}
                className="grid place-items-center cursor-pointer transition-colors"
                style={{ width: 30, height: 30, borderRadius: 7, color: c.ink3 }}
                onMouseEnter={e => { e.currentTarget.style.color = c.ink as string; e.currentTarget.style.background = c.panelHi }}
                onMouseLeave={e => { e.currentTarget.style.color = c.ink3 as string; e.currentTarget.style.background = 'transparent' }}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Content */}
          <div style={{ padding: '20px 22px 22px' }}>
            <div className="flex items-center gap-4">
              <div
                className="grid place-items-center flex-shrink-0"
                style={{ width: 56, height: 56, borderRadius: 14, background: config.tile, border: `1px solid ${c.line2}`, animation: 'icon-pop-in 400ms ease-out 100ms both' }}
              >
                {config.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate"
                  style={{ color: c.ink, fontFamily: c.font, fontSize: 16, fontWeight: 700, animation: 'metadata-fade-in 300ms ease-out 150ms both' }}
                >
                  {modName}
                </p>
                <p style={{ color: c.ink3, fontFamily: c.font, fontSize: 13, marginTop: 2, animation: 'metadata-fade-in 300ms ease-out 200ms both' }}>
                  {config.label}
                </p>
              </div>
            </div>

            {/* Progress section */}
            {isActive && (
              <div style={{ marginTop: 20, animation: 'metadata-fade-in 300ms ease-out 250ms both' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                  <span className="rivals-mono" style={{ color: c.ink3, fontSize: 11 }}>{config.sublabel}</span>
                  <span className="rivals-mono tabular-nums" style={{ color: c.ink, fontSize: 13, fontWeight: 600 }}>{progress}%</span>
                </div>
                <div className="w-full overflow-hidden" style={{ height: 10, borderRadius: 999, background: c.panelHi, border: `1px solid ${c.line}` }}>
                  <div
                    className="h-full nx-bar"
                    style={{
                      width: `${progress}%`,
                      borderRadius: 999,
                      background: status === 'installing'
                        ? `linear-gradient(90deg, ${NEXUS_LIGHT}, ${NEXUS})`
                        : `linear-gradient(90deg, ${NEXUS}, ${NEXUS_LIGHT})`,
                      transition: 'width 700ms cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  />
                </div>
                {/* Step indicators */}
                <div className="flex items-center gap-3" style={{ marginTop: 14 }}>
                  <StepDot active={status === 'fetching-info'} done={status !== 'fetching-info'} label="Fetch" />
                  <div className="flex-1" style={{ height: 1, background: c.line }} />
                  <StepDot active={status === 'downloading'} done={status === 'installing'} label="Download" />
                  <div className="flex-1" style={{ height: 1, background: c.line }} />
                  <StepDot active={status === 'installing'} done={false} label="Install" />
                </div>
              </div>
            )}

            {/* Done state */}
            {status === 'done' && (
              <div
                style={{ marginTop: 16, padding: '11px 14px', borderRadius: 10, background: tint(c.ok, 8), border: `1px solid ${tint(c.ok, 25)}`, animation: 'metadata-fade-in 300ms ease-out both' }}
              >
                <p style={{ color: c.ok, fontFamily: c.font, fontSize: 13 }}>{config.sublabel}</p>
              </div>
            )}

            {/* Error state */}
            {status === 'error' && (
              <div className="space-y-3" style={{ marginTop: 16, animation: 'metadata-fade-in 300ms ease-out both' }}>
                <div style={{ padding: '11px 14px', borderRadius: 10, background: tint(c.err, 8), border: `1px solid ${tint(c.err, 25)}` }}>
                  <p className="break-words" style={{ color: c.err, fontFamily: c.font, fontSize: 13 }}>{error}</p>
                </div>
                <button
                  onClick={onDismiss}
                  className="btn-outline w-full cursor-pointer"
                  style={{ padding: '9px 0', borderRadius: 9, background: 'transparent', color: c.ink2, border: `1px solid ${c.line2}`, fontFamily: c.font, fontSize: 13, fontWeight: 600 }}
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  const dotColor = active ? NEXUS : done ? tint(NEXUS, 50) : c.muted
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="rounded-full transition-all duration-300"
        style={{ width: 8, height: 8, background: dotColor, boxShadow: active ? `0 0 10px ${tint(NEXUS, 60)}` : 'none' }}
      />
      <span
        className="rivals-mono transition-colors"
        style={{ fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: active ? NEXUS : done ? c.ink3 : c.muted, fontWeight: active ? 600 : 400 }}
      >
        {label}
      </span>
    </div>
  )
}
