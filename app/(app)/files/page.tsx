import Link from 'next/link';
import { Folder, FileText, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { SearchBar, FilterSelect, Pagination } from '@/components/app/list-toolbar';
import { Card, CardContent } from '@/components/ui/card';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

interface FileRow {
  id: string;
  owner_type: 'job' | 'customer' | 'quote' | 'invoice';
  owner_id: string;
  storage_path: string;
  name: string;
  mime: string | null;
  size: number | null;
  version: number;
  is_internal: boolean;
  created_at: string;
}

const PAGE_SIZE = 50;

function fileLink(f: FileRow): string {
  switch (f.owner_type) {
    case 'job': return `/orders/${f.owner_id}`;
    case 'quote': return `/quotes/${f.owner_id}`;
    case 'invoice': return `/invoices/${f.owner_id}`;
    case 'customer': return `/customers/${f.owner_id}`;
  }
}

function formatBytes(b: number | null): string {
  if (!b || b < 1024) return `${b ?? 0} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

export default async function FilesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? '';
  const type = sp.type ?? '';
  const page = Math.max(1, Number(sp.page ?? 1));
  const supabase = await createSupabaseServerClient();

  let query = supabase.from('files').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (q) query = query.ilike('name', `%${q}%`);
  if (type) query = query.eq('owner_type', type);
  const { data, count } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1).returns<FileRow[]>();
  const files = data ?? [];
  const total = count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Files" description="All uploads across orders, quotes, invoices, and customers" />
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <SearchBar placeholder="Search file name…" />
            <FilterSelect paramName="type" label="Type" options={[
              { label: 'All types', value: '' },
              { label: 'Jobs', value: 'job' },
              { label: 'Customers', value: 'customer' },
              { label: 'Quotes', value: 'quote' },
              { label: 'Invoices', value: 'invoice' },
            ]} />
            <span className="ml-auto text-xs text-muted-foreground">{total.toLocaleString()} files</span>
          </div>

          {files.length === 0 ? (
            <EmptyState icon={Folder} title="No files" description={q || type ? 'Try a different search or filter.' : 'Files will appear here as they are uploaded to records.'} />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr><th className="p-2 text-left">Name</th><th className="p-2 text-left">Type</th><th className="p-2 text-left">Size</th><th className="p-2 text-left">Uploaded</th><th className="p-2 text-left">Open</th></tr>
                </thead>
                <tbody className="divide-y">
                  {files.map((f) => (
                    <tr key={f.id} className="hover:bg-muted/20">
                      <td className="p-2"><div className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-medium">{f.name}</span>{f.is_internal && <span className="rounded-full bg-amber-100 px-1.5 text-[10px] uppercase text-amber-800">internal</span>}</div></td>
                      <td className="p-2 capitalize text-muted-foreground">{f.owner_type}</td>
                      <td className="p-2 tabular text-muted-foreground">{formatBytes(f.size)}</td>
                      <td className="p-2 text-muted-foreground">{formatDate(f.created_at)}</td>
                      <td className="p-2"><Link href={fileLink(f)} className="inline-flex items-center gap-1 text-xs text-primary underline">View record<ExternalLink className="h-3 w-3" /></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} perPage={PAGE_SIZE} total={total} />
        </CardContent>
      </Card>
    </div>
  );
}
