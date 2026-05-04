import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | null | undefined, currency = 'USD') {
  const n = Number(amount ?? 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

export function formatDate(d: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return '—';
  const options: Intl.DateTimeFormatOptions = opts ?? { dateStyle: 'medium' };
  return new Intl.DateTimeFormat('en-US', options).format(new Date(d));
}

export function formatDateTime(d: string | Date | null | undefined) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));
}

export function relativeTime(d: string | Date | null | undefined) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const sec = Math.round(diff / 1000);
  const min = Math.round(sec / 60);
  const hr  = Math.round(min / 60);
  const day = Math.round(hr / 24);
  if (sec < 60) return `${sec}s ago`;
  if (min < 60) return `${min}m ago`;
  if (hr  < 24) return `${hr}h ago`;
  if (day < 7)  return `${day}d ago`;
  return formatDate(d);
}

export function initials(name?: string | null) {
  if (!name) return '??';
  return name.split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('');
}
