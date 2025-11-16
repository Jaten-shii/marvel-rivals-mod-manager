use std::fs::{self, File};
use std::io;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;
use zip::ZipArchive;
use sevenz_rust::SevenZReader;
use unrar::Archive;

const SUPPORTED_MOD_EXTENSIONS: &[&str] = &[".pak"];
const MAX_ARCHIVE_SIZE: u64 = 5 * 1024 * 1024 * 1024; // 5GB limit

#[derive(Debug, Clone, serde::Serialize)]
pub struct ExtractionProgress {
    pub current_file: String,
    pub current: usize,
    pub total: usize,
    pub bytes_extracted: u64,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedMod {
    pub pak_file: String,
    pub associated_files: Vec<String>,
    pub size: u64,
}

pub struct ArchiveExtractor {
    app_handle: AppHandle,
}

impl ArchiveExtractor {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    /// Extract a ZIP archive to the destination directory
    pub fn extract_zip(
        &self,
        archive_path: &Path,
        dest_dir: &Path,
    ) -> Result<Vec<PathBuf>, String> {
        // Validate archive size
        let metadata = fs::metadata(archive_path)
            .map_err(|e| format!("Failed to read archive metadata: {}", e))?;

        if metadata.len() > MAX_ARCHIVE_SIZE {
            return Err(format!(
                "Archive too large ({}GB). Maximum size is 5GB",
                metadata.len() / (1024 * 1024 * 1024)
            ));
        }

        // Open the ZIP file
        let file = File::open(archive_path)
            .map_err(|e| format!("Failed to open archive: {}", e))?;

        let mut archive = ZipArchive::new(file)
            .map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

        let total_files = archive.len();
        let mut extracted_mods = Vec::new();
        let mut bytes_extracted = 0u64;

        // Ensure destination directory exists
        fs::create_dir_all(dest_dir)
            .map_err(|e| format!("Failed to create destination directory: {}", e))?;

        // Extract each file
        for i in 0..total_files {
            let mut file = archive.by_index(i)
                .map_err(|e| format!("Failed to read archive entry: {}", e))?;

            let outpath = match file.enclosed_name() {
                Some(path) => dest_dir.join(path),
                None => {
                    log::warn!("Skipping file with invalid name");
                    continue;
                }
            };

            // Validate path to prevent directory traversal
            if !outpath.starts_with(dest_dir) {
                log::warn!("Skipping file with invalid path: {:?}", outpath);
                continue;
            }

            // Send progress update
            self.emit_progress(ExtractionProgress {
                current_file: file.name().to_string(),
                current: i + 1,
                total: total_files,
                bytes_extracted,
            })?;

            if file.is_dir() {
                // Create directory
                fs::create_dir_all(&outpath)
                    .map_err(|e| format!("Failed to create directory: {}", e))?;
            } else {
                // Ensure parent directory exists
                if let Some(parent) = outpath.parent() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create parent directory: {}", e))?;
                }

                // Extract file
                let mut outfile = File::create(&outpath)
                    .map_err(|e| format!("Failed to create file: {}", e))?;

                let bytes = io::copy(&mut file, &mut outfile)
                    .map_err(|e| format!("Failed to extract file: {}", e))?;

                bytes_extracted += bytes;

                // Track mod files
                if self.is_mod_file(&outpath) {
                    extracted_mods.push(outpath);
                }
            }
        }

        Ok(extracted_mods)
    }

