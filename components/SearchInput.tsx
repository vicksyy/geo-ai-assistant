'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LucideSearch } from 'lucide-react';

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
   <div
      className="
        flex items-center
        rounded-xl
        px-3 py-2
        backdrop-blur-md
        bg-white/40 dark:bg-gray-800/40
        shadow-lg
        w-full
      "
    >
      <Input
        placeholder="Introduce una dirección"
        value={direccion}
        onChange={(e) => setDireccion(e.target.value)}
        onKeyDown={handleKeyDown}
        className="
          flex-1
          bg-transparent
          border-none
          focus:ring-0
          text-black dark:text-white
          placeholder-black/60 dark:placeholder-white/60
        "
      />

      <Button
        onClick={handleSearch}
        disabled={loading}
        className="ml-2 p-2 flex items-center justify-center"
        variant="ghost"
        size="icon"
      >
        {loading ? '...' : <LucideSearch className="w-5 h-5 text-black dark:text-white" />}
      </Button>
    </div>
  );
}
