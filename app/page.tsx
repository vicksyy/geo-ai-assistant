'use client';

import { useEffect, useRef, useState } from 'react';
import MapView from '../components/MapView';
import LeftSidebar from '../components/LeftSidebar';
import FloatingSearch from '../components/FloatingSearch';
import { BaseLayerId, OverlayLayerId } from '../map/layers';
import ComparePanel from '../components/ComparePanel';
import HistoryPanel from '../components/HistoryPanel';



export default function HomePage() {
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<{
    label: string;
    placeClass?: string | null;
    placeType?: string | null;
  } | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [baseLayerId, setBaseLayerId] = useState<BaseLayerId>('osm');
  const [overlayLayerIds, setOverlayLayerIds] = useState<OverlayLayerId[]>([]);
  const [airQualityOn, setAirQualityOn] = useState(false);
  const lastBaseRef = useRef<BaseLayerId>('osm');
  const [lastLocation, setLastLocation] = useState<{
    lat: number;
    lon: number;
    label: string;
  } | null>(null);
  const aqicnToken = process.env.NEXT_PUBLIC_AQICN_TOKEN ?? '';
  const aqiAvailable = Boolean(aqicnToken);

  const togglePanel = (panel: 'layers' | 'compare' | 'history' | 'save') => {
    setLayersOpen((prev) => (panel === 'layers' ? !prev : false));
    setCompareOpen((prev) => (panel === 'compare' ? !prev : false));
    setHistoryOpen((prev) => (panel === 'history' ? !prev : false));
    setSaveOpen((prev) => (panel === 'save' ? !prev : false));
  };

  useEffect(() => {
    if (baseLayerId !== 'ica') {
      lastBaseRef.current = baseLayerId;
      if (airQualityOn) setAirQualityOn(false);
      return;
    }
    if (!airQualityOn) setAirQualityOn(true);
  }, [baseLayerId, airQualityOn]);

  const handleBaseChange = (id: BaseLayerId) => {
    lastBaseRef.current = id;
    setAirQualityOn(false);
    setBaseLayerId(id);
  };

  const handleAirQualityToggle = () => {
    if (!aqiAvailable) return;
    if (airQualityOn) {
      setAirQualityOn(false);
      setBaseLayerId(lastBaseRef.current ?? 'osm');
      return;
    }
    if (baseLayerId !== 'ica') {
      lastBaseRef.current = baseLayerId;
    }
    setAirQualityOn(true);
    setBaseLayerId('ica');
  };



  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <LeftSidebar
        layersOpen={layersOpen}
        onLayersToggle={() => togglePanel('layers')}
        onCompareClick={() => togglePanel('compare')}
        onHistoryClick={() => togglePanel('history')}
        onSaveClick={() => togglePanel('save')}
        baseLayerId={baseLayerId}
        overlayLayerIds={overlayLayerIds}
        onBaseLayerChange={handleBaseChange}
        onOverlayToggle={(id) =>
          setOverlayLayerIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
          )
        }
        aqiAvailable={aqiAvailable}
        aqicnToken={aqicnToken}
        airQualityOn={airQualityOn}
        onAirQualityToggle={handleAirQualityToggle}
      />

      <div className="relative flex-1">
        <div className="absolute top-4 right-4 md:left-1/2 md:-translate-x-1/2 z-[1000]">
          <FloatingSearch
            onResult={(result) => {
              setCoordenadas({ lat: result.lat, lon: result.lon });
              if (result.displayName) {
                setSelectedPlace({
                  label: result.displayName,
                  placeClass: result.placeClass ?? null,
                  placeType: result.placeType ?? null,
                });
              } else {
                setSelectedPlace(null);
              }
            }}
          />
        </div>

        <ComparePanel open={compareOpen} onClose={() => setCompareOpen(false)} />
        <HistoryPanel
          open={historyOpen}
          mode="history"
          onClose={() => setHistoryOpen(false)}
          location={lastLocation}
          onSelectLocation={(loc) => {
            setCoordenadas({ lat: loc.lat, lon: loc.lon });
            setSelectedPlace({ label: loc.label });
          }}
        />
        <HistoryPanel
          open={saveOpen}
          mode="save"
          onClose={() => setSaveOpen(false)}
          location={lastLocation}
          onSelectLocation={(loc) => {
            setCoordenadas({ lat: loc.lat, lon: loc.lon });
            setSelectedPlace({ label: loc.label });
          }}
        />

       <MapView
         coordenadas={coordenadas}
         onMapClick={(coords) => {
           setCoordenadas(coords);
           setSelectedPlace(null);
         }}
         onLocationResolved={(loc) => setLastLocation(loc)}
         layerState={{ baseId: baseLayerId, overlays: overlayLayerIds }}
         aqicnToken={aqicnToken}
         selectedPlace={selectedPlace}
       />
      </div>
    </div>
  );
}
