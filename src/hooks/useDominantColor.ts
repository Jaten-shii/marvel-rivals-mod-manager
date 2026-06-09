import { useEffect, useState } from 'react';

// Small in-memory cache so we only sample each image once.
const cache = new Map<string, string>();

/**
 * Samples an image and returns its most prominent (vibrant) color as an rgb()
 * string. Loads the image to a tiny offscreen canvas, buckets pixels by hue,
 * and prefers saturated/mid-bright colors over washed-out or near-black/white.
 * Returns null until ready (or if it can't be sampled).
 */
export function useDominantColor(src: string | null | undefined): string | null {
  const [color, setColor] = useState<string | null>(() => (src ? cache.get(src) ?? null : null));

  useEffect(() => {
    if (!src) return;
    let cancelled = false;

    // Cache hit: resolve on the next tick (avoids setState during render/effect body).
    const cached = cache.get(src);
    if (cached) {
      const t = setTimeout(() => { if (!cancelled) setColor(cached); }, 0);
      return () => { cancelled = true; clearTimeout(t); };
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;

    img.onload = () => {
      if (cancelled) return;
      try {
        const size = 40; // downscale for speed (more samples than before)
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        // Frequency-weighted dominant color: bucket pixels into coarse color
        // bins, accumulate a weight per bin (count, mildly biased toward vivid
        // colors so a large dull-gray area doesn't always win), then take the
        // heaviest bin and average the real pixels that fell into it.
        type Bin = { weight: number; r: number; g: number; b: number; n: number };
        const STEP = 32; // bucket size per channel (256/32 = 8 levels each)

        // Pass 1: strict — only reasonably colourful pixels. Pass 2 (fallback):
        // relaxed, used only if pass 1 found nothing (e.g. a mostly-dark image).
        function collect(minBright: number, minSat: number): Bin | null {
          const bins = new Map<number, Bin>();
          for (let i = 0; i + 3 < data.length; i += 4) {
            const r = data[i] ?? 0;
            const g = data[i + 1] ?? 0;
            const b = data[i + 2] ?? 0;
            const a = data[i + 3] ?? 0;
            if (a < 128) continue;
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const sat = max === 0 ? 0 : (max - min) / max;
            const bright = max / 255;
            if (bright > 0.98 || bright < minBright || sat < minSat) continue;
            const weight = 0.3 + sat * sat * 3;
            const key = (Math.floor(r / STEP) << 16) | (Math.floor(g / STEP) << 8) | Math.floor(b / STEP);
            const bin = bins.get(key);
            if (bin) { bin.weight += weight; bin.r += r; bin.g += g; bin.b += b; bin.n += 1; }
            else bins.set(key, { weight, r, g, b, n: 1 });
          }
          let best: Bin | null = null;
          for (const bin of bins.values()) if (!best || bin.weight > best.weight) best = bin;
          return best;
        }

        const best = collect(0.32, 0.22) ?? collect(0.18, 0.1);
        if (!best) return;

        const result = `rgb(${Math.round(best.r / best.n)}, ${Math.round(best.g / best.n)}, ${Math.round(best.b / best.n)})`;
        cache.set(src, result);
        setColor(result);
      } catch {
        // canvas/CORS failure — leave null, caller falls back to accent
      }
    };

    return () => {
      cancelled = true;
    };
  }, [src]);

  return color;
}
