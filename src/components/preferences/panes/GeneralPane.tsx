import React, { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useGetAppSettings, useSaveAppSettings } from '@/hooks/useSettings'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'

const SettingsField: React.FC<{
  label: string
  children: React.ReactNode
  description?: string
}> = ({ label, children, description }) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium text-foreground">{label}</Label>
    {children}
    {description && (
      <p className="text-sm text-muted-foreground">{description}</p>
    )}
  </div>
)

const SettingsSection: React.FC<{
  title: string
  children: React.ReactNode
}> = ({ title, children }) => (
  <div className="space-y-4">
    <div>
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      <Separator className="mt-2" />
    </div>
    <div className="space-y-4">{children}</div>
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
    return <div>Loading settings...</div>
  }

  return (
    <div className="space-y-6">
      <SettingsSection title="Marvel Rivals Configuration">
        <SettingsField
          label="Game Installation Directory"
          description="The directory where Marvel Rivals is installed. Default: C:\Program Files (x86)\Steam\steamapps\common\MarvelRivals"
        >
          <div className="flex gap-2">
            <Input
              value={gameDirectory}
              onChange={e => setGameDirectory(e.target.value)}
              placeholder="Select game directory..."
              className="flex-1"
            />
            <Button onClick={handleBrowseDirectory} variant="outline">
              Browse
            </Button>
          </div>
        </SettingsField>

        {gameDirectory && (
          <SettingsField
            label="Mods Directory"
            description="The directory where mods are stored (read-only, based on game directory)"
          >
            <div className="flex gap-2">
              <Input
                value={`${gameDirectory}\\MarvelGame\\Marvel\\Content\\Paks\\~mods`}
                readOnly
                className="flex-1 bg-muted/50"
              />
              <Button onClick={handleOpenModsDirectory} variant="outline">
                Open
              </Button>
            </div>
          </SettingsField>
        )}

        <SettingsField
          label="Metadata & Thumbnails Directory"
          description="Where mod metadata and custom thumbnails are stored"
        >
          <div className="flex gap-2">
            <Input
              value="C:\\Users\\{username}\\AppData\\Roaming\\com.marvelrivalsmodmanager.app\\metadata"
              readOnly
              className="flex-1 bg-muted/50 text-muted-foreground italic"
            />
            <Button onClick={handleOpenMetadataDirectory} variant="outline">
              Open
            </Button>
          </div>
        </SettingsField>
      </SettingsSection>

      <SettingsSection title="Mod Management">
        <SettingsField
          label="Auto-organize Mods"
          description="Automatically organize mods by category when installing"
        >
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-organize"
              checked={autoOrganize}
              onCheckedChange={handleToggleAutoOrganize}
            />
            <Label htmlFor="auto-organize" className="text-sm">
              {autoOrganize ? 'Enabled' : 'Disabled'}
            </Label>
          </div>
        </SettingsField>

        <SettingsField
          label="Auto-detect Game Directory"
          description="Automatically detect Marvel Rivals installation on startup"
        >
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-detect"
              checked={autoDetectGameDir}
              onCheckedChange={handleToggleAutoDetect}
            />
            <Label htmlFor="auto-detect" className="text-sm">
              {autoDetectGameDir ? 'Enabled' : 'Disabled'}
            </Label>
          </div>
        </SettingsField>
      </SettingsSection>

      <SettingsSection title="Updates">
        <SettingsField
          label="Automatic Update Checks"
          description="Automatically check for updates when the app starts (use 'App Version' in sidebar to manually check)"
        >
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-check-updates"
              checked={autoCheckUpdates}
              onCheckedChange={handleToggleAutoCheckUpdates}
            />
            <Label htmlFor="auto-check-updates" className="text-sm">
              {autoCheckUpdates ? 'Enabled' : 'Disabled'}
            </Label>
          </div>
        </SettingsField>
      </SettingsSection>
    </div>
  )
}
