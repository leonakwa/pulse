'use client';

import { useState } from 'react';
import { reportContent } from '@/lib/report-actions';
import { REPORT_REASONS, type ReportType } from '@/lib/reports';

type Props = { type: ReportType; targetId: string; label?: string; className?: string };

const TITLES: Record<ReportType, string> = { post: 'Report this post', comment: 'Report this comment', user: 'Report this account' };

export function ReportButton({ type, targetId, label = 'Report', className = 'py-1 text-muted hover:text-danger' }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function send() {
    if (!reason || busy) return;
    setBusy(true);
    setError(null);
    const res = await reportContent(type, targetId, reason, details);
    setBusy(false);
    if (res.error) return setError(res.error);
    setDone(true);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={className}>
        {label}
      </button>
      {open ? (
        <div className="mt-2 w-full basis-full rounded-2xl border border-line p-3 text-sm">
          {done ? (
            <div className="flex items-center justify-between gap-3">
              <p role="status" className="text-success">
                Thank you. Our team will review your report.
              </p>
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
                Close
              </button>
            </div>
          ) : (
            <fieldset>
              <legend className="font-semibold">{TITLES[type]}</legend>
              <p className="mt-0.5 text-xs text-muted">Why are you reporting this? Reports are private.</p>
              <div className="mt-2 grid gap-1.5">
                {REPORT_REASONS.map((r) => (
                  <label key={r.value} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 ${reason === r.value ? 'border-brand bg-brand/10' : 'border-line'}`}>
                    <input type="radio" name={`reason-${type}-${targetId}`} value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="accent-[rgb(var(--brand))]" />
                    {r.label}
                  </label>
                ))}
              </div>
              <label htmlFor={`details-${type}-${targetId}`} className="sr-only">
                More details (optional)
              </label>
              <textarea
                id={`details-${type}-${targetId}`}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder="More details (optional)"
                className="input mt-2 resize-none !py-2"
              />
              {error ? (
                <p role="alert" className="mt-2 text-danger">
                  {error}
                </p>
              ) : null}
              <div className="mt-2 flex items-center gap-2">
                <button type="button" onClick={() => void send()} disabled={!reason || busy} className="rounded-full bg-danger px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
                  {busy ? 'Sending...' : 'Send report'}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
                  Cancel
                </button>
              </div>
            </fieldset>
          )}
        </div>
      ) : null}
    </>
  );
}
