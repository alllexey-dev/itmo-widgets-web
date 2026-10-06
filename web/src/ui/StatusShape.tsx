export type StatusTone = 'ok' | 'warn' | 'bad' | 'off';

const LOOKS: Record<Exclude<StatusTone, 'off'>, [shape: string, color: string]> = {
  ok: ['cookie6', 'var(--md-success)'],
  warn: ['softBurst', 'var(--md-warning)'],
  bad: ['burst', 'var(--md-error)'],
};

/** A small status mark; always next to text, never the only carrier of the meaning. */
export function StatusShape({ tone, size = 12 }: { tone: StatusTone; size?: number }) {
  if (tone === 'off')
    return <span className="iw-status-off" style={{ width: size, height: size }} />;
  const [shape, color] = LOOKS[tone];
  return (
    <m3-shape
      shape={shape}
      size={size}
      color={color}
      aria-hidden="true"
      style={{ width: size, height: size }}
    />
  );
}
