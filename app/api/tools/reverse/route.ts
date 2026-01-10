import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const zoom = searchParams.get('zoom') ?? '18';

  if (!lat || !lon) {
    return NextResponse.json(
      { error: 'Debe proporcionar lat y lon' },
      { status: 400 }
    );
  }

  try {
    const fetchJson = async (url: string, headers?: Record<string, string>) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      try {
        const res = await fetch(url, { headers, signal: controller.signal });
        if (!res.ok) return null;
        const json = await res.json();
        if (json?.error) return null;
        return json;
      } catch {
        return null;
      } finally {
        clearTimeout(timeout);
      }
    };

    const nominatimHeaders = {
      'User-Agent': 'geo-ai-assistant/1.0',
      'Accept-Language': 'es',
      Accept: 'application/json',
    };

    const primaryUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lon)}&zoom=${encodeURIComponent(zoom)}&addressdetails=1`;
    const fallbackUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lon)}&zoom=16&addressdetails=1`;

    const data =
      (await fetchJson(primaryUrl, nominatimHeaders)) ??
      (await fetchJson(fallbackUrl, nominatimHeaders));

    if (!data) {
      return NextResponse.json(
        { error: 'No se pudo resolver la direccion inversa' },
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: 'Error al buscar direccion inversa' },
      { status: 500 }
    );
  }
}
