'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  coordenadas?: { lat: number; lon: number } | null;
  toolData?: { tool: string; data: any } | null;
  onMapClick?: (coords: { lat:number, lon:number }) => void;

}


export default function MapView({ coordenadas, toolData, onMapClick }: MapViewProps) {
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

// Llamada a Nominatim para geocoding inverso
let streetName = '';
try {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lon}&zoom=18&addressdetails=1`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'MiMapaApp/1.0',
    },
  });
  const data = await res.json();

  // Construir dirección hasta provincia
  const address = data.address;
  if (address) {
    const parts = [];
    if (address.road) parts.push(address.road);
    if (address.house_number) parts.push(address.house_number);
    if (address.city) parts.push(address.city);
    streetName = parts.join(', ');
  }
} catch (err) {
  console.error('Error geocoding inverso', err);
}


// Mostrar popup en el marcador
const popupOptions = {
  offset: [0, -20],
  closeButton: true,
};

markerRef.current
  .bindPopup(
    `<div class="popup-content">
      ${streetName}<br/>
      📍 ${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}
    </div>`,
    popupOptions
  )
  .openPopup();



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
      if (mapRef.current) mapRef.current.remove();
    };
  }, []);

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
    }
  }, [coordenadas]);

   // Renderizar capa del tool
  useEffect(() => {
    if (!toolData || !mapRef.current) return;
    const L = require('leaflet');

    switch (toolData.tool) {
      case 'capasUrbanismo':
        // dibujar polígonos de urbanismo
        break;
      case 'riesgoInundacion':
        // dibujar capa de riesgo de inundación
        break;
      case 'contaminacion':
        // dibujar puntos de contaminación
        break;
    }
  }, [toolData]);

  return (
  <div className="relative h-full w-full">
    <div id="map" className="h-full w-full" />
  </div>
);

}
