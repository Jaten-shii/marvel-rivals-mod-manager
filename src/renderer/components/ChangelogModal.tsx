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
          version: '1.0.2',
          date: '2025-08-05',
          changes: [
            '**Live Metadata Updates** - Mod character and name changes now update immediately in the UI without requiring app restart'
          ]
        }, {
          version: '1.0.1',
          date: '2025-08-05',
          changes: [
            '**Changelog Viewer** - In-app changelog display with version history and formatted change descriptions',
            '**Version Display** - Current version shown in sidebar with clickable access to changelog',
            '**Semantic Versioning Support** - Full changelog system with proper version management'
          ]
        }, {
          version: '1.0.0',
          date: '2025-08-05',
          changes: [
            '**Seamless Mod Installation** - Drag & drop support for .pak, .zip, and .rar files',
            '**Automatic Organization** - Smart categorization by UI, Audio, Skins, and Gameplay',
            '**Character-Based Filtering** - Organize mods by 40+ Marvel Rivals characters',
            '**Real-time File Monitoring** - Automatic detection of mod directory changes',
            '**Dual Theme System** - Dark and Light themes with smooth CSS animations',
            '**Advanced UI Features** - Grid/List view modes, search, filtering, thumbnails, statistics',
            '**Professional Windows Integration** - NSIS installer with file associations and context menus',
            '**Mod Management** - Enable/disable mods, bulk operations, metadata editing',
            '**Game Integration** - Automatic Marvel Rivals game directory detection',
            '**Settings System** - Persistent configuration and preferences'
          ]
        }],
        latestVersion: '1.0.2'
      }
      console.log('ChangelogModal: Fallback data:', fallbackData)
      setChangelogData(fallbackData)
      setCurrentVersion('1.0.2')
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