'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth-helpers';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace(getToken() ? '/dashboard' : '/login');
  }, [router]);
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-slate-400">Loading…</p>
    </main>
  );
}
