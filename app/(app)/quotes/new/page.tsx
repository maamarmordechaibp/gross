import { redirect } from 'next/navigation';

// Quotes use the same builder as orders. The form has a "Save as Quote" button.
export default function NewQuotePage() {
  redirect('/orders/new?as=quote');
}
