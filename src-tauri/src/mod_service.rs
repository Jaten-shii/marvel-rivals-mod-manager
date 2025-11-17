use crate::types::*;
use chrono::Utc;
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

const SUPPORTED_EXTENSIONS: &[&str] = &[".pak"];

pub struct ModService {
    mods_directory: PathBuf,
    disabled_mods_directory: PathBuf,
    metadata_directory: PathBuf,
    thumbnails_directory: PathBuf,
}

impl ModService {
    pub fn new(game_directory: PathBuf, metadata_directory: PathBuf) -> Self {
        // Construct the full path to the mods directory
        // Path: MarvelRivals\MarvelGame\Marvel\Content\Paks\~mods
        let mods_directory = game_directory
            .join("MarvelGame")
            .join("Marvel")
            .join("Content")
            .join("Paks")
            .join("~mods");

        let disabled_mods_directory = metadata_directory.join("disabled-mods");
        let thumbnails_directory = metadata_directory.parent()
            .map(|p| p.join("thumbnails"))
            .unwrap_or_else(|| metadata_directory.join("../thumbnails"));

        Self {
            mods_directory,
            disabled_mods_directory,
            metadata_directory,
            thumbnails_directory,
        }
    }

    /// Get all mods in the mods directory
    pub fn get_all_mods(&self) -> Result<Vec<ModInfo>, String> {
        self.ensure_directory_exists(&self.mods_directory)?;
        self.ensure_directory_exists(&self.disabled_mods_directory)?;

        let mut mods = Vec::new();
        let mut processed_paths = HashSet::new();
        let mut processed_ids = HashSet::new();

        // Scan active mods directory
        self.scan_directory_with_deduplication(
            &self.mods_directory,
            &mut mods,
            &mut processed_paths,
            &mut processed_ids,
            true,
        )?;

        let active_count = mods.len();

        // Scan disabled mods directory
        self.scan_directory_with_deduplication(
            &self.disabled_mods_directory,
            &mut mods,
            &mut processed_paths,
            &mut processed_ids,
            false,
        )?;

        // Sort by name
        mods.sort_by(|a, b| a.name.cmp(&b.name));

        Ok(mods)
    }

    /// Install a mod from a file path
    pub fn install_mod(&self, file_path: &Path) -> Result<ModInfo, String> {
        // Validate file extension
        if !self.is_mod_file(file_path) {
            return Err("Invalid file type. Only .pak files are supported.".to_string());
        }

        // Copy file to mods directory
        let file_name = file_path
            .file_name()
            .ok_or("Invalid file path")?
            .to_str()
            .ok_or("Invalid file name")?;

        let dest_path = self.mods_directory.join(file_name);

        fs::copy(file_path, &dest_path)
            .map_err(|e| format!("Failed to copy mod file: {}", e))?;

        // Create mod info
        self.create_mod_info(&dest_path, file_name, true)
            .ok_or_else(|| "Failed to create mod info".to_string())
    }

    /// Install a mod to a specific folder within the mods directory
    /// This is used for organizing mods from archives into their own folders
    /// Install a mod to a folder with custom metadata (all in one operation)
    pub fn install_mod_to_folder_with_metadata(
        &self,
        file_path: &Path,
        folder_name: &str,
        metadata: ModMetadata,
    ) -> Result<ModInfo, String> {
        // Validate file extension
        if !self.is_mod_file(file_path) {
            return Err("Invalid file type. Only .pak files are supported.".to_string());
        }

        // Create folder in mods directory
        let folder_path = self.mods_directory.join(folder_name);
        self.ensure_directory_exists(&folder_path)?;

        // Get file name
        let file_name = file_path
            .file_name()
            .ok_or("Invalid file path")?
            .to_str()
            .ok_or("Invalid file name")?;

        let dest_path = folder_path.join(file_name);

        // Copy main pak file
        fs::copy(file_path, &dest_path)
            .map_err(|e| format!("Failed to copy mod file: {}", e))?;

        // Copy associated files (.ucas, .utoc) if they exist
        let base_name = file_path
            .file_stem()
            .and_then(|s| s.to_str())
            .ok_or("Invalid file name")?;

        let source_directory = file_path.parent().ok_or("Invalid directory")?;

        for ext in &[".ucas", ".utoc"] {
            let companion_source = source_directory.join(format!("{}{}", base_name, ext));
            if companion_source.exists() {
                let companion_dest = folder_path.join(format!("{}{}", base_name, ext));
                fs::copy(&companion_source, &companion_dest)
                    .map_err(|e| format!("Failed to copy companion file: {}", e))?;
            }
        }

        // Create mod info with the provided metadata
        let clean_file_name = file_name.replace(".disabled", "");
        let mod_id = self.generate_mod_id_from_path(&dest_path, &clean_file_name);

        // Save the provided metadata immediately
        self.save_metadata(&mod_id, &metadata)?;
        log::info!("Saved custom metadata for newly installed mod: {}", mod_id);

        // Build complete ModInfo
        let metadata_fs = fs::metadata(&dest_path)
            .map_err(|e| format!("Failed to get file metadata: {}", e))?;
        let associated_files = self.find_associated_files(&dest_path).unwrap_or_default();
        let thumbnail_path = self.find_thumbnail(&mod_id, &clean_file_name);

        Ok(ModInfo {
            id: mod_id.clone(),
            name: metadata.title.clone(),
            category: metadata.category.clone(),
            character: metadata.character.clone(),
            enabled: true,
            is_favorite: metadata.is_favorite,
            file_path: dest_path,
            thumbnail_path,
            file_size: metadata_fs.len(),
            install_date: metadata.install_date,
            last_modified: metadata_fs.modified().ok().map(|t| t.into()).unwrap_or(Utc::now()),
            original_file_name: clean_file_name,
            associated_files,
            metadata,
        })
    }

