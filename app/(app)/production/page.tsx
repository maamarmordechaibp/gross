import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/app/page-header';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { JobFull } from '@/types/database';
import { Worklist } from './worklist';

export default async function ProductionPage() {
  const supabase = await createSupabaseServerClient();
  const { data: jobs } = await supabase
    .from('v_job_full')
    .select('*')
    .in('status', ['estimate', 'prepress', 'printing', 'finishing'])
    .order('is_rush', { ascending: false })
    .order('due_date', { ascending: true, nullsFirst: false })
    .returns<JobFull[]>();

  return (
    <div className="space-y-6">
      <PageHeader title="What needs to be done" description="Assign printers, mark progress, notify customers">
        <Button asChild variant="outline" size="sm">
          <Link href="/production/board"><LayoutGrid className="h-3.5 w-3.5" />Kanban view</Link>
        </Button>
      </PageHeader>
      <Worklist initialJobs={jobs ?? []} />
    </div>
  );
}
