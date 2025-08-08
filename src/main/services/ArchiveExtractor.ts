import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createReadStream, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'

import yauzl from 'yauzl'
import { Extract } from 'unzipper'

import { SUPPORTED_EXTENSIONS } from 'shared/constants'
import type { ModGroup, ExtractedModGroups } from 'shared/types'

export interface ExtractedFile {
  originalPath: string
  extractedPath: string
  size: number
  isModFile: boolean
}

export interface ExtractionProgress {
  total: number
  extracted: number
  currentFile: string
  progress: number // 0-100
}

export class ArchiveExtractor {
  private tempDirectory: string

  constructor(tempDirectory: string) {
    this.tempDirectory = tempDirectory
  }

  async extractArchive(
    archivePath: string,
    targetDirectory: string,
    onProgress?: (progress: ExtractionProgress) => void
  ): Promise<ExtractedFile[]> {
    const ext = path.extname(archivePath).toLowerCase()
    
    switch (ext) {
      case '.zip':
        return this.extractZip(archivePath, targetDirectory, onProgress)
      case '.rar':
        return this.extractRar(archivePath, targetDirectory, onProgress)
      case '.7z':
        return this.extract7z(archivePath, targetDirectory, onProgress)
      default:
        throw new Error(`Unsupported archive format: ${ext}`)
    }
  }

