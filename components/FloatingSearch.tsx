'use client';

import { useState, useRef, useEffect } from 'react';
import SearchInput from './SearchInput';
import { LucideSearch } from 'lucide-react';

export default function FloatingSearch({
  onResult,
}: {
  onResult: (coords: { lat: number; lon: number }) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
     <div className="w-full max-w-lg mx-auto">
  {/* Mobile */}
  <div className="md:hidden">
    {!open ? (
      <button
        onClick={() => setOpen(true)}
        className="w-10 h-10 rounded-full bg-white/50 dark:bg-gray-700/50 shadow-lg flex items-center justify-center">
        <LucideSearch className="w-5 h-5 text-black dark:text-white" />
      </button>
    ) : (
      <SearchInput onResult={onResult} />
    )}
  </div>

  {/* Desktop */}
  <div className="hidden md:block">
    <SearchInput onResult={onResult} />
  </div>
</div>

  );
}

