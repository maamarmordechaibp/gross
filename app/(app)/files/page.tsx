import { Folder } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';

export default function FilesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Files" description="All uploads across jobs and customers" />
      <EmptyState icon={Folder} title="File browser" description="Files are attached to specific jobs, quotes, customers, and invoices. Open a record to manage its files." />
    </div>
  );
}
