'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { get, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { StatusBadge } from '@/components/StatusBadge';
import { BackIcon, BoltIcon, CoinIcon, CopyIcon, CheckIcon } from '@/components/icons';
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
  const [copied, setCopied] = useState(false);

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

  function copyUuid() {
    if (!station) return;
    navigator.clipboard.writeText(station.uuid);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (error) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="animate-scale-in rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-500/20">
          {error}
        </p>
      </div>
    );
  }

  const statCards = stats
    ? [
        { label: 'Vouchers', value: stats.vouchersTotal, cls: 'text-white' },
        { label: 'Active', value: stats.vouchersActive, cls: 'text-emerald-300' },
        { label: 'Redeemed', value: stats.vouchersRedeemed, cls: 'text-sky-300' },
        { label: 'Expired/Revoked', value: stats.vouchersExpired + stats.vouchersRevoked, cls: 'text-amber-300' },
        { label: 'Credits issued', value: stats.creditsIssued, cls: 'text-amber-200' },
      ]
    : [];

  return (
    <div className="space-y-5">
      <BackLink />

      {station && (
        <div className="card animate-fade-up">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-white">{station.label}</h1>
              <p className="mt-1 text-sm text-slate-300">
                {station.ownerName}
                {station.phone ? ` · ${station.phone}` : ''}
                {station.address ? ` · ${station.address}` : ''}
              </p>
              <button onClick={copyUuid} className="mt-2 flex items-center gap-1.5 font-mono text-xs text-slate-500 transition hover:text-emerald-300">
                UUID: {station.uuid}
                {copied ? <CheckIcon className="h-3 w-3 text-emerald-400" /> : <CopyIcon className="h-3 w-3" />}
              </button>
              {station.notes && <p className="mt-2 text-xs text-slate-400">{station.notes}</p>}
            </div>
            <Link href={`/vouchers/generate?stationId=${station.id}`} className="btn-primary">
              <BoltIcon className="h-4 w-4" />
              Generate for this PC
            </Link>
          </div>
        </div>
      )}

      {stats && (
        <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {statCards.map((c) => (
            <div key={c.label} className="card !p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{c.label}</p>
              <p className={`mt-1.5 text-xl font-extrabold md:text-2xl ${c.cls}`}>
                {c.label === 'Credits issued' ? c.value.toLocaleString() : c.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="card animate-fade-up !p-0" style={{ animationDelay: '0.1s' }}>
        <h2 className="flex items-center gap-2 px-5 pt-5 text-base font-semibold text-white">
          <CoinIcon className="h-5 w-5 text-emerald-400" />
          Recharge history
        </h2>
        <div className="px-5 pb-5 pt-3">
          {!data || data.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No vouchers for this game PC yet.</p>
          ) : (
            <>
              {/* Mobile cards */}
              <ul className="stagger space-y-3 md:hidden">
                {data.items.map((v) => (
                  <li key={v.id} className="rounded-xl border border-white/[0.06] bg-slate-950/50 p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="break-all font-mono text-xs font-bold tracking-wider text-emerald-300">{v.formattedCode}</p>
                      <StatusBadge status={v.effectiveStatus} />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-slate-500">Amount</p>
                        <p className="font-bold text-amber-300">{v.amount.toLocaleString()} cr · {v.share}%</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Issued by</p>
                        <p className="text-slate-300">{v.issuedBy?.name || '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Generated</p>
                        <p className="text-slate-300">{new Date(v.createdAt).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Redeemed</p>
                        {v.redeemedAt ? (
                          <p className="text-sky-300">{new Date(v.redeemedAt).toLocaleString()}</p>
                        ) : (
                          <p className="text-slate-600">—</p>
                        )}
                      </div>
                    </div>
                    {v.effectiveStatus === 'ACTIVE' && (
                      <div className="mt-3 flex gap-2 border-t border-white/[0.06] pt-2.5">
                        <button className="btn-secondary flex-1 !py-1.5 text-xs" onClick={() => markRedeemed(v.id)}>
                          Mark redeemed
                        </button>
                        {isAdmin && (
                          <button className="btn-danger flex-1 !py-1.5 text-xs" onClick={() => revoke(v.id)}>
                            Revoke
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.08] text-left text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="py-3 pr-4">Code</th>
                      <th className="py-3 pr-4">Amount</th>
                      <th className="py-3 pr-4">Generated</th>
                      <th className="py-3 pr-4">Redeemed</th>
                      <th className="py-3 pr-4">Expires</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 pr-4">Issued by</th>
                      <th className="py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((v) => (
                      <tr key={v.id} className="border-b border-white/[0.04] align-top transition-colors hover:bg-white/[0.03]">
                        <td className="py-3 pr-4 font-mono text-xs text-emerald-300">{v.formattedCode}</td>
                        <td className="py-3 pr-4 font-bold text-amber-300">{v.amount.toLocaleString()}</td>
                        <td className="py-3 pr-4 text-xs text-slate-400">{new Date(v.createdAt).toLocaleString()}</td>
                        <td className="py-3 pr-4 text-xs">
                          {v.redeemedAt ? (
                            <span className="text-sky-300">{new Date(v.redeemedAt).toLocaleString()}</span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-xs text-slate-400">
                          {v.expiresAt ? new Date(v.expiresAt).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={v.effectiveStatus} />
                        </td>
                        <td className="py-3 pr-4 text-xs text-slate-400">{v.issuedBy?.name || '—'}</td>
                        <td className="py-3">
                          <div className="flex gap-2">
                            {v.effectiveStatus === 'ACTIVE' && (
                              <button className="btn-secondary !px-2.5 !py-1 text-xs" onClick={() => markRedeemed(v.id)}>
                                Redeem
                              </button>
                            )}
                            {isAdmin && v.effectiveStatus === 'ACTIVE' && (
                              <button className="btn-danger !px-2.5 !py-1 text-xs" onClick={() => revoke(v.id)}>
                                Revoke
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {data.pageCount > 1 && (
                <div className="mt-4 flex items-center justify-between text-sm">
                  <button className="btn-secondary !px-4" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    ← Prev
                  </button>
                  <span className="text-xs text-slate-500">
                    Page {data.page} of {data.pageCount} · {data.total} records
                  </span>
                  <button className="btn-secondary !px-4" disabled={page >= data.pageCount} onClick={() => setPage((p) => p + 1)}>
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/stations" className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-400 transition hover:text-emerald-300">
      <BackIcon className="h-4 w-4" />
      All game PCs
    </Link>
  );
}
