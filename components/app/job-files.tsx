'use client';
import { useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { registerJobFileAction, deleteJobFileAction } from '@/app/(app)/orders/actions';
import { formatDate } from '@/lib/utils';

interface FileRow {
  id: string;
  name: string;
  size: number | null;
  storage_path: string;
  mime: string | null;
  created_at: string;
}

interface Props {
  jobId: string;
  files: FileRow[];
}

export function JobFiles({ jobId, files: initial }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<FileRow[]>(initial);
  const [uploading, setUploading] = useState(false);
  const [pendingDel, startDelete] = useTransition();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const path = `${jobId}/${Date.now()}-${file.name.replace(/[^A-Za-z0-9._-]+/g, '_')}`;
      const { error } = await supabase.storage.from('job-files').upload(path, file, {
        cacheControl: '3600', upsert: false,
      });
      if (error) { toast.error(error.message); return; }

      const fd = new FormData();
      fd.set('job_id', jobId);
      fd.set('storage_path', path);
      fd.set('name', file.name);
      fd.set('size', String(file.size));
      fd.set('mime', file.type);
      const res = await registerJobFileAction(fd);
      if (!res.ok) { toast.error(res.error); return; }

      setFiles((fs) => [res.file, ...fs]);
      toast.success('Uploaded');
      if (inputRef.current) inputRef.current.value = '';
    } finally {
      setUploading(false);
    }
  }

  function remove(f: FileRow) {
    if (!confirm(`Delete ${f.name}?`)) return;
    startDelete(async () => {
      const fd = new FormData();
      fd.set('file_id', f.id);
      fd.set('storage_path', f.storage_path);
      const res = await deleteJobFileAction(fd);
      if (!res.ok) { toast.error(res.error); return; }
      setFiles((fs) => fs.filter((x) => x.id !== f.id));
    });
  }

  async function download(f: FileRow) {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.storage.from('job-files').createSignedUrl(f.storage_path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, '_blank');
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          <Upload className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : 'Upload'}
        </Button>
        <input ref={inputRef} type="file" hidden onChange={onPick} />
      </div>
      {files.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/30 p-4 text-center text-xs text-muted-foreground">
          No files yet. Upload artwork, proofs, or any reference.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 p-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <button type="button" onClick={() => download(f)} className="flex-1 truncate text-left hover:underline">
                {f.name}
              </button>
              <span className="text-xs text-muted-foreground tabular">{prettyBytes(f.size)}</span>
              <span className="text-xs text-muted-foreground">{formatDate(f.created_at)}</span>
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(f)} disabled={pendingDel}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function prettyBytes(n: number | null): string {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
