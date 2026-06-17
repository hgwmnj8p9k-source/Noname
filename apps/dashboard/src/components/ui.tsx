import type { ReactNode } from 'react';

export function Panel({
  title,
  right,
  children,
  className = '',
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-title">
        <span>{title}</span>
        {right}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function Stat({ label, value, tone = '' }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone}`}>{value}</div>
    </div>
  );
}

const FAMILY_COLORS: Record<string, string> = {
  price: 'border-sky-500/40 text-sky-300',
  liquidity: 'border-violet-500/40 text-violet-300',
  onchain: 'border-amber-500/40 text-amber-300',
  social: 'border-pink-500/40 text-pink-300',
};

export function FamilyTag({ family }: { family: string }) {
  return <span className={`tag ${FAMILY_COLORS[family] ?? 'border-terminal-border text-terminal-muted'}`}>{family}</span>;
}

/** Horizontal bar in [-1, 1] centred at zero for signal scores. */
export function ScoreBar({ value }: { value: number }) {
  const clamped = Math.max(-1, Math.min(1, value));
  const width = Math.abs(clamped) * 50;
  const positive = clamped >= 0;
  return (
    <div className="relative h-1.5 w-full bg-terminal-border/50 rounded">
      <div className="absolute left-1/2 top-0 h-full w-px bg-terminal-muted/40" />
      <div
        className={`absolute top-0 h-full rounded ${positive ? 'bg-up' : 'bg-down'}`}
        style={{ left: positive ? '50%' : `${50 - width}%`, width: `${width}%` }}
      />
    </div>
  );
}

export function Meter({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const color = value > 0.8 ? 'bg-down' : value > 0.5 ? 'bg-amber-400' : 'bg-up';
  return (
    <div>
      {label && <div className="stat-label mb-0.5">{label}</div>}
      <div className="h-1.5 w-full bg-terminal-border/50 rounded overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ConfirmDots({ count, required = 3, max = 4 }: { count: number; required?: number; max?: number }) {
  return (
    <span className="inline-flex gap-0.5 align-middle">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            i < count ? (count >= required ? 'bg-up' : 'bg-amber-400') : 'bg-terminal-border'
          }`}
        />
      ))}
    </span>
  );
}
