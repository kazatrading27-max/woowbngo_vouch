'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
  HomeIcon,
  MonitorIcon,
  BoltIcon,
  HistoryIcon,
  UsersIcon,
  LogoutIcon,
  ShieldIcon,
} from '@/components/icons';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', short: 'Home', Icon: HomeIcon, adminOnly: false, mobileHidden: false },
  { href: '/stations', label: 'Game PCs', short: 'PCs', Icon: MonitorIcon, adminOnly: false, mobileHidden: false },
  { href: '/vouchers/generate', label: 'Generate', short: 'Generate', Icon: BoltIcon, adminOnly: false, mobileHidden: false },
  { href: '/vouchers', label: 'Recharge History', short: 'History', Icon: HistoryIcon, adminOnly: false, mobileHidden: false },
  { href: '/security', label: 'Security', short: 'Security', Icon: ShieldIcon, adminOnly: false, mobileHidden: true },
  { href: '/users', label: 'Users', short: 'Users', Icon: UsersIcon, adminOnly: true, mobileHidden: false },
];

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  if (href === '/vouchers/generate') return pathname.startsWith('/vouchers/generate');
  if (href === '/vouchers') return pathname === '/vouchers';
  return pathname.startsWith(href);
}

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
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400" />
          <p className="text-sm text-slate-400">Loading…</p>
        </div>
      </main>
    );
  }

  const items = NAV.filter((n) => !n.adminOnly || isAdmin);

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-white/[0.08] bg-slate-950/80 backdrop-blur-xl md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-sm font-black text-white shadow-lg shadow-emerald-600/30">
            W
          </span>
          <div>
            <p className="text-sm font-bold leading-tight text-white">WowBingo</p>
            <p className="text-[11px] font-medium leading-tight text-emerald-400">Voucher Console</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {items.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-emerald-500/15 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]'
                    : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100'
                }`}
              >
                <Icon className={`h-5 w-5 transition-transform duration-200 group-hover:scale-110 ${active ? 'text-emerald-400' : ''}`} />
                {label}
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/[0.08] p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-sm font-bold text-emerald-300 ring-1 ring-white/10">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-200">{user.name}</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{user.role.replace('_', ' ')}</p>
            </div>
            <button onClick={logout} title="Sign out" className="btn-ghost !p-2">
              <LogoutIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="glass-bar sticky top-0 z-40 flex items-center justify-between border-b px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 text-xs font-black text-white">
            W
          </span>
          <span className="text-base font-bold text-white">
            Wow<span className="text-emerald-400">Bingo</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/security" title="Security — biometric login">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-xs font-bold text-emerald-300 ring-1 ring-white/10">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
          </Link>
          <button onClick={logout} className="btn-ghost !p-2">
            <LogoutIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="px-4 pb-28 pt-4 md:pb-10 md:pl-[16.5rem] md:pr-6 md:pt-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      {/* Mobile bottom navigation */}
      <nav
        className="glass-bar fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Primary"
      >
        {items
          .filter((n) => !n.mobileHidden)
          .map(({ href, short, Icon }) => {
          const active = isActive(pathname, href);
          const center = href === '/vouchers/generate';
          return (
            <Link
              key={href}
              href={href}
              className="relative flex min-w-[4rem] flex-1 flex-col items-center gap-0.5 px-1 pb-2 pt-2.5"
            >
              {center ? (
                <span
                  className={`-mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-600/40 transition-transform duration-200 ${
                    active ? 'scale-110' : 'scale-100'
                  }`}
                >
                  <Icon className="h-6 w-6" />
                </span>
              ) : (
                <Icon
                  className={`h-6 w-6 transition-all duration-200 ${active ? 'scale-110 text-emerald-400' : 'text-slate-500'}`}
                />
              )}
              <span
                className={`text-[10px] font-semibold transition-colors duration-200 ${
                  active ? 'text-emerald-300' : 'text-slate-500'
                }`}
              >
                {short}
              </span>
              {active && !center && (
                <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-emerald-400" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
