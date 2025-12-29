// app/api/tools/buscarCoordenadas/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const direccion = searchParams.get("direccion");

  if (!direccion) {
    return NextResponse.json(
      { error: "Debe proporcionar una dirección" },
      { status: 400 }
    );
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      direccion
    )}&format=json&limit=1`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.length) {
      return NextResponse.json({ error: "Dirección no encontrada" }, { status: 404 });
    }

    const result = data[0];

    return NextResponse.json({
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      display_name: result.display_name,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Error al buscar coordenadas" },
      { status: 500 }
    );
  }
}
