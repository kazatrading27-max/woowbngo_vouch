'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getToken } from '@/lib/auth-helpers';
import { get } from '@/lib/api';
import { ShieldIcon } from '@/components/icons';

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
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400" />
          <p className="text-sm text-slate-400">Loading…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-amber-500/[0.07] blur-[120px]" />

      <div className="card animate-scale-in w-full max-w-md !p-6 md:!p-8">
        <div className="mb-7 text-center">
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-2xl font-black text-white shadow-xl shadow-emerald-600/30">
            W
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Wow<span className="text-emerald-400">Bingo</span> Vouchers
          </h1>
          <p className="mt-1.5 flex items-center justify-center gap-1.5 text-sm text-slate-400">
            <ShieldIcon className="h-4 w-4 text-emerald-500" />
            {mode === 'login' ? 'Sign in to manage credit vouchers' : 'Create the first administrator account'}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === 'bootstrap' && (
            <div className="animate-fade-up">
              <label className="label" htmlFor="name">
                Your name
              </label>
              <input
                id="name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                placeholder="Full name"
              />
            </div>
          )}
          <div className="animate-fade-up" style={{ animationDelay: '0.06s' }}>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              autoCapitalize="none"
            />
          </div>
          <div className="animate-fade-up" style={{ animationDelay: '0.12s' }}>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'bootstrap' ? 8 : 1}
              placeholder="••••••••"
            />
            {mode === 'bootstrap' && <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>}
          </div>

          {error && (
            <p className="animate-scale-in rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-500/20">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full !py-3" disabled={busy}>
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Please wait…
              </>
            ) : mode === 'login' ? (
              'Sign in'
            ) : (
              'Create admin account'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-slate-600">
          Hardware-locked codes · HMAC-signed · single use per PC
        </p>
      </div>
    </main>
  );
}
