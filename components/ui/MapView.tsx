'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  coordenadas?: { lat: number; lon: number } | null;
}


export default function MapView({ coordenadas }: MapViewProps) {
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

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
          worldCopyJump: false // permite que el mapa se repita horizontalmente
        });
        mapRef.current = map;

        // Tiles de OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
        }).addTo(map);

        map.setMaxBounds([
          [-85, -Infinity], // limitar solo vertical
          [85, Infinity],
        ]);


        // Click en mapa
        map.on('click', (e: any) => {
          const { lat, lng } = e.latlng;
          setCoords({ lat, lon: lng });

          if (markerRef.current) {
            markerRef.current.setLatLng(e.latlng);
          } else {
            markerRef.current = L.marker(e.latlng).addTo(map);
          }
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
      if (mapRef.current) mapRef.current.remove();
    };
  }, []);

  // Actualizar marker si cambian coords desde page.tsx
  useEffect(() => {
    if (coordenadas && mapRef.current) {
      const L = require('leaflet');
      const latlng = [coordenadas.lat, coordenadas.lon];

      mapRef.current.setView(latlng, 14);

      if (markerRef.current) {
        markerRef.current.setLatLng(latlng);
      } else {
        markerRef.current = L.marker(latlng).addTo(mapRef.current);
      }

      setCoords({ lat: coordenadas.lat, lon: coordenadas.lon });
    }
  }, [coordenadas]);

  return (
    <div className="relative h-screen w-screen">
      <div id="map" className="relative h-full w-4/5" />
      {coords && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-[9999] bg-white text-black p-2 rounded shadow text-sm">
          📍 Lat: {coords.lat.toFixed(6)} | Lon: {coords.lon.toFixed(6)}
        </div>
      )}
    </div>
  );
}
