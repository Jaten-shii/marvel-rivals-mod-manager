# Costume Database Sync

The app keeps its costume database (skins + icons) up to date **without app releases** by syncing from the GitHub repo at runtime.

## How It Works

```
scripts/sync-game-assets.js  →  git push to main  →  every installed app syncs on startup
   (dev machine, scrapes                                (sync_costumes command fetches
    rivalskins.com)                                      raw.githubusercontent.com)
```

### Data layers

1. **Embedded** — `src-tauri/resources/costume-data.json` is compiled into the binary via `include_str!`. Icons for these costumes are bundled in the frontend (`public/assets/costume-icons/`, served at `/assets/costume-icons/...`).
2. **Synced overlay** — `sync_costumes` (Rust, `costume_service.rs`) fetches the latest `costume-data.json` from the repo's main branch. Costumes **not present in the embedded data** get their icons downloaded to `{appData}/costume-icons/{character}/{file}.png`, and the fetched JSON is saved to `{appData}/costume-data.json`. At startup the embedded data is loaded and the synced file is overlaid (new costumes appended, names refreshed).

### Icon resolution (frontend)

Synced costumes carry a `localIconPath` (absolute app-data path). `getCostumeIconSrc()` in `src/shared/rivals-tokens.ts` resolves it:

- `localIconPath` set → `convertFileSrc()` (asset protocol; `$APPDATA/**` is in the asset protocol scope in `tauri.conf.json`)
- otherwise → bundled `/assets/costume-icons/{imagePath}`

Always use `getCostumeIconSrc(costume)` to render a costume icon — never build the path manually.

### Triggers

- **Startup**: `useCostumeAutoSync()` (in `useMods.ts`, mounted in `MainWindow`) runs once ~2.5s after launch, silently. On new costumes it invalidates the `['costumes']` queries and shows a toast. Failures (offline) are swallowed — bundled data still works.
- **Manual**: Preferences → General → Updates → "Costume Database: Sync Now" (`useSyncCostumes()` mutation).

## Releasing New Costumes

```bash
node scripts/sync-game-assets.js --costumes   # downloads new icons + rewrites costume-data.json
git add/commit/push to main                   # that's it — no app release needed
```

## Limitations

- **New characters** still need an app update for full support: their costume data syncs fine, but character icons (`public/assets/character-icons/`), the `Character` enum (Rust + TS), and `characterDetection.ts` patterns are baked into the build.
- The sync URLs point at the `main` branch of `Jaten-shii/marvel-rivals-mod-manager` (constants at the top of `costume_service.rs`). The repo must stay public.
