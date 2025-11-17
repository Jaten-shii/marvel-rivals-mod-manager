use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager};

// Marvel Rivals Mod Manager modules
mod types;
mod mod_service;
mod file_watcher;
mod archive_extractor;
mod thumbnail_service;
mod costume_service;

use types::*;
use mod_service::ModService;
use file_watcher::{start_file_watcher, stop_file_watcher};
use archive_extractor::{extract_archive, detect_mods_in_archive, extract_and_detect_mods};
use thumbnail_service::{ThumbnailService, CropData};
use costume_service::{initialize_costume_service, get_costumes_for_character, get_all_costumes, get_costume};

// Validation functions
fn validate_filename(filename: &str) -> Result<(), String> {
    // Regex pattern: only alphanumeric, dash, underscore, dot
    let filename_pattern = Regex::new(r"^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9]+)?$")
        .map_err(|e| format!("Regex compilation error: {e}"))?;

    if filename.is_empty() {
        return Err("Filename cannot be empty".to_string());
    }

    if filename.len() > 100 {
        return Err("Filename too long (max 100 characters)".to_string());
    }

    if !filename_pattern.is_match(filename) {
        return Err(
            "Invalid filename: only alphanumeric characters, dashes, underscores, and dots allowed"
                .to_string(),
        );
    }

    Ok(())
}

fn validate_string_input(input: &str, max_len: usize, field_name: &str) -> Result<(), String> {
    if input.len() > max_len {
        return Err(format!("{field_name} too long (max {max_len} characters)"));
    }
    Ok(())
}

fn validate_theme(theme: &str) -> Result<(), String> {
    match theme {
        "dark-classic" | "light-classic" | "forest" | "ruby" | "ice" => Ok(()),
        _ => Err("Invalid theme: must be 'dark-classic', 'light-classic', 'forest', 'ruby', or 'ice'".to_string()),
    }
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    // Input validation
    if let Err(e) = validate_string_input(name, 100, "Name") {
        log::warn!("Invalid greet input: {e}");
        return format!("Error: {e}");
    }

    log::info!("Greeting user: {name}");
    format!("Hello, {name}! You've been greeted from Rust!")
}

// Preferences data structure
// Only contains settings that should be persisted to disk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppPreferences {
    pub theme: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font: Option<String>,
    // Add new persistent preferences here, e.g.:
    // pub auto_save: bool,
    // pub language: String,
}

impl Default for AppPreferences {
    fn default() -> Self {
        Self {
            theme: "dark-classic".to_string(),
            font: Some("quicksand".to_string()),
            // Add defaults for new preferences here
        }
    }
}

fn get_preferences_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {e}"))?;

    // Ensure the directory exists
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {e}"))?;

    Ok(app_data_dir.join("preferences.json"))
}

#[tauri::command]
async fn load_preferences(app: AppHandle) -> Result<AppPreferences, String> {
    let prefs_path = get_preferences_path(&app)?;

    if !prefs_path.exists() {
        log::info!("Preferences file not found, using defaults");
        return Ok(AppPreferences::default());
    }

    let contents = std::fs::read_to_string(&prefs_path).map_err(|e| {
        log::error!("Failed to read preferences file: {e}");
        format!("Failed to read preferences file: {e}")
    })?;

    let preferences: AppPreferences = serde_json::from_str(&contents).map_err(|e| {
        log::error!("Failed to parse preferences JSON: {e}");
        format!("Failed to parse preferences: {e}")
    })?;

    Ok(preferences)
}

#[tauri::command]
async fn save_preferences(app: AppHandle, preferences: AppPreferences) -> Result<(), String> {
    // Validate theme value
    validate_theme(&preferences.theme)?;

    log::debug!("Saving preferences to disk: {preferences:?}");
    let prefs_path = get_preferences_path(&app)?;

    let json_content = serde_json::to_string_pretty(&preferences).map_err(|e| {
        log::error!("Failed to serialize preferences: {e}");
        format!("Failed to serialize preferences: {e}")
    })?;

    // Write to a temporary file first, then rename (atomic operation)
    let temp_path = prefs_path.with_extension("tmp");

    std::fs::write(&temp_path, json_content).map_err(|e| {
        log::error!("Failed to write preferences file: {e}");
        format!("Failed to write preferences file: {e}")
    })?;

    std::fs::rename(&temp_path, &prefs_path).map_err(|e| {
        log::error!("Failed to finalize preferences file: {e}");
        format!("Failed to finalize preferences file: {e}")
    })?;

    log::info!("Successfully saved preferences to {prefs_path:?}");
    Ok(())
}

