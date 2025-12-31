import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") || "");
  const lon = parseFloat(searchParams.get("lon") || "");

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: "Debe proporcionar lat y lon válidos" }, { status: 400 });
  }

  const data = [
    { lat: lat + 0.001, lon: lon + 0.001, value: 80 },
    { lat: lat - 0.0015, lon: lon + 0.002, value: 60 },
    { lat: lat + 0.002, lon: lon - 0.001, value: 40 },
    { lat: lat - 0.002, lon: lon - 0.002, value: 70 },
    { lat: lat, lon: lon, value: 90 },
  ];

  return NextResponse.json({ puntos: data });
}
