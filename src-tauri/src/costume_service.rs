use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::types::Costume;

// Costume database structure - matches costume-data.json
type CostumeDatabase = HashMap<String, Vec<Costume>>;

// Global static costume data (loaded once at startup)
static COSTUME_DATA: Mutex<Option<CostumeDatabase>> = Mutex::new(None);

// Costume data shipped with this build (icons for these are bundled in the frontend)
const EMBEDDED_COSTUME_JSON: &str = include_str!("../resources/costume-data.json");

// Remote source: the app's GitHub repo (main branch). Pushing new costume data +
// icons to the repo makes them available to every installed app via sync_costumes.
const REMOTE_COSTUME_DATA_URL: &str = "https://raw.githubusercontent.com/Jaten-shii/marvel-rivals-mod-manager/main/src-tauri/resources/costume-data.json";
const REMOTE_COSTUME_ICON_BASE: &str = "https://raw.githubusercontent.com/Jaten-shii/marvel-rivals-mod-manager/main/public/assets/costume-icons";

/// Result summary returned by sync_costumes
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CostumeSyncResult {
    pub new_costumes: Vec<String>,
    pub icons_downloaded: usize,
    pub total_costumes: usize,
}

/// Initialize the costume service by loading embedded costume data,
/// overlaid with any previously synced data from the app data directory
pub fn initialize_costume_service(app: &AppHandle) -> Result<(), String> {
    let costume_data = build_database(app)?;
    store_database(costume_data);
    Ok(())
}

/// Parse the costume data embedded in the binary at compile time
fn embedded_database() -> Result<CostumeDatabase, String> {
    serde_json::from_str(EMBEDDED_COSTUME_JSON)
        .map_err(|e| format!("Failed to parse costume data: {e}"))
}

/// (character, costume id) pairs present in the embedded data — their icons ship with the app
fn embedded_keys() -> Result<HashSet<(String, String)>, String> {
    let embedded = embedded_database()?;
    Ok(embedded
        .iter()
        .flat_map(|(character, costumes)| {
            costumes
                .iter()
                .map(move |c| (character.clone(), c.id.clone()))
        })
        .collect())
}

/// Path of the synced costume-data.json in the app data directory
fn synced_data_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("costume-data.json"))
}

/// Directory holding synced costume icons in the app data directory
fn synced_icons_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("costume-icons"))
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data directory: {e}"))
}

/// Build the full database: embedded data overlaid with synced data (if any)
fn build_database(app: &AppHandle) -> Result<CostumeDatabase, String> {
    let mut database = embedded_database()?;

    let synced_path = synced_data_path(app)?;
    if synced_path.exists() {
        match fs::read_to_string(&synced_path) {
            Ok(json) => match serde_json::from_str::<CostumeDatabase>(&json) {
                Ok(synced) => {
                    let icons_dir = synced_icons_dir(app)?;
                    overlay_synced(&mut database, synced, &icons_dir);
                }
                Err(e) => log::warn!("[CostumeService] Ignoring corrupt synced costume data: {e}"),
            },
            Err(e) => log::warn!("[CostumeService] Failed to read synced costume data: {e}"),
        }
    }

    Ok(database)
}

/// Merge synced costume data into the embedded database. Costumes the build
/// doesn't know about get a local_icon_path pointing at their synced icon.
fn overlay_synced(database: &mut CostumeDatabase, synced: CostumeDatabase, icons_dir: &Path) {
    for (character, costumes) in synced {
        let entry = database.entry(character).or_default();
        for mut costume in costumes {
            if let Some(existing) = entry.iter_mut().find(|c| c.id == costume.id) {
                // Known costume: keep the bundled icon, but pick up name fixes
                existing.name = costume.name;
                existing.is_default = costume.is_default;
            } else {
                let icon_path = icons_dir.join(&costume.image_path);
                if icon_path.exists() {
                    costume.local_icon_path = Some(icon_path.to_string_lossy().to_string());
                }
                entry.push(costume);
            }
        }
    }
}

fn store_database(costume_data: CostumeDatabase) {
    let total_costumes: usize = costume_data.values().map(|v| v.len()).sum();
    let character_count = costume_data.len();

    *COSTUME_DATA.lock().unwrap() = Some(costume_data);

    log::info!("👗 Loaded {total_costumes} costumes for {character_count} characters");
}