#[tauri::command]
async fn send_native_notification(
    app: AppHandle,
    title: String,
    body: Option<String>,
) -> Result<(), String> {
    log::info!("Sending native notification: {title}");

    #[cfg(not(mobile))]
    {
        use tauri_plugin_notification::NotificationExt;

        let mut notification = app.notification().builder().title(title);

        if let Some(body_text) = body {
            notification = notification.body(body_text);
        }

        match notification.show() {
            Ok(_) => {
                log::info!("Native notification sent successfully");
                Ok(())
            }
            Err(e) => {
                log::error!("Failed to send native notification: {e}");
                Err(format!("Failed to send notification: {e}"))
            }
        }
    }

    #[cfg(mobile)]
    {
        log::warn!("Native notifications not supported on mobile");
        Err("Native notifications not supported on mobile".to_string())
    }
}

// Recovery functions - simple pattern for saving JSON data to disk
fn get_recovery_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {e}"))?;

    let recovery_dir = app_data_dir.join("recovery");

    // Ensure the recovery directory exists
    std::fs::create_dir_all(&recovery_dir)
        .map_err(|e| format!("Failed to create recovery directory: {e}"))?;

    Ok(recovery_dir)
}

#[tauri::command]
async fn save_emergency_data(app: AppHandle, filename: String, data: Value) -> Result<(), String> {
    log::info!("Saving emergency data to file: {filename}");

    // Validate filename with proper security checks
    validate_filename(&filename)?;

    // Validate data size (10MB limit)
    let data_str = serde_json::to_string(&data)
        .map_err(|e| format!("Failed to serialize data for size check: {e}"))?;
    if data_str.len() > 10_485_760 {
        return Err("Data too large (max 10MB)".to_string());
    }

    let recovery_dir = get_recovery_dir(&app)?;
    let file_path = recovery_dir.join(format!("{filename}.json"));

    let json_content = serde_json::to_string_pretty(&data).map_err(|e| {
        log::error!("Failed to serialize emergency data: {e}");
        format!("Failed to serialize data: {e}")
    })?;

    // Write to a temporary file first, then rename (atomic operation)
    let temp_path = file_path.with_extension("tmp");

    std::fs::write(&temp_path, json_content).map_err(|e| {
        log::error!("Failed to write emergency data file: {e}");
        format!("Failed to write data file: {e}")
    })?;

    std::fs::rename(&temp_path, &file_path).map_err(|e| {
        log::error!("Failed to finalize emergency data file: {e}");
        format!("Failed to finalize data file: {e}")
    })?;

    log::info!("Successfully saved emergency data to {file_path:?}");
    Ok(())
}

#[tauri::command]
async fn load_emergency_data(app: AppHandle, filename: String) -> Result<Value, String> {
    log::info!("Loading emergency data from file: {filename}");

    // Validate filename with proper security checks
    validate_filename(&filename)?;

    let recovery_dir = get_recovery_dir(&app)?;
    let file_path = recovery_dir.join(format!("{filename}.json"));

    if !file_path.exists() {
        log::info!("Recovery file not found: {file_path:?}");
        return Err("File not found".to_string());
    }

    let contents = std::fs::read_to_string(&file_path).map_err(|e| {
        log::error!("Failed to read recovery file: {e}");
        format!("Failed to read file: {e}")
    })?;

    let data: Value = serde_json::from_str(&contents).map_err(|e| {
        log::error!("Failed to parse recovery JSON: {e}");
        format!("Failed to parse data: {e}")
    })?;

    log::info!("Successfully loaded emergency data");
    Ok(data)
}

