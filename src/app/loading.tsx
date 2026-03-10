const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Loading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="px-3 py-1 rounded bg-zinc-800 text-zinc-800 select-none">←</div>
        <div className="h-8 w-44 bg-zinc-800 rounded-lg animate-pulse" />
        <div className="px-3 py-1 rounded bg-zinc-800 text-zinc-800 select-none">→</div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs text-zinc-500 py-2">{d}</div>
        ))}
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="self-start h-0 pb-[100%] rounded-lg bg-zinc-900 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
