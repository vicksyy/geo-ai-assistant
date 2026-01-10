'use client';

import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type CityResult = {
  name: string;
  lat: number;
  lon: number;
  population?: number | null;
  areaKm2?: number | null;
  density?: number | null;
  elevation?: number | null;
  aqi?: number | null;
  aqiLabel?: string | null;
  risk?: string | null;
  urban?: {
    source?: string;
    summary?: string;
    details?: Record<string, any>;
  } | null;
};

type CompareResponse = {
  cityA: CityResult;
  cityB: CityResult;
  comparison: string[];
};

export default function ComparePanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [cityA, setCityA] = useState('');
  const [cityB, setCityB] = useState('');
  const [suggestionsA, setSuggestionsA] = useState<any[]>([]);
  const [suggestionsB, setSuggestionsB] = useState<any[]>([]);
  const [showA, setShowA] = useState(false);
  const [showB, setShowB] = useState(false);
  const abortA = useRef<AbortController | null>(null);
  const abortB = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, any[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async () => {
    if (!cityA.trim() || !cityB.trim()) {
      setError('Introduce dos ciudades para comparar.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityA: cityA.trim(), cityB: cityB.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo comparar.');
        return;
      }
      setResult(data);
    } catch (err) {
      console.error(err);
      setError('Error al comparar.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const fetchSuggestions = async (
    value: string,
    setSuggestions: (items: any[]) => void,
    setShow: (value: boolean) => void,
    abortRef: { current: AbortController | null }
  ) => {
    if (!value || value.trim().length < 3) {
      setSuggestions([]);
      setShow(false);
      if (abortRef.current) abortRef.current.abort();
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const key = value.toLowerCase();
    const cached = cacheRef.current.get(key);
    if (cached) {
      setSuggestions(cached);
      setShow(cached.length > 0);
      return;
    }
    try {
      const res = await fetch(`/api/tools/sugerencias?query=${encodeURIComponent(value)}&cityOnly=1`, {
        signal: controller.signal,
      });
      if (!res.ok) return;
      const data = await res.json();
      const items = (data?.results ?? []).slice(0, 6);
      cacheRef.current.set(key, items);
      setSuggestions(items);
      setShow(items.length > 0);
    } catch (err) {
      if ((err as any).name !== 'AbortError') {
        console.error(err);
      }
    }
  };

  return (
    <div className="absolute left-3 right-3 top-16 z-[1200] max-h-[70vh] overflow-hidden rounded-2xl border border-black/10 bg-white/95 shadow-2xl backdrop-blur sm:left-4 sm:right-4 sm:top-20 md:left-4 md:right-auto md:top-24 md:max-h-[80vh] md:w-[520px]">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Comparar ciudades</h3>
          <p className="text-xs text-gray-500">Población, riesgos, infraestructura y aire.</p>
        </div>
        <button
          type="button"
          className="text-gray-400 hover:text-gray-700"
          onClick={onClose}
          aria-label="Cerrar comparación"
        >
          ✕
        </button>
      </div>
      <div className="border-t border-black/10" />

      <div className="px-4 py-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="relative">
            <Input
              placeholder="Ciudad A"
              value={cityA}
              onChange={(e) => {
                const next = e.target.value;
                setCityA(next);
                fetchSuggestions(next, setSuggestionsA, setShowA, abortA);
              }}
              onFocus={() => {
                if (suggestionsA.length) setShowA(true);
              }}
              onBlur={() => {
                setTimeout(() => setShowA(false), 150);
              }}
            />
            {showA && suggestionsA.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-[1300] mt-2 rounded-xl border border-black/10 bg-white/95 shadow-xl backdrop-blur">
                <ul className="max-h-56 overflow-auto py-1 text-xs text-gray-800">
                  {suggestionsA.map((item) => (
                    <li key={`a-${item.lat}-${item.lon}`}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-black/5"
                        onClick={() => {
                          setCityA(item.display_name || item.name || '');
                          setShowA(false);
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

          <div className="relative">
            <Input
              placeholder="Ciudad B"
              value={cityB}
              onChange={(e) => {
                const next = e.target.value;
                setCityB(next);
                fetchSuggestions(next, setSuggestionsB, setShowB, abortB);
              }}
              onFocus={() => {
                if (suggestionsB.length) setShowB(true);
              }}
              onBlur={() => {
                setTimeout(() => setShowB(false), 150);
              }}
            />
            {showB && suggestionsB.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-[1300] mt-2 rounded-xl border border-black/10 bg-white/95 shadow-xl backdrop-blur">
                <ul className="max-h-56 overflow-auto py-1 text-xs text-gray-800">
                  {suggestionsB.map((item) => (
                    <li key={`b-${item.lat}-${item.lon}`}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-black/5"
                        onClick={() => {
                          setCityB(item.display_name || item.name || '');
                          setShowB(false);
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
        </div>

        <Button className="mt-3 w-full" onClick={handleCompare} disabled={loading}>
          {loading ? 'Comparando...' : 'Comparar'}
        </Button>

        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>

      <div className="max-h-[45vh] overflow-y-auto px-4 pb-4">
        {result && (
          <div className="space-y-4 text-sm text-gray-700">
            <div className="grid gap-4 md:grid-cols-2">
              {[result.cityA, result.cityB].map((city) => (
                <div
                  key={city.name}
                  className="rounded-xl border border-black/5 bg-white px-3 py-3 shadow-sm"
                >
                  <div className="text-sm font-semibold text-gray-900">{city.name}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {city.lat.toFixed(4)}, {city.lon.toFixed(4)}
                  </div>
                  <div className="mt-3 space-y-1 text-xs">
                    <div>
                      <span className="font-semibold text-gray-800">Habitantes:</span>{' '}
                      {city.population ? city.population.toLocaleString('es-ES') : 'No disponible'}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-800">Superficie:</span>{' '}
                      {city.areaKm2 ? `${city.areaKm2.toLocaleString('es-ES')} km²` : 'No disponible'}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-800">Densidad:</span>{' '}
                      {city.density ? `${city.density.toLocaleString('es-ES')} hab/km²` : 'No disponible'}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-800">Altitud:</span>{' '}
                      {city.elevation ? `${city.elevation.toLocaleString('es-ES')} m` : 'No disponible'}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-800">Calidad del aire (AQI):</span>{' '}
                      {city.aqi !== null && city.aqi !== undefined
                        ? `${city.aqi}${city.aqiLabel ? ` (${city.aqiLabel})` : ''}`
                        : 'No disponible'}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-800">Riesgo inundación:</span>{' '}
                      {city.risk ?? 'No disponible'}
                    </div>
                    {city.urban?.summary && (
                      <div>
                        <span className="font-semibold text-gray-800">Urbanismo:</span>{' '}
                        {city.urban.summary}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-black/5 bg-white px-3 py-3 shadow-sm">
              <div className="text-sm font-semibold text-gray-900">Comparación clave</div>
              <ul className="mt-2 space-y-1 text-xs text-gray-700">
                {result.comparison.map((item, index) => (
                  <li key={`cmp-${index}`}>• {item}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
