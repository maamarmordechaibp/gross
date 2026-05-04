-- =============================================================================
-- samples.sql — Realistic sample data for testing the full workflow
--
-- Run AFTER `seed.sql` (which inserts base products / papers / finishings /
-- customers). You can run this whole file in the Supabase SQL editor.
--
-- It is idempotent for the customers / products / jobs / quotes / invoices
-- whose names appear here — re-running will skip duplicates.
-- =============================================================================

-- 0. Promote every existing user to admin so RLS lets the staff app read data.
--    (Without this the customer dropdown shows up empty because is_staff()=false.)
update public.profiles set role = 'admin' where role = 'customer';

-- 1. Patch existing products to include default piece_size in default_specs
update public.products set default_specs = default_specs || '{"piece_size":{"w":3.5,"h":2}}'::jsonb
  where slug = 'business-cards';
update public.products set default_specs = default_specs || '{"piece_size":{"w":11,"h":8.5}}'::jsonb
  where slug = 'flyers';
update public.products set default_specs = default_specs || '{"piece_size":{"w":8.5,"h":5.5}}'::jsonb
  where slug = 'booklets';
update public.products set default_specs = default_specs || '{"piece_size":{"w":18,"h":24}}'::jsonb
  where slug = 'posters';

-- 2. Add a few more customers
insert into public.customers (name, company, email, phone) values
  ('Jordan Kim',  'BrightSpark Cafe',   'jordan@brightspark.cafe',  '+1-555-0301'),
  ('Riley Brooks','Brooks Architects',  'riley@brooksarch.com',     '+1-555-0334'),
  ('Casey Tran',  'Tran Family Bakery', 'casey@tranbakery.com',     '+1-555-0367')
on conflict do nothing;

-- 3. Top up paper inventory with a couple of receipts (auto-updates qty + cost)
do $$
declare
  v_user uuid;
  v_paper uuid;
begin
  select id into v_user from public.profiles limit 1;

  select id into v_paper from public.paper_stocks where name = '100lb Gloss Cover' limit 1;
  if v_paper is not null then
    insert into public.paper_receipts (paper_stock_id, qty, unit_cost, supplier, reference, received_by)
    values (v_paper, 2000, 0.17, 'Mohawk Fine Papers', 'PO-1042', v_user);
  end if;

  select id into v_paper from public.paper_stocks where name = '14pt Cardstock' limit 1;
  if v_paper is not null then
    insert into public.paper_receipts (paper_stock_id, qty, unit_cost, supplier, reference, received_by)
    values (v_paper, 1500, 0.21, 'Neenah', 'PO-1043', v_user);
  end if;
end $$;

-- 4. Sample jobs across statuses (estimate / printing / completed / delivered)
do $$
declare
  v_user uuid;
  v_alex uuid;  v_maya uuid;  v_sam uuid;  v_jordan uuid;  v_riley uuid;  v_casey uuid;
  v_bc uuid;    v_fly uuid;   v_book uuid;  v_post uuid;
  v_p_cover uuid; v_p_text uuid; v_p_unc uuid; v_p_card uuid;
  v_f_cut uuid;  v_f_round uuid; v_f_lam uuid; v_f_sad uuid;
  v_job1 uuid;   v_job2 uuid;   v_job3 uuid;   v_job4 uuid;  v_job5 uuid;
