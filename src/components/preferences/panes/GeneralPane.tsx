import React, { useEffect, useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { useGetAppSettings, useSaveAppSettings } from '@/hooks/useSettings'
import { useSyncCostumes } from '@/hooks/useMods'
import { useSkipIntros } from '@/hooks/useSkipIntros'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import { FolderOpen, HardDrive, Settings2, RefreshCw, Film, Loader2, Trash2, Check } from 'lucide-react'
import { c, tint } from '@/shared/rivals-tokens'
import { SettingsSection, SettingsCard, SettingRow } from '../settings-ui'

// Read-only / editable directory field row.
function DirRow({
  icon,
  label,
  description,
  value,
  onChange,
  readOnly,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode
  label: string
  description: string
  value: string
  onChange?: (v: string) => void
  readOnly?: boolean
  actionLabel: string
  onAction: () => void
}) {
  return (
    <div style={{ padding: '14px' }}>
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color: c.ink3, display: 'inline-flex' }}>{icon}</span>
        <span style={{ color: c.ink, fontFamily: c.font, fontSize: 13.5, fontWeight: 600 }}>{label}</span>
      </div>
      <p style={{ color: c.ink3, fontFamily: c.font, fontSize: 11.5, marginBottom: 10, paddingLeft: 22 }}>{description}</p>
      <div className="flex gap-2">
        <input
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
          className={`flex-1 outline-none rivals-mono${readOnly ? '' : ' settings-input'}`}
          style={{ padding: '7px 11px', background: c.bg, color: readOnly ? c.ink3 : c.ink, border: `1px solid ${c.line2}`, borderRadius: 7, fontSize: 12 }}
        />
        <button
          onClick={onAction}
          className="settings-btn cursor-pointer flex-shrink-0"
          style={{ padding: '7px 14px', borderRadius: 7, background: 'transparent', color: c.ink2, border: `1px solid ${c.line2}`, fontFamily: c.font, fontSize: 13 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = tint(c.accent, 14); e.currentTarget.style.color = c.accent as string; e.currentTarget.style.borderColor = tint(c.accent, 45) }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.ink2 as string; e.currentTarget.style.borderColor = c.line2 }}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  )
}

// Outlined warm-dark button (skip-intros actions).
function GhostButton({
  onClick,
  disabled,
  hue = c.accent,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  hue?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="settings-btn inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ padding: '7px 14px', borderRadius: 7, background: 'transparent', color: c.ink2, border: `1px solid ${c.line2}`, fontFamily: c.font, fontSize: 13, ['--settings-btn-hue' as never]: hue }}
      onMouseEnter={(e) => { if (disabled) return; e.currentTarget.style.background = tint(hue, 16); e.currentTarget.style.color = hue; e.currentTarget.style.borderColor = tint(hue, 45) }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.ink2 as string; e.currentTarget.style.borderColor = c.line2 }}
    >
      {children}
    </button>
  )
}

