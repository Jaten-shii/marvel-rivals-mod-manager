use std::collections::HashMap;
use std::sync::Mutex;

use crate::types::Costume;

// Costume database structure - matches costume-data.json
type CostumeDatabase = HashMap<String, Vec<Costume>>;

// Global static costume data (loaded once at startup)
static COSTUME_DATA: Mutex<Option<CostumeDatabase>> = Mutex::new(None);

/// Initialize the costume service by loading costume data from the JSON file
pub fn initialize_costume_service() -> Result<(), String> {
    // Load costume data from embedded resource
    let costume_json = include_str!("../resources/costume-data.json");

    // Parse JSON
    let costume_data: CostumeDatabase = serde_json::from_str(costume_json)
        .map_err(|e| format!("Failed to parse costume data: {}", e))?;

    // Count total costumes and characters before moving the data
    let total_costumes: usize = costume_data.values().map(|v| v.len()).sum();
    let character_count = costume_data.len();

    // Store in global state
    *COSTUME_DATA.lock().unwrap() = Some(costume_data);

    log::info!("👗 Loaded {} costumes for {} characters", total_costumes, character_count);

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

    #[test]
    fn test_costume_data_loads() {
        let result = initialize_costume_service();
        assert!(result.is_ok(), "Failed to load costume data");

        let data = COSTUME_DATA.lock().unwrap();
        assert!(data.is_some(), "Costume data should be initialized");

        let costume_db = data.as_ref().unwrap();
        assert!(
            costume_db.len() > 0,
            "Should have at least one character with costumes"
        );
    }

    #[test]
    fn test_get_costumes_for_character() {
        initialize_costume_service().unwrap();

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
        initialize_costume_service().unwrap();

        let result = get_costume("Spider-Man".to_string(), "classic".to_string());
        assert!(result.is_ok());

        let costume = result.unwrap();
        assert!(costume.is_some(), "Should find classic Spider-Man costume");
    }
}
