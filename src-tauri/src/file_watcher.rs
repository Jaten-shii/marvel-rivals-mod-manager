use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::mpsc::{channel, Receiver, Sender};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

const DEBOUNCE_DURATION: Duration = Duration::from_secs(2);

pub struct FileWatcher {
    watcher: RecommendedWatcher,
    debounce_timer: Option<Instant>,
}

impl FileWatcher {
    /// Create a new file watcher for the mods directory
    pub fn new(
        _watch_path: PathBuf,
        app_handle: AppHandle,
    ) -> Result<Self, String> {
        let (tx, rx): (Sender<Result<Event, notify::Error>>, Receiver<Result<Event, notify::Error>>) = channel();

        // Create watcher
        let watcher = RecommendedWatcher::new(
            move |res| {
                let _ = tx.send(res);
            },
            Config::default(),
        )
        .map_err(|e| format!("Failed to create watcher: {}", e))?;

        // Start monitoring thread
        std::thread::spawn(move || {
            Self::monitor_events(rx, app_handle);
        });

        Ok(Self {
            watcher,
            debounce_timer: None,
        })
    }

    /// Add a path to watch
    pub fn watch(&mut self, path: PathBuf) -> Result<(), String> {
        self.watcher
            .watch(&path, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch path: {}", e))
    }

    /// Stop watching a path
    pub fn unwatch(&mut self, path: PathBuf) -> Result<(), String> {
        self.watcher
            .unwatch(&path)
            .map_err(|e| format!("Failed to unwatch path: {}", e))
    }

    /// Monitor file system events and emit to frontend
    fn monitor_events(rx: Receiver<Result<Event, notify::Error>>, app_handle: AppHandle) {
        let mut last_emit = Instant::now();

        loop {
            match rx.recv() {
                Ok(Ok(event)) => {
                    // Check if the event is relevant (file created, deleted, modified)
                    let is_relevant = matches!(
                        event.kind,
                        notify::EventKind::Create(_)
                            | notify::EventKind::Remove(_)
                            | notify::EventKind::Modify(_)
                    );

                    if is_relevant {
                        // Debounce events to prevent excessive updates
                        let now = Instant::now();
                        if now.duration_since(last_emit) >= DEBOUNCE_DURATION {
                            // Emit event to frontend
                            if let Err(e) = app_handle.emit("mods-directory-changed", ()) {
                                eprintln!("Failed to emit event: {}", e);
                            }
                            last_emit = now;
                        }
                    }
                }
                Ok(Err(e)) => {
                    eprintln!("File watcher error: {}", e);
                }
                Err(e) => {
                    eprintln!("File watcher channel error: {}", e);
                    break;
                }
            }
        }
    }
}

/// Start watching the mods directory
#[tauri::command]
pub async fn start_file_watcher(
    app: AppHandle,
    mods_directory: String,
) -> Result<(), String> {
    let watch_path = PathBuf::from(mods_directory);

    if !watch_path.exists() {
        return Err("Mods directory does not exist".to_string());
    }

    let mut watcher = FileWatcher::new(watch_path.clone(), app.clone())?;
    watcher.watch(watch_path)?;

    // Store watcher in app state
    app.manage(watcher);

    Ok(())
}

/// Stop watching the mods directory
#[tauri::command]
pub async fn stop_file_watcher(app: AppHandle) -> Result<(), String> {
    // Watcher will be dropped when app state is cleared
    // For manual control, we would need to store the watcher handle
    Ok(())
}
