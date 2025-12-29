'use client';

import { useState } from 'react';
import MapView from '../components/ui/MapView';
import SearchInput from '../components/ui/SearchInput';

export default function HomePage() {
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lon: number } | null>(null);

  return (
    <div className="flex h-[100vh] w-full">
      
      <div className="relative h-full w-4/5">
        <MapView coordenadas={coordenadas} />
      </div>
       <div className="w-1/5 h-full border-l border-gray-200">
        <div className=" z-9999">
        <SearchInput onResult={setCoordenadas} />
      </div>
      hola
      </div> 
    </div>
  );
}
