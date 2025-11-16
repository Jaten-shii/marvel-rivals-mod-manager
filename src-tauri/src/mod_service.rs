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

        log::debug!("ModService initialized with mods directory: {:?}", mods_directory);
        log::debug!("Thumbnails directory: {:?}", thumbnails_directory);

        Self {
            mods_directory,
            disabled_mods_directory,
            metadata_directory,
            thumbnails_directory,
        }
    }

    /// Get all mods in the mods directory
    pub fn get_all_mods(&self) -> Result<Vec<ModInfo>, String> {
        log::info!("Scanning mods directory: {:?}", self.mods_directory);
        log::info!("Scanning disabled mods directory: {:?}", self.disabled_mods_directory);

        self.ensure_directory_exists(&self.mods_directory)?;
        self.ensure_directory_exists(&self.disabled_mods_directory)?;

        let mut mods = Vec::new();
        let mut processed_paths = HashSet::new();
        let mut processed_ids = HashSet::new();

        // Scan active mods directory
        log::info!("Starting scan of active mods...");
        self.scan_directory_with_deduplication(
            &self.mods_directory,
            &mut mods,
            &mut processed_paths,
            &mut processed_ids,
            true,
        )?;

        log::info!("Found {} active mods", mods.len());

        // Scan disabled mods directory
        log::info!("Starting scan of disabled mods...");
        self.scan_directory_with_deduplication(
            &self.disabled_mods_directory,
            &mut mods,
            &mut processed_paths,
            &mut processed_ids,
            false,
        )?;

        log::info!("Total mods found: {}", mods.len());

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
        self.create_mod_info(&dest_path, file_name, true)
            .ok_or_else(|| "Failed to create mod info".to_string())
    }

    /// Organize loose mods into proper folder structure
    /// Returns the number of mods that were organized
    pub fn organize_loose_mods(&self) -> Result<usize, String> {
        log::info!("Organizing loose mods in directory: {:?}", self.mods_directory);

        // Get all current mods
        let all_mods = self.get_all_mods()?;
        let mut organized_count = 0;

        for mod_info in all_mods {
            // Skip disabled mods
            if !mod_info.enabled {
                continue;
            }

            // Check if mod is in a properly organized folder
            let file_path = &mod_info.file_path;

            // Get the parent directory of the mod file
            let parent_dir = file_path.parent().ok_or("Invalid file path")?;

            // Check if it's directly in the ~mods directory (loose file)
            let is_loose = parent_dir == self.mods_directory;

            if is_loose {
                // Build the target folder structure
                let mut folder_parts = vec![mod_info.category.to_string()];

                // Add character folder if specified
                if let Some(ref character) = mod_info.character {
                    folder_parts.push(character.to_string());
                }

                // Add mod name folder
                folder_parts.push(sanitize_folder_name(&mod_info.name));

                // Create the full target path
                let target_folder = folder_parts.iter()
                    .fold(self.mods_directory.clone(), |path, part| path.join(part));

                // Create target directory
                fs::create_dir_all(&target_folder)
                    .map_err(|e| format!("Failed to create target directory: {}", e))?;

                // Move all associated files
                for file_path in &mod_info.associated_files {
                    let file_name = file_path.file_name()
                        .ok_or("Invalid file name")?;

                    let target_path = target_folder.join(file_name);

                    fs::rename(file_path, &target_path)
                        .map_err(|e| format!("Failed to move file: {}", e))?;

                    log::info!("Moved file {:?} to {:?}", file_path, target_path);
                }

                organized_count += 1;
                log::info!("Organized mod: {} into {:?}", mod_info.name, target_folder);
            }
        }

        log::info!("Organized {} loose mod(s)", organized_count);

        // Clean up any empty folders after organizing
        if let Ok(cleaned) = self.cleanup_empty_mod_folders() {
            if cleaned > 0 {
                log::info!("Cleaned up {} empty folder(s) after organizing", cleaned);
            }
        }

        Ok(organized_count)
    }

    /// Clean up empty mod folders (but keep category and character folders)
    /// Returns the number of empty folders removed
    pub fn cleanup_empty_mod_folders(&self) -> Result<usize, String> {
        log::info!("Cleaning up empty mod folders in: {:?}", self.mods_directory);

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
                    log::debug!("Skipping character folder: {:?}", path);
                    continue;
                }
            }

            // Check if folder is empty (no files, only empty subdirectories)
            if is_folder_empty(path)? {
                log::info!("Found empty mod folder: {:?}", path);
                folders_to_remove.push(path.to_path_buf());
            }
        }

        // Remove empty folders (in reverse order to remove children before parents)
        folders_to_remove.sort_by(|a, b| b.cmp(a));
        for folder in folders_to_remove {
            match fs::remove_dir_all(&folder) {
                Ok(_) => {
                    log::info!("Removed empty folder: {:?}", folder);
                    removed_count += 1;
                }
                Err(e) => {
                    log::warn!("Failed to remove empty folder {:?}: {}", folder, e);
                }
            }
        }

        log::info!("Removed {} empty mod folder(s)", removed_count);
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

    /// Update mod metadata
    pub fn update_metadata(
        &self,
        mod_id: &str,
        metadata: ModMetadata,
    ) -> Result<ModInfo, String> {
        // Get the old mod info to check if folder needs to be renamed
        let old_mod = self.find_mod_by_id(mod_id)?
            .ok_or_else(|| "Mod not found".to_string())?;

        // IMPORTANT: Save metadata FIRST before any folder operations
        // This ensures metadata is preserved even if folder rename triggers a rescan
        self.save_metadata(mod_id, &metadata)?;
        log::info!("Saved metadata for mod: {}", mod_id);

        // Check if mod name, category, or character changed
        let name_changed = metadata.title != old_mod.name;
        let category_changed = metadata.category != old_mod.category;
        let character_changed = metadata.character != old_mod.character;

        // If any folder-affecting property changed, rename the folder
        if name_changed || category_changed || character_changed {
            // Get the main mod file path
            let mod_file_path = PathBuf::from(&old_mod.file_path);
            let parent_dir = mod_file_path.parent().ok_or("Invalid mod file path")?;

            // Check if mod is in a folder (not loose in ~mods)
            let is_in_folder = parent_dir != self.mods_directory;

            if is_in_folder {
                // Build new folder structure
                let mut folder_parts = vec![
                    sanitize_folder_name(&metadata.category.to_string())
                ];

                if let Some(ref character) = metadata.character.as_ref().or(old_mod.character.as_ref()) {
                    folder_parts.push(sanitize_folder_name(&character.to_string()));
                }

                folder_parts.push(sanitize_folder_name(&metadata.title));

                let new_folder = folder_parts.iter()
                    .fold(self.mods_directory.clone(), |path, part| path.join(part));

                // Only rename if the folder actually changed
                if parent_dir != new_folder {
                    log::info!("Renaming mod folder from {:?} to {:?}", parent_dir, new_folder);

                    // Create parent directories for new location
                    if let Some(new_parent) = new_folder.parent() {
                        fs::create_dir_all(new_parent)
                            .map_err(|e| format!("Failed to create parent directory: {}", e))?;
                    }

                    // Try to rename the folder
                    // If rename fails (e.g., due to file locks), fall back to copy+delete
                    match fs::rename(parent_dir, &new_folder) {
                        Ok(_) => {
                            log::info!("Successfully renamed mod folder");
                        }
                        Err(e) => {
                            log::warn!("Rename failed: {}, attempting copy+delete instead", e);

                            // Fallback: Copy all files to new location, then delete old folder
                            self.copy_directory_recursive(parent_dir, &new_folder)?;

                            // Delete the old folder
                            fs::remove_dir_all(parent_dir)
                                .map_err(|e| format!("Failed to remove old mod folder: {}", e))?;

                            log::info!("Successfully moved mod folder via copy+delete");
                        }
                    }
                }
            }
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
                log::debug!("Found file: {:?}", path);
            }

            if !entry.file_type().is_file() || !self.is_mod_file(path) {
                continue;
            }

            pak_count += 1;
            log::info!("Found .pak file: {:?}", path);

            let normalized_path = path.to_path_buf();
            if processed_paths.contains(&normalized_path) {
                log::debug!("Skipping duplicate path: {:?}", path);
                continue;
            }

            let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

            if let Some(mod_info) = self.create_mod_info(path, file_name, is_enabled) {
                if processed_ids.contains(&mod_info.id) {
                    log::debug!("Skipping duplicate ID: {}", mod_info.id);
                    continue;
                }

                log::info!("Created mod info: {} (category: {:?}, character: {:?})", mod_info.name, mod_info.category, mod_info.character);
                processed_paths.insert(normalized_path);
                processed_ids.insert(mod_info.id.clone());
                mods.push(mod_info);
            } else {
                log::warn!("Failed to create mod info for: {:?}", path);
            }
        }

        log::info!("Scan complete for {:?}: {} total files, {} .pak files, {} mods created",
            dir_path, file_count, pak_count, mods.len());

        Ok(())
    }

    fn create_mod_info(&self, file_path: &Path, file_name: &str, is_enabled: bool) -> Option<ModInfo> {
        let metadata_result = fs::metadata(file_path);
        if metadata_result.is_err() {
            return None;
        }
        let metadata_fs = metadata_result.ok()?;

        let clean_file_name = file_name.replace(".disabled", "");
        let mod_id = self.generate_mod_id(&clean_file_name);

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
            log::debug!("Found new-format thumbnail: {:?}", new_thumbnail_path);
            return Some(new_thumbnail_path);
        }

        // Second priority: Check for mod_id-based thumbnails in thumbnails directory (from old Electron app)
        for ext in &extensions {
            let id_thumbnail = format!("{}.{}", mod_id, ext);
            let id_path = self.thumbnails_directory.join(&id_thumbnail);

            if id_path.exists() {
                log::debug!("Found thumbnail by mod_id: {:?}", id_path);
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
                log::debug!("Found thumbnail by filename: {:?}", thumbnail_path);
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
