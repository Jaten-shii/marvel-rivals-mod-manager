# Gambit Costume Icons

This folder contains Gambit's costume/skin icons.

## Current Costumes:
✅ `img_icon_gambit.png` - Default Gambit costume
✅ `img_icon_crimson-heart.png` - Crimson Heart
✅ `img_icon_sacrificial-pawn.png` - Sacrificial Pawn
✅ `img_icon_thieves-guildmaster.png` - Thieves Guildmaster

## Filename Pattern:
Downloaded icons follow this naming convention:
`img_icon_{costume-name}.png`

Where `{costume-name}` is the slugified version of the costume name:
- Spaces → hyphens
- Lowercase
- Special characters removed

## Icon Specifications:
- Format: PNG (as downloaded from wiki)
- Size: Variable (typically 256x256 or higher)
- Transparent background
- Square aspect ratio

## Adding New Costumes:
1. Download costume icon from Marvel Rivals wiki
2. Keep the original `img_icon_*.png` filename
3. Update `src-tauri/resources/costume-data.json`:
   ```json
   {
     "id": "costume-name",
     "name": "Display Name",
     "imagePath": "gambit/img_icon_costume-name.png"
   }
   ```

## Sources:
- Marvel Rivals Wiki: https://marvelrivals.fandom.com/wiki/Gambit/Cosmetics
- Game files
- Community resources
