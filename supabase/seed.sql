-- =============================================================================
-- seed.sql — Demo data for Gross Printing
-- Run after `supabase db reset` (which applies migrations).
-- =============================================================================

-- Products with dynamic form schemas
insert into public.products (name, slug, category, description, base_price, default_specs, schema) values
('Business Cards', 'business-cards', 'Cards',
 'Standard 3.5x2 business cards with bleed.', 25.00,
 '{"size":"3.5x2","bleed":"0.125","sides":"double"}'::jsonb,
 '{"fields":[
    {"key":"sides","label":"Sides","type":"select","options":["single","double"],"required":true},
    {"key":"corners","label":"Corners","type":"select","options":["square","rounded"]},
    {"key":"finish","label":"Finish","type":"select","options":["matte","gloss","uncoated"]}
  ]}'::jsonb),
('Flyers', 'flyers', 'Marketing',
 'Single or double-sided flyers, multiple sizes.', 40.00,
 '{"size":"8.5x11","sides":"single"}'::jsonb,
 '{"fields":[
    {"key":"size","label":"Size","type":"select","options":["4x6","5.5x8.5","8.5x11","11x17"],"required":true},
    {"key":"sides","label":"Sides","type":"select","options":["single","double"]}
  ]}'::jsonb),
('Booklets', 'booklets', 'Books',
 'Saddle-stitched or perfect-bound booklets.', 120.00,
 '{"page_count":16,"binding":"saddle-stitch"}'::jsonb,
 '{"fields":[
    {"key":"page_count","label":"Page Count","type":"number","min":4,"required":true},
    {"key":"binding","label":"Binding","type":"select","options":["saddle-stitch","perfect-bound","spiral","wire-o"],"required":true},
    {"key":"cover_type","label":"Cover","type":"select","options":["self","100lb-gloss","cardstock"]}
  ]}'::jsonb),
('Posters', 'posters', 'Large Format',
 'Wide-format posters up to 36x48.', 60.00,
 '{"size":"18x24"}'::jsonb,
 '{"fields":[
    {"key":"size","label":"Size","type":"select","options":["12x18","18x24","24x36","36x48"],"required":true},
    {"key":"laminate","label":"Laminate","type":"select","options":["none","matte","gloss"]}
  ]}'::jsonb)
on conflict (slug) do nothing;

-- Paper stocks
insert into public.paper_stocks (name, size, weight_gsm, color, finish, qty_on_hand, reorder_threshold, cost_per_sheet) values
('100lb Gloss Cover', '12x18', 270, 'White', 'Gloss', 5000, 500, 0.18),
('100lb Matte Text',  '12x18', 148, 'White', 'Matte', 8000, 800, 0.09),
('80lb Uncoated',     '8.5x11', 120, 'Natural', 'Uncoated', 12000, 1000, 0.04),
('14pt Cardstock',    '12x18', 350, 'White', 'Matte', 3000, 400, 0.22)
on conflict do nothing;

-- Finishings
insert into public.finishing_options (name, type, cost_per_unit, machine) values
('Cut to size',         'cutting',     0.02, 'Polar 92'),
('Score & fold',        'folding',     0.05, 'MBO B26'),
('Lamination — matte',  'laminating',  0.15, 'GMP Saturn'),
('Saddle-stitch bind',  'binding',     0.45, 'Heidelberg ST'),
('Perfect bind',        'binding',     1.20, 'Horizon BQ-270'),
('Round corners',       'cutting',     0.04, 'Lassco CR-50'),
('UV spot coating',     'other',       0.30, 'Scodix')
on conflict do nothing;

-- Demo customers
insert into public.customers (name, company, email, phone) values
('Alex Rivera',  'Rivera Studios',     'alex@riverastudios.com',  '+1-555-0142'),
('Maya Chen',    'Northwind Press',    'maya@northwindpress.com', '+1-555-0188'),
('Sam Patel',    'Patel & Co.',        'sam@patelco.com',         '+1-555-0210')
on conflict do nothing;
