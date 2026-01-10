import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Debe proporcionar lat y lon' }, { status: 400 });
  }

  const latNum = Number(lat);
  const lonNum = Number(lon);
  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
    return NextResponse.json({ error: 'Coordenadas inválidas' }, { status: 400 });
  }

  try {
    const end = new Date();
    const start = new Date();
    start.setFullYear(end.getFullYear() - 5);
    const formatDate = (d: Date) => d.toISOString().slice(0, 10);

    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${latNum}&longitude=${lonNum}&start_date=${formatDate(
      start
    )}&end_date=${formatDate(
      end
    )}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;

    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json(
        { error: 'No se pudo obtener el histórico' },
        { status: res.status }
      );
    }
    const data = await res.json();
    const tempsMax: number[] = data?.daily?.temperature_2m_max ?? [];
    const tempsMin: number[] = data?.daily?.temperature_2m_min ?? [];
    const precip: number[] = data?.daily?.precipitation_sum ?? [];

    const avg = (arr: number[]) =>
      arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;
    const sum = (arr: number[]) =>
      arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) * 10) / 10 : null;

    const avgTemp = avg([...tempsMax, ...tempsMin].filter(Number.isFinite));
    const totalPrecip = sum(precip.filter(Number.isFinite));

    const days = Math.max(tempsMax.length, tempsMin.length, precip.length, 0);

    const years: Record<number, { temps: number[]; precip: number[] }> = {};
    const dates: string[] = data?.daily?.time ?? [];
    dates.forEach((date: string, index: number) => {
      const year = Number(date.slice(0, 4));
      if (!Number.isFinite(year)) return;
      if (!years[year]) years[year] = { temps: [], precip: [] };
      const tMax = tempsMax[index];
      const tMin = tempsMin[index];
      if (Number.isFinite(tMax)) years[year].temps.push(tMax);
      if (Number.isFinite(tMin)) years[year].temps.push(tMin);
      const p = precip[index];
      if (Number.isFinite(p)) years[year].precip.push(p);
    });

    const byYear = Object.entries(years)
      .map(([year, values]) => ({
        year: Number(year),
        avgTemp: avg(values.temps),
        totalPrecip: sum(values.precip),
      }))
      .sort((a, b) => a.year - b.year);

    const firstYear = byYear[0];
    const lastYear = byYear[byYear.length - 1];
    const tempTrend =
      firstYear?.avgTemp !== null && lastYear?.avgTemp !== null
        ? Math.round((lastYear.avgTemp - firstYear.avgTemp) * 10) / 10
        : null;
    const precipTrend =
      firstYear?.totalPrecip !== null && lastYear?.totalPrecip !== null
        ? Math.round((lastYear.totalPrecip - firstYear.totalPrecip) * 10) / 10
        : null;

    const summary = `Resumen de los últimos ${byYear.length} años: temperatura media aproximada de ${avgTemp ?? 'N/D'} °C y precipitación acumulada de ${totalPrecip ?? 'N/D'} mm. ${
      tempTrend !== null
        ? `Tendencia de temperatura: ${tempTrend > 0 ? '+' : ''}${tempTrend} °C.`
        : ''
    } ${
      precipTrend !== null
        ? `Cambio de precipitación: ${precipTrend > 0 ? '+' : ''}${precipTrend} mm.`
        : ''
    }`;

    return NextResponse.json({
      summary,
      metrics: {
        avgTemp,
        totalPrecip,
        days,
        byYear,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error al generar el histórico' }, { status: 500 });
  }
}
