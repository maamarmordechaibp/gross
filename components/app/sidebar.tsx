'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Package, Workflow, Users, FileText, Receipt,
  Boxes, ShoppingBag, Scissors, Folder, Bell, Settings, BarChart3,
} from 'lucide-react';

const NAV = [
  { group: 'Operations', items: [
    { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
    { href: '/orders',      label: 'Orders',      icon: Package },
    { href: '/production',  label: 'Production',  icon: Workflow },
    { href: '/customers',   label: 'Customers',   icon: Users },
  ]},
  { group: 'Finance', items: [
    { href: '/quotes',      label: 'Quotes',      icon: FileText },
    { href: '/invoices',    label: 'Invoices',    icon: Receipt },
    { href: '/reports',     label: 'Reports',     icon: BarChart3 },
  ]},
  { group: 'Catalog', items: [
    { href: '/inventory',   label: 'Inventory',   icon: Boxes },
    { href: '/products',    label: 'Products',    icon: ShoppingBag },
    { href: '/finishings',  label: 'Finishings',  icon: Scissors },
    { href: '/files',       label: 'Files',       icon: Folder },
  ]},
  { group: 'Account', items: [
    { href: '/notifications', label: 'Notifications', icon: Bell },
    { href: '/settings',      label: 'Settings',      icon: Settings },
  ]},
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r bg-card md:flex">
      <Link href="/dashboard" className="flex h-16 items-center gap-2 border-b px-4">
        <Image src="/logo.png" alt="Gross Printing" width={36} height={36} priority className="h-9 w-9 object-contain" />
        <span className="text-sm font-semibold tracking-tight leading-tight">
          Gross Printing
        </span>
      </Link>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {NAV.map((g) => (
          <div key={g.group} className="space-y-1">
            <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {g.group}
            </div>
            {g.items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
