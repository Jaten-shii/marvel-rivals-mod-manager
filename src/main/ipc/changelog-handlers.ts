import { ipcMain, app } from 'electron'
import { promises as fs } from 'node:fs'
import { join, dirname } from 'node:path'

export interface ChangelogEntry {
  version: string
  date: string
  changes: string[]
}

export interface ChangelogData {
  entries: ChangelogEntry[]
  latestVersion: string
}

export function registerChangelogHandlers(): void {
  // Get changelog data
  ipcMain.handle('changelog:getChangelog', async (): Promise<ChangelogData> => {
    console.log('Changelog requested via IPC')
    try {
      const changelogContent = await readChangelogFile()
      console.log('Successfully read changelog file, content preview:', changelogContent.substring(0, 200) + '...')
      const parsedData = parseChangelog(changelogContent)
      console.log('Successfully parsed changelog:', parsedData.entries.length, 'entries')
      return parsedData
    } catch (error) {
      console.error('Error reading/parsing changelog:', error)
      console.log('Using fallback changelog data')
      // Return fallback data if changelog can't be read
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
      console.log('Fallback data:', fallbackData)
      return fallbackData
    }
  })

  // Get current app version
  ipcMain.handle('changelog:getAppVersion', async (): Promise<string> => {
    return app.getVersion()
  })

  // Get latest changelog entry
  ipcMain.handle('changelog:getLatestEntry', async (): Promise<ChangelogEntry | null> => {
    try {
      const changelogData = await ipcMain.invoke('changelog:getChangelog')
      return changelogData.entries[0] || null
    } catch (error) {
      console.error('Error getting latest changelog entry:', error)
      return null
    }
  })
}

async function readChangelogFile(): Promise<string> {
  const isDev = !app.isPackaged
  console.log('Reading changelog file, isDev:', isDev)
  
  let changelogPath: string

  if (isDev) {
    // In development, read from project root
    changelogPath = join(process.cwd(), 'CHANGELOG.md')
  } else {
    // In production, read from app resources
    const appPath = app.getAppPath()
    changelogPath = join(appPath, 'CHANGELOG.md')
  }

  console.log('Trying to read changelog from:', changelogPath)

  try {
    // Check if file exists first
    const stat = await fs.stat(changelogPath)
    console.log('Changelog file exists, size:', stat.size, 'bytes')
    
    const content = await fs.readFile(changelogPath, 'utf-8')
    console.log('Successfully read changelog, length:', content.length, 'characters')
    return content
  } catch (error) {
    console.error(`Error reading changelog from ${changelogPath}:`, error)
    
    // Try alternative paths if the main path fails
    const alternativePaths = [
      join(process.cwd(), 'CHANGELOG.md'),
      join(__dirname, '..', '..', '..', 'CHANGELOG.md'),
      join(app.getPath('exe'), '..', 'CHANGELOG.md')
    ]
    
    for (const altPath of alternativePaths) {
      if (altPath !== changelogPath) {
        console.log('Trying alternative path:', altPath)
        try {
          const content = await fs.readFile(altPath, 'utf-8')
          console.log('Successfully read from alternative path:', altPath)
          return content
        } catch (altError) {
          console.log('Alternative path failed:', altError.message)
        }
      }
    }
    
    throw error
  }
}

function parseChangelog(content: string): ChangelogData {
  console.log('Parsing changelog, content length:', content.length)
  const lines = content.split('\n')
  const entries: ChangelogEntry[] = []
  let currentEntry: Partial<ChangelogEntry> | null = null
  let inChangesSection = false

  console.log('Total lines to process:', lines.length)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()

    // Skip empty lines and headers (but not version headers)
    if (!trimmedLine || (trimmedLine.startsWith('#') && !trimmedLine.startsWith('## ['))) {
      continue
    }

    console.log(`Line ${i}: "${trimmedLine}"`)

    // Check for version header: ## [1.0.0] - 2025-08-05
    const versionMatch = trimmedLine.match(/^## \[([^\]]+)\] - (.+)$/)
    if (versionMatch) {
      console.log('Found version header:', versionMatch[1], versionMatch[2])
      
      // Save previous entry if exists
      if (currentEntry && currentEntry.version && currentEntry.date) {
        console.log('Saving previous entry with', currentEntry.changes?.length || 0, 'changes')
        entries.push({
          version: currentEntry.version,
          date: currentEntry.date,
          changes: currentEntry.changes || []
        })
      }

      // Start new entry
      currentEntry = {
        version: versionMatch[1],
        date: versionMatch[2],
        changes: []
      }
      inChangesSection = false
      console.log('Created new entry for version:', currentEntry.version)
      continue
    }

    // Check for section headers (### Added, ### Fixed, etc.)
    if (trimmedLine.startsWith('### ')) {
      inChangesSection = true
      console.log('Entering changes section:', trimmedLine)
      continue
    }

    // Parse change items (lines starting with -)
    if (trimmedLine.startsWith('- ')) {
      console.log('Found potential change item:', trimmedLine)
      console.log('inChangesSection:', inChangesSection, 'currentEntry exists:', !!currentEntry)
      
      if (inChangesSection && currentEntry) {
        const changeText = trimmedLine.substring(2).trim()
        if (changeText) {
          currentEntry.changes = currentEntry.changes || []
          currentEntry.changes.push(changeText)
          console.log('Added change:', changeText)
        }
      } else if (currentEntry) {
        // If we're in a version section but not explicitly in a changes section,
        // still try to capture bullet points (more forgiving parsing)
        const changeText = trimmedLine.substring(2).trim()
        if (changeText) {
          currentEntry.changes = currentEntry.changes || []
          currentEntry.changes.push(changeText)
          console.log('Added change (forgiving mode):', changeText)
        }
      }
    }
  }

  // Don't forget the last entry
  if (currentEntry && currentEntry.version && currentEntry.date) {
    console.log('Saving final entry with', currentEntry.changes?.length || 0, 'changes')
    entries.push({
      version: currentEntry.version,
      date: currentEntry.date,
      changes: currentEntry.changes || []
    })
  }

  console.log('Parsed', entries.length, 'entries total')
  entries.forEach((entry, index) => {
    console.log(`Entry ${index}: v${entry.version} with ${entry.changes.length} changes`)
  })

  return {
    entries,
    latestVersion: entries.length > 0 ? entries[0].version : '1.0.0'
  }
}