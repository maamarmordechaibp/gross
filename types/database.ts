// Database type — placeholder. After running `pnpm db:types` against your
// Supabase project, replace this file with the generated output.
//
// For now we expose the minimum row types used by the UI so that the app
// compiles without a live Supabase connection.

export type UserRole = 'customer' | 'staff' | 'manager' | 'admin';
export type JobStatus = 'estimate' | 'prepress' | 'printing' | 'finishing' | 'completed' | 'delivered' | 'cancelled';
export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';
export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired';
export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'void';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  customer_id: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  billing_address: Record<string, unknown> | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
  default_specs: Record<string, unknown>;
  schema: { fields?: ProductFormField[] };
  base_price: number;
  active: boolean;
  archived_at?: string | null;
}

export type ProductFormField =
  | { key: string; label: string; type: 'text'; required?: boolean }
  | { key: string; label: string; type: 'number'; min?: number; max?: number; required?: boolean }
  | { key: string; label: string; type: 'select'; options: string[]; required?: boolean }
  | { key: string; label: string; type: 'checkbox' };

export interface PaperStock {
  id: string;
  name: string;
  size: string;
  weight_gsm: number | null;
  color: string | null;
  finish: string | null;
  qty_on_hand: number;
  qty_reserved: number;
  reorder_threshold: number;
  cost_per_sheet: number;
  bw_ink_per_side: number;
  color_ink_per_side: number;
  ink_bw_1side: number;
  ink_bw_2side: number;
  ink_color_1side: number;
  ink_color_2side: number;
  active: boolean;
  archived_at?: string | null;
}

export interface FinishingOption {
  id: string;
  name: string;
  type: 'cutting' | 'folding' | 'laminating' | 'binding' | 'scoring' | 'perforating' | 'embossing' | 'foiling' | 'other';
  cost_per_unit: number;
  machine: string | null;
  active: boolean;
  archived_at?: string | null;
}

export interface Job {
  id: string;
  job_number: string;
  customer_id: string;
  product_id: string;
  status: JobStatus;
  priority: JobPriority;
  is_rush: boolean;
  due_date: string | null;
  quantity: number;
  unit_price: number;
  specs: Record<string, unknown>;
  paper_stock_id: string | null;
  paper_qty: number;
  assigned_to: string | null;
  notes: string | null;
  internal_notes: string | null;
  printer: string | null;
  printed_at: string | null;
  parent_job_id?: string | null;
  cancel_reason?: string | null;
  template_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobCosts {
  job_id: string;
  paper_cost: number;
  finishing_cost: number;
  rush_surcharge: number;
  labor_cost: number;
  total_cost: number;
  revenue: number;
  profit: number;
  margin_pct: number;
}

export interface JobFull extends Job, Partial<JobCosts> {
  customer_name: string;
  customer_company: string | null;
  customer_email: string | null;
  product_name: string;
  product_slug: string;
  paper_name: string | null;
  paper_size: string | null;
  assignee_name: string | null;
}

export interface Quote {
  id: string;
  quote_number: string;
  customer_id: string;
  job_id: string | null;
  status: QuoteStatus;
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
  approval_token: string | null;
  valid_until: string | null;
  sent_at: string | null;
  decided_at: string | null;
  spec: Record<string, unknown> | null;
  line_items?: QuoteLineItem[] | null;
  archived_at?: string | null;
  created_at: string;
}

export interface QuoteLineItem {
  description: string;
  qty: number;
  unit_price: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  job_id: string | null;
  status: InvoiceStatus;
  subtotal: number;
  tax: number;
  total: number;
  amount_paid: number;
  due_date: string | null;
  stripe_payment_intent_id: string | null;
  notes: string | null;
  archived_at?: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface DashboardKpis {
  active_orders: number;
  orders_due_today: number;
  urgent_jobs: number;
  completed_today: number;
  overdue_jobs: number;
  revenue_today: number;
  revenue_week: number;
  revenue_month: number;
}