begin
  select id into v_user from public.profiles limit 1;

  select id into v_alex   from public.customers where name='Alex Rivera';
  select id into v_maya   from public.customers where name='Maya Chen';
  select id into v_sam    from public.customers where name='Sam Patel';
  select id into v_jordan from public.customers where name='Jordan Kim';
  select id into v_riley  from public.customers where name='Riley Brooks';
  select id into v_casey  from public.customers where name='Casey Tran';

  select id into v_bc   from public.products where slug='business-cards';
  select id into v_fly  from public.products where slug='flyers';
  select id into v_book from public.products where slug='booklets';
  select id into v_post from public.products where slug='posters';

  select id into v_p_cover from public.paper_stocks where name='100lb Gloss Cover';
  select id into v_p_text  from public.paper_stocks where name='100lb Matte Text';
  select id into v_p_unc   from public.paper_stocks where name='80lb Uncoated';
  select id into v_p_card  from public.paper_stocks where name='14pt Cardstock';

  select id into v_f_cut   from public.finishing_options where name='Cut to size';
  select id into v_f_round from public.finishing_options where name='Round corners';
  select id into v_f_lam   from public.finishing_options where name='Lamination — matte';
  select id into v_f_sad   from public.finishing_options where name='Saddle-stitch bind';

  -- Job 1: Alex - 500 business cards, double sided, rounded corners. ESTIMATE.
  if not exists (select 1 from public.jobs where notes='SAMPLE: Alex BC 500') then
    insert into public.jobs (customer_id, product_id, status, priority, is_rush, due_date,
      quantity, unit_price, specs, paper_stock_id, paper_qty, notes, created_by)
    values (v_alex, v_bc, 'estimate', 'normal', false, now() + interval '7 days',
      500, 0.40,
      '{"sides":"double","corners":"rounded","finish":"matte","piece_size":{"w":3.5,"h":2}}'::jsonb,
      v_p_card, 30, 'SAMPLE: Alex BC 500', v_user)
    returning id into v_job1;
    insert into public.job_finishings (job_id, finishing_option_id, qty) values
      (v_job1, v_f_cut, 500), (v_job1, v_f_round, 500);
  end if;

  -- Job 2: Maya - 2000 flyers 8.5x11, single side. PRINTING (rush!).
  if not exists (select 1 from public.jobs where notes='SAMPLE: Maya flyers 2000') then
    insert into public.jobs (customer_id, product_id, status, priority, is_rush, due_date,
      quantity, unit_price, specs, paper_stock_id, paper_qty, notes, created_by)
    values (v_maya, v_fly, 'printing', 'high', true, now() + interval '2 days',
      2000, 0.18,
      '{"size":"8.5x11","sides":"single","piece_size":{"w":11,"h":8.5}}'::jsonb,
      v_p_unc, 2100, 'SAMPLE: Maya flyers 2000', v_user)
    returning id into v_job2;
    insert into public.job_finishings (job_id, finishing_option_id, qty) values
      (v_job2, v_f_cut, 2000);
  end if;

  -- Job 3: Sam - 100 booklets, 16 pages saddle-stitched. FINISHING.
  if not exists (select 1 from public.jobs where notes='SAMPLE: Sam booklets') then
    insert into public.jobs (customer_id, product_id, status, priority, is_rush, due_date,
      quantity, unit_price, specs, paper_stock_id, paper_qty, notes, created_by)
    values (v_sam, v_book, 'finishing', 'normal', false, now() + interval '5 days',
      100, 4.50,
      '{"page_count":16,"binding":"saddle-stitch","cover_type":"100lb-gloss","piece_size":{"w":8.5,"h":5.5}}'::jsonb,
      v_p_text, 420, 'SAMPLE: Sam booklets', v_user)
    returning id into v_job3;
    insert into public.job_finishings (job_id, finishing_option_id, qty) values
      (v_job3, v_f_sad, 100), (v_job3, v_f_cut, 100);
  end if;

  -- Job 4: Jordan - 250 postcards, 5x7. COMPLETED.
  if not exists (select 1 from public.jobs where notes='SAMPLE: Jordan postcards') then
    insert into public.jobs (customer_id, product_id, status, priority, is_rush, due_date,
      quantity, unit_price, specs, paper_stock_id, paper_qty, notes, created_by)
    values (v_jordan, v_fly, 'completed', 'normal', false, now() - interval '2 days',
      250, 0.55,
      '{"size":"5.5x8.5","sides":"double","piece_size":{"w":7,"h":5}}'::jsonb,
      v_p_cover, 65, 'SAMPLE: Jordan postcards', v_user)
    returning id into v_job4;
    insert into public.job_finishings (job_id, finishing_option_id, qty) values
      (v_job4, v_f_cut, 250);
  end if;

  -- Job 5: Riley - 25 large posters 18x24, laminated. DELIVERED.
  if not exists (select 1 from public.jobs where notes='SAMPLE: Riley posters') then
    insert into public.jobs (customer_id, product_id, status, priority, is_rush, due_date,
      quantity, unit_price, specs, paper_stock_id, paper_qty, notes, created_by)
    values (v_riley, v_post, 'delivered', 'normal', false, now() - interval '10 days',
      25, 18.00,
      '{"size":"18x24","laminate":"matte","piece_size":{"w":18,"h":24}}'::jsonb,
      v_p_cover, 28, 'SAMPLE: Riley posters', v_user)
    returning id into v_job5;
    insert into public.job_finishings (job_id, finishing_option_id, qty) values
      (v_job5, v_f_lam, 25);
  end if;
end $$;

-- 5. A draft quote for Casey, an open invoice for Riley (paid), one outstanding for Maya
do $$
declare
  v_user uuid;
  v_casey uuid; v_riley uuid; v_maya uuid;
  v_inv_riley uuid; v_inv_maya uuid;
begin
  select id into v_user from public.profiles limit 1;
  select id into v_casey from public.customers where name='Casey Tran';
  select id into v_riley from public.customers where name='Riley Brooks';
  select id into v_maya  from public.customers where name='Maya Chen';

  if not exists (select 1 from public.quotes where notes like 'SAMPLE:%') then
    insert into public.quotes (customer_id, status, subtotal, tax, total, notes, valid_until, created_by)
    values (v_casey, 'draft', 320.00, 25.60, 345.60,
      'SAMPLE: 1000 menus 8.5x11 double-sided + lamination',
      now() + interval '30 days', v_user);
  end if;

  if not exists (select 1 from public.invoices where notes like 'SAMPLE: paid%') then
    insert into public.invoices (customer_id, status, subtotal, tax, total, due_date, notes, created_by)
    values (v_riley, 'sent', 450.00, 36.00, 486.00, now() - interval '5 days',
      'SAMPLE: paid - 25 posters 18x24 laminated', v_user)
    returning id into v_inv_riley;
    insert into public.payments (invoice_id, amount, method, recorded_by)
      values (v_inv_riley, 486.00, 'manual', v_user);
  end if;

  if not exists (select 1 from public.invoices where notes like 'SAMPLE: outstanding%') then
    insert into public.invoices (customer_id, status, subtotal, tax, total, due_date, notes, created_by)
    values (v_maya, 'sent', 360.00, 28.80, 388.80, now() + interval '14 days',
      'SAMPLE: outstanding - 2000 rush flyers', v_user);
  end if;
end $$;
