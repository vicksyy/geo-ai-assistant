'use client';

import SearchInput from './SearchInput';

export default function FloatingSearch({
  onResult,
}: {
  onResult: (result: {
    lat: number;
    lon: number;
    displayName?: string | null;
    placeClass?: string | null;
    placeType?: string | null;
  }) => void;
}) {
  return (
    <div className="w-[92vw] max-w-none md:w-full md:max-w-lg mx-auto">
      <SearchInput onResult={onResult} />
    </div>
  );
}
