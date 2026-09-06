'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { get, post } from '@/lib/api';
import type { Station, Voucher } from '@/lib/types';

const AMOUNT_PRESETS = [100, 250, 500, 1000, 2500, 5000, 9750];

export default function GeneratePage() {
  return (
    <Suspense>
      <GenerateInner />
    </Suspense>
  );
}

function GenerateInner() {
  const searchParams = useSearchParams();
  const [stations, setStations] = useState<Station[]>([]);
  const [stationId, setStationId] = useState('');
  const [amount, setAmount] = useState(500);
  const [customAmount, setCustomAmount] = useState('');
  const [daysValid, setDaysValid] = useState(30);
  const [share, setShare] = useState(80);
  const [count, setCount] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<Voucher[] | null>(null);

  useEffect(() => {
    get<Station[]>('/stations')
      .then((s) => {
        setStations(s);
        const wanted = searchParams.get('stationId');
        const initial = wanted && s.some((x) => x.id === wanted) ? wanted : s.length > 0 ? s[0].id : '';
        setStationId((prev) => prev || initial);
      })
      .catch((e) => setError(e?.message || 'Failed to load stations'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    setResults(null);
    const finalAmount = customAmount ? parseInt(customAmount, 10) : amount;
    try {
      const created = await post<Voucher[]>('/vouchers', {
        stationId,
        amount: finalAmount,
        daysValid,
        share,
        count,
        note: note || undefined,
      });
      setResults(created);
    } catch (err: any) {
      setError(err?.message || 'Generation failed');
    } finally {
      setBusy(false);
    }
  }

  const selected = stations.find((s) => s.id === stationId);

  function copyAll() {
    if (!results) return;
    const text = results
      .map((v) => `${v.formattedCode}  —  ${v.amount} credits${v.expiresAt ? `  —  expires ${new Date(v.expiresAt).toLocaleDateString()}` : '  —  never expires'}`)
      .join('\n');
    navigator.clipboard.writeText(text);
  }

  function printView() {
    if (!results || !selected) return;
    const rows = results
      .map(
        (v) =>
          `<tr><td class="code">${v.formattedCode}</td><td>${v.amount.toLocaleString()}</td><td>${v.share}%</td><td>${v.expiresAt ? new Date(v.expiresAt).toLocaleDateString() : 'Never'}</td></tr>`,
      )
      .join('');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>Vouchers — ${selected.label}</title><style>
      body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111}
      h1{font-size:20px;margin:0 0 4px} p{margin:0 0 12px;color:#555;font-size:13px}
      table{border-collapse:collapse;width:100%;font-size:13px}
      th,td{border:1px solid #999;padding:8px;text-align:left}
      th{background:#f0f0f0}
      .code{font-family:Consolas,monospace;font-weight:bold;letter-spacing:1px}
    </style></head><body>
      <h1>WowBingo Credit Vouchers</h1>
      <p><b>${selected.label}</b> — ${selected.ownerName}${selected.phone ? ` — ${selected.phone}` : ''}${selected.address ? ` — ${selected.address}` : ''}<br/>Machine UUID: ${selected.uuid} — Issued ${new Date().toLocaleString()}</p>
      <table><thead><tr><th>Voucher code</th><th>Credits</th><th>Share</th><th>Expires</th></tr></thead><tbody>${rows}</tbody></table>
      <p style="margin-top:12px;font-size:11px;color:#777">Redeem by entering the code in the WowBingo game recharge dialog on the matching PC. Single use per PC.</p>
      </body></html>`);
    win.document.close();
    win.print();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Generate vouchers</h1>

      {stations.length === 0 && !error && (
        <p className="card text-sm text-slate-400">
          No game PCs registered yet. <Link href="/stations" className="text-emerald-400 underline">Register one first</Link>.
        </p>
      )}
      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      <form onSubmit={submit} className="card space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Game PC</label>
            <select className="input" value={stationId} onChange={(e) => setStationId(e.target.value)} required>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} — {s.ownerName}
                </option>
              ))}
            </select>
            {selected && (
              <p className="mt-1 text-xs text-slate-500">
                {selected.phone ? `${selected.phone} · ` : ''}{selected.address || ''} · UUID: {selected.uuid}
              </p>
            )}
          </div>
          <div>
            <label className="label">Credit amount</label>
            <div className="flex flex-wrap gap-1.5">
              {AMOUNT_PRESETS.map((a) => (
                <button
                  type="button"
                  key={a}
                  onClick={() => {
                    setAmount(a);
                    setCustomAmount('');
                  }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${!customAmount && amount === a ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                >
                  {a.toLocaleString()}
                </button>
              ))}
              <input
                className="input !w-28"
                type="number"
                min={1}
                max={16777215}
                placeholder="Custom"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">Valid for (days, 0 = never expires)</label>
            <input className="input" type="number" min={0} max={65535} value={daysValid} onChange={(e) => setDaysValid(parseInt(e.target.value || '0', 10))} />
          </div>
          <div>
            <label className="label">Commission share (%)</label>
            <input className="input" type="number" min={0} max={100} value={share} onChange={(e) => setShare(parseInt(e.target.value || '0', 10))} />
          </div>
          <div>
            <label className="label">Count (1–50)</label>
            <input className="input" type="number" min={1} max={50} value={count} onChange={(e) => setCount(parseInt(e.target.value || '1', 10))} />
          </div>
          <div>
            <label className="label">Note (optional)</label>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. weekly recharge for June" />
          </div>
        </div>
        <button type="submit" className="btn-primary" disabled={busy || !stationId}>
          {busy ? 'Generating…' : `Generate ${count} voucher${count > 1 ? 's' : ''}`}
        </button>
      </form>

      {results && (
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-emerald-400">{results.length} voucher(s) generated</h2>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={copyAll}>Copy all</button>
              <button className="btn-secondary" onClick={printView}>Print</button>
            </div>
          </div>
          <div className="space-y-2">
            {results.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                <div>
                  <p className="font-mono text-base font-bold tracking-wider text-emerald-300">{v.formattedCode}</p>
                  <p className="text-xs text-slate-500">
                    {v.amount.toLocaleString()} credits · share {v.share}% ·{' '}
                    {v.expiresAt ? `expires ${new Date(v.expiresAt).toLocaleDateString()}` : 'never expires'}
                  </p>
                </div>
                <button
                  className="btn-secondary !px-3 !py-1.5 text-xs"
                  onClick={() => navigator.clipboard.writeText(v.formattedCode)}
                >
                  Copy
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Each code works only on the selected PC&apos;s machine UUID and only once (the game PC marks it used on redemption).{' '}
            {selected && (
              <Link href={`/stations/${selected.id}`} className="text-emerald-400 hover:underline">
                View {selected.label}&apos;s voucher history →
              </Link>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
