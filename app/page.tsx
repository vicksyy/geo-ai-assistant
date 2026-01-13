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
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportAvailable, setReportAvailable] = useState(false);
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

  const togglePanel = (panel: 'layers' | 'weather' | 'compare' | 'history' | 'save') => {
    if (panel === 'compare' || panel === 'history' || panel === 'save') {
      setReportVisible(false);
    }
    setLayersOpen((prev) => (panel === 'layers' ? !prev : false));
    setWeatherOpen((prev) => (panel === 'weather' ? !prev : false));
    setCompareOpen((prev) => (panel === 'compare' ? !prev : false));
    setHistoryOpen((prev) => (panel === 'history' ? !prev : false));
    setSaveOpen((prev) => (panel === 'save' ? !prev : false));
  };

  const closeSidePanels = () => {
    setLayersOpen(false);
    setWeatherOpen(false);
    setCompareOpen(false);
    setHistoryOpen(false);
    setSaveOpen(false);
  };

  const handleReportVisibilityChange = (visible: boolean) => {
    setReportVisible(visible);
    if (visible) {
      setCompareOpen(false);
      setHistoryOpen(false);
      setSaveOpen(false);
    }
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

  const weatherLayers: OverlayLayerId[] = [
    'airtemp',
    'clouds',
    'precipitation',
    'pressure',
    'inundacion',
  ];

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
    setOverlayLayerIds((prev) => prev.filter((item) => !weatherLayers.includes(item)));
    setAirQualityOn(true);
    setBaseLayerId('ica');
  };



  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <LeftSidebar
        layersOpen={layersOpen}
        onLayersToggle={() => togglePanel('layers')}
        weatherOpen={weatherOpen}
        onWeatherToggle={() => togglePanel('weather')}
        onCompareClick={() => togglePanel('compare')}
        onHistoryClick={() => togglePanel('history')}
        onSaveClick={() => togglePanel('save')}
        reportAvailable={reportAvailable}
        reportOpen={reportVisible}
        onReportToggle={() => handleReportVisibilityChange(!reportVisible)}
        baseLayerId={baseLayerId}
        overlayLayerIds={overlayLayerIds}
        onBaseLayerChange={handleBaseChange}
        onOverlayToggle={(id) =>
          setOverlayLayerIds((prev) => {
            const isWeather = weatherLayers.includes(id);
            const withoutTarget = prev.filter((item) => item !== id);
            if (prev.includes(id)) return withoutTarget;
            if (!isWeather) return [...withoutTarget, id];
            if (airQualityOn) {
              setAirQualityOn(false);
              setBaseLayerId(lastBaseRef.current ?? 'osm');
            }
            const withoutWeather = withoutTarget.filter(
              (item) => !weatherLayers.includes(item)
            );
            return [...withoutWeather, id];
          })
        }
        aqiAvailable={aqiAvailable}
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
         onReportOpen={closeSidePanels}
         reportVisible={reportVisible}
         onReportVisibilityChange={handleReportVisibilityChange}
         onReportStateChange={(state) => {
           setReportAvailable(state.loading || state.hasReport);
         }}
         selectedPlace={selectedPlace}
       />
      </div>
    </div>
  );
}
