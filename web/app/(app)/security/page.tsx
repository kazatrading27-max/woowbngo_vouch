'use client';

import { useCallback, useEffect, useState } from 'react';
import { get, post, del } from '@/lib/api';
import { ShieldIcon, CheckIcon, FingerprintIcon } from '@/components/icons';

interface PasskeyInfo {
  id: string;
  deviceType: string;
  backedUp: boolean;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

export default function SecurityPage() {
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const load = useCallback(() => {
    get<PasskeyInfo[]>('/auth/webauthn/credentials').then(setPasskeys).catch(() => {});
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    const available =
      typeof window !== 'undefined' &&
      window.PublicKeyCredential &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function';
    if (!available) {
      setSupported(false);
      return;
    }
    window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      .then(setSupported)
      .catch(() => setSupported(false));
  }, []);

  async function enableBiometric() {
    setBusy(true);
    setError('');
    setOk('');
    try {
      const options = await get<Record<string, unknown>>('/auth/webauthn/register/options');
      const { startRegistration } = await import('@simplewebauthn/browser');
      const attResp = await startRegistration({ optionsJSON: options as any });
      await post('/auth/webauthn/register', attResp);
      setOk('Biometric login enabled on this device.');
      load();
    } catch (err: any) {
      const msg = String(err?.message || err?.name || 'Failed');
      setError(
        msg.includes('NotAllowedError')
          ? 'The prompt was dismissed or timed out. Try again.'
          : msg.includes('InvalidStateError')
            ? 'This device is already registered for biometric login.'
            : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Remove this biometric login? You will still sign in with email + password.')) return;
    try {
      await del(`/auth/webauthn/credentials/${id}`);
      load();
    } catch (err: any) {
      window.alert(err?.message || 'Failed to remove');
    }
  }

  return (
    <div className="space-y-5">
      <div className="animate-fade-up">
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Security</h1>
        <p className="mt-0.5 text-sm text-slate-400">Biometric sign-in and device passkeys</p>
      </div>

      <div className="card animate-fade-up space-y-4" style={{ animationDelay: '0.05s' }}>
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
            <FingerprintIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-white">Face ID / fingerprint login</h2>
            <p className="mt-0.5 text-sm text-slate-400">
              Sign in with your device&apos;s face or fingerprint — no password needed. The biometric data never
              leaves your device; the server only receives a cryptographic signature.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Works with Android face/fingerprint unlock, iPhone Face ID, and Windows Hello.
            </p>
          </div>
        </div>

        {supported === false && (
          <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-300 ring-1 ring-inset ring-amber-500/20">
            This browser or device doesn&apos;t support biometric sign-in. Use a phone with a screen lock or a
            computer with Windows Hello.
          </p>
        )}
        {supported && passkeys.length === 0 && (
          <button className="btn-primary" onClick={enableBiometric} disabled={busy}>
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Waiting for your device…
              </>
            ) : (
              <>
                <FingerprintIcon className="h-4 w-4" />
                Enable on this device
              </>
            )}
          </button>
        )}
        {supported && passkeys.length > 0 && (
          <button className="btn-secondary" onClick={enableBiometric} disabled={busy}>
            {busy ? 'Waiting for your device…' : '+ Add another device'}
          </button>
        )}

        {ok && (
          <p className="animate-scale-in flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 ring-1 ring-inset ring-emerald-500/20">
            <CheckIcon className="h-4 w-4" />
            {ok}
          </p>
        )}
        {error && (
          <p className="animate-scale-in rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-500/20">
            {error}
          </p>
        )}
      </div>

      {passkeys.length > 0 && (
        <ul className="stagger space-y-3">
          {passkeys.map((p) => (
            <li key={p.id} className="card flex items-center gap-3 !p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300">
                <ShieldIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">
                  {p.deviceType === 'singleDevice' ? 'This device' : 'Synced passkey'}
                  {p.backedUp && <span className="ml-2 text-[11px] font-bold uppercase text-emerald-400">backed up</span>}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  Added {new Date(p.createdAt).toLocaleString()}
                  {p.lastUsedAt ? ` · Last used ${new Date(p.lastUsedAt).toLocaleString()}` : ''}
                </p>
              </div>
              <button className="btn-danger !px-3 !py-1.5 text-xs" onClick={() => remove(p.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
