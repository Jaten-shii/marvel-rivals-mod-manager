import { useState } from 'react'
import { Settings, Palette, ExternalLink, BarChart3, type LucideIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useUIStore } from '@/store/ui-store'
import { c, tint } from '@/shared/rivals-tokens'
import { GeneralPane } from './panes/GeneralPane'
import { AppearancePane } from './panes/AppearancePane'
import { AdvancedPane } from './panes/AdvancedPane'
import { StatsPane } from './panes/StatsPane'

type PreferencePane = 'general' | 'appearance' | 'advanced' | 'stats'

const navigationItems: { id: PreferencePane; name: string; desc: string; icon: LucideIcon }[] = [
  { id: 'general', name: 'General', desc: 'Directories, mods, updates, intros', icon: Settings },
  { id: 'appearance', name: 'Appearance', desc: 'Theme, accent, fonts, background', icon: Palette },
  { id: 'advanced', name: 'Nexus Mods', desc: 'API key & download integration', icon: ExternalLink },
  { id: 'stats', name: 'Stats', desc: 'Your library by the numbers', icon: BarChart3 },
]

export function PreferencesDialog() {
  const [activePane, setActivePane] = useState<PreferencePane>('general')
  const { preferencesOpen, setPreferencesOpen } = useUIStore()

  const active = navigationItems.find((i) => i.id === activePane) ?? { id: activePane, name: 'Settings', desc: '', icon: Settings }

  return (
    <Dialog open={preferencesOpen} onOpenChange={setPreferencesOpen}>
      <DialogContent
        className="overflow-hidden p-0 md:max-h-[760px] md:max-w-[1080px] lg:max-w-[1160px]"
        style={{ background: c.bg, border: `1px solid ${c.line2}`, borderRadius: 16 }}
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">Customize your application settings.</DialogDescription>

        <div className="flex items-start" style={{ height: 760 }}>
          {/* Nav rail */}
          <nav
            className="hidden md:flex flex-col flex-shrink-0 h-full"
            style={{ width: 248, background: c.panel, borderRight: `1px solid ${c.line}` }}
          >
            <div className="px-[18px] pt-[18px] pb-3.5" style={{ borderBottom: `1px solid ${c.line}` }}>
              <div className="rivals-display" style={{ color: c.ink, fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>
                Settings
              </div>
              <div className="rivals-mono" style={{ color: c.ink3, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>
                Marvel Rivals Mod Manager
              </div>
            </div>
            <div className="flex flex-col gap-1 p-3">
              {navigationItems.map((item) => {
                const isActive = activePane === item.id
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => setActivePane(item.id)}
                    className="settings-nav-item w-full flex items-start gap-3 rounded-lg text-left"
                    style={{
                      padding: '10px 12px',
                      background: isActive ? c.panelHi : 'transparent',
                      boxShadow: isActive ? `inset 2px 0 0 ${c.accent}` : 'none',
                    }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = tint(c.accent, 8) }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                  >
                    <Icon className="settings-nav-glyph w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: isActive ? c.accent : c.ink3 }} />
                    <div className="min-w-0">
                      <div style={{ color: isActive ? c.ink : c.ink2, fontFamily: c.font, fontSize: 13.5, fontWeight: 600 }}>{item.name}</div>
                      <div style={{ color: c.ink3, fontFamily: c.font, fontSize: 11.5 }} className="truncate">{item.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </nav>

          {/* Content */}
          <main className="flex flex-1 flex-col overflow-hidden h-full">
            <header className="flex items-center flex-shrink-0" style={{ height: 60, padding: '0 28px', borderBottom: `1px solid ${c.line}`, background: c.panel }}>
              <div className="flex items-baseline gap-2.5">
                <h2 className="rivals-display" style={{ color: c.ink, fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em' }}>
                  {active.name}
                </h2>
                <span className="rivals-mono" style={{ color: c.ink3, fontSize: 11.5 }}>{active.desc}</span>
              </div>
            </header>

            <ScrollArea type="always" className="sidebar-scroll" style={{ height: 700 }}>
              <div className="flex flex-col gap-8 p-7">
                {activePane === 'general' && <GeneralPane />}
                {activePane === 'appearance' && <AppearancePane />}
                {activePane === 'advanced' && <AdvancedPane />}
                {activePane === 'stats' && <StatsPane />}
              </div>
            </ScrollArea>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default PreferencesDialog
