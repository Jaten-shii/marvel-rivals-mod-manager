import React, { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useGetAppSettings, useSaveAppSettings } from '@/hooks/useSettings'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import { FolderOpen, HardDrive, Settings2, RefreshCw } from 'lucide-react'

const SettingsSection: React.FC<{
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}> = ({ title, icon, children }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 px-1">
      {icon && <span className="text-muted-foreground/70">{icon}</span>}
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
    </div>
    <div className="space-y-2">{children}</div>
  </div>
)

const ToggleRow: React.FC<{
  id: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}> = ({ id, label, description, checked, onCheckedChange }) => (
  <div className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-muted/30 transition-colors">
    <div className="space-y-0.5">
      <Label htmlFor={id} className="text-sm font-medium text-foreground cursor-pointer">
        {label}
      </Label>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
  </div>
)

export const GeneralPane: React.FC = () => {
  const { data: settings, isLoading } = useGetAppSettings()
  const saveSettings = useSaveAppSettings()

  const [gameDirectory, setGameDirectory] = useState('')
  const [autoOrganize, setAutoOrganize] = useState(true)
  const [autoDetectGameDir, setAutoDetectGameDir] = useState(true)
  const [autoCheckUpdates, setAutoCheckUpdates] = useState(true)

  // Sync local state with loaded settings
  useEffect(() => {
    if (settings) {
      setGameDirectory(settings.gameDirectory || '')
      setAutoOrganize(settings.autoOrganize)
      setAutoDetectGameDir(settings.autoDetectGameDir)
      setAutoCheckUpdates(settings.autoCheckUpdates)
    }
  }, [settings])

  const handleBrowseDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Marvel Rivals Installation Directory',
      })

      if (selected && typeof selected === 'string') {
        setGameDirectory(selected)
        await handleSave(selected, autoOrganize, autoDetectGameDir, autoCheckUpdates)
      }
    } catch (error) {
      console.error('Failed to open directory picker:', error)
      toast.error('Failed to open directory picker')
    }
  }

  const handleSave = async (
    gameDir: string,
    organize: boolean,
    autoDetect: boolean,
    autoUpdates: boolean
  ) => {
    try {
      await saveSettings.mutateAsync({
        gameDirectory: gameDir || null,
        modDirectory: null,
        theme: settings?.theme || 'dark',
        autoOrganize: organize,
        autoDetectGameDir: autoDetect,
        autoCheckUpdates: autoUpdates,
      })
      toast.success('Settings saved successfully')
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('Failed to save settings')
    }
  }

  const handleToggleAutoOrganize = async (checked: boolean) => {
    setAutoOrganize(checked)
    await handleSave(gameDirectory, checked, autoDetectGameDir, autoCheckUpdates)
  }

  const handleToggleAutoDetect = async (checked: boolean) => {
    setAutoDetectGameDir(checked)
    await handleSave(gameDirectory, autoOrganize, checked, autoCheckUpdates)
  }

  const handleToggleAutoCheckUpdates = async (checked: boolean) => {
    setAutoCheckUpdates(checked)
    await handleSave(gameDirectory, autoOrganize, autoDetectGameDir, checked)
  }

  const handleOpenModsDirectory = async () => {
    if (!gameDirectory) return

    try {
      const modsPath = `${gameDirectory}\\MarvelGame\\Marvel\\Content\\Paks\\~mods`
      // Use Tauri opener plugin
      await invoke('plugin:opener|open_path', { path: modsPath })
    } catch (error) {
      console.error('Failed to open mods directory:', error)
      toast.error('Failed to open mods directory')
    }
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
    return <div className="flex items-center justify-center p-8 text-muted-foreground">Loading settings...</div>
  }

  return (
    <div className="space-y-8">
      {/* Directories Section */}
      <SettingsSection title="Directories" icon={<FolderOpen className="w-4 h-4" />}>
        <div className="space-y-1 rounded-xl bg-muted/20 p-1">
          {/* Game Directory */}
          <div className="p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <HardDrive className="w-3.5 h-3.5 text-muted-foreground/70" />
              <Label className="text-sm font-medium text-foreground">Game Installation</Label>
            </div>
            <p className="text-xs text-muted-foreground mb-3 pl-5.5">
              Where Marvel Rivals is installed
            </p>
            <div className="flex gap-2">
              <Input
                value={gameDirectory}
                onChange={e => setGameDirectory(e.target.value)}
                placeholder="C:\Program Files (x86)\Steam\steamapps\common\MarvelRivals"
                className="flex-1 text-sm"
              />
              <Button onClick={handleBrowseDirectory} variant="outline" size="sm">
                Browse
              </Button>
            </div>
          </div>

          {/* Mods Directory - only show if game directory is set */}
          {gameDirectory && (
            <div className="p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <FolderOpen className="w-3.5 h-3.5 text-muted-foreground/70" />
                <Label className="text-sm font-medium text-foreground">Mods Folder</Label>
              </div>
              <p className="text-xs text-muted-foreground mb-3 pl-5.5">
                Where game mods are installed (auto-generated from game directory)
              </p>
              <div className="flex gap-2">
                <Input
                  value={`${gameDirectory}\\MarvelGame\\Marvel\\Content\\Paks\\~mods`}
                  readOnly
                  className="flex-1 text-sm bg-muted/30 text-muted-foreground"
                />
                <Button onClick={handleOpenModsDirectory} variant="outline" size="sm">
                  Open
                </Button>
              </div>
            </div>
          )}

          {/* Metadata Directory */}
          <div className="p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <FolderOpen className="w-3.5 h-3.5 text-muted-foreground/70" />
              <Label className="text-sm font-medium text-foreground">Metadata & Thumbnails</Label>
            </div>
            <p className="text-xs text-muted-foreground mb-3 pl-5.5">
              Where mod metadata and custom thumbnails are stored
            </p>
            <div className="flex gap-2">
              <Input
                value="AppData\Roaming\com.marvelrivalsmodmanager.app\metadata"
                readOnly
                className="flex-1 text-sm bg-muted/30 text-muted-foreground italic"
              />
              <Button onClick={handleOpenMetadataDirectory} variant="outline" size="sm">
                Open
              </Button>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Behavior Section - Side by side toggles */}
      <div className="grid grid-cols-2 gap-8">
        <SettingsSection title="Mod Management" icon={<Settings2 className="w-4 h-4" />}>
          <div className="rounded-xl bg-muted/20 p-1">
            <ToggleRow
              id="auto-organize"
              label="Auto-organize Mods"
              description="Organize mods by category when installing"
              checked={autoOrganize}
              onCheckedChange={handleToggleAutoOrganize}
            />
            <ToggleRow
              id="auto-detect"
              label="Auto-detect Game Directory"
              description="Find Marvel Rivals installation on startup"
              checked={autoDetectGameDir}
              onCheckedChange={handleToggleAutoDetect}
            />
          </div>
        </SettingsSection>

        <SettingsSection title="Updates" icon={<RefreshCw className="w-4 h-4" />}>
          <div className="rounded-xl bg-muted/20 p-1">
            <ToggleRow
              id="auto-check-updates"
              label="Automatic Update Checks"
              description="Check for updates when the app starts"
              checked={autoCheckUpdates}
              onCheckedChange={handleToggleAutoCheckUpdates}
            />
          </div>
        </SettingsSection>
      </div>
    </div>
  )
}