    /// Extract a RAR archive using unrar
    pub fn extract_rar(
        &self,
        archive_path: &Path,
        dest_dir: &Path,
    ) -> Result<Vec<PathBuf>, String> {
        // Validate archive size
        let metadata = fs::metadata(archive_path)
            .map_err(|e| format!("Failed to read archive metadata: {}", e))?;

        if metadata.len() > MAX_ARCHIVE_SIZE {
            return Err(format!(
                "Archive too large ({}GB). Maximum size is 5GB",
                metadata.len() / (1024 * 1024 * 1024)
            ));
        }

        // Ensure destination directory exists
        fs::create_dir_all(dest_dir)
            .map_err(|e| format!("Failed to create destination directory: {}", e))?;

        // Open RAR archive
        let mut archive = Archive::new(archive_path)
            .open_for_processing()
            .map_err(|e| format!("Failed to open RAR archive: {}", e))?;

        let mut extracted_mods = Vec::new();
        let mut bytes_extracted = 0u64;
        let mut file_count = 0usize;

        // Process all entries
        while let Some(header) = archive.read_header().map_err(|e| format!("Failed to read header: {}", e))? {
            file_count += 1;

            let entry_name = header.entry().filename.to_string_lossy().to_string();

            // Skip directories
            if header.entry().is_directory() {
                archive = header.skip().map_err(|e| format!("Failed to skip directory: {}", e))?;
                continue;
            }

            // Build output path
            let outpath = dest_dir.join(&entry_name);

            // Validate path to prevent directory traversal
            if !outpath.starts_with(dest_dir) {
                log::warn!("Skipping file with invalid path: {:?}", outpath);
                archive = header.skip().map_err(|e| format!("Failed to skip file: {}", e))?;
                continue;
            }

            // Send progress update
            if let Err(e) = self.emit_progress(ExtractionProgress {
                current_file: entry_name.clone(),
                current: file_count,
                total: file_count, // unrar doesn't provide total count upfront
                bytes_extracted,
            }) {
                log::error!("Failed to emit progress: {}", e);
            }

            // Ensure parent directory exists
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent directory: {}", e))?;
            }

            // Extract the file
            archive = header
                .extract_to(&outpath)
                .map_err(|e| format!("Failed to extract file: {}", e))?;

            let file_size = outpath.metadata()
                .map(|m| m.len())
                .unwrap_or(0);
            bytes_extracted += file_size;

            // Check if this is a .pak file
            if let Some(ext) = outpath.extension() {
                if ext.eq_ignore_ascii_case("pak") {
                    extracted_mods.push(outpath);
                }
            }
        }

        Ok(extracted_mods)
    }

    /// Extract a 7z archive
    pub fn extract_7z(
        &self,
        archive_path: &Path,
        dest_dir: &Path,
    ) -> Result<Vec<PathBuf>, String> {
        // Validate archive size
        let metadata = fs::metadata(archive_path)
            .map_err(|e| format!("Failed to read archive metadata: {}", e))?;

        if metadata.len() > MAX_ARCHIVE_SIZE {
            return Err(format!(
                "Archive too large ({}GB). Maximum size is 5GB",
                metadata.len() / (1024 * 1024 * 1024)
            ));
        }

        // Open the archive file
        let file = File::open(archive_path)
            .map_err(|e| format!("Failed to open archive: {}", e))?;

        // Get file size
        let file_size = file.metadata()
            .map_err(|e| format!("Failed to get file metadata: {}", e))?
            .len();

        // Create 7z reader (no password)
        let mut reader = SevenZReader::new(file, file_size, sevenz_rust::Password::empty())
            .map_err(|e| format!("Failed to read archive: {}", e))?;

        // Ensure destination directory exists
        fs::create_dir_all(dest_dir)
            .map_err(|e| format!("Failed to create destination directory: {}", e))?;

        let mut extracted_mods = Vec::new();
        let mut bytes_extracted = 0u64;

        // Get archive information
        let archive = reader.archive();
        let total_files = archive.files.len();

        // Extract all files
        let mut current_index = 0;
        reader.for_each_entries(|entry, reader| {
            current_index += 1;

            // Get file name
            let file_name = entry.name();

            // Skip directories
            if entry.is_directory() {
                return Ok(true);
            }

            // Build output path
            let outpath = dest_dir.join(file_name);

            // Validate path to prevent directory traversal
            if !outpath.starts_with(dest_dir) {
                log::warn!("Skipping file with invalid path: {:?}", outpath);
                return Ok(true);
            }

            // Send progress update
            if let Err(e) = self.emit_progress(ExtractionProgress {
                current_file: file_name.to_string(),
                current: current_index,
                total: total_files,
                bytes_extracted,
            }) {
                log::error!("Failed to emit progress: {}", e);
            }

            // Ensure parent directory exists
            if let Some(parent) = outpath.parent() {
                if let Err(e) = fs::create_dir_all(parent) {
                    log::error!("Failed to create parent directory: {}", e);
                    return Err(sevenz_rust::Error::other(
                        format!("Failed to create parent directory: {}", e)
                    ));
                }
            }

            // Extract file
            let mut outfile = match File::create(&outpath) {
                Ok(f) => f,
                Err(e) => {
                    log::error!("Failed to create file: {}", e);
                    return Err(sevenz_rust::Error::other(
                        format!("Failed to create file: {}", e)
                    ));
                }
            };

            match io::copy(reader, &mut outfile) {
                Ok(bytes) => {
                    bytes_extracted += bytes;

                    // Track mod files
                    if self.is_mod_file(&outpath) {
                        extracted_mods.push(outpath);
                    }
                }
                Err(e) => {
                    log::error!("Failed to extract file: {}", e);
                    return Err(sevenz_rust::Error::other(
                        format!("Failed to extract file: {}", e)
                    ));
                }
            }

            Ok(true)
        }).map_err(|e| format!("Extraction failed: {}", e))?;

        Ok(extracted_mods)
    }

    /// Check if a file is a valid mod file
    fn is_mod_file(&self, path: &Path) -> bool {
        path.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| SUPPORTED_MOD_EXTENSIONS.contains(&format!(".{}", ext.to_lowercase()).as_str()))
            .unwrap_or(false)
    }

    /// Emit extraction progress to frontend
    fn emit_progress(&self, progress: ExtractionProgress) -> Result<(), String> {
        self.app_handle
            .emit("extraction-progress", progress)
            .map_err(|e| format!("Failed to emit progress: {}", e))
    }
}

