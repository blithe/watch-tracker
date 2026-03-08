import Link from 'next/link';

interface CalendarCellProps {
  day: number;
  dateStr: string;
  isToday: boolean;
  cellImage: string | null;
  hasLog: boolean;
  logBrand?: string | null;
}

export default function CalendarCell({ day, dateStr, isToday, cellImage, hasLog, logBrand }: CalendarCellProps) {
  return (
    <Link
      href={`/day/${dateStr}`}
      className={`relative self-start h-0 pb-[100%] rounded-lg border transition-colors
        ${isToday ? 'border-blue-500' : 'border-zinc-800 hover:border-zinc-600'}`}
    >
      {cellImage ? (
        <div className="absolute inset-0 overflow-hidden rounded-lg">
          <img src={cellImage} alt="" className="w-full h-full object-cover object-center" />
        </div>
      ) : (
        <div className={`absolute inset-0 ${hasLog ? 'bg-zinc-800/50' : ''} ${isToday ? 'bg-blue-500/10' : ''}`} />
      )}
      <span className={`absolute top-1.5 left-1.5 text-xs font-semibold z-10 leading-none px-1.5 py-0.5 rounded-md
        ${cellImage
          ? 'bg-black/65 text-white'
          : isToday ? 'text-blue-400' : 'text-zinc-400'}`}>
        {day}
      </span>
      {hasLog && !cellImage && logBrand && (
        <span className="absolute bottom-1 inset-x-0 text-center text-[9px] text-zinc-500 leading-tight px-1 truncate">
          {logBrand}
        </span>
      )}
    </Link>
  );
}
