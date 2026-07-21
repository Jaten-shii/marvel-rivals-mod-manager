import { useState, useMemo, type CSSProperties } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './ui/dialog'
import { Checkbox } from './ui/checkbox'
import { ScrollArea } from './ui/scroll-area'
import { Package, Search } from 'lucide-react'
import { c, tint, formatFileSize } from '../shared/rivals-tokens'
import type { ModCategory } from '../types/mod.types'

export interface DetectedMod {
  pakFile: string
  associatedFiles: string[]
  size: number
}

interface ModSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  detectedMods: DetectedMod[]
  onConfirm: (selectedMods: DetectedMod[]) => void
  onConfirmGroup: (selectedMods: DetectedMod[], groupName: string, category: ModCategory) => void
}

const GROUP_CATEGORIES: ModCategory[] = ['Skins', 'Audio', 'UI', 'Gameplay']

// Default group name from the shared filename prefix (e.g. 205 files named
// "MVP_Music_XY_P.pak" suggest "MVP Music"), cleaned of separators/suffixes.
function suggestGroupName(names: string[], prefixLen: number): string {
  const prefix = (names[0] ?? '').slice(0, prefixLen)
  const cleaned = prefix
    .replace(/\.pak$/i, '')
    .replace(/[-_. ]+$/g, '')
    .replace(/[_.]+/g, ' ')
    .trim()
  return cleaned.length >= 3 ? cleaned : 'Mod Pack'
}

// Extract filename from full path
function getFileName(path: string | undefined): string {
  if (!path) return 'Unknown'
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}

// Temp/extraction directories that carry no meaning for the user
const NOISE_DIR_RE = /^(marvel_rivals_extract|mrmm|rar\$|7z|te?mp)/i

// Folder path inside the archive (without filename), with temp noise stripped
function getFolderPath(path: string | undefined): string | null {
  if (!path) return null
  const parts = path.split(/[\\/]/)
  parts.pop() // drop the filename
  const meaningful = parts.filter(p => p && !NOISE_DIR_RE.test(p)).slice(-2)
  return meaningful.length > 0 ? meaningful.join(' / ') : null
}

// Unique extensions of a mod's associated files (e.g. ['.ucas', '.utoc'])
function associatedExtensions(files: string[]): string[] {
  const exts = files.map(f => {
    const name = getFileName(f)
    const dot = name.lastIndexOf('.')
    return dot > 0 ? name.slice(dot).toLowerCase() : null
  })
  return [...new Set(exts.filter((e): e is string => !!e))]
}

// Shared prefix/suffix lengths across all names, so the part that actually
// differs (e.g. the "14" in ..._Alt14_...) can be highlighted while the
// repeated boilerplate is dimmed. Only kicks in for 3+ similarly named mods.
function commonAffixes(names: string[]): { prefix: number; suffix: number } {
  if (names.length < 3) return { prefix: 0, suffix: 0 }

  let prefix = names[0] ?? ''
  for (const n of names) {
    while (prefix && !n.startsWith(prefix)) prefix = prefix.slice(0, -1)
  }
  let suffix = names[0] ?? ''
  for (const n of names) {
    while (suffix && !n.endsWith(suffix)) suffix = suffix.slice(1)
  }

  const minLen = Math.min(...names.map(n => n.length))
  let p = prefix.length
  let s = suffix.length
  if (p + s > minLen) s = Math.max(0, minLen - p)
  // Only dim affixes long enough to be real boilerplate
  if (p < 5) p = 0
  if (s < 4) s = 0
  return { prefix: p, suffix: s }
}

function ModName({
  name,
  prefix,
  suffix,
}: {
  name: string
  prefix: number
  suffix: number
}) {
  if (prefix === 0 && suffix === 0) {
    return <span style={{ color: c.ink }}>{name}</span>
  }
  const head = name.slice(0, prefix)
  const middle = name.slice(prefix, name.length - suffix)
  const tail = name.slice(name.length - suffix)
  return (
    <>
      <span style={{ color: c.ink3 }}>{head}</span>
      <span style={{ color: c.accent, fontWeight: 700 }}>{middle}</span>
      <span style={{ color: c.ink3 }}>{tail}</span>
    </>
  )
}

