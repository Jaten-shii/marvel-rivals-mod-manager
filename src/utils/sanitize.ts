/**
 * Sanitize a string to be used as a folder name
 * Removes or replaces invalid characters for Windows file systems
 */
export function sanitizeFolderName(name: string): string {
  return name
    // Remove invalid Windows filename characters: < > : " / \ | ? *
    .replace(/[<>:"/\\|?*]/g, '')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Replace spaces with hyphens
    .replace(/\s/g, '-')
    // Remove leading/trailing hyphens and periods
    .replace(/^[-. ]+|[-. ]+$/g, '')
    // Limit length to 100 characters (Windows has 255 char path limit)
    .slice(0, 100)
    // Ensure it's not empty
    || 'Untitled-Mod';
}

/**
 * Extract a clean mod name from a file path
 */
export function extractModNameFromPath(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  const fileName = parts[parts.length - 1] || filePath;

  // Remove extension
  const nameWithoutExt = fileName.replace(/\.(pak|zip|rar|7z)$/i, '');

  // Remove common suffixes
  const cleaned = nameWithoutExt
    .replace(/_P$/i, '')  // Remove _P suffix
    .replace(/_pak$/i, '')  // Remove _pak suffix
    .replace(/[-_]v?\d+(\.\d+)*$/i, '');  // Remove version numbers

  return cleaned;
}
