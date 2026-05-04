'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { recordPaymentAction } from '../actions';

export function InvoiceActions({ invoiceId, outstanding }: { invoiceId: string; outstanding: number }) {
  const [pending, startTransition] = useTransition();
  const [stripePending, setStripePending] = useState(false);
  const [amount, setAmount] = useState(outstanding.toFixed(2));

  async function payByStripe() {
    setStripePending(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error ?? 'Stripe error'); return; }
      window.location.href = j.url;
    } finally { setStripePending(false); }
  }

  function recordManual(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set('invoice_id', invoiceId);
    fd.set('amount', amount);
    fd.set('method', 'manual');
    startTransition(async () => {
      const res = await recordPaymentAction(fd);
      if (res.ok) toast.success('Payment recorded');
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <Button type="button" onClick={payByStripe} disabled={stripePending || outstanding <= 0} className="w-full">
        <CreditCard className="h-4 w-4" />
        {stripePending ? 'Opening Stripe…' : 'Pay with Stripe'}
      </Button>
      <form onSubmit={recordManual} className="space-y-2 rounded-lg border bg-muted/30 p-3">
        <Label className="text-xs">Record manual payment</Label>
        <div className="flex gap-2">
          <Input type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Button type="submit" variant="outline" disabled={pending}><Banknote className="h-4 w-4" /> Record</Button>
        </div>
      </form>
    </div>
  );
}
