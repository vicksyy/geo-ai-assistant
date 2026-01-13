import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { lat, lon, street, scope } = await req.json();

    if (!lat || !lon) {
      return NextResponse.json(
        { error: 'Coordenadas inválidas' },
        { status: 400 }
      );
    }

    const origin = new URL(req.url).origin;
    const isPlaceScope = scope === 'place';
    const prompt = `
Genera un informe detallado y claro sobre la ubicación:

${isPlaceScope ? 'Lugar' : 'Dirección'}: ${street || 'No especificada'}
Coordenadas: ${lat}, ${lon}

Rol del modelo:
Actúa como un analista territorial y urbanístico con experiencia en planificación urbana, análisis de suelo y evaluación de riesgos.

Contexto:
El usuario ha seleccionado ${
      isPlaceScope
        ? 'una ciudad o un país en un mapa interactivo'
        : 'un punto geográfico en un mapa interactivo'
    }. A partir de las coordenadas proporcionadas, debes generar un informe técnico profesional sobre la zona.

Instrucciones generales:

- Utiliza un tono profesional, claro y objetivo.
- Redacta el informe de forma estructurada, con subtítulos.
- Evita afirmaciones categóricas si no hay certeza; usa formulaciones como “es probable”, “se observa”, “podría considerarse”.
- El contenido debe ser comprensible para técnicos, inversores y usuarios no especializados.
${isPlaceScope ? '- Enfócate en el contexto general del lugar seleccionado y evita detalles a nivel de calle.' : ''}
- Debes usar datos de herramientas reales y citar las fuentes en el informe.
- Indica limitaciones y cobertura de los datos si aplica.
- No uses Markdown ni símbolos de título (como #, ##, ###). Usa subtítulos en texto plano con dos puntos.
- Si aparecen términos en inglés de usos del suelo o urbanismo, tradúcelos al español y no incluyas el término original en inglés.

Estructura del informe:

Descripción de la zona:
Describe el entorno general ${
      isPlaceScope ? 'del lugar seleccionado' : 'del punto seleccionado'
    }: tipo de área (urbana, periurbana, rural), características del paisaje, densidad aproximada, tipología edificatoria y contexto territorial.

Infraestructura cercana:
Analiza la presencia y accesibilidad de infraestructuras relevantes, como:
- Vías de comunicación (carreteras, transporte público, accesos principales)
- Equipamientos (educativos, sanitarios, comerciales, administrativos)
- Servicios básicos (agua, electricidad, saneamiento, telecomunicaciones)

Riesgos relevantes:
Identifica posibles riesgos asociados a la localización, tales como:
- Riesgos naturales (inundaciones, deslizamientos, sismicidad, incendios)
- Riesgos ambientales (contaminación, zonas protegidas cercanas)
- Limitaciones urbanísticas o legales probables

Posibles usos urbanos:
Propón usos urbanos compatibles con el entorno y las características de la zona, por ejemplo:
- Residencial
- Comercial
- Industrial ligero
Justifica brevemente cada uso sugerido.
Si el riesgo de inundación es alto (arpsi) o el riesgo de incendio es muy alto o extremo, no recomiendes usos urbanos sensibles y señala que no es adecuado para desarrollo urbano sin mitigación.
Si los riesgos de inundación e incendio son bajos (bajo (arpsi) y riesgo de incendio bajo/moderado), puedes considerar el área adecuada, siempre condicionado a la infraestructura cercana.

Recomendación final:
Ofrece una conclusión integradora que resuma el potencial del área, su viabilidad para el desarrollo urbano y una recomendación general de uso o estudio adicional.
La recomendación debe reflejar explícitamente la infraestructura cercana y los riesgos de inundación e incendio: si alguno es alto, desaconseja el desarrollo; si ambos son bajos, puedes recomendarlo.

Fuentes y limitaciones:
Menciona explícitamente las fuentes usadas (Copernicus GWIS/EFFIS, Copernicus, IGN, OpenStreetMap) y limita la interpretación si hay falta de cobertura o resolución.

Formato:
Empieza el informe con estas dos líneas en texto plano:
"${isPlaceScope ? 'Lugar' : 'Dirección'}: ${street || 'No especificada'}"
"Coordenadas: ${lat}, ${lon}"
Luego usa exactamente estos subtítulos en el informe y en texto plano: "Descripción de la zona:", "Infraestructura cercana:", "Riesgos relevantes:", "Posibles usos urbanos:", "Recomendación final:", "Fuentes y limitaciones:".
`;

    const tools: ChatCompletionTool[] = [
      {
        type: 'function',
        function: {
          name: 'buscarCoordenadas',
          description: 'Busca coordenadas a partir de una dirección usando OpenStreetMap.',
          parameters: {
            type: 'object',
            properties: {
              direccion: { type: 'string' },
            },
            required: ['direccion'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'capasUrbanismo',
          description: 'Consulta información urbanística en una ubicación (IGN/OSM).',
          parameters: {
            type: 'object',
            properties: {
              lat: { type: 'number' },
              lon: { type: 'number' },
            },
            required: ['lat', 'lon'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'riesgoInundacion',
          description:
            'Consulta si una ubicación está dentro de un ARPSI (MITECO) mediante WMS.',
          parameters: {
            type: 'object',
            properties: {
              lat: { type: 'number' },
              lon: { type: 'number' },
            },
            required: ['lat', 'lon'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'riesgoIncendio',
          description:
            'Consulta el indice FWI de peligro de incendio (Copernicus GWIS) para una ubicacion.',
          parameters: {
            type: 'object',
            properties: {
              lat: { type: 'number' },
              lon: { type: 'number' },
              date: { type: 'string' },
            },
            required: ['lat', 'lon'],
          },
        },
      },
    ];

    const callTool = async (name: string, args: Record<string, any>) => {
      if (name === 'buscarCoordenadas') {
        const res = await fetch(
          `${origin}/api/tools/buscarCoordenadas?direccion=${encodeURIComponent(
            args.direccion
          )}`
        );
        return res.ok ? await res.json() : { error: 'No se pudo geocodificar' };
      }
      if (name === 'capasUrbanismo') {
        const res = await fetch(
          `${origin}/api/tools/capasUrbanismo?lat=${args.lat}&lon=${args.lon}`
        );
        return res.ok ? await res.json() : { error: 'No se pudo consultar urbanismo' };
      }
      if (name === 'riesgoInundacion') {
        const res = await fetch(
          `${origin}/api/tools/riesgoInundacion?lat=${args.lat}&lon=${args.lon}`
        );
        return res.ok ? await res.json() : { error: 'No se pudo consultar inundación' };
      }
      if (name === 'riesgoIncendio') {
        const dateParam = args.date ? `&date=${encodeURIComponent(args.date)}` : '';
        const res = await fetch(
          `${origin}/api/tools/riesgoIncendio?lat=${args.lat}&lon=${args.lon}${dateParam}`
        );
        return res.ok ? await res.json() : { error: 'No se pudo consultar incendio' };
      }
      return { error: 'Tool desconocida' };
    };

    const systemMessage = {
      role: 'system' as const,
      content:
        'Eres analista territorial y urbanístico con experiencia en planificación urbana, análisis de suelo y evaluación de riesgos.',
    };

    const initialMessages = [
      systemMessage,
      {
        role: 'user' as const,
        content: `${prompt}\n\nInstruccion: Antes de redactar el informe, llama a las herramientas capasUrbanismo, riesgoInundacion y riesgoIncendio para obtener datos reales. Si faltan coordenadas, usa buscarCoordenadas.`,
      },
    ];

    const initial = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: initialMessages,
      tools,
      tool_choice: 'auto',
      temperature: 0.2,
    });

    const messages: any[] = [...initialMessages];
    const toolCalls = initial.choices[0]?.message?.tool_calls ?? [];
    if (toolCalls.length) {
      messages.push(initial.choices[0].message);
      for (const call of toolCalls) {
        if (call.type !== 'function') continue;
        const args = JSON.parse(call.function.arguments || '{}');
        const result = await callTool(call.function.name, args);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    const ensureTool = async (name: string) => {
      const missing = !toolCalls.some(
        (call) => call.type === 'function' && call.function.name === name
      );
      if (!missing) return;
      const forced = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          systemMessage,
          {
            role: 'user',
            content: `Llama a la herramienta ${name} con lat=${lat} y lon=${lon}.`,
          },
        ],
        tools,
        tool_choice: { type: 'function', function: { name } },
        temperature: 0,
      });
      const forcedCalls = forced.choices[0]?.message?.tool_calls ?? [];
      if (!forcedCalls.length) return;
      messages.push(forced.choices[0].message);
      for (const call of forcedCalls) {
        if (call.type !== 'function') continue;
        const args = JSON.parse(call.function.arguments || '{}');
        const result = await callTool(call.function.name, args);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    };

    await ensureTool('capasUrbanismo');
    await ensureTool('riesgoInundacion');
    await ensureTool('riesgoIncendio');

    messages.push({
      role: 'user',
      content: 'Con los datos de las herramientas, redacta el informe final y cita las fuentes.',
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools,
      tool_choice: 'none',
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
