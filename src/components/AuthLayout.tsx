import { Wordmark } from '@/components/Wordmark';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-10">
      <Wordmark />
      <h1 className="mt-10 font-display text-3xl font-bold tracking-tight">{title}</h1>
      {subtitle ? <p className="mt-2 text-muted">{subtitle}</p> : null}
      <div className="mt-8">{children}</div>
    </main>
  );
}
