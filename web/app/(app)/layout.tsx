'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', adminOnly: false },
  { href: '/stations', label: 'Game PCs', adminOnly: false },
  { href: '/vouchers/generate', label: 'Generate', adminOnly: false },
  { href: '/vouchers', label: 'Vouchers', adminOnly: false },
  { href: '/users', label: 'Users', adminOnly: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-slate-400">Loading…</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <Link href="/dashboard" className="text-lg font-bold text-emerald-400">
            WowBingo<span className="text-slate-200"> Vouchers</span>
          </Link>
          <nav className="flex flex-1 flex-wrap gap-1">
            {NAV.filter((n) => !n.adminOnly || isAdmin).map((n) => {
              const active = pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href) && n.href !== '/vouchers/generate') || (n.href === '/vouchers' && pathname === '/vouchers');
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    active ? 'bg-emerald-600/20 text-emerald-400' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-200">{user.name}</p>
              <p className="text-xs text-slate-500">{user.role}</p>
            </div>
            <button onClick={logout} className="btn-secondary !px-3 !py-1.5 text-xs">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
