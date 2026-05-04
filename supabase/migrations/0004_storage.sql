-- =============================================================================
-- 0004_storage.sql — Storage buckets and policies
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('job-files', 'job-files', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Staff: full access on job-files
create policy "job-files staff all"
on storage.objects for all
using (bucket_id = 'job-files' and public.is_staff())
with check (bucket_id = 'job-files' and public.is_staff());

-- Customers: read their own non-internal files (path convention: <owner_type>/<owner_id>/...)
create policy "job-files customer read"
on storage.objects for select
using (
  bucket_id = 'job-files'
  and exists (
    select 1 from public.files f
    where f.storage_path = storage.objects.name
      and f.is_internal = false
      and (
        (f.owner_type = 'customer' and f.owner_id = public.current_customer_id())
        or (f.owner_type = 'job'     and f.owner_id in (select id from public.jobs     where customer_id = public.current_customer_id()))
        or (f.owner_type = 'quote'   and f.owner_id in (select id from public.quotes   where customer_id = public.current_customer_id()))
        or (f.owner_type = 'invoice' and f.owner_id in (select id from public.invoices where customer_id = public.current_customer_id()))
      )
  )
);

-- Avatars (public bucket, owner-only write)
create policy "avatars read all"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "avatars owner write"
on storage.objects for insert
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars owner update"
on storage.objects for update
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
