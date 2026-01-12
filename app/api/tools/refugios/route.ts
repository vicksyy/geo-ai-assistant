import { NextResponse } from "next/server";

const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter",
];

type CacheEntry = {
  ts: number;
  data: any;
};

const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL = 1000 * 60 * 5;

type ShelterItem = {
  id: string;
  lat: number;
  lon: number;
  category: "emergency" | "amenity" | "bunker";
  name?: string | null;
  typeLabel?: string | null;
  tags?: Record<string, string>;
};

const parseBbox = (value: string | null) => {
  if (!value) return null;
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4) return null;
  const [south, west, north, east] = parts;
  if (![south, west, north, east].every((n) => Number.isFinite(n))) return null;
  if (south >= north || west >= east) return null;
  return { south, west, north, east };
};

const buildOverpassQuery = (bbox: { south: number; west: number; north: number; east: number }) => {
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  return `
    [out:json][timeout:25];
    (
      node["emergency"="shelter"](${box});
      way["emergency"="shelter"](${box});
      relation["emergency"="shelter"](${box});
      node["amenity"="shelter"](${box});
      way["amenity"="shelter"](${box});
      relation["amenity"="shelter"](${box});
      node["military"="bunker"](${box});
      way["military"="bunker"](${box});
      relation["military"="bunker"](${box});
    );
    out center tags;
  `;
};

const getCategory = (tags: Record<string, string>) => {
  if (tags.emergency === "shelter") return "emergency";
  if (tags.military === "bunker") return "bunker";
  return "amenity";
};

const getLabel = (tags: Record<string, string>) => {
  if (tags.emergency === "shelter") return "Refugio de emergencia";
  if (tags.amenity === "shelter") return "Refugio";
  if (tags.military === "bunker") return "Bunker";
  return null;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bbox = parseBbox(searchParams.get("bbox"));
  const cacheKey = bbox
    ? `${bbox.south.toFixed(3)},${bbox.west.toFixed(3)},${bbox.north.toFixed(
        3
      )},${bbox.east.toFixed(3)}`
    : null;

  if (!bbox) {
    return NextResponse.json({ error: "Debe proporcionar bbox valido" }, { status: 400 });
  }

  if (cacheKey) {
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }
  }

  try {
    const query = buildOverpassQuery(bbox);
    let data: any = null;
    let lastStatus = 502;

    for (const url of OVERPASS_URLS) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: query,
          signal: controller.signal,
        });
        lastStatus = res.status;
        if (!res.ok) continue;
        data = await res.json();
        if (data) break;
      } catch {
        // try next endpoint
      } finally {
        clearTimeout(timeout);
      }
    }

    if (!data) {
      return NextResponse.json({ error: "Error en Overpass" }, { status: lastStatus || 502 });
    }
    const items: ShelterItem[] = [];

    for (const element of data?.elements ?? []) {
      const tags = element.tags ?? {};
      const category = getCategory(tags);
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const name = tags.name ?? tags["name:es"] ?? null;
      items.push({
        id: `${element.type}-${element.id}`,
        lat,
        lon,
        category,
        name,
        typeLabel: getLabel(tags),
        tags,
      });
    }

    const priority: Record<ShelterItem["category"], number> = {
      emergency: 0,
      amenity: 1,
      bunker: 2,
    };

    items.sort((a, b) => priority[a.category] - priority[b.category]);

    const payload = {
      source: "OpenStreetMap (Overpass)",
      count: items.length,
      items: items.slice(0, 1200),
    };
    if (cacheKey) {
      responseCache.set(cacheKey, { ts: Date.now(), data: payload });
    }
    return NextResponse.json(payload);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error al consultar refugios" }, { status: 500 });
  }
}
