'use client';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition, useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Search bar that pushes ?q=... into the URL with a 250ms debounce.
 * The page itself reads searchParams server-side and filters its query.
 */
export function SearchBar({ placeholder = 'Search…', paramName = 'q', className }: {
  placeholder?: string;
  paramName?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get(paramName) ?? '');
  const [, startTransition] = useTransition();

  // Sync if URL changes externally
  useEffect(() => { setValue(params.get(paramName) ?? ''); }, [params, paramName]);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(paramName, value); else next.delete(paramName);
      next.delete('page');
      const nextStr = next.toString();
      const cur = params.toString();
      if (nextStr !== cur) startTransition(() => router.replace(`${pathname}${nextStr ? `?${nextStr}` : ''}`));
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn('relative w-full max-w-xs', className)}>
      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pl-8 pr-8"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground hover:bg-accent"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** Generic dropdown filter that toggles a URL param. */
export function FilterSelect({ paramName, options, label }: {
  paramName: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get(paramName) ?? '';

  function setValue(v: string) {
    const next = new URLSearchParams(params.toString());
    if (v) next.set(paramName, v); else next.delete(paramName);
    next.delete('page');
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <select
      value={current}
      onChange={(e) => setValue(e.target.value)}
      className="h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={label}
    >
      <option value="">{label}: all</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Pagination({ page, perPage, total }: { page: number; perPage: number; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  if (total <= perPage) return null;

  const go = (p: number) => {
    const next = new URLSearchParams(params.toString());
    if (p > 1) next.set('page', String(p)); else next.delete('page');
    router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ''}`);
  };

  return (
    <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
      <span className="text-muted-foreground">
        Showing <strong>{(page - 1) * perPage + 1}</strong>–<strong>{Math.min(page * perPage, total)}</strong> of <strong>{total}</strong>
      </span>
      <div className="flex gap-1">
        <Button size="sm" variant="outline" onClick={() => go(page - 1)} disabled={page <= 1}>Previous</Button>
        <Button size="sm" variant="outline" onClick={() => go(page + 1)} disabled={page >= lastPage}>Next</Button>
      </div>
    </div>
  );
}

export function ExportCsvButton({ href, label = 'Export CSV' }: { href: string; label?: string }) {
  const params = useSearchParams();
  const qs = params.toString();
  const url = qs ? `${href}?${qs}` : href;
  return (
    <a
      href={url}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent"
    >
      {label}
    </a>
  );
}
