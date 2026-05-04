'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Bell, Plus } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { initials } from '@/lib/utils';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface TopbarProps {
  user: { full_name: string | null; role: string };
}

export function Topbar({ user }: TopbarProps) {
  const [online, setOnline] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <button
        className="flex flex-1 items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent md:max-w-md"
        onClick={() => {/* TODO: open command palette */}}
      >
        <Search className="h-4 w-4" />
        <span>Search orders, customers, files…</span>
        <kbd className="ml-auto hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground md:inline">⌘K</kbd>
      </button>

      <div className="flex items-center gap-1">
        <span className="hidden items-center gap-1.5 rounded-full bg-success/10 px-2 py-1 text-xs font-medium text-success md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" />
          {online ? 'System online' : 'Offline'}
        </span>

        <Button asChild size="sm" className="hidden md:inline-flex">
          <Link href="/orders/new"><Plus className="mr-1 h-3.5 w-3.5" />New Order</Link>
        </Button>

        <Button asChild variant="ghost" size="icon">
          <Link href="/notifications" aria-label="Notifications"><Bell className="h-4 w-4" /></Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary">{initials(user.full_name)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="font-medium">{user.full_name || 'User'}</div>
              <div className="text-xs font-normal capitalize text-muted-foreground">{user.role}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link href="/settings/profile">Profile</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/settings">Settings</Link></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut} className="text-destructive">Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
