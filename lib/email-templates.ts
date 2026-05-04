import 'server-only';

const LOGO_URL =
  process.env.BRAND_LOGO_URL ??
  'https://zixcznlsmuincthlvtly.supabase.co/storage/v1/object/public/avatars/brand/logo.png';

const BRAND = {
  name: 'Gross Printing',
  ink: '#0b1220',
  accent: '#1d3a8a',
  muted: '#5b6472',
  border: '#e6e8ec',
  bg: '#f4f5f7',
};

function money(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
}

function dateStr(d: string | Date | null | undefined) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date(d));
}

function shell(inner: string, preheader: string) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${BRAND.name}</title></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:Georgia,'Times New Roman',Cambria,serif;color:${BRAND.ink};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:28px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${BRAND.border};">
      <tr><td align="center" style="padding:28px 32px 12px;">
        <img src="${LOGO_URL}" alt="${BRAND.name}" width="120" style="display:block;width:120px;max-width:120px;height:auto;border:0;" />
      </td></tr>
      <tr><td style="padding:8px 36px 32px;font-size:15px;line-height:1.7;color:${BRAND.ink};">
        ${inner}
      </td></tr>
      <tr><td style="padding:18px 36px;border-top:1px solid ${BRAND.border};background:#fafbfc;font-size:12px;color:${BRAND.muted};font-family:Georgia,serif;text-align:center;">
        ${BRAND.name} &nbsp;·&nbsp; reply to this email and we'll get right back to you
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export interface InvoiceJob {
  job_number: string;
  product_name: string | null;
  customer_name: string | null;
  quantity: number;
  unit_price: number;
  due_date: string | null;
  notes?: string | null;
}

function firstName(full: string | null | undefined) {
  if (!full) return '';
  return full.trim().split(/\s+/)[0];
}

export function orderReadyEmail(job: InvoiceJob) {
  const subtotal = (job.quantity || 0) * (job.unit_price || 0);
  const total = subtotal;
  const fname = firstName(job.customer_name);
  const greeting = fname ? `Hi ${fname},` : 'Hello,';
  const preheader = `Order ${job.job_number} is ready — ${money(total)} on the invoice.`;

  const inner = `
    <p style="margin:0 0 14px;">${greeting}</p>
    <p style="margin:0 0 14px;">
      Just a quick note to let you know your <strong>${job.product_name ?? 'order'}</strong>
      (#${job.job_number}) is off the press and ready whenever you'd like to swing by.
    </p>
    <p style="margin:0 0 22px;">
      Invoice is below. You can settle on pickup, or reply to this email and we'll send over a payment link.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:Georgia,serif;font-size:14px;margin:0 0 22px;">
      <tr>
        <td style="padding:10px 0;border-top:1px solid ${BRAND.border};border-bottom:1px solid ${BRAND.border};color:${BRAND.muted};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;">Invoice · #${job.job_number}</td>
        <td align="right" style="padding:10px 0;border-top:1px solid ${BRAND.border};border-bottom:1px solid ${BRAND.border};color:${BRAND.muted};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;">${dateStr(new Date())}</td>
      </tr>
      <tr>
        <td style="padding:14px 0 6px;">${job.product_name ?? 'Print job'}</td>
        <td align="right" style="padding:14px 0 6px;">${job.quantity} × ${money(job.unit_price)}</td>
      </tr>
      <tr>
        <td style="padding:0 0 14px;border-bottom:1px solid ${BRAND.border};color:${BRAND.muted};font-size:13px;">Quantity ${job.quantity}</td>
        <td align="right" style="padding:0 0 14px;border-bottom:1px solid ${BRAND.border};">${money(subtotal)}</td>
      </tr>
      <tr>
        <td style="padding:14px 0 0;font-weight:bold;">Total due</td>
        <td align="right" style="padding:14px 0 0;font-weight:bold;font-size:18px;color:${BRAND.accent};">${money(total)}</td>
      </tr>
    </table>

    ${job.notes ? `<p style="margin:0 0 14px;color:${BRAND.muted};font-size:13px;font-style:italic;">${job.notes}</p>` : ''}

    <p style="margin:0 0 4px;">Thanks for the work — really appreciate it.</p>
    <p style="margin:0;">— ${BRAND.name}</p>
  `;

  const text = `${greeting}

Your ${job.product_name ?? 'order'} (#${job.job_number}) is ready.

Invoice
  ${job.product_name ?? 'Print job'} — ${job.quantity} × ${money(job.unit_price)} = ${money(subtotal)}
  Total due: ${money(total)}

Settle on pickup, or reply to this email for a payment link.

Thanks again,
${BRAND.name}`;

  return {
    subject: `#${job.job_number} is ready — ${money(total)}`,
    html: shell(inner, preheader),
    text,
  };
}

