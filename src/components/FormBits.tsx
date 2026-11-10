'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { FormState } from '@/lib/form-state';

export function FormMessage({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
        {state.success}
      </p>
    );
  }
  return null;
}

// Disables itself while submitting, which prevents duplicate submissions.
export function SubmitButton({ children, pendingText }: { children: React.ReactNode; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? pendingText : children}
    </button>
  );
}

export function PasswordInput(props: {
  name: string;
  label: string;
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  const id = `field-${props.name}`;
  return (
    <div>
      <label htmlFor={id} className="label">
        {props.label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={props.name}
          type={visible ? 'text' : 'password'}
          autoComplete={props.autoComplete}
          placeholder={props.placeholder}
          required
          className="input pr-16"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-4 text-sm font-medium text-muted hover:text-fg"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  );
}
