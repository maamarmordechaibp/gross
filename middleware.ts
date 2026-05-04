import { NextResponse, type NextRequest } from 'next/server';

// Auth enforced in server components / route layouts.
// Middleware kept minimal to avoid Edge-runtime issues with @supabase/ssr on Next 16.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
