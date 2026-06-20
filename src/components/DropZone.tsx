import { useState, useCallback, useEffect, type DragEvent } from 'react';
import { PackageOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { listen } from '@tauri-apps/api/event';
import { c, tint } from '../shared/rivals-tokens';

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
      // Listen for file drop hover (entering window)
      const unlistenHover = await listen<{ paths: string[] }>('tauri://drag-over', () => {
        setIsDragging(true);
      });

      // Listen for file drop
      const unlistenDrop = await listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
        setIsDragging(false);
        setDragCounter(0);
        const filePaths = event.payload.paths.filter((filePath) => {
          const ext = `.${filePath.split('.').pop()?.toLowerCase()}`;
          return accept.includes(ext);
        });

        if (filePaths.length > 0) {
          onDrop(filePaths);
        }
      });

      // Listen for drag leave (leaving window without dropping)
      const unlistenLeave = await listen('tauri://drag-leave', () => {
        setIsDragging(false);
        setDragCounter(0);
      });

      // Listen for drag cancelled (e.g., pressing Escape)
      const unlistenCancel = await listen('tauri://drag-cancelled', () => {
        setIsDragging(false);
        setDragCounter(0);
      });

      // Combine unlisten functions
      unlisten = () => {
        unlistenHover();
        unlistenDrop();
        unlistenLeave();
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
          .map((file) => (file as File & { path?: string }).path || file.name);

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
            transition={{ duration: 0.18 }}
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none overflow-hidden"
            style={{
              background: tint(c.bg, 88),
              backdropFilter: 'blur(10px)',
            }}
          >
            {/* Accent glow radiating from the center */}
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(ellipse 55% 45% at 50% 50%, ${tint(c.accent, 14)} 0%, transparent 70%)`,
              }}
            />

            {/* Marching-ants border */}
            <svg className="absolute inset-0 w-full h-full">
              <rect
                style={{
                  x: 16,
                  y: 16,
                  width: 'calc(100% - 32px)',
                  height: 'calc(100% - 32px)',
                  rx: 18,
                }}
                fill="none"
                stroke={c.accent}
                strokeWidth={2}
                strokeDasharray="10 15"
                strokeLinecap="round"
                opacity={0.85}
                className="dz-ants"
              />
            </svg>

            {/* Corner brackets */}
            {[
              { top: 30, left: 30, bt: true, bl: true },
              { top: 30, right: 30, bt: true, br: true },
              { bottom: 30, left: 30, bb: true, bl: true },
              { bottom: 30, right: 30, bb: true, br: true },
            ].map((corner, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, scale: 1.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.32, delay: 0.05 + i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                className="absolute"
                style={{
                  width: 30,
                  height: 30,
                  top: corner.top,
                  left: corner.left,
                  right: corner.right,
                  bottom: corner.bottom,
                  borderTop: corner.bt ? `3px solid ${c.accent}` : 'none',
                  borderBottom: corner.bb ? `3px solid ${c.accent}` : 'none',
                  borderLeft: corner.bl ? `3px solid ${c.accent}` : 'none',
                  borderRight: corner.br ? `3px solid ${c.accent}` : 'none',
                  borderRadius: 2,
                  filter: `drop-shadow(0 0 6px ${tint(c.accent, 50)})`,
                }}
              />
            ))}

            {/* Center stack */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              className="relative text-center"
            >
              {/* Icon disc with sonar pulses */}
              <div className="relative mx-auto" style={{ width: 112, height: 112 }}>
                {[0, 1].map(ring => (
                  <span
                    key={ring}
                    className="dz-pulse absolute rounded-full"
                    style={{
                      inset: 0,
                      border: `2px solid ${tint(c.accent, 55)}`,
                      animationDelay: `${ring * 0.9}s`,
                    }}
                  />
                ))}
                <div
                  className="dz-bob absolute grid place-items-center rounded-full"
                  style={{
                    inset: 10,
                    background: `linear-gradient(160deg, ${tint(c.accent, 26)}, ${tint(c.accent, 10)})`,
                    border: `1.5px solid ${tint(c.accent, 60)}`,
                    boxShadow: `0 0 38px ${tint(c.accent, 35)}, inset 0 1px 0 ${tint(c.accent, 30)}`,
                    color: c.accent,
                  }}
                >
                  <PackageOpen className="w-10 h-10" strokeWidth={1.6} />
                </div>
              </div>

              {/* Kicker */}
              <p
                className="rivals-mono"
                style={{
                  marginTop: 26,
                  color: c.accent,
                  fontSize: 11.5,
                  fontWeight: 600,
                  letterSpacing: '0.34em',
                  textTransform: 'uppercase',
                }}
              >
                Install Mods
              </p>

              {/* Title */}
              <h2
                className="rivals-display"
                style={{
                  marginTop: 6,
                  color: c.ink,
                  fontSize: 42,
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                  textShadow: `0 2px 24px ${tint(c.accent, 25)}`,
                }}
              >
                Drop it like it&rsquo;s hot
              </h2>
              <p style={{ marginTop: 8, color: c.ink3, fontFamily: c.font, fontSize: 14.5 }}>
                Release to install into your library
              </p>

              {/* Format chips */}
              <div className="flex items-center justify-center gap-2" style={{ marginTop: 18 }}>
                {accept.map(ext => (
                  <span
                    key={ext}
                    className="rivals-mono"
                    style={{
                      padding: '5px 12px',
                      borderRadius: 999,
                      fontSize: 11.5,
                      letterSpacing: '0.05em',
                      color: c.ink2,
                      background: tint(c.accent, 10),
                      border: `1px solid ${tint(c.accent, 30)}`,
                    }}
                  >
                    {ext}
                  </span>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
