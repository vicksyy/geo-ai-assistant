import { NextResponse } from 'next/server';

const ICA_URL = 'https://ica.miteco.es/datos/ica-ultima-hora.csv';
const ICA_FALLBACK_URL = 'https://r.jina.ai/http://ica.miteco.es/datos/ica-ultima-hora.csv';

const normalizeCsv = (text: string) => {
  const lines = text.split('\n');
  const startIndex = lines.findIndex((line) => line.startsWith('cod_estacion,'));
  if (startIndex !== -1) {
    return lines.slice(startIndex).join('\n');
  }
  return text;
};

export async function GET() {
  try {
    let text: string | null = null;
    try {
      const res = await fetch(ICA_URL, {
        headers: { 'User-Agent': 'geo-ai-assistant/1.0' },
        cache: 'no-store',
      });
      if (res.ok) {
        text = await res.text();
      }
    } catch (error) {
      console.error('ICA direct fetch failed', error);
    }

    if (!text) {
      const res = await fetch(ICA_FALLBACK_URL, {
        headers: { 'User-Agent': 'geo-ai-assistant/1.0' },
        cache: 'no-store',
      });
      if (!res.ok) {
        return NextResponse.json({ error: 'Failed to fetch ICA data' }, { status: 502 });
      }
      text = await res.text();
    }

    const csv = normalizeCsv(text);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'public, max-age=600',
      },
    });
  } catch (error) {
    console.error('ICA fetch error', error);
    return NextResponse.json({ error: 'Failed to fetch ICA data' }, { status: 500 });
  }
}
