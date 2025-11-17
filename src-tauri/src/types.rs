use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// ===== Mod Category =====
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ModCategory {
    UI,
    Audio,
    Skins,
    Gameplay,
}

impl ModCategory {
    pub fn keywords(&self) -> &[&str] {
        match self {
            ModCategory::UI => &["ui", "hud", "menu", "interface"],
            ModCategory::Audio => &["audio", "sound", "music", "voice"],
            ModCategory::Skins => &["skin", "costume", "outfit", "appearance"],
            ModCategory::Gameplay => &["gameplay", "mechanic", "ability", "stat"],
        }
    }
}

impl std::fmt::Display for ModCategory {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ModCategory::UI => write!(f, "UI"),
            ModCategory::Audio => write!(f, "Audio"),
            ModCategory::Skins => write!(f, "Skins"),
            ModCategory::Gameplay => write!(f, "Gameplay"),
        }
    }
}

// ===== Marvel Rivals Characters =====
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum Character {
    // Vanguards
    #[serde(rename = "Captain America")]
    CaptainAmerica,
    #[serde(rename = "Doctor Strange")]
    DoctorStrange,
    Groot,
    Hulk,
    Magneto,
    #[serde(rename = "Peni Parker")]
    PeniParker,
    #[serde(rename = "The Thing")]
    TheThing,
    Thor,
    Venom,

    // Duelists
    Angela,
    Blade,
    #[serde(rename = "Black Panther")]
    BlackPanther,
    #[serde(rename = "Black Widow")]
    BlackWidow,
    Daredevil,
    #[serde(rename = "Emma Frost")]
    EmmaFrost,
    Gambit,
    Hawkeye,
    Hela,
    #[serde(rename = "Human Torch")]
    HumanTorch,
    #[serde(rename = "Iron Fist")]
    IronFist,
    Magik,
    #[serde(rename = "Mister Fantastic")]
    MisterFantastic,
    #[serde(rename = "Moon Knight")]
    MoonKnight,
    Namor,
    Phoenix,
    Psylocke,
    #[serde(rename = "Scarlet Witch")]
    ScarletWitch,
    #[serde(rename = "Spider-Man")]
    SpiderMan,
    #[serde(rename = "Squirrel Girl")]
    SquirrelGirl,
    #[serde(rename = "Star-Lord")]
    StarLord,
    Storm,
    #[serde(rename = "The Punisher")]
    ThePunisher,
    Ultron,
    #[serde(rename = "Winter Soldier")]
    WinterSoldier,
    Wolverine,

    // Strategists
    #[serde(rename = "Adam Warlock")]
    AdamWarlock,
    #[serde(rename = "Cloak and Dagger")]
    CloakAndDagger,
    #[serde(rename = "Invisible Woman")]
    InvisibleWoman,
    #[serde(rename = "Iron Man")]
    IronMan,
    #[serde(rename = "Jeff the Land Shark")]
    JeffTheLandShark,
    Loki,
    #[serde(rename = "Luna Snow")]
    LunaSnow,
    Mantis,
    #[serde(rename = "Rocket Raccoon")]
    RocketRaccoon,
}

impl Character {
    /// Get all character variants
    pub fn all_characters() -> Vec<Character> {
        vec![
            Character::CaptainAmerica,
            Character::DoctorStrange,
            Character::Groot,
            Character::Hulk,
            Character::Magneto,
            Character::PeniParker,
            Character::TheThing,
            Character::Thor,
            Character::Venom,
            Character::Angela,
            Character::Blade,
            Character::BlackPanther,
            Character::BlackWidow,
            Character::Daredevil,
            Character::EmmaFrost,
            Character::Gambit,
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
            Character::AdamWarlock,
            Character::CloakAndDagger,
            Character::InvisibleWoman,
            Character::IronMan,
            Character::JeffTheLandShark,
            Character::Loki,
            Character::LunaSnow,
            Character::Mantis,
            Character::RocketRaccoon,
        ]
    }

