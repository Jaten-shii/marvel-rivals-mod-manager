import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Crop as CropIcon } from 'lucide-react'
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
  convertToPixelCrop,
} from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { c, tint } from '../shared/rivals-tokens'

const ASPECT = 16 / 9

interface ImageCropDialogProps {
  imageUrl: string
  onCropComplete: (cropData: {
    x: number
    y: number
    width: number
    height: number
  }) => void
  onCancel: () => void
}

export function ImageCropDialog({
  imageUrl,
  onCropComplete,
  onCancel,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null)
  const [imageDims, setImageDims] = useState<{
    width: number
    height: number
    naturalWidth: number
    naturalHeight: number
  } | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // Start with the largest centered 16:9 crop that fits the image.
  // Runs on the image's own load event so the measured size is correct.
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height, naturalWidth, naturalHeight } = e.currentTarget
    setImageDims({ width, height, naturalWidth, naturalHeight })
    const maxCrop = centerCrop(
      makeAspectCrop({ unit: '%', width: 100 }, ASPECT, width, height),
      width,
      height
    )
    setCrop(maxCrop)
    // Also mark it complete so Apply works immediately without touching the box
    setCompletedCrop(convertToPixelCrop(maxCrop, width, height))
  }

  const handleCropComplete = () => {
    if (completedCrop && imgRef.current) {
      // Convert from displayed pixels to the image's natural pixels
      const scaleX = imgRef.current.naturalWidth / imgRef.current.width
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height

      const cropData = {
        x: Math.round(completedCrop.x * scaleX),
        y: Math.round(completedCrop.y * scaleY),
        width: Math.round(completedCrop.width * scaleX),
        height: Math.round(completedCrop.height * scaleY),
      }

      // Clamp to image bounds
      const naturalWidth = imgRef.current.naturalWidth
      const naturalHeight = imgRef.current.naturalHeight
      cropData.x = Math.max(0, Math.min(cropData.x, naturalWidth - 1))
      cropData.y = Math.max(0, Math.min(cropData.y, naturalHeight - 1))
      cropData.width = Math.min(cropData.width, naturalWidth - cropData.x)
      cropData.height = Math.min(cropData.height, naturalHeight - cropData.y)

      onCropComplete(cropData)
    }
  }

  // Output size in the image's real pixels (what actually gets saved)
  const outputSize =
    completedCrop && imageDims && imageDims.width > 0
      ? {
          width: Math.round(
            (completedCrop.width * imageDims.naturalWidth) / imageDims.width
          ),
          height: Math.round(
            (completedCrop.height * imageDims.naturalHeight) / imageDims.height
          ),
        }
      : null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-auto">
      {/* Backdrop */}
      <div
        className="absolute inset-0 pointer-events-auto"
        style={{
          background: 'color-mix(in oklch, black 72%, transparent)',
          backdropFilter: 'blur(6px)',
        }}
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        className="relative z-10 flex flex-col pointer-events-auto overflow-hidden"
        style={{
          width: 'min(960px, 94vw)',
          maxHeight: '88vh',
          background: c.bg,
          border: `1px solid ${c.line2}`,
          borderRadius: 16,
          boxShadow: '0 32px 80px -16px rgba(0, 0, 0, 0.7)',
          animation: 'metadata-fade-in 260ms ease-out both',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 flex-shrink-0"
          style={{
            padding: '20px 24px',
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
            <CropIcon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h2
              className="rivals-display"
              style={{
                color: c.ink,
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: '-0.01em',
              }}
            >
              Crop Thumbnail
            </h2>
            <p
              className="rivals-mono"
              style={{ color: c.ink3, fontSize: 12, marginTop: 3 }}
            >
              16:9 · starts at the largest fit — drag to move or resize
            </p>
          </div>
          <button
            onClick={onCancel}
            className="ml-auto grid place-items-center cursor-pointer transition-colors"
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              color: c.ink3,
              background: 'transparent',
              border: `1px solid transparent`,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = c.ink as string
              e.currentTarget.style.background = c.panelHi
              e.currentTarget.style.borderColor = c.line2
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = c.ink3 as string
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'transparent'
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Image area */}
        <div
          className="rivals-crop flex-1 flex items-center justify-center min-h-0"
          style={{ padding: '24px 28px', background: c.bg }}
        >
          <ReactCrop
            crop={crop}
            onChange={cropValue => setCrop(cropValue)}
            onComplete={cropValue => setCompletedCrop(cropValue)}
            aspect={ASPECT}
            keepSelection
            ruleOfThirds
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Crop preview"
              onLoad={handleImageLoad}
              className="max-h-full max-w-full w-auto h-auto"
              style={{
                maxHeight: 'calc(88vh - 230px)',
                borderRadius: 6,
                imageRendering: '-webkit-optimize-contrast',
                backfaceVisibility: 'hidden',
                transform: 'translateZ(0)',
                boxShadow: '0 20px 48px -12px rgba(0, 0, 0, 0.8)',
              }}
            />
          </ReactCrop>
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-2.5 flex-shrink-0"
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${c.line}`,
            background: c.panel,
          }}
        >
          <span className="rivals-mono" style={{ color: c.ink3, fontSize: 12 }}>
            {outputSize
              ? `Output: ${outputSize.width} × ${outputSize.height} px`
              : 'Loading image…'}
          </span>
          <div className="ml-auto flex items-center gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="btn-outline cursor-pointer"
              style={{
                padding: '10px 20px',
                borderRadius: 9,
                background: 'transparent',
                color: c.ink2,
                border: `1px solid ${c.line2}`,
                fontFamily: c.font,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCropComplete}
              disabled={!completedCrop}
              className="btn-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                padding: '10px 20px',
                borderRadius: 9,
                background: c.accent,
                color: c.onAccent,
                border: 'none',
                fontFamily: c.font,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Apply Crop
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
