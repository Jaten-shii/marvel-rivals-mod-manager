import { promises as fs } from 'node:fs'
import path from 'node:path'

/**
 * ThumbnailProcessor service for handling image optimization and 16:9 aspect ratio cropping
 * Requires Sharp library: pnpm add sharp @types/sharp
 */
export class ThumbnailProcessor {
  private readonly targetAspectRatio = 16 / 9
  private readonly maxWidth = 512
  private readonly maxHeight = 288 // 512 / (16/9) = 288
  private readonly quality = 85

  /**
   * Process an image file to create a 16:9 thumbnail
   * @param inputPath - Path to the source image
   * @param outputPath - Path where the processed thumbnail will be saved
   * @returns Promise<string> - Path to the processed thumbnail
   */
  async processImage(inputPath: string, outputPath: string): Promise<string> {
    try {
      // Dynamic import to handle cases where Sharp might not be installed
      const sharp = await this.loadSharp()
      
      // Get image metadata
      const image = sharp(inputPath)
      const metadata = await image.metadata()
      
      if (!metadata.width || !metadata.height) {
        throw new Error('Unable to read image dimensions')
      }

      console.log(`Processing image: ${metadata.width}x${metadata.height} -> 16:9 thumbnail`)

      // Calculate crop dimensions for 16:9 aspect ratio
      const cropDimensions = this.calculateCropDimensions(metadata.width, metadata.height)
      
      // Process the image: crop to 16:9, resize, and optimize
      await image
        .extract({
          left: cropDimensions.left,
          top: cropDimensions.top,
          width: cropDimensions.width,
          height: cropDimensions.height
        })
        .resize(this.maxWidth, this.maxHeight, {
          fit: 'cover',
          position: 'center'
        })
        .webp({ quality: this.quality })
        .toFile(outputPath)

      console.log(`Thumbnail processed successfully: ${outputPath}`)
      return outputPath
    } catch (error) {
      console.error('Error processing thumbnail:', error)
      
      // Fallback: if Sharp processing fails, copy the original file
      await this.fallbackCopy(inputPath, outputPath)
      return outputPath
    }
  }

  /**
   * Process an image from a buffer (useful for downloaded images)
   * @param buffer - Image buffer data
   * @param outputPath - Path where the processed thumbnail will be saved
   * @returns Promise<string> - Path to the processed thumbnail
   */
  async processBuffer(buffer: Buffer, outputPath: string): Promise<string> {
    try {
      const sharp = await this.loadSharp()
      
      // Get image metadata from buffer
      const image = sharp(buffer)
      const metadata = await image.metadata()
      
      if (!metadata.width || !metadata.height) {
        throw new Error('Unable to read image dimensions from buffer')
      }

      console.log(`Processing image buffer: ${metadata.width}x${metadata.height} -> 16:9 thumbnail`)

      // Calculate crop dimensions for 16:9 aspect ratio
      const cropDimensions = this.calculateCropDimensions(metadata.width, metadata.height)
      
      // Process the image: crop to 16:9, resize, and optimize
      await image
        .extract({
          left: cropDimensions.left,
          top: cropDimensions.top,
          width: cropDimensions.width,
          height: cropDimensions.height
        })
        .resize(this.maxWidth, this.maxHeight, {
          fit: 'cover',
          position: 'center'
        })
        .webp({ quality: this.quality })
        .toFile(outputPath)

      console.log(`Thumbnail processed successfully from buffer: ${outputPath}`)
      return outputPath
    } catch (error) {
      console.error('Error processing thumbnail from buffer:', error)
      
      // Fallback: save the original buffer
      await fs.writeFile(outputPath, buffer)
      return outputPath
    }
  }

  /**
   * Calculate crop dimensions to achieve 16:9 aspect ratio
   * Uses smart cropping to preserve the center of the image
   */
  private calculateCropDimensions(width: number, height: number): {
    left: number
    top: number
    width: number
    height: number
  } {
    const currentAspectRatio = width / height

    if (Math.abs(currentAspectRatio - this.targetAspectRatio) < 0.01) {
      // Already close to 16:9, use full image
      return { left: 0, top: 0, width, height }
    }

    let cropWidth: number
    let cropHeight: number

    if (currentAspectRatio > this.targetAspectRatio) {
      // Image is wider than 16:9, crop width
      cropHeight = height
      cropWidth = Math.round(height * this.targetAspectRatio)
    } else {
      // Image is taller than 16:9, crop height
      cropWidth = width
      cropHeight = Math.round(width / this.targetAspectRatio)
    }

    // Center the crop
    const left = Math.max(0, Math.round((width - cropWidth) / 2))
    const top = Math.max(0, Math.round((height - cropHeight) / 2))

    return {
      left,
      top,
      width: cropWidth,
      height: cropHeight
    }
  }

  /**
   * Dynamically load Sharp library with error handling
   */
  private async loadSharp(): Promise<any> {
    try {
      const sharp = (await import('sharp')).default
      return sharp
    } catch (error) {
      throw new Error(
        'Sharp library is not installed. Please run: pnpm add sharp @types/sharp'
      )
    }
  }

  /**
   * Fallback function to copy original file when Sharp processing fails
   */
  private async fallbackCopy(inputPath: string, outputPath: string): Promise<void> {
    try {
      console.log('Using fallback: copying original file')
      await fs.copyFile(inputPath, outputPath)
    } catch (error) {
      console.error('Fallback copy also failed:', error)
      throw new Error('Failed to process image and fallback copy failed')
    }
  }

  /**
   * Validate if an image file is supported
   */
  async validateImage(filePath: string): Promise<boolean> {
    try {
      const sharp = await this.loadSharp()
      const metadata = await sharp(filePath).metadata()
      return !!(metadata.width && metadata.height)
    } catch (error) {
      console.error('Image validation failed:', error)
      return false
    }
  }

  /**
   * Get optimized file extension based on image type
   */
  getOptimizedExtension(originalExtension: string): string {
    // For thumbnails, we convert everything to WebP for better compression
    // while maintaining quality
    return '.webp'
  }
}

// Singleton instance
export const thumbnailProcessor = new ThumbnailProcessor()