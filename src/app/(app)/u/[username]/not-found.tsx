import Link from 'next/link';

export default function UserNotFound() {
  return (
    <section className="py-16 text-center">
      <h1 className="font-display text-2xl font-bold">User not found</h1>
      <p className="mt-2 text-muted">No one on PulseHive uses that username.</p>
      <Link href="/feed" className="mt-6 inline-block font-semibold text-brand">
        Back to home
      </Link>
    </section>
  );
}
