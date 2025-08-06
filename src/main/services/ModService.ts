import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID, createHash } from 'node:crypto'

import type { ModInfo, ModMetadata, ModCategory, Character, ModOrganizationProgress, OrganizationResult } from 'shared/types'
import { CATEGORIES, CHARACTERS, SUPPORTED_EXTENSIONS, DEFAULT_GAME_PATHS } from 'shared/constants'

export class ModService {
  private modsDirectory: string = ''
  private metadataDirectory: string = ''

  constructor(gameDirectory: string, metadataDirectory: string) {
    this.modsDirectory = path.join(gameDirectory, DEFAULT_GAME_PATHS.MODS_SUBPATH)
    this.metadataDirectory = metadataDirectory
  }

  async getAllMods(): Promise<ModInfo[]> {
    try {
      await this.ensureDirectoryExists(this.modsDirectory)
      const mods: ModInfo[] = []
      
      // Recursively scan the mods directory
      await this.scanDirectory(this.modsDirectory, mods)
      
      return mods.sort((a, b) => a.name.localeCompare(b.name))
    } catch (error) {
      console.error('Error getting all mods:', error)
      throw new Error('Failed to scan mods directory')
    }
  }

  private async scanDirectory(dirPath: string, mods: ModInfo[]): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        
        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath, mods)
        } else if (entry.isFile() && this.isModFile(entry.name)) {
          const modInfo = await this.createModInfo(fullPath, entry.name)
          if (modInfo) {
            mods.push(modInfo)
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error)
    }
  }

  private isModFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase()
    // Only .pak files should create mod entries (.ucas/.utoc are companion files)
    return ext === '.pak' || filename.endsWith('.pak.disabled')
  }

  private async findAssociatedFiles(pakFilePath: string): Promise<string[]> {
    try {
      const directory = path.dirname(pakFilePath)
      const fileName = path.basename(pakFilePath)
      const baseName = fileName.replace(/\.pak(\.disabled)?$/, '')
      
      const associatedFiles: string[] = []
      const expectedExtensions = ['.pak', '.ucas', '.utoc']
      
      // First, look in the same directory (fast path)
      for (const ext of expectedExtensions) {
        const expectedFile = path.join(directory, `${baseName}${ext}`)
        const expectedDisabledFile = path.join(directory, `${baseName}${ext}.disabled`)
        
        try {
          await fs.access(expectedFile)
          associatedFiles.push(expectedFile)
        } catch {
          try {
            await fs.access(expectedDisabledFile)
            associatedFiles.push(expectedDisabledFile)
          } catch {
            // File doesn't exist in same directory
          }
        }
      }
      
      // If we're missing companion files, search the entire mods directory for orphaned files
      const missingExtensions = expectedExtensions.filter(ext => 
        !associatedFiles.some(file => file.toLowerCase().includes(`${baseName}${ext}`.toLowerCase()))
      )
      
      if (missingExtensions.length > 0) {
        console.log(`[ModService] Searching for orphaned companion files for ${baseName}: ${missingExtensions.join(', ')}`)
        const orphanedFiles = await this.findOrphanedCompanionFiles(baseName, missingExtensions)
        associatedFiles.push(...orphanedFiles)
      }
      
      return associatedFiles.sort()
    } catch (error) {
      console.error(`Error finding associated files for ${pakFilePath}:`, error)
      return [pakFilePath] // At minimum, return the pak file itself
    }
  }

  /**
   * Find orphaned companion files (.ucas/.utoc) anywhere in the mods directory
   */
  private async findOrphanedCompanionFiles(baseName: string, missingExtensions: string[]): Promise<string[]> {
    const orphanedFiles: string[] = []
    
    const searchForOrphans = async (dirPath: string) => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name)
          
          if (entry.isDirectory()) {
            await searchForOrphans(fullPath)
          } else if (entry.isFile()) {
            // Check if this file matches our missing companion files
            for (const ext of missingExtensions) {
              const expectedName = `${baseName}${ext}`
              const expectedDisabledName = `${baseName}${ext}.disabled`
              
              if (entry.name.toLowerCase() === expectedName.toLowerCase() || 
                  entry.name.toLowerCase() === expectedDisabledName.toLowerCase()) {
                orphanedFiles.push(fullPath)
                console.log(`[ModService] Found orphaned companion file: ${fullPath}`)
                break
              }
            }
          }
        }
      } catch (error) {
        console.error(`[ModService] Error searching for orphaned files in ${dirPath}:`, error)
      }
    }
    
    await searchForOrphans(this.modsDirectory)
    return orphanedFiles
  }

  private async findFilesByName(filenames: string[]): Promise<string[]> {
    const foundFiles: string[] = []
    
    const searchDirectory = async (dirPath: string) => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name)
          
          if (entry.isDirectory()) {
            // Recursively search subdirectories
            await searchDirectory(fullPath)
          } else if (entry.isFile()) {
            // Check if this file matches any of the filenames we're looking for
            if (filenames.includes(entry.name)) {
              foundFiles.push(fullPath)
              console.log(`Found file for deletion: ${fullPath}`)
            }
          }
        }
      } catch (error) {
        console.error(`Error searching directory ${dirPath}:`, error)
      }
    }
    
    // Start searching from the mods directory
    await searchDirectory(this.modsDirectory)
    
    return foundFiles
  }

  private async createModInfo(filePath: string, fileName: string): Promise<ModInfo | null> {
    try {
      const stats = await fs.stat(filePath)
      const isEnabled = !fileName.endsWith('.disabled')
      const cleanFileName = fileName.replace('.disabled', '')
      const modId = this.generateModId(filePath)
      
      // Load metadata if exists
      const metadata = await this.loadMetadata(modId)
      
      // Find associated files (.pak, .ucas, .utoc)
      const associatedFiles = await this.findAssociatedFiles(filePath)
      
      const modInfo: ModInfo = {
        id: modId,
        name: metadata?.title || this.extractModName(cleanFileName),
        category: metadata?.category || this.detectCategory(cleanFileName),
        character: metadata?.character || this.detectCharacter(cleanFileName),
        enabled: isEnabled,
        filePath,
        thumbnailPath: await this.getThumbnailPath(modId, cleanFileName),
        metadata: metadata || {
          title: this.extractModName(cleanFileName),
          description: '',
          author: '',
          version: '',
          tags: [],
          category: this.detectCategory(cleanFileName),
          character: this.detectCharacter(cleanFileName),
          createdAt: stats.birthtime,
          updatedAt: stats.mtime,
        },
        fileSize: stats.size,
        installDate: stats.birthtime,
        lastModified: stats.mtime,
        originalFileName: cleanFileName,
        associatedFiles,
      }

      return modInfo
    } catch (error) {
      console.error(`Error creating mod info for ${filePath}:`, error)
      return null
    }
  }

  private generateModId(filePath: string): string {
    // Generate unique ID using SHA-256 hash to prevent collisions
    // Use filename only to ensure stable IDs when files are moved during organization
    const fileName = path.basename(filePath).replace(/\.disabled$/, '')
    const hash = createHash('sha256').update(fileName).digest('hex')
    // Use first 16 characters of hash for readability while maintaining uniqueness
    return hash.substring(0, 16)
  }

  private extractModName(fileName: string): string {
    return path.basename(fileName, path.extname(fileName))
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
  }

  private detectCategory(fileName: string): ModCategory {
    const lowerName = fileName.toLowerCase()
    
    for (const [category, config] of Object.entries(CATEGORIES)) {
      if (config.keywords.some(keyword => lowerName.includes(keyword))) {
        return category as ModCategory
      }
    }
    
    return 'Skins' // Default category
  }

  private detectCharacter(fileName: string): Character | undefined {
    const lowerName = fileName.toLowerCase()
    
    // Score-based character detection for better accuracy
    const characterScores: Array<{ character: Character; score: number; matchedKeywords: string[] }> = []
    
    for (const [character, config] of Object.entries(CHARACTERS)) {
      const matchedKeywords: string[] = []
      let totalScore = 0
      
      for (const keyword of config.keywords) {
        const lowerKeyword = keyword.toLowerCase()
        
        // Check for exact word matches (highest priority)
        const wordBoundaryRegex = new RegExp(`\\b${lowerKeyword}\\b`, 'i')
        if (wordBoundaryRegex.test(lowerName)) {
          matchedKeywords.push(keyword)
          totalScore += lowerKeyword.length * 3 // Word boundary matches get 3x score
          continue
        }
        
        // Check for substring matches (lower priority)
        if (lowerName.includes(lowerKeyword)) {
          matchedKeywords.push(keyword)
          totalScore += lowerKeyword.length // Base score for substring match
        }
      }
      
      if (matchedKeywords.length > 0) {
        // Bonus for matching multiple keywords
        if (matchedKeywords.length > 1) {
          totalScore += matchedKeywords.length * 2
        }
        
        characterScores.push({
          character: character as Character,
          score: totalScore,
          matchedKeywords
        })
      }
    }
    
    if (characterScores.length === 0) {
      return undefined
    }
    
    // Sort by score descending and return the highest scoring character
    characterScores.sort((a, b) => b.score - a.score)
    const winner = characterScores[0]
    
    console.log(`[ModService] Character detection for "${fileName}": ${winner.character} (score: ${winner.score}, keywords: ${winner.matchedKeywords.join(', ')})`)
    
    return winner.character
  }

  async enableMod(modId: string, enabled: boolean): Promise<void> {
    try {
      const mod = await this.getModById(modId)
      if (!mod) {
        throw new Error('Mod not found')
      }

      const currentPath = mod.filePath
      const isCurrentlyEnabled = !path.basename(currentPath).endsWith('.disabled')
      
      if (isCurrentlyEnabled === enabled) {
        return // Already in desired state
      }

      let newPath: string
      if (enabled) {
        // Remove .disabled extension
        newPath = currentPath.replace('.disabled', '')
      } else {
        // Add .disabled extension
        newPath = currentPath + '.disabled'
      }

      await fs.rename(currentPath, newPath)
      
      // Update metadata
      await this.updateMetadata(modId, { updatedAt: new Date() })
      
    } catch (error) {
      console.error(`Error ${enabled ? 'enabling' : 'disabling'} mod:`, error)
      throw new Error(`Failed to ${enabled ? 'enable' : 'disable'} mod`)
    }
  }

  async deleteMod(modId: string): Promise<void> {
    try {
      const mod = await this.getModById(modId)
      if (!mod) {
        throw new Error('Mod not found')
      }

      // Get associated file names (not full paths) from the mod's metadata
      const associatedFiles = await this.getAssociatedFiles(modId)
      const filenames = associatedFiles.map(filePath => path.basename(filePath))
      
      console.log(`Searching for files to delete: ${filenames.join(', ')}`)
      
      // Search the entire mods directory for these files by name
      const foundFiles = await this.findFilesByName(filenames)
      
      if (foundFiles.length === 0) {
        console.warn(`No files found for deletion for mod ${modId}`)
      }
      
      // Delete all found mod files
      for (const filePath of foundFiles) {
        try {
          await fs.unlink(filePath)
          console.log(`Successfully deleted mod file: ${filePath}`)
        } catch (err) {
          console.warn(`Failed to delete mod file ${filePath}:`, err)
          // Continue with other files even if one fails
        }
      }
      
      // Delete metadata
      await this.deleteMetadata(modId)
      
      // Delete thumbnail if exists
      if (mod.thumbnailPath) {
        try {
          await fs.unlink(mod.thumbnailPath)
          console.log(`Deleted thumbnail: ${mod.thumbnailPath}`)
        } catch (err) {
          console.warn('Failed to delete thumbnail:', err)
        }
      }
      
    } catch (error) {
      console.error('Error deleting mod:', error)
      throw new Error('Failed to delete mod')
    }
  }

  async updateMetadata(modId: string, metadata: Partial<ModMetadata>): Promise<ModInfo> {
    try {
      const existingMetadata = await this.loadMetadata(modId)
      const updatedMetadata: ModMetadata = {
        ...existingMetadata,
        ...metadata,
        updatedAt: new Date(),
      }

      const metadataPath = path.join(this.metadataDirectory, `${modId}.json`)
      await fs.writeFile(metadataPath, JSON.stringify(updatedMetadata, null, 2))
      
      console.log(`Metadata updated for mod ${modId}`)
      
      // Check if reorganization is needed (character or category changed)
      const needsReorganization = (
        (metadata.character && metadata.character !== existingMetadata?.character) ||
        (metadata.category && metadata.category !== existingMetadata?.category)
      )
      
      if (needsReorganization) {
        console.log(`[ModService] Reorganization needed for mod ${modId} due to character/category change`)
        try {
          // Perform reorganization to move files to correct location
          await this.reorganizeMod(modId)
          console.log(`[ModService] Reorganization completed for mod ${modId}`)
        } catch (error) {
          console.error(`[ModService] Reorganization failed for mod ${modId}:`, error)
          // Don't throw - continue with returning the updated mod info even if reorganization failed
        }
      }
      
      // Return the updated ModInfo object (with correct file paths after reorganization)
      const updatedMod = await this.getModById(modId)
      if (!updatedMod) {
        throw new Error('Failed to retrieve updated mod info')
      }
      
      return updatedMod
    } catch (error) {
      console.error('Error updating metadata:', error)
      throw new Error('Failed to update mod metadata')
    }
  }

  async refreshModThumbnailPath(modId: string): Promise<string | undefined> {
    try {
      // Get the mod to find its original file name
      const mod = await this.getModById(modId)
      if (mod) {
        return await this.getThumbnailPath(modId, mod.originalFileName)
      }
      return await this.getThumbnailPath(modId)
    } catch (error) {
      console.error('Error refreshing thumbnail path:', error)
      return undefined
    }
  }

  private async loadMetadata(modId: string): Promise<ModMetadata | null> {
    try {
      const metadataPath = path.join(this.metadataDirectory, `${modId}.json`)
      const metadataContent = await fs.readFile(metadataPath, 'utf-8')
      return JSON.parse(metadataContent)
    } catch (error) {
      return null // Metadata doesn't exist
    }
  }

  private async deleteMetadata(modId: string): Promise<void> {
    try {
      const metadataPath = path.join(this.metadataDirectory, `${modId}.json`)
      await fs.unlink(metadataPath)
    } catch (error) {
      console.warn('Failed to delete metadata:', error)
    }
  }

  private async getThumbnailPath(modId: string, originalFileName?: string): Promise<string | undefined> {
    // Use the same path as SettingsManager to ensure consistency
    const { settingsManager } = await import('./SettingsManager')
    const thumbnailsDir = settingsManager.getThumbnailsPath()
    // Prioritize .webp (our optimized format) then fallback to other formats
    const extensions = ['.webp', '.png', '.jpg', '.jpeg', '.gif']
    
    // First try with original filename (new naming convention)
    if (originalFileName) {
      const baseFileName = path.basename(originalFileName, path.extname(originalFileName))
      for (const ext of extensions) {
        const thumbnailPath = path.join(thumbnailsDir, `${baseFileName}${ext}`)
        try {
          await fs.access(thumbnailPath)
          return thumbnailPath
        } catch {
          continue
        }
      }
    }
    
    // Fallback to modId-based naming (for backward compatibility)
    for (const ext of extensions) {
      const thumbnailPath = path.join(thumbnailsDir, `${modId}${ext}`)
      try {
        await fs.access(thumbnailPath)
        return thumbnailPath
      } catch {
        continue
      }
    }
    
    return undefined
  }

  private async getModById(modId: string): Promise<ModInfo | null> {
    const allMods = await this.getAllMods()
    return allMods.find(mod => mod.id === modId) || null
  }

  async reorganizeMod(modId: string): Promise<void> {
    try {
      const mod = await this.getModById(modId)
      if (!mod) {
        throw new Error('Mod not found')
      }

      const targetDirectory = this.getTargetDirectory(mod.metadata.category, mod.metadata.character)
      const modFolder = path.join(targetDirectory, mod.metadata.title)
      
      // Create target directory if it doesn't exist
      await this.ensureDirectoryExists(modFolder)
      
      // Get all associated files for this mod
      const associatedFiles = await this.getAssociatedFiles(modId)
      console.log(`[ModService] Reorganizing ${associatedFiles.length} files for mod: ${mod.name}`)
      
      // Move all associated files (.pak, .ucas, .utoc)
      const newFilePaths: string[] = []
      for (const filePath of associatedFiles) {
        const fileName = path.basename(filePath)
        const targetPath = path.join(modFolder, fileName)
        
        try {
          // Check if source file exists
          await fs.access(filePath)
          
          // Move the file
          await fs.rename(filePath, targetPath)
          newFilePaths.push(targetPath)
          console.log(`[ModService] Moved file: ${filePath} -> ${targetPath}`)
        } catch (error) {
          console.warn(`[ModService] Failed to move file ${filePath}:`, error)
          // Try to find the file by name in case it's already been moved
          const foundFiles = await this.findFilesByName([fileName])
          if (foundFiles.length > 0) {
            console.log(`[ModService] File already exists at: ${foundFiles[0]}`)
            newFilePaths.push(foundFiles[0])
          }
        }
      }
      
      // Update metadata timestamp without triggering reorganization
      const primaryFile = newFilePaths.find(p => p.toLowerCase().endsWith('.pak'))
      if (primaryFile) {
        // Direct metadata update to avoid recursion
        const existingMetadata = await this.loadMetadata(modId)
        const updatedMetadata: ModMetadata = {
          ...existingMetadata,
          updatedAt: new Date(),
        }
        const metadataPath = path.join(this.metadataDirectory, `${modId}.json`)
        await fs.writeFile(metadataPath, JSON.stringify(updatedMetadata, null, 2))
      }
      
      console.log(`[ModService] Successfully reorganized mod ${mod.name} to ${modFolder}`)
      
    } catch (error) {
      console.error('Error reorganizing mod:', error)
      throw new Error('Failed to reorganize mod')
    }
  }

  private getTargetDirectory(category: ModCategory, character?: Character): string {
    let targetDir = path.join(this.modsDirectory, category)
    
    if (character) {
      targetDir = path.join(targetDir, character)
    } else {
      targetDir = path.join(targetDir, 'Misc')
    }
    
    return targetDir
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath)
    } catch {
      await fs.mkdir(dirPath, { recursive: true })
    }
  }

  async validateModFile(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath)
      const ext = path.extname(filePath).toLowerCase()
      
      // Check file extension
      if (!SUPPORTED_EXTENSIONS.MOD_FILES.includes(ext)) {
        return false
      }
      
      // Check file size (max 1GB)
      if (stats.size > 1024 * 1024 * 1024) {
        return false
      }
      
      return true
    } catch {
      return false
    }
  }

  updateDirectories(gameDirectory: string, metadataDirectory: string): void {
    this.modsDirectory = path.join(gameDirectory, DEFAULT_GAME_PATHS.MODS_SUBPATH)
    this.metadataDirectory = metadataDirectory
  }

  async getAssociatedFiles(modId: string): Promise<string[]> {
    try {
      const mods = await this.getAllMods()
      const mod = mods.find(m => m.id === modId)
      
      if (!mod) {
        throw new Error(`Mod with ID ${modId} not found`)
      }
      
      return mod.associatedFiles || [mod.filePath]
    } catch (error) {
      console.error(`Error getting associated files for mod ${modId}:`, error)
      throw error
    }
  }

  // ===== MOD ORGANIZATION SYSTEM =====

  /**
   * Organize all mods in the mods directory to their correct locations
   * @param reportProgress - Whether to report progress via IPC events
   * @param progressCallback - Optional callback for progress updates
   */
  async organizeAllMods(
    reportProgress: boolean = false,
    progressCallback?: (progress: ModOrganizationProgress) => void
  ): Promise<OrganizationResult> {
    const startTime = Date.now()
    console.log('[ModService] Starting comprehensive mod organization...')

    const result: OrganizationResult = {
      totalMods: 0,
      movedMods: 0,
      errorCount: 0,
      errors: [],
      duration: 0
    }

    try {
      // Report scanning status
      const progress: ModOrganizationProgress = {
        currentFile: 'Scanning mods directory...',
        current: 0,
        total: 0,
        status: 'scanning',
        movedCount: 0,
        errorCount: 0,
        errors: []
      }

      if (progressCallback) progressCallback(progress)

      // Find all .pak files in the mods directory
      const allPakFiles = await this.findAllPakFiles()
      result.totalMods = allPakFiles.length

      console.log(`[ModService] Found ${allPakFiles.length} mod files to process`)

      // Update progress with total count
      progress.total = allPakFiles.length
      progress.status = 'organizing'
      if (progressCallback) progressCallback(progress)

      // Process each .pak file
      for (let i = 0; i < allPakFiles.length; i++) {
        const pakFile = allPakFiles[i]
        const fileName = path.basename(pakFile)
        
        try {
          // Update progress
          progress.current = i + 1
          progress.currentFile = fileName
          if (progressCallback) progressCallback(progress)

          console.log(`[ModService] Processing mod ${i + 1}/${allPakFiles.length}: ${fileName}`)

          // Create mod info for this file (with metadata detection)
          const modInfo = await this.createModInfoForFile(pakFile)
          if (!modInfo) {
            throw new Error('Failed to create mod info')
          }

          // Check if mod is in correct location
          if (!this.isModInCorrectLocation(modInfo)) {
            console.log(`[ModService] Moving mod to correct location: ${fileName}`)
            await this.moveModToCorrectLocation(modInfo)
            result.movedMods++
            progress.movedCount++
          } else {
            console.log(`[ModService] Mod already in correct location: ${fileName}`)
          }

        } catch (error) {
          const errorMsg = `Failed to process ${fileName}: ${error instanceof Error ? error.message : String(error)}`
          console.error(`[ModService] ${errorMsg}`)
          
          result.errors.push(errorMsg)
          result.errorCount++
          progress.errorCount++
          progress.errors.push(errorMsg)
        }
      }

      // Cleanup empty directories after all moves are complete
      console.log(`[ModService] Starting cleanup of empty directories...`)
      progress.status = 'organizing'
      progress.currentFile = 'Cleaning up empty directories...'
      if (progressCallback) progressCallback(progress)

      const cleanupResult = await this.cleanupEmptyDirectories()
      console.log(`[ModService] Cleanup complete: ${cleanupResult.removedDirectories} directories removed`)

      // Complete
      progress.status = 'complete'
      progress.currentFile = 'Organization complete'
      if (progressCallback) progressCallback(progress)

      result.duration = Date.now() - startTime
      console.log(`[ModService] Organization complete: ${result.movedMods} moved, ${result.errorCount} errors, ${cleanupResult.removedDirectories} directories cleaned in ${result.duration}ms`)

      return result

    } catch (error) {
      const errorMsg = `Organization failed: ${error instanceof Error ? error.message : String(error)}`
      console.error(`[ModService] ${errorMsg}`)
      
      result.errors.push(errorMsg)
      result.errorCount++
      result.duration = Date.now() - startTime
      
      if (progressCallback) {
        progressCallback({
          currentFile: 'Organization failed',
          current: 0,
          total: 0,
          status: 'error',
          movedCount: result.movedMods,
          errorCount: result.errorCount,
          errors: result.errors
        })
      }

      return result
    }
  }

  /**
   * Find all .pak files in the mods directory recursively
   */
  private async findAllPakFiles(): Promise<string[]> {
    const pakFiles: string[] = []

    const scanForPakFiles = async (dirPath: string) => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name)
          
          if (entry.isDirectory()) {
            await scanForPakFiles(fullPath)
          } else if (entry.isFile() && this.isModFile(entry.name)) {
            pakFiles.push(fullPath)
          }
        }
      } catch (error) {
        console.error(`[ModService] Error scanning directory ${dirPath}:`, error)
      }
    }

    await scanForPakFiles(this.modsDirectory)
    return pakFiles
  }

  /**
   * Check if a mod is in its correct location based on metadata
   * AND all associated files are co-located together
   */
  private isModInCorrectLocation(modInfo: ModInfo): boolean {
    const expectedDirectory = this.getTargetDirectory(modInfo.metadata.category, modInfo.metadata.character)
    const expectedModFolder = path.join(expectedDirectory, modInfo.metadata.title)
    const currentDirectory = path.dirname(modInfo.filePath)
    
    // Normalize paths for comparison
    const normalizedExpected = path.normalize(expectedModFolder).toLowerCase()
    const normalizedCurrent = path.normalize(currentDirectory).toLowerCase()
    
    // First check: Is the .pak file in the correct folder?
    const pakInCorrectLocation = normalizedCurrent === normalizedExpected
    
    if (!pakInCorrectLocation) {
      console.log(`[ModService] .pak file not in correct location: ${currentDirectory} !== ${expectedModFolder}`)
      return false
    }
    
    // Second check: Are ALL associated files co-located with the .pak file?
    if (modInfo.associatedFiles && modInfo.associatedFiles.length > 1) {
      const pakDirectory = path.dirname(modInfo.filePath).toLowerCase()
      
      for (const associatedFile of modInfo.associatedFiles) {
        const associatedDirectory = path.dirname(associatedFile).toLowerCase()
        
        if (associatedDirectory !== pakDirectory) {
          console.log(`[ModService] Associated file not co-located: ${associatedFile} not in ${pakDirectory}`)
          return false
        }
      }
    }
    
    console.log(`[ModService] All files correctly located and co-located: ${modInfo.name}`)
    return true
  }

  /**
   * Move a mod and all associated files to the correct location
   */
  private async moveModToCorrectLocation(modInfo: ModInfo): Promise<void> {
    try {
      const targetDirectory = this.getTargetDirectory(modInfo.metadata.category, modInfo.metadata.character)
      const modFolder = path.join(targetDirectory, modInfo.metadata.title)
      
      // Create target directory if it doesn't exist
      await this.ensureDirectoryExists(modFolder)
      
      // Get all associated files for this mod
      const associatedFiles = modInfo.associatedFiles || [modInfo.filePath]
      console.log(`[ModService] Moving ${associatedFiles.length} files for mod: ${modInfo.name}`)
      
      // Move all associated files (.pak, .ucas, .utoc)
      for (const filePath of associatedFiles) {
        const fileName = path.basename(filePath)
        const targetPath = path.join(modFolder, fileName)
        
        try {
          // Check if source file exists
          await fs.access(filePath)
          
          // Don't move if already in correct location (edge case)
          if (path.normalize(filePath) === path.normalize(targetPath)) {
            console.log(`[ModService] File already in correct location: ${fileName}`)
            continue
          }
          
          // Check if target already exists
          try {
            await fs.access(targetPath)
            // Target exists, generate unique name
            const uniqueTargetPath = await this.generateUniqueFilePath(targetPath)
            await fs.rename(filePath, uniqueTargetPath)
            console.log(`[ModService] Moved file (with unique name): ${filePath} -> ${uniqueTargetPath}`)
          } catch {
            // Target doesn't exist, safe to move
            await fs.rename(filePath, targetPath)
            console.log(`[ModService] Moved file: ${filePath} -> ${targetPath}`)
          }
          
        } catch (error) {
          console.warn(`[ModService] Failed to move file ${filePath}:`, error)
          throw error
        }
      }
      
    } catch (error) {
      console.error(`[ModService] Error moving mod ${modInfo.name}:`, error)
      throw error
    }
  }

  /**
   * Create mod info for a specific file path (used during organization)
   * PRESERVES existing metadata to avoid overwriting user customizations
   */
  private async createModInfoForFile(filePath: string): Promise<ModInfo | null> {
    try {
      const fileName = path.basename(filePath)
      const cleanFileName = fileName.replace('.disabled', '')
      const modId = this.generateModId(filePath)
      
      // CRITICAL: Load existing metadata first to preserve user customizations
      const existingMetadata = await this.loadMetadata(modId)
      
      if (existingMetadata) {
        console.log(`[ModService] Using existing metadata for ${fileName} (preserving user customizations)`)
        
        // Create ModInfo using existing metadata
        const stats = await fs.stat(filePath)
        const isEnabled = !fileName.endsWith('.disabled')
        const associatedFiles = await this.findAssociatedFiles(filePath)
        
        const modInfo: ModInfo = {
          id: modId,
          name: existingMetadata.title,
          category: existingMetadata.category,
          character: existingMetadata.character,
          enabled: isEnabled,
          filePath,
          thumbnailPath: await this.getThumbnailPath(modId, cleanFileName),
          metadata: existingMetadata,
          fileSize: stats.size,
          installDate: stats.birthtime,
          lastModified: stats.mtime,
          originalFileName: cleanFileName,
          associatedFiles,
        }
        
        return modInfo
      } else {
        console.log(`[ModService] No existing metadata found for ${fileName}, creating fresh metadata`)
        // Fall back to normal creation if no existing metadata
        return await this.createModInfo(filePath, fileName)
      }
    } catch (error) {
      console.error(`[ModService] Error creating mod info for ${filePath}:`, error)
      return null
    }
  }

  /**
   * Generate a unique file path if the target already exists
   */
  private async generateUniqueFilePath(targetPath: string): Promise<string> {
    const dir = path.dirname(targetPath)
    const ext = path.extname(targetPath)
    const nameWithoutExt = path.basename(targetPath, ext)
    
    let counter = 1
    let uniquePath = targetPath
    
    while (true) {
      try {
        await fs.access(uniquePath)
        // File exists, try next number
        uniquePath = path.join(dir, `${nameWithoutExt}_${counter}${ext}`)
        counter++
      } catch {
        // File doesn't exist, we can use this path
        break
      }
    }
    
    return uniquePath
  }

  /**
   * Clean up empty directories after mod organization
   * Removes empty directories in hierarchical order (deepest first)
   */
  private async cleanupEmptyDirectories(): Promise<{ removedDirectories: number }> {
    let removedCount = 0
    const removedPaths: string[] = []

    /**
     * Check if a directory is empty (no files and no non-empty subdirectories)
     */
    const isDirectoryEmpty = async (dirPath: string): Promise<boolean> => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })
        
        if (entries.length === 0) {
          return true // Completely empty directory
        }
        
        // Check if all entries are empty directories
        for (const entry of entries) {
          if (entry.isFile()) {
            return false // Has files, not empty
          }
          
          if (entry.isDirectory()) {
            const subDirPath = path.join(dirPath, entry.name)
            const subDirEmpty = await isDirectoryEmpty(subDirPath)
            if (!subDirEmpty) {
              return false // Has non-empty subdirectory
            }
          }
        }
        
        return true // All subdirectories are empty
      } catch (error) {
        console.error(`[ModService] Error checking if directory is empty ${dirPath}:`, error)
        return false // Assume not empty if we can't check
      }
    }

    /**
     * Remove empty directories recursively (deepest first)
     */
    const removeEmptyDirectories = async (dirPath: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })
        
        // First, recursively process subdirectories (depth-first)
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const subDirPath = path.join(dirPath, entry.name)
            await removeEmptyDirectories(subDirPath)
          }
        }
        
        // After processing subdirectories, check if this directory is now empty
        const isEmpty = await isDirectoryEmpty(dirPath)
        if (isEmpty && this.shouldRemoveDirectory(dirPath)) {
          try {
            await fs.rmdir(dirPath)
            removedPaths.push(dirPath)
            removedCount++
            console.log(`[ModService] Removed empty directory: ${dirPath}`)
          } catch (error) {
            console.warn(`[ModService] Failed to remove empty directory ${dirPath}:`, error)
          }
        }
      } catch (error) {
        console.error(`[ModService] Error processing directory for cleanup ${dirPath}:`, error)
      }
    }

    try {
      // Start cleanup from the mods directory
      await removeEmptyDirectories(this.modsDirectory)
      
      if (removedCount > 0) {
        console.log(`[ModService] Cleanup summary: Removed ${removedCount} empty directories`)
        console.log(`[ModService] Removed directories: ${removedPaths.map(p => path.basename(p)).join(', ')}`)
      } else {
        console.log(`[ModService] No empty directories found during cleanup`)
      }
      
    } catch (error) {
      console.error(`[ModService] Error during directory cleanup:`, error)
    }

    return { removedDirectories: removedCount }
  }

  /**
   * Determine if a directory should be removed during cleanup
   * Preserves essential structure while allowing removal of abandoned mod folders
   */
  private shouldRemoveDirectory(dirPath: string): boolean {
    const relativePath = path.relative(this.modsDirectory, dirPath)
    const pathSegments = relativePath.split(path.sep).filter(segment => segment !== '')
    
    // Never remove the root mods directory
    if (pathSegments.length === 0) {
      return false
    }
    
    // Preserve main category directories (UI, Audio, Skins, Gameplay) if they're at the top level
    if (pathSegments.length === 1) {
      const categoryName = pathSegments[0]
      const isMainCategory = Object.keys(CATEGORIES).includes(categoryName)
      if (isMainCategory) {
        console.log(`[ModService] Preserving main category directory: ${categoryName}`)
        return false
      }
    }
    
    // Allow removal of character folders and mod folders (depth 2+ or non-category folders)
    return true
  }
}