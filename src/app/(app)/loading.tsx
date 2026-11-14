// Shown while a page loads, so the screen never looks frozen.
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="animate-pulse space-y-6 py-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="h-11 w-11 shrink-0 rounded-full bg-line" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded bg-line" />
            <div className="h-4 w-full rounded bg-line" />
            <div className="h-4 w-2/3 rounded bg-line" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}
