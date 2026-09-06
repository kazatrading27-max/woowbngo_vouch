'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { get } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { CountUp } from '@/components/CountUp';
import { MonitorIcon, CoinIcon, ShieldIcon, BoltIcon } from '@/components/icons';
import type { Stats, Voucher } from '@/lib/types';

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Voucher[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([get<Stats>('/vouchers/stats'), get<{ items: Voucher[] }>('/vouchers?pageSize=8')])
      .then(([s, v]) => {
        setStats(s);
        setRecent(v.items);
      })
      .catch((e) => setError(e?.message || 'Failed to load dashboard'));
  }, []);

  const redeemedRate =
    stats && stats.vouchersTotal > 0
      ? Math.round((stats.vouchersRedeemed / stats.vouchersTotal) * 100)
      : 0;

  const cards = stats
    ? [
        {
          label: 'Game PCs',
          value: stats.stations,
          href: '/stations',
          Icon: MonitorIcon,
          tone: 'from-sky-500/20 to-sky-500/[0.03] text-sky-300',
        },
        {
          label: 'Vouchers issued',
          value: stats.vouchersTotal,
          href: '/vouchers',
          Icon: BoltIcon,
          tone: 'from-emerald-500/20 to-emerald-500/[0.03] text-emerald-300',
        },
        {
          label: 'Credits issued',
          value: stats.creditsIssued,
          href: '/vouchers',
          Icon: CoinIcon,
          tone: 'from-amber-500/20 to-amber-500/[0.03] text-amber-300',
        },
        {
          label: 'Active vouchers',
          value: stats.vouchersActive,
          href: '/vouchers?status=ACTIVE',
          Icon: ShieldIcon,
          tone: 'from-violet-500/20 to-violet-500/[0.03] text-violet-300',
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-400">Live overview of your voucher operation</p>
        </div>
        <Link href="/vouchers/generate" className="btn-primary">
          <BoltIcon className="h-4 w-4" />
          Generate vouchers
        </Link>
      </div>

      {error && (
        <p className="animate-scale-in rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-500/20">
          {error}
        </p>
      )}

      <div className="stagger grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className={`card card-hover group relative overflow-hidden bg-gradient-to-br ${c.tone}`}>
            <c.Icon className="absolute -right-3 -top-3 h-20 w-20 opacity-10 transition-transform duration-300 group-hover:scale-110" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{c.label}</p>
            <p className="mt-2 text-2xl font-extrabold tracking-tight text-white md:text-3xl">
              <CountUp value={c.value} />
            </p>
          </Link>
        ))}
      </div>

      {stats && (
        <div className="card animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between text-sm">
            <p className="font-semibold text-slate-200">Redemption rate</p>
            <p className="font-bold text-emerald-300">{redeemedRate}%</p>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.5)] transition-all duration-1000 ease-out"
              style={{ width: `${Math.max(redeemedRate, 2)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-slate-500">
            <span>{stats.vouchersRedeemed.toLocaleString()} redeemed</span>
            <span>{stats.vouchersTotal.toLocaleString()} total issued</span>
          </div>
        </div>
      )}

      <div className="card animate-fade-up" style={{ animationDelay: '0.28s' }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Recent recharges</h2>
          <Link href="/vouchers" className="text-xs font-semibold text-emerald-400 transition hover:text-emerald-300">
            View all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] text-2xl">🎟️</span>
            <p className="text-sm text-slate-400">No vouchers yet. Generate your first batch.</p>
          </div>
        ) : (
          <ul className="stagger divide-y divide-white/[0.06]">
            {recent.map((v) => (
              <li key={v.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300 sm:flex">
                  <CoinIcon className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs font-semibold tracking-wider text-emerald-300">
                    {v.formattedCode}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {v.station.label} · {v.amount.toLocaleString()} credits · {v.issuedBy?.name || '—'}
                  </p>
                </div>
                <div className="hidden text-right text-[11px] text-slate-500 sm:block">
                  {new Date(v.createdAt).toLocaleString()}
                </div>
                <StatusBadge status={v.effectiveStatus} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
