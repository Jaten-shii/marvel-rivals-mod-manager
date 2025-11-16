# Costume Icons Directory

This directory contains costume/skin icons for all Marvel Rivals characters.

## Directory Structure

```
costume-icons/
├── adam-warlock/
│   ├── img_icon_*.png
├── gambit/
│   ├── img_icon_gambit.png (default)
│   ├── img_icon_crimson-heart.png
│   └── ...
├── spider-man/
│   ├── img_icon_*.png
└── ...
```

## Filename Convention

All costume icons follow this naming pattern from the Marvel Rivals wiki:
```
img_icon_{costume-name}.png
```

### Examples:
- `img_icon_gambit.png` → Default Gambit skin
- `img_icon_crimson-heart.png` → "Crimson Heart" costume
- `img_icon_spider-oni.png` → "Spider-Oni" costume
- `img_icon_avengers-endgame.png` → "Avengers: Endgame" costume

### Slug Rules:
- Convert to lowercase
- Replace spaces with hyphens
- Remove special characters (: ' &)
- Keep numbers and hyphens

**Examples:**
- "Gambit" → `gambit`
- "Crimson Heart" → `crimson-heart`
- "Avengers: Endgame" → `avengers-endgame`
- "Spider-Man 2099" → `spider-man-2099`
- "Cloak & Dagger" → `cloak-dagger`

## Adding Costume Icons

### For a New Character:
1. Create character directory: `{character-slug}/`
   - Use lowercase, replace spaces with hyphens
   - Examples: `gambit/`, `spider-man/`, `iron-man/`

2. Download costume icons from Marvel Rivals wiki
   - Visit: `https://marvelrivals.fandom.com/wiki/{Character}/Cosmetics`
   - Download images with original `img_icon_*.png` filenames

3. Place icons in character directory

4. Update `src-tauri/resources/costume-data.json`:
   ```json
   "Character Name": [
     {
       "id": "costume-slug",
       "name": "Display Name",
       "imagePath": "character-slug/img_icon_costume-slug.png",
       "isDefault": true  // Only for default costume
     }
   ]
   ```

### For Existing Character:
1. Download new costume icon from wiki
2. Place in character's directory
3. Add entry to `costume-data.json`

## Icon Specifications

- **Format**: PNG (as downloaded from wiki)
- **Size**: Variable (typically 256x256 or higher)
- **Background**: Transparent
- **Aspect Ratio**: Square (1:1)

## Character Slug Reference

| Character Name | Directory Slug |
|---------------|----------------|
| Adam Warlock | adam-warlock |
| Black Panther | black-panther |
| Black Widow | black-widow |
| Captain America | captain-america |
| Cloak and Dagger | cloak-and-dagger |
| Doctor Strange | doctor-strange |
| Emma Frost | emma-frost |
| Gambit | gambit |
| Human Torch | human-torch |
| Invisible Woman | invisible-woman |
| Iron Fist | iron-fist |
| Iron Man | iron-man |
| Jeff the Land Shark | jeff-the-land-shark |
| Luna Snow | luna-snow |
| Mister Fantastic | mister-fantastic |
| Moon Knight | moon-knight |
| Peni Parker | peni-parker |
| Rocket Raccoon | rocket-raccoon |
| Scarlet Witch | scarlet-witch |
| Spider-Man | spider-man |
| Squirrel Girl | squirrel-girl |
| Star-Lord | star-lord |
| The Punisher | the-punisher |
| The Thing | the-thing |
| Winter Soldier | winter-soldier |
| *(All others)* | lowercase-with-hyphens |

## Sources

- **Primary**: [Marvel Rivals Wiki](https://marvelrivals.fandom.com/wiki/Marvel_Rivals_Wiki)
  - Character cosmetics pages: `https://marvelrivals.fandom.com/wiki/{Character}/Cosmetics`
- **Secondary**: Game files, community resources

## Notes

- Always preserve the original `img_icon_*.png` filename from downloads
- The app will automatically load and display icons based on `costume-data.json`
- Icons are loaded at runtime - no rebuild required after adding new icons
- Missing icons will be handled gracefully (no errors, just no icon displayed)
