'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { get, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { StatusBadge } from '@/components/StatusBadge';
import { SearchIcon, DownloadIcon, CopyIcon, CheckIcon, HistoryIcon } from '@/components/icons';
import type { Station, User, Voucher, VoucherPage, ValidationResult } from '@/lib/types';

export default function VouchersPage() {
  return (
    <Suspense>
      <VouchersInner />
    </Suspense>
  );
}

function VouchersInner() {
  const { isAdmin } = useAuth();
  const searchParams = useSearchParams();
  const [stations, setStations] = useState<Station[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [data, setData] = useState<VoucherPage | null>(null);
  const [stationId, setStationId] = useState(searchParams.get('stationId') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [agentId, setAgentId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [vCode, setVCode] = useState('');
  const [vUuid, setVUuid] = useState('');
  const [vResult, setVResult] = useState<ValidationResult | null>(null);
  const [vBusy, setVBusy] = useState(false);
  const [vOpen, setVOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (stationId) params.set('stationId', stationId);
    if (status) params.set('status', status);
    if (agentId) params.set('issuedById', agentId);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (q) params.set('q', q);
    get<VoucherPage>(`/vouchers?${params.toString()}`)
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e) => setError(e?.message || 'Failed to load vouchers'))
      .finally(() => setLoading(false));
  }, [page, stationId, status, agentId, from, to, q]);

  useEffect(() => {
    get<Station[]>('/stations').then(setStations).catch(() => {});
    if (isAdmin) get<User[]>('/users').then(setAgents).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(load, [load]);

  function bumpFilter(fn: () => void) {
    fn();
    setPage(1);
  }

  async function validate(e: React.FormEvent) {
    e.preventDefault();
    setVBusy(true);
    setVResult(null);
    try {
      setVResult(await post<ValidationResult>('/vouchers/validate', { code: vCode, uuid: vUuid || undefined }));
    } catch (err: any) {
      setVResult({ valid: false, message: err?.message || 'Validation failed' });
    } finally {
      setVBusy(false);
    }
  }

  async function markRedeemed(id: string) {
    if (!window.confirm('Mark this voucher as redeemed?')) return;
    try {
      await post(`/vouchers/${id}/redeem`);
      load();
    } catch (err: any) {
      window.alert(err?.message || 'Failed');
    }
  }

  async function revoke(id: string) {
    if (!window.confirm('Revoke this voucher? It can no longer be redeemed in-game.')) return;
    try {
      await post(`/vouchers/${id}/revoke`);
      load();
    } catch (err: any) {
      window.alert(err?.message || 'Failed');
    }
  }

  function copyCode(v: Voucher) {
    navigator.clipboard.writeText(v.formattedCode);
    setCopiedId(v.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function exportCsv() {
    const rows: Voucher[] = [];
    for (let p = 1; p <= 50; p++) {
      const params = new URLSearchParams({ page: String(p), pageSize: '100' });
      if (stationId) params.set('stationId', stationId);
      if (status) params.set('status', status);
      if (agentId) params.set('issuedById', agentId);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (q) params.set('q', q);
      const d = await get<VoucherPage>(`/vouchers?${params.toString()}`);
      rows.push(...d.items);
      if (p >= d.pageCount) break;
    }
    const esc = (s: string | number | null) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const csv = [
      'Code,PC,Owner,UUID,Amount,Share %,Issued By,Generated At,Redeemed At,Expires,Status,Note',
      ...rows.map((v) =>
        [
          v.formattedCode,
          v.station.label,
          v.station.ownerName,
          v.station.uuid,
          v.amount,
          v.share,
          v.issuedBy?.name || '',
          new Date(v.createdAt).toISOString(),
          v.redeemedAt ? new Date(v.redeemedAt).toISOString() : '',
          v.expiresAt ? new Date(v.expiresAt).toISOString().slice(0, 10) : 'never',
          v.effectiveStatus,
          v.note || '',
        ]
          .map(esc)
          .join(','),
      ),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `recharge-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasFilters = !!(stationId || status || agentId || from || to || q);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Recharge History</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Every voucher: who issued it, for which PC, when, and how much
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setVOpen((o) => !o)}>
            <SearchIcon className="h-4 w-4" />
            Validate code
          </button>
          <button className="btn-secondary" onClick={exportCsv}>
            <DownloadIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {vOpen && (
        <div className="card animate-scale-in space-y-4">
          <h2 className="text-base font-semibold text-white">Validate a code</h2>
          <form onSubmit={validate} className="grid gap-3 md:grid-cols-[2fr_2fr_auto]">
            <input
              className="input font-mono"
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XX"
              value={vCode}
              onChange={(e) => setVCode(e.target.value)}
              required
              minLength={10}
            />
            <input
              className="input font-mono text-xs"
              placeholder="Machine UUID (optional)"
              value={vUuid}
              onChange={(e) => setVUuid(e.target.value)}
            />
            <button className="btn-primary" disabled={vBusy}>
              {vBusy ? 'Checking…' : 'Validate'}
            </button>
          </form>
          {vResult && (
            <div
              className={`animate-scale-in rounded-xl px-4 py-3 text-sm ring-1 ring-inset ${
                vResult.valid
                  ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20'
                  : 'bg-red-500/10 text-red-300 ring-red-500/20'
              }`}
            >
              <p className="font-semibold">
                {vResult.valid ? '✓ Valid code' : '✕ Invalid code'} — {vResult.message}
              </p>
              {vResult.valid && (
                <p className="mt-1 text-xs">
                  {vResult.amount?.toLocaleString()} credits · share {vResult.share}% ·{' '}
                  {vResult.expiry
                    ? `expires ${new Date(vResult.expiry * 1000).toLocaleDateString()}`
                    : 'never expires'}
                  {vResult.dbRecord &&
                    ` · status: ${vResult.dbRecord.status} · PC: ${vResult.dbRecord.station.label} (${vResult.dbRecord.station.ownerName}) · issued by ${vResult.dbRecord.issuedBy || '—'}`}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="card animate-fade-up space-y-3 !p-4" style={{ animationDelay: '0.05s' }}>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            className="input !pl-9"
            placeholder="Search code, PC name, owner, or note…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div>
            <label className="label">Game PC</label>
            <select className="input" value={stationId} onChange={(e) => bumpFilter(() => setStationId(e.target.value))}>
              <option value="">All PCs</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={status} onChange={(e) => bumpFilter(() => setStatus(e.target.value))}>
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRED">Expired</option>
              <option value="REDEEMED">Redeemed</option>
              <option value="REVOKED">Revoked</option>
            </select>
          </div>
          {isAdmin && (
            <div>
              <label className="label">Issued by</label>
              <select className="input" value={agentId} onChange={(e) => bumpFilter(() => setAgentId(e.target.value))}>
                <option value="">All agents</option>
                {agents.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">From</label>
            <input type="date" className="input" value={from} onChange={(e) => bumpFilter(() => setFrom(e.target.value))} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={to} onChange={(e) => bumpFilter(() => setTo(e.target.value))} />
          </div>
        </div>
        {hasFilters && (
          <button
            className="text-xs font-semibold text-slate-400 transition hover:text-emerald-400"
            onClick={() =>
              bumpFilter(() => {
                setStationId('');
                setStatus('');
                setAgentId('');
                setFrom('');
                setTo('');
                setQ('');
                setQInput('');
              })
            }
          >
            ✕ Clear all filters
          </button>
        )}
      </div>

      {error && (
        <p className="animate-scale-in rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-500/20">
          {error}
        </p>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="card space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-12" />
          ))}
        </div>
      )}

      {!loading && data && data.items.length === 0 && (
        <div className="card animate-scale-in flex flex-col items-center gap-3 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04]">
            <HistoryIcon className="h-7 w-7 text-slate-500" />
          </span>
          <p className="text-sm text-slate-400">No recharges match these filters.</p>
        </div>
      )}

      {/* Mobile cards */}
      {data && data.items.length > 0 && (
        <>
          <ul className="stagger space-y-3 md:hidden">
            {data.items.map((v) => (
              <li key={v.id} className="card !p-4">
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() => copyCode(v)}
                    className="flex min-w-0 items-center gap-2 font-mono text-xs font-bold tracking-wider text-emerald-300"
                  >
                    <span className="truncate">{v.formattedCode}</span>
                    {copiedId === v.id ? (
                      <CheckIcon className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    ) : (
                      <CopyIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    )}
                  </button>
                  <StatusBadge status={v.effectiveStatus} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div>
                    <p className="text-slate-500">PC</p>
                    <Link href={`/stations/${v.station.id}`} className="font-semibold text-slate-200 hover:text-emerald-300">
                      {v.station.label}
                    </Link>
                  </div>
                  <div>
                    <p className="text-slate-500">Amount</p>
                    <p className="font-bold text-amber-300">{v.amount.toLocaleString()} cr · {v.share}%</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Issued by</p>
                    <p className="font-medium text-slate-300">{v.issuedBy?.name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Generated</p>
                    <p className="text-slate-300">{new Date(v.createdAt).toLocaleString()}</p>
                  </div>
                  {v.redeemedAt && (
                    <div className="col-span-2">
                      <p className="text-slate-500">Redeemed</p>
                      <p className="text-sky-300">{new Date(v.redeemedAt).toLocaleString()}</p>
                    </div>
                  )}
                </div>
                {v.effectiveStatus === 'ACTIVE' && (
                  <div className="mt-3 flex gap-2 border-t border-white/[0.06] pt-3">
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
          <div className="card hidden !p-0 md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">PC / Owner</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Generated</th>
                    <th className="px-4 py-3">Redeemed</th>
                    <th className="px-4 py-3">Expires</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Issued by</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((v) => (
                    <tr key={v.id} className="border-b border-white/[0.04] align-top transition-colors hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => copyCode(v)}
                          className="flex items-center gap-1.5 font-mono text-xs text-emerald-300 hover:text-emerald-200"
                        >
                          {v.formattedCode}
                          {copiedId === v.id ? (
                            <CheckIcon className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <CopyIcon className="h-3 w-3 text-slate-600" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/stations/${v.station.id}`} className="hover:text-emerald-300">
                          {v.station.label}
                        </Link>
                        <div className="text-xs text-slate-500">
                          {v.station.ownerName}
                          {v.station.phone ? ` · ${v.station.phone}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold text-amber-300">
                        {v.amount.toLocaleString()}
                        <span className="ml-1 text-[11px] font-medium text-slate-500">/ {v.share}%</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{new Date(v.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs">
                        {v.redeemedAt ? (
                          <span className="text-sky-300">{new Date(v.redeemedAt).toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {v.expiresAt ? new Date(v.expiresAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={v.effectiveStatus} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{v.issuedBy?.name || '—'}</td>
                      <td className="px-4 py-3">
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
          </div>

          {/* Pagination */}
          {data.pageCount > 1 && (
            <div className="flex items-center justify-between text-sm animate-fade-up">
              <button className="btn-secondary !px-4" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ← Prev
              </button>
              <span className="text-xs text-slate-500">
                Page {data.page} of {data.pageCount} · {data.total.toLocaleString()} records
              </span>
              <button className="btn-secondary !px-4" disabled={page >= data.pageCount} onClick={() => setPage((p) => p + 1)}>
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
