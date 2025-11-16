# {CHARACTER_NAME} Costume Icons

Place costume icons for {CHARACTER_NAME} in this folder.

## Filename Pattern
All costume icons should follow the Marvel Rivals wiki naming convention:
```
img_icon_{costume-slug}.png
```

## Steps to Add Costumes:

1. **Download from Wiki**
   - Visit: https://marvelrivals.fandom.com/wiki/{CHARACTER_NAME}/Cosmetics
   - Download costume icons (keep original `img_icon_*.png` filenames)

2. **Place Icons Here**
   - Copy downloaded PNG files to this folder
   - Keep the `img_icon_*.png` naming format

3. **Update Database**
   - Edit: `src-tauri/resources/costume-data.json`
   - Add entry for each costume:
   ```json
   "{CHARACTER_NAME}": [
     {
       "id": "costume-slug",
       "name": "Display Name",
       "imagePath": "{character-slug}/img_icon_costume-slug.png",
       "isDefault": true  // Only for default costume
     }
   ]
   ```

## Icon Specifications
- **Format**: PNG with transparency
- **Size**: 256x256 or higher (as downloaded)
- **Background**: Transparent
- **Aspect Ratio**: Square (1:1)

## Example Filenames
- `img_icon_{character-slug}.png` (default)
- `img_icon_costume-name.png`
- `img_icon_special-edition.png`

## Notes
- The default costume is usually named after the character
- Additional costumes use descriptive names
- Follow the slug rules: lowercase, hyphens for spaces, no special chars
