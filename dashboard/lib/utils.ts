import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getReturnColor(value: number, vmax = 0.10): { bg: string; text: string } {
  const norm = Math.max(0, Math.min(1, (value / vmax + 1) / 2));
  let r: number, g: number, b: number;
  if (norm < 0.5) {
    const t = norm * 2;
    r = Math.round(239 + (255 - 239) * t);
    g = Math.round(68  + (255 - 68)  * t);
    b = Math.round(68  + (255 - 68)  * t);
  } else {
    const t = (norm - 0.5) * 2;
    r = Math.round(255 - (255 - 34)  * t);
    g = Math.round(255 - (255 - 197) * t);
    b = Math.round(255 - (255 - 94)  * t);
  }
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return { bg: `rgb(${r},${g},${b})`, text: lum > 140 ? '#111' : '#fff' };
}

export function getRsColor(score: number): string {
  if (score >= 65) return '#22c55e';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

export function fmt(value: number, digits = 1): string {
  const pct = value * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(digits)}%`;
}

export function fmtNumber(v: number, digits = 2): string {
  return v.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function foreignIcon(netBuy?: number): string {
  if (netBuy === undefined || netBuy === 0) return '';
  return netBuy > 0 ? ' ▲' : ' ▼';
}
