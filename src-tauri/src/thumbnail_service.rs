use image::{DynamicImage, ImageFormat, imageops::FilterType};
use std::path::{Path, PathBuf};
use reqwest;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CropData {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug)]
pub enum ThumbnailError {
    DownloadFailed(String),
    ImageProcessingFailed(String),
    IoError(String),
}

impl std::fmt::Display for ThumbnailError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ThumbnailError::DownloadFailed(msg) => write!(f, "Download failed: {}", msg),
            ThumbnailError::ImageProcessingFailed(msg) => write!(f, "Image processing failed: {}", msg),
            ThumbnailError::IoError(msg) => write!(f, "IO error: {}", msg),
        }
    }
}

impl std::error::Error for ThumbnailError {}

pub struct ThumbnailService {
    metadata_dir: PathBuf,
}

impl ThumbnailService {
    pub fn new(metadata_dir: PathBuf) -> Self {
        Self { metadata_dir }
    }

    /// Downloads an image from a URL (supports both HTTP URLs and data URLs)
    pub async fn download_image(&self, url: &str) -> Result<DynamicImage, ThumbnailError> {
        // Check if this is a data URL (e.g., data:image/png;base64,...)
        if url.starts_with("data:") {
            // Parse data URL
            let parts: Vec<&str> = url.splitn(2, ',').collect();
            if parts.len() != 2 {
                return Err(ThumbnailError::DownloadFailed(
                    "Invalid data URL format".to_string()
                ));
            }

            // Decode base64 data
            use base64::{Engine as _, engine::general_purpose};
            let bytes = general_purpose::STANDARD
                .decode(parts[1])
                .map_err(|e| ThumbnailError::DownloadFailed(format!("Failed to decode base64: {}", e)))?;

            // Load image from bytes
            let img = image::load_from_memory(&bytes)
                .map_err(|e| ThumbnailError::ImageProcessingFailed(e.to_string()))?;

            return Ok(img);
        }

        // Regular HTTP/HTTPS URL - download it
        // Create HTTP client with custom Accept header
        // Request formats we support (no AVIF) so server sends compatible format
        let client = reqwest::Client::new();
        let response = client
            .get(url)
            .header("Accept", "image/webp,image/png,image/jpeg,image/*;q=0.9,*/*;q=0.8")
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            .send()
            .await
            .map_err(|e| ThumbnailError::DownloadFailed(e.to_string()))?;

        if !response.status().is_success() {
            return Err(ThumbnailError::DownloadFailed(format!(
                "HTTP error: {}",
                response.status()
            )));
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| ThumbnailError::DownloadFailed(e.to_string()))?;

        // Load image from bytes
        let img = image::load_from_memory(&bytes)
            .map_err(|e| ThumbnailError::ImageProcessingFailed(e.to_string()))?;

        Ok(img)
    }

    /// Resizes an image to the specified dimensions
    pub fn resize_image(
        &self,
        img: &DynamicImage,
        width: u32,
        height: u32,
    ) -> DynamicImage {
        img.resize_exact(width, height, FilterType::Lanczos3)
    }

    /// Crops an image based on the provided crop data
    pub fn crop_image(
        &self,
        img: &DynamicImage,
        crop_data: &CropData,
    ) -> Result<DynamicImage, ThumbnailError> {
        // Validate crop dimensions
        if crop_data.x + crop_data.width > img.width()
            || crop_data.y + crop_data.height > img.height() {
            return Err(ThumbnailError::ImageProcessingFailed(
                "Crop dimensions exceed image bounds".to_string()
            ));
        }

        // Crop the image
        let cropped = img.crop_imm(
            crop_data.x,
            crop_data.y,
            crop_data.width,
            crop_data.height,
        );

        Ok(cropped)
    }

    /// Saves a thumbnail for a mod
    pub async fn save_thumbnail(
        &self,
        mod_id: &str,
        img: &DynamicImage,
    ) -> Result<PathBuf, ThumbnailError> {
        // Ensure metadata directory exists
        std::fs::create_dir_all(&self.metadata_dir)
            .map_err(|e| ThumbnailError::IoError(e.to_string()))?;

        // Resize to high-quality thumbnail size (1920x1080 for 16:9 ratio, maintains HD quality)
        let thumbnail = self.resize_image(img, 1920, 1080);

        // Generate thumbnail path
        let thumbnail_path = self.get_thumbnail_path(mod_id);

        // Save as PNG
        thumbnail
            .save_with_format(&thumbnail_path, ImageFormat::Png)
            .map_err(|e| ThumbnailError::ImageProcessingFailed(e.to_string()))?;

        Ok(thumbnail_path)
    }

    /// Gets the path to a mod's thumbnail
    pub fn get_thumbnail_path(&self, mod_id: &str) -> PathBuf {
        self.metadata_dir.join(format!("{}_thumbnail.png", mod_id))
    }

    /// Checks if a thumbnail exists for a mod
    pub fn thumbnail_exists(&self, mod_id: &str) -> bool {
        self.get_thumbnail_path(mod_id).exists()
    }

    /// Deletes a mod's thumbnail
    pub fn delete_thumbnail(&self, mod_id: &str) -> Result<(), ThumbnailError> {
        let thumbnail_path = self.get_thumbnail_path(mod_id);

        if thumbnail_path.exists() {
            std::fs::remove_file(thumbnail_path)
                .map_err(|e| ThumbnailError::IoError(e.to_string()))?;
        }

        Ok(())
    }

    /// Downloads and saves a thumbnail from a URL
    pub async fn download_and_save_thumbnail(
        &self,
        mod_id: &str,
        url: &str,
        crop_data: Option<CropData>,
    ) -> Result<PathBuf, ThumbnailError> {
        // Download image
        let mut img = self.download_image(url).await?;

        // Apply crop if provided
        if let Some(crop) = crop_data {
            img = self.crop_image(&img, &crop)?;
        }

        // Save thumbnail
        self.save_thumbnail(mod_id, &img).await
    }

    /// Saves a thumbnail from local file path
    pub async fn save_thumbnail_from_file(
        &self,
        mod_id: &str,
        file_path: &Path,
        crop_data: Option<CropData>,
    ) -> Result<PathBuf, ThumbnailError> {
        // Load image from file
        let mut img = image::open(file_path)
            .map_err(|e| ThumbnailError::ImageProcessingFailed(e.to_string()))?;

        // Apply crop if provided
        if let Some(crop) = crop_data {
            img = self.crop_image(&img, &crop)?;
        }

        // Save thumbnail
        self.save_thumbnail(mod_id, &img).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_thumbnail_path_generation() {
        let temp_dir = PathBuf::from("/tmp/test_metadata");
        let service = ThumbnailService::new(temp_dir.clone());

        let path = service.get_thumbnail_path("test_mod_123");
        assert_eq!(
            path,
            temp_dir.join("test_mod_123_thumbnail.png")
        );
    }

    #[test]
    fn test_crop_validation() {
        let service = ThumbnailService::new(PathBuf::from("/tmp"));
        let img = DynamicImage::new_rgb8(100, 100);

        // Valid crop
        let crop = CropData {
            x: 10,
            y: 10,
            width: 50,
            height: 50,
        };
        assert!(service.crop_image(&img, &crop).is_ok());

        // Invalid crop (exceeds bounds)
        let invalid_crop = CropData {
            x: 50,
            y: 50,
            width: 100,
            height: 100,
        };
        assert!(service.crop_image(&img, &invalid_crop).is_err());
    }
}
