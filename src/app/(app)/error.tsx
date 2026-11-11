'use client';

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="py-16 text-center">
      <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-muted">We could not load this page.</p>
      <button type="button" onClick={reset} className="mt-6 rounded-full border border-line px-5 py-2 text-sm font-semibold hover:border-brand">
        Try again
      </button>
    </section>
  );
}
