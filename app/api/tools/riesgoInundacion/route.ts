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

  const fetchWithTimeout = async (url: string, timeoutMs = 6000) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "GeoAIAssistant/1.0",
          Accept: "application/json",
        },
      });
      const text = await res.text();
      return { ok: res.ok, status: res.status, text };
    } catch (err) {
      return { ok: false, status: 0, text: "", error: err };
    } finally {
      clearTimeout(timeout);
    }
  };

  try {
    const url = buildUrl();
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      return NextResponse.json({
        source: "Copernicus GloFAS WMS",
        method: "GetFeatureInfo",
        layer: COPERNICUS_LAYER,
        value: null,
        risk_level: "Desconocido",
        scale_note: "Indice relativo, interpretacion aproximada",
        warning:
          response.status > 0
            ? `HTTP ${response.status}`
            : "No se pudo consultar Copernicus",
      });
    }

    const text = response.text ?? "";
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    let value = extractNumeric(json, text);
    if (value !== null && value < 0) value = null;

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
    return NextResponse.json({
      source: "Copernicus GloFAS WMS",
      method: "GetFeatureInfo",
      layer: COPERNICUS_LAYER,
      value: null,
      risk_level: "Desconocido",
      scale_note: "Indice relativo, interpretacion aproximada",
      warning: "Error al consultar riesgo de inundacion",
    });
  }
}
