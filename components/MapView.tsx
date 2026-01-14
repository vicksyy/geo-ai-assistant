'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { BaseLayerId, OverlayLayerId, buildLayers } from '../map/layers';

declare global {
  interface Window {
    generarInforme: (lat: number, lon: number, street: string, isPlace?: boolean) => void;
  }
}


interface MapViewProps {
  coordenadas?: { lat: number; lon: number } | null;
  onMapClick?: (coords: { lat:number, lon:number }) => void;
  onLocationResolved?: (location: { lat: number; lon: number; label: string }) => void;
  layerState?: { baseId: BaseLayerId; overlays: OverlayLayerId[] };
  aqicnToken?: string;
  onReportOpen?: () => void;
  reportVisible?: boolean;
  onReportVisibilityChange?: (visible: boolean) => void;
  onReportStateChange?: (state: {
    visible: boolean;
    loading: boolean;
    hasReport: boolean;
  }) => void;
  selectedPlace?: {
    label: string;
    placeClass?: string | null;
    placeType?: string | null;
  } | null;

}


export default function MapView({
  coordenadas,
  onMapClick,
  onLocationResolved,
  layerState,
  aqicnToken,
  onReportOpen,
  reportVisible,
  onReportVisibilityChange,
  onReportStateChange,
  selectedPlace,
}: MapViewProps) {
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const layersRef = useRef<{
    baseLayers: Record<BaseLayerId, any>;
    overlayLayers: Record<OverlayLayerId, any>;
  } | null>(null);
  const activeBaseLayerRef = useRef<BaseLayerId | null>(null);
  const activeOverlayLayerIdsRef = useRef<Set<OverlayLayerId>>(new Set());
  const initialLayerStateRef = useRef(layerState);
  const aqiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const aqiMoveHandlerRef = useRef<(() => void) | null>(null);
  const aqiAbortRef = useRef<AbortController | null>(null);
  const aqiStationsRef = useRef<{ lat: number; lon: number; aqi: number }[]>([]);
  const aqiFetchBoundsRef = useRef<any>(null);
  const aqiLabelsLayerRef = useRef<any>(null);
  const satelliteLabelsLayerRef = useRef<any>(null);
  const sheltersLayerRef = useRef<any>(null);
  const sheltersFetchBoundsRef = useRef<any>(null);
  const sheltersAbortRef = useRef<AbortController | null>(null);
  const sheltersDebounceRef = useRef<number | null>(null);
  const sheltersLoadingSinceRef = useRef<number | null>(null);
  const sheltersLoadingTimeoutRef = useRef<number | null>(null);
  const sheltersRequestIdRef = useRef(0);
  const sheltersPendingRequestRef = useRef<number | null>(null);
  const zoomHandlerRef = useRef<(() => void) | null>(null);
  const icaStationsRef = useRef<{ lat: number; lon: number; indice: number }[]>([]);
  const icaUpdatedAtRef = useRef<number | null>(null);
  const aqiFrameRef = useRef<number | null>(null);
  const aqiDrawHandlerRef = useRef<(() => void) | null>(null);
  const cityLabelsRef = useRef<any>(null);
  const countryLabelsRef = useRef<any>(null);
  const labelsInitializedRef = useRef(false);

  const isPlaceSelection = (place?: {
    label: string;
    placeClass?: string | null;
    placeType?: string | null;
  } | null) => {
    if (!place) return false;
    const type = place.placeType ?? '';
    if (place.placeClass === 'boundary' && type === 'administrative') return true;
    const placeTypes = new Set([
      'country',
      'state',
      'region',
      'province',
      'county',
      'municipality',
      'city',
      'town',
      'village',
      'hamlet',
      'borough',
      'district',
      'city_district',
      'suburb',
    ]);
    return placeTypes.has(type);
  };

  type SelectionScope = 'country' | 'region' | 'city' | 'district' | 'street';

  const getSelectionScope = (mapZoom: number): SelectionScope => {
    if (mapZoom <= 5) return 'country';
    if (mapZoom <= 7) return 'region';
    if (mapZoom <= 10) return 'city';
    if (mapZoom <= 12) return 'district';
    return 'street';
  };

  const getReverseZoom = (mapZoom: number): number => {
    if (mapZoom <= 5) return 3;
    if (mapZoom <= 7) return 6;
    if (mapZoom <= 10) return 10;
    if (mapZoom <= 12) return 14;
    return 18;
  };

  const pickFirst = (...values: Array<string | null | undefined>) =>
    values.find((value) => value && value.length > 0) ?? null;

  const buildStreetLabel = (address: any) => {
    if (!address) return null;
    const streetOptions = [
      address.road,
      address.pedestrian,
      address.footway,
      address.path,
      address.cycleway,
      address.residential,
      address.square,
      address.neighbourhood,
      address.neighborhood,
      address.suburb,
      address.quarter,
    ];
    const areaOptions = [
      address.suburb,
      address.neighbourhood,
      address.neighborhood,
      address.borough,
      address.city_district,
      address.quarter,
    ];
    const cityOptions = [
      address.city,
      address.town,
      address.village,
      address.municipality,
      address.county,
      address.state,
    ];
    const street = pickFirst(...streetOptions);
    const area = pickFirst(...areaOptions);
    const city = pickFirst(...cityOptions);
    const parts = [];
    if (street) parts.push(street);
    if (address.house_number) parts.push(address.house_number);
    if (area) parts.push(area);
    if (city) parts.push(city);
    const label = parts.join(', ').trim();
    return label.length ? label : null;
  };

  const buildLabelFromAddress = (
    address: any,
    displayName: string | null,
    scope: SelectionScope
  ) => {
    if (!address) return displayName ?? null;
    const country = pickFirst(address.country);
    const region = pickFirst(
      address.state,
      address.region,
      address.province,
      address.county
    );
    const city = pickFirst(
      address.city,
      address.town,
      address.village,
      address.municipality,
      address.county,
      address.state
    );
    const district = pickFirst(
      address.suburb,
      address.neighbourhood,
      address.neighborhood,
      address.borough,
      address.city_district,
      address.quarter,
      address.district
    );

    if (scope === 'street') {
      return buildStreetLabel(address) || displayName || city || region || country;
    }
    if (scope === 'district') {
      return district || city || region || country || displayName;
    }
    if (scope === 'city') {
      return city || region || country || displayName;
    }
    if (scope === 'region') {
      return region || city || country || displayName;
    }
    return country || region || city || displayName;
  };

  const bindMarkerPopup = async (
    coords: { lat: number; lon: number },
    labelOverride?: string | null,
    isPlace = false,
    mapZoom?: number
  ) => {
    if (!mapRef.current || !markerRef.current) return;

    const resolvedMapZoom = Number.isFinite(mapZoom)
      ? (mapZoom as number)
      : mapRef.current?.getZoom?.() ?? 18;
    const scope = getSelectionScope(resolvedMapZoom);
    const reverseZoom = getReverseZoom(resolvedMapZoom);
    const reportIsPlace = isPlace || scope !== 'street';

    let streetName = '';
    let streetLabel = labelOverride ?? 'Ubicación seleccionada';

    if (!labelOverride) {
      try {
        const url = `/api/tools/buscarCoordenadas?lat=${coords.lat}&lon=${coords.lon}&zoom=${reverseZoom}`;
        const res = await fetch(url);
        if (!res.ok) {
          return;
        }
        const data = await res.json();

        const address = data.address;
        if (address) {
          const labelFromAddress = buildLabelFromAddress(
            address,
            data?.display_name ?? null,
            scope
          );
          if (labelFromAddress) {
            streetName = labelFromAddress;
            streetLabel = labelFromAddress;
          }
        } else if (data?.display_name) {
          streetLabel = data.display_name;
        }
      } catch (err) {
        console.error('Error geocoding inverso', err);
      }
    } else {
      streetName = labelOverride;
    }

    const safe = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const label = safe(streetLabel);
    const reportLabel = streetLabel.replace(/'/g, "\\'");
    if (onLocationResolved) {
      onLocationResolved({ lat: coords.lat, lon: coords.lon, label: streetLabel });
    }

    const popupOptions = {
      offset: [0, -20],
      closeButton: true,
    };

    markerRef.current
      .bindPopup(
        `<div class="popup-content" style="min-width:220px;">
          <div class="popup-title">${label}</div>
          <div class="popup-subtitle">📍 ${coords.lat.toFixed(
            6
          )}, ${coords.lon.toFixed(6)}</div>
          <div style="margin-top:10px; display:flex; justify-content:center;">
            <button class="report-btn" onclick="generarInforme(${coords.lat}, ${coords.lon}, '${reportLabel}', ${reportIsPlace ? 'true' : 'false'})">Generar Informe</button>
          </div>
        </div>`,
        popupOptions
      )
      .openPopup();

    window.generarInforme = async (lat: number, lon: number, street: string, placeScope = false) => {
      onReportOpen?.();
      setMostrarInforme(true);
      setLoadingInforme(true);
      setInforme(null);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await fetch('/api/ia', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lon, street, scope: placeScope ? 'place' : 'point' }),
          signal: controller.signal,
        });

        const data = await res.json();
        setInforme(data.informe || 'No se pudo generar el informe');
      } catch (err) {
        if ((err as any).name === 'AbortError') {
          console.log('Llamada cancelada');
        } else {
          console.error(err);
          setInforme('Error al generar el informe');
        }
      } finally {
        setLoadingInforme(false);
        abortControllerRef.current = null;
      }
    };
  };
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [sheltersLoading, setSheltersLoading] = useState(false);
  const [mapZoom, setMapZoom] = useState<number | null>(null);
  const [informe, setInforme] = useState<string | null>(null);
  const [loadingInforme, setLoadingInforme] = useState(false);
  const [mostrarInformeInternal, setMostrarInformeInternal] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mostrarInforme = reportVisible ?? mostrarInformeInternal;
  const setMostrarInforme = (value: boolean) => {
    onReportVisibilityChange?.(value);
    if (reportVisible === undefined) {
      setMostrarInformeInternal(value);
    }
  };

  useEffect(() => {
    onReportStateChange?.({
      visible: mostrarInforme,
      loading: loadingInforme,
      hasReport: Boolean(informe),
    });
  }, [mostrarInforme, loadingInforme, informe, onReportStateChange]);

  const renderInforme = (text: string) => {
    const sectionTitles = [
      'Descripción de la zona',
      'Infraestructura cercana',
      'Riesgos relevantes',
      'Posibles usos urbanos',
      'Recomendación final',
      'Fuentes y limitaciones',
    ];

    return text.split('\n').map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <div key={`spacer-${index}`} className="h-2" />;
      }

      const locationMatch = trimmed.match(/^(Lugar|Dirección):\s*(.+)$/i);
      if (locationMatch) {
        const label = locationMatch[1];
        const value = locationMatch[2];
        return (
          <p key={`line-${index}`} className="text-sm text-foreground text-left">
            <span className="font-semibold text-foreground">{label}:</span>{' '}
            <span className="font-semibold text-foreground">{value}</span>
          </p>
        );
      }

      const coordsMatch = trimmed.match(/^Coordenadas:\s*(.+)$/i);
      if (coordsMatch) {
        return (
          <p key={`line-${index}`} className="text-sm text-muted-foreground text-left">
            <span className="text-muted-foreground">{coordsMatch[1]}</span>
          </p>
        );
      }

      const match = sectionTitles.find(
        (title) => trimmed.toLowerCase().startsWith(`${title.toLowerCase()}:`)
      );
      if (match) {
        const rest = trimmed.slice(match.length + 1).trim();
        return (
          <p key={`line-${index}`} className="text-sm text-foreground text-justify">
            <span className="font-semibold text-foreground">{match}:</span>
            {rest ? ` ${rest}` : ''}
          </p>
        );
      }

      return (
        <p key={`line-${index}`} className="text-sm text-muted-foreground text-justify">
          {line}
        </p>
      );
    });
  };

  const parseInforme = (text: string) => {
    const sectionTitles = [
      'Descripción de la zona',
      'Infraestructura cercana',
      'Riesgos relevantes',
      'Posibles usos urbanos',
      'Recomendación final',
      'Fuentes y limitaciones',
    ];
    const result: {
      locationLabel?: string;
      locationValue?: string;
      coords?: string;
      sections: { title: string; body: string }[];
    } = { sections: [] };

    let current: { title: string; lines: string[] } | null = null;
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const locationMatch = trimmed.match(/^(Lugar|Dirección):\s*(.+)$/i);
      if (locationMatch) {
        result.locationLabel = locationMatch[1];
        result.locationValue = locationMatch[2];
        continue;
      }
      if (trimmed.toLowerCase().startsWith('coordenadas:')) {
        result.coords = trimmed.replace(/^coordenadas:\s*/i, '');
        continue;
      }

      const title = sectionTitles.find((t) =>
        trimmed.toLowerCase().startsWith(`${t.toLowerCase()}:`)
      );
      if (title) {
        if (current) {
          result.sections.push({
            title: current.title,
            body: current.lines.join(' ').trim(),
          });
        }
        const rest = trimmed.slice(title.length + 1).trim();
        current = { title, lines: rest ? [rest] : [] };
        continue;
      }

      if (!current) {
        current = { title: 'Resumen', lines: [trimmed] };
      } else {
        current.lines.push(trimmed);
      }
    }
    if (current) {
      result.sections.push({
        title: current.title,
        body: current.lines.join(' ').trim(),
      });
    }

    return result;
  };

  const handleExportPdf = async () => {
    if (!informe) return;
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
    });

    const marginX = 48;
    let cursorY = 60;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - marginX * 2;

    const drawHeader = () => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(31, 41, 55);
      doc.text('Informe IA', marginX, 40);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      const dateLabel = new Date().toLocaleString('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      doc.text(`Generado: ${dateLabel}`, marginX, 62);
      doc.setDrawColor(229, 231, 235);
      doc.line(marginX, 88, pageWidth - marginX, 88);
      cursorY = 110;
    };

    const ensureSpace = (height: number) => {
      if (cursorY + height < pageHeight - 48) return;
      doc.addPage();
      drawHeader();
    };

    drawHeader();

    const parsed = parseInforme(informe);
    const locationLine = parsed.locationValue
      ? `${parsed.locationLabel ?? 'Lugar'}: ${parsed.locationValue}`
      : undefined;
    const coordsLine = parsed.coords ? `Coordenadas: ${parsed.coords}` : undefined;

    if (locationLine) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(17, 24, 39);
      const wrapped = doc.splitTextToSize(locationLine, contentWidth);
      ensureSpace(wrapped.length * 16);
      doc.text(wrapped, marginX, cursorY);
      cursorY += wrapped.length * 16 + 2;
    }

    if (coordsLine) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      const wrapped = doc.splitTextToSize(coordsLine, contentWidth);
      ensureSpace(wrapped.length * 14);
      doc.text(wrapped, marginX, cursorY);
      cursorY += wrapped.length * 14 + 10;
    }

    for (const section of parsed.sections) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(31, 41, 55);
      ensureSpace(18);
      doc.text(section.title, marginX, cursorY);
      cursorY += 16;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(55, 65, 81);
      const bodyText = section.body || 'Sin información disponible.';
      const wrapped = doc.splitTextToSize(bodyText, contentWidth);
      ensureSpace(wrapped.length * 14 + 8);
      doc.text(wrapped, marginX, cursorY);
      cursorY += wrapped.length * 14 + 12;
    }

    doc.save('informe-ia.pdf');
  };


  const setMarkerAt = async (
    coords: { lat: number; lon: number },
    label?: string | null,
    zoom?: number,
    isPlace = false
  ) => {
    const L = require('leaflet');
    if (!markerRef.current) {
      markerRef.current = L.marker([coords.lat, coords.lon]).addTo(mapRef.current);
    } else {
      markerRef.current.setLatLng([coords.lat, coords.lon]);
    }

    if (zoom && mapRef.current) {
      mapRef.current.flyTo([coords.lat, coords.lon], zoom, {
        animate: true,
        duration: 0.8,
      });
    }

    const selectionZoom = Number.isFinite(zoom)
      ? (zoom as number)
      : mapRef.current?.getZoom?.();
    await bindMarkerPopup(coords, label ?? null, isPlace, selectionZoom);
  };

  const setupLabelLayers = async (L: any, map: any) => {
    if (labelsInitializedRef.current) return;
    labelsInitializedRef.current = true;

    try {
      const [citiesRes, countriesRes] = await Promise.all([
        fetch('/data/labels/cities_110m.json'),
        fetch('/data/labels/countries_110m.json'),
      ]);
      if (!citiesRes.ok || !countriesRes.ok) return;
      const cities = await citiesRes.json();
      const countries = await countriesRes.json();

      const createLabelIcon = (name: string, size: number) =>
        L.divIcon({
          className: '',
          html: `<div style="font-size:${size}px; font-weight:600; color:#111827; text-shadow:0 1px 2px rgba(255,255,255,0.9); white-space:nowrap;">${name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`,
        });

      cityLabelsRef.current = L.layerGroup(
        cities.map((city: any) => {
          const marker = L.marker([city.lat, city.lon], {
            icon: createLabelIcon(city.name, 12),
            interactive: true,
          });
          marker.on('click', () => {
            setMarkerAt({ lat: city.lat, lon: city.lon }, city.name, 12, true);
          });
          return marker;
        })
      );

      countryLabelsRef.current = L.layerGroup(
        countries.map((country: any) => {
          const marker = L.marker([country.lat, country.lon], {
            icon: createLabelIcon(country.name, 14),
            interactive: true,
          });
          marker.on('click', () => {
            setMarkerAt({ lat: country.lat, lon: country.lon }, country.name, 5, true);
          });
          return marker;
        })
      );

      const updateLabelVisibility = () => {
        const zoom = map.getZoom();
        if (zoom <= 5) {
          if (map.hasLayer(cityLabelsRef.current)) map.removeLayer(cityLabelsRef.current);
          if (!map.hasLayer(countryLabelsRef.current)) map.addLayer(countryLabelsRef.current);
        } else {
          if (map.hasLayer(countryLabelsRef.current)) map.removeLayer(countryLabelsRef.current);
          if (!map.hasLayer(cityLabelsRef.current)) map.addLayer(cityLabelsRef.current);
        }
      };

      updateLabelVisibility();
      map.on('zoomend', updateLabelVisibility);
    } catch (err) {
      console.error('Error loading label layers', err);
    }
  };

  // Inicializar mapa
  useEffect(() => {
    let map: any;

    (async () => {
      const L = await import('leaflet');

      const iconUrl = (await import('leaflet/dist/images/marker-icon.png')).default;
      const iconRetinaUrl = (await import('leaflet/dist/images/marker-icon-2x.png')).default;
      const shadowUrl = (await import('leaflet/dist/images/marker-shadow.png')).default;

      L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

      const initializeMap = (lat: number, lng: number) => {
        map = L.map('map', {
          center: [lat, lng],
          zoom: 12,          // tu zoom inicial
          minZoom: 2,        // zoom mínimo (ver todo el mundo)
          maxZoom: 18,       // zoom máximo cercano
          worldCopyJump: false, // permite que el mapa se repita horizontalmente
          zoomControl: false,
        });
        mapRef.current = map;
        const updateZoom = () => setMapZoom(map.getZoom());
        zoomHandlerRef.current = updateZoom;
        updateZoom();
        map.on('zoomend', updateZoom);

        const { baseLayers, overlayLayers } = buildLayers(L);
        layersRef.current = { baseLayers, overlayLayers };
        const initialBaseId = initialLayerStateRef.current?.baseId ?? 'osm';
        baseLayers[initialBaseId]?.addTo(map);
        activeBaseLayerRef.current = initialBaseId;

        const initialOverlays = initialLayerStateRef.current?.overlays ?? [];
        initialOverlays.forEach((id) => {
          const layer = overlayLayers[id];
          if (layer) {
            layer.addTo(map);
            activeOverlayLayerIdsRef.current.add(id);
          }
        });

        map.setMaxBounds([
          [-85, -Infinity], // limitar solo vertical
          [85, Infinity],
        ]);

        setupLabelLayers(L, map);


        // Click en mapa
              map.on('click', async (e: any) => {
  const coords = { lat: e.latlng.lat, lon: e.latlng.lng };

  // Llama al callback del padre
  if (onMapClick) onMapClick(coords);

  const L = require('leaflet');

  // Crear marcador si no existe
  if (!markerRef.current) {
    markerRef.current = L.marker([coords.lat, coords.lon]).addTo(map);
  } else {
    markerRef.current.setLatLng([coords.lat, coords.lon]);
  }

  await setMarkerAt(coords, null, undefined, false);




  // Animación tipo Google Maps
  map.flyTo([coords.lat, coords.lon], map.getZoom(), {
    animate: true,
    duration: 1.2,
  });
});

      };


      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => initializeMap(pos.coords.latitude, pos.coords.longitude),
          () => initializeMap(40.4168, -3.7038)
        );
      } else {
        initializeMap(40.4168, -3.7038);
      }
    })();

    return () => {
      if (mapRef.current) {
        if (zoomHandlerRef.current) {
          mapRef.current.off('zoomend', zoomHandlerRef.current);
          zoomHandlerRef.current = null;
        }
        mapRef.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layersRef.current || !layerState) return;
    const { baseLayers, overlayLayers } = layersRef.current;

    if (activeBaseLayerRef.current !== layerState.baseId) {
      if (activeBaseLayerRef.current) {
        const currentLayer = baseLayers[activeBaseLayerRef.current];
        if (currentLayer) mapRef.current.removeLayer(currentLayer);
      }
      const nextLayer = baseLayers[layerState.baseId];
      if (nextLayer) nextLayer.addTo(mapRef.current);
      activeBaseLayerRef.current = layerState.baseId;
    }

    const nextOverlays = new Set(layerState.overlays);
    activeOverlayLayerIdsRef.current.forEach((id) => {
      if (!nextOverlays.has(id)) {
        const layer = overlayLayers[id];
        if (layer) mapRef.current.removeLayer(layer);
      }
    });

    layerState.overlays.forEach((id) => {
      if (!activeOverlayLayerIdsRef.current.has(id)) {
        const layer = overlayLayers[id];
        if (layer) layer.addTo(mapRef.current);
      }
    });

    activeOverlayLayerIdsRef.current = nextOverlays;
  }, [layerState]);

  useEffect(() => {
    if (!mapRef.current || !layerState) return;
    const map = mapRef.current;
    const shouldShow = layerState.baseId === 'satellite';
    const L = require('leaflet');

    if (shouldShow) {
      if (!satelliteLabelsLayerRef.current) {
        satelliteLabelsLayerRef.current = L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png',
          {
            attribution: '© OpenStreetMap contributors, © CARTO',
            opacity: 0.9,
            maxZoom: 19,
            zIndex: 450,
            className: 'satellite-labels',
          }
        );
      }
      if (!map.hasLayer(satelliteLabelsLayerRef.current)) {
        satelliteLabelsLayerRef.current.addTo(map);
      }
    } else if (satelliteLabelsLayerRef.current && map.hasLayer(satelliteLabelsLayerRef.current)) {
      map.removeLayer(satelliteLabelsLayerRef.current);
    }

    return () => {
      if (satelliteLabelsLayerRef.current && map.hasLayer(satelliteLabelsLayerRef.current)) {
        map.removeLayer(satelliteLabelsLayerRef.current);
      }
    };
  }, [layerState?.baseId]);

  useEffect(() => {
    if (!mapRef.current || !layerState) return;
    const map = mapRef.current;
    const L = require('leaflet');
    const shouldShow = layerState.overlays?.includes('refugios');

    const clearLayer = () => {
      if (sheltersLayerRef.current?.clearLayers) sheltersLayerRef.current.clearLayers();
    };

    const startLoading = () => {
      if (!sheltersLoadingSinceRef.current) {
        sheltersLoadingSinceRef.current = Date.now();
        setSheltersLoading(true);
      }
    };

    const stopLoading = () => {
      if (sheltersLoadingTimeoutRef.current) {
        window.clearTimeout(sheltersLoadingTimeoutRef.current);
        sheltersLoadingTimeoutRef.current = null;
      }
      sheltersLoadingSinceRef.current = null;
      setSheltersLoading(false);
    };

    const removeLayer = () => {
      if (sheltersLayerRef.current && map.hasLayer(sheltersLayerRef.current)) {
        map.removeLayer(sheltersLayerRef.current);
      }
    };

    if (!shouldShow) {
      clearLayer();
      removeLayer();
      if (sheltersAbortRef.current) {
        sheltersAbortRef.current.abort();
        sheltersAbortRef.current = null;
      }
      sheltersFetchBoundsRef.current = null;
      stopLoading();
      return;
    }

    if (!sheltersLayerRef.current) {
      sheltersLayerRef.current = L.layerGroup();
    }
    if (!map.hasLayer(sheltersLayerRef.current)) {
      sheltersLayerRef.current.addTo(map);
    }

    const safe = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const fetchShelters = async (requestId: number) => {
      if (!mapRef.current || !sheltersLayerRef.current) return;
      const zoom = map.getZoom();
      if (zoom <= 9) {
        if (sheltersAbortRef.current) {
          sheltersAbortRef.current.abort();
          sheltersAbortRef.current = null;
        }
        sheltersPendingRequestRef.current = null;
        if (requestId === sheltersRequestIdRef.current) {
          stopLoading();
        }
        return;
      }

      const bounds = map.getBounds();
      const cached = sheltersFetchBoundsRef.current;
      if (
        cached &&
        cached.zoom === zoom &&
        cached.bounds?.contains &&
        cached.bounds.contains(bounds)
      ) {
        if (requestId === sheltersRequestIdRef.current && !sheltersPendingRequestRef.current) {
          stopLoading();
        }
        return;
      }

      if (sheltersAbortRef.current) sheltersAbortRef.current.abort();
      const controller = new AbortController();
      sheltersAbortRef.current = controller;

      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const url = `/api/tools/refugios?bbox=${sw.lat},${sw.lng},${ne.lat},${ne.lng}`;

      try {
        startLoading();
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data?.items)) return;

        const items = data.items.slice(0, 800);
        clearLayer();
        items.forEach((item: any) => {
          const lat = Number(item.lat);
          const lon = Number(item.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
          const category = item.category ?? 'amenity';
          const color =
            category === 'emergency' ? '#ef4444' : category === 'bunker' ? '#334155' : '#f59e0b';
          const marker = L.circleMarker([lat, lon], {
            radius: 5,
            color: '#000000',
            weight: 1,
            fillColor: color,
            fillOpacity: 0.85,
          });
          const name = item.name ? safe(item.name) : 'Refugio';
          const typeLabel = item.typeLabel ? safe(item.typeLabel) : null;
          marker.bindPopup(
            `<div class="popup-content">
              <div class="popup-title">${name}</div>
              ${typeLabel ? `<div class="popup-subtitle">${typeLabel}</div>` : ''}
            </div>`
          );
          sheltersLayerRef.current.addLayer(marker);
        });
        sheltersFetchBoundsRef.current = { bounds, zoom };
      } catch (err) {
        if ((err as any).name !== 'AbortError') {
          console.error('Error cargando refugios', err);
        }
      } finally {
        if (requestId === sheltersRequestIdRef.current && !sheltersPendingRequestRef.current) {
          const startedAt = sheltersLoadingSinceRef.current ?? Date.now();
          const elapsed = Date.now() - startedAt;
          const minVisible = 300;
          if (elapsed >= minVisible) {
            stopLoading();
          } else {
            sheltersLoadingTimeoutRef.current = window.setTimeout(() => {
              stopLoading();
            }, minVisible - elapsed);
          }
        }
      }
    };

    const scheduleFetch = () => {
      const zoom = map.getZoom();
      if (zoom <= 9) {
        if (sheltersAbortRef.current) {
          sheltersAbortRef.current.abort();
          sheltersAbortRef.current = null;
        }
        sheltersPendingRequestRef.current = null;
        stopLoading();
        return;
      }
      startLoading();
      const requestId = ++sheltersRequestIdRef.current;
      sheltersPendingRequestRef.current = requestId;
      if (sheltersDebounceRef.current) {
        window.clearTimeout(sheltersDebounceRef.current);
      }
      sheltersDebounceRef.current = window.setTimeout(() => {
        sheltersDebounceRef.current = null;
        sheltersPendingRequestRef.current = null;
        fetchShelters(requestId);
      }, 350);
    };

    map.on('moveend', scheduleFetch);
    map.on('zoomend', scheduleFetch);
    scheduleFetch();

    return () => {
      map.off('moveend', scheduleFetch);
      map.off('zoomend', scheduleFetch);
      if (sheltersDebounceRef.current) {
        window.clearTimeout(sheltersDebounceRef.current);
        sheltersDebounceRef.current = null;
      }
      if (sheltersAbortRef.current) {
        sheltersAbortRef.current.abort();
        sheltersAbortRef.current = null;
      }
      removeLayer();
      stopLoading();
    };
  }, [layerState?.overlays]);

  useEffect(() => {
    if (!mapRef.current || !layerState) return;
    const map = mapRef.current;

    if (layerState.baseId !== 'ica') {
      if (aqiCanvasRef.current) {
        aqiCanvasRef.current.remove();
        aqiCanvasRef.current = null;
      }
      if (aqiLabelsLayerRef.current) {
        map.removeLayer(aqiLabelsLayerRef.current);
        aqiLabelsLayerRef.current = null;
      }
      if (aqiMoveHandlerRef.current) {
        map.off('moveend', aqiMoveHandlerRef.current);
        aqiMoveHandlerRef.current = null;
      }
      if (aqiAbortRef.current) {
        aqiAbortRef.current.abort();
        aqiAbortRef.current = null;
      }
      return;
    }

    if (!aqicnToken) return;

    const L = require('leaflet');

    if (!aqiLabelsLayerRef.current) {
      aqiLabelsLayerRef.current = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png',
        {
          attribution: '© OpenStreetMap contributors, © CARTO',
          opacity: 0.9,
          maxZoom: 19,
          zIndex: 450,
        }
      ).addTo(map);
    }

    const getAqiColor = (aqi: number) => {
      if (aqi <= 25) return '#2b83ba'; // buena
      if (aqi <= 50) return '#4daf4a'; // razonablemente buena
      if (aqi <= 75) return '#fdae61'; // regular
      if (aqi <= 100) return '#f46d43'; // desfavorable
      if (aqi <= 150) return '#8b0000'; // muy desfavorable
      return '#6a0dad'; // extremadamente desfavorable
    };

    const getIcaColor = (indice: number) => {
      if (indice <= 1.5) return '#2b83ba'; // buena
      if (indice <= 2.5) return '#4daf4a'; // razonablemente buena
      if (indice <= 3.5) return '#fdae61'; // regular
      if (indice <= 4.5) return '#f46d43'; // desfavorable
      if (indice <= 5.5) return '#8b0000'; // muy desfavorable
      return '#6a0dad'; // extremadamente desfavorable
    };

    const isSpain = (lat: number, lon: number) =>
      lat >= 27 && lat <= 44.8 && lon >= -18.5 && lon <= 5.5;

    const ensureCanvas = () => {
      if (aqiCanvasRef.current) return aqiCanvasRef.current;
      const canvas = L.DomUtil.create('canvas', 'aqi-canvas-layer') as HTMLCanvasElement;
      const pane = map.getPanes().overlayPane;
      canvas.style.position = 'absolute';
      canvas.style.pointerEvents = 'none';
      pane.appendChild(canvas);
      aqiCanvasRef.current = canvas;
      return canvas;
    };

    const drawHeatSurface = () => {
      const canvas = ensureCanvas();
      const size = map.getSize();
      if (canvas.width !== size.x || canvas.height !== size.y) {
        canvas.width = size.x;
        canvas.height = size.y;
      }
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(canvas, topLeft);

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 0.6;

      const stations = aqiStationsRef.current;
      const icaStations = icaStationsRef.current;
      if (!stations.length && !icaStations.length) return;

      const offscreen = document.createElement('canvas');
      const gridX = 140;
      const gridY = 100;
      offscreen.width = gridX;
      offscreen.height = gridY;
      const offCtx = offscreen.getContext('2d');
      if (!offCtx) return;
      offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
      offCtx.globalAlpha = 0.7;

      const maxStations = 160;
      const sampleStations = stations.slice(0, maxStations);
      const sampleIcaStations = icaStations.slice(0, maxStations);

      for (let y = 0; y < gridY; y += 1) {
        for (let x = 0; x < gridX; x += 1) {
          const point = L.point(
            (x + 0.5) * (canvas.width / gridX),
            (y + 0.5) * (canvas.height / gridY)
          );
          const latlng = map.containerPointToLatLng(point);

          const useSpain = isSpain(latlng.lat, latlng.lng) && sampleIcaStations.length > 0;
          let weightedSum = 0;
          let weightTotal = 0;
          if (useSpain) {
            for (const station of sampleIcaStations) {
              const distance = Math.max(1200, map.distance(latlng, L.latLng(station.lat, station.lon)));
              const weight = 1 / (distance * distance);
              weightedSum += station.indice * weight;
              weightTotal += weight;
            }
            if (!weightTotal) continue;
            const interpolated = weightedSum / weightTotal;
            offCtx.fillStyle = getIcaColor(interpolated);
          } else {
            for (const station of sampleStations) {
              const distance = Math.max(1200, map.distance(latlng, L.latLng(station.lat, station.lon)));
              const weight = 1 / (distance * distance);
              weightedSum += station.aqi * weight;
              weightTotal += weight;
            }
            if (!weightTotal) continue;
            const interpolated = weightedSum / weightTotal;
            offCtx.fillStyle = getAqiColor(interpolated);
          }
          offCtx.fillRect(x, y, 1, 1);
        }
      }

      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
    };

    const scheduleDraw = () => {
      if (aqiFrameRef.current) return;
      aqiFrameRef.current = window.requestAnimationFrame(() => {
        aqiFrameRef.current = null;
        drawHeatSurface();
      });
    };

    const fetchIcaSpain = async () => {
      const now = Date.now();
      if (icaUpdatedAtRef.current && now - icaUpdatedAtRef.current < 10 * 60 * 1000) {
        return;
      }
      try {
        const res = await fetch('/api/ica');
        if (!res.ok) return;
        const text = await res.text();
        const lines = text.split('\n').filter(Boolean);
        if (lines.length <= 1) return;
        const data = lines.slice(1).map((line) => line.split(','));
        icaStationsRef.current = data
          .map((row) => {
            const lat = Number(row[3]);
            const lon = Number(row[4]);
            const indice = Number(row[7]);
            if (
              !Number.isFinite(lat) ||
              !Number.isFinite(lon) ||
              !Number.isFinite(indice) ||
              indice < 1 ||
              indice > 6
            ) {
              return null;
            }
            return { lat, lon, indice };
          })
          .filter(Boolean) as { lat: number; lon: number; indice: number }[];
        icaUpdatedAtRef.current = now;
      } catch (err) {
        console.error(err);
      }
    };

    const fetchHeatData = async () => {
      if (aqiAbortRef.current) aqiAbortRef.current.abort();
      const controller = new AbortController();
      aqiAbortRef.current = controller;

      const bounds = map.getBounds();
      const paddedBounds = bounds.pad(0.6);
      const shouldFetch =
        !aqiFetchBoundsRef.current ||
        !aqiFetchBoundsRef.current.contains(bounds);
      if (!shouldFetch) {
        scheduleDraw();
        return;
      }

      const paddedSw = paddedBounds.getSouthWest();
      const paddedNe = paddedBounds.getNorthEast();
      const url = `https://api.waqi.info/map/bounds/?latlng=${paddedSw.lat},${paddedSw.lng},${paddedNe.lat},${paddedNe.lng}&token=${aqicnToken}`;

      try {
        await fetchIcaSpain();
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status !== 'ok' || !Array.isArray(data.data)) return;

        aqiStationsRef.current = data.data
          .filter((item: any) => item && item.aqi !== '-' && item.lat && item.lon)
          .map((item: any) => {
            const value = Number(item.aqi);
            if (!Number.isFinite(value)) return null;
            return { lat: item.lat, lon: item.lon, aqi: value };
          })
          .filter(Boolean);

        aqiFetchBoundsRef.current = paddedBounds;
        scheduleDraw();
      } catch (err) {
        if ((err as any).name !== 'AbortError') {
          console.error(err);
        }
      }
    };

    aqiMoveHandlerRef.current = fetchHeatData;
    aqiDrawHandlerRef.current = scheduleDraw;
    map.on('moveend', fetchHeatData);
    map.on('zoomend', fetchHeatData);
    fetchHeatData();

    return () => {
      if (aqiCanvasRef.current) {
        aqiCanvasRef.current.remove();
        aqiCanvasRef.current = null;
      }
      if (aqiLabelsLayerRef.current) {
        map.removeLayer(aqiLabelsLayerRef.current);
        aqiLabelsLayerRef.current = null;
      }
      if (aqiMoveHandlerRef.current) {
        map.off('moveend', aqiMoveHandlerRef.current);
        aqiMoveHandlerRef.current = null;
      }
      map.off('zoomend', fetchHeatData);
      if (aqiAbortRef.current) {
        aqiAbortRef.current.abort();
        aqiAbortRef.current = null;
      }
      if (aqiFrameRef.current) {
        window.cancelAnimationFrame(aqiFrameRef.current);
        aqiFrameRef.current = null;
      }
    };
  }, [layerState, aqicnToken]);

  useEffect(() => {
  const resize = () => mapRef.current?.invalidateSize();
  window.addEventListener('resize', resize);
  return () => window.removeEventListener('resize', resize);
}, []);


  // Actualizar marker si cambian coords desde page.tsx
  useEffect(() => {
    if (coordenadas && mapRef.current) {
      const L = require('leaflet');
      const latlng = [coordenadas.lat, coordenadas.lon];

       mapRef.current.flyTo(latlng, mapRef.current.getZoom(), {
      animate: true,
      duration: 1.2,
    });
      if (markerRef.current) {
        markerRef.current.setLatLng(latlng);
      } else {
        markerRef.current = L.marker(latlng).addTo(mapRef.current);
      }

      setCoords({ lat: coordenadas.lat, lon: coordenadas.lon });
      const label = selectedPlace?.label ?? null;
      bindMarkerPopup(
        { lat: coordenadas.lat, lon: coordenadas.lon },
        label,
        isPlaceSelection(selectedPlace),
        mapRef.current?.getZoom?.()
      );
    }
  }, [coordenadas, selectedPlace]);

