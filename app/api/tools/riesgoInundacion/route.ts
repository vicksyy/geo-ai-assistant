// app/api/tools/riesgoInundacion/route.ts
import { NextResponse } from "next/server";

const COPERNICUS_WMS = "https://ows.globalfloods.eu/glofas-ows/ows.py";
const COPERNICUS_LAYER = "FloodHazard100y";

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

  const buildUrl = () => {
    const delta = 0.02;
    const minLat = latNum - delta;
    const maxLat = latNum + delta;
    const minLon = lonNum - delta;
    const maxLon = lonNum + delta;
    const bbox = `${minLat},${minLon},${maxLat},${maxLon}`;
    return `${COPERNICUS_WMS}?SERVICE=WMS&REQUEST=GetFeatureInfo&VERSION=1.3.0&CRS=EPSG:4326&BBOX=${bbox}&WIDTH=101&HEIGHT=101&I=50&J=50&LAYERS=${COPERNICUS_LAYER}&QUERY_LAYERS=${COPERNICUS_LAYER}&INFO_FORMAT=application/json`;
  };

  const extractNumeric = (payload: any, rawText: string) => {
    if (payload?.features?.length) {
      const props = payload.features[0]?.properties ?? {};
      for (const value of Object.values(props)) {
        if (typeof value === "number" && Number.isFinite(value)) return value;
        if (typeof value === "string") {
          const parsed = Number(value);
          if (Number.isFinite(parsed)) return parsed;
        }
      }
    }

    const match = rawText.match(/-?\d+(\.\d+)?/);
    if (match) return Number(match[0]);
    return null;
  };

  const classifyRisk = (value: number | null) => {
    if (value === null) return "Desconocido";
    if (value <= 0) return "Muy bajo";
    if (value <= 0.2) return "Bajo";
    if (value <= 0.5) return "Medio";
    if (value <= 0.8) return "Alto";
    return "Muy alto";
  };

  try {
    const url = buildUrl();
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json(
        { error: "No se pudo consultar Copernicus" },
        { status: 502 }
      );
    }
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    const value = extractNumeric(json, text);

    return NextResponse.json({
      source: "Copernicus GloFAS WMS",
      method: "GetFeatureInfo",
      layer: COPERNICUS_LAYER,
      value,
      risk_level: classifyRisk(value),
      scale_note: "Indice relativo, interpretacion aproximada",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Error al consultar riesgo de inundacion" },
      { status: 500 }
    );
  }
}
