'use client';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { sendQuoteAction } from '../actions';

export function SendQuoteButton({ quoteId }: { quoteId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => {
        const res = await sendQuoteAction(quoteId);
        if (!res.ok) { toast.error(res.error); return; }
        toast.success('Quote sent', { description: res.url });
      })}
    >
      <Send className="h-3.5 w-3.5" /> {pending ? 'Sending…' : 'Send to customer'}
    </Button>
  );
}
