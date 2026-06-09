import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '../stores';
import { useDeleteMod, useToggleModEnabled, useToggleFavorite, useUpdateModMetadata } from '../hooks/useMods';
import type { ModInfo } from '../types/mod.types';
import { openPath } from '@tauri-apps/plugin-opener';
import { dirname } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Tag, ChevronRight, AlertTriangle, Pencil, Star, Power, FolderOpen, Trash2, Check } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { PROFILE_ICON_COMPONENTS } from '../shared/profiles';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { c, tint, categoryColor } from '../shared/rivals-tokens';
import { CategoryIcon as CatIconSvg } from '../shared/rivals-design';

interface ModContextMenuProps {
  mod: ModInfo;
  x: number;
  y: number;
  onClose: () => void;
}

const iconComponents = PROFILE_ICON_COMPONENTS(LucideIcons as unknown as Record<string, unknown>);

// A single editorial menu row.
function MenuItem({
  icon,
  label,
  onClick,
  hue = c.accent,
  trailing,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  hue?: string;
  trailing?: React.ReactNode;
  danger?: boolean;
}) {
  const accent = danger ? c.err : hue;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 transition-colors group"
      style={{ padding: '8px 12px', color: c.ink2, fontFamily: c.font, fontSize: 13 }}
      onMouseEnter={(e) => { e.currentTarget.style.background = tint(accent, 14); e.currentTarget.style.color = accent; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.ink2 as string; }}
    >
      <span className="flex-shrink-0 inline-flex transition-transform duration-200 group-hover:scale-110">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {trailing}
    </button>
  );
}

