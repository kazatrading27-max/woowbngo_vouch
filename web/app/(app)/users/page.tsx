'use client';

import { useCallback, useEffect, useState } from 'react';
import { get, post, patch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { User } from '@/lib/types';

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'AGENT' as 'ADMIN' | 'AGENT' });
  const [pwReset, setPwReset] = useState<{ [id: string]: string }>({});

  const load = useCallback(() => {
    get<User[]>('/users')
      .then(setUsers)
      .catch((e) => setError(e?.message || 'Failed to load users'));
  }, []);
  useEffect(load, [load]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await post('/users', form);
      setForm({ email: '', password: '', name: '', role: 'AGENT' });
      load();
    } catch (err: any) {
      setError(err?.message || 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: User) {
    try {
      await patch(`/users/${u.id}`, { isActive: !u.isActive });
      load();
    } catch (err: any) {
      window.alert(err?.message || 'Failed');
    }
  }

  async function resetPassword(u: User) {
    const pw = pwReset[u.id];
    if (!pw || pw.length < 8) {
      window.alert('New password must be at least 8 characters');
      return;
    }
    try {
      await patch(`/users/${u.id}`, { password: pw });
      setPwReset((s) => ({ ...s, [u.id]: '' }));
      window.alert('Password updated');
    } catch (err: any) {
      window.alert(err?.message || 'Failed');
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Users</h1>
      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      <form onSubmit={createUser} className="card grid gap-4 md:grid-cols-4">
        <div>
          <label className="label">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div>
          <label className="label">Password (min 8)</label>
          <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
        </div>
        <div>
          <label className="label">Role</label>
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'ADMIN' | 'AGENT' })}>
            <option value="AGENT">Agent</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <div className="md:col-span-4">
          <button className="btn-primary" disabled={busy}>{busy ? 'Creating…' : '+ Create user'}</button>
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-800/50 align-top">
                <td className="py-2 pr-4 font-medium">{u.name}{u.id === me?.id && <span className="ml-1 text-xs text-slate-500">(you)</span>}</td>
                <td className="py-2 pr-4">{u.email}</td>
                <td className="py-2 pr-4">
                  <select
                    className="input !w-28 !py-1 text-xs"
                    value={u.role}
                    disabled={u.id === me?.id}
                    onChange={async (e) => {
                      try {
                        await patch(`/users/${u.id}`, { role: e.target.value });
                        load();
                      } catch (err: any) {
                        window.alert(err?.message || 'Failed');
                      }
                    }}
                  >
                    <option value="AGENT">Agent</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </td>
                <td className="py-2 pr-4">
                  <span className={u.isActive ? 'badge-active' : 'badge-revoked'}>{u.isActive ? 'ACTIVE' : 'INACTIVE'}</span>
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => toggleActive(u)} disabled={u.id === me?.id}>
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <input
                      className="input !w-40 !py-1 text-xs"
                      type="password"
                      placeholder="New password"
                      value={pwReset[u.id] || ''}
                      onChange={(e) => setPwReset((s) => ({ ...s, [u.id]: e.target.value }))}
                    />
                    <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => resetPassword(u)}>Reset</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