export function ModSelectionDialog({
  open,
  onOpenChange,
  detectedMods,
  onConfirm,
  onConfirmGroup,
}: ModSelectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!max-w-6xl w-[92vw] p-0 gap-0 overflow-hidden"
        style={{
          background: c.bg,
          border: `1px solid ${c.line2}`,
          borderRadius: 16,
        }}
      >
        {/* Radix unmounts the content when closed, so the body's selection
            state starts fresh every time the dialog opens */}
        <ModSelectionBody
          detectedMods={detectedMods}
          onConfirm={onConfirm}
          onConfirmGroup={onConfirmGroup}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  )
}

function ModSelectionBody({
  detectedMods,
  onConfirm,
  onConfirmGroup,
  onOpenChange,
}: Omit<ModSelectionDialogProps, 'open'>) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState('')
  const [combine, setCombine] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupCategory, setGroupCategory] = useState<ModCategory>('Skins')

  const affixes = useMemo(
    () => commonAffixes(detectedMods.map(m => getFileName(m.pakFile))),
    [detectedMods]
  )

  const visibleMods = useMemo(() => {
    const query = filter.trim().toLowerCase()
    return detectedMods
      .map((mod, index) => ({ mod, index }))
      .filter(
        ({ mod }) =>
          !query || getFileName(mod.pakFile).toLowerCase().includes(query)
      )
  }, [detectedMods, filter])

  const toggleSelection = (index: number) => {
    const newSelection = new Set(selectedIndices)
    if (newSelection.has(index)) {
      newSelection.delete(index)
    } else {
      newSelection.add(index)
    }
    setSelectedIndices(newSelection)
  }

  // Select/deselect operate on the visible (filtered) mods
  const selectAll = () => {
    const newSelection = new Set(selectedIndices)
    visibleMods.forEach(({ index }) => newSelection.add(index))
    setSelectedIndices(newSelection)
  }

  const deselectAll = () => {
    const newSelection = new Set(selectedIndices)
    visibleMods.forEach(({ index }) => newSelection.delete(index))
    setSelectedIndices(newSelection)
  }

  const allVisibleSelected =
    visibleMods.length > 0 &&
    visibleMods.every(({ index }) => selectedIndices.has(index))
  const noneVisibleSelected = visibleMods.every(
    ({ index }) => !selectedIndices.has(index)
  )

  const totalSelectedSize = useMemo(
    () =>
      detectedMods.reduce(
        (sum, mod, index) =>
          selectedIndices.has(index) ? sum + mod.size : sum,
        0
      ),
    [detectedMods, selectedIndices]
  )

  const handleConfirm = () => {
    const selectedMods = detectedMods.filter((_, index) =>
      selectedIndices.has(index)
    )
    if (combine && selectedMods.length > 1) {
      onConfirmGroup(selectedMods, groupName.trim() || 'Mod Pack', groupCategory)
    } else {
      onConfirm(selectedMods)
    }
    onOpenChange(false)
  }

  const enableCombine = (on: boolean) => {
    setCombine(on)
    if (on && !groupName) {
      setGroupName(suggestGroupName(detectedMods.map(m => getFileName(m.pakFile)), affixes.prefix))
    }
  }

  const ghostBtn: CSSProperties = {
    padding: '9px 16px',
    borderRadius: 8,
    background: 'transparent',
    color: c.ink2,
    border: `1px solid ${c.line2}`,
    fontFamily: c.font,
    fontSize: 13.5,
    fontWeight: 600,
  }

  return (
    <>
      {/* Header */}
      <div
        className="flex items-center gap-3"
        style={{
          padding: '22px 28px',
          borderBottom: `1px solid ${c.line}`,
          background: c.panel,
        }}
      >
        <div
          className="grid place-items-center flex-shrink-0"
          style={{
            width: 44,
            height: 44,
            borderRadius: 11,
            background: tint(c.accent, 18),
            color: c.accent,
            border: `1px solid ${tint(c.accent, 40)}`,
          }}
        >
          <Package className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <DialogTitle asChild>
            <h2
              className="rivals-display"
              style={{
                color: c.ink,
                fontSize: 25,
                fontWeight: 600,
                letterSpacing: '-0.01em',
              }}
            >
              Select Mods to Install
            </h2>
          </DialogTitle>
          <DialogDescription asChild>
            <p
              className="rivals-mono"
              style={{ color: c.ink3, fontSize: 12.5, marginTop: 3 }}
            >
              {detectedMods.length} mod{detectedMods.length !== 1 ? 's' : ''}{' '}
              found in this archive · pick the ones you want
            </p>
          </DialogDescription>
        </div>
        <span
          className="rivals-mono ml-auto flex-shrink-0"
          style={{
            padding: '6px 14px',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.04em',
            background: selectedIndices.size > 0 ? tint(c.accent, 16) : c.bg,
            color: selectedIndices.size > 0 ? c.accent : c.ink3,
            border: `1px solid ${selectedIndices.size > 0 ? tint(c.accent, 40) : c.line2}`,
          }}
        >
          {selectedIndices.size} / {detectedMods.length}
        </span>
      </div>

      {/* Toolbar */}
      <div
        className="flex items-center gap-2"
        style={{
          padding: '14px 28px',
          background: c.panel,
          borderBottom: `1px solid ${c.line}`,
        }}
      >
        <button
          onClick={selectAll}
          disabled={allVisibleSelected}
          className="btn-outline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={ghostBtn}
        >
          Select All
        </button>
        <button
          onClick={deselectAll}
          disabled={noneVisibleSelected}
          className="btn-outline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={ghostBtn}
        >
          Deselect All
        </button>
        <div className="relative ml-auto" style={{ width: 300 }}>
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: c.muted }}
          />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter mods…"
            className="w-full outline-none transition-colors"
            style={{
              padding: '9px 14px 9px 36px',
              borderRadius: 8,
              background: c.bg,
              color: c.ink,
              border: `1px solid ${c.line2}`,
              fontFamily: c.font,
              fontSize: 14,
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = c.accent as string
              e.currentTarget.style.boxShadow = `0 0 0 3px ${tint(c.accent, 16)}`
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = c.line2
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
        </div>
      </div>

      {/* Mod list */}
      <ScrollArea
        type="always"
        className="sidebar-scroll"
        style={{ height: 'min(64vh, 760px)', background: c.bg }}
      >
        <div>
          {visibleMods.length === 0 && (
            <div
              className="grid place-items-center"
              style={{
                padding: '48px 24px',
                color: c.ink3,
                fontFamily: c.font,
                fontSize: 15,
              }}
            >
              No mods match “{filter}”
            </div>
          )}
          {visibleMods.map(({ mod, index }, row) => {
            const isSelected = selectedIndices.has(index)
            const fileName = getFileName(mod.pakFile)
            const folderPath = getFolderPath(mod.pakFile)
            const extras = associatedExtensions(mod.associatedFiles)

            return (
              <div
                key={index}
                className="flex items-center gap-4 cursor-pointer"
                style={{
                  padding: '16px 28px 16px 24px',
                  borderBottom: `1px solid ${c.line}`,
                  background: isSelected ? tint(c.accent, 9) : 'transparent',
                  boxShadow: isSelected ? `inset 3px 0 0 ${c.accent}` : 'none',
                  transition: 'background 120ms ease',
                  animation: `metadata-fade-in 260ms ease-out ${Math.min(row, 12) * 18}ms both`,
                }}
                onClick={() => toggleSelection(index)}
                onMouseEnter={e => {
                  if (!isSelected) e.currentTarget.style.background = c.panelHi
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = isSelected
                    ? tint(c.accent, 9)
                    : 'transparent'
                }}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleSelection(index)}
                  onClick={e => e.stopPropagation()}
                  className="mod-pick-check flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div
                    className="truncate"
                    style={{
                      fontFamily: c.font,
                      fontSize: 16.5,
                      fontWeight: 600,
                      lineHeight: 1.35,
                    }}
                  >
                    <ModName
                      name={fileName}
                      prefix={affixes.prefix}
                      suffix={affixes.suffix}
                    />
                  </div>
                  {folderPath && (
                    <div
                      className="rivals-mono truncate"
                      style={{ color: c.ink3, fontSize: 12, marginTop: 4 }}
                    >
                      {folderPath}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {extras.length > 0 && (
                    <span
                      className="rivals-mono"
                      style={{
                        padding: '4px 11px',
                        borderRadius: 999,
                        fontSize: 11.5,
                        color: c.ink3,
                        border: `1px solid ${c.line2}`,
                        background: c.panel,
                      }}
                    >
                      +{mod.associatedFiles.length} {extras.join(' ')}
                    </span>
                  )}
                  <span
                    className="rivals-mono"
                    style={{
                      minWidth: 76,
                      textAlign: 'right',
                      fontSize: 12.5,
                      color: isSelected ? c.ink2 : c.ink3,
                    }}
                  >
                    {formatFileSize(mod.size)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {/* Combine-into-one option (needs 2+ selected to make sense) */}
      {selectedIndices.size > 1 && (
        <div
          className="flex items-center gap-3 flex-wrap"
          style={{ padding: '13px 28px', borderTop: `1px solid ${c.line}`, background: c.panel }}
        >
          <label className="flex items-center gap-2.5 cursor-pointer flex-shrink-0">
            <Checkbox checked={combine} onCheckedChange={(v) => enableCombine(v === true)} className="mod-pick-check" />
            <span style={{ color: combine ? c.ink : c.ink2, fontFamily: c.font, fontSize: 13.5, fontWeight: 600 }}>
              Combine into one mod
            </span>
          </label>
          {combine ? (
            <>
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Mod name…"
                className="outline-none"
                style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 7, background: c.bg, color: c.ink, border: `1px solid ${c.line2}`, fontFamily: c.font, fontSize: 13.5 }}
              />
              <div className="flex items-center gap-1 flex-shrink-0">
                {GROUP_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setGroupCategory(cat)}
                    className="rivals-mono cursor-pointer"
                    style={{
                      padding: '5px 10px',
                      borderRadius: 6,
                      border: 'none',
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                      fontSize: 9.5,
                      fontWeight: 700,
                      background: groupCategory === cat ? tint(c.accent, 14) : 'transparent',
                      color: groupCategory === cat ? c.accent : c.ink3,
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <span style={{ color: c.ink3, fontFamily: c.font, fontSize: 12 }}>
              One entry in your library — the rest attach as add-ons under it. Perfect for packs with many paks.
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div
        className="flex items-center gap-2.5"
        style={{
          padding: '18px 28px',
          borderTop: `1px solid ${c.line}`,
          background: c.panel,
        }}
      >
        <span className="rivals-mono" style={{ color: c.ink3, fontSize: 12.5 }}>
          {selectedIndices.size > 0
            ? `${formatFileSize(totalSelectedSize)} selected`
            : 'Nothing selected yet'}
        </span>
        <div className="ml-auto flex items-center gap-2.5">
          <button
            onClick={() => onOpenChange(false)}
            className="btn-outline cursor-pointer"
            style={{
              padding: '11px 22px',
              borderRadius: 9,
              background: 'transparent',
              color: c.ink2,
              border: `1px solid ${c.line2}`,
              fontFamily: c.font,
              fontSize: 14.5,
              fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedIndices.size === 0 || (combine && selectedIndices.size > 1 && !groupName.trim())}
            className="btn-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              padding: '11px 22px',
              borderRadius: 9,
              background: c.accent,
              color: c.onAccent,
              border: 'none',
              fontFamily: c.font,
              fontSize: 14.5,
              fontWeight: 600,
            }}
          >
            {combine && selectedIndices.size > 1
              ? `Install as One Mod (${selectedIndices.size} paks)`
              : `Install ${selectedIndices.size} Mod${selectedIndices.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </>
  )
}
