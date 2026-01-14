# Geo AI Assistant

Asistente web basado en IA para analizar zonas geograficas a partir de una direccion o un punto en mapa. Genera un informe profesional sobre riesgos, infraestructura y usos urbanos usando datos oficiales y abiertos (Copernicus, IGN, OpenStreetMap, MITECO).

## Tecnologias

- Next.js (App Router) + TypeScript
- Tailwind CSS + Shadcn UI
- Leaflet
- OpenAI (function calling)

## APIs y fuentes de datos

- OpenStreetMap / Nominatim (geocodificacion y sugerencias)
- Overpass API (usos del suelo, amenities)
- IGN WMS (capas urbanas base)
- MITECO WMS ARPSI (riesgo de inundacion)
- Copernicus GWIS/EFFIS WMS (riesgo de incendio - FWI)
- MITECO ICA (calidad del aire)
- OpenWeather (capas meteorologicas)
- Open-Meteo (historico de clima)
- USGS (eventos sismicos)

## Instalacion

```bash
npm install
```

## Variables de entorno

Crea un archivo `.env.local` con:

```bash
OPENAI_API_KEY=tu_clave_openai
MAPTILER_API_KEY=opcional_para_geocoding_mejorado
NOMINATIM_EMAIL=opcional_para_user_agent
NEXT_PUBLIC_OPENWEATHER_KEY=tu_clave_openweather
```

## Desarrollo

```bash
npm run dev
```

Abre `http://localhost:3000`.

## Deploy

- Repo GitHub: (completa aqui)
- URL Vercel: (completa aqui)