  private async extractZip(
    zipPath: string,
    targetDirectory: string,
    onProgress?: (progress: ExtractionProgress) => void
  ): Promise<ExtractedFile[]> {
    return new Promise((resolve, reject) => {
      const extractedFiles: ExtractedFile[] = []
      let totalEntries = 0
      let processedEntries = 0

      yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) {
          reject(err || new Error('Failed to open ZIP file'))
          return
        }

        totalEntries = zipfile.entryCount

        zipfile.readEntry()

        zipfile.on('entry', async (entry) => {
          const fileName = entry.fileName
          
          // Skip directories
          if (fileName.endsWith('/')) {
            processedEntries++
            this.updateProgress(onProgress, totalEntries, processedEntries, fileName)
            zipfile.readEntry()
            return
          }

          try {
            const outputPath = path.join(targetDirectory, fileName)
            await this.ensureDirectoryExists(path.dirname(outputPath))

            zipfile.openReadStream(entry, async (err, readStream) => {
              if (err || !readStream) {
                console.error(`Error opening read stream for ${fileName}:`, err)
                processedEntries++
                zipfile.readEntry()
                return
              }

              const writeStream = createWriteStream(outputPath)
              
              try {
                await pipeline(readStream, writeStream)
                
                const stats = await fs.stat(outputPath)
                extractedFiles.push({
                  originalPath: fileName,
                  extractedPath: outputPath,
                  size: stats.size,
                  isModFile: this.isModFile(fileName),
                })

                processedEntries++
                this.updateProgress(onProgress, totalEntries, processedEntries, fileName)
                zipfile.readEntry()
                
              } catch (pipelineErr) {
                console.error(`Error extracting ${fileName}:`, pipelineErr)
                processedEntries++
                zipfile.readEntry()
              }
            })
          } catch (extractErr) {
            console.error(`Error processing ${fileName}:`, extractErr)
            processedEntries++
            zipfile.readEntry()
          }
        })

        zipfile.on('end', () => {
          resolve(extractedFiles)
        })

        zipfile.on('error', (zipErr) => {
          reject(zipErr)
        })
      })
    })
  }

  private async extractRar(
    rarPath: string,
    targetDirectory: string,
    onProgress?: (progress: ExtractionProgress) => void
  ): Promise<ExtractedFile[]> {
    console.log(`[ArchiveExtractor] Starting RAR extraction: ${rarPath} -> ${targetDirectory}`)
    
    try {
      // Use system unrar command for reliable RAR extraction
      const { exec } = await import('node:child_process')
      const { promisify } = await import('node:util')
      const execAsync = promisify(exec)
      
      console.log(`[ArchiveExtractor] Attempting system unrar command...`)
      
      // Try multiple common unrar commands
      const unrarCommands = [
        `unrar x -y "${rarPath}" "${targetDirectory}/"`,      // Standard unrar
        `"C:\\Program Files\\WinRAR\\unrar.exe" x -y "${rarPath}" "${targetDirectory}/"`,  // WinRAR path
        `7z x -y "${rarPath}" -o"${targetDirectory}"`,        // 7-Zip alternative
      ]
      
      let extractionSucceeded = false
      let lastError: Error | null = null
      
      for (const command of unrarCommands) {
        try {
          console.log(`[ArchiveExtractor] Trying command: ${command}`)
          const { stdout, stderr } = await execAsync(command, { 
            timeout: 60000, // 60 second timeout
            maxBuffer: 1024 * 1024 * 10 // 10MB buffer
          })
          
          if (stderr && !stderr.includes('Everything is Ok')) {
            console.warn(`[ArchiveExtractor] Command stderr:`, stderr)
          }
          
          if (stdout) {
            console.log(`[ArchiveExtractor] Command stdout:`, stdout)
          }
          
          extractionSucceeded = true
          break
        } catch (cmdError) {
          console.warn(`[ArchiveExtractor] Command failed:`, cmdError)
          lastError = cmdError instanceof Error ? cmdError : new Error(String(cmdError))
          continue
        }
      }
      
      if (!extractionSucceeded) {
        const errorMessage = lastError?.message || 'All extraction commands failed'
        throw new Error(`System RAR extraction failed: ${errorMessage}. Please install WinRAR, 7-Zip, or ensure unrar is in your system PATH.`)
      }
      
      console.log(`[ArchiveExtractor] System extraction succeeded, scanning directory...`)
      
      // Scan the extracted directory to build the file list with deep recursive scanning
      const extractedFiles: ExtractedFile[] = []
      await this.scanExtractedDirectoryRecursively(targetDirectory, extractedFiles, targetDirectory)
      
      console.log(`[ArchiveExtractor] Found ${extractedFiles.length} files after extraction`)
      
      // Update progress to 100% when complete
      this.updateProgress(onProgress, 100, 100, 'Extraction complete')
      
      return extractedFiles
    } catch (error) {
      console.error(`[ArchiveExtractor] RAR extraction completely failed:`, error)
      throw new Error(`RAR extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please install WinRAR or 7-Zip and ensure they're in your system PATH.`)
    }
  }

  private async extract7z(
    archivePath: string,
    targetDirectory: string,
    onProgress?: (progress: ExtractionProgress) => void
  ): Promise<ExtractedFile[]> {
    // Similar to RAR, 7z would require additional tooling
    try {
      const { exec } = await import('node:child_process')
      const { promisify } = await import('node:util')
      const execAsync = promisify(exec)
      
      await execAsync(`7z x "${archivePath}" -o"${targetDirectory}"`)
      
      const extractedFiles: ExtractedFile[] = []
      await this.scanExtractedDirectory(targetDirectory, extractedFiles, targetDirectory)
      
      return extractedFiles
    } catch (error) {
      throw new Error(`7z extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please install 7-Zip and ensure it's in your system PATH.`)
    }
  }

  private async scanExtractedDirectory(
    dirPath: string,
    extractedFiles: ExtractedFile[],
    basePath: string
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        
        if (entry.isDirectory()) {
          await this.scanExtractedDirectory(fullPath, extractedFiles, basePath)
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath)
          const relativePath = path.relative(basePath, fullPath)
          
          extractedFiles.push({
            originalPath: relativePath,
            extractedPath: fullPath,
            size: stats.size,
            isModFile: this.isModFile(entry.name),
          })
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error)
    }
  }

  /**
   * Enhanced recursive directory scanner that handles deeply nested structures
   * like: root → folder → 3 subfolders → mod files
   */
  private async scanExtractedDirectoryRecursively(
    dirPath: string,
    extractedFiles: ExtractedFile[],
    basePath: string,
    depth: number = 0
  ): Promise<void> {
    try {
      console.log(`[ArchiveExtractor] Scanning directory at depth ${depth}: ${dirPath}`)
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      
      console.log(`[ArchiveExtractor] Found ${entries.length} entries in ${dirPath}`)
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        
        if (entry.isDirectory()) {
          console.log(`[ArchiveExtractor] Recursing into subdirectory: ${entry.name}`)
          // Recursively scan subdirectories (no depth limit for mod files)
          await this.scanExtractedDirectoryRecursively(fullPath, extractedFiles, basePath, depth + 1)
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath)
          const relativePath = path.relative(basePath, fullPath)
          const isModFile = this.isModFile(entry.name)
          
          console.log(`[ArchiveExtractor] Found file: ${entry.name} (mod file: ${isModFile}, size: ${stats.size})`)
          
          extractedFiles.push({
            originalPath: relativePath,
            extractedPath: fullPath,
            size: stats.size,
            isModFile,
          })
        }
      }
      
      console.log(`[ArchiveExtractor] Completed scanning directory at depth ${depth}`)
    } catch (error) {
      console.error(`[ArchiveExtractor] Error scanning directory ${dirPath}:`, error)
    }
  }

  private updateProgress(
    onProgress: ((progress: ExtractionProgress) => void) | undefined,
    total: number,
    extracted: number,
    currentFile: string
  ): void {
    if (onProgress) {
      onProgress({
        total,
        extracted,
        currentFile,
        progress: total > 0 ? Math.round((extracted / total) * 100) : 0,
      })
    }
  }

  private isModFile(fileName: string): boolean {
    const ext = path.extname(fileName).toLowerCase()
    return SUPPORTED_EXTENSIONS.MOD_FILES.includes(ext)
  }

  async validateArchive(archivePath: string): Promise<boolean> {
    const ext = path.extname(archivePath).toLowerCase()
    
    if (!SUPPORTED_EXTENSIONS.ARCHIVE_FILES.includes(ext)) {
      return false
    }

    try {
      const stats = await fs.stat(archivePath)
      
      // Check file size (max 1GB)
      if (stats.size > 1024 * 1024 * 1024) {
        return false
      }

      // Quick validation by trying to read the archive header
      if (ext === '.zip') {
        return this.validateZipHeader(archivePath)
      }
      
      return true // For RAR and 7z, assume valid if file exists
    } catch {
      return false
    }
  }

  private async validateZipHeader(zipPath: string): Promise<boolean> {
    try {
      const buffer = Buffer.alloc(4)
      const file = await fs.open(zipPath, 'r')
      
      try {
        await file.read(buffer, 0, 4, 0)
        // ZIP file signature: 0x504b0304 or 0x504b0506 or 0x504b0708
        const signature = buffer.readUInt32LE(0)
        return signature === 0x04034b50 || signature === 0x06054b50 || signature === 0x08074b50
      } finally {
        await file.close()
      }
    } catch {
      return false
    }
  }

  async findModFiles(extractedFiles: ExtractedFile[]): Promise<ExtractedFile[]> {
    return extractedFiles.filter(file => file.isModFile)
  }

  async cleanupTempFiles(extractedFiles: ExtractedFile[]): Promise<void> {
    for (const file of extractedFiles) {
      try {
        await fs.unlink(file.extractedPath)
      } catch (error) {
        console.warn(`Failed to cleanup temp file ${file.extractedPath}:`, error)
      }
    }
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath)
    } catch {
      await fs.mkdir(dirPath, { recursive: true })
    }
  }

  updateTempDirectory(tempDirectory: string): void {
    this.tempDirectory = tempDirectory
  }

  /**
   * Extract archive and group mod files by their relationships
   */
  async extractAndGroupMods(
    archivePath: string,
    onProgress?: (progress: ExtractionProgress) => void
  ): Promise<ExtractedModGroups> {
    const tempDir = path.join(this.tempDirectory, `extract_${Date.now()}`)
    await this.ensureDirectoryExists(tempDir)

    const extractedFiles = await this.extractArchive(archivePath, tempDir, onProgress)
    const modGroups = this.groupModFiles(extractedFiles, tempDir)

    // Simple single-mod detection: 1 .pak file = single mod, 2+ .pak files = multiple mods
    const isSingleMod = modGroups.length === 1
    
    console.log(`[ArchiveExtractor] Found ${modGroups.length} mod groups (${modGroups.map(g => g.name).join(', ')})`)
    console.log(`[ArchiveExtractor] Single-mod detection: ${isSingleMod ? 'SINGLE MOD' : 'MULTIPLE MODS'} (${modGroups.length} .pak files)`)

    return {
      groups: modGroups,
      tempDirectory: tempDir,
      isSingleMod
    }
  }

  /**
   * Group mod files (.pak) with their associated files (.ucas, .utoc)
   * Enhanced to handle deeply nested directory structures
   */
  private groupModFiles(extractedFiles: ExtractedFile[], basePath: string): ModGroup[] {
    console.log(`[ArchiveExtractor] Grouping mod files from ${extractedFiles.length} extracted files`)
    
    const groups: ModGroup[] = []
    const pakFiles = extractedFiles.filter(file => file.originalPath.toLowerCase().endsWith('.pak'))
    
    console.log(`[ArchiveExtractor] Found ${pakFiles.length} .pak files:`)
    pakFiles.forEach(file => {
      console.log(`  - ${file.originalPath} (size: ${file.size})`)
    })

    for (const pakFile of pakFiles) {
      const baseName = this.getBaseFileName(pakFile.originalPath)
      const folder = this.getParentFolder(pakFile.originalPath)
      
      console.log(`[ArchiveExtractor] Processing .pak file: ${baseName} in folder: ${folder || 'root'}`)
      
      // Find associated files (.ucas, .utoc) with the same base name
      // Look for files in the same directory as the .pak file
      const pakDir = path.dirname(pakFile.originalPath)
      const associatedFiles = extractedFiles
        .filter(file => {
          const fileDir = path.dirname(file.originalPath)
          const fileBase = this.getBaseFileName(file.originalPath)
          const fileExt = path.extname(file.originalPath).toLowerCase()
          
          // Must be in same directory, same base name, and be .ucas/.utoc
          return fileDir === pakDir && fileBase === baseName && ['.ucas', '.utoc'].includes(fileExt)
        })
        .map(file => file.extractedPath)

      console.log(`[ArchiveExtractor] Found ${associatedFiles.length} associated files for ${baseName}`)

      // Calculate total size
      const totalSize = [pakFile, ...extractedFiles.filter(file => associatedFiles.includes(file.extractedPath))]
        .reduce((sum, file) => sum + file.size, 0)

      const modGroup: ModGroup = {
        id: `${baseName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: baseName,
        pakFile: pakFile.extractedPath,
        associatedFiles,
        size: totalSize,
        folder: folder || undefined
      }

      console.log(`[ArchiveExtractor] Created mod group: ${modGroup.name} (${modGroup.associatedFiles.length} associated files, ${totalSize} bytes)`)
      groups.push(modGroup)
    }

    // Sort by name for consistent ordering
    groups.sort((a, b) => a.name.localeCompare(b.name))
    
    console.log(`[ArchiveExtractor] Created ${groups.length} mod groups total`)
    return groups
  }

  /**
   * Get base filename without extension
   */
  private getBaseFileName(filePath: string): string {
    const fileName = path.basename(filePath)
    return path.parse(fileName).name
  }

  /**
   * Get parent folder of the file (for organization detection)
   */
  private getParentFolder(filePath: string): string | null {
    const dirname = path.dirname(filePath)
    if (dirname === '.' || dirname === '/') {
      return null
    }
    
    // Get the immediate parent folder name
    const parts = dirname.split(path.sep).filter(part => part && part !== '.')
    return parts.length > 0 ? parts[parts.length - 1] : null
  }

  /**
   * Install selected mod groups to the game directory
   */
  async installSelectedModGroups(
    selectedGroups: ModGroup[],
    modsDirectory: string
  ): Promise<string[]> {
    const installedPaths: string[] = []

    for (const group of selectedGroups) {
      try {
        // Install the main .pak file
        const pakFileName = path.basename(group.pakFile)
        const pakTargetPath = path.join(modsDirectory, pakFileName)
        await fs.copyFile(group.pakFile, pakTargetPath)
        installedPaths.push(pakTargetPath)

        // Install associated files
        for (const associatedFile of group.associatedFiles) {
          const fileName = path.basename(associatedFile)
          const targetPath = path.join(modsDirectory, fileName)
          await fs.copyFile(associatedFile, targetPath)
          installedPaths.push(targetPath)
        }

        console.log(`[ArchiveExtractor] Installed mod group: ${group.name}`)
      } catch (error) {
        console.error(`[ArchiveExtractor] Error installing mod group ${group.name}:`, error)
        throw error
      }
    }

    return installedPaths
  }

  /**
   * Clean up temp files for specific mod groups
   */
  async cleanupModGroups(groups: ModGroup[]): Promise<void> {
    for (const group of groups) {
      try {
        // Clean up pak file
        await fs.unlink(group.pakFile)
        
        // Clean up associated files
        for (const file of group.associatedFiles) {
          await fs.unlink(file)
        }
      } catch (error) {
        console.warn(`Failed to cleanup mod group ${group.name}:`, error)
      }
    }
  }
}