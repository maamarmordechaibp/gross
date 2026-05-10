-- =============================================================================
-- 0013_inventory_seed.sql
--   Seed paper_stocks with the real-world inventory list (cut sheets +
--   envelopes) supplied by the shop. Idempotent: skips rows whose name is
--   already present, so re-running the migration is safe.
--
--   cost_per_sheet = last known price-per-sheet ($USD). 0 means "unknown,
--   please update after the next receipt".
--   reorder_threshold = 500 (sensible default; tweak per-stock in the UI).
-- =============================================================================

with seed (name, size, weight_gsm, color, finish, cost_per_sheet) as (
  values
    -- ---------- Text / Bond ----------
    ('40lb Text / 16lb Bond Uncoated 60gsm',          '13x19',    60,  'white', 'Uncoated', 0.0170::numeric),
    ('50lb Text / 20lb Bond Copy Paper 75gsm',        '11x17',    75,  'white', 'Uncoated', 0::numeric),
    ('50lb Text / 20lb Bond Husky 75gsm',             '12x18',    75,  'white', 'Uncoated', 0::numeric),
    ('60lb Text / 24lb Bond Sustana 90gsm',           '11x17',    90,  'white', 'Uncoated', 0::numeric),
    ('70lb Text / 28lb Bond Sustana 105gsm',          '11x17',   105,  'white', 'Uncoated', 0::numeric),
    ('80lb Text Gloss 120gsm',                        '12x18',   120,  'white', 'Gloss',    0.0300::numeric),
    ('100lb Text Gloss Sappi 150gsm',                 '12x18',   150,  'white', 'Gloss',    0.0370::numeric),

    -- ---------- Cover / Index ----------
    ('67lb Cover Uncoated 182gsm',                    '11x17',   182,  'white', 'Uncoated', 0::numeric),
    ('74lb Cover / 110lb Index Sustana 198gsm',       '11x17',   198,  'white', 'Uncoated', 0.0550::numeric),
    ('Vellum Bristol 74lb / 110lb Sustana 198gsm',    '11x17',   198,  'white', 'Vellum',   0.0440::numeric),
    ('80lb Cover Uncoated 216gsm',                    '8.5x14',  216,  'white', 'Uncoated', 0::numeric),
    ('80lb Cover Uncoated 216gsm',                    '11x17',   216,  'white', 'Uncoated', 0::numeric),
    ('80lb Cover Uncoated Cougar Cream 216gsm',       '11x17',   216,  'cream', 'Uncoated', 0::numeric),
    ('80lb Cover Gloss Billerud 216gsm',              '13x19',   216,  'white', 'Gloss',    0::numeric),
    ('120lb Cover Gloss 324gsm',                      '12x18',   324,  'white', 'Gloss',    0::numeric),
    ('120lb Cover Gloss 324gsm',                      '13x19',   324,  'white', 'Gloss',    0::numeric),
    ('130lb Cover Silk 351gsm',                       '13x19',   351,  'white', 'Silk',     0.0880::numeric),

    -- ---------- Envelopes ----------
    ('Envelope #9',                                   '3.875x8.875',  null, 'white', 'Envelope', 0::numeric),
    ('Envelope #10 Standard',                         '4.125x9.5',    null, 'white', 'Envelope', 0.0185::numeric),
    ('Envelope #10 Window',                           '4.125x9.5',    null, 'white', 'Envelope Window', 0.0220::numeric),
    ('Envelope A9',                                   '5.75x8.75',    null, 'white', 'Envelope', 0.0450::numeric),
    ('Envelope 6x9',                                  '6x9',          null, 'white', 'Envelope', 0::numeric)
)
insert into public.paper_stocks
  (name, size, weight_gsm, color, finish, cost_per_sheet, reorder_threshold)
select s.name, s.size, s.weight_gsm, s.color, s.finish, s.cost_per_sheet, 500
  from seed s
 where not exists (
   select 1 from public.paper_stocks p
    where p.name = s.name and p.size = s.size
 );
