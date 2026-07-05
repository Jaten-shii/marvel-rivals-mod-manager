use crate::types::*;
use chrono::Utc;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
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
        let thumbnails_directory = metadata_directory
            .parent()
            .map(|p| p.join("thumbnails"))
            .unwrap_or_else(|| metadata_directory.join("../thumbnails"));

        Self {
            mods_directory,
            disabled_mods_directory,
            metadata_directory,
            thumbnails_directory,
        }
    }

    /// Build an index of all thumbnail files for fast lookup during scanning.
    /// Maps lowercase filename (without extension) -> full path.
    fn build_thumbnail_index(&self) -> HashMap<String, PathBuf> {
        let mut index = HashMap::new();
        let thumb_extensions: HashSet<&str> =
            ["webp", "png", "jpg", "jpeg"].iter().copied().collect();

        // Index metadata directory thumbnails (new format: {mod_id}_thumbnail.png)
        if let Ok(entries) = fs::read_dir(&self.metadata_directory) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    if thumb_extensions.contains(ext.to_lowercase().as_str()) {
                        if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                            index.insert(stem.to_lowercase(), path);
                        }
                    }
                }
            }
        }

        // Index thumbnails directory
        if let Ok(entries) = fs::read_dir(&self.thumbnails_directory) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    if thumb_extensions.contains(ext.to_lowercase().as_str()) {
                        if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                            // Don't overwrite metadata dir entries (higher priority)
                            index.entry(stem.to_lowercase()).or_insert(path);
                        }
                    }
                }
            }
        }

        index
    }

    /// Get all mods in the mods directory
    pub fn get_all_mods(&self) -> Result<Vec<ModInfo>, String> {
        self.ensure_directory_exists(&self.mods_directory)?;
        self.ensure_directory_exists(&self.disabled_mods_directory)?;

        // Build thumbnail index once instead of per-mod file existence checks
        let thumbnail_index = self.build_thumbnail_index();

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
            &thumbnail_index,
        )?;

        let active_count = mods.len();

        // Scan disabled mods directory
        self.scan_directory_with_deduplication(
            &self.disabled_mods_directory,
            &mut mods,
            &mut processed_paths,
            &mut processed_ids,
            false,
            &thumbnail_index,
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

        fs::copy(file_path, &dest_path).map_err(|e| format!("Failed to copy mod file: {}", e))?;

        // Create mod info
        self.create_mod_info(&dest_path, file_name, true, None)
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

        // Create folder in mods directory. The folder name arrives from the
        // frontend with '/' separators; join segment-by-segment so the path
        // uses native separators — a mixed-separator path hashes to a
        // different mod ID than the scanner computes for the same file.
        let folder_path = folder_name
            .split(['/', '\\'])
            .filter(|part| !part.is_empty())
            .fold(self.mods_directory.clone(), |path, part| path.join(part));
        self.ensure_directory_exists(&folder_path)?;

        // Get file name
        let file_name = file_path
            .file_name()
            .ok_or("Invalid file path")?
            .to_str()
            .ok_or("Invalid file name")?;

        let dest_path = folder_path.join(file_name);

        // Copy main pak file
        fs::copy(file_path, &dest_path).map_err(|e| format!("Failed to copy mod file: {}", e))?;

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
        let metadata_fs =
            fs::metadata(&dest_path).map_err(|e| format!("Failed to get file metadata: {}", e))?;
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
            last_modified: metadata_fs
                .modified()
                .ok()
                .map(|t| t.into())
                .unwrap_or(Utc::now()),
            original_file_name: clean_file_name,
            associated_files,
            metadata,
        })
    }

    pub fn install_mod_to_folder(
        &self,
        file_path: &Path,
        folder_name: &str,
    ) -> Result<ModInfo, String> {
        // Validate file extension
        if !self.is_mod_file(file_path) {
            return Err("Invalid file type. Only .pak files are supported.".to_string());
        }

        // Create folder in mods directory. The folder name arrives from the
        // frontend with '/' separators; join segment-by-segment so the path
        // uses native separators — a mixed-separator path hashes to a
        // different mod ID than the scanner computes for the same file.
        let folder_path = folder_name
            .split(['/', '\\'])
            .filter(|part| !part.is_empty())
            .fold(self.mods_directory.clone(), |path, part| path.join(part));
        self.ensure_directory_exists(&folder_path)?;

        // Get file name
        let file_name = file_path
            .file_name()
            .ok_or("Invalid file path")?
            .to_str()
            .ok_or("Invalid file name")?;

        let dest_path = folder_path.join(file_name);

        // Copy main pak file
        fs::copy(file_path, &dest_path).map_err(|e| format!("Failed to copy mod file: {}", e))?;

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
        let mod_info = self
            .create_mod_info(&dest_path, file_name, true, None)
            .ok_or_else(|| "Failed to create mod info".to_string())?;

        // CRITICAL FIX: Save the default metadata immediately after installation
        // This ensures the mod is reliably findable when update_metadata is called shortly after
        self.save_metadata(&mod_info.id, &mod_info.metadata)?;
        log::info!(
            "Saved initial metadata for newly installed mod: {}",
            mod_info.id
        );

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
                let old_mod_id = mod_info.id.clone();

                // Build folder structure: Category/Character/ModName/ or Category/Character/ModName-Costume/ if costume specified
                let mut folder_parts = vec![mod_info.category.to_string()];

                // Include character subfolder if character is specified
                if let Some(ref character) = mod_info.character {
                    folder_parts.push(sanitize_folder_name(&character.to_string()));
                }

                // Include costume in folder name if specified to avoid conflicts
                // e.g., "Cool-Mod-Phoenix-Demon" instead of just "Cool-Mod"
                let folder_name = if let Some(ref costume) = mod_info.metadata.costume {
                    format!("{}-{}", mod_info.name, costume)
                } else {
                    mod_info.name.clone()
                };
                folder_parts.push(sanitize_folder_name(&folder_name));

                let target_folder = folder_parts
                    .iter()
                    .fold(self.mods_directory.clone(), |path, part| path.join(part));

                fs::create_dir_all(&target_folder)
                    .map_err(|e| format!("Failed to create target directory: {}", e))?;

                // Find the main .pak file for ID generation
                let pak_file = mod_info
                    .associated_files
                    .iter()
                    .find(|f| f.extension().and_then(|e| e.to_str()) == Some("pak"));

                let mut new_pak_path: Option<PathBuf> = None;

                for associated_file in &mod_info.associated_files {
                    let file_name = associated_file.file_name().ok_or("Invalid file name")?;
                    let target_path = target_folder.join(file_name);
                    fs::rename(associated_file, &target_path)
                        .map_err(|e| format!("Failed to move file: {}", e))?;

                    // Track the new pak file location
                    if Some(associated_file) == pak_file {
                        new_pak_path = Some(target_path);
                    }
                }

                // Migrate metadata to new ID (path changed)
                if let Some(new_path) = new_pak_path {
                    let file_name = new_path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                    let new_mod_id = self.generate_mod_id_from_path(&new_path, file_name);

                    if new_mod_id != old_mod_id {
                        // Save metadata under new ID
                        if let Err(e) = self.save_metadata(&new_mod_id, &mod_info.metadata) {
                            log::warn!("Failed to save metadata for organized mod: {}", e);
                        } else {
                            log::info!("   📝 Migrated metadata: {} → {}", old_mod_id, new_mod_id);
                        }

                        // Migrate thumbnail if exists
                        let old_thumb = self
                            .metadata_directory
                            .join(format!("{}_thumbnail.png", old_mod_id));
                        if old_thumb.exists() {
                            let new_thumb = self
                                .metadata_directory
                                .join(format!("{}_thumbnail.png", new_mod_id));
                            let _ = fs::copy(&old_thumb, &new_thumb);
                            let _ = fs::remove_file(&old_thumb);
                        }

                        // Re-point any add-ons that referenced the old parent ID.
                        // Without this, auto-organizing a loose parent on startup
                        // changes its path-based ID and orphans its add-ons.
                        if let Err(e) = self.migrate_addon_parent_ids(&old_mod_id, &new_mod_id) {
                            log::warn!(
                                "Failed to migrate addon parent IDs for organized mod: {}",
                                e
                            );
                        }

                        // Delete old metadata
                        let _ = self.delete_metadata(&old_mod_id);
                    }
                }

                organized_count += 1;
            }
        }

        if organized_count > 0 {
            log::info!(
                "   ✅ Organized {} loose mod(s) into folders",
                organized_count
            );

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
        // old mod ID -> new mod ID for every pak whose path (and so ID) changes,
        // used to re-point add-ons at the end
        let mut id_remap: HashMap<String, String> = HashMap::new();

        // Scan category folders (Skins, UI, Audio, Gameplay)
        for category_entry in fs::read_dir(&self.mods_directory)
            .map_err(|e| format!("Failed to read mods directory: {}", e))?
        {
            let category_entry =
                category_entry.map_err(|e| format!("Failed to read category entry: {}", e))?;
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
                let char_entry =
                    char_entry.map_err(|e| format!("Failed to read character entry: {}", e))?;
                let char_path = char_entry.path();

                if !char_path.is_dir() {
                    continue;
                }

                if let Some(folder_name) = char_path.file_name().and_then(|n| n.to_str()) {
                    // Normalize the folder name (remove hyphens and spaces for comparison)
                    let normalized = folder_name.replace("-", "").replace(" ", "").to_lowercase();
                    character_folders
                        .entry(normalized)
                        .or_insert_with(Vec::new)
                        .push(char_path);
                }
            }

            // Merge duplicate folders WITHIN this category only
            for (_normalized_name, paths) in character_folders {
                if paths.len() > 1 {
                    // Keep the folder with the hyphenated name (our standard)
                    let target_folder = paths
                        .iter()
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

                        log::info!(
                            "   🔄 Merging {:?} → {:?}",
                            source_folder.file_name(),
                            target_folder.file_name()
                        );

                        // Move all mods from source to target
                        for entry in fs::read_dir(source_folder)
                            .map_err(|e| format!("Failed to read source folder: {}", e))?
                        {
                            let entry =
                                entry.map_err(|e| format!("Failed to read entry: {}", e))?;
                            let source_mod_folder = entry.path();

                            if source_mod_folder.is_dir() {
                                if let Some(mod_name) = source_mod_folder.file_name() {
                                    let target_mod_folder = target_folder.join(mod_name);

                                    if target_mod_folder.exists() {
                                        log::warn!(
                                            "      ⚠️  Target already exists, skipping: {:?}",
                                            mod_name
                                        );
                                        continue;
                                    }

                                    // Move the mod folder
                                    fs::rename(&source_mod_folder, &target_mod_folder)
                                        .map_err(|e| format!("Failed to move mod folder: {}", e))?;

                                    // Migrate metadata for EVERY .pak that moved — the
                                    // folder can also hold add-on paks, and skipping
                                    // them orphans their metadata (detached add-ons)
                                    for pak_entry in WalkDir::new(&target_mod_folder)
                                        .into_iter()
                                        .filter_map(|e| e.ok())
                                    {
                                        let pak_path = pak_entry.path().to_path_buf();
                                        if pak_path.extension().and_then(|e| e.to_str())
                                            != Some("pak")
                                        {
                                            continue;
                                        }
                                        let file_name = pak_path
                                            .file_name()
                                            .and_then(|n| n.to_str())
                                            .unwrap_or("");

                                        // Reconstruct where this pak lived before the move
                                        let old_pak_path =
                                            match pak_path.strip_prefix(&target_mod_folder) {
                                                Ok(rel) => source_mod_folder.join(rel),
                                                Err(_) => source_mod_folder.join(file_name),
                                            };
                                        let old_id = self
                                            .generate_mod_id_from_path(&old_pak_path, file_name);
                                        let new_id =
                                            self.generate_mod_id_from_path(&pak_path, file_name);
                                        if old_id == new_id {
                                            continue;
                                        }

                                        // Migrate metadata if it exists
                                        if let Ok(Some(metadata)) = self.load_metadata(&old_id) {
                                            log::info!(
                                                "      📝 Migrating metadata: {} → {}",
                                                old_id,
                                                new_id
                                            );
                                            let _ = self.save_metadata(&new_id, &metadata);

                                            // Copy thumbnail if exists
                                            let old_thumb = self
                                                .metadata_directory
                                                .join(format!("{}_thumbnail.png", old_id));
                                            if old_thumb.exists() {
                                                let new_thumb = self
                                                    .metadata_directory
                                                    .join(format!("{}_thumbnail.png", new_id));
                                                let _ = fs::copy(&old_thumb, &new_thumb);
                                            }

                                            // Delete old metadata
                                            let _ = self.delete_metadata(&old_id);
                                        }

                                        // Record for the add-on re-pointing pass below
                                        id_remap.insert(old_id, new_id);
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

        // Re-point add-ons whose parents (or themselves) moved during the merge —
        // their path-based IDs changed
        if !id_remap.is_empty() {
            if let Err(e) = self.remap_addon_parent_ids(&id_remap) {
                log::warn!(
                    "[merge_duplicate_folders] Failed to re-point add-ons: {}",
                    e
                );
            }
        }

        if merged_count > 0 {
            log::info!(
                "   ✅ Merged {} duplicate character folder(s)",
                merged_count
            );
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
                let is_character_folder = Character::all_characters().iter().any(|character| {
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
    /// Preserves metadata and folder structure across enable/disable operations
    pub fn enable_mod(&self, mod_id: &str, enabled: bool) -> Result<(), String> {
        // Single-mod path: re-point add-ons inline (scans metadata once).
        self.enable_mod_inner(mod_id, enabled, true).map(|_| ())
    }

    /// Core enable/disable. When `migrate_addons` is true, any add-ons pointing
    /// at this mod's old ID are re-pointed inline (one full metadata scan). Bulk
    /// callers pass `false` and instead re-point all add-ons in a single pass
    /// afterward, avoiding an O(mods²) scan. Returns the mod's new ID if it
    /// changed (the path-based ID changes whenever the file moves).
    fn enable_mod_inner(
        &self,
        mod_id: &str,
        enabled: bool,
        migrate_addons: bool,
    ) -> Result<Option<String>, String> {
        log::info!(
            "[enable_mod] {} mod: {}",
            if enabled { "Enabling" } else { "Disabling" },
            mod_id
        );

        // Step 1: Get current mod info and load existing metadata
        let mod_info = self.find_mod_by_id(mod_id)?.ok_or("Mod not found")?;

        // Load metadata with fallback - create from mod_info if not found
        // This ensures we never lose metadata and the operation can proceed
        let mut metadata = match self.load_metadata(mod_id)? {
            Some(m) => m,
            None => {
                log::warn!(
                    "[enable_mod] Metadata not found for {}, creating from mod_info",
                    mod_id
                );
                // Create metadata from the mod_info we already have
                let mut new_metadata = mod_info.metadata.clone();

                // Ensure original_folder_path is captured from current location
                let current_file_path = PathBuf::from(&mod_info.file_path);
                if let Some(current_parent) = current_file_path.parent() {
                    // Try to extract relative path from either mods or disabled-mods directory
                    if let Ok(relative) = current_parent.strip_prefix(&self.mods_directory) {
                        new_metadata.original_folder_path =
                            Some(relative.to_string_lossy().to_string());
                    } else if let Ok(relative) =
                        current_parent.strip_prefix(&self.disabled_mods_directory)
                    {
                        new_metadata.original_folder_path =
                            Some(relative.to_string_lossy().to_string());
                    }
                }

                // Save the newly created metadata immediately
                self.save_metadata(mod_id, &new_metadata)?;
                log::info!(
                    "[enable_mod] Created and saved fallback metadata for {}",
                    mod_id
                );
                new_metadata
            }
        };

        log::info!("[enable_mod] Current location: {:?}", mod_info.file_path);
        log::info!(
            "[enable_mod] Original folder path in metadata: {:?}",
            metadata.original_folder_path
        );

        // Step 2: Store current folder structure in metadata if not already stored
        // Extract the relative path from ~mods or disabled-mods directory
        let current_file_path = PathBuf::from(&mod_info.file_path);
        let current_parent = current_file_path.parent().ok_or("No parent directory")?;

        // Calculate relative path from base directory
        let base_dir = if enabled {
            &self.disabled_mods_directory
        } else {
            &self.mods_directory
        };

        // If metadata doesn't have original_folder_path and mod is currently in a subfolder, store it
        // FIX: Check BOTH mods_directory AND disabled_mods_directory for relative path
        if metadata.original_folder_path.is_none() && current_parent != base_dir {
            // Try mods_directory first
            if let Ok(relative_path) = current_parent.strip_prefix(&self.mods_directory) {
                metadata.original_folder_path = Some(relative_path.to_string_lossy().to_string());
                log::info!(
                    "[enable_mod] Stored original folder path (from mods): {:?}",
                    metadata.original_folder_path
                );
            }
            // Then try disabled_mods_directory
            else if let Ok(relative_path) =
                current_parent.strip_prefix(&self.disabled_mods_directory)
            {
                metadata.original_folder_path = Some(relative_path.to_string_lossy().to_string());
                log::info!(
                    "[enable_mod] Stored original folder path (from disabled): {:?}",
                    metadata.original_folder_path
                );
            }
        }

        // Step 3: Calculate destination path
        let dest_folder = if enabled {
            // Enabling: restore to original folder or organize by category/character
            if let Some(ref original_path) = metadata.original_folder_path {
                // Restore to original folder structure
                self.mods_directory.join(original_path)
            } else {
                // No original path stored - organize by category, character, and costume
                let mut folder_parts = vec![metadata.category.to_string()];
                if let Some(ref character) = metadata.character {
                    folder_parts.push(sanitize_folder_name(&character.to_string()));
                }
                // Include costume in folder name if specified to avoid conflicts
                let folder_name = if let Some(ref costume) = metadata.costume {
                    format!("{}-{}", metadata.title, costume)
                } else {
                    metadata.title.clone()
                };
                folder_parts.push(sanitize_folder_name(&folder_name));

                let organized_path = folder_parts.join("/");
                self.mods_directory.join(organized_path)
            }
        } else {
            // Disabling: move to disabled-mods preserving structure
            if let Some(ref original_path) = metadata.original_folder_path {
                // Preserve folder structure in disabled-mods
                self.disabled_mods_directory.join(original_path)
            } else {
                // Move to root of disabled-mods
                self.disabled_mods_directory.clone()
            }
        };

        log::info!("[enable_mod] Destination folder: {:?}", dest_folder);

        // Step 4: Create destination folder and move files
        fs::create_dir_all(&dest_folder)
            .map_err(|e| format!("Failed to create destination folder: {}", e))?;

        let mut new_file_paths = Vec::new();
        for file_path in &mod_info.associated_files {
            let file_name = file_path.file_name().ok_or("Invalid file path")?;

            let dest_path = dest_folder.join(file_name);

            fs::rename(file_path, &dest_path).map_err(|e| format!("Failed to move file: {}", e))?;

            new_file_paths.push(dest_path);
        }

        log::info!("[enable_mod] Moved {} files", new_file_paths.len());

        // Step 5: Calculate new mod ID from new path
        let new_main_file = new_file_paths
            .iter()
            .find(|p| p.extension().and_then(|e| e.to_str()) == Some("pak"))
            .ok_or("No .pak file found in moved files")?;

        let file_name = new_main_file
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or("Invalid file name")?;

        let clean_file_name = file_name.replace(".disabled", "");
        let new_mod_id = self.generate_mod_id_from_path(new_main_file, &clean_file_name);

        log::info!("[enable_mod] Old mod ID: {}", mod_id);
        log::info!("[enable_mod] New mod ID: {}", new_mod_id);

        // Step 6: Save metadata under new mod ID (if ID changed)
        if new_mod_id != mod_id {
            self.save_metadata(&new_mod_id, &metadata)?;
            log::info!("[enable_mod] Saved metadata under new ID");

            // Step 7: Migrate thumbnail from old ID to new ID
            let old_thumb_path = self
                .metadata_directory
                .join(format!("{}_thumbnail.png", mod_id));
            if old_thumb_path.exists() {
                let new_thumb_path = self
                    .metadata_directory
                    .join(format!("{}_thumbnail.png", new_mod_id));
                if let Err(e) = fs::copy(&old_thumb_path, &new_thumb_path) {
                    log::warn!("[enable_mod] Failed to migrate thumbnail: {}", e);
                } else {
                    log::info!("[enable_mod] Migrated thumbnail to new ID");
                    // Delete old thumbnail
                    let _ = fs::remove_file(&old_thumb_path);
                }
            }

            // Step 8: Re-point any add-ons that referenced the old parent ID.
            // Enabling/disabling moves the parent between ~mods and disabled-mods,
            // changing its path-based ID — without this its add-ons orphan.
            // Bulk callers skip this and re-point everything in one pass.
            if migrate_addons {
                if let Err(e) = self.migrate_addon_parent_ids(mod_id, &new_mod_id) {
                    log::warn!("[enable_mod] Failed to migrate addon parent IDs: {}", e);
                }
            }

            // Step 9: Delete old metadata file
            let _ = self.delete_metadata(mod_id);
            log::info!("[enable_mod] Deleted old metadata");

            log::info!(
                "[enable_mod] Successfully {} mod",
                if enabled { "enabled" } else { "disabled" }
            );
            Ok(Some(new_mod_id))
        } else {
            // Same ID - just update metadata in place
            self.save_metadata(mod_id, &metadata)?;
            log::info!(
                "[enable_mod] Successfully {} mod",
                if enabled { "enabled" } else { "disabled" }
            );
            Ok(None)
        }
    }

    /// Enable/disable many mods, re-pointing all add-ons in a single metadata
    /// pass at the end instead of once per mod. Returns the number of mods
    /// successfully toggled. Failures are logged and skipped.
    ///
    /// `on_progress(done, total)` is invoked after each mod so callers can drive
    /// a real progress bar / ETA. It runs on the same thread as the loop.
    pub fn set_mods_enabled<F>(
        &self,
        mod_ids: &[String],
        enabled: bool,
        mut on_progress: F,
    ) -> Result<usize, String>
    where
        F: FnMut(usize, usize),
    {
        let mut ok = 0;
        let total = mod_ids.len();
        // old parent ID -> new parent ID, for every mod whose ID changed.
        let mut remap: HashMap<String, String> = HashMap::new();

        for (i, mod_id) in mod_ids.iter().enumerate() {
            match self.enable_mod_inner(mod_id, enabled, false) {
                Ok(Some(new_id)) => {
                    remap.insert(mod_id.clone(), new_id);
                    ok += 1;
                }
                Ok(None) => ok += 1, // toggled but ID unchanged (no add-on impact)
                Err(e) => log::warn!("[set_mods_enabled] Failed to toggle {}: {}", mod_id, e),
            }
            on_progress(i + 1, total);
        }

        // One pass over all metadata: rewrite any parent_mod_id that moved.
        if !remap.is_empty() {
            if let Err(e) = self.remap_addon_parent_ids(&remap) {
                log::warn!("[set_mods_enabled] Failed to re-point add-ons: {}", e);
            }
        }

        Ok(ok)
    }

    /// Re-point add-ons for many parents at once. Scans the metadata directory a
    /// single time and rewrites any `parent_mod_id` found in `remap`. This is the
    /// batch equivalent of calling migrate_addon_parent_ids per parent, but O(N)
    /// instead of O(N²) over the mod count. Returns how many add-ons were re-pointed.
    fn remap_addon_parent_ids(&self, remap: &HashMap<String, String>) -> Result<usize, String> {
        let mut migrated = 0;
        let mut scanned = 0;

        if let Ok(entries) = fs::read_dir(&self.metadata_directory) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) != Some("json") {
                    continue;
                }
                scanned += 1;

                let content = match fs::read_to_string(&path) {
                    Ok(c) => c,
                    Err(_) => continue,
                };

                if let Ok(mut metadata) = serde_json::from_str::<ModMetadata>(&content) {
                    if let Some(parent) = metadata.parent_mod_id.as_deref() {
                        if let Some(new_parent) = remap.get(parent) {
                            metadata.parent_mod_id = Some(new_parent.clone());
                            if let Ok(updated) = serde_json::to_string_pretty(&metadata) {
                                let _ = fs::write(&path, updated);
                                migrated += 1;
                            }
                        }
                    }
                }
            }
        }

        log::info!("[remap_addon_parent_ids] Scanned {} metadata files, re-pointed {} add-on(s) across {} moved parent(s)", scanned, migrated, remap.len());
        Ok(migrated)
    }

    /// One-time repair for metadata orphaned by folder renames/merges that
    /// happened before those moves re-pointed add-ons (pre-6.2.0). Mod IDs are
    /// hashes of the full pak path, so for every current pak we hash
    /// space/hyphen folder-name variants of its path; if a variant ID matches
    /// an orphaned metadata file, that metadata belongs to this pak and is
    /// migrated. Safe by construction: a hash match proves the old path.
    /// Returns the number of metadata files recovered.
    pub fn recover_orphaned_metadata(&self) -> Result<usize, String> {
        // Collect every current pak
        let mut pak_paths: Vec<PathBuf> = Vec::new();
        for root in [&self.mods_directory, &self.disabled_mods_directory] {
            if !root.exists() {
                continue;
            }
            for entry in WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.ends_with(".pak") || name.ends_with(".pak.disabled") {
                    pak_paths.push(entry.path().to_path_buf());
                }
            }
        }

        let current_ids: HashSet<String> = pak_paths
            .iter()
            .map(|p| {
                let file_name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
                self.generate_mod_id_from_path(p, file_name)
            })
            .collect();

        // Metadata files whose mod no longer exists at the hashed path
        let mut orphaned: HashSet<String> = HashSet::new();
        if let Ok(entries) = fs::read_dir(&self.metadata_directory) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) != Some("json") {
                    continue;
                }
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    // Mod IDs are 16 hex chars; skip any other json files
                    let is_id = stem.len() == 16 && stem.chars().all(|c| c.is_ascii_hexdigit());
                    if is_id && !current_ids.contains(stem) {
                        orphaned.insert(stem.to_string());
                    }
                }
            }
        }

        if !orphaned.is_empty() {
            log::info!(
                "[recover] {} orphaned metadata file(s), matching against current paks…",
                orphaned.len()
            );
        }

        // ID a pak would have had under a space/hyphen folder variant -> current ID
        let mut remap: HashMap<String, String> = HashMap::new();
        for pak_path in &pak_paths {
            let file_name = pak_path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            let current_id = self.generate_mod_id_from_path(pak_path, file_name);
            for variant in path_segment_variants(pak_path) {
                let variant_id = self.generate_mod_id_from_path(&variant, file_name);
                if variant_id != current_id {
                    remap.insert(variant_id, current_id.clone());
                }
            }
        }

        // Migrate orphaned metadata whose old ID matches a variant
        let mut recovered = 0;
        for old_id in &orphaned {
            let Some(new_id) = remap.get(old_id) else {
                continue;
            };
            if let Ok(Some(metadata)) = self.load_metadata(old_id) {
                log::info!("[recover] {} → {} ({})", old_id, new_id, metadata.title);
                let _ = self.save_metadata(new_id, &metadata);

                let old_thumb = self
                    .metadata_directory
                    .join(format!("{}_thumbnail.png", old_id));
                if old_thumb.exists() {
                    let new_thumb = self
                        .metadata_directory
                        .join(format!("{}_thumbnail.png", new_id));
                    let _ = fs::copy(&old_thumb, &new_thumb);
                }

                let _ = self.delete_metadata(old_id);
                recovered += 1;
            }
        }

        // Re-point add-ons whose parent IDs are pre-move variants
        let mut repointed = 0;
        if !remap.is_empty() {
            repointed = self.remap_addon_parent_ids(&remap).unwrap_or(0);
        }

        // ── Phase 2: reattach add-ons whose parent ID no longer exists ──────
        // Covers parents whose folders were renamed by older app versions that
        // didn't re-point add-ons, where the old path can't be reconstructed.
        // Match by character + base title (the part before a " - variant"
        // suffix, so "Reshaped Idol - No Nip" matches "Reshaped Idol - Alt5"),
        // preferring same-costume parents, and only act when the match is
        // unambiguous.
        let mut all_meta: Vec<(String, ModMetadata)> = Vec::new();
        if let Ok(entries) = fs::read_dir(&self.metadata_directory) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) != Some("json") {
                    continue;
                }
                let Some(stem) = path.file_stem().and_then(|s| s.to_str()) else {
                    continue;
                };
                if !current_ids.contains(stem) {
                    continue; // only metadata belonging to existing mods
                }
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(meta) = serde_json::from_str::<ModMetadata>(&content) {
                        all_meta.push((stem.to_string(), meta));
                    }
                }
            }
        }

        let parent_idxs: Vec<usize> = all_meta
            .iter()
            .enumerate()
            .filter(|(_, (_, m))| m.parent_mod_id.is_none())
            .map(|(i, _)| i)
            .collect();

        let mut reattached = 0;
        for (addon_id, meta) in &all_meta {
            let Some(parent_id) = &meta.parent_mod_id else {
                continue;
            };
            if current_ids.contains(parent_id) {
                continue; // parent exists, nothing to fix
            }
            let Some(addon_char) = meta.character.as_ref().map(|c| c.to_string()) else {
                continue;
            };
            let addon_base = base_title(&meta.title);
            if addon_base.len() < 3 {
                continue;
            }

            let mut same_costume: Vec<usize> = Vec::new();
            let mut other_costume: Vec<usize> = Vec::new();
            for &pi in &parent_idxs {
                let (pid, pm) = &all_meta[pi];
                if pid == addon_id {
                    continue;
                }
                if pm.character.as_ref().map(|c| c.to_string()).as_deref() != Some(&addon_char) {
                    continue;
                }
                if base_title(&pm.title) != addon_base {
                    continue;
                }
                if pm.costume == meta.costume {
                    same_costume.push(pi);
                } else {
                    other_costume.push(pi);
                }
            }

            // Same-costume match wins; otherwise fall back to a unique
            // base-title match across costumes
            let matches = if !same_costume.is_empty() {
                same_costume
            } else {
                other_costume
            };

            if matches.len() == 1 {
                let (new_parent_id, parent_meta) = &all_meta[matches[0]];
                log::info!(
                    "[recover] Reattaching add-on '{}' to parent '{}' ({} → {})",
                    meta.title,
                    parent_meta.title,
                    parent_id,
                    new_parent_id
                );
                let mut updated = meta.clone();
                updated.parent_mod_id = Some(new_parent_id.clone());
                if self.save_metadata(addon_id, &updated).is_ok() {
                    reattached += 1;
                }
            } else if matches.len() > 1 {
                log::warn!(
                    "[recover] Add-on '{}' has {} possible parents, leaving detached",
                    meta.title,
                    matches.len()
                );
            }
        }

        log::info!(
            "[recover] Recovered {} metadata file(s), re-pointed {} add-on(s), reattached {} add-on(s)",
            recovered,
            repointed,
            reattached
        );
        Ok(recovered + repointed + reattached)
    }

    /// Delete a mod
    pub fn delete_mod(&self, mod_id: &str) -> Result<(), String> {
        let mod_info = self.find_mod_by_id(mod_id)?.ok_or("Mod not found")?;

        // Delete all associated files
        for file_path in &mod_info.associated_files {
            fs::remove_file(file_path).map_err(|e| format!("Failed to delete file: {}", e))?;
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
            let file_name = file_path.file_name().and_then(|n| n.to_str()).unwrap_or("");

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
                log::info!(
                    "Migrating metadata for mod: {} (old ID: {}, new ID: {})",
                    mod_info.name,
                    old_id,
                    new_id
                );

                // Save metadata with new ID
                self.save_metadata(&new_id, &old_metadata)?;

                // Migrate thumbnail if it exists
                // Check for thumbnail with old ID
                let old_thumb_path = self
                    .metadata_directory
                    .join(format!("{}_thumbnail.png", old_id));
                if old_thumb_path.exists() {
                    let new_thumb_path = self
                        .metadata_directory
                        .join(format!("{}_thumbnail.png", new_id));
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
        log::info!(
            "Copying metadata from old ID {} to current ID {}",
            old_mod_id,
            current_mod_id
        );

        // Load metadata from old ID
        let old_metadata = self
            .load_metadata(old_mod_id)?
            .ok_or_else(|| format!("No metadata found for old ID: {}", old_mod_id))?;

        // Copy thumbnail BEFORE updating metadata (in case update fails)
        let old_thumb_path = self
            .metadata_directory
            .join(format!("{}_thumbnail.png", old_mod_id));
        if old_thumb_path.exists() {
            let new_thumb_path = self
                .metadata_directory
                .join(format!("{}_thumbnail.png", current_mod_id));
            fs::copy(&old_thumb_path, &new_thumb_path)
                .map_err(|e| format!("Failed to copy thumbnail: {}", e))?;
            log::info!("Copied thumbnail from {} to {}", old_mod_id, current_mod_id);
        }

        // Use update_metadata to save the metadata AND trigger folder rename if needed
        // This ensures the mod folder gets organized properly based on the metadata
        self.update_metadata(current_mod_id, old_metadata)?;
        log::info!(
            "Successfully copied and applied metadata from {} to {}",
            old_mod_id,
            current_mod_id
        );

        Ok(())
    }

    /// Move mod folders that sit directly under a category folder (e.g.
    /// "Skins/MyMod") into their character subfolder ("Skins/Magik/MyMod")
    /// when the character is known. Older app versions created folders
    /// without the character level and nothing re-nested them afterwards.
    /// Returns the number of folders moved.
    pub fn relocate_misplaced_mods(&self) -> Result<usize, String> {
        let all_mods = self.get_all_mods()?;
        let mut moved = 0;
        let mut id_remap: HashMap<String, String> = HashMap::new();
        // Folders already moved this run (multi-pak folders appear once per pak)
        let mut moved_dirs: HashSet<PathBuf> = HashSet::new();

        for mod_info in all_mods {
            let Some(character) = &mod_info.metadata.character else {
                continue; // can't place without a character
            };

            let file_path = &mod_info.file_path;
            if !file_path.starts_with(&self.mods_directory) {
                continue; // disabled mods get re-organized when re-enabled
            }
            let Some(parent_dir) = file_path.parent() else {
                continue;
            };
            if parent_dir == self.mods_directory {
                continue; // loose pak, organize_mods handles those
            }
            if moved_dirs.contains(parent_dir) {
                continue;
            }

            // Only folders sitting directly under a category folder
            let category_dir = self.mods_directory.join(sanitize_folder_name(
                &mod_info.metadata.category.to_string(),
            ));
            if parent_dir.parent() != Some(category_dir.as_path()) {
                continue;
            }

            let char_folder = sanitize_folder_name(&character.to_string());

            // Never touch the character folder itself (a pak sitting loose in
            // it) or any folder that contains nested mod folders
            if parent_dir.file_name().and_then(|n| n.to_str()) == Some(char_folder.as_str()) {
                continue;
            }
            let has_nested_mod_folders = WalkDir::new(parent_dir)
                .min_depth(2)
                .into_iter()
                .filter_map(|e| e.ok())
                .any(|e| e.path().extension().and_then(|x| x.to_str()) == Some("pak"));
            if has_nested_mod_folders {
                continue;
            }

            let char_dir = category_dir.join(&char_folder);
            let Some(folder_name) = parent_dir.file_name() else {
                continue;
            };
            let target = char_dir.join(folder_name);
            if target.exists() {
                log::warn!("[relocate] Target already exists, skipping: {:?}", target);
                continue;
            }
            if let Err(e) = fs::create_dir_all(&char_dir) {
                log::warn!("[relocate] Failed to create {:?}: {}", char_dir, e);
                continue;
            }

            let source_dir = parent_dir.to_path_buf();
            log::info!("[relocate] {:?} → {:?}", source_dir, target);
            if let Err(e) = fs::rename(&source_dir, &target) {
                log::warn!("[relocate] Failed to move {:?}: {}", source_dir, e);
                continue;
            }
            moved_dirs.insert(source_dir.clone());

            // Migrate metadata for every pak that moved (path-based IDs changed)
            self.migrate_moved_folder_metadata(&source_dir, &target, &mut id_remap);
            moved += 1;
        }

        // Re-point add-ons whose parents (or themselves) moved
        if !id_remap.is_empty() {
            let _ = self.remap_addon_parent_ids(&id_remap);
        }

        if moved > 0 {
            log::info!(
                "[relocate] Moved {} mod folder(s) into character folders",
                moved
            );
        }
        Ok(moved)
    }

    /// Migrate metadata and thumbnails for every pak inside a folder that was
    /// moved from `source_dir` to `target_dir`, recording old -> new IDs in
    /// `id_remap` for a later add-on re-pointing pass.
    fn migrate_moved_folder_metadata(
        &self,
        source_dir: &Path,
        target_dir: &Path,
        id_remap: &mut HashMap<String, String>,
    ) {
        for pak_entry in WalkDir::new(target_dir).into_iter().filter_map(|e| e.ok()) {
            let pak_path = pak_entry.path().to_path_buf();
            let name = pak_path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if !(name.ends_with(".pak") || name.ends_with(".pak.disabled")) {
                continue;
            }
            let old_pak_path = match pak_path.strip_prefix(target_dir) {
                Ok(rel) => source_dir.join(rel),
                Err(_) => source_dir.join(name),
            };
            let old_id = self.generate_mod_id_from_path(&old_pak_path, name);
            let new_id = self.generate_mod_id_from_path(&pak_path, name);
            if old_id == new_id {
                continue;
            }
            if let Ok(Some(metadata)) = self.load_metadata(&old_id) {
                let _ = self.save_metadata(&new_id, &metadata);
                let old_thumb = self
                    .metadata_directory
                    .join(format!("{}_thumbnail.png", old_id));
                if old_thumb.exists() {
                    let new_thumb = self
                        .metadata_directory
                        .join(format!("{}_thumbnail.png", new_id));
                    let _ = fs::copy(&old_thumb, &new_thumb);
                    let _ = fs::remove_file(&old_thumb);
                }
                let _ = self.delete_metadata(&old_id);
            }
            id_remap.insert(old_id, new_id);
        }
    }

    /// Ensure add-on paks load BEFORE their parent mod. Marvel Rivals mounts
    /// paks in alphabetical order of their full path, and for these body
    /// retexture conflicts the FIRST mounted pak wins — an add-on sorting after
    /// its parent is silently overridden in game. Fix: prefix the add-on's
    /// folder with "aa-" so it mounts before the parent. Any legacy "zz-"
    /// prefix (which forced the broken load-last behaviour) is stripped first.
    /// Returns the number of add-ons adjusted.
    pub fn enforce_addon_load_order(&self) -> Result<usize, String> {
        let all_mods = self.get_all_mods()?;

        let path_by_id: HashMap<String, PathBuf> = all_mods
            .iter()
            .map(|m| (m.id.clone(), m.file_path.clone()))
            .collect();

        let mut adjusted = 0;
        let mut id_remap: HashMap<String, String> = HashMap::new();
        let mut moved_dirs: HashSet<PathBuf> = HashSet::new();

        for mod_info in &all_mods {
            let Some(parent_id) = &mod_info.metadata.parent_mod_id else {
                continue;
            };
            let Some(parent_path) = path_by_id.get(parent_id) else {
                continue; // detached add-on, nothing to order against
            };

            let addon_path = &mod_info.file_path;
            // Only enabled mods participate in the game's load order
            if !addon_path.starts_with(&self.mods_directory)
                || !parent_path.starts_with(&self.mods_directory)
            {
                continue;
            }

            let Some(addon_dir) = addon_path.parent() else {
                continue;
            };
            if moved_dirs.contains(addon_dir) {
                continue;
            }
            if addon_dir == self.mods_directory {
                log::warn!(
                    "[load-order] Add-on '{}' is loose in ~mods, skipping",
                    mod_info.metadata.title
                );
                continue;
            }
            if Some(addon_dir) == parent_path.parent() {
                // Same folder as the parent: filename order decides, and renaming
                // the pak would break its .ucas/.utoc pairing. Leave it alone.
                log::warn!(
                    "[load-order] Add-on '{}' shares a folder with its parent, skipping",
                    mod_info.metadata.title
                );
                continue;
            }
            let Some(folder_name) = addon_dir.file_name().and_then(|n| n.to_str()) else {
                continue;
            };
            let Some(folder_parent) = addon_dir.parent() else {
                continue;
            };

            // Compute the base folder name without any of our ordering prefixes,
            // so we can both upgrade legacy "zz-" folders and add "aa-" cleanly.
            let base_name = folder_name
                .strip_prefix("aa-")
                .or_else(|| folder_name.strip_prefix("zz-"))
                .unwrap_or(folder_name);

            // The game compares full paths case-insensitively. The add-on already
            // loads before its parent only if it sorts lower AND already carries
            // our "aa-" prefix (so it won't drift back above the parent later).
            let addon_key = addon_path.to_string_lossy().to_lowercase();
            let parent_key = parent_path.to_string_lossy().to_lowercase();
            if folder_name.starts_with("aa-") && addon_key < parent_key {
                continue; // already loads before the parent
            }

            let target = folder_parent.join(format!("aa-{base_name}"));
            if target == addon_dir {
                continue; // nothing to do
            }
            if target.exists() {
                log::warn!("[load-order] Target already exists, skipping: {:?}", target);
                continue;
            }

            let source_dir = addon_dir.to_path_buf();
            if let Err(e) = fs::rename(&source_dir, &target) {
                log::warn!("[load-order] Failed to rename {:?}: {}", source_dir, e);
                continue;
            }
            log::info!(
                "[load-order] '{}' now loads before its parent ({:?})",
                mod_info.metadata.title,
                target.file_name().unwrap_or_default()
            );
            moved_dirs.insert(source_dir.clone());

            self.migrate_moved_folder_metadata(&source_dir, &target, &mut id_remap);
            adjusted += 1;
        }

        if !id_remap.is_empty() {
            let _ = self.remap_addon_parent_ids(&id_remap);
        }

        if adjusted > 0 {
            log::info!(
                "[load-order] Adjusted load order for {} add-on(s)",
                adjusted
            );
        }
        Ok(adjusted)
    }

    /// Migrate existing mods to the new costume-based folder structure
    /// This renames folders from "ModName" to "ModName-Costume" when a costume is set
    /// Returns the number of mods migrated
    pub fn migrate_to_costume_folders(&self) -> Result<usize, String> {
        log::info!("🔍 Checking for mods needing costume folder migration...");
        let all_mods = self.get_all_mods()?;
        let mut migrated_count = 0;

        for mod_info in all_mods {
            // Skip if no costume is set - no migration needed
            let costume = match &mod_info.metadata.costume {
                Some(c) => c.clone(),
                None => continue,
            };

            // Skip if mod is loose (not in a folder)
            let file_path = &mod_info.file_path;
            let parent_dir = match file_path.parent() {
                Some(p) => p,
                None => continue,
            };

            if parent_dir == self.mods_directory || parent_dir == self.disabled_mods_directory {
                continue; // Loose mod, will be organized separately
            }

            // Get current folder name
            let current_folder_name = match parent_dir.file_name().and_then(|n| n.to_str()) {
                Some(name) => name.to_string(),
                None => continue,
            };

            // Calculate expected folder name with costume
            let expected_folder_name =
                sanitize_folder_name(&format!("{}-{}", mod_info.name, costume));

            // Skip if folder already has costume suffix
            if current_folder_name == expected_folder_name {
                continue;
            }

            // Skip if the folder name already ends with the costume name (already migrated)
            let costume_suffix = format!("-{}", sanitize_folder_name(&costume));
            if current_folder_name.ends_with(&costume_suffix) {
                continue;
            }

            log::info!(
                "   🔄 Migrating: {} → {}",
                current_folder_name,
                expected_folder_name
            );

            // Calculate new folder path
            let parent_of_mod_folder = parent_dir.parent().ok_or("Invalid folder structure")?;
            let new_folder = parent_of_mod_folder.join(&expected_folder_name);

            // Check if target folder already exists
            if new_folder.exists() {
                log::warn!(
                    "      ⚠️  Target folder already exists, skipping: {:?}",
                    new_folder
                );
                continue;
            }

            // Rename the folder
            match fs::rename(parent_dir, &new_folder) {
                Ok(_) => {
                    log::info!("      ✅ Folder renamed successfully");

                    // Migrate metadata to new ID
                    let new_pak_path = new_folder.join(file_path.file_name().unwrap());
                    let file_name = file_path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                    let new_mod_id = self.generate_mod_id_from_path(&new_pak_path, file_name);

                    if new_mod_id != mod_info.id {
                        // Save metadata under new ID
                        if let Err(e) = self.save_metadata(&new_mod_id, &mod_info.metadata) {
                            log::warn!("      ⚠️  Failed to save metadata: {}", e);
                        }

                        // Migrate thumbnail
                        let old_thumb = self
                            .metadata_directory
                            .join(format!("{}_thumbnail.png", mod_info.id));
                        if old_thumb.exists() {
                            let new_thumb = self
                                .metadata_directory
                                .join(format!("{}_thumbnail.png", new_mod_id));
                            let _ = fs::copy(&old_thumb, &new_thumb);
                            let _ = fs::remove_file(&old_thumb);
                        }

                        // Re-point any add-ons referencing the old parent ID
                        if let Err(e) = self.migrate_addon_parent_ids(&mod_info.id, &new_mod_id) {
                            log::warn!("      ⚠️  Failed to migrate addon parent IDs: {}", e);
                        }

                        // Delete old metadata
                        let _ = self.delete_metadata(&mod_info.id);
                        log::info!(
                            "      ✅ Metadata migrated: {} → {}",
                            mod_info.id,
                            new_mod_id
                        );
                    }

                    migrated_count += 1;
                }
                Err(e) => {
                    log::warn!("      ⚠️  Failed to rename folder: {}", e);
                }
            }
        }

        if migrated_count > 0 {
            log::info!(
                "   ✅ Migrated {} mod(s) to costume folder structure",
                migrated_count
            );
        } else {
            log::info!("   ✅ All mods already using costume folder structure");
        }

        Ok(migrated_count)
    }

    /// Update mod metadata
    pub fn update_metadata(&self, mod_id: &str, metadata: ModMetadata) -> Result<ModInfo, String> {
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

            // Include costume in folder name if specified to avoid conflicts
            // e.g., "Cool-Mod-Phoenix-Demon" instead of just "Cool-Mod"
            let folder_name = if let Some(ref costume) = metadata.costume {
                format!("{}-{}", metadata.title, costume)
            } else {
                metadata.title.clone()
            };
            let sanitized_folder = sanitize_folder_name(&folder_name);
            // Add-ons get an "aa-" prefix so they mount BEFORE their parent pak.
            // For these body retexture conflicts the first mounted pak wins, so
            // the add-on must load ahead of the parent it overrides.
            let sanitized_folder = if metadata.parent_mod_id.is_some() {
                format!("aa-{sanitized_folder}")
            } else {
                sanitized_folder
            };
            folder_parts.push(sanitized_folder);
            let new_folder = folder_parts
                .iter()
                .fold(self.mods_directory.clone(), |path, part| path.join(part));

            log::info!(
                "   Current folder:  {:?}",
                parent_dir.file_name().unwrap_or_default()
            );
            log::info!(
                "   Expected folder: {:?}",
                new_folder.file_name().unwrap_or_default()
            );
            log::info!("");

            if parent_dir != new_folder {
                // Check if there are multiple .pak files in the current folder
                let pak_count = fs::read_dir(parent_dir)
                    .map(|entries| {
                        entries
                            .filter_map(|e| e.ok())
                            .filter(|e| {
                                e.path()
                                    .extension()
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
                    let pak_file_name = mod_file_path.file_name().ok_or("Invalid pak file name")?;
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

                // Migrate metadata to new ID
                if let Ok(Some(saved_metadata)) = self.load_metadata(mod_id) {
                    self.save_metadata(&new_mod_id, &saved_metadata)?;
                    log::info!("      ✅ Metadata migrated");
                } else {
                    // Fallback: save the current metadata with the new ID
                    self.save_metadata(&new_mod_id, &metadata)?;
                    log::info!("      ✅ Metadata saved with new ID (fallback)");
                }

                // Copy thumbnail if it exists
                let old_thumb_path = self
                    .metadata_directory
                    .join(format!("{}_thumbnail.png", mod_id));
                if old_thumb_path.exists() {
                    let new_thumb_path = self
                        .metadata_directory
                        .join(format!("{}_thumbnail.png", new_mod_id));
                    let _ = fs::copy(&old_thumb_path, &new_thumb_path);
                    let _ = fs::remove_file(&old_thumb_path);
                    log::info!("      ✅ Thumbnail migrated");
                }

                // Always clean up old metadata
                let _ = self.delete_metadata(mod_id);
                log::info!("      ✅ Old metadata cleaned up");

                // Migrate addons that reference the old parent ID
                self.migrate_addon_parent_ids(mod_id, &new_mod_id)?;

                log::info!("");
                log::info!("✅ METADATA UPDATE COMPLETE");
                log::info!("==========================================================");
                log::info!("");

                // Return the mod info with new ID
                let is_enabled = !file_name_str.ends_with(".disabled");
                return self
                    .create_mod_info(&new_file_path, &file_name_str, is_enabled, None)
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
        thumbnail_index: &HashMap<String, PathBuf>,
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

            if let Some(mod_info) =
                self.create_mod_info(path, file_name, is_enabled, Some(thumbnail_index))
            {
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

    fn create_mod_info(
        &self,
        file_path: &Path,
        file_name: &str,
        is_enabled: bool,
        thumbnail_index: Option<&HashMap<String, PathBuf>>,
    ) -> Option<ModInfo> {
        let metadata_result = fs::metadata(file_path);
        if metadata_result.is_err() {
            return None;
        }
        let metadata_fs = metadata_result.ok()?;

        let clean_file_name = file_name.replace(".disabled", "");
        // Use path-based ID to prevent duplicates when same mod installed multiple times
        let mod_id = self.generate_mod_id_from_path(file_path, &clean_file_name);

        // Load metadata if exists, or create and SAVE new metadata
        // This ensures every mod always has persisted metadata for enable/disable operations
        let (metadata, is_new_metadata) = match self.load_metadata(&mod_id).ok().flatten() {
            Some(m) => (m, false),
            None => {
                let category = self.detect_category_from_path(file_path, &clean_file_name);
                let character = self.detect_character_from_path(file_path, &clean_file_name);
                let now = Utc::now();

                // Extract and store original folder path for enable/disable operations
                let original_folder_path = if let Some(parent) = file_path.parent() {
                    // Only store if the mod is in a subfolder (not root of ~mods or disabled-mods)
                    if parent != &self.mods_directory && parent != &self.disabled_mods_directory {
                        // Try to get relative path from ~mods directory
                        if let Ok(relative) = parent.strip_prefix(&self.mods_directory) {
                            Some(relative.to_string_lossy().to_string())
                        } else if let Ok(relative) =
                            parent.strip_prefix(&self.disabled_mods_directory)
                        {
                            Some(relative.to_string_lossy().to_string())
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                } else {
                    None
                };

                (
                    ModMetadata {
                        title: self.extract_mod_name(&clean_file_name),
                        subtitle: None,
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
                        original_folder_path,
                        parent_mod_id: None,
                    },
                    true,
                )
            }
        };

        // Auto-save new metadata to ensure it persists for enable/disable operations
        // This prevents the "Metadata not found" error when toggling mods
        if is_new_metadata {
            if let Err(e) = self.save_metadata(&mod_id, &metadata) {
                log::warn!(
                    "[create_mod_info] Failed to auto-save metadata for {}: {}",
                    mod_id,
                    e
                );
            } else {
                log::debug!(
                    "[create_mod_info] Auto-saved metadata for new mod: {}",
                    mod_id
                );
            }
        }

        let associated_files = self.find_associated_files(file_path).ok()?;

        // Look for thumbnail using cached index if available, otherwise fall back to disk checks
        let thumbnail_path = if let Some(index) = thumbnail_index {
            self.find_thumbnail_cached(&mod_id, &clean_file_name, index)
        } else {
            self.find_thumbnail(&mod_id, &clean_file_name)
        };

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
            last_modified: metadata_fs
                .modified()
                .ok()
                .map(|t| t.into())
                .unwrap_or(Utc::now()),
            original_file_name: clean_file_name,
            associated_files,
            metadata,
        })
    }

    /// Fast thumbnail lookup using pre-built index (HashMap lookups instead of filesystem exists() calls)
    fn find_thumbnail_cached(
        &self,
        mod_id: &str,
        file_name: &str,
        index: &HashMap<String, PathBuf>,
    ) -> Option<PathBuf> {
        // Check new format: {mod_id}_thumbnail
        let new_key = format!("{}_thumbnail", mod_id).to_lowercase();
        if let Some(path) = index.get(&new_key) {
            return Some(path.clone());
        }

        // Check mod_id-based thumbnails
        if let Some(path) = index.get(&mod_id.to_lowercase()) {
            return Some(path.clone());
        }

        // Check filename-based thumbnails
        let base_name = Path::new(file_name).file_stem().and_then(|s| s.to_str())?;

        if let Some(path) = index.get(&base_name.to_lowercase()) {
            return Some(path.clone());
        }

        // Try with _P removed
        let alt_name = base_name.replace("_P", "").to_lowercase();
        if let Some(path) = index.get(&alt_name) {
            return Some(path.clone());
        }

        None
    }

    fn find_thumbnail(&self, mod_id: &str, file_name: &str) -> Option<PathBuf> {
        // Try common thumbnail formats
        let extensions = ["webp", "png", "jpg", "jpeg"];

        // First priority: Check for new thumbnail format in metadata directory
        let new_thumbnail_path = self
            .metadata_directory
            .join(format!("{}_thumbnail.png", mod_id));
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
        let base_name = Path::new(file_name).file_stem().and_then(|s| s.to_str())?;

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
            let mut normalized_path = path_str.replace(".disabled", "");
            // Windows paths can arrive with mixed separators (frontend folder
            // names use '/'); normalize so the same file always hashes to the
            // same ID no matter which side built the path
            if cfg!(windows) {
                normalized_path = normalized_path.replace('/', "\\");
            }
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

        // Clean up common suffixes and prefixes. Only strip a trailing _P —
        // a blanket replace mangles names like "D_Proficiency" → "Droficiency"
        let stem = stem.strip_suffix("_P").unwrap_or(stem);
        let cleaned_stem = stem
            .replace("_pak", "") // Remove _pak suffix
            .replace("&", " "); // Replace ampersand with space

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
                    let is_short_uppercase =
                        s.len() <= 2 && s.chars().all(|c| c.is_uppercase() || !c.is_alphabetic());
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
                    Some(first) => first
                        .to_uppercase()
                        .chain(chars.as_str().to_lowercase().chars())
                        .collect(),
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
            if (chars[i - 1].is_lowercase() && chars[i].is_uppercase())
                || (i > 1
                    && chars[i - 2].is_uppercase()
                    && chars[i - 1].is_uppercase()
                    && chars[i].is_lowercase())
            {
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

        for category in [
            ModCategory::UI,
            ModCategory::Audio,
            ModCategory::Skins,
            ModCategory::Gameplay,
        ] {
            if category
                .keywords()
                .iter()
                .any(|keyword| lower_name.contains(keyword))
            {
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
            Character::CaptainAmerica,
            Character::DoctorStrange,
            Character::Groot,
            Character::Hulk,
            Character::Magneto,
            Character::PeniParker,
            Character::TheThing,
            Character::Thor,
            Character::Venom,
            // Duelists
            Character::Angela,
            Character::Blade,
            Character::BlackPanther,
            Character::BlackWidow,
            Character::Daredevil,
            Character::EmmaFrost,
            Character::Hawkeye,
            Character::Hela,
            Character::HumanTorch,
            Character::IronFist,
            Character::Magik,
            Character::MisterFantastic,
            Character::MoonKnight,
            Character::Namor,
            Character::Phoenix,
            Character::Psylocke,
            Character::ScarletWitch,
            Character::SpiderMan,
            Character::SquirrelGirl,
            Character::StarLord,
            Character::Storm,
            Character::ThePunisher,
            Character::Ultron,
            Character::WinterSoldier,
            Character::Wolverine,
            // Strategists
            Character::AdamWarlock,
            Character::CloakAndDagger,
            Character::InvisibleWoman,
            Character::IronMan,
            Character::JeffTheLandShark,
            Character::Loki,
            Character::LunaSnow,
            Character::Mantis,
            Character::RocketRaccoon,
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
            Character::CaptainAmerica,
            Character::DoctorStrange,
            Character::Groot,
            Character::Hulk,
            Character::Magneto,
            Character::PeniParker,
            Character::TheThing,
            Character::Thor,
            Character::Venom,
            // Duelists
            Character::Angela,
            Character::Blade,
            Character::BlackPanther,
            Character::BlackWidow,
            Character::Daredevil,
            Character::EmmaFrost,
            Character::Hawkeye,
            Character::Hela,
            Character::HumanTorch,
            Character::IronFist,
            Character::Magik,
            Character::MisterFantastic,
            Character::MoonKnight,
            Character::Namor,
            Character::Phoenix,
            Character::Psylocke,
            Character::ScarletWitch,
            Character::SpiderMan,
            Character::SquirrelGirl,
            Character::StarLord,
            Character::Storm,
            Character::ThePunisher,
            Character::Ultron,
            Character::WinterSoldier,
            Character::Wolverine,
            // Strategists
            Character::AdamWarlock,
            Character::CloakAndDagger,
            Character::InvisibleWoman,
            Character::IronMan,
            Character::JeffTheLandShark,
            Character::Loki,
            Character::LunaSnow,
            Character::Mantis,
            Character::RocketRaccoon,
        ];

        for character in characters {
            if character
                .keywords()
                .iter()
                .any(|keyword| lower_name.contains(keyword))
            {
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

        fs::write(&metadata_path, json).map_err(|e| format!("Failed to write metadata: {}", e))?;

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

    /// Update all addon mods that reference an old parent ID to point to the new ID
    fn migrate_addon_parent_ids(&self, old_id: &str, new_id: &str) -> Result<(), String> {
        log::info!(
            "      🔄 Scanning for addons with parent_mod_id = {}",
            old_id
        );
        let mut migrated = 0;
        let mut scanned = 0;

        // Scan all metadata files in the metadata directory
        if let Ok(entries) = fs::read_dir(&self.metadata_directory) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) != Some("json") {
                    continue;
                }
                scanned += 1;

                if let Ok(content) = fs::read_to_string(&path) {
                    // Use a simple string check first for speed, then parse if match found
                    if content.contains(old_id) {
                        if let Ok(mut metadata) = serde_json::from_str::<ModMetadata>(&content) {
                            log::info!(
                                "      📄 Checking {:?} - parentModId: {:?}",
                                path.file_name(),
                                metadata.parent_mod_id
                            );
                            if metadata.parent_mod_id.as_deref() == Some(old_id) {
                                metadata.parent_mod_id = Some(new_id.to_string());
                                if let Ok(updated) = serde_json::to_string_pretty(&metadata) {
                                    let _ = fs::write(&path, updated);
                                    migrated += 1;
                                    log::info!("      ✅ Updated addon: {:?}", path.file_name());
                                }
                            }
                        }
                    }
                }
            }
        }

        log::info!(
            "      📊 Scanned {} metadata files, migrated {} addon(s)",
            scanned,
            migrated
        );
        Ok(())
    }

    /// Recursively copy a directory and all its contents
    fn copy_directory_recursive(&self, source: &Path, destination: &Path) -> Result<(), String> {
        log::info!("Copying directory from {:?} to {:?}", source, destination);

        // Create the destination directory
        fs::create_dir_all(destination)
            .map_err(|e| format!("Failed to create destination directory: {}", e))?;

        // Walk through the source directory
        for entry in WalkDir::new(source).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();

            // Get relative path from source
            let relative_path = path
                .strip_prefix(source)
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
            fs::create_dir_all(path).map_err(|e| format!("Failed to create directory: {}", e))?;
        }
        Ok(())
    }

    /// Detect conflicts between enabled mods: two or more mods overriding the
    /// same game asset. A parent mod and its own add-on are expected to share
    /// assets (that's how add-ons layer), so those pairs are NOT reported; only
    /// clashes between unrelated mods are returned.
    pub fn detect_mod_conflicts(&self) -> Result<Vec<ModConflict>, String> {
        let all_mods = self.get_all_mods()?;
        let enabled: Vec<&ModInfo> = all_mods.iter().filter(|m| m.enabled).collect();

        // For each enabled mod, read the asset paths its .utoc overrides along
        // with a content hash per asset (from the TOC's chunk metas), so that
        // byte-identical overlaps can be ignored.
        // Keyed by mod id -> map of asset path -> content hash.
        let mut mod_assets: HashMap<String, HashMap<String, String>> = HashMap::new();
        let mut load_key: HashMap<String, String> = HashMap::new();
        let mut title_by_id: HashMap<String, String> = HashMap::new();

        for m in &enabled {
            title_by_id.insert(m.id.clone(), m.metadata.title.clone());
            // The game mounts by lowercased full path; first wins.
            load_key.insert(m.id.clone(), m.file_path.to_string_lossy().to_lowercase());

            let utoc = m
                .associated_files
                .iter()
                .find(|p| p.extension().and_then(|e| e.to_str()) == Some("utoc"));
            let Some(utoc) = utoc else {
                continue; // loose .pak with no utoc — nothing to compare
            };
            match read_utoc_assets(utoc) {
                Ok(assets) => {
                    mod_assets.insert(m.id.clone(), assets);
                }
                Err(e) => {
                    log::warn!("[conflicts] Could not read {:?}: {}", utoc, e);
                }
            }
        }

        // A mod is "related" to another (and so not a conflict) when one is the
        // other's parent, or they share the same parent (sibling add-ons).
        let parent_of: HashMap<String, Option<String>> = enabled
            .iter()
            .map(|m| (m.id.clone(), m.metadata.parent_mod_id.clone()))
            .collect();
        let related = |a: &str, b: &str| -> bool {
            let pa = parent_of.get(a).cloned().flatten();
            let pb = parent_of.get(b).cloned().flatten();
            pa.as_deref() == Some(b)
                || pb.as_deref() == Some(a)
                || (pa.is_some() && pa == pb)
        };

        // asset path -> mod ids that override it
        let mut owners: HashMap<String, Vec<String>> = HashMap::new();
        for (id, assets) in &mod_assets {
            for a in assets.keys() {
                owners.entry(a.clone()).or_default().push(id.clone());
            }
        }

        // Group clashes by the set of mods involved.
        // key = sorted mod-id list -> set of shared asset paths
        let mut grouped: HashMap<Vec<String>, HashSet<String>> = HashMap::new();
        for (asset, ids) in &owners {
            if ids.len() < 2 {
                continue;
            }
            // Keep only ids that are unrelated to at least one other id here.
            let mut unrelated_ids: Vec<String> = Vec::new();
            for id in ids {
                let conflicts_with_someone = ids
                    .iter()
                    .any(|other| other != id && !related(id, other));
                if conflicts_with_someone {
                    unrelated_ids.push(id.clone());
                }
            }
            if unrelated_ids.len() < 2 {
                continue; // every owner is a relative of the others — expected layering
            }
            unrelated_ids.sort();
            unrelated_ids.dedup();

            // If every unrelated owner ships byte-identical content for this
            // asset (same chunk hashes), it doesn't matter who wins — authors
            // often bundle the same untouched base-game file. Skip it. A
            // missing hash is treated as different (flag rather than hide).
            let mut hashes: Vec<Option<&String>> = Vec::new();
            for id in &unrelated_ids {
                hashes.push(mod_assets.get(id).and_then(|a| a.get(asset)));
            }
            let all_known = hashes.iter().all(|h| h.is_some());
            if all_known {
                let first = hashes[0];
                if hashes.iter().all(|h| *h == first) {
                    continue; // identical content everywhere — harmless overlap
                }
            }

            grouped
                .entry(unrelated_ids)
                .or_default()
                .insert(asset.clone());
        }

        // Build the result list.
        let mut conflicts: Vec<ModConflict> = Vec::new();
        for (ids, assets) in grouped {
            // The winner is the mod whose load-order key sorts first.
            let winner = ids
                .iter()
                .min_by(|a, b| {
                    load_key
                        .get(*a)
                        .map(String::as_str)
                        .unwrap_or("")
                        .cmp(load_key.get(*b).map(String::as_str).unwrap_or(""))
                })
                .cloned();

            let mods: Vec<ConflictMod> = {
                let mut v: Vec<ConflictMod> = ids
                    .iter()
                    .map(|id| ConflictMod {
                        id: id.clone(),
                        title: title_by_id
                            .get(id)
                            .cloned()
                            .unwrap_or_else(|| id.clone()),
                        wins: Some(id) == winner.as_ref(),
                    })
                    .collect();
                // winner first
                v.sort_by(|a, b| b.wins.cmp(&a.wins).then(a.title.cmp(&b.title)));
                v
            };

            let mut asset_stems: Vec<String> = assets
                .iter()
                .map(|a| {
                    Path::new(a)
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or(a)
                        .to_string()
                })
                .collect();
            asset_stems.sort();
            asset_stems.dedup();

            let mut kinds: Vec<String> = asset_stems
                .iter()
                .map(|a| classify_asset(a))
                .collect();
            kinds.sort();
            kinds.dedup();

            conflicts.push(ModConflict {
                mods,
                kinds,
                assets: asset_stems,
            });
        }

        // Most-overlapping conflicts first.
        conflicts.sort_by(|a, b| b.assets.len().cmp(&a.assets.len()));
        Ok(conflicts)
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
    for entry in fs::read_dir(path).map_err(|e| format!("Failed to read directory: {}", e))? {
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

/// Lowercased title up to the first variant separator: a '-' with a space on
/// either side. "Reshaped Idol - No Nip", "Reshaped Idol -No Nip" and
/// "Reshaped Idol" all yield "reshaped idol".
fn base_title(title: &str) -> String {
    let lower = title.to_lowercase();
    let chars: Vec<char> = lower.chars().collect();
    for i in 0..chars.len() {
        if chars[i] == '-' {
            let space_before = i > 0 && chars[i - 1] == ' ';
            let space_after = i + 1 < chars.len() && chars[i + 1] == ' ';
            if space_before || space_after {
                let head: String = chars[..i].iter().collect();
                return head.trim().to_string();
            }
        }
    }
    lower.trim().to_string()
}

/// All single-segment space<->hyphen variants of a path. Used to reconstruct
/// where a pak lived before a character folder was renamed or merged
/// (e.g. "Black Widow" vs "Black-Widow").
fn path_segment_variants(path: &Path) -> Vec<PathBuf> {
    use std::path::Component;

    let comps: Vec<Component> = path.components().collect();
    let mut variants = Vec::new();

    for (i, comp) in comps.iter().enumerate() {
        let Component::Normal(os) = *comp else {
            continue;
        };
        let Some(seg) = os.to_str() else { continue };

        for replaced in [seg.replace('-', " "), seg.replace(' ', "-")] {
            if replaced == seg {
                continue;
            }
            let mut variant = PathBuf::new();
            for (j, comp) in comps.iter().enumerate() {
                if i == j {
                    variant.push(&replaced);
                } else {
                    variant.push(comp.as_os_str());
                }
            }
            variants.push(variant);
        }
    }

    variants
}

// ===== UE5 IoStore (.utoc) asset reader =====
//
// We only need the list of game asset paths a mod overrides — that lives in the
// uncompressed "directory index" of the .utoc, so no Oodle/decompression is
// required. The directory index begins with a mount-point FString ("../../../"
// for these mods); we locate it directly rather than summing the variable TOC
// sections (some paks include a perfect-hash block that shifts the offset).

const NONE_ENTRY: u32 = 0xFFFF_FFFF;

fn read_u32(buf: &[u8], off: usize) -> Option<u32> {
    buf.get(off..off + 4)
        .map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
}

fn read_i32(buf: &[u8], off: usize) -> Option<i32> {
    buf.get(off..off + 4)
        .map(|b| i32::from_le_bytes([b[0], b[1], b[2], b[3]]))
}

/// Read an Unreal FString at `off`. Returns (string, new_offset).
/// Positive length => UTF-8 (incl. trailing NUL); negative => UTF-16LE.
fn read_fstring(buf: &[u8], off: usize) -> Option<(String, usize)> {
    let n = read_i32(buf, off)?;
    let mut off = off + 4;
    if n == 0 {
        return Some((String::new(), off));
    }
    if n < 0 {
        let count = (-n) as usize;
        let bytes = buf.get(off..off + count * 2)?;
        off += count * 2;
        let u16s: Vec<u16> = bytes
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .collect();
        let s = String::from_utf16_lossy(&u16s)
            .trim_end_matches('\u{0}')
            .to_string();
        Some((s, off))
    } else {
        let count = n as usize;
        let bytes = buf.get(off..off + count)?;
        off += count;
        let s = String::from_utf8_lossy(bytes)
            .trim_end_matches('\u{0}')
            .to_string();
        Some((s, off))
    }
}

/// Parse the FIoDirectoryIndexResource starting at `start`, returning every
/// file it lists as (full path, chunk index). The chunk index (the entry's
/// user_data) points into the TOC's chunk tables, letting callers look up the
/// per-chunk content hash.
fn parse_directory_index(buf: &[u8], start: usize) -> Option<Vec<(String, u32)>> {
    let (_mount, mut off) = read_fstring(buf, start)?;

    let ndir = read_u32(buf, off)? as usize;
    off += 4;
    // dir entries: name, first_child, next_sibling, first_file (4 x u32)
    let mut dirs: Vec<[u32; 4]> = Vec::with_capacity(ndir);
    for _ in 0..ndir {
        let e = [
            read_u32(buf, off)?,
            read_u32(buf, off + 4)?,
            read_u32(buf, off + 8)?,
            read_u32(buf, off + 12)?,
        ];
        off += 16;
        dirs.push(e);
    }

    let nfile = read_u32(buf, off)? as usize;
    off += 4;
    // file entries: name, next_file, user_data (3 x u32)
    let mut files: Vec<[u32; 3]> = Vec::with_capacity(nfile);
    for _ in 0..nfile {
        let e = [
            read_u32(buf, off)?,
            read_u32(buf, off + 4)?,
            read_u32(buf, off + 8)?,
        ];
        off += 12;
        files.push(e);
    }

    let nstr = read_u32(buf, off)? as usize;
    off += 4;
    let mut strings: Vec<String> = Vec::with_capacity(nstr);
    for _ in 0..nstr {
        let (s, n) = read_fstring(buf, off)?;
        off = n;
        strings.push(s);
    }

    let name = |i: u32| -> &str {
        if i != NONE_ENTRY && (i as usize) < strings.len() {
            &strings[i as usize]
        } else {
            ""
        }
    };

    let mut out: Vec<(String, u32)> = Vec::new();
    if dirs.is_empty() {
        return Some(out);
    }

    // Iterative depth-first walk to avoid recursion limits / cycles.
    // stack holds (dir_index, parent_path).
    let mut stack: Vec<(u32, String)> = vec![(0, String::new())];
    let mut guard = 0usize;
    while let Some((di, prefix)) = stack.pop() {
        guard += 1;
        if di == NONE_ENTRY || di as usize >= dirs.len() || guard > 1_000_000 {
            continue;
        }
        let d = dirs[di as usize];
        let nm = name(d[0]);
        let path = if nm.is_empty() {
            prefix.clone()
        } else {
            format!("{}/{}", prefix.trim_end_matches('/'), nm)
        };

        // files in this directory: (name, next_file, user_data=chunk index)
        let mut fi = d[3];
        while fi != NONE_ENTRY && (fi as usize) < files.len() {
            let fe = files[fi as usize];
            let fname = name(fe[0]);
            if !fname.is_empty() {
                out.push((format!("{}/{}", path.trim_end_matches('/'), fname), fe[2]));
            }
            fi = fe[1];
        }

        // child directories (push siblings + this child)
        let mut c = d[1];
        while c != NONE_ENTRY && (c as usize) < dirs.len() {
            stack.push((c, path.clone()));
            c = dirs[c as usize][2];
        }
    }

    Some(out)
}

/// Read the assets a mod's `.utoc` overrides, as a map of the `.uasset` path
/// to a content hash. The hash combines the TOC chunk hashes of the asset AND
/// its sibling payload files (`.ubulk`/`.uexp` share the same stem), so two
/// mods shipping byte-identical copies of an asset produce the same value.
fn read_utoc_assets(path: &Path) -> Result<HashMap<String, String>, String> {
    let buf = fs::read(path).map_err(|e| format!("read utoc: {}", e))?;
    if buf.len() < 0x90 || &buf[0..16] != b"-==--==--==--==-" {
        return Err("not a TOC file".into());
    }
    // header: magic[16] version u8 reserved u8 reserved u16, then u32 fields:
    // header_size, entry_count, block_count, block_size, method_count,
    // method_len, compression_block_size, dir_index_size, ...
    let dir_index_size = read_u32(&buf, 16 + 4 + 4 * 7)
        .ok_or("truncated header")? as usize;

    // Find the mount point string "../../../" and back up 4 bytes to its
    // length prefix. We locate the directory index this way rather than
    // summing section sizes (some paks include a perfect-hash block that
    // shifts the offset).
    let needle = b"../../../";
    let mloc = buf
        .windows(needle.len())
        .position(|w| w == needle)
        .ok_or("directory index not found")?;
    if mloc < 4 {
        return Err("malformed directory index".into());
    }
    let start = mloc - 4;

    let files = parse_directory_index(&buf, start)
        .ok_or_else(|| String::from("failed to parse directory index"))?;

    // Chunk metas follow the directory index: one FIoStoreTocEntryMeta per
    // chunk = 32-byte content hash + 1 flag byte (33 bytes each).
    let metas_start = start + dir_index_size;
    let chunk_hash_hex = |idx: u32| -> Option<String> {
        let s = metas_start + (idx as usize) * 33;
        buf.get(s..s + 32)
            .map(|h| h.iter().map(|b| format!("{b:02x}")).collect())
    };

    // Group files by stem so payload siblings feed into the asset's hash.
    let mut stem_parts: HashMap<String, Vec<(String, String)>> = HashMap::new();
    for (fpath, chunk_idx) in &files {
        let (stem, ext) = match fpath.rsplit_once('.') {
            Some((s, e)) => (s.to_string(), e.to_string()),
            None => (fpath.clone(), String::new()),
        };
        let h = chunk_hash_hex(*chunk_idx).unwrap_or_default();
        stem_parts.entry(stem).or_default().push((ext, h));
    }

    let mut out: HashMap<String, String> = HashMap::new();
    for (stem, mut parts) in stem_parts {
        if !parts.iter().any(|(e, _)| e == "uasset") {
            continue;
        }
        parts.sort();
        let combined: String = parts
            .iter()
            .map(|(e, h)| format!("{e}:{h}"))
            .collect::<Vec<_>>()
            .join("|");
        out.insert(format!("{stem}.uasset"), combined);
    }
    Ok(out)
}

/// Map an asset file stem to a human-readable conflict "kind" for the UI.
fn classify_asset(stem: &str) -> String {
    let s = stem.to_lowercase();
    if s.starts_with("sk_") || s.contains("_skeleton") || s.contains("_lobby") {
        "Body Mesh".to_string()
    } else if s.contains("_body_") || s.ends_with("_body") || s.contains("body_0") {
        "Body Skin".to_string()
    } else if s.contains("_hair") {
        "Hair".to_string()
    } else if s.contains("_head") || s.contains("_face") || s.contains("_eyes") {
        "Face".to_string()
    } else if s.contains("_equip") || s.contains("_custom") || s.contains("_cloth") {
        "Outfit".to_string()
    } else if s.contains("_weapon") || s.contains("_rifle") || s.contains("_sword") {
        "Weapon".to_string()
    } else if s.starts_with("mi_") || s.starts_with("m_") {
        "Material".to_string()
    } else {
        "Other".to_string()
    }
}
