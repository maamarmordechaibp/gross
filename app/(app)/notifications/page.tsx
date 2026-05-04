import { Bell } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/app/empty-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { relativeTime } from '@/lib/utils';
import type { Notification } from '@/types/database';

export default async function NotificationsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(100)
    .returns<Notification[]>();

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" />
      {!data?.length ? (
        <EmptyState icon={Bell} title="You're all caught up" description="System events and assignments will appear here." />
      ) : (
        <Card>
          <ul className="divide-y">
            {data.map((n) => (
              <li key={n.id} className={`flex items-start gap-3 p-4 ${!n.read_at ? 'bg-primary/5' : ''}`}>
                <span className={`mt-1 h-2 w-2 rounded-full ${!n.read_at ? 'bg-primary' : 'bg-muted'}`} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{n.title}</div>
                  {n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}
                </div>
                <span className="text-xs text-muted-foreground">{relativeTime(n.created_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