#[tauri::command]
async fn cleanup_old_recovery_files(app: AppHandle) -> Result<u32, String> {
    let recovery_dir = get_recovery_dir(&app)?;
    let mut removed_count = 0;

    // Calculate cutoff time (7 days ago)
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Failed to get current time: {e}"))?
        .as_secs();
    let seven_days_ago = now - (7 * 24 * 60 * 60);

    // Read directory and check each file
    let entries = std::fs::read_dir(&recovery_dir).map_err(|e| {
        log::error!("Failed to read recovery directory: {e}");
        format!("Failed to read directory: {e}")
    })?;

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(e) => {
                log::warn!("Failed to read directory entry: {e}");
                continue;
            }
        };

        let path = entry.path();

        // Only process JSON files
        if path.extension().is_none_or(|ext| ext != "json") {
            continue;
        }

        // Check file modification time
        let metadata = match std::fs::metadata(&path) {
            Ok(m) => m,
            Err(e) => {
                log::warn!("Failed to get file metadata: {e}");
                continue;
            }
        };

        let modified = match metadata.modified() {
            Ok(m) => m,
            Err(e) => {
                log::warn!("Failed to get file modification time: {e}");
                continue;
            }
        };

        let modified_secs = match modified.duration_since(UNIX_EPOCH) {
            Ok(d) => d.as_secs(),
            Err(e) => {
                log::warn!("Failed to convert modification time: {e}");
                continue;
            }
        };

        // Remove if older than 7 days
        if modified_secs < seven_days_ago {
            match std::fs::remove_file(&path) {
                Ok(_) => {
                    log::info!("Removed old recovery file: {path:?}");
                    removed_count += 1;
                }
                Err(e) => {
                    log::warn!("Failed to remove old recovery file: {e}");
                }
            }
        }
    }

    if removed_count > 0 {
        log::info!("🗑️  Cleaned up {} old recovery file(s)", removed_count);
    }
    Ok(removed_count)
}

// ===== MIGRATION COMMANDS =====

use serde_json::Value as JsonValue;

