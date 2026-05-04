import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/permissions';

export default async function RootIndexPage() {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');
  redirect('/login');
}
