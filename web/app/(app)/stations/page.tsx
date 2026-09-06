'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { get, post, patch, del } from '@/lib/api';
import { useAuth } from '@/lib/auth';
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Game PCs</h1>
        <button className="btn-primary" onClick={() => setForm({ ...EMPTY })}>+ Register PC</button>
      </div>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      {form && (
        <form onSubmit={submit} className="card space-y-4">
          <h2 className="text-lg font-semibold">{form.id ? 'Edit game PC' : 'Register game PC'}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Machine UUID</label>
              <input className="input font-mono text-xs" value={form.uuid} onChange={(e) => setForm({ ...form, uuid: e.target.value })} required minLength={4} placeholder="4C4C4544-0046-4810-8035-B9C04F575A31" />
              <p className="mt-1 text-xs text-slate-500">Run get_machine_uuid.py on the game PC to get this.</p>
            </div>
            <div>
              <label className="label">Station name</label>
              <input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required minLength={2} placeholder="e.g. Downtown cafe — PC 1" />
            </div>
            <div>
              <label className="label">Owner full name</label>
              <input className="input" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} required minLength={2} />
            </div>
            <div>
              <label className="label">Contact phone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+251…" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Address</label>
              <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="City, sub-city, landmark…" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Notes</label>
              <textarea className="input min-h-[60px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" className="btn-secondary" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto">
        {stations.length === 0 ? (
          <p className="text-sm text-slate-400">No game PCs registered yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-4">Station</th>
                <th className="py-2 pr-4">Owner</th>
                <th className="py-2 pr-4">Contact</th>
                <th className="py-2 pr-4">Machine UUID</th>
                <th className="py-2 pr-4">Vouchers</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stations.map((s) => (
                <tr key={s.id} className="border-b border-slate-800/50 align-top hover:bg-slate-800/30">
                  <td className="py-2 pr-4 font-medium">
                    <Link href={`/stations/${s.id}`} className="text-emerald-400 hover:underline">
                      {s.label}
                    </Link>
                    <div className="text-xs text-slate-500">View history →</div>
                  </td>
                  <td className="py-2 pr-4">{s.ownerName}</td>
                  <td className="py-2 pr-4">
                    <div>{s.phone || '—'}</div>
                    <div className="text-xs text-slate-500">{s.address || ''}</div>
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs text-slate-400">{s.uuid}</td>
                  <td className="py-2 pr-4">{s.voucherCount}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button
                        className="btn-secondary !px-2 !py-1 text-xs"
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
                        <button className="btn-danger !px-2 !py-1 text-xs" onClick={() => remove(s.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