#[tauri::command]
async fn migrate_electron_data(app: AppHandle) -> Result<(usize, usize), String> {
    log::info!("Starting migration from Electron app data");

    let old_app_data = std::env::var("APPDATA")
        .map(PathBuf::from)
        .map_err(|_| "Could not find AppData directory")?
        .join("marvel-rivals-mod-manager")
        .join("Marvel Rivals Mod Manager");

    if !old_app_data.exists() {
        return Err("Old Electron app data not found".to_string());
    }

    let old_metadata_dir = old_app_data.join("metadata");
    let old_thumbnails_dir = old_app_data.join("thumbnails");

    let new_app_data = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let new_metadata_dir = new_app_data.join("metadata");
    let new_thumbnails_dir = new_app_data.join("thumbnails");

    // Create new directories
    std::fs::create_dir_all(&new_metadata_dir)
        .map_err(|e| format!("Failed to create metadata directory: {}", e))?;
    std::fs::create_dir_all(&new_thumbnails_dir)
        .map_err(|e| format!("Failed to create thumbnails directory: {}", e))?;

    let mut migrated_metadata = 0;
    let mut migrated_thumbnails = 0;

    // Migrate ALL thumbnails first (not just referenced ones)
    if old_thumbnails_dir.exists() {
        for entry in std::fs::read_dir(&old_thumbnails_dir)
            .map_err(|e| format!("Failed to read old thumbnails directory: {}", e))?
        {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();

            if path.is_file() {
                if let Some(file_name) = path.file_name() {
                    let new_thumb_path = new_thumbnails_dir.join(file_name);
                    if std::fs::copy(&path, &new_thumb_path).is_ok() {
                        migrated_thumbnails += 1;
                    }
                }
            }
        }
    }

    // Migrate metadata files
    if old_metadata_dir.exists() {
        for entry in std::fs::read_dir(&old_metadata_dir)
            .map_err(|e| format!("Failed to read old metadata directory: {}", e))?
        {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();

            if path.extension().and_then(|s| s.to_str()) != Some("json") {
                continue;
            }

            // Read old metadata
            let content = std::fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read metadata file: {}", e))?;

            let mut old_meta: JsonValue = serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse metadata: {}", e))?;

            // Convert field names to match camelCase serialization
            if let Some(obj) = old_meta.as_object_mut() {
                // Rename isNSFW -> isNsfw (camelCase)
                if let Some(is_nsfw) = obj.remove("isNSFW") {
                    obj.insert("isNsfw".to_string(), is_nsfw);
                }

                // Rename profileIds -> profileIds (already correct)
                // Ensure isFavorite exists
                if !obj.contains_key("isFavorite") {
                    obj.insert("isFavorite".to_string(), JsonValue::Bool(false));
                }

                // Remove customThumbnail field (thumbnails copied separately)
                obj.remove("customThumbnail");

                // Convert character name to match new enum if needed
                if let Some(char_name) = obj.get("character").and_then(|v| v.as_str()) {
                    // Only normalize special cases
                    let normalized_name = match char_name {
                        "Cloak" => "Cloak and Dagger", // Old metadata might have just "Cloak"
                        "Dagger" => "Cloak and Dagger", // Old metadata might have just "Dagger"
                        "Cloak & Dagger" => "Cloak and Dagger", // Old metadata with ampersand
                        "Jeff" => "Jeff the Land Shark", // Old metadata might have just "Jeff"
                        "Punisher" => "The Punisher", // Old metadata might have just "Punisher"
                        "Mister" => "Mister Fantastic", // Old metadata might have just "Mister"
                        "Spider-Man" => "Spider Man", // Old metadata with hyphen
                        "Star-Lord" => "Star Lord", // Old metadata with hyphen
                        _ => char_name
                    };

                    if normalized_name != char_name {
                        obj.insert("character".to_string(), JsonValue::String(normalized_name.to_string()));
                    }
                }

                // Add missing fields with defaults (camelCase)
                let now = chrono::Utc::now().to_rfc3339();

                if !obj.contains_key("author") {
                    obj.insert("author".to_string(), JsonValue::Null);
                }
                if !obj.contains_key("version") {
                    obj.insert("version".to_string(), JsonValue::Null);
                }
                if !obj.contains_key("title") {
                    obj.insert("title".to_string(), JsonValue::String("Untitled Mod".to_string()));
                }
                if !obj.contains_key("description") {
                    obj.insert("description".to_string(), JsonValue::String("".to_string()));
                }
                if !obj.contains_key("tags") {
                    obj.insert("tags".to_string(), JsonValue::Array(vec![]));
                }
                if !obj.contains_key("category") {
                    obj.insert("category".to_string(), JsonValue::String("Skins".to_string()));
                }
                if !obj.contains_key("isNsfw") {
                    obj.insert("isNsfw".to_string(), JsonValue::Bool(false));
                }
                if !obj.contains_key("createdAt") {
                    obj.insert("createdAt".to_string(), JsonValue::String(now.clone()));
                }
                if !obj.contains_key("updatedAt") {
                    obj.insert("updatedAt".to_string(), JsonValue::String(now.clone()));
                }
                if !obj.contains_key("installDate") {
                    if let Some(created) = obj.get("createdAt") {
                        obj.insert("installDate".to_string(), created.clone());
                    } else {
                        obj.insert("installDate".to_string(), JsonValue::String(now.clone()));
                    }
                }
                if !obj.contains_key("profileIds") {
                    obj.insert("profileIds".to_string(), JsonValue::Array(vec![]));
                }
                if !obj.contains_key("nexusModId") {
                    obj.insert("nexusModId".to_string(), JsonValue::Null);
                }
                if !obj.contains_key("nexusFileId") {
                    obj.insert("nexusFileId".to_string(), JsonValue::Null);
                }
                if !obj.contains_key("nexusVersion") {
                    obj.insert("nexusVersion".to_string(), JsonValue::Null);
                }
            }

            // Write new metadata
            let new_path = new_metadata_dir.join(entry.file_name());
            let new_content = serde_json::to_string_pretty(&old_meta)
                .map_err(|e| format!("Failed to serialize metadata: {}", e))?;

            std::fs::write(&new_path, new_content)
                .map_err(|e| format!("Failed to write metadata: {}", e))?;

            migrated_metadata += 1;
        }
    }

    log::info!("Migration complete: {} metadata files, {} thumbnails",
        migrated_metadata, migrated_thumbnails);

    Ok((migrated_metadata, migrated_thumbnails))
}

// ===== MOD MANAGEMENT COMMANDS =====

fn get_mod_service(app: &AppHandle) -> Result<ModService, String> {
    // Get settings to find game directory
    let app_settings = load_app_settings(app)?;

    let game_directory = app_settings.game_directory
        .ok_or("Game directory not configured")?;

    let metadata_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?
        .join("metadata");

    Ok(ModService::new(game_directory, metadata_dir))
}

