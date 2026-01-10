// app/api/tools/capasUrbanismo/route.ts
import { NextResponse } from "next/server";

const IGN_WMS = "https://www.ign.es/wms-inspire/ign-base";
const IGN_LAYER = "IGNBaseTodo";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json({ error: "Debe proporcionar lat y lon" }, { status: 400 });
  }

  const latNum = Number(lat);
  const lonNum = Number(lon);
  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
    return NextResponse.json({ error: "Coordenadas inválidas" }, { status: 400 });
  }

  const buildIgnUrl = () => {
    const delta = 0.02;
    const minLat = latNum - delta;
    const maxLat = latNum + delta;
    const minLon = lonNum - delta;
    const maxLon = lonNum + delta;
    const bbox = `${minLat},${minLon},${maxLat},${maxLon}`;
    return `${IGN_WMS}?SERVICE=WMS&REQUEST=GetFeatureInfo&VERSION=1.3.0&CRS=EPSG:4326&BBOX=${bbox}&WIDTH=101&HEIGHT=101&I=50&J=50&LAYERS=${IGN_LAYER}&QUERY_LAYERS=${IGN_LAYER}&INFO_FORMAT=application/json`;
  };

  const fetchIgn = async () => {
    const url = buildIgnUrl();
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { text, json };
  };

  const fetchOverpass = async () => {
    const radius = 600;
    const query = `
      [out:json][timeout:25];
      (
        way(around:${radius},${latNum},${lonNum})["landuse"];
        relation(around:${radius},${latNum},${lonNum})["landuse"];
        node(around:${radius},${latNum},${lonNum})["amenity"];
        way(around:${radius},${latNum},${lonNum})["amenity"];
        relation(around:${radius},${latNum},${lonNum})["amenity"];
        way(around:${radius},${latNum},${lonNum})["building"];
        relation(around:${radius},${latNum},${lonNum})["building"];
      );
      out tags;
    `;

    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: query,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { radius, data };
  };

  try {
    const ign = await fetchIgn();
    if (ign?.json?.features?.length) {
      const props = ign.json.features[0]?.properties ?? {};
      return NextResponse.json({
        source: "IGN WMS",
        method: "GetFeatureInfo",
        summary: "Resultado obtenido desde IGN Base.",
        details: props,
      });
    }

    const overpass = await fetchOverpass();
    if (!overpass) {
      return NextResponse.json({
        source: "IGN WMS",
        summary: "No se pudo obtener información de urbanismo.",
        details: ign?.text ? { raw: ign.text.slice(0, 400) } : null,
      });
    }

    const landuseCounts: Record<string, number> = {};
    const amenityCounts: Record<string, number> = {};
    let buildingCount = 0;

    for (const element of overpass.data?.elements ?? []) {
      const tags = element.tags ?? {};
      if (tags.landuse) {
        landuseCounts[tags.landuse] = (landuseCounts[tags.landuse] ?? 0) + 1;
      }
      if (tags.amenity) {
        amenityCounts[tags.amenity] = (amenityCounts[tags.amenity] ?? 0) + 1;
      }
      if (tags.building) buildingCount += 1;
    }

    const topEntries = (counts: Record<string, number>, limit: number) =>
      Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([key, value]) => ({ type: key, count: value }));

    return NextResponse.json({
      source: "OpenStreetMap (Overpass)",
      method: "Consulta de entorno",
      summary: "Resumen de usos del suelo y equipamientos cercanos.",
      details: {
        radius_m: overpass.radius,
        landuse: topEntries(landuseCounts, 5),
        amenities: topEntries(amenityCounts, 5),
        building_count: buildingCount,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Error al consultar urbanismo" },
      { status: 500 }
    );
  }
}
