'use client';

import { useCallback, useEffect, useState } from 'react';
import { get, post, patch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { UsersIcon } from '@/components/icons';
import type { User } from '@/lib/types';

export default function UsersPage() {
  const { user: me, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'AGENT' as User['role'] });
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
    <div className="space-y-5">
      <div className="animate-fade-up">
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Users</h1>
        <p className="mt-0.5 text-sm text-slate-400">Admins and agents — full account control</p>
      </div>

      {error && (
        <p className="animate-scale-in rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-500/20">
          {error}
        </p>
      )}

      <form onSubmit={createUser} className="card animate-fade-up grid gap-4 md:grid-cols-4" style={{ animationDelay: '0.05s' }}>
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
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={8}
          />
        </div>
        <div>
          <label className="label">Role</label>
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as User['role'] })}>
            <option value="AGENT">Agent</option>
            {isSuperAdmin && <option value="ADMIN">Admin</option>}
          </select>
          {!isSuperAdmin && <p className="mt-1 text-[11px] text-slate-500">Only the super admin can create admins.</p>}
        </div>
        <div className="md:col-span-4">
          <button className="btn-primary" disabled={busy}>
            {busy ? 'Creating…' : '+ Create user'}
          </button>
        </div>
      </form>

      {/* Mobile cards */}
      <ul className="stagger space-y-3 md:hidden">
        {users.map((u) => (
          <li key={u.id} className="card !p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">
                  {u.name}
                  {u.id === me?.id && <span className="ml-1 text-xs font-normal text-slate-500">(you)</span>}
                </p>
                <p className="truncate text-xs text-slate-500">{u.email}</p>
              </div>
              <span className={u.isActive ? 'badge-active' : 'badge-revoked'}>{u.isActive ? 'ACTIVE' : 'INACTIVE'}</span>
            </div>
            <div className="mt-3 space-y-2 border-t border-white/[0.06] pt-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Role</label>
                <select
                  className="input !w-28 !py-1 text-xs"
                  value={u.role}
                  disabled={u.id === me?.id || u.role === 'SUPER_ADMIN'}
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
                  {isSuperAdmin && <option value="ADMIN">Admin</option>}
                  {u.role === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">Super Admin</option>}
                </select>
                <button className="btn-secondary ml-auto !px-3 !py-1.5 text-xs" onClick={() => toggleActive(u)} disabled={u.id === me?.id}>
                  {u.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  className="input flex-1 !py-1.5 text-xs"
                  type="password"
                  placeholder="New password"
                  value={pwReset[u.id] || ''}
                  onChange={(e) => setPwReset((s) => ({ ...s, [u.id]: e.target.value }))}
                />
                <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => resetPassword(u)}>
                  Reset
                </button>
              </div>
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
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-white/[0.04] align-top transition-colors hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-medium">
                    {u.name}
                    {u.id === me?.id && <span className="ml-1 text-xs text-slate-500">(you)</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      className="input !w-28 !py-1 text-xs"
                      value={u.role}
                      disabled={u.id === me?.id || u.role === 'SUPER_ADMIN'}
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
                      {isSuperAdmin && <option value="ADMIN">Admin</option>}
                      {u.role === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">Super Admin</option>}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={u.isActive ? 'badge-active' : 'badge-revoked'}>{u.isActive ? 'ACTIVE' : 'INACTIVE'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button className="btn-secondary !px-2.5 !py-1 text-xs" onClick={() => toggleActive(u)} disabled={u.id === me?.id}>
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <input
                        className="input !w-40 !py-1 text-xs"
                        type="password"
                        placeholder="New password"
                        value={pwReset[u.id] || ''}
                        onChange={(e) => setPwReset((s) => ({ ...s, [u.id]: e.target.value }))}
                      />
                      <button className="btn-secondary !px-2.5 !py-1 text-xs" onClick={() => resetPassword(u)}>
                        Reset
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {users.length === 0 && !error && (
        <div className="card flex flex-col items-center gap-3 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04]">
            <UsersIcon className="h-7 w-7 text-slate-500" />
          </span>
          <p className="text-sm text-slate-400">No users yet.</p>
        </div>
      )}
    </div>
  );
}
