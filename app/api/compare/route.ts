import { NextResponse } from 'next/server';

const AQICN_BASE = 'https://api.waqi.info/feed/geo:';

const fetchJson = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const fetchCityFacts = async (city: string) => {
  const searchEntity = async (language: string) => {
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
      city
    )}&language=${language}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'GeoAIAssistant/1.0',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.search?.[0]?.id ?? null;
  };

  const qid = (await searchEntity('es')) ?? (await searchEntity('en'));
  if (!qid) return null;

  const query = `
    SELECT ?population ?area ?elevation WHERE {
      OPTIONAL { wd:${qid} wdt:P1082 ?population. }
      OPTIONAL { wd:${qid} wdt:P2046 ?area. }
      OPTIONAL { wd:${qid} wdt:P2044 ?elevation. }
    }
    LIMIT 1
  `;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'GeoAIAssistant/1.0',
      Accept: 'application/sparql-results+json',
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const binding = data?.results?.bindings?.[0] ?? {};
  const population = binding.population?.value ? Number(binding.population.value) : null;
  const area = binding.area?.value ? Number(binding.area.value) : null;
  const elevation = binding.elevation?.value ? Number(binding.elevation.value) : null;
  return { population, area, elevation };
};

const classifyAqi = (value: number | null) => {
  if (value === null) return null;
  if (value <= 25) return 'Buena';
  if (value <= 50) return 'Razonablemente buena';
  if (value <= 75) return 'Regular';
  if (value <= 100) return 'Desfavorable';
  if (value <= 150) return 'Muy desfavorable';
  return 'Extremadamente desfavorable';
};

export async function POST(req: Request) {
  try {
    const { cityA, cityB } = await req.json();

    if (!cityA || !cityB) {
      return NextResponse.json({ error: 'Debe proporcionar dos ciudades' }, { status: 400 });
    }

    const normalizeInput = (value: string) => value.split(',')[0].trim();
    const inputA = normalizeInput(cityA);
    const inputB = normalizeInput(cityB);
    const labelA = cityA.trim();
    const labelB = cityB.trim();

    const origin = new URL(req.url).origin;
    const geocode = async (city: string) => {
      const res = await fetch(
        `${origin}/api/tools/buscarCoordenadas?direccion=${encodeURIComponent(city)}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `No se pudo encontrar ${city}`);
      }
      return res.json();
    };

    const suggestCity = async (city: string) => {
      const res = await fetch(
        `${origin}/api/tools/sugerencias?query=${encodeURIComponent(city)}&cityOnly=1`
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data?.results?.[0] ?? null;
    };

    const formatPlaceName = async (geo: any) => {
      try {
        const res = await fetch(
          `${origin}/api/tools/buscarCoordenadas?lat=${geo.lat}&lon=${geo.lon}&zoom=10`
        );
        if (!res.ok) return geo.display_name ?? geo.name ?? `${geo.lat}, ${geo.lon}`;
        const data = await res.json();
        return data.display_name ?? geo.display_name ?? geo.name ?? `${geo.lat}, ${geo.lon}`;
      } catch {
        return geo.display_name ?? geo.name ?? `${geo.lat}, ${geo.lon}`;
      }
    };

    let geoA: any;
    let geoB: any;
    try {
      const [suggestA, suggestB] = await Promise.all([suggestCity(inputA), suggestCity(inputB)]);
      geoA = suggestA ?? (await geocode(inputA));
      geoB = suggestB ?? (await geocode(inputB));
    } catch (err) {
      return NextResponse.json(
        { error: (err as Error).message || 'Error buscando ciudades' },
        { status: 400 }
      );
    }

    if (!geoA || !geoB) {
      return NextResponse.json(
        { error: 'No se pudieron resolver ambas ubicaciones.' },
        { status: 400 }
      );
    }

    const getCityData = async (geo: any, label: string, displayLabel: string) => {
      const lat = Number(geo.lat);
      const lon = Number(geo.lon);
      const name = displayLabel || label;

      const [urban, riesgo, facts, air] = await Promise.all([
        fetchJson(`${origin}/api/tools/capasUrbanismo?lat=${lat}&lon=${lon}`).catch(() => null),
        fetchJson(`${origin}/api/tools/riesgoInundacion?lat=${lat}&lon=${lon}`).catch(() => null),
        fetchCityFacts(label).catch(() => null),
        (async () => {
          const token = process.env.NEXT_PUBLIC_AQICN_TOKEN;
          if (!token) return null;
          const url = `${AQICN_BASE}${lat};${lon}/?token=${token}`;
          const data = await fetchJson(url).catch(() => null);
          if (!data || data.status !== 'ok') return null;
          const aqi = Number(data.data?.aqi);
          return Number.isFinite(aqi) ? aqi : null;
        })(),
      ]);

      const areaKm2 = facts?.area ? facts.area / 1_000_000 : null;
      const density =
        facts?.population && areaKm2 ? Math.round(facts.population / areaKm2) : null;

      return {
        name,
        lat,
        lon,
        population: facts?.population ?? null,
        areaKm2,
        density,
        elevation: facts?.elevation ?? null,
        aqi: air,
        risk: riesgo?.risk_level ?? null,
        urban: urban
          ? {
              source: urban.source ?? null,
              summary: urban.summary ?? null,
              details: urban.details ?? null,
            }
          : null,
      };
    };

    const [dataA, dataB] = await Promise.all([
      getCityData(geoA, inputA, labelA),
      getCityData(geoB, inputB, labelB),
    ]);

    const comparison: string[] = [];
    if (dataA.population && dataB.population) {
      const bigger =
        dataA.population > dataB.population
          ? dataA.name
          : dataA.population < dataB.population
            ? dataB.name
            : null;
      if (bigger) {
        comparison.push(
          `${bigger} tiene más población (${Math.max(dataA.population, dataB.population).toLocaleString(
            'es-ES'
          )}).`
        );
      } else {
        comparison.push('Ambas ciudades tienen una población similar.');
      }
    }

    if (dataA.aqi !== null && dataB.aqi !== null) {
      const better = dataA.aqi < dataB.aqi ? dataA.name : dataB.aqi < dataA.aqi ? dataB.name : null;
      if (better) {
        comparison.push(
          `${better} muestra mejor calidad del aire (AQI ${Math.min(dataA.aqi, dataB.aqi)}).`
        );
      } else {
        comparison.push('La calidad del aire es similar en ambas ciudades.');
      }
    }

    if (dataA.risk && dataB.risk) {
      comparison.push(
        `Riesgo de inundación: ${dataA.name} (${dataA.risk}) vs ${dataB.name} (${dataB.risk}).`
      );
    }

    if (dataA.urban?.summary || dataB.urban?.summary) {
      comparison.push(
        `Contexto urbano: ${dataA.name} (${dataA.urban?.summary ?? 'sin datos'}) vs ${
          dataB.name
        } (${dataB.urban?.summary ?? 'sin datos'}).`
      );
    }

    if (!comparison.length) {
      comparison.push('No hay datos suficientes para una comparación detallada.');
    }

    return NextResponse.json({
      cityA: {
        ...dataA,
        aqiLabel: classifyAqi(dataA.aqi),
      },
      cityB: {
        ...dataB,
        aqiLabel: classifyAqi(dataB.aqi),
      },
      comparison,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error comparando ciudades' }, { status: 500 });
  }
}