    pub fn keywords(&self) -> &[&str] {
        match self {
            Character::CaptainAmerica => &["captainamerica", "captain", "rogers", "steve"],
            Character::DoctorStrange => &["doctorstrange", "strange", "stephen"],
            Character::Groot => &["groot"],
            Character::Hulk => &["hulk", "banner", "bruce"],
            Character::Magneto => &["magneto", "erik", "max"],
            Character::PeniParker => &["peni", "parker", "peniparker"],
            Character::TheThing => &["thing", "ben", "grimm"],
            Character::Thor => &["thor", "odinson"],
            Character::Venom => &["venom", "symbiote", "eddie"],
            Character::Angela => &["angela"],
            Character::Blade => &["blade", "eric", "brooks"],
            Character::BlackPanther => &["blackpanther", "panther", "tchalla"],
            Character::BlackWidow => &["blackwidow", "widow", "natasha", "romanoff"],
            Character::Daredevil => &["daredevil", "matt", "murdock"],
            Character::EmmaFrost => &["emma", "frost", "emmafrost", "white", "queen"],
            Character::Gambit => &["gambit", "remy", "lebeau"],
            Character::Hawkeye => &["hawkeye", "clint", "barton"],
            Character::Hela => &["hela"],
            Character::HumanTorch => &["human", "torch", "humantorch", "johnny", "storm"],
            Character::IronFist => &["ironfist", "danny", "rand"],
            Character::Magik => &["magik", "illyana"],
            Character::MisterFantastic => &["mister", "fantastic", "misterfantastic", "reed", "richards"],
            Character::MoonKnight => &["moonknight", "marc", "spector"],
            Character::Namor => &["namor", "submariner"],
            Character::Phoenix => &["phoenix", "jean", "grey"],
            Character::Psylocke => &["psylocke", "betsy"],
            Character::ScarletWitch => &["scarletwitch", "wanda", "maximoff"],
            Character::SpiderMan => &["spiderman", "spider", "peter", "parker"],
            Character::SquirrelGirl => &["squirrelgirl", "doreen"],
            Character::StarLord => &["starlord", "star", "lord", "quill", "peter"],
            Character::Storm => &["storm", "ororo"],
            Character::ThePunisher => &["punisher", "frank", "castle"],
            Character::Ultron => &["ultron"],
            Character::WinterSoldier => &["wintersoldier", "winter", "bucky", "barnes"],
            Character::Wolverine => &["wolverine", "logan", "james", "howlett"],
            Character::AdamWarlock => &["adamwarlock", "adam", "warlock"],
            Character::CloakAndDagger => &["cloak", "dagger", "cloakanddagger", "tyrone", "tandy"],
            Character::InvisibleWoman => &["invisiblewoman", "invisible", "sue", "storm"],
            Character::IronMan => &["ironman", "tony", "stark"],
            Character::JeffTheLandShark => &["jeff", "landshark", "shark"],
            Character::Loki => &["loki", "laufeyson"],
            Character::LunaSnow => &["lunasnow", "luna", "snow"],
            Character::Mantis => &["mantis"],
            Character::RocketRaccoon => &["rocketraccoon", "rocket", "raccoon"],
        }
    }
}

