'use client';

import { useState, useEffect } from 'react';

export default function DayImage({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open]);

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex-shrink-0 focus:outline-none group">
        <img
          src={src}
          alt={alt}
          className="w-32 h-32 rounded-lg object-cover cursor-zoom-in group-hover:opacity-90 transition-opacity"
        />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpen(false)}
        >
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl font-light leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
