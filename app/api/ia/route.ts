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

Rol del modelo:
Actúa como un analista territorial y urbanístico con experiencia en planificación urbana, análisis de suelo y evaluación de riesgos.

Contexto:
El usuario ha seleccionado un punto geográfico en un mapa interactivo. A partir de las coordenadas proporcionadas, debes generar un informe técnico profesional sobre la zona.

Instrucciones generales:

- Utiliza un tono profesional, claro y objetivo.
- Redacta el informe de forma estructurada, con subtítulos.
- Evita afirmaciones categóricas si no hay certeza; usa formulaciones como “es probable”, “se observa”, “podría considerarse”.
- El contenido debe ser comprensible para técnicos, inversores y usuarios no especializados.

Estructura del informe:

1. Descripción de la zona
Describe el entorno general del punto seleccionado: tipo de área (urbana, periurbana, rural), características del paisaje, densidad aproximada, tipología edificatoria y contexto territorial.

2. Infraestructura cercana
Analiza la presencia y accesibilidad de infraestructuras relevantes, como:

- Vías de comunicación (carreteras, transporte público, accesos principales)
- Equipamientos (educativos, sanitarios, comerciales, administrativos)
- Servicios básicos (agua, electricidad, saneamiento, telecomunicaciones)

3. Riesgos relevantes
Identifica posibles riesgos asociados a la localización, tales como:
- Riesgos naturales (inundaciones, deslizamientos, sismicidad, incendios)
- Riesgos ambientales (contaminación, zonas protegidas cercanas)
- Limitaciones urbanísticas o legales probables

4. Posibles usos urbanos
Propón usos urbanos compatibles con el entorno y las características de la zona, por ejemplo:
- Residencial
- Comercial
- Industrial ligero

Equipamientos públicos
Justifica brevemente cada uso sugerido.

5. Recomendación final
Ofrece una conclusión integradora que resuma el potencial del área, su viabilidad para el desarrollo urbano y una recomendación general de uso o estudio adicional.
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Eres analista territorial y urbanístico con experiencia en planificación urbana, análisis de suelo y evaluación de riesgos.',
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
