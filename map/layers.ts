export type BaseLayerId = 'osm' | 'topo' | 'satellite' | 'transport' | 'ica';
export type OverlayLayerId =
  | 'railways'
  | 'inundacion'
  | 'refugios'
  | 'airtemp'
  | 'clouds'
  | 'precipitation'
  | 'pressure';

const openWeatherKey = process.env.NEXT_PUBLIC_OPENWEATHER_KEY ?? '';
const openWeatherTempUrl = `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${openWeatherKey}`;
const openWeatherCloudsUrl = `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${openWeatherKey}`;
const openWeatherPrecipitationUrl = `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${openWeatherKey}`;
const openWeatherPressureUrl = `https://tile.openweathermap.org/map/pressure_new/{z}/{x}/{y}.png?appid=${openWeatherKey}`;

export const baseLayerOptions: {
  id: BaseLayerId;
  label: string;
  url: string;
  attribution: string;
  maxZoom?: number;
  requiresToken?: boolean;
}[] = [
  {
    id: 'osm',
    label: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  },
  {
    id: 'topo',
    label: 'OpenTopoMap',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenTopoMap (CC-BY-SA)',
    maxZoom: 17,
  },
  {
    id: 'satellite',
    label: 'Esri Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri',
    maxZoom: 19,
  },
  {
    id: 'transport',
    label: 'Transporte',
    url: 'https://tileserver.memomaps.de/tilegen/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors, tiles by Memomaps',
    maxZoom: 19,
  },
  {
    id: 'ica',
    label: 'Calidad del aire (ICA)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors, © World Air Quality Index Project',
    maxZoom: 19,
    requiresToken: true,
  },
];

export const overlayLayerOptions: {
  id: OverlayLayerId;
  label: string;
  kind: 'tile' | 'wms';
  url: string;
  attribution: string;
  maxZoom?: number;
  layers?: string;
  format?: string;
  transparent?: boolean;
  version?: string;
  styles?: string;
  opacity?: number;
  className?: string;
  zIndex?: number;
  pane?: string;
}[] = [
  {
    id: 'railways',
    label: 'Ferrocarriles',
    kind: 'tile',
    url: 'https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
    attribution: '© OpenRailwayMap',
    maxZoom: 19,
    pane: 'overlayPane',
    zIndex: 500,
  },
  {
    id: 'inundacion',
    label: 'Riesgo Inundación (ARPSI)',
    kind: 'wms',
    url: 'https://wms.mapama.gob.es/sig/agua/ZI_ARPSI',
    layers: 'NZ.RiskZone',
    styles: 'Agua_Zi_ARPSI',
    format: 'image/png',
    transparent: true,
    version: '1.3.0',
    attribution: '© MITECO - ARPSI',
  },
  {
    id: 'airtemp',
    label: 'Temperatura del aire (OpenWeather)',
    kind: 'tile',
    url: openWeatherTempUrl,
    attribution: '© OpenWeather',
    maxZoom: 19,
    opacity: 1,
    className: 'weather-overlay weather-temp',
  },
  {
    id: 'clouds',
    label: 'Nubes (OpenWeather)',
    kind: 'tile',
    url: openWeatherCloudsUrl,
    attribution: '© OpenWeather',
    maxZoom: 19,
    opacity: 1,
    className: 'weather-overlay weather-clouds',
  },
  {
    id: 'precipitation',
    label: 'Precipitación (OpenWeather)',
    kind: 'tile',
    url: openWeatherPrecipitationUrl,
    attribution: '© OpenWeather',
    maxZoom: 19,
    opacity: 1,
    className: 'weather-overlay weather-precip',
  },
  {
    id: 'pressure',
    label: 'Presión nivel del mar (OpenWeather)',
    kind: 'tile',
    url: openWeatherPressureUrl,
    attribution: '© OpenWeather',
    maxZoom: 19,
    opacity: 1,
    className: 'weather-overlay weather-pressure',
  },
];

export function buildLayers(L: typeof import('leaflet')) {
  const baseLayers = {
    osm: L.tileLayer(baseLayerOptions[0].url, {
      attribution: baseLayerOptions[0].attribution,
      maxZoom: baseLayerOptions[0].maxZoom,
    }),
    topo: L.tileLayer(baseLayerOptions[1].url, {
      attribution: baseLayerOptions[1].attribution,
      maxZoom: baseLayerOptions[1].maxZoom,
    }),
    satellite: L.tileLayer(baseLayerOptions[2].url, {
      attribution: baseLayerOptions[2].attribution,
      maxZoom: baseLayerOptions[2].maxZoom,
    }),
    transport: L.tileLayer(baseLayerOptions[3].url, {
      attribution: baseLayerOptions[3].attribution,
      maxZoom: baseLayerOptions[3].maxZoom,
    }),
    ica: L.tileLayer(baseLayerOptions[4].url, {
      attribution: baseLayerOptions[4].attribution,
      maxZoom: baseLayerOptions[4].maxZoom,
    }),
  };

  const overlayLayers = overlayLayerOptions.reduce(
    (acc, layer) => {
      if (layer.kind === 'wms' && layer.layers) {
        acc[layer.id] = L.tileLayer.wms(layer.url, {
          layers: layer.layers,
          styles: layer.styles ?? '',
          format: layer.format ?? 'image/png',
          transparent: layer.transparent ?? true,
          version: layer.version ?? '1.3.0',
          attribution: layer.attribution,
          className: layer.id === 'inundacion' ? 'flood-blur' : undefined,
          opacity: layer.opacity ?? 1,
          ...(layer.zIndex !== undefined ? { zIndex: layer.zIndex } : {}),
          ...(layer.pane ? { pane: layer.pane } : {}),
        });
      } else {
        acc[layer.id] = L.tileLayer(layer.url, {
          attribution: layer.attribution,
          maxZoom: layer.maxZoom,
          opacity: layer.opacity ?? 0.95,
          className: layer.className,
          ...(layer.zIndex !== undefined ? { zIndex: layer.zIndex } : {}),
          ...(layer.pane ? { pane: layer.pane } : {}),
        });
      }
      return acc;
    },
    {} as Record<OverlayLayerId, any>
  );

  return { baseLayers, overlayLayers };
}