    pub fn install_mod_to_folder(&self, file_path: &Path, folder_name: &str) -> Result<ModInfo, String> {
        // Validate file extension
        if !self.is_mod_file(file_path) {
            return Err("Invalid file type. Only .pak files are supported.".to_string());
        }

        // Create folder in mods directory
        let folder_path = self.mods_directory.join(folder_name);
        self.ensure_directory_exists(&folder_path)?;

        // Get file name
        let file_name = file_path
            .file_name()
            .ok_or("Invalid file path")?
            .to_str()
            .ok_or("Invalid file name")?;

        let dest_path = folder_path.join(file_name);

        // Copy main pak file
        fs::copy(file_path, &dest_path)
            .map_err(|e| format!("Failed to copy mod file: {}", e))?;

        // Copy associated files (.ucas, .utoc) if they exist
        let base_name = file_path
            .file_stem()
            .and_then(|s| s.to_str())
            .ok_or("Invalid file name")?;

        let source_directory = file_path.parent().ok_or("Invalid directory")?;

        for ext in &[".ucas", ".utoc"] {
            let companion_source = source_directory.join(format!("{}{}", base_name, ext));
            if companion_source.exists() {
                let companion_dest = folder_path.join(format!("{}{}", base_name, ext));
                fs::copy(&companion_source, &companion_dest)
                    .map_err(|e| format!("Failed to copy companion file: {}", e))?;
            }
        }

        // Create mod info
        let mod_info = self.create_mod_info(&dest_path, file_name, true)
            .ok_or_else(|| "Failed to create mod info".to_string())?;

        // CRITICAL FIX: Save the default metadata immediately after installation
        // This ensures the mod is reliably findable when update_metadata is called shortly after
        self.save_metadata(&mod_info.id, &mod_info.metadata)?;
        log::info!("Saved initial metadata for newly installed mod: {}", mod_info.id);

        Ok(mod_info)
    }

    /// Organize loose mods into proper folder structure
    /// Returns the number of mods that were organized
    pub fn organize_loose_mods(&self) -> Result<usize, String> {
        log::info!("🔍 Checking for loose mods...");
        let all_mods = self.get_all_mods()?;
        let mut organized_count = 0;

        for mod_info in all_mods {
            if !mod_info.enabled {
                continue;
            }

            let file_path = &mod_info.file_path;
            let parent_dir = file_path.parent().ok_or("Invalid file path")?;
            let is_loose = parent_dir == self.mods_directory;

            if is_loose {
                // Build folder structure - all categories include character subfolder when character is specified
                let mut folder_parts = vec![mod_info.category.to_string()];

                // Include character subfolder if character is specified
                if let Some(ref character) = mod_info.character {
                    folder_parts.push(character.to_string());
                }

                folder_parts.push(sanitize_folder_name(&mod_info.name));

                let target_folder = folder_parts.iter()
                    .fold(self.mods_directory.clone(), |path, part| path.join(part));

                fs::create_dir_all(&target_folder)
                    .map_err(|e| format!("Failed to create target directory: {}", e))?;

                for file_path in &mod_info.associated_files {
                    let file_name = file_path.file_name()
                        .ok_or("Invalid file name")?;
                    let target_path = target_folder.join(file_name);
                    fs::rename(file_path, &target_path)
                        .map_err(|e| format!("Failed to move file: {}", e))?;
                }

                organized_count += 1;
            }
        }

        if organized_count > 0 {
            log::info!("   ✅ Organized {} loose mod(s) into folders", organized_count);

            // Clean up any empty folders after organizing
            if let Ok(cleaned) = self.cleanup_empty_mod_folders() {
                if cleaned > 0 {
                    log::info!("   ✅ Cleaned up {} empty folder(s)", cleaned);
                }
            }
        } else {
            log::info!("   ✅ All mods already organized");
        }

        Ok(organized_count)
    }

