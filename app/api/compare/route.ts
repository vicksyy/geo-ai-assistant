import { NextResponse } from 'next/server';

const AQICN_BASE = 'https://api.waqi.info/feed/geo:';

const fetchJson = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const normalizeText = (value?: string | null) => {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const pickFirst = (...values: Array<string | null | undefined>) =>
  values.find((value) => value && value.length > 0) ?? null;

const parseCityCountry = (value: string) => {
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    city: parts[0] ?? null,
    country: parts.length > 1 ? parts[parts.length - 1] : null,
  };
};

const labelMatches = (label: string, target: string) => {
  const normalizedLabel = normalizeText(label);
  const normalizedTarget = normalizeText(target);
  if (!normalizedLabel || !normalizedTarget) return false;
  return (
    normalizedLabel === normalizedTarget ||
    normalizedLabel.startsWith(normalizedTarget) ||
    normalizedTarget.startsWith(normalizedLabel)
  );
};

const escapeSparqlString = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const parseNumber = (value: any) => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const parseTime = (value?: string | null) => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const pickLatest = (values: Array<{ value: number; time?: number | null }>) => {
  if (!values.length) return null;
  return (
    values.reduce((best, current) => {
      if (!best) return current;
      const bestTime = best.time ?? 0;
      const currentTime = current.time ?? 0;
      if (currentTime === bestTime) {
        return current.value > best.value ? current : best;
      }
      return currentTime > bestTime ? current : best;
    }, null as { value: number; time?: number | null } | null)?.value ?? null
  );
};

const convertAreaToKm2 = (amount: number, unitUri?: string | null) => {
  if (!Number.isFinite(amount)) return null;
  const unitId = unitUri ? unitUri.split('/').pop() : null;
  if (unitId === 'Q712226') return amount;
  if (unitId === 'Q11573') return amount / 1_000_000;
  if (unitId === 'Q35852') return amount / 100;
  if (amount > 10000) return amount / 1_000_000;
  return amount;
};

