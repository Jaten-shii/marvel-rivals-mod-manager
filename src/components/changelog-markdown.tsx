/**
 * Warm-Dark Editorial changelog/markdown renderer — shared by the Update and
 * Changelog dialogs. Renders a subset of markdown (headings, bullets, bold)
 * with the app's editorial type system.
 */
import { c } from '@/shared/rivals-tokens';

export function renderChangelog(body: string | null | undefined, stagger = false): React.JSX.Element[] | null {
  if (!body) return null;
  const lines = body.split('\n');
  const out: React.JSX.Element[] = [];

  // Staggered entrance: each visible line fades up slightly later than the last.
  let visibleIdx = 0;
  const anim = (): React.CSSProperties =>
    stagger ? { animation: `metadata-fade-in 320ms ease-out ${Math.min(visibleIdx++, 24) * 35}ms both` } : {};

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw == null) continue;
    const t = raw.trim();

    if (t === '') {
      out.push(<div key={i} style={{ height: 6 }} />);
      continue;
    }

    if (t.match(/^###\s+/)) {
      out.push(
        <h3 key={i} className="rivals-mono" style={{ color: c.accent, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, marginTop: 14, marginBottom: 6, ...anim() }}>
          {t.replace(/^###\s+/, '')}
        </h3>
      );
      continue;
    }
    if (t.match(/^##\s+/)) {
      out.push(
        <h2 key={i} className="rivals-display" style={{ color: c.ink, fontSize: 16, fontWeight: 600, marginTop: 16, marginBottom: 6, ...anim() }}>
          {t.replace(/^##\s+/, '')}
        </h2>
      );
      continue;
    }
    if (t.match(/^#\s+/) && !t.startsWith('##')) {
      out.push(
        <h1 key={i} className="rivals-display" style={{ color: c.ink, fontSize: 19, fontWeight: 600, marginTop: 12, marginBottom: 8, letterSpacing: '-0.01em', ...anim() }}>
          {t.replace(/^#\s+/, '')}
        </h1>
      );
      continue;
    }

    if (t.match(/^[-*]\s+/)) {
      const text = t.replace(/^[-*]\s+/, '').replace(/^\*\*(.+?)\*\*:?\s*/, '$1: ').replace(/\*\*(.+?)\*\*/g, '$1');
      out.push(
        <div key={i} className="flex items-start gap-2" style={{ marginBottom: 4, ...anim() }}>
          <span style={{ color: c.accent, marginTop: 7, width: 5, height: 5, borderRadius: '50%', background: c.accent, flex: '0 0 auto' }} />
          <span style={{ color: c.ink2, fontFamily: c.font, fontSize: 13, lineHeight: 1.55 }}>{text}</span>
        </div>
      );
      continue;
    }

    if (t.includes('**')) {
      const html = t.replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:600;color:var(--rivals-ink)">$1</strong>');
      out.push(
        <p key={i} style={{ color: c.ink2, fontFamily: c.font, fontSize: 13, lineHeight: 1.55, marginBottom: 6, ...anim() }} dangerouslySetInnerHTML={{ __html: html }} />
      );
      continue;
    }

    out.push(
      <p key={i} style={{ color: c.ink2, fontFamily: c.font, fontSize: 13, lineHeight: 1.55, marginBottom: 6, ...anim() }}>{t}</p>
    );
  }

  return out;
}