// ===== TAURI COMMANDS =====

#[tauri::command]
pub async fn extract_archive(
    app: AppHandle,
    archive_path: String,
    dest_dir: String,
) -> Result<Vec<String>, String> {
    log::info!("Extracting archive: {} to {}", archive_path, dest_dir);

    let archive_path = PathBuf::from(archive_path);
    let dest_dir = PathBuf::from(dest_dir);

    let extractor = ArchiveExtractor::new(app);

    // Determine archive type by extension
    let extension = archive_path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase())
        .ok_or("Invalid archive file")?;

    let extracted_files = match extension.as_str() {
        "zip" => extractor.extract_zip(&archive_path, &dest_dir)?,
        "rar" => extractor.extract_rar(&archive_path, &dest_dir)?,
        "7z" => extractor.extract_7z(&archive_path, &dest_dir)?,
        _ => return Err(format!("Unsupported archive format: {}", extension)),
    };

    // Convert PathBuf to String for serialization
    let file_paths = extracted_files
        .into_iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect();

    Ok(file_paths)
}

#[tauri::command]
pub async fn detect_mods_in_archive(
    _app: AppHandle,
    archive_path: String,
) -> Result<Vec<String>, String> {
    log::info!("Detecting mods in archive: {}", archive_path);

    let archive_path = PathBuf::from(&archive_path);

    // Determine archive type by extension
    let extension = archive_path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase())
        .ok_or("Invalid archive file")?;

    let mod_files = match extension.as_str() {
        "zip" => detect_mods_in_zip(&archive_path)?,
        "rar" => detect_mods_in_rar(&archive_path)?,
        "7z" => detect_mods_in_7z(&archive_path)?,
        _ => return Err(format!("Unsupported archive format: {}", extension)),
    };

    Ok(mod_files)
}

/// Detect mod files in a ZIP archive
fn detect_mods_in_zip(archive_path: &Path) -> Result<Vec<String>, String> {
    let file = File::open(archive_path)
        .map_err(|e| format!("Failed to open archive: {}", e))?;

    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

    let mut mod_files = Vec::new();

    for i in 0..archive.len() {
        let file = archive.by_index(i)
            .map_err(|e| format!("Failed to read archive entry: {}", e))?;

        if let Some(path) = file.enclosed_name() {
            if let Some(ext) = path.extension() {
                if SUPPORTED_MOD_EXTENSIONS.contains(&format!(".{}", ext.to_string_lossy()).as_str()) {
                    mod_files.push(path.to_string_lossy().to_string());
                }
            }
        }
    }

    Ok(mod_files)
}

