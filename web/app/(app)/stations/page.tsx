'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { get, post, patch, del } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PlusIcon, MonitorIcon } from '@/components/icons';
import type { Station } from '@/lib/types';

interface FormState {
  id?: string;
  uuid: string;
  label: string;
  ownerName: string;
  phone: string;
  address: string;
  notes: string;
}

const EMPTY: FormState = { uuid: '', label: '', ownerName: '', phone: '', address: '', notes: '' };

export default function StationsPage() {
  const { isAdmin } = useAuth();
  const [stations, setStations] = useState<Station[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    get<Station[]>('/stations')
      .then(setStations)
      .catch((e) => setError(e?.message || 'Failed to load stations'));
  }, []);

  useEffect(load, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError('');
    const payload = {
      uuid: form.uuid,
      label: form.label,
      ownerName: form.ownerName,
      phone: form.phone,
      address: form.address,
      notes: form.notes,
    };
    try {
      if (form.id) await patch(`/stations/${form.id}`, payload);
      else await post('/stations', payload);
      setForm(null);
      load();
    } catch (err: any) {
      setError(err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this game PC? Only possible when it has no vouchers.')) return;
    try {
      await del(`/stations/${id}`);
      load();
    } catch (err: any) {
      window.alert(err?.message || 'Delete failed');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Game PCs</h1>
          <p className="mt-0.5 text-sm text-slate-400">Registered machines and their owners</p>
        </div>
        <button className="btn-primary" onClick={() => setForm({ ...EMPTY })}>
          <PlusIcon className="h-4 w-4" />
          Register PC
        </button>
      </div>

      {error && (
        <p className="animate-scale-in rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-500/20">
          {error}
        </p>
      )}

      {form && (
        <form onSubmit={submit} className="card animate-scale-in space-y-4">
          <h2 className="text-base font-semibold text-white">{form.id ? 'Edit game PC' : 'Register game PC'}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Machine UUID</label>
              <input
                className="input font-mono text-xs"
                value={form.uuid}
                onChange={(e) => setForm({ ...form, uuid: e.target.value })}
                required
                minLength={4}
                placeholder="4C4C4544-0046-4810-8035-B9C04F575A31"
              />
              <p className="mt-1 text-xs text-slate-500">Run get_machine_uuid.py on the game PC to get this.</p>
            </div>
            <div>
              <label className="label">Station name</label>
              <input
                className="input"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                required
                minLength={2}
                placeholder="e.g. Downtown cafe — PC 1"
              />
            </div>
            <div>
              <label className="label">Owner full name</label>
              <input
                className="input"
                value={form.ownerName}
                onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                required
                minLength={2}
              />
            </div>
            <div>
              <label className="label">Contact phone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+251…" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Address</label>
              <input
                className="input"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="City, sub-city, landmark…"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Notes</label>
              <textarea className="input min-h-[60px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setForm(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {stations.length === 0 ? (
        <div className="card animate-scale-in flex flex-col items-center gap-3 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04]">
            <MonitorIcon className="h-7 w-7 text-slate-500" />
          </span>
          <p className="text-sm text-slate-400">No game PCs registered yet.</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <ul className="stagger space-y-3 md:hidden">
            {stations.map((s) => (
              <li key={s.id} className="card !p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/stations/${s.id}`} className="min-w-0">
                    <p className="truncate font-semibold text-emerald-300">{s.label}</p>
                    <p className="truncate text-xs text-slate-400">{s.ownerName}</p>
                  </Link>
                  <span className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold text-slate-300">
                    {s.voucherCount} 🎟
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-xs text-slate-500">
                  <p className="truncate font-mono">{s.uuid}</p>
                  {s.phone && <p>{s.phone}{s.address ? ` · ${s.address}` : ''}</p>}
                </div>
                <div className="mt-3 flex gap-2 border-t border-white/[0.06] pt-3">
                  <Link href={`/stations/${s.id}`} className="btn-secondary flex-1 !py-1.5 text-xs">
                    History
                  </Link>
                  <button
                    className="btn-secondary flex-1 !py-1.5 text-xs"
                    onClick={() =>
                      setForm({
                        id: s.id,
                        uuid: s.uuid,
                        label: s.label,
                        ownerName: s.ownerName,
                        phone: s.phone || '',
                        address: s.address || '',
                        notes: s.notes || '',
                      })
                    }
                  >
                    Edit
                  </button>
                  {isAdmin && (
                    <button className="btn-danger flex-1 !py-1.5 text-xs" onClick={() => remove(s.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="card hidden !p-0 md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Station</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Machine UUID</th>
                    <th className="px-4 py-3">Vouchers</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stations.map((s) => (
                    <tr key={s.id} className="border-b border-white/[0.04] align-top transition-colors hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/stations/${s.id}`} className="text-emerald-300 hover:text-emerald-200">
                          {s.label}
                        </Link>
                        <div className="text-xs text-slate-500">View history →</div>
                      </td>
                      <td className="px-4 py-3">{s.ownerName}</td>
                      <td className="px-4 py-3">
                        <div>{s.phone || '—'}</div>
                        <div className="text-xs text-slate-500">{s.address || ''}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">{s.uuid}</td>
                      <td className="px-4 py-3 font-semibold text-amber-300">{s.voucherCount}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            className="btn-secondary !px-2.5 !py-1 text-xs"
                            onClick={() =>
                              setForm({
                                id: s.id,
                                uuid: s.uuid,
                                label: s.label,
                                ownerName: s.ownerName,
                                phone: s.phone || '',
                                address: s.address || '',
                                notes: s.notes || '',
                              })
                            }
                          >
                            Edit
                          </button>
                          {isAdmin && (
                            <button className="btn-danger !px-2.5 !py-1 text-xs" onClick={() => remove(s.id)}>
                              Delete
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
        </>
      )}
    </div>
  );
}