#[tauri::command]
async fn get_all_mods(app: AppHandle) -> Result<Vec<ModInfo>, String> {
    let service = get_mod_service(&app)?;
    service.get_all_mods()
}

#[tauri::command]
async fn install_mod(app: AppHandle, file_path: String) -> Result<ModInfo, String> {
    log::info!("Installing mod from: {}", file_path);
    let service = get_mod_service(&app)?;
    service.install_mod(PathBuf::from(file_path).as_path())
}

#[tauri::command]
async fn install_mod_to_folder(app: AppHandle, file_path: String, folder_name: String) -> Result<ModInfo, String> {
    log::info!("Installing mod from {} to folder: {}", file_path, folder_name);
    let service = get_mod_service(&app)?;
    service.install_mod_to_folder(PathBuf::from(file_path).as_path(), &folder_name)
}

#[tauri::command]
async fn install_mod_to_folder_with_metadata(
    app: AppHandle,
    file_path: String,
    folder_name: String,
    metadata: ModMetadata,
) -> Result<ModInfo, String> {
    log::info!("Installing mod from {} to folder {} with custom metadata", file_path, folder_name);
    let service = get_mod_service(&app)?;
    service.install_mod_to_folder_with_metadata(PathBuf::from(file_path).as_path(), &folder_name, metadata)
}

#[tauri::command]
async fn enable_mod(app: AppHandle, mod_id: String, enabled: bool) -> Result<(), String> {
    log::info!("Setting mod {} enabled status to: {}", mod_id, enabled);
    let service = get_mod_service(&app)?;
    service.enable_mod(&mod_id, enabled)
}

#[tauri::command]
async fn delete_mod(app: AppHandle, mod_id: String) -> Result<(), String> {
    log::info!("Deleting mod: {}", mod_id);
    let service = get_mod_service(&app)?;
    service.delete_mod(&mod_id)
}

#[tauri::command]
async fn update_mod_metadata(app: AppHandle, mod_id: String, metadata: ModMetadata) -> Result<ModInfo, String> {
    log::info!("Updating metadata for mod: {}", mod_id);
    let service = get_mod_service(&app)?;
    service.update_metadata(&mod_id, metadata)
}

#[tauri::command]
async fn remove_profile_from_all_mods(app: AppHandle, profile_id: String) -> Result<usize, String> {
    log::info!("Removing profile {} from all mods", profile_id);
    let service = get_mod_service(&app)?;
    service.remove_profile_from_all_mods(&profile_id)
}

#[tauri::command]
async fn organize_mods(app: AppHandle) -> Result<usize, String> {
    let service = get_mod_service(&app)?;
    service.organize_loose_mods()
}

#[tauri::command]
async fn merge_duplicate_folders(app: AppHandle) -> Result<usize, String> {
    let service = get_mod_service(&app)?;
    service.merge_duplicate_folders()
}

#[tauri::command]
async fn migrate_metadata_to_path_ids(app: AppHandle) -> Result<usize, String> {
    let service = get_mod_service(&app)?;
    service.migrate_metadata_to_path_ids()
}

#[tauri::command]
async fn log_total_mods_found(app: AppHandle) -> Result<(), String> {
    let service = get_mod_service(&app)?;
    let mods = service.get_all_mods()?;
    let active_count = mods.iter().filter(|m| m.enabled).count();
    let disabled_count = mods.len() - active_count;

    log::info!("");
    if disabled_count > 0 {
        log::info!("📦 Found {} mod(s) total ({} active, {} disabled)", mods.len(), active_count, disabled_count);
    } else {
        log::info!("📦 Found {} mod(s) total", mods.len());
    }
    log::info!("");

    Ok(())
}

#[tauri::command]
async fn get_metadata_directory(app: AppHandle) -> Result<String, String> {
    let metadata_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?
        .join("metadata");

    metadata_dir
        .to_str()
        .ok_or("Invalid path".to_string())
        .map(|s| s.to_string())
}

#[tauri::command]
async fn copy_metadata_from_old_id(
    app: AppHandle,
    current_mod_id: String,
    old_mod_id: String,
) -> Result<(), String> {
    let service = get_mod_service(&app)?;
    service.copy_metadata_from_old_id(&current_mod_id, &old_mod_id)
}

