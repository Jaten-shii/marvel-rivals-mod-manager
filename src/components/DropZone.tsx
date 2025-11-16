import { useState, useCallback, DragEvent, useEffect } from 'react';
import { FileArchive } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { listen } from '@tauri-apps/api/event';

interface DropZoneProps {
  onDrop: (files: string[]) => void;
  accept?: string[];
  children?: React.ReactNode;
}

export function DropZone({ onDrop, accept = ['.zip', '.7z', '.rar', '.pak'], children }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [_dragCounter, setDragCounter] = useState(0);

  // Listen for Tauri file drop events
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      // Listen for file drop hover
      const unlistenHover = await listen<{ paths: string[] }>('tauri://drag-over', () => {
        setIsDragging(true);
      });

      // Listen for file drop
      const unlistenDrop = await listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
        setIsDragging(false);
        const filePaths = event.payload.paths.filter((filePath) => {
          const ext = `.${filePath.split('.').pop()?.toLowerCase()}`;
          return accept.includes(ext);
        });

        if (filePaths.length > 0) {
          onDrop(filePaths);
        }
      });

      // Listen for drag cancelled
      const unlistenCancel = await listen('tauri://drag-cancelled', () => {
        setIsDragging(false);
      });

      // Combine unlisten functions
      unlisten = () => {
        unlistenHover();
        unlistenDrop();
        unlistenCancel();
      };
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [onDrop, accept]);

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    setDragCounter((prev) => prev + 1);

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    setDragCounter((prev) => {
      const newCounter = prev - 1;
      if (newCounter === 0) {
        setIsDragging(false);
      }
      return newCounter;
    });
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      setIsDragging(false);
      setDragCounter(0);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        const filePaths = files
          .filter((file) => {
            const ext = `.${file.name.split('.').pop()?.toLowerCase()}`;
            return accept.includes(ext);
          })
          .map((file) => (file as any).path || file.name);

        if (filePaths.length > 0) {
          onDrop(filePaths);
        }
      }
    },
    [accept, onDrop]
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative w-full h-full"
    >
      {children}

      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg pointer-events-none"
          >
            <div className="text-center space-y-4">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <FileArchive className="w-20 h-20 mx-auto text-primary" />
              </motion.div>
              <div>
                <p className="text-xl font-semibold text-foreground">Drop files here</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Supported formats: {accept.join(', ')}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