export function orderDeliveredEmail(job: InvoiceJob) {
  const total = (job.quantity || 0) * (job.unit_price || 0);
  const fname = firstName(job.customer_name);
  const greeting = fname ? `Hi ${fname},` : 'Hello,';
  const preheader = `#${job.job_number} delivered.`;

  const inner = `
    <p style="margin:0 0 14px;">${greeting}</p>
    <p style="margin:0 0 14px;">
      Your <strong>${job.product_name ?? 'order'}</strong> (#${job.job_number}) has been delivered. Hope it looks great in person.
    </p>
    <p style="margin:0 0 22px;">
      If the balance of <strong>${money(total)}</strong> hasn't been settled yet, just reply and we'll send over a payment link.
    </p>
    <p style="margin:0 0 4px;">Thanks again,</p>
    <p style="margin:0;">— ${BRAND.name}</p>
  `;

  return {
    subject: `#${job.job_number} delivered`,
    html: shell(inner, preheader),
    text: `${greeting}\n\n#${job.job_number} (${job.product_name ?? 'order'}) has been delivered. Balance if unpaid: ${money(total)}.\n\nThanks again,\n${BRAND.name}`,
  };
}

export function quoteSentEmail(args: {
  quote_number: string;
  customer_name: string | null;
  total: number;
  valid_until: string | null;
  approve_url: string;
}) {
  const fname = firstName(args.customer_name);
  const greeting = fname ? `Hi ${fname},` : 'Hello,';
  const preheader = `Quote ${args.quote_number} — ${money(args.total)}`;
  const inner = `
    <p style="margin:0 0 14px;">${greeting}</p>
    <p style="margin:0 0 14px;">
      Here is your quote <strong>${args.quote_number}</strong> for <strong>${money(args.total)}</strong>.
      ${args.valid_until ? `Valid through <strong>${dateStr(args.valid_until)}</strong>.` : ''}
    </p>
    <p style="margin:0 0 22px;">
      <a href="${args.approve_url}" style="background:${BRAND.accent};color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">Review &amp; approve quote</a>
    </p>
    <p style="margin:0 0 14px;color:${BRAND.muted};font-size:13px;">
      Questions or changes? Just reply to this email.
    </p>
    <p style="margin:0 0 4px;">Thanks,</p>
    <p style="margin:0;">— ${BRAND.name}</p>
  `;
  return {
    subject: `Quote ${args.quote_number} — ${money(args.total)}`,
    html: shell(inner, preheader),
    text: `${greeting}\n\nQuote ${args.quote_number} — ${money(args.total)}\nApprove: ${args.approve_url}\n\n— ${BRAND.name}`,
  };
}

export function invoiceCreatedEmail(args: {
  invoice_number: string;
  customer_name: string | null;
  total: number;
  due_date: string | null;
  job_number: string | null;
}) {
  const fname = firstName(args.customer_name);
  const greeting = fname ? `Hi ${fname},` : 'Hello,';
  const preheader = `Invoice ${args.invoice_number} — ${money(args.total)}`;
  const inner = `
    <p style="margin:0 0 14px;">${greeting}</p>
    <p style="margin:0 0 14px;">
      Invoice <strong>${args.invoice_number}</strong>${args.job_number ? ` for order #${args.job_number}` : ''}
      is ready: <strong>${money(args.total)}</strong>${args.due_date ? `, due <strong>${dateStr(args.due_date)}</strong>` : ''}.
    </p>
    <p style="margin:0 0 14px;color:${BRAND.muted};font-size:13px;">Reply to this email to arrange payment or with any questions.</p>
    <p style="margin:0 0 4px;">Thanks,</p>
    <p style="margin:0;">— ${BRAND.name}</p>
  `;
  return {
    subject: `Invoice ${args.invoice_number} — ${money(args.total)}`,
    html: shell(inner, preheader),
    text: `${greeting}\n\nInvoice ${args.invoice_number} — ${money(args.total)}${args.due_date ? `, due ${dateStr(args.due_date)}` : ''}.\n\n— ${BRAND.name}`,
  };
}
