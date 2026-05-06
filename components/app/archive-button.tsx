'use client';
import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/** Form-action wrapper for an "Archive / Delete" button with a confirm step. */
export function ArchiveButton({
  action,
  hiddenFields,
  label = 'Archive',
  confirmText = 'Are you sure? This will hide it from lists.',
  variant = 'outline',
  redirectTo,
}: {
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  hiddenFields: Record<string, string>;
  label?: string;
  confirmText?: string;
  variant?: 'outline' | 'destructive';
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function submit() {
    const fd = new FormData();
    for (const [k, v] of Object.entries(hiddenFields)) fd.set(k, v);
    start(async () => {
      const r = await action(fd);
      if (r.ok) {
        toast.success(`${label}d`);
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      } else {
        toast.error(r.error ?? 'Failed');
      }
    });
  }

  if (!confirming) {
    return (
      <Button type="button" variant={variant} size="sm" onClick={() => setConfirming(true)}>
        <Trash2 className="h-3.5 w-3.5" />{label}
      </Button>
    );
  }
  return (
    <div className="inline-flex items-center gap-1 rounded-md border bg-destructive/5 p-0.5">
      <span className="px-2 text-xs">{confirmText}</span>
      <Button type="button" variant="destructive" size="sm" onClick={submit} disabled={pending}>
        {pending ? '…' : `Yes, ${label.toLowerCase()}`}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
        Cancel
      </Button>
    </div>
  );
}
