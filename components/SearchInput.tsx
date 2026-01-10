'use client';

import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LucideSearch } from 'lucide-react';

interface SearchInputProps {
  onResult: (result: {
    lat: number;
    lon: number;
    displayName?: string | null;
    placeClass?: string | null;
    placeType?: string | null;
  }) => void; // callback al page
}

export default function SearchInput({ onResult }: SearchInputProps) {
  const [direccion, setDireccion] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<
    {
      display_name: string;
      lat: number;
      lon: number;
      class?: string | null;
      type?: string | null;
    }[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, any[]>>(new Map());

  const handleSearch = async (value?: string) => {
    const query = value ?? direccion;
    if (!query) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/tools/buscarCoordenadas?direccion=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        onResult({
          lat: data.lat,
          lon: data.lon,
          displayName: data.display_name ?? null,
          placeClass: data.class ?? null,
          placeType: data.type ?? null,
        }); // enviamos coords al page
        setShowSuggestions(false);
        return;
      }

      if (query.trim().length >= 3) {
        const looseRes = await fetch(
          `/api/tools/sugerencias?query=${encodeURIComponent(query)}`
        );
        if (looseRes.ok) {
          const loose = await looseRes.json();
          const first = loose?.results?.[0];
          if (first) {
            onResult({
              lat: first.lat,
              lon: first.lon,
              displayName: first.display_name ?? null,
              placeClass: first.class ?? null,
              placeType: first.type ?? null,
            });
            setShowSuggestions(false);
            return;
          }
        }
      }

      const fallbackRes = await fetch(
        `/api/tools/sugerencias?query=${encodeURIComponent(query)}`
      );
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        const first = fallbackData?.results?.[0];
        if (first) {
          onResult({
            lat: first.lat,
            lon: first.lon,
            displayName: first.display_name ?? null,
            placeClass: first.class ?? null,
            placeType: first.type ?? null,
          });
          setShowSuggestions(false);
          return;
        }
      }

      const data = await res.json().catch(() => ({}));
      alert(data.error || 'No se encontraron resultados');
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

  useEffect(() => {
    const query = direccion.trim();
    if (!query || query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      if (abortRef.current) abortRef.current.abort();
      return;
    }

    const cached = cacheRef.current.get(query.toLowerCase());
    if (cached) {
      setSuggestions(cached);
      setShowSuggestions(cached.length > 0);
      return;
    }

    const timeout = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`/api/tools/sugerencias?query=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        const normalize = (value: string) =>
          value
            .toLowerCase()
            .replace(/[^\p{L}\p{N}]+/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const normalizedQuery = normalize(query);
        const queryTokens = normalizedQuery.split(' ').filter(Boolean);
        const matchesPrefix = (value?: string) => {
          if (!value) return false;
          const normalizedValue = normalize(value);
          if (!normalizedValue) return false;
          if (normalizedValue.startsWith(normalizedQuery)) return true;

          const tokens = normalizedValue.split(' ').filter(Boolean);
          if (queryTokens.length <= 1) {
            return tokens.some((token) => token.startsWith(normalizedQuery));
          }

          for (let i = 0; i <= tokens.length - queryTokens.length; i += 1) {
            const slice = tokens.slice(i, i + queryTokens.length);
            if (slice.join(' ') === normalizedQuery) return true;
          }
          return false;
        };
        const allResults = data?.results ?? [];
        const prefixMatches = allResults.filter(
          (item: any) => matchesPrefix(item.display_name) || matchesPrefix(item.name)
        );
        const containsMatch = (value?: string) => {
          if (!value) return false;
          const normalizedValue = normalize(value);
          return normalizedValue.includes(normalizedQuery);
        };
        const containsMatches = allResults.filter(
          (item: any) => containsMatch(item.display_name) || containsMatch(item.name)
        );
        const cityTypes = new Set(['city', 'town', 'village', 'municipality']);
        const isCity = (item: any) => item.class === 'place' && cityTypes.has(item.type);

        const prioritized = (items: any[]) => [
          ...items.filter(isCity),
          ...items.filter((item) => !isCity(item)),
        ];

        const finalResults = prefixMatches.length
          ? prioritized(prefixMatches)
          : containsMatches.length
            ? prioritized(containsMatches)
            : prioritized(allResults);

        cacheRef.current.set(query.toLowerCase(), finalResults);
        setSuggestions(finalResults);
        setShowSuggestions(finalResults.length > 0);
      } catch (err) {
        if ((err as any).name !== 'AbortError') {
          console.error(err);
        }
      }
    }, 80);

    return () => clearTimeout(timeout);
  }, [direccion]);

  return (
   <div className="relative w-full">
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
          onFocus={() => {
            if (suggestions.length) setShowSuggestions(true);
          }}
          onBlur={() => {
            setTimeout(() => setShowSuggestions(false), 150);
          }}
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
          onClick={() => handleSearch()}
          disabled={loading}
          className="ml-2 p-2 flex items-center justify-center"
          variant="ghost"
          size="icon"
        >
          {loading ? '...' : <LucideSearch className="w-5 h-5 text-black dark:text-white" />}
        </Button>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-[1200] mt-2 rounded-xl border border-black/10 bg-white/95 shadow-xl backdrop-blur">
          <ul className="max-h-64 overflow-auto py-1 text-sm text-gray-800">
            {suggestions.map((item) => (
              <li key={`${item.lat}-${item.lon}`}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-black/5"
                  onClick={() => {
                    setDireccion(item.display_name);
                    onResult({
                      lat: item.lat,
                      lon: item.lon,
                      displayName: item.display_name ?? null,
                      placeClass: item.class ?? null,
                      placeType: item.type ?? null,
                    });
                    setShowSuggestions(false);
                  }}
                >
                  {item.display_name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
