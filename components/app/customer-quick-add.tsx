'use client';
import { useState, useTransition } from 'react';
import {
  Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger, DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { createCustomerInlineAction } from '@/app/(app)/customers/actions';
import type { Customer } from '@/types/database';

interface Props {
  onCreated: (c: Pick<Customer, 'id' | 'name' | 'company' | 'email' | 'phone'>) => void;
}

export function CustomerQuickAdd({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createCustomerInlineAction({ name, company, email, phone });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`Added ${res.customer.name}`);
      onCreated(res.customer);
      setOpen(false);
      setName(''); setCompany(''); setEmail(''); setPhone('');
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="shrink-0">
          <Plus className="h-3.5 w-3.5" /> New
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Add customer</DialogTitle>
        <DialogDescription>Quick-add a customer without leaving the order.</DialogDescription>
        <form onSubmit={submit} className="grid gap-3">
          <div className="space-y-1.5">
            <Label>Name <span className="text-destructive">*</span></Label>
            <Input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={pending}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? 'Adding…' : 'Add customer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
