'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { get, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { StatusBadge } from '@/components/StatusBadge';
import type { Station, Voucher, VoucherPage, ValidationResult } from '@/lib/types';

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
  const [data, setData] = useState<VoucherPage | null>(null);
  const [stationId, setStationId] = useState(searchParams.get('stationId') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  const [vCode, setVCode] = useState('');
  const [vUuid, setVUuid] = useState('');
  const [vResult, setVResult] = useState<ValidationResult | null>(null);
  const [vBusy, setVBusy] = useState(false);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (stationId) params.set('stationId', stationId);
    if (status) params.set('status', status);
    get<VoucherPage>(`/vouchers?${params.toString()}`)
      .then(setData)
      .catch((e) => setError(e?.message || 'Failed to load vouchers'));
  }, [page, stationId, status]);

  useEffect(() => {
    get<Station[]>('/stations').then(setStations).catch(() => {});
  }, []);
  useEffect(load, [load]);

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
    if (!window.confirm('Revoke this voucher? It will no longer be redeemable in-game tracking terms and marked dead.')) return;
    try {
      await post(`/vouchers/${id}/revoke`);
      load();
    } catch (err: any) {
      window.alert(err?.message || 'Failed');
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Vouchers</h1>

      <div className="card space-y-4">
        <h2 className="text-lg font-semibold">Validate a code</h2>
        <form onSubmit={validate} className="grid gap-3 md:grid-cols-[2fr_2fr_auto]">
          <input className="input font-mono" placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XX" value={vCode} onChange={(e) => setVCode(e.target.value)} required minLength={10} />
          <input className="input font-mono text-xs" placeholder="Machine UUID (optional)" value={vUuid} onChange={(e) => setVUuid(e.target.value)} />
          <button className="btn-primary" disabled={vBusy}>{vBusy ? 'Checking…' : 'Validate'}</button>
        </form>
        {vResult && (
          <div className={`rounded-xl px-4 py-3 text-sm ${vResult.valid ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
            <p className="font-semibold">{vResult.valid ? 'Valid code' : 'Invalid code'} — {vResult.message}</p>
            {vResult.valid && (
              <p className="mt-1 text-xs">
                {vResult.amount?.toLocaleString()} credits · share {vResult.share}% ·{' '}
                {vResult.expiry ? `expires ${new Date(vResult.expiry * 1000).toLocaleDateString()}` : 'never expires'}
                {vResult.dbRecord && ` · web status: ${vResult.dbRecord.status} · PC: ${vResult.dbRecord.station.label} (${vResult.dbRecord.station.ownerName})`}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Game PC</label>
          <select className="input !w-56" value={stationId} onChange={(e) => { setStationId(e.target.value); setPage(1); }}>
            <option value="">All PCs</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input !w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
            <option value="REDEEMED">Redeemed</option>
            <option value="REVOKED">Revoked</option>
          </select>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      <div className="card overflow-x-auto">
        {!data || data.items.length === 0 ? (
          <p className="text-sm text-slate-400">No vouchers found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-4">Code</th>
                <th className="py-2 pr-4">PC / Owner</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Generated</th>
                <th className="py-2 pr-4">Redeemed</th>
                <th className="py-2 pr-4">Expires</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Issued</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((v) => (
                <tr key={v.id} className="border-b border-slate-800/50 align-top">
                  <td className="py-2 pr-4 font-mono text-xs text-emerald-300">{v.formattedCode}</td>
                  <td className="py-2 pr-4 font-medium">
                    <Link href={`/stations/${v.station.id}`} className="hover:underline">
                      {v.station.label}
                    </Link>
                    <div className="text-xs text-slate-500">{v.station.ownerName}{v.station.phone ? ` · ${v.station.phone}` : ''}</div>
                  </td>
                  <td className="py-2 pr-4 font-semibold">{v.amount.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-xs">{new Date(v.createdAt).toLocaleString()}</td>
                  <td className="py-2 pr-4 text-xs">
                    {v.redeemedAt ? new Date(v.redeemedAt).toLocaleString() : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="py-2 pr-4 text-xs">{v.expiresAt ? new Date(v.expiresAt).toLocaleDateString() : 'Never'}</td>
                  <td className="py-2 pr-4"><StatusBadge status={v.effectiveStatus} /></td>
                  <td className="py-2 pr-4 text-xs text-slate-400">{v.issuedBy?.name}</td>
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
