import { useState } from 'react'
import { Settings, Palette, ExternalLink } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useUIStore } from '@/store/ui-store'
import { GeneralPane } from './panes/GeneralPane'
import { AppearancePane } from './panes/AppearancePane'
import { AdvancedPane } from './panes/AdvancedPane'

type PreferencePane = 'general' | 'appearance' | 'advanced'

const navigationItems = [
  {
    id: 'general' as const,
    name: 'General',
    icon: Settings,
  },
  {
    id: 'appearance' as const,
    name: 'Appearance',
    icon: Palette,
  },
  {
    id: 'advanced' as const,
    name: 'Nexus Mods',
    icon: ExternalLink,
  },
]

const getPaneTitle = (pane: PreferencePane): string => {
  switch (pane) {
    case 'general':
      return 'General'
    case 'appearance':
      return 'Appearance'
    case 'advanced':
      return 'Nexus Mods'
    default:
      return 'General'
  }
}

export function PreferencesDialog() {
  const [activePane, setActivePane] = useState<PreferencePane>('general')
  const { preferencesOpen, setPreferencesOpen } = useUIStore()

  return (
    <Dialog open={preferencesOpen} onOpenChange={setPreferencesOpen}>
      <DialogContent className="overflow-hidden p-0 md:max-h-[750px] md:max-w-[1100px] lg:max-w-[1200px] font-sans rounded-xl">
        <DialogTitle className="sr-only">Preferences</DialogTitle>
        <DialogDescription className="sr-only">
          Customize your application preferences here.
        </DialogDescription>

        <SidebarProvider className="items-start">
          <Sidebar collapsible="none" className="hidden md:flex">
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {navigationItems.map(item => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={activePane === item.id}
                        >
                          <button
                            onClick={() => setActivePane(item.id)}
                            className="w-full"
                          >
                            <item.icon />
                            <span>{item.name}</span>
                          </button>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          <main className="flex flex-1 flex-col overflow-hidden">
            <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/40">
              <div className="flex items-center gap-2 px-5">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href="#">Preferences</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>
                        {getPaneTitle(activePane)}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>

            <ScrollArea className="h-[calc(750px-3.5rem)]">
              <div className="flex flex-col gap-4 p-5 pt-5 pr-5">
                {activePane === 'general' && <GeneralPane />}
                {activePane === 'appearance' && <AppearancePane />}
                {activePane === 'advanced' && <AdvancedPane />}
              </div>
            </ScrollArea>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}

export default PreferencesDialog
