'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { get } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
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

  const cards = stats
    ? [
        { label: 'Game PCs', value: stats.stations, href: '/stations' },
        { label: 'Vouchers issued', value: stats.vouchersTotal, href: '/vouchers' },
        { label: 'Credits issued', value: stats.creditsIssued, href: '/vouchers' },
        { label: 'Active vouchers', value: stats.vouchersActive, href: '/vouchers?status=ACTIVE' },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/vouchers/generate" className="btn-primary">+ Generate vouchers</Link>
      </div>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card transition hover:border-emerald-600/50">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{c.label}</p>
            <p className="mt-2 text-3xl font-bold text-emerald-400">{c.value.toLocaleString()}</p>
          </Link>
        ))}
      </div>

      <div className="card">
        <h2 className="mb-3 text-lg font-semibold">Recent vouchers</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-400">No vouchers yet. Generate your first batch.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-4">Code</th>
                  <th className="py-2 pr-4">PC</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Issued</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((v) => (
                  <tr key={v.id} className="border-b border-slate-800/50">
                    <td className="py-2 pr-4 font-mono text-xs text-emerald-300">{v.formattedCode}</td>
                    <td className="py-2 pr-4">{v.station.label}</td>
                    <td className="py-2 pr-4 font-semibold">{v.amount.toLocaleString()}</td>
                    <td className="py-2 pr-4"><StatusBadge status={v.effectiveStatus} /></td>
                    <td className="py-2 text-xs text-slate-400">{new Date(v.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