// ===== THUMBNAIL COMMANDS =====

fn get_thumbnail_service(app: &AppHandle) -> Result<ThumbnailService, String> {
    let metadata_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?
        .join("metadata");

    Ok(ThumbnailService::new(metadata_dir))
}

#[tauri::command]
async fn download_and_save_thumbnail(
    app: AppHandle,
    mod_id: String,
    url: String,
    crop_data: Option<CropData>,
) -> Result<String, String> {
    log::info!("Downloading and saving thumbnail for mod: {} from URL: {}", mod_id, url);

    let service = get_thumbnail_service(&app)?;

    let thumbnail_path = service
        .download_and_save_thumbnail(&mod_id, &url, crop_data)
        .await
        .map_err(|e| format!("Failed to download and save thumbnail: {}", e))?;

    Ok(thumbnail_path
        .to_str()
        .ok_or("Invalid thumbnail path")?
        .to_string())
}

#[tauri::command]
async fn save_thumbnail_from_file(
    app: AppHandle,
    mod_id: String,
    file_path: String,
    crop_data: Option<CropData>,
) -> Result<String, String> {
    log::info!("Saving thumbnail for mod: {} from file: {}", mod_id, file_path);

    let service = get_thumbnail_service(&app)?;

    let thumbnail_path = service
        .save_thumbnail_from_file(&mod_id, PathBuf::from(file_path).as_path(), crop_data)
        .await
        .map_err(|e| format!("Failed to save thumbnail from file: {}", e))?;

    Ok(thumbnail_path
        .to_str()
        .ok_or("Invalid thumbnail path")?
        .to_string())
}

#[tauri::command]
async fn get_thumbnail_path(app: AppHandle, mod_id: String) -> Result<Option<String>, String> {
    log::debug!("Getting thumbnail path for mod: {}", mod_id);

    let service = get_thumbnail_service(&app)?;

    if service.thumbnail_exists(&mod_id) {
        let path = service.get_thumbnail_path(&mod_id);
        Ok(Some(
            path.to_str()
                .ok_or("Invalid thumbnail path")?
                .to_string()
        ))
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn delete_thumbnail(app: AppHandle, mod_id: String) -> Result<(), String> {
    log::info!("Deleting thumbnail for mod: {}", mod_id);

    let service = get_thumbnail_service(&app)?;

    service
        .delete_thumbnail(&mod_id)
        .map_err(|e| format!("Failed to delete thumbnail: {}", e))
}

#[tauri::command]
async fn get_temp_file_path(app: AppHandle, file_name: String) -> Result<String, String> {
    let temp_dir = app
        .path()
        .temp_dir()
        .map_err(|e| format!("Failed to get temp directory: {}", e))?;

    let temp_file = temp_dir.join(file_name);

    Ok(temp_file
        .to_str()
        .ok_or("Invalid temp file path")?
        .to_string())
}

#[tauri::command]
async fn save_thumbnail_from_base64(
    app: AppHandle,
    mod_id: String,
    base64_data: String,
) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose};

    log::info!("Saving thumbnail for mod: {} from base64 data ({} bytes)", mod_id, base64_data.len());

    // Decode base64 to bytes
    let image_bytes = general_purpose::STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    // Load image from bytes
    let img = image::load_from_memory(&image_bytes)
        .map_err(|e| format!("Failed to load image: {}", e))?;

    // Save thumbnail
    let service = get_thumbnail_service(&app)?;
    let thumbnail_path = service
        .save_thumbnail(&mod_id, &img)
        .await
        .map_err(|e| format!("Failed to save thumbnail: {}", e))?;

    Ok(thumbnail_path
        .to_str()
        .ok_or("Invalid thumbnail path")?
        .to_string())
}

// ===== SETTINGS COMMANDS =====

fn get_settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    Ok(app_data_dir.join("settings.json"))
}

fn load_app_settings(app: &AppHandle) -> Result<AppSettings, String> {
    let settings_path = get_settings_path(app)?;

    if !settings_path.exists() {
        // Auto-detect game directory on first run
        let mut settings = AppSettings::default();
        settings.game_directory = detect_game_directory();

        // Save the auto-detected settings
        if settings.game_directory.is_some() {
            let _ = save_app_settings_internal(app, &settings);
        }

        return Ok(settings);
    }

    let content = std::fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read settings: {}", e))?;

    let settings: AppSettings = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse settings: {}", e))?;

    Ok(settings)
}

