// Amount helpers. Amounts are always decimal strings (yoctoNEAR / wei); BigInt only for arithmetic.

export const YOCTO_PER_NEAR = 10n ** 24n;
export const WEI_PER_ETH = 10n ** 18n;

function fmt(value: bigint, unit: bigint, maxDecimals: number, minDecimals: number): string {
  const neg = value < 0n;
  const v = neg ? -value : value;
  const whole = v / unit;
  const frac = v % unit;
  const unitDigits = unit.toString().length - 1;
  let fracStr = frac.toString().padStart(unitDigits, '0').slice(0, maxDecimals);
  while (fracStr.length > minDecimals && fracStr.endsWith('0')) fracStr = fracStr.slice(0, -1);
  return `${neg ? '-' : ''}${whole.toString()}${fracStr ? '.' + fracStr : ''}`;
}

/** "0.70" style. Two decimals by default, up to four when the amount is tiny. */
export function near(yocto: string | bigint, decimals = 2): string {
  const v = typeof yocto === 'bigint' ? yocto : BigInt(yocto || '0');
  if (v !== 0n && (v < 0n ? -v : v) < YOCTO_PER_NEAR / 100n) return fmt(v, YOCTO_PER_NEAR, 4, 2);
  return fmt(v, YOCTO_PER_NEAR, decimals, decimals);
}

export function eth(wei: string | bigint): string {
  const v = typeof wei === 'bigint' ? wei : BigInt(wei || '0');
  return fmt(v, WEI_PER_ETH, 6, 0) || '0';
}

/** Parse a human decimal ("1.5") into a canonical decimal string in base units. Returns null if invalid. */
export function parseUnits(input: string, unit: bigint): string | null {
  const s = input.trim();
  if (!/^\d*(\.\d*)?$/.test(s) || s === '' || s === '.') return null;
  const [w, f = ''] = s.split('.');
  const digits = unit.toString().length - 1;
  if (f.length > digits) return null;
  const v = BigInt(w || '0') * unit + BigInt((f + '0'.repeat(digits)).slice(0, digits) || '0');
  return v.toString();
}

export const parseNear = (s: string) => parseUnits(s, YOCTO_PER_NEAR);
export const parseEth = (s: string) => parseUnits(s, WEI_PER_ETH);

export function shortHash(h: string, head = 4, tail = 4): string {
  if (!h) return '';
  if (h.length <= head + tail + 1) return h;
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}

export function shortAddr(a: string): string {
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) return `${a.slice(0, 6)}…${a.slice(-4)}`;
  if (a.length > 22) return `${a.slice(0, 12)}…${a.slice(-8)}`;
  return a;
}

export const isEvmAddress = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s.trim());

export function pct(bps: number): string {
  const v = bps / 100;
  return `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
}