export function ModContextMenu({ mod, x, y, onClose }: ModContextMenuProps) {
  const setMetadataDialogOpen = useUIStore((state) => state.setMetadataDialogOpen);
  const profiles = useUIStore((state) => state.profiles);
  const deleteMod = useDeleteMod();
  const toggleEnabled = useToggleModEnabled();
  const toggleFavorite = useToggleFavorite();
  const updateMetadata = useUpdateModMetadata();
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState({ x, y });
  const [showProfileSubmenu, setShowProfileSubmenu] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const thumb = mod.thumbnailPath ? convertFileSrc(mod.thumbnailPath) : null;
  const catColor = categoryColor(mod.category);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      let newX = x;
      let newY = y;
      if (x + rect.width > window.innerWidth) newX = window.innerWidth - rect.width - 10;
      if (y + rect.height > window.innerHeight) newY = window.innerHeight - rect.height - 10;
      setAdjustedPosition({ x: newX, y: newY });
    }
  }, [x, y]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleEditMetadata = () => { setMetadataDialogOpen(true, mod.id); onClose(); };
  const handleShowInFolder = async () => {
    try { await openPath(await dirname(mod.filePath)); } catch (e) { console.error('Failed to show in folder:', e); }
    onClose();
  };
  const handleToggleEnabled = async () => { await toggleEnabled.mutateAsync(mod.id); onClose(); };
  const handleToggleFavorite = async () => { await toggleFavorite.mutateAsync(mod.id); onClose(); };
  const handleDelete = () => setShowDeleteDialog(true);
  const confirmDelete = async () => {
    try { await deleteMod.mutateAsync(mod.id); setShowDeleteDialog(false); onClose(); }
    catch { setShowDeleteDialog(false); }
  };

  const handleToggleProfile = async (profileId: string) => {
    const current = mod.metadata.profileIds || [];
    const updated = current.includes(profileId) ? current.filter((id) => id !== profileId) : [...current, profileId];
    await updateMetadata.mutateAsync({ modId: mod.id, metadata: { ...mod.metadata, profileIds: updated.length > 0 ? updated : null } });
    onClose();
  };

  return (
    <>
      <div
        ref={menuRef}
        className="fixed z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        style={{ left: adjustedPosition.x, top: adjustedPosition.y, minWidth: 232, background: c.panel, border: `1px solid ${c.line2}`, borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}
      >
        {/* Header: thumb + title + category */}
        <div className="flex items-center gap-2.5" style={{ padding: '12px 12px 10px', borderBottom: `1px solid ${c.line}` }}>
          <div style={{ width: 40, height: 40, borderRadius: 7, overflow: 'hidden', flex: '0 0 auto', background: c.bg, border: `1px solid ${c.line2}` }}>
            {thumb && <img src={thumb} alt="" className="w-full h-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="rivals-condensed truncate" style={{ color: c.ink, fontSize: 17, fontWeight: 700, lineHeight: 1.1, textTransform: 'uppercase' }}>
              {mod.metadata.title || mod.name}
            </div>
            <span className="inline-flex items-center gap-1 mt-1" style={{ padding: '1px 7px', borderRadius: 999, background: tint(catColor, 15), color: catColor, border: `1px solid ${tint(catColor, 35)}`, fontFamily: c.font, fontSize: 10.5, fontWeight: 500 }}>
              <CatIconSvg category={mod.category} stroke={catColor} size={9} />
              {mod.category}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="py-1">
          <MenuItem icon={<Pencil className="w-4 h-4" />} label="Edit Metadata" onClick={handleEditMetadata} />
          <MenuItem
            icon={<Star className="w-4 h-4" style={mod.isFavorite ? { fill: c.warn, color: c.warn } : undefined} />}
            label={mod.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
            onClick={handleToggleFavorite}
            hue={c.warn}
          />

          {/* Manage Profiles (submenu) */}
          <div className="relative" onMouseEnter={() => setShowProfileSubmenu(true)} onMouseLeave={() => setShowProfileSubmenu(false)}>
            <MenuItem icon={<Tag className="w-4 h-4" />} label="Manage Profiles" trailing={<ChevronRight className="w-4 h-4" style={{ color: c.ink3 }} />} />
            {showProfileSubmenu && (
              <div
                className="absolute left-full top-0 ml-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                style={{ minWidth: 210, background: c.panel, border: `1px solid ${c.line2}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.5)', padding: profiles.length ? '4px 0' : '10px 14px' }}
              >
                {profiles.length === 0 ? (
                  <div style={{ color: c.ink3, fontFamily: c.font, fontSize: 12 }}>No profiles available</div>
                ) : (
                  profiles.map((profile) => {
                    const Icon = iconComponents[profile.icon] || Tag;
                    const isAdded = mod.metadata.profileIds?.includes(profile.id);
                    return (
                      <button
                        key={profile.id}
                        onClick={() => handleToggleProfile(profile.id)}
                        className="w-full flex items-center gap-2 justify-between transition-colors"
                        style={{ padding: '7px 12px' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = tint(isAdded ? c.err : c.ok, 12))}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span className="inline-flex items-center gap-1.5" style={{ padding: '2px 8px', borderRadius: 999, background: `${profile.color}22`, color: profile.color, border: `1px solid ${profile.color}55`, fontFamily: c.font, fontSize: 11.5, fontWeight: 500 }}>
                          <Icon className="w-3 h-3" />
                          {profile.name}
                        </span>
                        <span className="inline-flex items-center gap-1" style={{ color: isAdded ? c.err : c.ok, fontFamily: c.mono, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          {isAdded ? '− Remove' : <><Check className="w-3 h-3" /> Add</>}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <MenuItem
            icon={<Power className="w-4 h-4" />}
            label={mod.enabled ? 'Disable Mod' : 'Enable Mod'}
            onClick={handleToggleEnabled}
            hue={mod.enabled ? c.err : c.ok}
          />
          <MenuItem icon={<FolderOpen className="w-4 h-4" />} label="Show in Folder" onClick={handleShowInFolder} />
        </div>

        <div style={{ height: 1, background: c.line }} />

        <div className="py-1">
          <MenuItem icon={<Trash2 className="w-4 h-4" />} label="Delete Mod" onClick={handleDelete} danger />
        </div>
      </div>

      {/* Delete confirm */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="sm:max-w-md" style={{ background: c.panel, border: `1px solid ${c.line2}` }}>
          <AlertDialogHeader>
            <div className="flex justify-center mb-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-full animate-ping" style={{ background: tint(c.err, 20) }} />
                <div className="relative p-4 rounded-full" style={{ background: tint(c.err, 12), border: `2px solid ${tint(c.err, 50)}` }}>
                  <AlertTriangle className="w-10 h-10" style={{ color: c.err }} />
                </div>
              </div>
            </div>
            <AlertDialogTitle className="text-center rivals-display" style={{ color: c.ink, fontSize: 20, fontWeight: 600 }}>
              Delete Mod
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center pt-1" style={{ color: c.ink2, fontFamily: c.font, fontSize: 13.5 }}>
              Delete <span style={{ color: c.ink, fontWeight: 600 }}>&ldquo;{mod.metadata.title || mod.name}&rdquo;</span>?
              <br />
              <span style={{ color: c.err, fontWeight: 500 }}>This cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 sm:gap-3">
            <AlertDialogCancel
              className="flex-1 m-0"
              style={{ height: 38, background: 'transparent', color: c.ink2, border: `1px solid ${c.line2}`, fontFamily: c.font, fontSize: 13, fontWeight: 600, borderRadius: 8 }}
            >
              Cancel
            </AlertDialogCancel>
            <button
              type="button"
              onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); confirmDelete(); }}
              disabled={deleteMod.isPending}
              className="flex-1 inline-flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none"
              style={{ height: 38, borderRadius: 8, background: c.err, color: '#fff', border: 'none', fontFamily: c.font, fontSize: 13, fontWeight: 600 }}
            >
              {deleteMod.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