fn detect_game_directory() -> Option<PathBuf> {
    // Default Steam installation path
    let default_path = PathBuf::from(r"C:\Program Files (x86)\Steam\steamapps\common\MarvelRivals");

    if default_path.exists() {
        log::info!("Auto-detected Marvel Rivals at: {:?}", default_path);
        return Some(default_path);
    }

    log::warn!("Could not auto-detect Marvel Rivals installation");
    None
}

fn save_app_settings_internal(app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    let settings_path = get_settings_path(app)?;

    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    std::fs::write(&settings_path, json)
        .map_err(|e| format!("Failed to write settings: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn get_app_settings(app: AppHandle) -> Result<AppSettings, String> {
    load_app_settings(&app)
}

#[tauri::command]
async fn save_app_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    log::info!("Saving app settings");
    save_app_settings_internal(&app, &settings)
}

#[tauri::command]
async fn show_in_folder(file_path: String) -> Result<(), String> {
    use std::process::Command;

    log::info!("Opening folder for file: {}", file_path);

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .args(["/select,", &file_path])
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-R", &file_path])
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        // Use xdg-open to open the parent directory
        use std::path::Path;
        let path = Path::new(&file_path);
        if let Some(parent) = path.parent() {
            Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|e| format!("Failed to open folder: {}", e))?;
        }
    }

    Ok(())
}

#[tauri::command]
async fn is_game_running() -> Result<bool, String> {
    use std::process::Command;

    log::info!("Checking if Marvel Rivals is running");

    #[cfg(target_os = "windows")]
    {
        // Use tasklist to check for MarvelRivals.exe process
        let output = Command::new("tasklist")
            .args(["/FI", "IMAGENAME eq MarvelGame-Win64-Shipping.exe"])
            .output()
            .map_err(|e| format!("Failed to check running processes: {}", e))?;

        let output_str = String::from_utf8_lossy(&output.stdout);
        let is_running = output_str.contains("MarvelGame-Win64-Shipping.exe");

        log::info!("Game running status: {}", is_running);
        Ok(is_running)
    }

    #[cfg(not(target_os = "windows"))]
    {
        // On non-Windows systems, we can't reliably check (game is Windows-only)
        log::warn!("Game detection not supported on this platform");
        Ok(false)
    }
}

