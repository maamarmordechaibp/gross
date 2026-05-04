import { Sidebar } from '@/components/app/sidebar';
import { Topbar } from '@/components/app/topbar';
import { requireUser } from '@/lib/permissions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar user={{ full_name: profile.full_name, role: profile.role }} />
        <main className="flex-1 overflow-x-hidden">
          <div className="container mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