const searchWikidataCountryQid = async (country: string) => {
  const languages = ['es', 'en'];
  const fetchResults = async (term: string, language: string) => {
    const safeTerm = escapeSparqlString(term);
    const query = `
      SELECT ?item ?itemLabel WHERE {
        SERVICE wikibase:mwapi {
          bd:serviceParam wikibase:endpoint "www.wikidata.org";
          wikibase:api "EntitySearch";
          mwapi:search "${safeTerm}";
          mwapi:language "${language}";
          mwapi:limit "5".
          ?item wikibase:apiOutputItem mwapi:item.
        }
        ?item wdt:P31/wdt:P279* wd:Q6256.
        SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
      }
    `;
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(
      query
    )}`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'GeoAIAssistant/1.0',
          Accept: 'application/sparql-results+json',
        },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data?.results?.bindings ?? [];
    } catch {
      return [];
    }
  };

  for (const language of languages) {
    const bindings = await fetchResults(country, language);
    if (!bindings.length) continue;
    const candidates = bindings.map((binding: any) => ({
      qid: binding.item?.value?.split('/').pop() ?? null,
      label: binding.itemLabel?.value ?? '',
    }));
    const picked =
      candidates.find((item) => labelMatches(item.label, country)) ?? candidates[0];
    if (picked?.qid) return picked.qid;
  }
  return null;
};

const searchWikidataCity = async (city: string, country?: string | null) => {
  const searchTerms: string[] = [];
  if (city && country) searchTerms.push(`${city}, ${country}`);
  if (city) searchTerms.push(city);
  const languages = ['es', 'en'];
  const countryQid = country ? await searchWikidataCountryQid(country) : null;

  const fetchResults = async (
    term: string,
    language: string,
    countryFilter?: string | null
  ) => {
    const safeTerm = escapeSparqlString(term);
    const query = `
      SELECT ?item ?itemLabel ?countryLabel WHERE {
        SERVICE wikibase:mwapi {
          bd:serviceParam wikibase:endpoint "www.wikidata.org";
          wikibase:api "EntitySearch";
          mwapi:search "${safeTerm}";
          mwapi:language "${language}";
          mwapi:limit "10".
          ?item wikibase:apiOutputItem mwapi:item.
        }
        ?item wdt:P31/wdt:P279* wd:Q515.
        ${countryFilter ? `?item wdt:P17 wd:${countryFilter}.` : ''}
        OPTIONAL { ?item wdt:P17 ?country. }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
      }
    `;
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'GeoAIAssistant/1.0',
          Accept: 'application/sparql-results+json',
        },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data?.results?.bindings ?? [];
    } catch {
      return [];
    }
  };

  for (const term of searchTerms) {
    for (const language of languages) {
      let bindings = await fetchResults(term, language, countryQid);
      let usedFallback = false;
      if (country && countryQid && !bindings.length) {
        bindings = await fetchResults(term, language, null);
        usedFallback = true;
      }
      if (!bindings.length) continue;
      const candidates = bindings.map((binding: any) => ({
        qid: binding.item?.value?.split('/').pop() ?? null,
        label: binding.itemLabel?.value ?? '',
        countryLabel: binding.countryLabel?.value ?? '',
      }));
      let filtered = candidates;
      if (country && (!countryQid || usedFallback)) {
        filtered = candidates.filter((item) => labelMatches(item.countryLabel, country));
      }
      if (country && filtered.length === 0) continue;
      const picked =
        filtered.find((item) => labelMatches(item.label, city)) ??
        filtered[0];
      if (picked?.qid) return picked.qid;
    }
  }
  return null;
};

const fetchCityFacts = async (params: {
  label?: string | null;
  city?: string | null;
  country?: string | null;
}) => {
  const label = params.label ?? null;
  const city = params.city ?? null;
  const country = params.country ?? null;
  const parsedLabel = label ? parseCityCountry(label) : { city: null, country: null };
  const searchCity = city || parsedLabel.city;
  const searchCountry = country || parsedLabel.country;

  if (!searchCity) return null;
  const qid = await searchWikidataCity(searchCity, searchCountry);
  if (!qid) return null;

  const query = `
    SELECT ?population ?populationTime ?male ?maleTime ?female ?femaleTime ?areaAmount ?areaUnit ?areaSimple ?elevation ?flag ?countryFlag WHERE {
      OPTIONAL {
        wd:${qid} p:P1082 ?popStmt.
        ?popStmt ps:P1082 ?population.
        OPTIONAL { ?popStmt pq:P585 ?populationTime. }
      }
      OPTIONAL {
        wd:${qid} p:P1539 ?maleStmt.
        ?maleStmt ps:P1539 ?male.
        OPTIONAL { ?maleStmt pq:P585 ?maleTime. }
      }
      OPTIONAL {
        wd:${qid} p:P1540 ?femaleStmt.
        ?femaleStmt ps:P1540 ?female.
        OPTIONAL { ?femaleStmt pq:P585 ?femaleTime. }
      }
      OPTIONAL {
        wd:${qid} p:P2046 ?areaStmt.
        ?areaStmt psv:P2046 ?areaNode.
        ?areaNode wikibase:quantityAmount ?areaAmount;
                  wikibase:quantityUnit ?areaUnit.
      }
      OPTIONAL { wd:${qid} wdt:P2046 ?areaSimple. }
      OPTIONAL { wd:${qid} wdt:P2044 ?elevation. }
      OPTIONAL { wd:${qid} wdt:P41 ?flag. }
      OPTIONAL { wd:${qid} wdt:P17 ?country. ?country wdt:P41 ?countryFlag. }
    }
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
  const bindings = data?.results?.bindings ?? [];
  if (!bindings.length) return null;

  const populations: Array<{ value: number; time?: number | null }> = [];
  const males: Array<{ value: number; time?: number | null }> = [];
  const females: Array<{ value: number; time?: number | null }> = [];
  const areaValues: Array<{ value: number; unit?: string | null }> = [];
  const areaSimpleValues: number[] = [];
  let elevation: number | null = null;
  let flagUrl: string | null = null;

  for (const binding of bindings) {
    const population = parseNumber(binding.population?.value);
    if (population) {
      populations.push({ value: population, time: parseTime(binding.populationTime?.value) });
    }
    const male = parseNumber(binding.male?.value);
    if (male) {
      males.push({ value: male, time: parseTime(binding.maleTime?.value) });
    }
    const female = parseNumber(binding.female?.value);
    if (female) {
      females.push({ value: female, time: parseTime(binding.femaleTime?.value) });
    }
    const areaAmount = parseNumber(binding.areaAmount?.value);
    if (areaAmount) {
      areaValues.push({ value: areaAmount, unit: binding.areaUnit?.value ?? null });
    }
    const areaSimple = parseNumber(binding.areaSimple?.value);
    if (areaSimple) {
      areaSimpleValues.push(areaSimple);
    }
    if (elevation === null) {
      elevation = parseNumber(binding.elevation?.value);
    }
    if (!flagUrl) {
      flagUrl = binding.flag?.value ?? binding.countryFlag?.value ?? null;
    }
  }

  const population = pickLatest(populations);
  const male = pickLatest(males);
  const female = pickLatest(females);
  const total = population ?? (male && female ? male + female : null);
  const malePercent =
    male && female ? Math.round((male / (male + female)) * 1000) / 10 : null;
  const femalePercent =
    male && female ? Math.round((female / (male + female)) * 1000) / 10 : null;
  const areaFromUnits = areaValues
    .map((entry) => convertAreaToKm2(entry.value, entry.unit))
    .filter((value): value is number => Number.isFinite(value));
  const areaFromSimple = areaSimpleValues
    .map((value) => convertAreaToKm2(value, null))
    .filter((value): value is number => Number.isFinite(value));
  const combinedAreas = [...areaFromUnits, ...areaFromSimple];
  const areaKm2 = combinedAreas.length ? Math.max(...combinedAreas) : null;

  return {
    population: total ?? null,
    areaKm2,
    elevation,
    malePercent,
    femalePercent,
    flagUrl,
  };
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

    const normalizeInput = (value: string) => value.trim();
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
      const address = geo.address ?? {};
      const labelParts = parseCityCountry(name);
      const cityName = pickFirst(
        geo.city_name,
        address.city,
        address.town,
        address.village,
        address.municipality,
        address.locality,
        labelParts.city
      );
      const countryName = pickFirst(geo.country_name, address.country, labelParts.country);

      const [urban, riesgo, facts, air] = await Promise.all([
        fetchJson(`${origin}/api/tools/capasUrbanismo?lat=${lat}&lon=${lon}`).catch(() => null),
        fetchJson(`${origin}/api/tools/riesgoInundacion?lat=${lat}&lon=${lon}`).catch(() => null),
        fetchCityFacts({
          label: name,
          city: cityName,
          country: countryName,
        }).catch(() => null),
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

      const areaKm2 = facts?.areaKm2 ?? null;
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
        malePercent: facts?.malePercent ?? null,
        femalePercent: facts?.femalePercent ?? null,
        flagUrl: facts?.flagUrl ?? null,
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

    if (dataA.areaKm2 && dataB.areaKm2) {
      const bigger =
        dataA.areaKm2 > dataB.areaKm2
          ? dataA.name
          : dataA.areaKm2 < dataB.areaKm2
            ? dataB.name
            : null;
      if (bigger) {
        comparison.push(
          `${bigger} tiene mayor superficie (${Math.max(dataA.areaKm2, dataB.areaKm2).toLocaleString(
            'es-ES',
            { maximumFractionDigits: 1 }
          )} km²).`
        );
      } else {
        comparison.push('Ambas ciudades tienen una superficie similar.');
      }
    }

    if (dataA.density && dataB.density) {
      const denser =
        dataA.density > dataB.density
          ? dataA.name
          : dataA.density < dataB.density
            ? dataB.name
            : null;
      if (denser) {
        comparison.push(
          `${denser} tiene mayor densidad (${Math.max(dataA.density, dataB.density).toLocaleString(
            'es-ES'
          )} hab/km²).`
        );
      } else {
        comparison.push('Ambas ciudades tienen una densidad similar.');
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
