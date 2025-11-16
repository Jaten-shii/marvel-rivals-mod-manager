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

      onCropComplete(cropData);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-auto">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 pointer-events-auto"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        className="relative z-10 bg-card border border-border rounded-lg shadow-2xl w-[900px] h-[80vh] flex flex-col pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <h2 className="text-lg font-semibold text-foreground">Crop Thumbnail</h2>
          <button
            onClick={onCancel}
            className="p-1 rounded-md hover:bg-accent transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col items-center gap-3 min-h-0">
          <div className="text-sm text-muted-foreground flex-shrink-0">
            Crop your thumbnail to a 16:9 aspect ratio (600x337px)
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
                className="max-h-full max-w-full w-auto h-auto"
                style={{
                  maxHeight: 'calc(80vh - 200px)',
                  imageRendering: '-webkit-optimize-contrast',
                  backfaceVisibility: 'hidden',
                  transform: 'translateZ(0)',
                }}
              />
            </ReactCrop>
          </div>

          <div className="text-xs text-muted-foreground flex-shrink-0">
            {completedCrop && (
              <span>
                Selected area: {Math.round(completedCrop.width)} x {Math.round(completedCrop.height)} pixels
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border flex-shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-md text-sm text-foreground bg-background border border-border hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCropComplete}
            disabled={!completedCrop}
            className="px-4 py-2 rounded-md text-sm bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none transition-all"
          >
            Apply Crop
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
