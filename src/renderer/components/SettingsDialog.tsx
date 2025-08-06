import { useState, useEffect } from 'react'
import { FolderOpen, Check, X, AlertCircle, Moon, Sun, ExternalLink } from 'lucide-react'

import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card } from './ui/card'
import { Select } from './ui/select'
import { cn } from 'renderer/lib/utils'
import { useSettingsContext } from '../contexts/SettingsContext'
import { useUIContext } from '../contexts/UIContext'
import { useTheme } from '../hooks'
import type { Theme } from 'shared/types'

export function SettingsDialog() {
  const { settings, isLoading, updateSettings, saveSettings, setGameDirectory, detectGameDirectory } = useSettingsContext()
  const { isSettingsOpen, closeSettings } = useUIContext()
  const { currentTheme, setTheme } = useTheme()
  
  const [localGameDir, setLocalGameDir] = useState('')
  const [localTheme, setLocalTheme] = useState<Theme>('dark')
  const [isDetecting, setIsDetecting] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [thumbnailsPath, setThumbnailsPath] = useState('')

  useEffect(() => {
    setLocalGameDir(settings.gameDirectory || '')
    setLocalTheme(currentTheme)
    setHasChanges(false)
    
    // Load thumbnails path
    window.electronAPI.system.getAppDataPaths().then(paths => {
      setThumbnailsPath(paths.thumbnails)
    }).catch(console.error)
  }, [settings.gameDirectory, currentTheme, isSettingsOpen])

  const handleGameDirChange = (value: string) => {
    setLocalGameDir(value)
    setHasChanges(value !== settings.gameDirectory || localTheme !== currentTheme)
  }

  const handleSelectGameDirectory = async () => {
    try {
      const selectedPath = await window.electronAPI.system.selectGameDir()
      if (selectedPath) {
        handleGameDirChange(selectedPath)
      }
    } catch (error) {
      console.error('Error selecting game directory:', error)
    }
  }

  const handleAutoDetect = async () => {
    setIsDetecting(true)
    try {
      const detectedPath = await detectGameDirectory()
      if (detectedPath) {
        handleGameDirChange(detectedPath)
      }
    } catch (error) {
      console.error('Error detecting game directory:', error)
    } finally {
      setIsDetecting(false)
    }
  }

  const handleSave = async () => {
    try {
      setGameDirectory(localGameDir)
      if (localTheme !== currentTheme) {
        setTheme(localTheme)
      }
      await saveSettings()
      setHasChanges(false)
    } catch (error) {
      console.error('Error saving settings:', error)
    }
  }

  const handleThemeChange = (theme: Theme) => {
    setLocalTheme(theme)
    setTheme(theme)
    setHasChanges(localGameDir !== settings.gameDirectory || theme !== currentTheme)
  }

  const handleSelectThumbnailDirectory = async () => {
    try {
      const selectedPath = await window.electronAPI.system.selectDirectory('Select Thumbnail Directory')
      if (selectedPath) {
        setThumbnailsPath(selectedPath)
        setHasChanges(true)
      }
    } catch (error) {
      console.error('Error selecting thumbnail directory:', error)
    }
  }

  const handleOpenModsFolder = async () => {
    if (localGameDir) {
      try {
        const modsPath = `${localGameDir}\\MarvelGame\\Marvel\\Content\\Paks\\~mods`
        await window.electronAPI.system.openFolder(modsPath)
      } catch (error) {
        console.error('Error opening mods folder:', error)
      }
    }
  }

  const handleOpenThumbnailsFolder = async () => {
    try {
      await window.electronAPI.system.openFolder(thumbnailsPath)
    } catch (error) {
      console.error('Error opening thumbnails folder:', error)
    }
  }

  const handleCancel = () => {
    setLocalGameDir(settings.gameDirectory || '')
    setLocalTheme(currentTheme)
    setHasChanges(false)
    closeSettings()
  }

  if (!isSettingsOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden animate-scale-in">
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-2rem)]">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Settings</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={closeSettings}
              className="rounded-full"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Game Directory Section */}
          <Card className="p-4 bg-muted/30 border-0">
            <div className="space-y-3">
              <div>
                <Label htmlFor="gameDirectory" className="text-lg font-semibold">
                  Marvel Rivals Installation Directory
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Select the <strong>main game folder</strong> where Marvel Rivals is installed.
                </p>
              </div>
              
              <div className="bg-background/60 border border-border/50 p-3 rounded-md">
                <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-1">⚠️ Important</p>
                <p className="text-xs text-muted-foreground">
                  Select the game directory (e.g., <code className="bg-muted px-1 rounded text-xs">C:\Program Files (x86)\Steam\steamapps\common\MarvelRivals</code>)
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>NOT</strong> the mods folder (<code className="bg-muted px-1 rounded text-xs">\~mods</code>). The app will find it automatically.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    id="gameDirectory"
                    value={localGameDir}
                    onChange={(e) => handleGameDirChange(e.target.value)}
                    placeholder="C:\Program Files (x86)\Steam\steamapps\common\MarvelRivals"
                    className="flex-1 text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleSelectGameDirectory}
                    title="Browse for game directory"
                  >
                    <FolderOpen className="w-4 h-4" />
                  </Button>
                </div>

                <Button
                  variant="outline"
                  onClick={handleAutoDetect}
                  disabled={isDetecting}
                  className="w-full text-sm"
                >
                  {isDetecting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Detecting...
                    </>
                  ) : (
                    'Auto-Detect Game Directory'
                  )}
                </Button>
              </div>

              {/* Status */}
              {localGameDir && (
                <div className="flex items-center gap-2">
                  {hasChanges ? (
                    <>
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                      <span className="text-xs text-yellow-600 dark:text-yellow-400">
                        Unsaved changes
                      </span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-green-500" />
                      <span className="text-xs text-green-600 dark:text-green-400">
                        Game directory configured
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* Expected mods path */}
              {localGameDir && (
                <div className="bg-background/60 border border-border/50 p-3 rounded-md">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <Label className="text-xs font-medium">Mods Directory:</Label>
                      <p className="text-xs text-muted-foreground mt-1 break-all">
                        {localGameDir}\MarvelGame\Marvel\Content\Paks\~mods
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleOpenModsFolder}
                      title="Open mods folder"
                      className="shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Theme Selection Section */}
          <Card className="p-4 bg-muted/30 border-0 mt-6">
            <div className="space-y-3">
              <div>
                <Label className="text-lg font-semibold">Theme</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose your preferred color theme
                </p>
              </div>

              <Select
                value={localTheme}
                onValueChange={handleThemeChange}
                options={[
                  { value: 'dark', label: '🌙 Dark' },
                  { value: 'light', label: '☀️ Light' }
                ]}
                className="w-48"
              />
            </div>
          </Card>

          {/* Thumbnail Directory Section */}
          <Card className="p-4 bg-muted/30 border-0 mt-6">
            <div className="space-y-3">
              <div>
                <Label className="text-lg font-semibold">Thumbnail Directory</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Location where mod thumbnails are stored
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={thumbnailsPath}
                    readOnly
                    placeholder="No thumbnail directory set"
                    className="flex-1 bg-muted/50 text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleSelectThumbnailDirectory}
                    title="Browse for thumbnail directory"
                  >
                    <FolderOpen className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleOpenThumbnailsFolder}
                    disabled={!thumbnailsPath}
                    title="Open thumbnails folder"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
                
                {thumbnailsPath && (
                  <div className="bg-background/60 border border-border/50 p-3 rounded-md">
                    <Label className="text-xs font-medium">Current Path:</Label>
                    <p className="text-xs text-muted-foreground mt-1 break-all">
                      {thumbnailsPath}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Footer */}
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!hasChanges || isLoading}
              className="min-w-20"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                'Save'
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}