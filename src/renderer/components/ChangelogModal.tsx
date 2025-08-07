import { useState, useEffect } from 'react'
import { X, Calendar, Tag } from 'lucide-react'

import { Button } from './ui/button'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { cn } from 'renderer/lib/utils'

interface ChangelogEntry {
  version: string
  date: string
  changes: string[]
}

interface ChangelogData {
  entries: ChangelogEntry[]
  latestVersion: string
}

interface ChangelogModalProps {
  isOpen: boolean
  onClose: () => void
}

// Helper function to parse markdown bold formatting
function parseMarkdownBold(text: string): JSX.Element {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          // Remove the ** and make it bold
          const boldText = part.slice(2, -2)
          return (
            <span key={index} className="font-semibold text-foreground">
              {boldText}
            </span>
          )
        }
        return <span key={index}>{part}</span>
      })}
    </>
  )
}

export function ChangelogModal({ isOpen, onClose }: ChangelogModalProps) {
  const [changelogData, setChangelogData] = useState<ChangelogData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [currentVersion, setCurrentVersion] = useState('')

  useEffect(() => {
    if (isOpen && !changelogData) {
      loadChangelog()
    }
  }, [isOpen, changelogData])

  const loadChangelog = async () => {
    setIsLoading(true)
    console.log('ChangelogModal: Loading changelog data...')
    try {
      const [changelog, appVersion] = await Promise.all([
        window.electronAPI.changelog.getChangelog(),
        window.electronAPI.changelog.getAppVersion()
      ])
      
      console.log('ChangelogModal: Received changelog data:', changelog)
      console.log('ChangelogModal: App version:', appVersion)
      console.log('ChangelogModal: Number of entries:', changelog.entries.length)
      
      changelog.entries.forEach((entry, index) => {
        console.log(`ChangelogModal: Entry ${index}: v${entry.version} with ${entry.changes.length} changes`)
        entry.changes.forEach((change, changeIndex) => {
          console.log(`ChangelogModal:   Change ${changeIndex}: ${change}`)
        })
      })
      
      setChangelogData(changelog)
      setCurrentVersion(appVersion)
    } catch (error) {
      console.error('ChangelogModal: Error loading changelog:', error)
      console.log('ChangelogModal: Using fallback data')
      // Set fallback data if loading fails
      const fallbackData = {
        entries: [{
          version: '1.2.1',
          date: '2025-08-07',
          changes: [
            '**Application Icon** - Fixed the cutoff app logo that appeared in the Windows taskbar and window title bar'
          ]
        }, {
          version: '1.2.0',
          date: '2025-08-07',
          changes: [
            '**Check for Updates** - New button in the sidebar to check for new app versions',
            '**Update Notifications** - Shows when new versions are available with download links and release notes',
            '**Update Checking** - Fixed issues that prevented checking for new versions',
            '**Error Messages** - Better error messages when update checking fails'
          ]
        }, {
          version: '1.1.2',
          date: '2025-08-07',
          changes: [
            '**Add Mod Button** - Now properly shows options to choose which mods to install from multi-mod archives',
            '**Archive Installation** - Archives with multiple mods now let you choose which ones to install instead of installing all automatically',
            '**Mod Installation** - All ways of installing mods now work the same way',
            '**User Experience** - You can now choose which mods to install from any multi-mod archive'
          ]
        }, {
          version: '1.1.1',
          date: '2025-08-06',
          changes: [
            '**Mod Selection Window** - Cleaner file names displayed when choosing which mods to install',
            '**Scrolling** - Smoother scrolling in the mod selection window',
            '**Interface** - Removed unnecessary buttons to make the interface cleaner',
            '**Visual Design** - Cleaner and easier to understand mod selection interface'
          ]
        }, {
          version: '1.1.0',
          date: '2025-08-06',
          changes: [
            '**Choose Mods to Install** - When installing archives with multiple mods, you can now pick which ones you want',
            '**Edit Multiple Mods** - Edit details for several mods in a row without having to start over each time',
            '**RAR File Support** - RAR archives with multiple mods now let you choose which ones to install',
            '**Mod Details Editing** - Fixed issues when editing details for multiple mods in sequence'
          ]
        }, {
          version: '1.0.2',
          date: '2025-08-05',
          changes: [
            '**Mod Details** - When you change a mod\'s name or character, the changes appear immediately without needing to restart the app'
          ]
        }, {
          version: '1.0.1',
          date: '2025-08-05',
          changes: [
            '**View Update History** - See what changed in each version of the app',
            '**Version Number** - Current app version is shown in the sidebar and you can click it to see update history'
          ]
        }, {
          version: '1.0.0',
          date: '2025-08-05',
          changes: [
            '**Easy Mod Installation** - Install mods by dragging and dropping .pak, .zip, and .rar files',
            '**Automatic Organization** - Mods are automatically sorted into categories (UI, Audio, Skins, Gameplay)',
            '**Character Filtering** - Filter and organize mods by Marvel Rivals characters',
            '**Auto-Detection** - Automatically detects when mods are added or removed from your mod folder',
            '**Dark and Light Themes** - Choose between dark and light app themes',
            '**Multiple Views** - Switch between grid and list views, search and filter mods, see mod thumbnails and stats',
            '**Windows Integration** - Easy installation, file associations, and right-click context menus',
            '**Mod Management** - Enable/disable mods, edit mod details, and perform bulk operations',
            '**Game Detection** - Automatically finds your Marvel Rivals game installation',
            '**Settings** - Customizable preferences and configuration options'
          ]
        }],
        latestVersion: '1.2.1'
      }
      console.log('ChangelogModal: Fallback data:', fallbackData)
      setChangelogData(fallbackData)
      setCurrentVersion('1.1.2')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string): string => {
    try {
      // Parse date components manually to avoid timezone issues
      const parts = dateString.split('-')
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10)
        const month = parseInt(parts[1], 10) - 1 // Month is 0-indexed
        const day = parseInt(parts[2], 10)
        const date = new Date(year, month, day)
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      }
      return dateString
    } catch {
      return dateString
    }
  }

  const getVersionBadgeVariant = (version: string) => {
    if (version === currentVersion) {
      return 'default' // Current version
    }
    return 'outline' // Older versions
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <Card className="w-full max-w-3xl max-h-[85vh] overflow-hidden animate-scale-in">
        <div className="flex flex-col h-full max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">Changelog</h2>
              {currentVersion && (
                <Badge variant="default" className="text-xs">
                  v{currentVersion}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full hover:bg-accent/50"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-3">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm text-muted-foreground">Loading changelog...</p>
                </div>
              </div>
            ) : changelogData ? (
              <div className="space-y-6">
                {changelogData.entries.map((entry, index) => (
                  <Card 
                    key={`${entry.version}-${index}`}
                    className={cn(
                      "p-5 border transition-all duration-200",
                      entry.version === currentVersion 
                        ? "border-primary/30 bg-primary/5" 
                        : "border-border bg-card"
                    )}
                  >
                    {/* Version Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-primary" />
                          <h3 className="text-lg font-semibold">
                            Version {entry.version}
                          </h3>
                        </div>
                        <Badge 
                          variant={getVersionBadgeVariant(entry.version)}
                          className="text-xs"
                        >
                          {entry.version === currentVersion ? 'Current' : 'Previous'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        {formatDate(entry.date)}
                      </div>
                    </div>

                    {/* Changes List */}
                    <div className="space-y-2">
                      {entry.changes.length === 0 ? (
                        <div className="text-sm text-muted-foreground italic">
                          No changes listed for this version
                        </div>
                      ) : (
                        entry.changes.map((change, changeIndex) => {
                          return (
                            <div 
                              key={changeIndex}
                              className="flex items-start gap-3 text-sm"
                            >
                              <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 shrink-0" />
                              <div className="flex-1">
                                {change.includes(' - ') ? (
                                  <div>
                                    <span className="font-medium text-foreground">
                                      {parseMarkdownBold(change.split(' - ')[0])}
                                    </span>
                                    <span className="text-muted-foreground">
                                      {' - '}
                                      {parseMarkdownBold(change.split(' - ').slice(1).join(' - '))}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="text-foreground">{parseMarkdownBold(change)}</div>
                                )}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </Card>
                ))}

                {/* Footer Info */}
                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground text-center">
                    Marvel Rivals Mod Manager follows{' '}
                    <button
                      onClick={() => window.electronAPI.system.openExternal('https://semver.org')}
                      className="text-primary hover:underline"
                    >
                      Semantic Versioning
                    </button>
                    {' • '}
                    <span>Major.Minor.Patch (e.g., 1.2.3)</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Unable to load changelog data
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadChangelog}
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}