/// Sync the costume database from the app's GitHub repo: fetch the latest
/// costume-data.json and download icons for any costumes this build doesn't
/// bundle, storing both in the app data directory.
#[tauri::command]
pub async fn sync_costumes(app: AppHandle) -> Result<CostumeSyncResult, String> {
    log::info!("[CostumeService] Syncing costume database from GitHub…");

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let response = client
        .get(REMOTE_COSTUME_DATA_URL)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch costume data: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Costume data request failed: HTTP {}",
            response.status()
        ));
    }

    let remote: CostumeDatabase = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse remote costume data: {e}"))?;

    // Snapshot what we knew before this sync, to report what's new
    let previous_keys: HashSet<(String, String)> = {
        let data = COSTUME_DATA.lock().unwrap();
        data.as_ref()
            .map(|db| {
                db.iter()
                    .flat_map(|(character, costumes)| {
                        costumes
                            .iter()
                            .map(move |c| (character.clone(), c.id.clone()))
                    })
                    .collect()
            })
            .unwrap_or_default()
    };

    let embedded = embedded_keys()?;
    let icons_dir = synced_icons_dir(&app)?;

    let mut new_costumes = Vec::new();
    let mut icons_downloaded = 0usize;

    for (character, costumes) in &remote {
        for costume in costumes {
            let key = (character.clone(), costume.id.clone());

            if !previous_keys.contains(&key) {
                new_costumes.push(format!("{character}: {}", costume.name));
            }

            // Icons for embedded costumes ship with the app — only fetch newer ones
            if embedded.contains(&key) {
                continue;
            }

            let dest = icons_dir.join(&costume.image_path);
            if dest.exists() {
                continue;
            }

            let url = format!("{REMOTE_COSTUME_ICON_BASE}/{}", costume.image_path);
            match download_file(&client, &url, &dest).await {
                Ok(()) => icons_downloaded += 1,
                Err(e) => log::warn!(
                    "[CostumeService] Failed to download icon for {character} – {}: {e}",
                    costume.name
                ),
            }
        }
    }

    // Persist the synced data, then rebuild the in-memory database from it
    let synced_path = synced_data_path(&app)?;
    if let Some(parent) = synced_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create app data directory: {e}"))?;
    }
    let json = serde_json::to_string_pretty(&remote)
        .map_err(|e| format!("Failed to serialize costume data: {e}"))?;
    fs::write(&synced_path, json).map_err(|e| format!("Failed to save costume data: {e}"))?;

    let database = build_database(&app)?;
    let total_costumes = database.values().map(|v| v.len()).sum();
    store_database(database);

    if new_costumes.is_empty() {
        log::info!("[CostumeService] Costume database is up to date");
    } else {
        log::info!(
            "[CostumeService] ✓ Synced {} new costume(s), downloaded {icons_downloaded} icon(s)",
            new_costumes.len()
        );
    }

    Ok(CostumeSyncResult {
        new_costumes,
        icons_downloaded,
        total_costumes,
    })
}

async fn download_file(client: &reqwest::Client, url: &str, dest: &Path) -> Result<(), String> {
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("failed to read response: {e}"))?;

    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("failed to create directory: {e}"))?;
    }
    fs::write(dest, &bytes).map_err(|e| format!("failed to write file: {e}"))?;

    Ok(())
}

/// Get all costumes for a specific character
#[tauri::command]
pub fn get_costumes_for_character(character: String) -> Result<Vec<Costume>, String> {
    log::info!(
        "[CostumeService] Getting costumes for character: '{}'",
        character
    );

    let data = COSTUME_DATA.lock().unwrap();

    match data.as_ref() {
        Some(costume_db) => {
            log::info!(
                "[CostumeService] Database has {} characters",
                costume_db.len()
            );
            log::info!(
                "[CostumeService] Available characters: {:?}",
                costume_db.keys().take(5).collect::<Vec<_>>()
            );

            // Look up costumes for this character
            if let Some(costumes) = costume_db.get(&character) {
                log::info!(
                    "[CostumeService] ✓ Found {} costumes for '{}'",
                    costumes.len(),
                    character
                );
                Ok(costumes.clone())
            } else {
                log::warn!(
                    "[CostumeService] ✗ No costumes found for '{}' (character not in database)",
                    character
                );
                Ok(Vec::new()) // Return empty vec if character not found
            }
        }
        None => {
            log::error!("[CostumeService] Costume data not initialized!");
            Err("Costume data not initialized".to_string())
        }
    }
}

