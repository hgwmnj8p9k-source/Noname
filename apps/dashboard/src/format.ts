export const n = (v: string | number): number => (typeof v === 'number' ? v : Number(v));

export function usd(v: string | number, digits = 2): string {
  const x = n(v);
  const sign = x < 0 ? '-' : '';
  const abs = Math.abs(x);
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function compactUsd(v: string | number): string {
  const x = n(v);
  if (Math.abs(x) >= 1_000_000) return `$${(x / 1_000_000).toFixed(2)}M`;
  if (Math.abs(x) >= 1_000) return `$${(x / 1_000).toFixed(1)}K`;
  return `$${x.toFixed(0)}`;
}

export function price(v: string | number): string {
  const x = n(v);
  if (x === 0) return '$0';
  if (x < 0.0001) return `$${x.toExponential(2)}`;
  if (x < 1) return `$${x.toPrecision(4).replace(/\.?0+$/, '')}`;
  return `$${x.toFixed(4)}`;
}

export function pct(v: number, digits = 1): string {
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(digits)}%`;
}

export function pctRaw(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)}%`;
}

export function tone(v: number): string {
  return v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-terminal-text';
}

export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

const DEX_CHAINS = new Set(['solana', 'ethereum', 'base', 'bsc']);

/** DexScreener chart URL for a real token, or null for simulated tokens. */
export function dexLink(chain: string, address: string): string | null {
  return DEX_CHAINS.has(chain) ? `https://dexscreener.com/${chain}/${address}` : null;
}

/** Build a DexScreener link from a `${chain}:${address}` token id. */
export function dexLinkFromTokenId(tokenId: string): string | null {
  const idx = tokenId.indexOf(':');
  if (idx === -1) return null;
  return dexLink(tokenId.slice(0, idx), tokenId.slice(idx + 1));
}

export function duration(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
