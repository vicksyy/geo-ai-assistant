import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { lat, lon, street } = await req.json();

    if (!lat || !lon) {
      return NextResponse.json(
        { error: 'Coordenadas inválidas' },
        { status: 400 }
      );
    }

    const prompt = `
Genera un informe detallado y claro sobre la ubicación:

Dirección: ${street || 'No especificada'}
Coordenadas: ${lat}, ${lon}

El informe debe incluir:
1. Descripción general del entorno
2. Tipo de zona (residencial, comercial, mixta, rural, etc.)
3. Posible actividad urbanística
4. Riesgos conocidos (inundación, ruido, tráfico, etc.)
5. Observaciones relevantes

Usa un tono profesional, claro y estructurado.
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Eres un analista urbanístico y territorial experto.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.4,
    });

    const informe =
      completion.choices[0]?.message?.content ||
      'No se pudo generar el informe';

    return NextResponse.json({
      ok: true,
      informe,
    });
  } catch (error) {
    console.error('Error IA:', error);

    return NextResponse.json(
      { error: 'Error generando el informe' },
      { status: 500 }
    );
  }
}
