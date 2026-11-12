export function StatusPill({ status }: { status: string }) {
  const style =
    status === 'active'
      ? 'bg-success/15 text-success'
      : status === 'suspended'
        ? 'bg-danger/15 text-danger'
        : 'bg-line text-muted';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold capitalize ${style}`}>{status}</span>;
}
