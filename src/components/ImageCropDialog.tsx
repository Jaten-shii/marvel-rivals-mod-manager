import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface ImageCropDialogProps {
  imageUrl: string;
  onCropComplete: (cropData: { x: number; y: number; width: number; height: number }) => void;
  onCancel: () => void;
}

export function ImageCropDialog({ imageUrl, onCropComplete, onCancel }: ImageCropDialogProps) {
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 90,
    height: 50,
    x: 5,
    y: 25,
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Initialize crop to 16:9 aspect ratio
  useEffect(() => {
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      const aspectRatio = 16 / 9;

      let cropWidth = width * 0.9;
      let cropHeight = cropWidth / aspectRatio;

      if (cropHeight > height * 0.9) {
        cropHeight = height * 0.9;
        cropWidth = cropHeight * aspectRatio;
      }

      const x = (width - cropWidth) / 2;
      const y = (height - cropHeight) / 2;

      setCrop({
        unit: 'px',
        width: cropWidth,
        height: cropHeight,
        x,
        y,
      });
    }
  }, [imageUrl]);

  const handleCropComplete = () => {
    if (completedCrop && imgRef.current) {
      const crop = completedCrop;

      // Calculate the actual pixel values
      const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

      const cropData = {
        x: Math.round(crop.x * scaleX),
        y: Math.round(crop.y * scaleY),
        width: Math.round(crop.width * scaleX),
        height: Math.round(crop.height * scaleY),
      };

      // Validate and clamp crop dimensions to image bounds
      const naturalWidth = imgRef.current.naturalWidth;
      const naturalHeight = imgRef.current.naturalHeight;

      // Ensure coordinates are within bounds
      cropData.x = Math.max(0, Math.min(cropData.x, naturalWidth - 1));
      cropData.y = Math.max(0, Math.min(cropData.y, naturalHeight - 1));

      // Ensure width and height don't exceed image bounds
      cropData.width = Math.min(cropData.width, naturalWidth - cropData.x);
      cropData.height = Math.min(cropData.height, naturalHeight - cropData.y);

      console.log('[ImageCropDialog] Crop data (scaled and validated):', cropData);
      console.log('[ImageCropDialog] Image natural size:', { width: naturalWidth, height: naturalHeight });

      onCropComplete(cropData);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-auto">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        className="relative z-10 bg-gradient-to-b from-neutral-900 to-neutral-950 border border-neutral-700/50 rounded-xl shadow-2xl w-[900px] h-[80vh] flex flex-col pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-700/50 flex-shrink-0 bg-gradient-to-r from-neutral-800/50 to-neutral-900/50">
          <h2 className="text-xl font-bold text-white">Crop Thumbnail</h2>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-md hover:bg-neutral-700/50 transition-colors text-neutral-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 flex flex-col items-center gap-4 min-h-0">
          <div className="flex-shrink-0 text-center space-y-2">
            <div className="text-base text-neutral-300">Crop your thumbnail to a 16:9 aspect ratio (600x337px)</div>
            <div className="text-sm text-white font-medium">Click and drag on the image to create or adjust the crop box</div>
          </div>

          <div className="flex-1 flex items-center justify-center min-h-0 w-full">
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={16 / 9}
            >
              <img
                ref={imgRef}
                src={imageUrl}
                alt="Crop preview"
                className="max-h-full max-w-full w-auto h-auto border-2 border-neutral-400 rounded-sm shadow-2xl"
                style={{
                  maxHeight: 'calc(80vh - 200px)',
                  imageRendering: '-webkit-optimize-contrast',
                  backfaceVisibility: 'hidden',
                  transform: 'translateZ(0)',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 15px rgba(0, 0, 0, 0.5), 0 0 20px rgba(163, 163, 163, 0.3)',
                }}
              />
            </ReactCrop>
          </div>

          <div className="text-sm text-neutral-400 flex-shrink-0 font-medium">
            {completedCrop && (
              <span>
                Selected area: {Math.round(completedCrop.width)} x {Math.round(completedCrop.height)} pixels
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-neutral-700/50 flex-shrink-0 bg-gradient-to-r from-neutral-800/50 to-neutral-900/50">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-lg text-sm text-neutral-300 bg-neutral-800/20 border border-neutral-500/30 hover:bg-neutral-700/30 hover:text-white hover:shadow-[0_0_20px_rgba(163,163,163,0.4)] transition-all backdrop-blur-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCropComplete}
            disabled={!completedCrop}
            className="px-5 py-2.5 rounded-lg text-sm bg-primary/20 text-primary-foreground border border-primary/40 shadow-[0_0_15px_hsl(var(--primary)/0.4)] hover:bg-primary/30 hover:shadow-[0_0_30px_hsl(var(--primary)/0.7)] disabled:opacity-50 disabled:pointer-events-none transition-all backdrop-blur-sm"
          >
            Apply Crop
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
