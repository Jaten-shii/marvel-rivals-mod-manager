import { Window } from '@tauri-apps/api/window';
import { APP_VERSION } from '../shared/constants';

export function TitleBar() {
  const appWindow = Window.getCurrent();

  const handleMinimize = () => {
    appWindow.minimize();
  };

  const handleMaximize = () => {
    appWindow.toggleMaximize();
  };

  const handleClose = () => {
    appWindow.close();
  };

  return (
    <div
      data-tauri-drag-region
      className="h-8 bg-background border-b border-border flex items-center justify-between px-2 select-none"
    >
      {/* Left: App Icon & Title */}
      <div className="flex items-center gap-2 pl-2">
        <img
          src="/icon.png"
          alt="Marvel Rivals Mod Manager"
          className="w-5 h-5 rounded"
        />
        <span className="text-xs font-semibold text-foreground">
          Marvel Rivals Mod Manager <span className="text-foreground/70 font-normal">v{APP_VERSION}</span>
        </span>
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center gap-1 pr-1">
        <button
          onClick={handleMinimize}
          className="h-6 w-9 flex items-center justify-center transition-colors duration-100 hover:bg-white/5 rounded"
          title="Minimize"
        >
          <svg className="w-2.5 h-2.5 text-foreground/70 hover:text-foreground" viewBox="0 0 12 12">
            <rect y="5" width="12" height="2" fill="currentColor" />
          </svg>
        </button>

        <button
          onClick={handleMaximize}
          className="h-6 w-9 flex items-center justify-center transition-colors duration-100 hover:bg-white/5 rounded"
          title="Maximize"
        >
          <svg className="w-2.5 h-2.5 text-foreground/70 hover:text-foreground" viewBox="0 0 12 12">
            <rect width="10" height="10" x="1" y="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>

        <button
          onClick={handleClose}
          className="h-6 w-9 flex items-center justify-center transition-colors duration-100 hover:bg-red-500/90 rounded group"
          title="Close"
        >
          <svg className="w-2.5 h-2.5 text-foreground/70 group-hover:text-white" viewBox="0 0 12 12">
            <path
              d="M1 1L11 11M11 1L1 11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
