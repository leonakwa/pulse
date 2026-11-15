'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { confirmMfaEnroll, disableMfa, startMfaEnroll } from '@/lib/mfa-actions';

type Setup = { factorId: string; qr: string; secret: string };

export function MfaSetup({ enabledFactorId }: { enabledFactorId: string | null }) {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(enabledFactorId);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await startMfaEnroll();
    setBusy(false);
    if (res.error || !res.factorId || !res.qr || !res.secret) return setError(res.error ?? 'Could not start the setup.');
    setSetup({ factorId: res.factorId, qr: res.qr, secret: res.secret });
  }

  async function confirm() {
    if (!setup || busy) return;
    setBusy(true);
    setError(null);
    const res = await confirmMfaEnroll(setup.factorId, code);
    setBusy(false);
    if (res.error) return setError(res.error);
    setFactorId(setup.factorId);
    setSetup(null);
    setCode('');
    setMessage('Two-step login is now on. You will be asked for a code each time you sign in.');
    router.refresh();
  }

  async function turnOff() {
    if (!factorId || busy) return;
    if (!window.confirm('Turn off two-step login? The admin area will stop working until you turn it on again.')) return;
    setBusy(true);
    setError(null);
    const res = await disableMfa(factorId);
    setBusy(false);
    if (res.error) return setError(res.error);
    setFactorId(null);
    setMessage('Two-step login is off.');
    router.refresh();
  }

  return (
    <div>
      {factorId ? (
        <div className="rounded-2xl border border-success/40 bg-success/10 p-4">
          <p className="font-semibold text-success">Two-step login is ON</p>
          <p className="mt-1 text-sm">Signing in needs your password and a code from your authenticator app.</p>
          <button type="button" onClick={() => void turnOff()} disabled={busy} className="mt-3 rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-danger hover:text-danger disabled:opacity-60">
            Turn off
          </button>
        </div>
      ) : setup ? (
        <div className="space-y-4 rounded-2xl border border-line p-4">
          <p className="font-semibold">1. Scan this with your authenticator app</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr} alt="QR code to scan with your authenticator app" width={192} height={192} className="rounded-xl bg-white p-2" />
          <p className="text-sm text-muted">
            Cannot scan? Enter this key in the app instead:
            <code className="mt-1 block break-all rounded-lg bg-surface p-2 text-xs text-fg">{setup.secret}</code>
          </p>
          <div>
            <label htmlFor="mfa-code" className="font-semibold">
              2. Enter the 6-digit code it shows
            </label>
            <input id="mfa-code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} className="input mt-2 text-center text-xl tracking-widest" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void confirm()} disabled={busy || code.replace(/\s/g, '').length !== 6} className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-fg disabled:opacity-60">
              {busy ? 'Checking...' : 'Turn on'}
            </button>
            <button type="button" onClick={() => setSetup(null)} className="btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-line p-4">
          <p className="font-semibold">Two-step login is OFF</p>
          <p className="mt-1 text-sm text-muted">You will need an authenticator app such as Google Authenticator, Authy or Microsoft Authenticator.</p>
          <button type="button" onClick={() => void start()} disabled={busy} className="mt-3 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-fg disabled:opacity-60">
            {busy ? 'Starting...' : 'Set up two-step login'}
          </button>
        </div>
      )}

      {message ? (
        <p role="status" className="mt-3 text-sm text-success">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
