'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { get, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { StatusBadge } from '@/components/StatusBadge';
import type { Station, Stats, Voucher, VoucherPage } from '@/lib/types';

export default function StationDetailPage() {
  const { isAdmin } = useAuth();
  const params = useParams<{ id: string }>();
  const stationId = params.id;

  const [station, setStation] = useState<Station | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [data, setData] = useState<VoucherPage | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    Promise.all([
      get<Station[]>(`/stations`).then((all) => all.find((s) => s.id === stationId) || null),
      get<Stats>(`/vouchers/stats?stationId=${encodeURIComponent(stationId)}`),
      get<VoucherPage>(`/vouchers?stationId=${encodeURIComponent(stationId)}&page=${page}&pageSize=20`),
    ])
      .then(([s, st, v]) => {
        setStation(s);
        setStats(st);
        setData(v);
      })
      .catch((e) => setError(e?.message || 'Failed to load history'));
  }, [stationId, page]);

  useEffect(load, [load]);

  async function markRedeemed(id: string) {
    if (!window.confirm('Mark this voucher as redeemed (recharged on the game PC)?')) return;
    try {
      await post(`/vouchers/${id}/redeem`);
      load();
    } catch (err: any) {
      window.alert(err?.message || 'Failed');
    }
  }

  async function revoke(id: string) {
    if (!window.confirm('Revoke this voucher?')) return;
    try {
      await post(`/vouchers/${id}/revoke`);
      load();
    } catch (err: any) {
      window.alert(err?.message || 'Failed');
    }
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/stations" className="text-sm text-emerald-400 hover:underline">← All game PCs</Link>
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/stations" className="inline-block text-sm text-emerald-400 hover:underline">← All game PCs</Link>

      {station && (
        <div className="card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{station.label}</h1>
              <p className="mt-1 text-sm text-slate-300">
                {station.ownerName}
                {station.phone ? ` · ${station.phone}` : ''}
                {station.address ? ` · ${station.address}` : ''}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-500">UUID: {station.uuid}</p>
              {station.notes && <p className="mt-2 text-xs text-slate-400">{station.notes}</p>}
            </div>
            <Link href={`/vouchers/generate?stationId=${station.id}`} className="btn-primary">
              + Generate for this PC
            </Link>
          </div>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <div className="card">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Vouchers</p>
            <p className="mt-2 text-2xl font-bold">{stats.vouchersTotal}</p>
          </div>
          <div className="card">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Active</p>
            <p className="mt-2 text-2xl font-bold text-emerald-400">{stats.vouchersActive}</p>
          </div>
          <div className="card">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Redeemed</p>
            <p className="mt-2 text-2xl font-bold text-sky-400">{stats.vouchersRedeemed}</p>
          </div>
          <div className="card">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Expired / Revoked</p>
            <p className="mt-2 text-2xl font-bold text-amber-400">{stats.vouchersExpired + stats.vouchersRevoked}</p>
          </div>
          <div className="card">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Credits issued</p>
            <p className="mt-2 text-2xl font-bold">{stats.creditsIssued.toLocaleString()}</p>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <h2 className="mb-3 text-lg font-semibold">Voucher history</h2>
        {!data || data.items.length === 0 ? (
          <p className="text-sm text-slate-400">No vouchers for this game PC yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-4">Code</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Generated</th>
                <th className="py-2 pr-4">Redeemed</th>
                <th className="py-2 pr-4">Expires</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Issued by</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((v) => (
                <tr key={v.id} className="border-b border-slate-800/50 align-top">
                  <td className="py-2 pr-4 font-mono text-xs text-emerald-300">{v.formattedCode}</td>
                  <td className="py-2 pr-4 font-semibold">{v.amount.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-xs text-slate-400">{new Date(v.createdAt).toLocaleString()}</td>
                  <td className="py-2 pr-4 text-xs">
                    {v.redeemedAt ? (
                      <span className="text-sky-300">{new Date(v.redeemedAt).toLocaleString()}</span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-xs">{v.expiresAt ? new Date(v.expiresAt).toLocaleDateString() : 'Never'}</td>
                  <td className="py-2 pr-4"><StatusBadge status={v.effectiveStatus} /></td>
                  <td className="py-2 pr-4 text-xs text-slate-400">{v.issuedBy?.name || '—'}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      {v.effectiveStatus === 'ACTIVE' && (
                        <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => markRedeemed(v.id)}>
                          Mark redeemed
                        </button>
                      )}
                      {isAdmin && v.effectiveStatus === 'ACTIVE' && (
                        <button className="btn-danger !px-2 !py-1 text-xs" onClick={() => revoke(v.id)}>
                          Revoke
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && data.pageCount > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <button className="btn-secondary !px-3 !py-1" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
            <span className="text-slate-400">Page {data.page} of {data.pageCount} ({data.total} total)</span>
            <button className="btn-secondary !px-3 !py-1" disabled={page >= data.pageCount} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
