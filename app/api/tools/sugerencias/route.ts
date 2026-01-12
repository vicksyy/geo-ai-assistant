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

    const splitLabelParts = (label: string) =>
      label
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);

    const deriveCityCountryFromLabel = (item: any) => {
      const label = typeof item.display_name === 'string' ? item.display_name : '';
      if (!label) return null;
      const parts = splitLabelParts(label);
      if (parts.length < 2) return null;
      const city = parts[0];
      const country = parts[parts.length - 1];
      if (!city || !country) return null;
      if (normalize(city) === normalize(country)) return null;
      if (!cityTypes.has(item.type)) return null;
      return { city, country };
    };

    const getCityName = (item: any, cityOnlyMode = false) => {
      if (!item) return null;
      const address = item.address ?? {};
      const addressCity =
        address.city ??
        address.town ??
        address.village ??
        address.municipality ??
        address.locality ??
        null;
      if (cityOnlyMode) {
        if (addressCity) return addressCity;
        return deriveCityCountryFromLabel(item)?.city ?? null;
      }
      const label = typeof item.display_name === 'string' ? item.display_name : '';
      return (
        addressCity ??
        item.name ??
        (label ? label.split(',')[0]?.trim() : null) ??
        null
      );
    };

    const getCountryName = (item: any, cityOnlyMode = false) => {
      if (!item) return null;
      const address = item.address ?? {};
      if (cityOnlyMode) {
        return address.country ?? item.country ?? deriveCityCountryFromLabel(item)?.country ?? null;
      }
      const label = typeof item.display_name === 'string' ? item.display_name : '';
      return (
        address.country ??
        item.country ??
        (label ? label.split(',').slice(-1)[0]?.trim() : null) ??
        null
      );
    };

    const maptilerKey = process.env.MAPTILER_API_KEY;
    let maptilerData: any[] = [];
    if (maptilerKey) {
      const maptilerUrl = `https://api.maptiler.com/geocoding/${encodeURIComponent(
        query
      )}.json?key=${encodeURIComponent(maptilerKey)}&language=es`;
      const maptilerRes = await fetchWithTimeout(maptilerUrl, 900);
      maptilerData = (maptilerRes?.features ?? []).map((feature: any) => {
        const placeType = feature.place_type ?? [];
        const isCityLike = placeType.includes('place') || placeType.includes('locality');
        const context = feature.context ?? [];
        const country = context.find((item: any) =>
          String(item?.id ?? '').startsWith('country')
        )?.text;
        const cityName = isCityLike ? feature.text ?? '' : null;
        return {
          display_name: feature.place_name ?? feature.text ?? '',
          name: feature.text ?? '',
          lat: feature.center?.[1],
          lon: feature.center?.[0],
          boundingbox: feature.bbox ?? null,
          place_rank: null,
          type: isCityLike ? 'city' : placeType[0] ?? null,
          class: 'place',
          importance: 1,
          address: {
            city: cityName ?? null,
            country: country ?? null,
          },
          country: country ?? null,
        };
      });
    }

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
    const cityTypes = new Set(['city', 'town', 'village', 'municipality', 'locality']);
    const isStreetQuery = /(calle|avenida|av\.|av |carrer|paseo|plaza|ramblas|rambla|pasaje|trav|travesia|camino)/i.test(
      query
    );
    const results = [...(data ?? []), ...maptilerData]
      .map((item: any) => {
        const name = item.name ?? item.address?.road ?? '';
        const label = item.display_name ?? '';
        const cityName = getCityName(item, cityOnly);
        const countryName = getCountryName(item, cityOnly);
        const cityLabel = cityName && countryName ? `${cityName}, ${countryName}` : null;
        const displayLabel = cityOnly && cityLabel ? cityLabel : label;
        const normalizedName = normalize(name);
        const normalizedLabel = normalize(displayLabel);
        const importance = Number(item.importance ?? 0);
        const labelHasLatin = /[a-z]/i.test(displayLabel);
        const primaryToken = normalizedLabel.split(' ')[0] ?? '';

        let score = importance;
        if (item.class === 'place' && placeBoostTypes.has(item.type)) score += 0.6;
        if (item.class === 'place' && cityTypes.has(item.type)) score += 0.3;
        if (normalizedName.startsWith(normalizedQuery)) score += 0.4;
        if (normalizedLabel.startsWith(normalizedQuery)) score += 0.2;
        if (primaryToken.startsWith(normalizedQuery)) score += 0.3;
        if (queryHasLatin && !labelHasLatin) score -= 0.6;
        if (item.class === 'aeroway') score -= 0.6;
        if (isStreetQuery && item.class === 'place') score -= 0.4;

        return {
          display_name: displayLabel,
          name: cityOnly && cityName ? cityName : name,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          boundingbox: item.boundingbox ?? null,
          place_rank: item.place_rank ?? null,
          type: item.type ?? null,
          class: item.class ?? null,
          importance,
          score,
          address: item.address ?? null,
          country: item.country ?? null,
          osm_id: item.osm_id ?? null,
          osm_type: item.osm_type ?? null,
          place_id: item.place_id ?? null,
          city_name: cityName ?? null,
          country_name: countryName ?? null,
        };
      })
      .sort((a: any, b: any) => b.score - a.score);

    const merged = [...results];
    const cityResults = merged.filter((item: any) => item.city_name && item.country_name);

    let filtered = merged;
    if (cityOnly) {
      filtered = cityResults;
    }

    if (cityOnly) {
      filtered = cityResults;
    }

    const unique = new Map<string, any>();
    for (const item of filtered) {
      const cityName = item.city_name;
      const countryName = item.country_name;
      const key = cityOnly
        ? `${normalize(cityName ?? '')}|${normalize(countryName ?? '')}`
        : `${item.lat}-${item.lon}-${item.display_name}`;
      if (!unique.has(key)) unique.set(key, item);
    }
    const finalResults = Array.from(unique.values()).slice(0, 12);

    return NextResponse.json({ results: finalResults });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error al buscar sugerencias' }, { status: 500 });
  }
}
