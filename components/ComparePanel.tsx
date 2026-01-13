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
  malePercent?: number | null;
  femalePercent?: number | null;
  flagUrl?: string | null;
  aqi?: number | null;
  aqiLabel?: string | null;
  risk?: string | null;
  riskNote?: string | null;
  riskSource?: string | null;
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

  const formatFloodRiskLabel = (value?: string | null) => {
    if (!value) return null;
    const normalized = value.toLowerCase();
    let level: 'bajo' | 'medio' | 'alto' | 'desconocido' | null = null;
    if (normalized.includes('alto')) level = 'alto';
    else if (normalized.includes('medio')) level = 'medio';
    else if (normalized.includes('bajo')) level = 'bajo';
    else if (normalized.includes('desconoc')) level = 'desconocido';
    if (!level) return value;
    const label = `${level.charAt(0).toUpperCase()}${level.slice(1)}`;
    return `${label} (ARPSI)`;
  };

  const formatRiskSummary = (city: CityResult) => {
    const formatted = formatFloodRiskLabel(city.risk);
    return formatted ?? 'No disponible';
  };

  const formatComparisonItem = (item: string) =>
    item.replace(/\b(bajo|medio|alto|desconocido)\s*\(arpsi\)/gi, (match, level) => {
      const normalized = String(level).toLowerCase();
      const label = `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
      return `${label} (ARPSI)`;
    });

  const normalizeText = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const parseCityCountry = (value: string) => {
    const parts = value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    return {
      city: parts[0] ?? '',
      country: parts.length > 1 ? parts[parts.length - 1] : '',
    };
  };

  const findMatch = (value: string, items: any[]) => {
    if (!value || !items.length) return null;
    const normalizedValue = normalizeText(value);
    const exact = items.find(
      (item) => normalizeText(item.display_name ?? '') === normalizedValue
    );
    if (exact) return exact;

    const { city, country } = parseCityCountry(value);
    const normalizedCity = normalizeText(city);
    const normalizedCountry = normalizeText(country);
    if (normalizedCity && normalizedCountry) {
      return (
        items.find((item) => {
          const label = item.display_name ?? '';
          const parts = parseCityCountry(label);
          return (
            normalizeText(parts.city) === normalizedCity &&
            normalizeText(parts.country) === normalizedCountry
          );
        }) ?? null
      );
    }

    if (normalizedCity) {
      const cityMatches = items.filter((item) => {
        const label = item.display_name ?? '';
        const parts = parseCityCountry(label);
        return normalizeText(parts.city) === normalizedCity;
      });
      if (cityMatches.length === 1) return cityMatches[0];
    }
    return null;
  };

  const autoCompleteInput = async (
    value: string,
    suggestions: any[],
    setValue: (next: string) => void,
    abortRef: { current: AbortController | null }
  ) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const cached = cacheRef.current.get(trimmed.toLowerCase()) ?? [];
    const match = findMatch(trimmed, suggestions) ?? findMatch(trimmed, cached);
    if (match) {
      setValue(match.display_name || match.name || trimmed);
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(
        `/api/tools/sugerencias?query=${encodeURIComponent(trimmed)}&cityOnly=1`,
        { signal: controller.signal }
      );
      if (!res.ok) return;
      const data = await res.json();
      const items = data?.results ?? [];
      cacheRef.current.set(trimmed.toLowerCase(), items);
      const fetchedMatch = findMatch(trimmed, items);
      if (fetchedMatch) {
        setValue(fetchedMatch.display_name || fetchedMatch.name || trimmed);
      }
    } catch (err) {
      if ((err as any).name !== 'AbortError') {
        console.error(err);
      }
    }
  };

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
    <div className="fixed inset-0 z-[1200] flex flex-col overflow-hidden bg-card/95 pb-20 text-foreground shadow-2xl backdrop-blur md:absolute md:left-4 md:right-auto md:top-24 md:inset-auto md:max-h-[80vh] md:w-[320px] lg:w-[420px] md:rounded-2xl md:border md:border-border md:pb-0">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Comparar ciudades</h3>
          <p className="text-xs text-muted-foreground">Población, riesgos, infraestructura y aire.</p>
        </div>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground"
          onClick={onClose}
          aria-label="Cerrar comparación"
        >
          ✕
        </button>
      </div>
      <div className="border-t border-border" />

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4">
          <div className="grid gap-2 md:grid-cols-2">
            <div className="relative">
              <Input
                placeholder="Ciudad A"
                value={cityA}
                onChange={(e) => {
                  const next = e.target.value;
                  setCityA(next);
                  fetchSuggestions(next, setSuggestionsA, setShowA, abortA);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    setShowA(false);
                    if (suggestionsA.length) {
                      const first = suggestionsA[0];
                      setCityA(first.display_name || first.name || cityA);
                      return;
                    }
                    autoCompleteInput(cityA, suggestionsA, setCityA, abortA);
                  }
                }}
                onFocus={() => {
                  if (suggestionsA.length) setShowA(true);
                }}
                onBlur={() => {
                  setTimeout(() => {
                    setShowA(false);
                    autoCompleteInput(cityA, suggestionsA, setCityA, abortA);
                  }, 150);
                }}
              />
              {showA && suggestionsA.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-[1300] mt-2 rounded-xl border border-border bg-popover/95 shadow-xl backdrop-blur">
                  <ul className="max-h-56 overflow-auto py-1 text-xs text-foreground">
                    {suggestionsA.map((item, index) => (
                      <li
                        key={`a-${item.lat}-${item.lon}-${item.display_name ?? item.name ?? ''}-${index}`}
                      >
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-accent"
                          onMouseDown={(event) => {
                            event.preventDefault();
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
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    setShowB(false);
                    if (suggestionsB.length) {
                      const first = suggestionsB[0];
                      setCityB(first.display_name || first.name || cityB);
                      return;
                    }
                    autoCompleteInput(cityB, suggestionsB, setCityB, abortB);
                  }
                }}
                onFocus={() => {
                  if (suggestionsB.length) setShowB(true);
                }}
                onBlur={() => {
                  setTimeout(() => {
                    setShowB(false);
                    autoCompleteInput(cityB, suggestionsB, setCityB, abortB);
                  }, 150);
                }}
              />
              {showB && suggestionsB.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-[1300] mt-2 rounded-xl border border-border bg-popover/95 shadow-xl backdrop-blur">
                  <ul className="max-h-56 overflow-auto py-1 text-xs text-foreground">
                    {suggestionsB.map((item, index) => (
                      <li
                        key={`b-${item.lat}-${item.lon}-${item.display_name ?? item.name ?? ''}-${index}`}
                      >
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-accent"
                          onMouseDown={(event) => {
                            event.preventDefault();
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

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

        <div className="px-4 pb-4">
          {result && (
            <div className="space-y-2 text-sm text-foreground">
              <div className="grid gap-2 md:grid-cols-2">
                {[result.cityA, result.cityB].map((city) => (
                  <div
                    key={city.name}
                    className="rounded-xl border border-border/60 bg-card px-3 py-3 shadow-sm"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      {city.flagUrl && (
                        <img
                          src={city.flagUrl}
                          alt={`Bandera de ${city.name}`}
                          className="h-4 w-6 rounded-sm border border-border/60 object-cover"
                          loading="lazy"
                        />
                      )}
                      <span>{city.name}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {city.lat.toFixed(4)}, {city.lon.toFixed(4)}
                    </div>
                    <div className="mt-3 space-y-1 text-xs">
                      <div>
                        <span className="font-semibold text-foreground">Habitantes:</span>{' '}
                      {city.population ? city.population.toLocaleString('es-ES') : 'No disponible'}
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">Superficie:</span>{' '}
                      {city.areaKm2 ? `${city.areaKm2.toLocaleString('es-ES')} km²` : 'No disponible'}
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">Densidad:</span>{' '}
                      {city.density
                          ? `${city.density.toLocaleString('es-ES')} hab/km²`
                          : 'No disponible'}
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">Altitud:</span>{' '}
                      {city.elevation ? `${city.elevation.toLocaleString('es-ES')} m` : 'No disponible'}
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">Hombres (%):</span>{' '}
                      {city.malePercent !== null && city.malePercent !== undefined
                        ? `${city.malePercent.toLocaleString('es-ES')}%`
                        : 'No disponible'}
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">Mujeres (%):</span>{' '}
                      {city.femalePercent !== null && city.femalePercent !== undefined
                        ? `${city.femalePercent.toLocaleString('es-ES')}%`
                        : 'No disponible'}
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">Calidad del aire (AQI):</span>{' '}
                      {city.aqi !== null && city.aqi !== undefined
                        ? `${city.aqi}${city.aqiLabel ? ` (${city.aqiLabel})` : ''}`
                        : 'No disponible'}
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">Riesgo inundación:</span>{' '}
                      {formatRiskSummary(city)}
                    </div>
                    </div>
                  </div>
                ))}
              </div>

            <div className="rounded-xl border border-border/60 bg-card px-3 py-3 shadow-sm">
              <div className="text-sm font-semibold text-foreground">Comparación clave</div>
              <ul className="mt-2 space-y-1 text-xs text-foreground">
                {result.comparison.map((item, index) => (
                  <li key={`cmp-${index}`}>• {formatComparisonItem(item)}</li>
                ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