    /// Merge duplicate character folders (e.g., "Black Widow" and "Black-Widow")
    /// This happens when folder naming inconsistencies occur
    /// Returns the number of folders merged
    pub fn merge_duplicate_folders(&self) -> Result<usize, String> {
        use std::collections::HashMap;

        log::info!("🔍 Checking for duplicate folders...");
        let mut merged_count = 0;

        // Scan category folders (Skins, UI, Audio, Gameplay)
        for category_entry in fs::read_dir(&self.mods_directory)
            .map_err(|e| format!("Failed to read mods directory: {}", e))?
        {
            let category_entry = category_entry
                .map_err(|e| format!("Failed to read category entry: {}", e))?;
            let category_path = category_entry.path();

            if !category_path.is_dir() {
                continue;
            }

            // Process each category separately to avoid merging across categories
            let mut character_folders: HashMap<String, Vec<PathBuf>> = HashMap::new();

            // Look for character folders within this category
            for char_entry in fs::read_dir(&category_path)
                .map_err(|e| format!("Failed to read category directory: {}", e))?
            {
                let char_entry = char_entry
                    .map_err(|e| format!("Failed to read character entry: {}", e))?;
                let char_path = char_entry.path();

                if !char_path.is_dir() {
                    continue;
                }

                if let Some(folder_name) = char_path.file_name().and_then(|n| n.to_str()) {
                    // Normalize the folder name (remove hyphens and spaces for comparison)
                    let normalized = folder_name.replace("-", "").replace(" ", "").to_lowercase();
                    character_folders.entry(normalized).or_insert_with(Vec::new).push(char_path);
                }
            }

            // Merge duplicate folders WITHIN this category only
            for (_normalized_name, paths) in character_folders {
            if paths.len() > 1 {
                // Keep the folder with the hyphenated name (our standard)
                let target_folder = paths.iter()
                    .find(|p| {
                        p.file_name()
                            .and_then(|n| n.to_str())
                            .map(|s| s.contains('-'))
                            .unwrap_or(false)
                    })
                    .or_else(|| paths.first())
                    .ok_or_else(|| "No valid target folder found".to_string())?;

                // Merge other folders into the target
                for source_folder in paths.iter() {
                    if source_folder == target_folder {
                        continue;
                    }

                    log::info!("   🔄 Merging {:?} → {:?}", source_folder.file_name(), target_folder.file_name());

                    // Move all mods from source to target
                    for entry in fs::read_dir(source_folder)
                        .map_err(|e| format!("Failed to read source folder: {}", e))?
                    {
                        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
                        let source_mod_folder = entry.path();

                        if source_mod_folder.is_dir() {
                            if let Some(mod_name) = source_mod_folder.file_name() {
                                let target_mod_folder = target_folder.join(mod_name);

                                if target_mod_folder.exists() {
                                    log::warn!("      ⚠️  Target already exists, skipping: {:?}", mod_name);
                                    continue;
                                }

                                // Move the mod folder
                                fs::rename(&source_mod_folder, &target_mod_folder)
                                    .map_err(|e| format!("Failed to move mod folder: {}", e))?;

                                // Migrate metadata to new ID (path changed)
                                // Find the .pak file to generate IDs
                                if let Ok(entries) = fs::read_dir(&target_mod_folder) {
                                    for pak_entry in entries {
                                        if let Ok(pak_entry) = pak_entry {
                                            let pak_path = pak_entry.path();
                                            if pak_path.extension().and_then(|e| e.to_str()) == Some("pak") {
                                                let file_name = pak_path.file_name()
                                                    .and_then(|n| n.to_str())
                                                    .unwrap_or("");

                                                // Generate old and new IDs
                                                let old_pak_path = source_mod_folder.join(file_name);
                                                let old_id = self.generate_mod_id_from_path(&old_pak_path, file_name);
                                                let new_id = self.generate_mod_id_from_path(&pak_path, file_name);

                                                // Migrate metadata if it exists
                                                if let Ok(Some(metadata)) = self.load_metadata(&old_id) {
                                                    log::info!("      📝 Migrating metadata: {} → {}", old_id, new_id);
                                                    let _ = self.save_metadata(&new_id, &metadata);

                                                    // Copy thumbnail if exists
                                                    let old_thumb = self.metadata_directory.join(format!("{}_thumbnail.png", old_id));
                                                    if old_thumb.exists() {
                                                        let new_thumb = self.metadata_directory.join(format!("{}_thumbnail.png", new_id));
                                                        let _ = fs::copy(&old_thumb, &new_thumb);
                                                    }

                                                    // Delete old metadata
                                                    let _ = self.delete_metadata(&old_id);
                                                }

                                                break; // Only process first .pak file
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Delete the now-empty source folder
                    self.delete_directory_with_retry(source_folder, 3)?;
                    merged_count += 1;
                }
            }
            }
        }

        if merged_count > 0 {
            log::info!("   ✅ Merged {} duplicate character folder(s)", merged_count);
        } else {
            log::info!("   ✅ No duplicate folders found");
        }

        Ok(merged_count)
    }

    /// Clean up empty mod folders (but keep category and character folders)
    /// Returns the number of empty folders removed
    pub fn cleanup_empty_mod_folders(&self) -> Result<usize, String> {
        let mut removed_count = 0;
        let mut folders_to_remove = Vec::new();

        // Collect all directories to check
        for entry in WalkDir::new(&self.mods_directory)
            .min_depth(1) // Skip the ~mods directory itself
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_dir())
        {
            let path = entry.path();

            // Skip if it's a direct child of ~mods (category folder)
            if path.parent() == Some(self.mods_directory.as_path()) {
                continue;
            }

            // Check if folder name matches a known character (keep character folders)
            if let Some(folder_name) = path.file_name().and_then(|n| n.to_str()) {
                let is_character_folder = Character::all_characters()
                    .iter()
                    .any(|character| {
                        let sanitized_char = sanitize_folder_name(&character.to_string());
                        sanitized_char.eq_ignore_ascii_case(folder_name)
                    });

                if is_character_folder {
                    continue;
                }
            }

            // Check if folder is empty (no files, only empty subdirectories)
            if is_folder_empty(path)? {
                folders_to_remove.push(path.to_path_buf());
            }
        }

        // Remove empty folders (in reverse order to remove children before parents)
        folders_to_remove.sort_by(|a, b| b.cmp(a));
        for folder in folders_to_remove {
            match fs::remove_dir_all(&folder) {
                Ok(_) => {
                    removed_count += 1;
                }
                Err(e) => {
                    log::warn!("   ⚠️  Failed to remove empty folder {:?}: {}", folder, e);
                }
            }
        }

        Ok(removed_count)
    }

    /// Enable or disable a mod
    pub fn enable_mod(&self, mod_id: &str, enabled: bool) -> Result<(), String> {
        let mod_info = self
            .find_mod_by_id(mod_id)?
            .ok_or("Mod not found")?;

        let _source_dir = if enabled {
            &self.disabled_mods_directory
        } else {
            &self.mods_directory
        };
        let dest_dir = if enabled {
            &self.mods_directory
        } else {
            &self.disabled_mods_directory
        };

        self.ensure_directory_exists(dest_dir)?;

        // Move all associated files
        for file_path in &mod_info.associated_files {
            let file_name = file_path
                .file_name()
                .ok_or("Invalid file path")?;

            let dest_path = dest_dir.join(file_name);

            fs::rename(file_path, &dest_path)
                .map_err(|e| format!("Failed to move file: {}", e))?;
        }

        Ok(())
    }

    /// Delete a mod
    pub fn delete_mod(&self, mod_id: &str) -> Result<(), String> {
        let mod_info = self
            .find_mod_by_id(mod_id)?
            .ok_or("Mod not found")?;

        // Delete all associated files
        for file_path in &mod_info.associated_files {
            fs::remove_file(file_path)
                .map_err(|e| format!("Failed to delete file: {}", e))?;
        }

        // Delete metadata
        self.delete_metadata(mod_id)?;

        // Delete thumbnail if exists
        if let Some(thumbnail_path) = mod_info.thumbnail_path {
            let _ = fs::remove_file(thumbnail_path);
        }

        // Clean up any empty folders after deleting
        if let Ok(cleaned) = self.cleanup_empty_mod_folders() {
            if cleaned > 0 {
                log::info!("Cleaned up {} empty folder(s) after deletion", cleaned);
            }
        }

        Ok(())
    }

    /// Migrate metadata and thumbnails from old filename-based IDs to new path-based IDs
    /// This is a one-time migration for existing mods when switching ID generation methods
    /// Returns the number of mods migrated
    pub fn migrate_metadata_to_path_ids(&self) -> Result<usize, String> {
        log::info!("🔍 Checking for metadata migration...");
        let all_mods = self.get_all_mods()?;
        let mut migrated_count = 0;
        let mut skipped_count = 0;
        let mut not_found_count = 0;

        for mod_info in all_mods {
            let file_path = PathBuf::from(&mod_info.file_path);
            let file_name = file_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("");

            let clean_file_name = file_name.replace(".disabled", "");

            // Calculate both IDs
            let old_id = self.generate_mod_id(&clean_file_name);
            let new_id = self.generate_mod_id_from_path(&file_path, &clean_file_name);

            // Skip if IDs are the same (shouldn't happen, but just in case)
            if old_id == new_id {
                skipped_count += 1;
                continue;
            }

            // Check if new metadata already exists (already migrated)
            if self.load_metadata(&new_id).ok().flatten().is_some() {
                skipped_count += 1;
                continue;
            }

            // Try to load old metadata
            if let Ok(Some(old_metadata)) = self.load_metadata(&old_id) {
                log::info!("Migrating metadata for mod: {} (old ID: {}, new ID: {})",
                    mod_info.name, old_id, new_id);

                // Save metadata with new ID
                self.save_metadata(&new_id, &old_metadata)?;

                // Migrate thumbnail if it exists
                // Check for thumbnail with old ID
                let old_thumb_path = self.metadata_directory.join(format!("{}_thumbnail.png", old_id));
                if old_thumb_path.exists() {
                    let new_thumb_path = self.metadata_directory.join(format!("{}_thumbnail.png", new_id));
                    if let Err(e) = fs::copy(&old_thumb_path, &new_thumb_path) {
                        log::warn!("Failed to migrate thumbnail: {}", e);
                    } else {
                        log::debug!("Migrated thumbnail for {}", mod_info.name);
                        // Delete old thumbnail after successful copy
                        let _ = fs::remove_file(&old_thumb_path);
                    }
                }

                // Delete old metadata file after successful migration
                let _ = self.delete_metadata(&old_id);

                migrated_count += 1;
            } else {
                not_found_count += 1;
            }
        }

        if migrated_count > 0 {
            log::info!("   ✅ Migrated metadata for {} mod(s)", migrated_count);
        } else {
            log::info!("   ✅ All metadata up to date");
        }
        Ok(migrated_count)
    }

    /// Copy metadata from an old mod ID to the current mod
    /// This is useful for recovering metadata after ID system changes
    pub fn copy_metadata_from_old_id(
        &self,
        current_mod_id: &str,
        old_mod_id: &str,
    ) -> Result<(), String> {
        log::info!("Copying metadata from old ID {} to current ID {}", old_mod_id, current_mod_id);

        // Load metadata from old ID
        let old_metadata = self.load_metadata(old_mod_id)?
            .ok_or_else(|| format!("No metadata found for old ID: {}", old_mod_id))?;

        // Copy thumbnail BEFORE updating metadata (in case update fails)
        let old_thumb_path = self.metadata_directory.join(format!("{}_thumbnail.png", old_mod_id));
        if old_thumb_path.exists() {
            let new_thumb_path = self.metadata_directory.join(format!("{}_thumbnail.png", current_mod_id));
            fs::copy(&old_thumb_path, &new_thumb_path)
                .map_err(|e| format!("Failed to copy thumbnail: {}", e))?;
            log::info!("Copied thumbnail from {} to {}", old_mod_id, current_mod_id);
        }

        // Use update_metadata to save the metadata AND trigger folder rename if needed
        // This ensures the mod folder gets organized properly based on the metadata
        self.update_metadata(current_mod_id, old_metadata)?;
        log::info!("Successfully copied and applied metadata from {} to {}", old_mod_id, current_mod_id);

        Ok(())
    }

    /// Update mod metadata
    pub fn update_metadata(
        &self,
        mod_id: &str,
        metadata: ModMetadata,
    ) -> Result<ModInfo, String> {
        log::info!("");
        log::info!("==========================================================");
        log::info!("📝 UPDATING MOD METADATA");
        log::info!("   Title: {}", metadata.title);
        log::info!("   Category: {}", metadata.category);
        if let Some(ref character) = metadata.character {
            log::info!("   Character: {}", character);
        }
        log::info!("==========================================================");
        log::info!("");

        // Save metadata FIRST before any folder operations
        self.save_metadata(mod_id, &metadata)?;
        log::info!("✅ Metadata saved");
        log::info!("");

        // Get fresh mod data
        let mods = self.get_all_mods()?;
        let old_mod_option = mods.into_iter().find(|m| m.id == mod_id);

        let old_mod = match old_mod_option {
            Some(m) => {
                log::info!("📍 Mod located at: {:?}", m.file_path);
                log::info!("");
                m
            }
            None => {
                log::warn!("⚠️  Mod not found in scan, returning minimal info");
                log::info!("");
                log::info!("✅ METADATA UPDATE COMPLETE (mod not in scan)");
                log::info!("==========================================================");
                log::info!("");
                return Ok(ModInfo {
                    id: mod_id.to_string(),
                    name: metadata.title.clone(),
                    category: metadata.category.clone(),
                    character: metadata.character.clone(),
                    enabled: true,
                    is_favorite: metadata.is_favorite,
                    file_path: PathBuf::new(),
                    thumbnail_path: None,
                    file_size: 0,
                    install_date: metadata.install_date,
                    last_modified: Utc::now(),
                    original_file_name: metadata.title.clone(),
                    associated_files: Vec::new(),
                    metadata: metadata.clone(),
                });
            }
        };

        // ==================== FOLDER RENAME CHECK ====================
        log::info!("");
        log::info!("📂 Checking if folder needs to be renamed...");
        log::info!("   Mod: {}", metadata.title);
        log::info!("");

        let mod_file_path = PathBuf::from(&old_mod.file_path);
        let parent_dir = mod_file_path.parent().ok_or("Invalid mod file path")?;
        let is_in_folder = parent_dir != self.mods_directory;

        if is_in_folder {
            // Build expected folder structure
            // All categories include character subfolder when character is specified
            let mut folder_parts = vec![sanitize_folder_name(&metadata.category.to_string())];

            // Include character subfolder if character is specified
            if let Some(ref character) = metadata.character {
                folder_parts.push(sanitize_folder_name(&character.to_string()));
            }

            folder_parts.push(sanitize_folder_name(&metadata.title));
            let new_folder = folder_parts.iter()
                .fold(self.mods_directory.clone(), |path, part| path.join(part));

            log::info!("   Current folder:  {:?}", parent_dir.file_name().unwrap_or_default());
            log::info!("   Expected folder: {:?}", new_folder.file_name().unwrap_or_default());
            log::info!("");

            if parent_dir != new_folder {
                    // Check if there are multiple .pak files in the current folder
                    let pak_count = fs::read_dir(parent_dir)
                        .map(|entries| {
                            entries
                                .filter_map(|e| e.ok())
                                .filter(|e| {
                                    e.path().extension()
                                        .and_then(|ext| ext.to_str())
                                        .map(|ext| ext == "pak")
                                        .unwrap_or(false)
                                })
                                .count()
                        })
                        .unwrap_or(0);

                    if pak_count > 1 {
                        // Multiple .pak files exist - move only this mod's files to a new folder
                        log::info!("   ⚠️  Multiple mods in folder ({} .pak files)", pak_count);
                        log::info!("   🔄 Moving only this mod's files to new folder...");

                        // Create the new folder
                        fs::create_dir_all(&new_folder)
                            .map_err(|e| format!("Failed to create new folder: {}", e))?;

                        // Move this mod's .pak file
                        let pak_file_name = mod_file_path.file_name()
                            .ok_or("Invalid pak file name")?;
                        let new_pak_path = new_folder.join(pak_file_name);
                        fs::rename(&mod_file_path, &new_pak_path)
                            .map_err(|e| format!("Failed to move pak file: {}", e))?;

                        // Move associated files (same base name, different extensions)
                        if let Some(base_name) = mod_file_path.file_stem() {
                            for associated_file in &old_mod.associated_files {
                                let associated_path = PathBuf::from(associated_file);
                                if let Some(assoc_stem) = associated_path.file_stem() {
                                    if assoc_stem == base_name {
                                        if let Some(file_name) = associated_path.file_name() {
                                            let new_assoc_path = new_folder.join(file_name);
                                            let _ = fs::rename(&associated_path, &new_assoc_path);
                                        }
                                    }
                                }
                            }
                        }

                        log::info!("   ✅ Mod files moved to new folder");
                    } else {
                        // Single mod in folder - rename the entire folder
                        log::info!("   ✅ RENAMING FOLDER");

                        // Create parent directories for new location
                        if let Some(new_parent) = new_folder.parent() {
                            fs::create_dir_all(new_parent)
                                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
                        }

                        // Try to rename the folder
                        match fs::rename(parent_dir, &new_folder) {
                            Ok(_) => {
                                log::info!("   ✅ Folder renamed successfully");
                            }
                            Err(e) => {
                                log::warn!("   ⚠️  Direct rename failed: {}", e);
                                log::info!("   🔄 Using copy+delete fallback...");

                                self.copy_directory_recursive(parent_dir, &new_folder)?;
                                self.delete_directory_with_retry(parent_dir, 3)?;

                                log::info!("   ✅ Folder moved successfully via copy+delete");
                            }
                        }
                    }
                    log::info!("");

                    // Migrate metadata to new ID (file path changed)
                    let new_file_path = new_folder.join(mod_file_path.file_name().unwrap());
                    let file_name_str = mod_file_path.file_name().unwrap().to_string_lossy();
                    let new_mod_id = self.generate_mod_id_from_path(&new_file_path, &file_name_str);

                    log::info!("   🔄 Migrating metadata...");
                    log::info!("      Old ID: {}", mod_id);
                    log::info!("      New ID: {}", new_mod_id);

                    if let Ok(Some(saved_metadata)) = self.load_metadata(mod_id) {
                        self.save_metadata(&new_mod_id, &saved_metadata)?;
                        log::info!("      ✅ Metadata migrated");

                        // Copy thumbnail if it exists
                        let old_thumb_path = self.metadata_directory.join(format!("{}_thumbnail.png", mod_id));
                        if old_thumb_path.exists() {
                            let new_thumb_path = self.metadata_directory.join(format!("{}_thumbnail.png", new_mod_id));
                            fs::copy(&old_thumb_path, &new_thumb_path)
                                .map_err(|e| format!("Failed to copy thumbnail: {}", e))?;
                            log::info!("      ✅ Thumbnail migrated");
                        }

                        self.delete_metadata(mod_id)?;
                        log::info!("      ✅ Old metadata cleaned up");
                    }
                    log::info!("");
                    log::info!("✅ METADATA UPDATE COMPLETE");
                    log::info!("==========================================================");
                    log::info!("");

                    // Return the mod info with new ID
                    let is_enabled = !file_name_str.ends_with(".disabled");
                    return self.create_mod_info(&new_file_path, &file_name_str, is_enabled)
                        .ok_or_else(|| "Failed to create mod info after folder rename".to_string());
                } else {
                    log::info!("   ℹ️  Folder name is already correct");
                    log::info!("");
                    log::info!("✅ METADATA UPDATE COMPLETE (no folder rename needed)");
                    log::info!("==========================================================");
                    log::info!("");
                }
            } else {
            log::info!("   ℹ️  Mod is loose in ~mods directory (no folder to rename)");
            log::info!("");
            log::info!("✅ METADATA UPDATE COMPLETE (loose mod)");
            log::info!("==========================================================");
            log::info!("");
        }

        // Return updated mod info (metadata already saved above)
        self.find_mod_by_id(mod_id)?
            .ok_or_else(|| "Mod not found after update".to_string())
    }

    /// Remove a profile ID from all mods that have it
    /// Returns the number of mods that were updated
    pub fn remove_profile_from_all_mods(&self, profile_id: &str) -> Result<usize, String> {
        log::info!("Removing profile {} from all mods", profile_id);

        // Get all mods
        let all_mods = self.get_all_mods()?;
        let mut updated_count = 0;

        // Iterate through all mods
        for mod_info in all_mods {
            // Load metadata
            if let Some(mut metadata) = self.load_metadata(&mod_info.id)? {
                // Check if this mod has profile_ids and contains the target profile
                if let Some(ref mut profile_ids) = metadata.profile_ids {
                    if profile_ids.contains(&profile_id.to_string()) {
                        // Remove the profile ID
                        profile_ids.retain(|id| id != profile_id);

                        // If profile_ids is now empty, set it to None
                        if profile_ids.is_empty() {
                            metadata.profile_ids = None;
                        }

                        // Save the updated metadata
                        self.save_metadata(&mod_info.id, &metadata)?;
                        updated_count += 1;

                        log::debug!("Removed profile {} from mod: {}", profile_id, mod_info.name);
                    }
                }
            }
        }

        log::info!("Removed profile {} from {} mods", profile_id, updated_count);
        Ok(updated_count)
    }

    // ===== Private Helper Methods =====

    fn scan_directory_with_deduplication(
        &self,
        dir_path: &Path,
        mods: &mut Vec<ModInfo>,
        processed_paths: &mut HashSet<PathBuf>,
        processed_ids: &mut HashSet<String>,
        is_enabled: bool,
    ) -> Result<(), String> {
        let mut file_count = 0;
        let mut pak_count = 0;

        for entry in WalkDir::new(dir_path)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();

            if entry.file_type().is_file() {
                file_count += 1;
            }

            if !entry.file_type().is_file() || !self.is_mod_file(path) {
                continue;
            }

            pak_count += 1;

            let normalized_path = path.to_path_buf();
            if processed_paths.contains(&normalized_path) {
                continue;
            }

            let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

            if let Some(mod_info) = self.create_mod_info(path, file_name, is_enabled) {
                if processed_ids.contains(&mod_info.id) {
                    continue;
                }

                processed_paths.insert(normalized_path);
                processed_ids.insert(mod_info.id.clone());
                mods.push(mod_info);
            } else {
                log::warn!("⚠️  Failed to create mod info for: {:?}", path);
            }
        }

        Ok(())
    }

    fn create_mod_info(&self, file_path: &Path, file_name: &str, is_enabled: bool) -> Option<ModInfo> {
        let metadata_result = fs::metadata(file_path);
        if metadata_result.is_err() {
            return None;
        }
        let metadata_fs = metadata_result.ok()?;

        let clean_file_name = file_name.replace(".disabled", "");
        // Use path-based ID to prevent duplicates when same mod installed multiple times
        let mod_id = self.generate_mod_id_from_path(file_path, &clean_file_name);

        // Load metadata if exists
        let metadata = self.load_metadata(&mod_id).ok().flatten().unwrap_or_else(|| {
            let category = self.detect_category_from_path(file_path, &clean_file_name);
            let character = self.detect_character_from_path(file_path, &clean_file_name);
            let now = Utc::now();

            ModMetadata {
                title: self.extract_mod_name(&clean_file_name),
                description: String::new(),
                author: None,
                version: None,
                tags: Vec::new(),
                category,
                character,
                costume: None,
                is_favorite: false,
                is_nsfw: false,
                created_at: now,
                updated_at: now,
                install_date: now,
                profile_ids: None,
                nexus_mod_id: None,
                nexus_file_id: None,
                nexus_version: None,
            }
        });

        let associated_files = self.find_associated_files(file_path).ok()?;

        // Look for thumbnail (check mod_id first, then filename)
        let thumbnail_path = self.find_thumbnail(&mod_id, &clean_file_name);

        Some(ModInfo {
            id: mod_id.clone(),
            name: metadata.title.clone(),
            category: metadata.category.clone(),
            character: metadata.character.clone(),
            enabled: is_enabled,
            is_favorite: metadata.is_favorite,
            file_path: file_path.to_path_buf(),
            thumbnail_path,
            file_size: metadata_fs.len(),
            install_date: metadata.install_date,
            last_modified: metadata_fs.modified().ok().map(|t| t.into()).unwrap_or(Utc::now()),
            original_file_name: clean_file_name,
            associated_files,
            metadata,
        })
    }

    fn find_thumbnail(&self, mod_id: &str, file_name: &str) -> Option<PathBuf> {
        // Try common thumbnail formats
        let extensions = ["webp", "png", "jpg", "jpeg"];

        // First priority: Check for new thumbnail format in metadata directory
        let new_thumbnail_path = self.metadata_directory.join(format!("{}_thumbnail.png", mod_id));
        if new_thumbnail_path.exists() {
            return Some(new_thumbnail_path);
        }

        // Second priority: Check for mod_id-based thumbnails in thumbnails directory (from old Electron app)
        for ext in &extensions {
            let id_thumbnail = format!("{}.{}", mod_id, ext);
            let id_path = self.thumbnails_directory.join(&id_thumbnail);

            if id_path.exists() {
                return Some(id_path);
            }
        }

        // Fall back to filename-based thumbnails
        let base_name = Path::new(file_name)
            .file_stem()
            .and_then(|s| s.to_str())?;

        for ext in &extensions {
            let thumbnail_name = format!("{}.{}", base_name, ext);
            let thumbnail_path = self.thumbnails_directory.join(&thumbnail_name);

            if thumbnail_path.exists() {
                return Some(thumbnail_path);
            }

            // Also try with _P removed (common pattern)
            let alt_name = base_name.replace("_P", "");
            let alt_thumbnail = format!("{}.{}", alt_name, ext);
            let alt_path = self.thumbnails_directory.join(&alt_thumbnail);

            if alt_path.exists() {
                log::debug!("Found thumbnail (alternate): {:?}", alt_path);
                return Some(alt_path);
            }
        }

        None
    }

    /// Generate a unique mod ID from the full file path
    /// This ensures that the same mod file installed multiple times from different
    /// locations (e.g., different temp extractions) gets different IDs
    ///
    /// IMPORTANT: Normalizes the path by removing .disabled extension so that
    /// enabled and disabled versions of the same mod get the same ID
    fn generate_mod_id_from_path(&self, file_path: &Path, file_name: &str) -> String {
        let mut hasher = Sha256::new();

        // Normalize the path by removing .disabled extension
        // This ensures enabled and disabled mods have the same ID
        if let Some(path_str) = file_path.to_str() {
            let normalized_path = path_str.replace(".disabled", "");
            hasher.update(normalized_path.as_bytes());
        } else {
            // Fallback to file name if path is invalid
            hasher.update(file_name.as_bytes());
        }

        let result = hasher.finalize();
        format!("{:x}", result)[..16].to_string()
    }

    /// Legacy function kept for compatibility
    #[allow(dead_code)]
    fn generate_mod_id(&self, file_name: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(file_name.as_bytes());
        let result = hasher.finalize();
        format!("{:x}", result)[..16].to_string()
    }

    fn extract_mod_name(&self, file_name: &str) -> String {
        let stem = Path::new(file_name)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled Mod");

        // Clean up common suffixes and prefixes
        let cleaned_stem = stem
            .replace("_P", "")  // Remove _P suffix
            .replace("_pak", "")  // Remove _pak suffix
            .replace("&", " ");  // Replace ampersand with space

        let parts: Vec<&str> = cleaned_stem
            // Common patterns to remove - split by delimiters
            .split(|c: char| c == '-' || c == '_' || c == '.')
            .filter(|s| !s.is_empty())
            // Skip common numeric patterns (version numbers, file IDs)
            .filter(|s| {
                // Keep it if it's not purely numeric or doesn't look like a version/ID
                !s.chars().all(|c| c.is_numeric()) || s.len() <= 2
            })
            .collect();

        // Filter out short uppercase prefixes at the start (like "A", "AC", "X", etc.)
        let cleaned = parts
            .iter()
            .enumerate()
            .filter(|(i, s)| {
                if *i == 0 {
                    // First word - keep it only if it's not a short uppercase prefix
                    let is_short_uppercase = s.len() <= 2 && s.chars().all(|c| c.is_uppercase() || !c.is_alphabetic());
                    !is_short_uppercase
                } else {
                    // Keep all other words
                    true
                }
            })
            .map(|(_, s)| *s)
            .collect::<Vec<_>>()
            .join(" ");

        // Split camelCase words and title case
        cleaned
            .split_whitespace()
            .flat_map(|word| self.split_camel_case(word))
            .map(|word| {
                // Skip capitalizing if it's an all-caps abbreviation
                if word.len() <= 3 && word.chars().all(|c| c.is_uppercase() || !c.is_alphabetic()) {
                    return word.to_string();
                }

                let mut chars = word.chars();
                match chars.next() {
                    None => String::new(),
                    Some(first) => {
                        first.to_uppercase().chain(chars.as_str().to_lowercase().chars()).collect()
                    }
                }
            })
            .collect::<Vec<_>>()
            .join(" ")
    }

    /// Split a word on camelCase boundaries
    fn split_camel_case<'a>(&self, word: &'a str) -> Vec<&'a str> {
        let mut parts = Vec::new();
        let mut last_split = 0;
        let chars: Vec<char> = word.chars().collect();

        for i in 1..chars.len() {
            // Split if we find a lowercase followed by uppercase (camelCase)
            // or multiple uppercase followed by uppercase then lowercase (XMLParser -> XML Parser)
            if (chars[i-1].is_lowercase() && chars[i].is_uppercase()) ||
               (i > 1 && chars[i-2].is_uppercase() && chars[i-1].is_uppercase() && chars[i].is_lowercase()) {
                parts.push(&word[last_split..i]);
                last_split = i;
            }
        }

        // Add the remaining part
        if last_split < word.len() {
            parts.push(&word[last_split..]);
        }

        if parts.is_empty() {
            vec![word]
        } else {
            parts
        }
    }

    fn detect_category_from_path(&self, file_path: &Path, file_name: &str) -> ModCategory {
        // First check the folder structure
        let path_str = file_path.to_string_lossy().to_lowercase();

        // Check if the path contains category folders
        if path_str.contains("\\skins\\") || path_str.contains("/skins/") {
            return ModCategory::Skins;
        }
        if path_str.contains("\\ui\\") || path_str.contains("/ui/") {
            return ModCategory::UI;
        }
        if path_str.contains("\\audio\\") || path_str.contains("/audio/") {
            return ModCategory::Audio;
        }
        if path_str.contains("\\gameplay\\") || path_str.contains("/gameplay/") {
            return ModCategory::Gameplay;
        }

        // Fallback to filename detection
        self.detect_category(file_name)
    }

    fn detect_category(&self, file_name: &str) -> ModCategory {
        let lower_name = file_name.to_lowercase();

        for category in [ModCategory::UI, ModCategory::Audio, ModCategory::Skins, ModCategory::Gameplay] {
            if category.keywords().iter().any(|keyword| lower_name.contains(keyword)) {
                return category;
            }
        }

        ModCategory::Skins // Default
    }

    fn detect_character_from_path(&self, file_path: &Path, file_name: &str) -> Option<Character> {
        // First check the folder structure for character names
        let path_str = file_path.to_string_lossy().to_lowercase();

        let characters = [
            // Vanguards
            Character::CaptainAmerica, Character::DoctorStrange, Character::Groot,
            Character::Hulk, Character::Magneto, Character::PeniParker, Character::TheThing,
            Character::Thor, Character::Venom,
            // Duelists
            Character::Angela, Character::Blade, Character::BlackPanther, Character::BlackWidow,
            Character::Daredevil, Character::EmmaFrost, Character::Hawkeye, Character::Hela,
            Character::HumanTorch, Character::IronFist, Character::Magik, Character::MisterFantastic,
            Character::MoonKnight, Character::Namor, Character::Phoenix, Character::Psylocke,
            Character::ScarletWitch, Character::SpiderMan, Character::SquirrelGirl, Character::StarLord,
            Character::Storm, Character::ThePunisher, Character::Ultron, Character::WinterSoldier,
            Character::Wolverine,
            // Strategists
            Character::AdamWarlock, Character::CloakAndDagger, Character::InvisibleWoman,
            Character::IronMan, Character::JeffTheLandShark, Character::Loki, Character::LunaSnow,
            Character::Mantis, Character::RocketRaccoon,
        ];

        // Check path for character folders
        for character in &characters {
            for keyword in character.keywords() {
                let folder_pattern = format!("\\{}\\", keyword);
                let folder_pattern_unix = format!("/{}/", keyword);
                if path_str.contains(&folder_pattern) || path_str.contains(&folder_pattern_unix) {
                    return Some(character.clone());
                }
            }
        }

        // Fallback to filename detection
        self.detect_character(file_name)
    }

    fn detect_character(&self, file_name: &str) -> Option<Character> {
        let lower_name = file_name.to_lowercase();

        // Simple keyword matching - can be enhanced with scoring like in TypeScript version
        let characters = [
            // Vanguards
            Character::CaptainAmerica, Character::DoctorStrange, Character::Groot,
            Character::Hulk, Character::Magneto, Character::PeniParker, Character::TheThing,
            Character::Thor, Character::Venom,
            // Duelists
            Character::Angela, Character::Blade, Character::BlackPanther, Character::BlackWidow,
            Character::Daredevil, Character::EmmaFrost, Character::Hawkeye, Character::Hela,
            Character::HumanTorch, Character::IronFist, Character::Magik, Character::MisterFantastic,
            Character::MoonKnight, Character::Namor, Character::Phoenix, Character::Psylocke,
            Character::ScarletWitch, Character::SpiderMan, Character::SquirrelGirl, Character::StarLord,
            Character::Storm, Character::ThePunisher, Character::Ultron, Character::WinterSoldier,
            Character::Wolverine,
            // Strategists
            Character::AdamWarlock, Character::CloakAndDagger, Character::InvisibleWoman,
            Character::IronMan, Character::JeffTheLandShark, Character::Loki, Character::LunaSnow,
            Character::Mantis, Character::RocketRaccoon,
        ];

        for character in characters {
            if character.keywords().iter().any(|keyword| lower_name.contains(keyword)) {
                return Some(character);
            }
        }

        None
    }

    fn find_associated_files(&self, pak_file_path: &Path) -> Result<Vec<PathBuf>, String> {
        let mut files = vec![pak_file_path.to_path_buf()];

        let base_name = pak_file_path
            .file_stem()
            .and_then(|s| s.to_str())
            .ok_or("Invalid file name")?;

        let directory = pak_file_path.parent().ok_or("Invalid directory")?;

        // Look for .ucas and .utoc files
        for ext in &[".ucas", ".utoc"] {
            let companion_file = directory.join(format!("{}{}", base_name, ext));
            if companion_file.exists() {
                files.push(companion_file);
            }
        }

        Ok(files)
    }

    fn is_mod_file(&self, path: &Path) -> bool {
        path.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| SUPPORTED_EXTENSIONS.contains(&format!(".{}", ext).as_str()))
            .unwrap_or(false)
    }

    fn find_mod_by_id(&self, mod_id: &str) -> Result<Option<ModInfo>, String> {
        let all_mods = self.get_all_mods()?;
        Ok(all_mods.into_iter().find(|m| m.id == mod_id))
    }

    fn load_metadata(&self, mod_id: &str) -> Result<Option<ModMetadata>, String> {
        let metadata_path = self.metadata_directory.join(format!("{}.json", mod_id));

        if !metadata_path.exists() {
            return Ok(None);
        }

        let content = fs::read_to_string(&metadata_path)
            .map_err(|e| format!("Failed to read metadata: {}", e))?;

        let metadata: ModMetadata = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse metadata: {}", e))?;

        Ok(Some(metadata))
    }

    fn save_metadata(&self, mod_id: &str, metadata: &ModMetadata) -> Result<(), String> {
        self.ensure_directory_exists(&self.metadata_directory)?;

        let metadata_path = self.metadata_directory.join(format!("{}.json", mod_id));
        let json = serde_json::to_string_pretty(metadata)
            .map_err(|e| format!("Failed to serialize metadata: {}", e))?;

        fs::write(&metadata_path, json)
            .map_err(|e| format!("Failed to write metadata: {}", e))?;

        Ok(())
    }

    fn delete_metadata(&self, mod_id: &str) -> Result<(), String> {
        let metadata_path = self.metadata_directory.join(format!("{}.json", mod_id));
        if metadata_path.exists() {
            fs::remove_file(&metadata_path)
                .map_err(|e| format!("Failed to delete metadata: {}", e))?;
        }
        Ok(())
    }

    /// Recursively copy a directory and all its contents
    fn copy_directory_recursive(&self, source: &Path, destination: &Path) -> Result<(), String> {
        log::info!("Copying directory from {:?} to {:?}", source, destination);

        // Create the destination directory
        fs::create_dir_all(destination)
            .map_err(|e| format!("Failed to create destination directory: {}", e))?;

        // Walk through the source directory
        for entry in WalkDir::new(source)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();

            // Get relative path from source
            let relative_path = path.strip_prefix(source)
                .map_err(|e| format!("Failed to compute relative path: {}", e))?;

            let dest_path = destination.join(relative_path);

            if path.is_dir() {
                // Create directory in destination
                fs::create_dir_all(&dest_path)
                    .map_err(|e| format!("Failed to create directory {:?}: {}", dest_path, e))?;
            } else {
                // Copy file to destination
                if let Some(parent) = dest_path.parent() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create parent directory: {}", e))?;
                }

                fs::copy(path, &dest_path)
                    .map_err(|e| format!("Failed to copy file {:?}: {}", path, e))?;
            }
        }

        log::info!("Successfully copied directory");
        Ok(())
    }