/// Get all costumes for all characters (used for caching on frontend)
#[tauri::command]
pub fn get_all_costumes() -> Result<HashMap<String, Vec<Costume>>, String> {
    let data = COSTUME_DATA.lock().unwrap();

    match data.as_ref() {
        Some(costume_db) => Ok(costume_db.clone()),
        None => Err("Costume data not initialized".to_string()),
    }
}

/// Get a specific costume by character and costume ID
#[tauri::command]
pub fn get_costume(character: String, costume_id: String) -> Result<Option<Costume>, String> {
    log::debug!(
        "[CostumeService] Getting costume {} for character {}",
        costume_id,
        character
    );

    let data = COSTUME_DATA.lock().unwrap();

    match data.as_ref() {
        Some(costume_db) => {
            if let Some(costumes) = costume_db.get(&character) {
                let costume = costumes.iter().find(|c| c.id == costume_id).cloned();
                if costume.is_some() {
                    log::debug!(
                        "[CostumeService] Found costume {} for {}",
                        costume_id,
                        character
                    );
                } else {
                    log::debug!(
                        "[CostumeService] Costume {} not found for {}",
                        costume_id,
                        character
                    );
                }
                Ok(costume)
            } else {
                Ok(None)
            }
        }
        None => Err("Costume data not initialized".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Load embedded data only (tests have no AppHandle for the synced overlay)
    fn initialize_embedded() {
        store_database(embedded_database().unwrap());
    }

    #[test]
    fn test_costume_data_loads() {
        let costume_db = embedded_database().expect("Failed to load costume data");
        assert!(
            costume_db.len() > 0,
            "Should have at least one character with costumes"
        );
    }

    #[test]
    fn test_get_costumes_for_character() {
        initialize_embedded();

        // Test with Spider-Man (should have costumes in template)
        let result = get_costumes_for_character("Spider-Man".to_string());
        assert!(result.is_ok());

        let costumes = result.unwrap();
        assert!(
            costumes.len() > 0,
            "Spider-Man should have at least one costume"
        );
    }

    #[test]
    fn test_get_costume_by_id() {
        initialize_embedded();

        let result = get_costume("Spider-Man".to_string(), "classic".to_string());
        assert!(result.is_ok());

        let costume = result.unwrap();
        assert!(costume.is_some(), "Should find classic Spider-Man costume");
    }

    #[test]
    fn test_overlay_adds_new_costumes_with_local_icons() {
        let mut database: CostumeDatabase = HashMap::new();
        database.insert(
            "Spider-Man".to_string(),
            vec![Costume {
                id: "default".to_string(),
                name: "Default".to_string(),
                image_path: "spider-man/img_icon_spider-man.png".to_string(),
                is_default: Some(true),
                local_icon_path: None,
            }],
        );

        let mut synced: CostumeDatabase = HashMap::new();
        synced.insert(
            "Spider-Man".to_string(),
            vec![
                Costume {
                    id: "default".to_string(),
                    name: "Default".to_string(),
                    image_path: "spider-man/img_icon_spider-man.png".to_string(),
                    is_default: Some(true),
                    local_icon_path: None,
                },
                Costume {
                    id: "brand-new".to_string(),
                    name: "Brand New".to_string(),
                    image_path: "spider-man/img_icon_brand-new.png".to_string(),
                    is_default: None,
                    local_icon_path: None,
                },
            ],
        );

        overlay_synced(&mut database, synced, Path::new("/nonexistent"));

        let costumes = database.get("Spider-Man").unwrap();
        assert_eq!(costumes.len(), 2, "New costume should be added");
        let new_costume = costumes.iter().find(|c| c.id == "brand-new").unwrap();
        // Icon file doesn't exist, so no local path is set
        assert!(new_costume.local_icon_path.is_none());
        // Existing costume untouched
        assert!(costumes.iter().any(|c| c.id == "default"));
    }
}