impl std::fmt::Display for Character {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            Character::CaptainAmerica => "Captain America",
            Character::DoctorStrange => "Doctor Strange",
            Character::Groot => "Groot",
            Character::Hulk => "Hulk",
            Character::Magneto => "Magneto",
            Character::PeniParker => "Peni Parker",
            Character::TheThing => "The Thing",
            Character::Thor => "Thor",
            Character::Venom => "Venom",
            Character::Angela => "Angela",
            Character::Blade => "Blade",
            Character::BlackPanther => "Black Panther",
            Character::BlackWidow => "Black Widow",
            Character::Daredevil => "Daredevil",
            Character::EmmaFrost => "Emma Frost",
            Character::Gambit => "Gambit",
            Character::Hawkeye => "Hawkeye",
            Character::Hela => "Hela",
            Character::HumanTorch => "Human Torch",
            Character::IronFist => "Iron Fist",
            Character::Magik => "Magik",
            Character::MisterFantastic => "Mister Fantastic",
            Character::MoonKnight => "Moon Knight",
            Character::Namor => "Namor",
            Character::Phoenix => "Phoenix",
            Character::Psylocke => "Psylocke",
            Character::ScarletWitch => "Scarlet Witch",
            Character::SpiderMan => "Spider-Man",
            Character::SquirrelGirl => "Squirrel Girl",
            Character::StarLord => "Star-Lord",
            Character::Storm => "Storm",
            Character::ThePunisher => "The Punisher",
            Character::Ultron => "Ultron",
            Character::WinterSoldier => "Winter Soldier",
            Character::Wolverine => "Wolverine",
            Character::AdamWarlock => "Adam Warlock",
            Character::CloakAndDagger => "Cloak and Dagger",
            Character::InvisibleWoman => "Invisible Woman",
            Character::IronMan => "Iron Man",
            Character::JeffTheLandShark => "Jeff the Land Shark",
            Character::Loki => "Loki",
            Character::LunaSnow => "Luna Snow",
            Character::Mantis => "Mantis",
            Character::RocketRaccoon => "Rocket Raccoon",
        };
        write!(f, "{}", name)
    }
}

// ===== Costume/Skin Types =====
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Costume {
    pub id: String,
    pub name: String,
    pub image_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_default: Option<bool>,
}

// ===== Mod Metadata =====
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModMetadata {
    pub title: String,
    pub description: String,
    pub author: Option<String>,
    pub version: Option<String>,
    pub tags: Vec<String>,
    pub category: ModCategory,
    pub character: Option<Character>,
    pub costume: Option<String>, // Costume ID (e.g., "symbiote", "2099")
    pub is_favorite: bool,
    pub is_nsfw: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub install_date: DateTime<Utc>,
    pub profile_ids: Option<Vec<String>>,

    // NexusMods integration
    pub nexus_mod_id: Option<i32>,
    pub nexus_file_id: Option<i32>,
    pub nexus_version: Option<String>,
}

// ===== Mod Info =====
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModInfo {
    pub id: String,
    pub name: String,
    pub category: ModCategory,
    pub character: Option<Character>,
    pub enabled: bool,
    pub is_favorite: bool,
    pub file_path: PathBuf,
    pub thumbnail_path: Option<PathBuf>,
    pub metadata: ModMetadata,
    pub file_size: u64,
    pub install_date: DateTime<Utc>,
    pub last_modified: DateTime<Utc>,
    pub original_file_name: String,
    pub associated_files: Vec<PathBuf>,
}

// ===== App Settings =====
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub game_directory: Option<PathBuf>,
    pub mod_directory: Option<PathBuf>,
    pub theme: String,
    #[serde(default = "default_font")]
    pub font: String,
    pub auto_organize: bool,
    pub auto_detect_game_dir: bool,
    #[serde(default = "default_auto_check_updates")]
    pub auto_check_updates: bool,
}

fn default_font() -> String {
    "quicksand".to_string()
}

fn default_auto_check_updates() -> bool {
    true
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            game_directory: None,
            mod_directory: None,
            theme: "dark".to_string(),
            font: "quicksand".to_string(),
            auto_organize: true,
            auto_detect_game_dir: true,
            auto_check_updates: true,
        }
    }
}

// ===== Progress Types =====
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModInstallProgress {
    pub current_file: String,
    pub current: usize,
    pub total: usize,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModOrganizationProgress {
    pub current_file: String,
    pub current: usize,
    pub total: usize,
    pub status: String,
    pub moved_count: usize,
    pub error_count: usize,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationResult {
    pub total_mods: usize,
    pub moved_mods: usize,
    pub error_count: usize,
    pub errors: Vec<String>,
    pub duration: u64,
}

// ===== Statistics Types =====
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStats {
    pub total_mods: usize,
    pub enabled_mods: usize,
    pub disabled_mods: usize,
    pub total_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryStats {
    pub category: ModCategory,
    pub count: usize,
    pub enabled: usize,
    pub disabled: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CharacterStats {
    pub character: Character,
    pub count: usize,
    pub enabled: usize,
    pub disabled: usize,
}
