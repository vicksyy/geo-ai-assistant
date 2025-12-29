// app/api/tools/capasUrbanismo/route.ts
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
    edificiosCercanos: ["Escuela", "Hospital", "Centro Comercial"],
    parques: ["Parque Central", "Jardín Botánico"],
    usoSuelo: "Residencial y Comercial",
  };

  return NextResponse.json(data);
}
