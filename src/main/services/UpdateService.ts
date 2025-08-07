import { app } from 'electron'
import * as semver from 'semver'

export interface GitHubRelease {
  tag_name: string
  name: string
  body: string
  published_at: string
  assets: Array<{
    name: string
    browser_download_url: string
    content_type: string
    size: number
  }>
  prerelease: boolean
  draft: boolean
}

export interface UpdateInfo {
  available: boolean
  currentVersion: string
  latestVersion: string
  releaseNotes?: string
  downloadUrl?: string
  publishedAt?: string
}

export class UpdateService {
  private readonly repoOwner = 'Jaten-shii'
  private readonly repoName = 'marvel-rivals-mod-manager'
  private readonly apiUrl = `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases/latest`

  /**
   * Get the current application version
   */
  getCurrentVersion(): string {
    return app.getVersion()
  }

  /**
   * Fetch the latest release from GitHub
   */
  async fetchLatestRelease(): Promise<GitHubRelease> {
    const isDev = process.env.NODE_ENV === 'development'
    
    try {
      if (isDev) {
        console.log(`[UpdateService] Fetching latest release from: ${this.apiUrl}`)
      }

      const response = await fetch(this.apiUrl, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Marvel-Rivals-Mod-Manager'
        }
      })

      if (!response.ok) {
        let errorMessage = `GitHub API request failed: ${response.status} ${response.statusText}`
        
        // Provide specific error messages for common HTTP status codes
        switch (response.status) {
          case 404:
            errorMessage = 'Repository not found. Please check the repository configuration.'
            break
          case 403:
            errorMessage = 'GitHub API rate limit exceeded. Please try again later.'
            break
          case 500:
            errorMessage = 'GitHub API server error. Please try again later.'
            break
          case 502:
          case 503:
          case 504:
            errorMessage = 'GitHub API is temporarily unavailable. Please try again later.'
            break
        }
        
        throw new Error(errorMessage)
      }

      const release: GitHubRelease = await response.json()
      
      if (isDev) {
        console.log(`[UpdateService] Found release: ${release.tag_name} (${release.name})`)
      }
      
      // Validate required fields
      if (!release.tag_name || !release.name) {
        throw new Error('Invalid release data received from GitHub API')
      }

      return release
    } catch (error) {
      console.error('[UpdateService] Error fetching latest release:', error)
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to GitHub. Please check your internet connection.')
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to fetch latest release: ${errorMessage}`)
    }
  }

  /**
   * Check if an update is available
   */
  async checkForUpdates(): Promise<UpdateInfo> {
    const isDev = process.env.NODE_ENV === 'development'
    
    try {
      const currentVersion = this.getCurrentVersion()
      const latestRelease = await this.fetchLatestRelease()
      
      // Clean version strings (remove 'v' prefix if present)
      const cleanCurrentVersion = currentVersion.replace(/^v/, '')
      const cleanLatestVersion = latestRelease.tag_name.replace(/^v/, '')

      // Compare versions using semver
      const isUpdateAvailable = semver.gt(cleanLatestVersion, cleanCurrentVersion)

      // Find the setup.exe asset
      const setupAsset = latestRelease.assets.find(asset => 
        asset.name.includes('Setup') && 
        asset.name.endsWith('.exe') &&
        asset.content_type === 'application/x-msdownload'
      )

      const updateInfo: UpdateInfo = {
        available: isUpdateAvailable,
        currentVersion: cleanCurrentVersion,
        latestVersion: cleanLatestVersion,
        releaseNotes: latestRelease.body,
        downloadUrl: setupAsset?.browser_download_url,
        publishedAt: latestRelease.published_at
      }

      if (isDev) {
        console.log(`[UpdateService] Update check result:`)
        console.log(`  Current: v${cleanCurrentVersion}`)
        console.log(`  Latest: v${cleanLatestVersion}`)
        console.log(`  Update available: ${isUpdateAvailable}`)
        console.log(`  Setup asset found: ${!!setupAsset}`)
      }

      // Log the result for both dev and production
      if (isUpdateAvailable) {
        console.log(`[UpdateService] Update available: v${cleanCurrentVersion} -> v${cleanLatestVersion}`)
      } else {
        console.log(`[UpdateService] Already up to date: v${cleanCurrentVersion}`)
      }

      return updateInfo
    } catch (error) {
      console.error('[UpdateService] Error checking for updates:', error)
      
      // Re-throw with context for the UI layer to handle
      throw error
    }
  }

  /**
   * Format release notes for display
   */
  formatReleaseNotes(body: string): string {
    if (!body) return 'No release notes available.'
    
    // Clean up markdown formatting for better display
    let formatted = body
      .replace(/^#+\s*/gm, '') // Remove markdown headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
      .replace(/__(.*?)__/g, '$1') // Remove underline formatting
      .replace(/`([^`]+)`/g, '$1') // Remove inline code formatting
      .trim()

    return formatted
  }

  /**
   * Validate that a version string is valid semver
   */
  isValidVersion(version: string): boolean {
    return semver.valid(version.replace(/^v/, '')) !== null
  }

  /**
   * Get release info for debugging/display
   */
  async getDebugInfo(): Promise<{
    currentVersion: string
    apiUrl: string
    repoInfo: { owner: string; name: string }
  }> {
    return {
      currentVersion: this.getCurrentVersion(),
      apiUrl: this.apiUrl,
      repoInfo: {
        owner: this.repoOwner,
        name: this.repoName
      }
    }
  }
}

// Export singleton instance
export const updateService = new UpdateService()