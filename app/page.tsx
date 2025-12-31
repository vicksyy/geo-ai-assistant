'use client';

import { useState } from 'react';
import MapView from '../components/MapView';
import SearchInput from '../components/SearchInput';
import LeftSidebar from '../components/LeftSidebar';
import FloatingSearch from '../components/FloatingSearch';



export default function HomePage() {
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lon: number } | null>(null);
  const [toolData, setToolData] = useState<{ tool: string; data: any } | null>(null);

const handleToolSelect = async (tool:'capasUrbanismo'|'riesgoInundacion'|'contaminacion') => {
  if (!coordenadas) return alert('Selecciona un punto en el mapa primero');

  try {
    const params = new URLSearchParams({
      lat: coordenadas.lat.toString(),
      lon: coordenadas.lon.toString(),
    });

    const res = await fetch(`/api/tools/${tool}?${params.toString()}`);
    if (!res.ok) throw new Error('Error llamando al tool');

    const data = await res.json();
        console.log('Data del tool', tool, data); // <- Aquí lo verás en la consola
    setToolData({ tool, data });
  } catch (err) {
    console.error(err);
    alert('Error llamando al tool');
  }
};



  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <LeftSidebar onToolSelect={handleToolSelect} />

      <div className="relative flex-1">
        <div className="absolute top-4 right-4 md:left-1/2 md:-translate-x-1/2 z-[1000]">
          <FloatingSearch onResult={setCoordenadas} />
        </div>

       <MapView coordenadas={coordenadas}  onMapClick={(coords) => setCoordenadas(coords)} toolData={toolData} />
      </div>
    </div>
  );
}
