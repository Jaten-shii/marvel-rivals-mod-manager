import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * App-wide custom tooltip. Any element with a `data-tip="…"` attribute gets a
 * styled floating label instead of the native browser tooltip:
 *
 *   <button data-tip="Click to disable">…</button>
 *   <button data-tip="Settings" data-tip-side="bottom">…</button>
 *
 * Behavior: shows after a short delay on hover/focus, instantly when moving
 * between nearby controls ("warm" switching), flips below the target when
 * there's no room above, clamps to the viewport, and hides on click/scroll.
 * Mounted once (see App.tsx); styling lives in App.css (.rivals-tip).
 */

interface TipState {
  text: string;
  x: number;
  y: number;
  below: boolean;
}

const SHOW_DELAY = 350;
const WARM_WINDOW = 450; // ms after hiding during which the next tip is instant

export function TooltipLayer() {
  const [tip, setTip] = useState<TipState | null>(null);
  const showTimer = useRef<number | null>(null);
  const lastHidden = useRef(0);
  const anchorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (showTimer.current !== null) {
        clearTimeout(showTimer.current);
        showTimer.current = null;
      }
    };

    const show = (el: HTMLElement) => {
      const text = el.getAttribute('data-tip');
      if (!text) return;
      const r = el.getBoundingClientRect();
      const below = r.top < 48 || el.getAttribute('data-tip-side') === 'bottom';
      const x = Math.min(Math.max(r.left + r.width / 2, 70), window.innerWidth - 70);
      setTip({ text, x, y: below ? r.bottom + 9 : r.top - 9, below });
    };

    const hide = () => {
      clearTimer();
      anchorRef.current = null;
      setTip((t) => {
        if (t) lastHidden.current = Date.now();
        return null;
      });
    };

    const onOver = (e: Event) => {
      const target = e.target as HTMLElement | null;
      const el = target?.closest?.('[data-tip]') as HTMLElement | null;
      if (!el) return;
      if (el === anchorRef.current) return;
      anchorRef.current = el;
      clearTimer();
      if (Date.now() - lastHidden.current < WARM_WINDOW) {
        show(el);
      } else {
        showTimer.current = window.setTimeout(() => show(el), SHOW_DELAY);
      }
    };

    const onOut = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-tip]');
      if (!el || el !== anchorRef.current) return;
      const to = e.relatedTarget as HTMLElement | null;
      if (to && el.contains(to)) return;
      hide();
    };

    const onFocusOut = (e: FocusEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-tip]');
      if (el && el === anchorRef.current) hide();
    };

    document.addEventListener('pointerover', onOver, true);
    document.addEventListener('pointerout', onOut, true);
    document.addEventListener('focusin', onOver, true);
    document.addEventListener('focusout', onFocusOut, true);
    document.addEventListener('pointerdown', hide, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      clearTimer();
      document.removeEventListener('pointerover', onOver, true);
      document.removeEventListener('pointerout', onOut, true);
      document.removeEventListener('focusin', onOver, true);
      document.removeEventListener('focusout', onFocusOut, true);
      document.removeEventListener('pointerdown', hide, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, []);

  if (!tip) return null;

  return createPortal(
    <div
      className="rivals-tip"
      style={{
        left: tip.x,
        top: tip.y,
        transform: tip.below ? 'translateX(-50%)' : 'translate(-50%, -100%)',
      }}
    >
      <div className={`rivals-tip-box${tip.below ? ' is-below' : ''}`}>
        {tip.text}
        <span className="rivals-tip-arrow" aria-hidden />
      </div>
    </div>,
    document.body
  );
}