    /// Delete a directory with retry logic to handle file locks
    /// This helps prevent folder duplication when files are temporarily locked
    fn delete_directory_with_retry(&self, path: &Path, max_retries: u32) -> Result<(), String> {
        use std::thread;
        use std::time::Duration;

        let mut last_error = None;

        for attempt in 0..max_retries {
            match fs::remove_dir_all(path) {
                Ok(_) => {
                    log::info!("Successfully deleted directory: {:?}", path);
                    return Ok(());
                }
                Err(e) => {
                    last_error = Some(e);
                    if attempt < max_retries - 1 {
                        // Exponential backoff: 100ms, 200ms, 400ms
                        let delay_ms = 100 * (2_u64.pow(attempt));
                        log::warn!(
                            "Failed to delete directory (attempt {}/{}): {}. Retrying in {}ms...",
                            attempt + 1,
                            max_retries,
                            last_error.as_ref().unwrap(),
                            delay_ms
                        );
                        thread::sleep(Duration::from_millis(delay_ms));
                    }
                }
            }
        }

        // All retries failed
        Err(format!(
            "Failed to delete directory {:?} after {} attempts: {}",
            path,
            max_retries,
            last_error.unwrap()
        ))
    }

    fn ensure_directory_exists(&self, path: &Path) -> Result<(), String> {
        if !path.exists() {
            fs::create_dir_all(path)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }
        Ok(())
    }
}

/// Sanitize a string to be used as a folder name
/// Removes or replaces invalid characters for Windows file systems
fn sanitize_folder_name(name: &str) -> String {
    name
        // Remove invalid Windows filename characters: < > : " / \ | ? *
        .chars()
        .filter(|c| !matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'))
        .collect::<String>()
        // Replace multiple spaces with single space
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        // Replace spaces with hyphens
        .replace(' ', "-")
        // Remove leading/trailing hyphens and periods
        .trim_matches(|c| c == '-' || c == '.' || c == ' ')
        // Limit length to 100 characters
        .chars()
        .take(100)
        .collect::<String>()
        // Return default if empty
        .into()
}

/// Check if a folder is completely empty (no files, only empty subdirectories)
fn is_folder_empty(path: &Path) -> Result<bool, String> {
    for entry in fs::read_dir(path)
        .map_err(|e| format!("Failed to read directory: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let entry_path = entry.path();

        if entry_path.is_file() {
            // Found a file, not empty
            return Ok(false);
        } else if entry_path.is_dir() {
            // Recursively check subdirectory
            if !is_folder_empty(&entry_path)? {
                return Ok(false);
            }
        }
    }

    // No files found, folder is empty
    Ok(true)
}
