// app/api/tools/riesgoInundacion/route.ts
import { NextResponse } from "next/server";

const MITECO_WMS = "https://wms.mapama.gob.es/sig/agua/ZI_ARPSI";
const MITECO_LAYER = "NZ.RiskZone";
const MITECO_STYLE = "Agua_Zi_ARPSI";

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
    return `${MITECO_WMS}?SERVICE=WMS&REQUEST=GetFeatureInfo&VERSION=1.3.0&CRS=EPSG:4326&BBOX=${bbox}&WIDTH=101&HEIGHT=101&I=50&J=50&LAYERS=${MITECO_LAYER}&QUERY_LAYERS=${MITECO_LAYER}&STYLES=${MITECO_STYLE}&INFO_FORMAT=application/json&FEATURE_COUNT=1`;
  };

  const extractProperties = (payload: any) => {
    if (!payload?.features?.length) return null;
    return payload.features[0]?.properties ?? null;
  };

  const pickDetails = (props: Record<string, any>) => ({
    info_url: props["Información"] ?? null,
    nombre_arpsi: props["Nombre ARPSI"] ?? null,
    nombre_subtramo: props["Nombre subtramo ARPSI"] ?? null,
    inundaciones_historicas: props["Nº inundaciones históricas documentadas"] ?? null,
    fecha_ultima_inundacion: props["Fecha última inundación documentada"] ?? null,
    estado: props["Estado"] ?? null,
  });

  const classifyRisk = (hasFeature: boolean) => {
    if (hasFeature) return "En ARPSI";
    return "Fuera ARPSI";
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
        source: "MITECO WMS ARPSI",
        method: "GetFeatureInfo",
        layer: MITECO_LAYER,
        value: null,
        risk_level: "Desconocido",
        scale_note: "ARPSI = area de riesgo potencial significativo de inundacion",
        warning:
          response.status > 0
            ? `HTTP ${response.status}`
            : "No se pudo consultar MITECO",
      });
    }

    const text = response.text ?? "";
    if (!text.trim()) {
      return NextResponse.json({
        source: "MITECO WMS ARPSI",
        method: "GetFeatureInfo",
        layer: MITECO_LAYER,
        value: null,
        risk_level: "Desconocido",
        scale_note: "ARPSI = area de riesgo potencial significativo de inundacion",
        warning: "Respuesta vacia del servicio WMS",
      });
    }
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    if (!json || !Array.isArray(json.features)) {
      return NextResponse.json({
        source: "MITECO WMS ARPSI",
        method: "GetFeatureInfo",
        layer: MITECO_LAYER,
        value: null,
        risk_level: "Desconocido",
        scale_note: "ARPSI = area de riesgo potencial significativo de inundacion",
        warning: "Respuesta WMS no valida",
      });
    }

    const properties = extractProperties(json);
    const hasFeature = Boolean(properties);
    const details = properties ? pickDetails(properties) : null;

    return NextResponse.json({
      source: "MITECO WMS ARPSI",
      method: "GetFeatureInfo",
      layer: MITECO_LAYER,
      value: hasFeature ? 1 : 0,
      risk_level: classifyRisk(hasFeature),
      scale_note:
        "ARPSI = area de riesgo potencial significativo de inundacion (1 dentro, 0 fuera)",
      details,
      raw_properties: properties,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({
      source: "MITECO WMS ARPSI",
      method: "GetFeatureInfo",
      layer: MITECO_LAYER,
      value: null,
      risk_level: "Desconocido",
      scale_note: "ARPSI = area de riesgo potencial significativo de inundacion",
      warning: "Error al consultar riesgo de inundacion",
    });
  }
}
