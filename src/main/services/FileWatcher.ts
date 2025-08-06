import chokidar, { FSWatcher } from 'chokidar'
import { EventEmitter } from 'node:events'
import path from 'node:path'

import { SUPPORTED_EXTENSIONS } from 'shared/constants'

export interface FileWatcherEvents {
  fileAdded: (filePath: string) => void
  fileChanged: (filePath: string) => void
  fileRemoved: (filePath: string) => void
  directoryAdded: (dirPath: string) => void
  directoryRemoved: (dirPath: string) => void
  error: (error: Error) => void
}

export class FileWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null
  private watchedDirectory: string = ''
  private isWatching: boolean = false

  constructor() {
    super()
  }

  async startWatching(modsDirectory: string): Promise<void> {
    if (this.isWatching && this.watchedDirectory === modsDirectory) {
      return // Already watching this directory
    }

    // Stop existing watcher if running
    await this.stopWatching()

    try {
      this.watchedDirectory = modsDirectory
      
      this.watcher = chokidar.watch(modsDirectory, {
        ignored: [
          // Ignore system files and directories
          /(^|[\/\\])\../, // Hidden files and directories
          /node_modules/,
          /\.tmp$/,
          /\.temp$/,
          /~$/,
        ],
        persistent: true,
        ignoreInitial: true, // Don't emit events for existing files
        followSymlinks: false,
        depth: 10, // Reasonable depth limit
        awaitWriteFinish: {
          stabilityThreshold: 1000, // Wait for file to be stable for 1 second
          pollInterval: 100,
        },
      })

      // Set up event handlers
      this.setupEventHandlers()
      
      this.isWatching = true
      console.log(`File watcher started for: ${modsDirectory}`)
      
    } catch (error) {
      console.error('Error starting file watcher:', error)
      this.emit('error', error as Error)
      throw error
    }
  }

  async stopWatching(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
    
    this.isWatching = false
    this.watchedDirectory = ''
    console.log('File watcher stopped')
  }

  private setupEventHandlers(): void {
    if (!this.watcher) return

    // File events
    this.watcher.on('add', (filePath: string) => {
      if (this.isModFile(filePath)) {
        console.log(`Mod file added: ${filePath}`)
        this.emit('fileAdded', filePath)
      }
    })

    this.watcher.on('change', (filePath: string) => {
      if (this.isModFile(filePath)) {
        console.log(`Mod file changed: ${filePath}`)
        this.emit('fileChanged', filePath)
      }
    })

    this.watcher.on('unlink', (filePath: string) => {
      if (this.isModFile(filePath)) {
        console.log(`Mod file removed: ${filePath}`)
        this.emit('fileRemoved', filePath)
      }
    })

    // Directory events
    this.watcher.on('addDir', (dirPath: string) => {
      console.log(`Directory added: ${dirPath}`)
      this.emit('directoryAdded', dirPath)
    })

    this.watcher.on('unlinkDir', (dirPath: string) => {
      console.log(`Directory removed: ${dirPath}`)
      this.emit('directoryRemoved', dirPath)
    })

    // Error handling
    this.watcher.on('error', (error: Error) => {
      console.error('File watcher error:', error)
      this.emit('error', error)
    })

    // Watcher ready
    this.watcher.on('ready', () => {
      console.log('File watcher is ready and scanning for changes')
    })
  }

  private isModFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    const fileName = path.basename(filePath)
    
    // Check for .pak files or .pak.disabled files
    return SUPPORTED_EXTENSIONS.MOD_FILES.includes(ext) || 
           fileName.endsWith('.pak.disabled')
  }

  isWatchingDirectory(directory: string): boolean {
    return this.isWatching && this.watchedDirectory === directory
  }

  getWatchedDirectory(): string {
    return this.watchedDirectory
  }

  isCurrentlyWatching(): boolean {
    return this.isWatching
  }

  // Helper method to temporarily pause watching (useful during batch operations)
  async pauseWatching(): Promise<void> {
    if (this.watcher && this.isWatching) {
      this.watcher.unwatch(this.watchedDirectory)
      console.log('File watcher paused')
    }
  }

  // Resume watching after pause
  async resumeWatching(): Promise<void> {
    if (this.watcher && this.isWatching && this.watchedDirectory) {
      this.watcher.add(this.watchedDirectory)
      console.log('File watcher resumed')
    }
  }

  // Get statistics about the watcher
  getWatcherStats(): {
    isWatching: boolean
    watchedDirectory: string
    watchedPaths: string[]
  } {
    return {
      isWatching: this.isWatching,
      watchedDirectory: this.watchedDirectory,
      watchedPaths: this.watcher ? this.watcher.getWatched() as any : [],
    }
  }
}

// Singleton instance
export const fileWatcher = new FileWatcher()