// Create the native menu system
fn create_app_menu(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    log::info!("📋 Setting up native menu system");

    // Build the main application submenu
    let app_submenu = SubmenuBuilder::new(app, "Tauri Template")
        .item(&MenuItemBuilder::with_id("about", "About Tauri Template").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("check-updates", "Check for Updates...").build(app)?)
        .separator()
        .item(
            &MenuItemBuilder::with_id("preferences", "Preferences...")
                .accelerator("CmdOrCtrl+,")
                .build(app)?,
        )
        .separator()
        .item(&PredefinedMenuItem::hide(app, Some("Hide Tauri Template"))?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, Some("Quit Tauri Template"))?)
        .build()?;

    // Build the View submenu
    let view_submenu = SubmenuBuilder::new(app, "View")
        .item(
            &MenuItemBuilder::with_id("toggle-left-sidebar", "Toggle Left Sidebar")
                .accelerator("CmdOrCtrl+1")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("toggle-right-sidebar", "Toggle Right Sidebar")
                .accelerator("CmdOrCtrl+2")
                .build(app)?,
        )
        .build()?;

    // Build the main menu with submenus
    let menu = MenuBuilder::new(app)
        .item(&app_submenu)
        .item(&view_submenu)
        .build()?;

    // Set the menu for the app
    app.set_menu(menu)?;

    log::info!("   ✅ Menu system ready");
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                // Use Debug level in development, Info in production
                .level(if cfg!(debug_assertions) {
                    log::LevelFilter::Debug
                } else {
                    log::LevelFilter::Info
                })
                .format(|out, message, record| {
                    out.finish(format_args!(
                        "[{}] {}",
                        record.level(),
                        message
                    ))
                })
                .targets([
                    // Always log to stdout for development
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    // Log to webview console for development
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                    // Log to system logs on macOS (appears in Console.app)
                    #[cfg(target_os = "macos")]
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: None,
                    }),
                ])
                .build(),
        )
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            log::info!("");
            log::info!("==========================================================");
            log::info!("🚀 Marvel Rivals Mod Manager - Starting Up");
            log::info!("==========================================================");
            log::info!("");

            // Set up native menu system
            if let Err(e) = create_app_menu(app) {
                log::error!("Failed to create app menu: {e}");
                return Err(e);
            }

            // Initialize costume service
            log::info!("");
            if let Err(e) = initialize_costume_service() {
                log::error!("Failed to initialize costume service: {e}");
                // Don't fail app startup if costume data fails to load
                // The app can still function without costume data
            }

            log::info!("");
            log::info!("✅ Application initialized successfully");
            log::info!("==========================================================");
            log::info!("");

            // Set up menu event handlers
            app.on_menu_event(move |app, event| {
                log::debug!("Menu event received: {:?}", event.id());

                match event.id().as_ref() {
                    "about" => {
                        log::info!("About menu item clicked");
                        // Emit event to React for handling
                        match app.emit("menu-about", ()) {
                            Ok(_) => log::debug!("Successfully emitted menu-about event"),
                            Err(e) => log::error!("Failed to emit menu-about event: {e}"),
                        }
                    }
                    "check-updates" => {
                        log::info!("Check for Updates menu item clicked");
                        // Emit event to React for handling
                        match app.emit("menu-check-updates", ()) {
                            Ok(_) => log::debug!("Successfully emitted menu-check-updates event"),
                            Err(e) => log::error!("Failed to emit menu-check-updates event: {e}"),
                        }
                    }
                    "preferences" => {
                        log::info!("Preferences menu item clicked");
                        // Emit event to React for handling
                        match app.emit("menu-preferences", ()) {
                            Ok(_) => log::debug!("Successfully emitted menu-preferences event"),
                            Err(e) => log::error!("Failed to emit menu-preferences event: {e}"),
                        }
                    }
                    "toggle-left-sidebar" => {
                        log::info!("Toggle Left Sidebar menu item clicked");
                        // Emit event to React for handling
                        match app.emit("menu-toggle-left-sidebar", ()) {
                            Ok(_) => {
                                log::debug!("Successfully emitted menu-toggle-left-sidebar event")
                            }
                            Err(e) => {
                                log::error!("Failed to emit menu-toggle-left-sidebar event: {e}")
                            }
                        }
                    }
                    "toggle-right-sidebar" => {
                        log::info!("Toggle Right Sidebar menu item clicked");
                        // Emit event to React for handling
                        match app.emit("menu-toggle-right-sidebar", ()) {
                            Ok(_) => {
                                log::debug!("Successfully emitted menu-toggle-right-sidebar event")
                            }
                            Err(e) => {
                                log::error!("Failed to emit menu-toggle-right-sidebar event: {e}")
                            }
                        }
                    }
                    _ => {
                        log::debug!("Unhandled menu event: {:?}", event.id());
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            load_preferences,
            save_preferences,
            send_native_notification,
            save_emergency_data,
            load_emergency_data,
            cleanup_old_recovery_files,
            // Migration
            migrate_electron_data,
            // Mod management
            get_all_mods,
            install_mod,
            install_mod_to_folder,
            install_mod_to_folder_with_metadata,
            enable_mod,
            delete_mod,
            update_mod_metadata,
            remove_profile_from_all_mods,
            show_in_folder,
            is_game_running,
            // Costume service
            get_costumes_for_character,
            get_all_costumes,
            get_costume,
            // Thumbnails
            download_and_save_thumbnail,
            save_thumbnail_from_file,
            save_thumbnail_from_base64,
            get_thumbnail_path,
            delete_thumbnail,
            get_temp_file_path,
            // Settings
            get_app_settings,
            save_app_settings,
            // File watching
            start_file_watcher,
            stop_file_watcher,
            // Archive extraction
            extract_archive,
            detect_mods_in_archive,
            extract_and_detect_mods,
            // Folder organization
            organize_mods,
            merge_duplicate_folders,
            migrate_metadata_to_path_ids,
            log_total_mods_found,
            get_metadata_directory,
            copy_metadata_from_old_id
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
