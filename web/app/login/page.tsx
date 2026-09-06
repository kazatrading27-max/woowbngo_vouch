'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getToken } from '@/lib/auth-helpers';
import { get } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login, bootstrap } = useAuth();
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);
  const [mode, setMode] = useState<'login' | 'bootstrap'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);

  useEffect(() => {
    get<boolean>('/auth/has-users')
      .then((r) => {
        setHasUsers(r);
        setMode(r ? 'login' : 'bootstrap');
      })
      .catch(() => setHasUsers(true));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await bootstrap(email, password, name);
      }
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (loading || hasUsers === null || getToken()) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-slate-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-emerald-400">WowBingo Vouchers</h1>
          <p className="mt-1 text-sm text-slate-400">
            {mode === 'login' ? 'Sign in to manage credit vouchers' : 'Create the first administrator account'}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === 'bootstrap' && (
            <div>
              <label className="label" htmlFor="name">Your name</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} placeholder="Full name" />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === 'bootstrap' ? 8 : 1} placeholder="••••••••" />
            {mode === 'bootstrap' && <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>}
          </div>

          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create admin account'}
          </button>
        </form>
      </div>
    </main>
  );
}
