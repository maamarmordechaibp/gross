'use client';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { approveQuoteOnBehalfAction, rejectQuoteOnBehalfAction } from '../actions';

export function ApproveOnBehalfButtons({ quoteId }: { quoteId: string }) {
  const [pending, startTransition] = useTransition();

  function approve() {
    if (!confirm('Mark this quote as approved on behalf of the customer?')) return;
    startTransition(async () => {
      const res = await approveQuoteOnBehalfAction(quoteId);
      if (!res.ok) toast.error(res.error);
      else toast.success('Quote approved', { description: res.jobId ? 'Job created' : 'Quote marked approved' });
    });
  }
  function reject() {
    if (!confirm('Decline this quote on behalf of the customer?')) return;
    startTransition(async () => {
      const res = await rejectQuoteOnBehalfAction(quoteId);
      if (!res.ok) toast.error(res.error);
      else toast.success('Quote declined');
    });
  }

  return (
    <>
      <Button type="button" size="sm" variant="default" disabled={pending} onClick={approve}>
        <Check className="h-3.5 w-3.5" /> Approve on behalf
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={reject}>
        <X className="h-3.5 w-3.5" /> Decline on behalf
      </Button>
    </>
  );
}
