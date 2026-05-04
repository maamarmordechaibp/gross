/**
 * Available printers / presses. Edit this list to match your shop floor.
 * Keep it short (8-12 items) — these are the press names that appear in
 * the worklist dropdown.
 */
export const PRINTERS = [
  'Konica C14000',
  'Konica C2070',
  'HP Indigo 7900',
  'Ricoh Pro C9200',
  'Xerox Versant 280',
  'Roland VG3-540',
  'Mimaki JV300',
  'Heidelberg SM 52',
  'Riso ComColor GD',
  'Other / external',
] as const;

export type Printer = (typeof PRINTERS)[number];
