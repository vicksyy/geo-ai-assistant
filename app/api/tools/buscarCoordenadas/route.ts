// app/api/tools/buscarCoordenadas/route.ts
import { NextResponse } from "next/server";

type CacheEntry = {
  data: any;
  ts: number;
};

const reverseCache = new Map<string, CacheEntry>();
const CACHE_TTL = 1000 * 60 * 60 * 6;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const direccion = searchParams.get("direccion");
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const zoom = searchParams.get("zoom") ?? "18";

  if (!direccion && (!lat || !lon)) {
    return NextResponse.json(
      { error: "Debe proporcionar una dirección o coordenadas" },
      { status: 400 }
    );
  }

  try {
    const fetchJson = async (url: string, headers?: Record<string, string>) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(url, {
          headers,
          signal: controller.signal,
        });
        const status = response.status;
        if (!response.ok) return { ok: false, status, json: null };
        const json = await response.json().catch(() => null);
        if (!json || json?.error) return { ok: false, status, json: null };
        return { ok: true, status, json };
      } catch {
        return { ok: false, status: 0, json: null };
      } finally {
        clearTimeout(timeout);
      }
    };

    if (lat && lon) {
      const latNum = Number(lat);
      const lonNum = Number(lon);
      if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
        return NextResponse.json({ error: "Coordenadas inválidas" }, { status: 400 });
      }

      const cacheKey = `${latNum.toFixed(4)},${lonNum.toFixed(4)},${zoom}`;
      const cached = reverseCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return NextResponse.json(cached.data);
      }

      const maptilerKey = process.env.MAPTILER_API_KEY;
      if (maptilerKey) {
        const maptilerUrl = `https://api.maptiler.com/geocoding/${lonNum},${latNum}.json?key=${encodeURIComponent(
          maptilerKey
        )}&language=es`;
        const maptiler = await fetchJson(maptilerUrl);
        if (maptiler?.ok && maptiler.json?.features?.length) {
          const feature = maptiler.json.features[0];
          const context = feature.context ?? [];
          const toTitle = (value?: string | null) => {
            if (!value) return value;
            if (!value.toUpperCase || value !== value.toUpperCase()) return value;
            return value
              .toLowerCase()
              .split(' ')
              .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
              .join(' ');
          };
          const pickContext = (prefix: string) =>
            context.find((c: any) => c.id?.startsWith(prefix))?.text;
          const streetName =
            feature.place_type?.includes('address') || feature.place_type?.includes('street')
              ? toTitle(feature.text)
              : null;
          const streetNumber =
            feature.properties?.address ?? feature.address ?? feature.properties?.housenumber ?? null;
          const district =
            pickContext('neighborhood') ||
            pickContext('district') ||
            pickContext('locality');
          const city =
            pickContext('place') ||
            pickContext('locality') ||
            pickContext('county') ||
            pickContext('region') ||
            feature.text ||
            feature.place_name;
          const state = pickContext('region') || pickContext('country');
          const resolvedCity = toTitle(city);
          const resolvedState = toTitle(state);
          const displayParts = [
            [streetName, streetNumber].filter(Boolean).join(' ').trim(),
            toTitle(district),
            resolvedCity,
            resolvedState && resolvedState !== resolvedCity ? resolvedState : null,
          ].filter((part) => part && part.length > 0);
          const placeName = displayParts.join(', ') || feature.place_name || feature.text;
          const payload = {
            lat: latNum,
            lon: lonNum,
            display_name: placeName ?? null,
            address: {
              road: streetName ?? null,
              house_number: streetNumber ?? null,
              neighbourhood: district ?? null,
              city: city ?? null,
              state: state ?? null,
              country: pickContext('country') ?? null,
            },
            place_rank: null,
            type: feature.place_type?.[0] ?? null,
            class: 'place',
          };
          reverseCache.set(cacheKey, { data: payload, ts: Date.now() });
          return NextResponse.json(payload);
        }
      }

      const email = process.env.NOMINATIM_EMAIL;
      const emailParam = email ? `&email=${encodeURIComponent(email)}` : '';
      const langParam = `&accept-language=es`;
      const nominatimHeaders = {
        'User-Agent': email
          ? `geo-ai-assistant/1.0 (${email})`
          : 'geo-ai-assistant/1.0',
        'Accept-Language': 'es',
        Accept: 'application/json',
      };
      const reverseUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        lat
      )}&lon=${encodeURIComponent(lon)}&zoom=${encodeURIComponent(
        zoom
      )}&addressdetails=1${emailParam}${langParam}`;
      const fallbackUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
        lat
      )}&lon=${encodeURIComponent(lon)}&zoom=14&addressdetails=1${emailParam}${langParam}`;

      const primary = await fetchJson(reverseUrl, nominatimHeaders);
      const fallback = primary.ok ? null : await fetchJson(fallbackUrl, nominatimHeaders);
      const data = primary.ok ? primary.json : fallback?.ok ? fallback?.json : null;

      if (!data) {
        const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
          lat
        )}&longitude=${encodeURIComponent(lon)}&localityLanguage=es`;
        const bdc = await fetchJson(bdcUrl);
        if (bdc?.ok && bdc.json) {
          const json = bdc.json;
          const city =
            json.city ||
            json.locality ||
            json.principalSubdivision ||
            json.localityInfo?.administrative?.[0]?.name;
          const region = json.principalSubdivision;
          const country = json.countryName;
          const display = [city, region, country].filter(Boolean).join(', ');
          return NextResponse.json({
            lat: latNum,
            lon: lonNum,
            display_name: display || null,
            address: {
              city,
              state: region,
              country,
            },
            place_rank: null,
            type: 'place',
            class: 'place',
          });
        }

        const hint = email ? '' : ' (configura NOMINATIM_EMAIL)';
        const fallbackPayload = {
          lat: latNum,
          lon: lonNum,
          display_name: null,
          address: null,
          place_rank: null,
          type: null,
          class: null,
          warning: `No se pudo resolver la dirección inversa${hint}`,
        };
        return NextResponse.json(fallbackPayload);
      }

      const payload = {
        lat: Number(data.lat ?? lat),
        lon: Number(data.lon ?? lon),
        display_name: data.display_name ?? null,
        address: data.address ?? null,
        place_rank: data.place_rank ?? null,
        type: data.type ?? null,
        class: data.class ?? null,
      };
      reverseCache.set(cacheKey, { data: payload, ts: Date.now() });
      return NextResponse.json(payload);
    }

    const direccionValue = direccion ?? "";
    const maptilerKey = process.env.MAPTILER_API_KEY;
    if (maptilerKey) {
      const maptilerUrl = `https://api.maptiler.com/geocoding/${encodeURIComponent(
        direccionValue
      )}.json?key=${encodeURIComponent(maptilerKey)}&language=es`;
      const maptiler = await fetchJson(maptilerUrl);
      if (maptiler?.ok && maptiler.json?.features?.length) {
        const feature = maptiler.json.features[0];
        return NextResponse.json({
          lat: feature.center?.[1],
          lon: feature.center?.[0],
          display_name: feature.place_name ?? feature.text ?? null,
          boundingbox: feature.bbox ?? null,
          place_rank: null,
          type: feature.place_type?.[0] ?? null,
          class: 'place',
        });
      }
    }
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      direccionValue
    )}&format=json&limit=1&addressdetails=1`;
    const nominatimHeaders = {
      'User-Agent': 'geo-ai-assistant/1.0',
      'Accept-Language': 'es',
    };
    let data: any = await fetchJson(nominatimUrl, nominatimHeaders);

    if (!data) {
      const mapsUrl = `https://geocode.maps.co/search?q=${encodeURIComponent(direccionValue)}`;
      data = await fetchJson(mapsUrl);
    }

    if (!Array.isArray(data) || !data.length) {
      return NextResponse.json({ error: "Dirección no encontrada" }, { status: 404 });
    }

    const result = data[0];

    return NextResponse.json({
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      display_name: result.display_name,
      boundingbox: result.boundingbox ?? null,
      place_rank: result.place_rank ?? null,
      type: result.type ?? null,
      class: result.class ?? null,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Error al buscar coordenadas" },
      { status: 500 }
    );
  }
}
