export function LevelBadge({ level, name }: { level: number; name?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-bold text-brand">
      <span>Lv {level}</span>
      {name ? <span className="font-semibold">· {name}</span> : null}
    </span>
  );
}
