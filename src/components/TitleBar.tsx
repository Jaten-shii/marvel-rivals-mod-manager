import { Window } from '@tauri-apps/api/window';
import { APP_VERSION } from '../shared/constants';
import { c, tint } from '../shared/rivals-tokens';

export function TitleBar() {
  const appWindow = Window.getCurrent();

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between select-none"
      style={{
        height: 32,
        background: c.titlebar,
        borderBottom: `1px solid ${c.line}`,
        paddingLeft: 10,
      }}
    >
      {/* Left: Title */}
      <div className="flex items-center gap-2 pointer-events-none" style={{ paddingLeft: 2 }}>
        <span style={{ color: c.ink2, fontFamily: c.font, fontSize: 11.5 }}>
          Marvel Rivals Mod Manager
          <span style={{ color: c.muted }}> · </span>
          <span style={{ color: c.ink3 }}>Library</span>
          <span style={{ color: c.muted, fontFamily: c.mono, fontSize: 10 }}> · v{APP_VERSION}</span>
        </span>
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center">
        <button
          onClick={handleMinimize}
          title="Minimize"
          className="flex items-center justify-center transition-colors duration-100"
          style={{ height: 32, width: 44, color: c.ink3 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = tint(c.ink, 8); e.currentTarget.style.color = c.ink as string; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.ink3 as string; }}
        >
          <svg className="w-2.5 h-2.5" viewBox="0 0 12 12">
            <rect y="5" width="12" height="2" fill="currentColor" />
          </svg>
        </button>

        <button
          onClick={handleMaximize}
          title="Maximize"
          className="flex items-center justify-center transition-colors duration-100"
          style={{ height: 32, width: 44, color: c.ink3 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = tint(c.ink, 8); e.currentTarget.style.color = c.ink as string; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.ink3 as string; }}
        >
          <svg className="w-2.5 h-2.5" viewBox="0 0 12 12">
            <rect width="10" height="10" x="1" y="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>

        <button
          onClick={handleClose}
          title="Close"
          className="flex items-center justify-center transition-colors duration-100"
          style={{ height: 32, width: 44, color: c.ink3 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#c0392b'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.ink3 as string; }}
        >
          <svg className="w-2.5 h-2.5" viewBox="0 0 12 12">
            <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
