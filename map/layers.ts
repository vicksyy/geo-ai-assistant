export type BaseLayerId = 'osm' | 'topo' | 'satellite' | 'ign' | 'ica';
export type OverlayLayerId = 'railways' | 'seamark' | 'inundacion';

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
    id: 'ign',
    label: 'IGN Base (Callejero)',
    url: 'https://www.ign.es/wmts/ign-base?service=WMTS&request=GetTile&version=1.0.0&layer=IGNBaseTodo&style=default&tilematrixset=GoogleMapsCompatible&tilematrix={z}&tilerow={y}&tilecol={x}&format=image/jpeg',
    attribution: '© Instituto Geografico Nacional de Espana',
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
}[] = [
  {
    id: 'railways',
    label: 'Ferrocarriles',
    kind: 'tile',
    url: 'https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
    attribution: '© OpenRailwayMap',
    maxZoom: 19,
  },
  {
    id: 'seamark',
    label: 'Cartas náuticas',
    kind: 'tile',
    url: 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
    attribution: '© OpenSeaMap contributors',
    maxZoom: 18,
  },
  {
    id: 'inundacion',
    label: 'Riesgo de inundacion (Copernicus)',
    kind: 'wms',
    url: 'https://ows.globalfloods.eu/glofas-ows/ows.py',
    layers: 'FloodHazard100y',
    format: 'image/png',
    transparent: true,
    version: '1.3.0',
    attribution: '© Copernicus Emergency Management Service (GloFAS)',
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
    ign: L.tileLayer(baseLayerOptions[3].url, {
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
          format: layer.format ?? 'image/png',
          transparent: layer.transparent ?? true,
          version: layer.version ?? '1.3.0',
          attribution: layer.attribution,
        });
      } else {
        acc[layer.id] = L.tileLayer(layer.url, {
          attribution: layer.attribution,
          maxZoom: layer.maxZoom,
          opacity: 0.7,
        });
      }
      return acc;
    },
    {} as Record<OverlayLayerId, any>
  );

  return { baseLayers, overlayLayers };
}
