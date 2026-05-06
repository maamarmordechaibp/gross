import { z } from 'zod';

export const customerSchema = z.object({
  name: z.string().min(1, 'Name required'),
  company: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const jobSchema = z.object({
  customer_id: z.string().uuid('Pick a customer'),
  product_id: z.string().uuid('Pick a product'),
  quantity: z.coerce.number().int().positive(),
  unit_price: z.coerce.number().nonnegative(),
  paper_stock_id: z.string().uuid().nullable().optional(),
  paper_qty: z.coerce.number().int().nonnegative().default(0),
  is_rush: z.boolean().default(false),
  priority: z.enum(['low','normal','high','urgent']).default('normal'),
  due_date: z.string().nullable().optional(),
  specs: z.record(z.string(), z.any()).default({}),
  notes: z.string().nullable().optional(),
  finishings: z.array(z.object({
    finishing_option_id: z.string().uuid(),
    qty: z.coerce.number().int().positive().default(1),
  })).default([]),
});

export const productSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  category: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  base_price: z.coerce.number().nonnegative(),
  default_specs: z.record(z.string(), z.any()).default({}),
  schema: z.record(z.string(), z.any()).default({ fields: [] }),
  active: z.boolean().default(true),
});

export const paperStockSchema = z.object({
  name: z.string().min(1),
  size: z.string().min(1),
  weight_gsm: z.coerce.number().int().positive().nullable().optional(),
  color: z.string().nullable().optional(),
  finish: z.string().nullable().optional(),
  qty_on_hand: z.coerce.number().int().nonnegative().default(0),
  reorder_threshold: z.coerce.number().int().nonnegative().default(100),
  cost_per_sheet: z.coerce.number().nonnegative().default(0),
  ink_bw_1side:    z.coerce.number().nonnegative().default(0.015),
  ink_bw_2side:    z.coerce.number().nonnegative().default(0.030),
  ink_color_1side: z.coerce.number().nonnegative().default(0.080),
  ink_color_2side: z.coerce.number().nonnegative().default(0.160),
});

export const marginTierSchema = z.object({
  min_qty: z.coerce.number().int().nonnegative(),
  margin_pct: z.coerce.number().nonnegative(),
});

export const finishingSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['cutting','folding','laminating','binding','scoring','perforating','embossing','foiling','other']),
  cost_per_unit: z.coerce.number().nonnegative(),
  machine: z.string().nullable().optional(),
});

export const quoteSchema = z.object({
  customer_id: z.string().uuid(),
  job_id: z.string().uuid().nullable().optional(),
  subtotal: z.coerce.number().nonnegative(),
  tax: z.coerce.number().nonnegative().default(0),
  total: z.coerce.number().nonnegative(),
  notes: z.string().nullable().optional(),
  valid_until: z.string().nullable().optional(),
});

export const invoiceSchema = z.object({
  customer_id: z.string().uuid(),
  job_id: z.string().uuid().nullable().optional(),
  subtotal: z.coerce.number().nonnegative(),
  tax: z.coerce.number().nonnegative().default(0),
  total: z.coerce.number().nonnegative(),
  due_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ---- Update / partial schemas (for edit forms) ------------------------------
export const customerUpdateSchema = customerSchema.partial();
export const productUpdateSchema  = productSchema.partial();
export const paperStockUpdateSchema = paperStockSchema.partial().extend({
  active: z.boolean().optional(),
});
export const finishingUpdateSchema  = finishingSchema.partial().extend({
  active: z.boolean().optional(),
});
export const quoteUpdateSchema = quoteSchema.partial();
export const invoiceUpdateSchema = invoiceSchema.partial();

/**
 * Job edit allows changing pricing / scheduling / specs but locks
 * customer_id and product_id (a different order should be a different job).
 */
export const jobUpdateSchema = jobSchema
  .omit({ customer_id: true, product_id: true })
  .partial()
  .extend({
    cancel_reason: z.string().optional().nullable(),
  });

export const idSchema = z.object({ id: z.string().uuid() });

export type CustomerInput     = z.infer<typeof customerSchema>;
export type JobInput          = z.infer<typeof jobSchema>;
export type ProductInput      = z.infer<typeof productSchema>;
export type PaperStockInput   = z.infer<typeof paperStockSchema>;
export type FinishingInput    = z.infer<typeof finishingSchema>;
export type QuoteInput        = z.infer<typeof quoteSchema>;
export type InvoiceInput      = z.infer<typeof invoiceSchema>;
