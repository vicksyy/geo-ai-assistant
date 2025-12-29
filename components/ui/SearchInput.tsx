'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SearchInputProps {
  onResult: (coords: { lat: number; lon: number }) => void; // callback al page
}

export default function SearchInput({ onResult }: SearchInputProps) {
  const [direccion, setDireccion] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!direccion) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/tools/buscarCoordenadas?direccion=${direccion}`);
      const data = await res.json();

      if (res.ok) {
        onResult({ lat: data.lat, lon: data.lon }); // enviamos coords al page
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Error buscando dirección');
    } finally {
      setLoading(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
   <div className="flex gap-2 p-2 bg-white/90 rounded shadow">
      <Input
        placeholder="Introduce una dirección"
        value={direccion}
        onChange={(e) => setDireccion(e.target.value)}
        onKeyDown={handleKeyDown} // <-- Aquí detectamos Enter
        className="w-64"
      />
      <Button onClick={handleSearch} disabled={loading}>
        {loading ? 'Buscando...' : 'Buscar'}
      </Button>
    </div>
  );
}