/// Detect mod files in a RAR archive using unrar
fn detect_mods_in_rar(archive_path: &Path) -> Result<Vec<String>, String> {
    let mut archive = Archive::new(archive_path)
        .open_for_listing()
        .map_err(|e| format!("Failed to open RAR archive: {}", e))?;

    let mut mod_files = Vec::new();

    // Iterate through all entries
    while let Some(header) = archive.read_header().map_err(|e| format!("Failed to read header: {}", e))? {
        let entry = header.entry();

        // Skip directories
        if !entry.is_directory() {
            let file_name = entry.filename.to_string_lossy().to_string();
            if let Some(ext) = Path::new(&file_name).extension() {
                if SUPPORTED_MOD_EXTENSIONS.contains(&format!(".{}", ext.to_string_lossy()).as_str()) {
                    mod_files.push(file_name);
                }
            }
        }

        // Move to next entry
        archive = header.skip().map_err(|e| format!("Failed to skip entry: {}", e))?;
    }

    Ok(mod_files)
}

/// Detect mod files in a 7z archive
fn detect_mods_in_7z(archive_path: &Path) -> Result<Vec<String>, String> {
    let file = File::open(archive_path)
        .map_err(|e| format!("Failed to open archive: {}", e))?;

    // Get file size
    let file_size = file.metadata()
        .map_err(|e| format!("Failed to get file metadata: {}", e))?
        .len();

    let reader = SevenZReader::new(file, file_size, sevenz_rust::Password::empty())
        .map_err(|e| format!("Failed to read archive: {}", e))?;

    let mut mod_files = Vec::new();

    // Get archive information
    let archive = reader.archive();

    // Scan all files for mod extensions
    for entry in &archive.files {
        if !entry.is_directory() {
            let file_name = entry.name();
            if let Some(ext) = Path::new(file_name).extension() {
                if SUPPORTED_MOD_EXTENSIONS.contains(&format!(".{}", ext.to_string_lossy()).as_str()) {
                    mod_files.push(file_name.to_string());
                }
            }
        }
    }

    Ok(mod_files)
}

/// Extract archive and detect all mods with their associated files
/// This provides more detailed information than detect_mods_in_archive
#[tauri::command]
pub async fn extract_and_detect_mods(
    app: AppHandle,
    archive_path: String,
) -> Result<Vec<DetectedMod>, String> {
    log::info!("Extracting and detecting mods in: {}", archive_path);

    let archive_path = PathBuf::from(&archive_path);

    // Create temporary directory for extraction
    let temp_dir = std::env::temp_dir().join(format!("marvel_rivals_extract_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()));

    log::info!("Extracting to temporary directory: {:?}", temp_dir);

    // Extract the archive
    let extractor = ArchiveExtractor::new(app);

    let extension = archive_path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase())
        .ok_or("Invalid archive file")?;

    match extension.as_str() {
        "zip" => extractor.extract_zip(&archive_path, &temp_dir)?,
        "rar" => extractor.extract_rar(&archive_path, &temp_dir)?,
        "7z" => extractor.extract_7z(&archive_path, &temp_dir)?,
        _ => return Err(format!("Unsupported archive format: {}", extension)),
    };

    // Scan extracted directory for .pak files
    let mut detected_mods = Vec::new();
    let mut processed_paks = std::collections::HashSet::new();

    for entry in WalkDir::new(&temp_dir)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        // Skip if not a file or not a .pak file
        if !entry.file_type().is_file() {
            continue;
        }

        if let Some(ext) = path.extension() {
            if ext.to_string_lossy() == "pak" {
                let pak_path_str = path.to_string_lossy().to_string();

                // Skip if already processed
                if processed_paks.contains(&pak_path_str) {
                    continue;
                }

                processed_paks.insert(pak_path_str.clone());

                // Find associated files (.ucas, .utoc)
                let mut associated_files = Vec::new();
                let base_name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
                let parent_dir = path.parent().unwrap_or(Path::new(""));

                for ext in &["ucas", "utoc"] {
                    let companion_path = parent_dir.join(format!("{}.{}", base_name, ext));
                    if companion_path.exists() {
                        associated_files.push(companion_path.to_string_lossy().to_string());
                    }
                }

                // Get file size
                let size = fs::metadata(path)
                    .map(|m| m.len())
                    .unwrap_or(0);

                detected_mods.push(DetectedMod {
                    pak_file: pak_path_str,
                    associated_files,
                    size,
                });
            }
        }
    }

    log::info!("Detected {} mods in archive", detected_mods.len());

    Ok(detected_mods)
}
