// app/api/tools/buscarCoordenadas/route.ts
import { NextResponse } from "next/server";

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
        const hint = email ? '' : ' (configura NOMINATIM_EMAIL)';
        return NextResponse.json(
          { error: `No se pudo resolver la dirección inversa${hint}` },
          { status: 502 }
        );
      }

      return NextResponse.json({
        lat: Number(data.lat ?? lat),
        lon: Number(data.lon ?? lon),
        display_name: data.display_name ?? null,
        address: data.address ?? null,
        place_rank: data.place_rank ?? null,
        type: data.type ?? null,
        class: data.class ?? null,
      });
    }

    const direccionValue = direccion ?? "";
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