export const GeneralPane: React.FC = () => {
  const { data: settings, isLoading } = useGetAppSettings()
  const saveSettings = useSaveAppSettings()
  const syncCostumes = useSyncCostumes()
  const { status: skipIntrosStatus, install: installSkipIntros, uninstall: uninstallSkipIntros, isInstalling, isUninstalling } = useSkipIntros()

  const [gameDirectory, setGameDirectory] = useState('')
  const [autoOrganize, setAutoOrganize] = useState(true)
  const [autoDetectGameDir, setAutoDetectGameDir] = useState(true)
  const [autoCheckUpdates, setAutoCheckUpdates] = useState(true)

  useEffect(() => {
    if (settings) {
      setGameDirectory(settings.gameDirectory || '')
      setAutoOrganize(settings.autoOrganize)
      setAutoDetectGameDir(settings.autoDetectGameDir)
      setAutoCheckUpdates(settings.autoCheckUpdates)
    }
  }, [settings])

  const handleSave = async (gameDir: string, organize: boolean, autoDetect: boolean, autoUpdates: boolean) => {
    try {
      await saveSettings.mutateAsync({
        gameDirectory: gameDir || null,
        modDirectory: null,
        theme: settings?.theme || 'dark',
        autoOrganize: organize,
        autoDetectGameDir: autoDetect,
        autoCheckUpdates: autoUpdates,
      })
      toast.success('Settings saved')
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('Failed to save settings')
    }
  }

  const handleBrowseDirectory = async () => {
    try {
      const selected = await open({ directory: true, multiple: false, title: 'Select Marvel Rivals Installation Directory' })
      if (selected && typeof selected === 'string') {
        setGameDirectory(selected)
        await handleSave(selected, autoOrganize, autoDetectGameDir, autoCheckUpdates)
      }
    } catch (error) {
      console.error('Failed to open directory picker:', error)
      toast.error('Failed to open directory picker')
    }
  }

  const handleOpenModsDirectory = async () => {
    if (!gameDirectory) return
    try {
      await invoke('plugin:opener|open_path', { path: `${gameDirectory}\\MarvelGame\\Marvel\\Content\\Paks\\~mods` })
    } catch (error) {
      console.error('Failed to open mods directory:', error)
      toast.error('Failed to open mods directory')
    }
  }

  const handleSyncCostumes = () => {
    syncCostumes.mutate(undefined, {
      onSuccess: (result) => {
        const count = result.newCostumes.length
        if (count > 0) {
          toast.success(`${count} new costume${count === 1 ? '' : 's'} added`, {
            description: result.newCostumes.slice(0, 3).join(', ') + (count > 3 ? '…' : ''),
          })
        } else {
          toast.success('Costume database is up to date')
        }
      },
      onError: (error) => toast.error(`Costume sync failed: ${error.message}`),
    })
  }

  const handleOpenMetadataDirectory = async () => {
    try {
      const metadataPath = await invoke<string>('get_metadata_directory')
      await invoke('plugin:opener|open_path', { path: metadataPath })
    } catch (error) {
      console.error('Failed to open metadata directory:', error)
      toast.error('Failed to open metadata directory')
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center p-8" style={{ color: c.ink3, fontFamily: c.font }}>Loading settings…</div>
  }

  return (
    <>
      {/* Directories */}
      <SettingsSection title="Directories" icon={<FolderOpen className="w-4 h-4" />}>
        <SettingsCard>
          <DirRow
            icon={<HardDrive className="w-3.5 h-3.5" />}
            label="Game Installation"
            description="Where Marvel Rivals is installed"
            value={gameDirectory}
            onChange={setGameDirectory}
            actionLabel="Browse"
            onAction={handleBrowseDirectory}
          />
          {gameDirectory && (
            <DirRow
              icon={<FolderOpen className="w-3.5 h-3.5" />}
              label="Mods Folder"
              description="Where game mods are installed (auto-generated)"
              value={`${gameDirectory}\\MarvelGame\\Marvel\\Content\\Paks\\~mods`}
              readOnly
              actionLabel="Open"
              onAction={handleOpenModsDirectory}
            />
          )}
          <DirRow
            icon={<FolderOpen className="w-3.5 h-3.5" />}
            label="Metadata & Thumbnails"
            description="Where mod metadata and custom thumbnails are stored"
            value="AppData\Roaming\com.marvelrivalsmodmanager.app\metadata"
            readOnly
            actionLabel="Open"
            onAction={handleOpenMetadataDirectory}
          />
        </SettingsCard>
      </SettingsSection>

      {/* Behavior */}
      <div className="grid grid-cols-2 gap-8">
        <SettingsSection title="Mod Management" icon={<Settings2 className="w-4 h-4" />}>
          <SettingsCard>
            <SettingRow
              label="Auto-organize Mods"
              description="Organize mods by category when installing"
              control={<Switch checked={autoOrganize} onCheckedChange={(v) => { setAutoOrganize(v); handleSave(gameDirectory, v, autoDetectGameDir, autoCheckUpdates) }} />}
            />
            <SettingRow
              label="Auto-detect Game Directory"
              description="Find Marvel Rivals installation on startup"
              control={<Switch checked={autoDetectGameDir} onCheckedChange={(v) => { setAutoDetectGameDir(v); handleSave(gameDirectory, autoOrganize, v, autoCheckUpdates) }} />}
            />
          </SettingsCard>
        </SettingsSection>

        <SettingsSection title="Updates" icon={<RefreshCw className="w-4 h-4" />}>
          <SettingsCard>
            <SettingRow
              label="Automatic Update Checks"
              description="Check for updates when the app starts"
              control={<Switch checked={autoCheckUpdates} onCheckedChange={(v) => { setAutoCheckUpdates(v); handleSave(gameDirectory, autoOrganize, autoDetectGameDir, v) }} />}
            />
            <SettingRow
              label="Costume Database"
              description="Fetch newly released skins and icons"
              control={
                <GhostButton onClick={handleSyncCostumes} disabled={syncCostumes.isPending}>
                  {syncCostumes.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {syncCostumes.isPending ? 'Syncing…' : 'Sync Now'}
                </GhostButton>
              }
            />
          </SettingsCard>
        </SettingsSection>
      </div>

      {/* Skip Intros */}
      <SettingsSection title="Skip Intros" icon={<Film className="w-4 h-4" />}>
        <SettingsCard pad={16} className="space-y-3">
          <div className="flex items-center justify-between">
            <p style={{ color: c.ink3, fontFamily: c.font, fontSize: 12.5, maxWidth: 320 }}>
              Skip the game&apos;s intro videos for faster startup. Requires a separate download.
            </p>
            <span className="inline-flex items-center gap-1.5 rivals-mono" style={{ color: skipIntrosStatus?.installed ? c.ok : c.ink3, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {skipIntrosStatus?.installed && <Check className="h-3.5 w-3.5" />}
              {skipIntrosStatus?.installed ? 'Installed' : 'Not Installed'}
            </span>
          </div>
          <div className="flex gap-2">
            {skipIntrosStatus?.installed ? (
              <>
                <GhostButton onClick={() => installSkipIntros()} disabled={isInstalling} hue={c.accent}>
                  {isInstalling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {isInstalling ? 'Reinstalling…' : 'Reinstall (Season Update)'}
                </GhostButton>
                <GhostButton onClick={() => uninstallSkipIntros()} disabled={isUninstalling} hue={c.err}>
                  {isUninstalling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {isUninstalling ? 'Uninstalling…' : 'Uninstall'}
                </GhostButton>
              </>
            ) : (
              <GhostButton onClick={() => installSkipIntros()} disabled={isInstalling} hue={c.ok}>
                {isInstalling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
                {isInstalling ? 'Installing…' : 'Install from ZIP'}
              </GhostButton>
            )}
          </div>
        </SettingsCard>
      </SettingsSection>
    </>
  )
}