return (
  <div className="relative h-full w-full">

    {/* MAPA */}
    <div id="map" className="h-full w-full" />

    {layerState?.overlays?.includes('refugios') && (
      <>
        {sheltersLoading && (
          <div className="absolute bottom-6 left-1/2 z-[1200] -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur">
            Cargando refugios…
          </div>
        )}
        {(mapZoom ?? 0) <= 9 && (
          <div className="absolute bottom-6 left-1/2 z-[1200] -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur">
            Acerca el zoom para ver refugios
          </div>
        )}
      </>
    )}

    {layerState?.baseId === 'ica' && (
      <>
        <div className="absolute left-3 top-20 z-[1100] w-[150px] rounded-2xl border border-black/10 bg-black/55 px-3 py-3 text-white shadow-xl backdrop-blur sm:left-4 sm:top-24 sm:w-[170px] md:hidden">
          <div className="text-[11px] font-semibold tracking-wide">ICA (ES)</div>
          <div className="mt-3 grid grid-cols-[6px_1fr] grid-rows-6 items-stretch gap-x-2 gap-y-0 text-[11px]">
            <span className="h-full w-[6px]" style={{ backgroundColor: '#6a0dad' }} />
            <span className="py-0.5 leading-tight">Extremadamente desfavorable</span>
            <span className="h-full w-[6px]" style={{ backgroundColor: '#8b0000' }} />
            <span className="py-0.5 leading-tight">Muy desfavorable</span>
            <span className="h-full w-[6px]" style={{ backgroundColor: '#f46d43' }} />
            <span className="py-0.5 leading-tight">Desfavorable</span>
            <span className="h-full w-[6px]" style={{ backgroundColor: '#fdae61' }} />
            <span className="py-0.5 leading-tight">Regular</span>
            <span className="h-full w-[6px]" style={{ backgroundColor: '#4daf4a' }} />
            <span className="py-0.5 leading-tight">Razonablemente buena</span>
            <span className="h-full w-[6px]" style={{ backgroundColor: '#2b83ba' }} />
            <span className="py-0.5 leading-tight">Buena</span>
          </div>
        </div>

        <div className="absolute bottom-5 left-1/2 z-[1100] hidden w-[640px] -translate-x-1/2 rounded-2xl border border-black/10 bg-black/55 px-4 py-3 text-white shadow-lg backdrop-blur md:block">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-white">ICA (ES)</div>
          <div className="mt-2">
            <div className="h-2 w-full overflow-hidden rounded-full">
              <div className="grid h-full w-full grid-cols-6">
                <span style={{ backgroundColor: '#2b83ba' }} />
                <span style={{ backgroundColor: '#4daf4a' }} />
                <span style={{ backgroundColor: '#fdae61' }} />
                <span style={{ backgroundColor: '#f46d43' }} />
                <span style={{ backgroundColor: '#8b0000' }} />
                <span style={{ backgroundColor: '#6a0dad' }} />
              </div>
            </div>
            <div className="mt-2 grid grid-cols-6 text-[10px] text-white/80">
              <span>Buena</span>
              <span>Razonable</span>
              <span>Regular</span>
              <span>Desfavorable</span>
              <span>Muy desf.</span>
              <span>Extrema</span>
            </div>
          </div>
        </div>
      </>
    )}

    {/* PANEL DE INFORME FLOTANTE */}
<div
  className={`
    fixed
    left-0
    right-0
    bottom-16
    h-[40%]
    md:absolute
    md:top-20
    md:bottom-4
    md:left-4
    md:w-[320px]
    lg:w-[420px]
    md:h-[calc(100%-6rem)]
    bg-card
    shadow-xl
    rounded-t-lg
    md:rounded-lg
    z-[1000]
    p-4
    flex
    flex-col
    overflow-hidden
    transition-all
    duration-300
    ease-out
    transform
    ${mostrarInforme ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
     md:translate-y-0
    ${mostrarInforme ? 'md:translate-x-0 md:opacity-100' : 'md:-translate-x-full md:opacity-0'}
  `}
>
  {/* HEADER */}
  <div className="flex justify-between items-center flex-shrink-0">
    <h2 className="text-lg font-semibold text-foreground">
      Informe IA
    </h2>

    <button
      className="text-muted-foreground hover:text-foreground"
      onClick={() => {
        setMostrarInforme(false);

        // Cancelar cualquier llamada a la IA
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      }}
    >
      ✕
    </button>
  </div>
  <div className="-mx-4 mb-3 mt-2 h-px bg-border" />

  {/* CONTENIDO SCROLL */}
  <div className="flex-1 overflow-y-auto pr-1 md:pr-2">
    {loadingInforme && (
      <p className="text-sm text-muted-foreground">
        Generando informe...
      </p>
    )}

    {!loadingInforme && !informe && (
      <p className="text-sm text-muted-foreground">
        Haz click en el mapa y genera un informe
      </p>
    )}

    {!loadingInforme && informe && (
      <div>
        {renderInforme(informe)}
      </div>
    )}
  </div>

  {/* FOOTER - BOTÓN EXPORTAR PDF FIJO ABAJO */}
  {!loadingInforme && informe && (
    <div className="-mx-4 mt-4 flex-shrink-0 border-t border-border pt-4 px-4">
      <button
        className="
          w-full
          py-2
          rounded-md
          bg-primary
          text-primary-foreground
          text-sm
          font-medium
          hover:bg-primary/90
          transition
        "
        onClick={handleExportPdf}
      >
        Exportar PDF
      </button>
    </div>
  )}
</div>

  </div>
);





}
