// app/api/tools/riesgoInundacion/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json({ error: "Debe proporcionar lat y lon" }, { status: 400 });
  }

  // Mock data de ejemplo
  const data = {
    nivel: "Medio",
    comentarios: "Zona cercana a río, posibles inundaciones en invierno",
  };

  return NextResponse.json(data);
}
