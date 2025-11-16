import React, { useState, useRef, useEffect } from 'react'
import { Palette, Disc } from 'lucide-react'
import { DEFAULT_COLOR_PALETTE, isValidHexColor } from '../../shared/profiles'
import { cn } from '../../lib/utils'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

// Helper functions for color conversion
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
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 }
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2

  let r = 0
  let g = 0
  let b = 0

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c
  } else if (h >= 300 && h < 360) {
    r = c; g = 0; b = x
  }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [activeTab, setActiveTab] = useState<'palette' | 'wheel'>('palette')
  const [hexInput, setHexInput] = useState(value)

  // Color wheel state
  const hsl = hexToHSL(value)
  const [hue, setHue] = useState(hsl.h)
  const [saturation, setSaturation] = useState(hsl.s)
  const [lightness, setLightness] = useState(hsl.l)

  const hueBarRef = useRef<HTMLDivElement>(null)
  const saturationBoxRef = useRef<HTMLDivElement>(null)
  const [isDraggingHue, setIsDraggingHue] = useState(false)
  const [isDraggingSaturation, setIsDraggingSaturation] = useState(false)

  // Update HSL when value prop changes
  useEffect(() => {
    const newHSL = hexToHSL(value)
    setHue(newHSL.h)
    setSaturation(newHSL.s)
    setLightness(newHSL.l)
    setHexInput(value)
  }, [value])

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHex = e.target.value
    setHexInput(newHex)

    // Validate and update if valid
    if (isValidHexColor(newHex)) {
      onChange(newHex)
    }
  }

  const updateColorFromHSL = (h: number, s: number, l: number) => {
    const hex = hslToHex(h, s, l)
    onChange(hex)
    setHexInput(hex)
  }

  // Hue bar handlers
  const handleHueMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingHue(true)
    updateHueFromEvent(e)
  }

  const updateHueFromEvent = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    if (!hueBarRef.current) return
    const rect = hueBarRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const newHue = (x / rect.width) * 360
    setHue(newHue)
    updateColorFromHSL(newHue, saturation, lightness)
  }

  // Saturation/Lightness box handlers
  const handleSaturationMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingSaturation(true)
    updateSaturationFromEvent(e)
  }

  const updateSaturationFromEvent = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    if (!saturationBoxRef.current) return
    const rect = saturationBoxRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height))
    const newSaturation = (x / rect.width) * 100
    const newLightness = 100 - (y / rect.height) * 100
    setSaturation(newSaturation)
    setLightness(newLightness)
    updateColorFromHSL(hue, newSaturation, newLightness)
  }

  // Global mouse move/up handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingHue) {
        updateHueFromEvent(e)
      } else if (isDraggingSaturation) {
        updateSaturationFromEvent(e)
      }
    }

    const handleMouseUp = () => {
      setIsDraggingHue(false)
      setIsDraggingSaturation(false)
    }

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
      <label className="text-sm font-medium text-foreground">Color</label>

      {/* Tab Buttons */}
      <div className="flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('palette')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'palette'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Palette className="w-4 h-4" />
          Palette
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('wheel')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'wheel'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Disc className="w-4 h-4" />
          Wheel
        </button>
      </div>

      {/* Palette Tab Content */}
      {activeTab === 'palette' && (
        <div className="grid grid-cols-5 gap-2">
          {DEFAULT_COLOR_PALETTE.map((color) => {
            const isSelected = value.toLowerCase() === color.toLowerCase()

            return (
              <button
                key={color}
                type="button"
                onClick={() => {
                  onChange(color)
                  setHexInput(color)
                }}
                className={cn(
                  'w-full h-12 rounded-md border-2 transition-all duration-200',
                  isSelected ? 'border-white scale-110 ring-2 ring-white/50' : 'border-transparent hover:scale-105'
                )}
                style={{ backgroundColor: color }}
                title={color}
              />
            )
          })}
        </div>
      )}

      {/* Wheel Tab Content */}
      {activeTab === 'wheel' && (
        <div className="space-y-4 p-4 bg-[#0A0E12] rounded-md border border-border">
          {/* Saturation/Lightness Picker */}
          <div className="space-y-2">
            <div
              ref={saturationBoxRef}
              onMouseDown={handleSaturationMouseDown}
              className="relative w-full h-48 rounded-lg cursor-crosshair overflow-hidden border-2 border-border"
              style={{
                background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))`,
              }}
            >
              {/* Picker Circle */}
              <div
                className="absolute w-4 h-4 border-2 border-white rounded-full shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${saturation}%`,
                  top: `${100 - lightness}%`,
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.4)',
                }}
              />
            </div>
          </div>

          {/* Hue Slider */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Hue</label>
            <div
              ref={hueBarRef}
              onMouseDown={handleHueMouseDown}
              className="relative w-full h-8 rounded-lg cursor-pointer overflow-hidden border-2 border-border"
              style={{
                background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
              }}
            >
              {/* Hue Indicator */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
                style={{
                  left: `${(hue / 360) * 100}%`,
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.4)',
                }}
              />
            </div>
          </div>

          {/* Color Preview */}
          <div className="flex items-center gap-3">
            <div
              className="w-16 h-16 rounded-lg border-2 border-border shadow-inner"
              style={{ backgroundColor: value }}
            />
            <div className="flex-1 space-y-1">
              <div className="text-xs text-muted-foreground">Preview</div>
              <div className="text-sm font-mono text-foreground">{value.toUpperCase()}</div>
            </div>
          </div>
        </div>
      )}

      {/* Hex Color Input */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Hex Color</label>
        <input
          type="text"
          value={hexInput}
          onChange={handleHexChange}
          placeholder="#3b82f6"
          maxLength={7}
          className={cn(
            'w-full px-3 py-2 text-sm rounded-md border transition-colors',
            'bg-[#191F24] text-foreground',
            isValidHexColor(hexInput)
              ? 'border-border focus:border-primary'
              : 'border-red-500 focus:border-red-500'
          )}
        />
        {!isValidHexColor(hexInput) && (
          <p className="text-xs text-red-400">Invalid hex format (e.g., #3b82f6)</p>
        )}
      </div>
    </div>
  )
}
