import React, { useState, useRef, useEffect } from 'react'
import { Palette, Disc } from 'lucide-react'
import { DEFAULT_COLOR_PALETTE, isValidHexColor } from '../../shared/profiles'
import { cn } from '../../lib/utils'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 }
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x } else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x } else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c } else { r = c; b = x }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [activeTab, setActiveTab] = useState<'palette' | 'wheel'>('palette')
  const [hexInput, setHexInput] = useState(value)

  const hsl = hexToHSL(value)
  const [hue, setHue] = useState(hsl.h)
  const [saturation, setSaturation] = useState(hsl.s)
  const [lightness, setLightness] = useState(hsl.l)

  const hueBarRef = useRef<HTMLDivElement>(null)
  const saturationBoxRef = useRef<HTMLDivElement>(null)
  const [isDraggingHue, setIsDraggingHue] = useState(false)
  const [isDraggingSaturation, setIsDraggingSaturation] = useState(false)

  useEffect(() => {
    const newHSL = hexToHSL(value)
    setHue(newHSL.h); setSaturation(newHSL.s); setLightness(newHSL.l)
    setHexInput(value)
  }, [value])

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHex = e.target.value
    setHexInput(newHex)
    if (isValidHexColor(newHex)) onChange(newHex)
  }

  const updateColorFromHSL = (h: number, s: number, l: number) => {
    const hex = hslToHex(h, s, l)
    onChange(hex); setHexInput(hex)
  }

  const handleHueMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingHue(true); updateHueFromEvent(e)
  }

  const updateHueFromEvent = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    if (!hueBarRef.current) return
    const rect = hueBarRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const newHue = (x / rect.width) * 360
    setHue(newHue); updateColorFromHSL(newHue, saturation, lightness)
  }

  const handleSaturationMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingSaturation(true); updateSaturationFromEvent(e)
  }

  const updateSaturationFromEvent = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    if (!saturationBoxRef.current) return
    const rect = saturationBoxRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height))
    const newSaturation = (x / rect.width) * 100
    const newLightness = 100 - (y / rect.height) * 100
    setSaturation(newSaturation); setLightness(newLightness)
    updateColorFromHSL(hue, newSaturation, newLightness)
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingHue) updateHueFromEvent(e)
      else if (isDraggingSaturation) updateSaturationFromEvent(e)
    }
    const handleMouseUp = () => { setIsDraggingHue(false); setIsDraggingSaturation(false) }

    if (isDraggingHue || isDraggingSaturation) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDraggingHue, isDraggingSaturation, hue, saturation, lightness])

  return (
    <div className="space-y-3">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Color</label>

      {/* Tab Buttons */}
      <div className="flex gap-1 p-1 bg-muted/20 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('palette')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200',
            activeTab === 'palette'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Palette className="w-3.5 h-3.5" />
          Palette
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('wheel')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200',
            activeTab === 'wheel'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Disc className="w-3.5 h-3.5" />
          Custom
        </button>
      </div>

      {/* Palette */}
      {activeTab === 'palette' && (
        <div className="grid grid-cols-6 gap-2">
          {DEFAULT_COLOR_PALETTE.map((color) => {
            const isSelected = value.toLowerCase() === color.toLowerCase()
            return (
              <button
                key={color}
                type="button"
                onClick={() => { onChange(color); setHexInput(color) }}
                className={cn(
                  'aspect-square rounded-xl transition-all duration-200',
                  isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-card scale-105' : 'hover:scale-105'
                )}
                style={{ backgroundColor: color }}
                title={color}
              />
            )
          })}
        </div>
      )}

      {/* Wheel */}
      {activeTab === 'wheel' && (
        <div className="space-y-4 p-4 bg-muted/15 rounded-xl">
          <div
            ref={saturationBoxRef}
            onMouseDown={handleSaturationMouseDown}
            className="relative w-full h-40 rounded-xl cursor-crosshair overflow-hidden"
            style={{
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))`,
            }}
          >
            <div
              className="absolute w-4 h-4 border-2 border-white rounded-full pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${saturation}%`,
                top: `${100 - lightness}%`,
                boxShadow: '0 0 0 1px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.4)',
              }}
            />
          </div>

          <div
            ref={hueBarRef}
            onMouseDown={handleHueMouseDown}
            className="relative w-full h-6 rounded-lg cursor-pointer overflow-hidden"
            style={{
              background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
            }}
          >
            <div
              className="absolute top-0 bottom-0 w-1 bg-white rounded-full"
              style={{
                left: `${(hue / 360) * 100}%`,
                boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
              }}
            />
          </div>

          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex-shrink-0"
              style={{ backgroundColor: value }}
            />
            <div className="text-sm font-mono text-foreground/70">{value.toUpperCase()}</div>
          </div>
        </div>
      )}

      {/* Hex Input */}
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg flex-shrink-0"
          style={{ backgroundColor: isValidHexColor(hexInput) ? hexInput : value }}
        />
        <input
          type="text"
          value={hexInput}
          onChange={handleHexChange}
          placeholder="#3b82f6"
          maxLength={7}
          className={cn(
            'flex-1 px-3 py-2 text-sm font-mono rounded-xl bg-muted/30 transition-colors',
            isValidHexColor(hexInput)
              ? 'border border-border/40 focus:border-primary'
              : 'border border-red-500/50 focus:border-red-500'
          )}
        />
      </div>
    </div>
  )
}
