import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query');
  const cityOnly = searchParams.get('cityOnly') === '1';

  if (!query) {
    return NextResponse.json({ error: 'Debe proporcionar una busqueda' }, { status: 400 });
  }

  try {
    const baseParams = `format=json&addressdetails=1&dedupe=1&limit=50`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&${baseParams}`;
    const cityUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&${baseParams}&featuretype=city`;

    const headers = {
      'User-Agent': 'geo-ai-assistant/1.0',
      'Accept-Language': 'es',
    };

    const fetchWithTimeout = async (requestUrl: string, timeoutMs: number) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(requestUrl, { headers, signal: controller.signal });
        if (!res.ok) return [];
        return await res.json();
      } catch {
        return [];
      } finally {
        clearTimeout(timeout);
      }
    };

    const [generalData, cityData] = await Promise.all([
      fetchWithTimeout(url, 900),
      fetchWithTimeout(cityUrl, 900),
    ]);
    const data = [...cityData, ...generalData];

    const normalize = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const normalizedQuery = normalize(query);
    const queryHasLatin = /[a-z]/i.test(query);
    const placeBoostTypes = new Set([
      'city',
      'town',
      'village',
      'municipality',
      'capital',
      'country',
      'state',
      'region',
    ]);
    const cityTypes = new Set(['city', 'town', 'village', 'municipality']);
    const popularCities = [
      { name: 'Madrid', region: 'Comunidad de Madrid', country: 'Espana', lat: 40.4168, lon: -3.7038 },
      { name: 'Barcelona', region: 'Cataluna', country: 'Espana', lat: 41.3874, lon: 2.1686 },
      { name: 'Valencia', region: 'Comunidad Valenciana', country: 'Espana', lat: 39.4699, lon: -0.3763 },
      { name: 'Sevilla', region: 'Andalucia', country: 'Espana', lat: 37.3891, lon: -5.9845 },
      { name: 'Zaragoza', region: 'Aragon', country: 'Espana', lat: 41.6488, lon: -0.8891 },
      { name: 'Malaga', region: 'Andalucia', country: 'Espana', lat: 36.7213, lon: -4.4214 },
      { name: 'Bilbao', region: 'Pais Vasco', country: 'Espana', lat: 43.2630, lon: -2.9350 },
      { name: 'Granada', region: 'Andalucia', country: 'Espana', lat: 37.1773, lon: -3.5986 },
      { name: 'Alicante', region: 'Comunidad Valenciana', country: 'Espana', lat: 38.3452, lon: -0.4810 },
      { name: 'Murcia', region: 'Region de Murcia', country: 'Espana', lat: 37.9922, lon: -1.1307 },
      { name: 'Palma', region: 'Islas Baleares', country: 'Espana', lat: 39.5696, lon: 2.6502 },
      { name: 'Las Palmas', region: 'Canarias', country: 'Espana', lat: 28.1235, lon: -15.4363 },
      { name: 'Paris', region: 'Ile-de-France', country: 'Francia', lat: 48.8566, lon: 2.3522 },
      { name: 'Londres', region: 'Inglaterra', country: 'Reino Unido', lat: 51.5072, lon: -0.1276 },
      { name: 'Roma', region: 'Lacio', country: 'Italia', lat: 41.9028, lon: 12.4964 },
      { name: 'Berlin', region: 'Berlin', country: 'Alemania', lat: 52.5200, lon: 13.4050 },
      { name: 'Nueva York', region: 'Nueva York', country: 'Estados Unidos', lat: 40.7128, lon: -74.0060 },
      { name: 'Los Angeles', region: 'California', country: 'Estados Unidos', lat: 34.0522, lon: -118.2437 },
      { name: 'Tokyo', region: 'Tokyo', country: 'Japon', lat: 35.6762, lon: 139.6503 },
      { name: 'Ciudad de Mexico', region: 'CDMX', country: 'Mexico', lat: 19.4326, lon: -99.1332 },
      { name: 'Buenos Aires', region: 'Buenos Aires', country: 'Argentina', lat: -34.6037, lon: -58.3816 },
      { name: 'Sao Paulo', region: 'Sao Paulo', country: 'Brasil', lat: -23.5505, lon: -46.6333 },
    ];

    const popularMatches = popularCities
      .map((city) => {
        const label = `${city.name}, ${city.region}, ${city.country}`;
        const normalizedLabel = normalize(label);
        const normalizedName = normalize(city.name);
        let score = 0;
        if (normalizedName.startsWith(normalizedQuery)) score += 2;
        if (normalizedLabel.startsWith(normalizedQuery)) score += 1.5;
        if (normalizedLabel.includes(normalizedQuery)) score += 1;
        return {
          display_name: label,
          name: city.name,
          lat: city.lat,
          lon: city.lon,
          boundingbox: null,
          place_rank: 16,
          type: 'city',
          class: 'place',
          importance: 1,
          score: score ? score + 5 : 0,
        };
      })
      .filter((item) => item.score > 0);

    const results = (data ?? [])
      .map((item: any) => {
        const name = item.name ?? item.address?.road ?? '';
        const label = item.display_name ?? '';
        const normalizedName = normalize(name);
        const normalizedLabel = normalize(label);
        const importance = Number(item.importance ?? 0);
        const labelHasLatin = /[a-z]/i.test(label);
        const primaryToken = normalizedLabel.split(' ')[0] ?? '';

        let score = importance;
        if (item.class === 'place' && placeBoostTypes.has(item.type)) score += 0.8;
        if (item.class === 'place' && cityTypes.has(item.type)) score += 0.4;
        if (normalizedName.startsWith(normalizedQuery)) score += 0.4;
        if (normalizedLabel.startsWith(normalizedQuery)) score += 0.2;
        if (primaryToken.startsWith(normalizedQuery)) score += 0.3;
        if (queryHasLatin && !labelHasLatin) score -= 0.6;
        if (item.class === 'aeroway') score -= 0.6;

        return {
          display_name: label,
          name,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          boundingbox: item.boundingbox ?? null,
          place_rank: item.place_rank ?? null,
          type: item.type ?? null,
          class: item.class ?? null,
          importance,
          score,
        };
      })
      .sort((a: any, b: any) => b.score - a.score);

    const merged = [...popularMatches, ...results];
    const placeResults = merged.filter((item: any) => item.class === 'place');
    const cityResults = placeResults.filter((item: any) => cityTypes.has(item.type));

    let filtered = merged;
    if (cityOnly) {
      filtered = cityResults.length ? cityResults : placeResults;
    } else if (normalizedQuery.length >= 3 && placeResults.length) {
      filtered = placeResults;
    }

    if (cityOnly && !filtered.length) {
      const firstChar = normalizedQuery[0] ?? '';
      filtered = popularCities
        .filter((city) => normalize(city.name).startsWith(firstChar))
        .slice(0, 3)
        .map((city) => ({
          display_name: `${city.name}, ${city.region}, ${city.country}`,
          name: city.name,
          lat: city.lat,
          lon: city.lon,
          boundingbox: null,
          place_rank: 16,
          type: 'city',
          class: 'place',
          importance: 1,
          score: 4,
        }));
    }

    const unique = new Map<string, any>();
    for (const item of filtered) {
      const key = `${item.lat}-${item.lon}-${item.display_name}`;
      if (!unique.has(key)) unique.set(key, item);
    }
    const finalResults = Array.from(unique.values()).slice(0, 12);

    return NextResponse.json({ results: finalResults });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error al buscar sugerencias' }, { status: 500 });
  }
}
