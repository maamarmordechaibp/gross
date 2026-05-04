import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/app/page-header';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { JobFull } from '@/types/database';
import { KanbanBoard } from './kanban-board';

export default async function ProductionBoardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: jobs } = await supabase
    .from('v_job_full')
    .select('*')
    .neq('status', 'cancelled')
    .order('due_date', { ascending: true, nullsFirst: false })
    .returns<JobFull[]>();

  return (
    <div className="space-y-6">
      <PageHeader title="Production board" description="Drag jobs across stages — synced live">
        <Button asChild variant="outline" size="sm">
          <Link href="/production"><ArrowLeft className="h-3.5 w-3.5" />Worklist</Link>
        </Button>
      </PageHeader>
      <KanbanBoard initialJobs={jobs ?? []} />
    </div>
  );
}
