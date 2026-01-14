// app/api/tools/riesgoIncendio/route.ts
import { NextResponse } from "next/server";

const GWIS_WMS = "https://maps.effis.emergency.copernicus.eu/gwis";
const GWIS_LAYER = "mf025.fwi";
const GWIS_QUERY_LAYER = "mf025.query";

const buildUrl = (latNum: number, lonNum: number, dateStr: string) => {
  const delta = 0.02;
  const minLat = latNum - delta;
  const maxLat = latNum + delta;
  const minLon = lonNum - delta;
  const maxLon = lonNum + delta;
  const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;
  const params = new URLSearchParams({
    SERVICE: "WMS",
    REQUEST: "GetFeatureInfo",
    VERSION: "1.1.1",
    SRS: "EPSG:4326",
    BBOX: bbox,
    WIDTH: "101",
    HEIGHT: "101",
    X: "50",
    Y: "50",
    LAYERS: GWIS_LAYER,
    QUERY_LAYERS: GWIS_QUERY_LAYER,
    INFO_FORMAT: "text/html",
    STYLES: "default",
    TIME: dateStr,
  });
  return `${GWIS_WMS}?${params.toString()}`;
};

const extractMetrics = (html: string) => {
  const metrics: Record<string, number> = {};
  const rowRegex = /<tr><td>([^<]+)<\/td><td>([^<]+)<\/td><\/tr>/gi;
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(html))) {
    const label = match[1]?.trim();
    const value = Number(match[2]);
    if (!label || !Number.isFinite(value)) continue;
    if (!(label in metrics)) metrics[label] = value;
  }
  return metrics;
};

  const classifyFwi = (fwi: number | null) => {
    if (fwi === null) return "desconocido";
    if (fwi < 5) return "bajo";
    if (fwi < 12) return "moderado";
    if (fwi < 30) return "alto";
    if (fwi < 50) return "muy alto";
    return "extremo";
  };

const getDateString = (value: string | null) => {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
};

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const dateParam = getDateString(searchParams.get("date") ?? searchParams.get("time"));

  if (!lat || !lon) {
    return NextResponse.json({ error: "Debe proporcionar lat y lon" }, { status: 400 });
  }

  const latNum = Number(lat);
  const lonNum = Number(lon);
  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
    return NextResponse.json({ error: "Coordenadas invalidas" }, { status: 400 });
  }

  const fetchWithTimeout = async (url: string, timeoutMs = 7000) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "GeoAIAssistant/1.0",
          Accept: "text/html",
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

  const fetchMetrics = async (dateStr: string) => {
    const url = buildUrl(latNum, lonNum, dateStr);
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      return { ok: false, date: dateStr, response };
    }
    const text = response.text ?? "";
    if (!text.trim()) {
      return { ok: true, date: dateStr, metrics: null, warning: "Respuesta vacia" };
    }
    if (text.includes("ServiceException")) {
      return { ok: true, date: dateStr, metrics: null, warning: "Error WMS" };
    }
    if (text.toLowerCase().includes("search returned no results")) {
      return { ok: true, date: dateStr, metrics: null, warning: "Sin datos" };
    }
    const metrics = extractMetrics(text);
    return { ok: true, date: dateStr, metrics: Object.keys(metrics).length ? metrics : null };
  };

  try {
    const dateStr = dateParam ?? formatDate(new Date());
    let result = await fetchMetrics(dateStr);
    let warning: string | null = null;

    if (result.ok && !result.metrics && !dateParam) {
      const fallbackDate = formatDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
      const fallback = await fetchMetrics(fallbackDate);
      if (fallback.ok && fallback.metrics) {
        result = fallback;
        warning = "Sin datos hoy; se uso el dia anterior.";
      } else if (result.warning) {
        warning = result.warning;
      }
    } else if ((result as any).warning) {
      warning = (result as any).warning;
    }

    if (!result.ok) {
      const status = result.response?.status;
      return NextResponse.json({
        source: "Copernicus GWIS WMS",
        method: "GetFeatureInfo",
        layer: GWIS_LAYER,
        query_layer: GWIS_QUERY_LAYER,
        value: null,
        risk_level: "desconocido",
        danger: null,
        scale_note: "FWI (Fire Weather Index) de GWIS/ECMWF",
        warning:
          typeof status === "number" && status > 0
            ? `HTTP ${status}`
            : "No se pudo consultar GWIS",
      });
    }

    const metrics = result.metrics;
    const fwi = metrics?.["Fire Weather Index (FWI)"] ?? null;
    const details = metrics
      ? {
          fwi,
          isi: metrics["Initial Spread Index (ISI)"] ?? null,
          bui: metrics["Build Up Index (BUI)"] ?? null,
          ffmc: metrics["Fine Fuel Moisture Code (FFMC)"] ?? null,
          dmc: metrics["Duff Moisture Code (DMC)"] ?? null,
          dc: metrics["Drought Code (DC)"] ?? null,
        }
      : null;
    const riskLevel = classifyFwi(fwi);
    const danger = fwi === null ? null : fwi >= 12;

    return NextResponse.json({
      source: "Copernicus GWIS WMS",
      method: "GetFeatureInfo",
      layer: GWIS_LAYER,
      query_layer: GWIS_QUERY_LAYER,
      date: result.date,
      value: fwi,
      risk_level: riskLevel,
      danger,
        scale_note:
          "FWI (Fire Weather Index). Umbrales aproximados: <5 bajo, 5-12 moderado, 12-30 alto, 30-50 muy alto, >=50 extremo.",
      details,
      warning,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({
      source: "Copernicus GWIS WMS",
      method: "GetFeatureInfo",
      layer: GWIS_LAYER,
      query_layer: GWIS_QUERY_LAYER,
      value: null,
      risk_level: "desconocido",
      danger: null,
      scale_note: "FWI (Fire Weather Index) de GWIS/ECMWF",
      warning: "Error al consultar riesgo de incendio",
    });
  }
}
