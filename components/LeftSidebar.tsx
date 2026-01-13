'use client';

import { useState } from 'react';
import { Layers, Cloud, ArrowLeftRight, History, StickyNote } from 'lucide-react';
import { BaseLayerId, OverlayLayerId } from '../map/layers';
import ThemeToggle from './ThemeToggle';

interface LeftSidebarProps {
  layersOpen: boolean;
  onLayersToggle: () => void;
  weatherOpen: boolean;
  onWeatherToggle: () => void;
  onCompareClick?: () => void;
  onHistoryClick?: () => void;
  onSaveClick?: () => void;
  baseLayerId: BaseLayerId;
  overlayLayerIds: OverlayLayerId[];
  onBaseLayerChange: (id: BaseLayerId) => void;
  onOverlayToggle: (id: OverlayLayerId) => void;
  aqiAvailable: boolean;
  aqicnToken?: string;
  airQualityOn: boolean;
  onAirQualityToggle: () => void;
}

export default function LeftSidebar({
  layersOpen,
  onLayersToggle,
  weatherOpen,
  onWeatherToggle,
  onCompareClick,
  onHistoryClick,
  onSaveClick,
  baseLayerId,
  overlayLayerIds,
  onBaseLayerChange,
  onOverlayToggle,
  aqiAvailable,
  aqicnToken,
  airQualityOn,
  onAirQualityToggle,
}: LeftSidebarProps) {
  const [tooltip, setTooltip] = useState<{ name: string; top: number; left: number } | null>(null);
  const aqiPreview = aqicnToken
    ? `https://tiles.waqi.info/tiles/usepa-aqi/6/32/21.png?token=${aqicnToken}`
    : 'https://a.tile.openstreetmap.org/6/32/21.png';
  const openWeatherKey = process.env.NEXT_PUBLIC_OPENWEATHER_KEY ?? '';
  const openWeatherPreview = openWeatherKey
    ? `https://tile.openweathermap.org/map/temp_new/6/32/21.png?appid=${openWeatherKey}`
    : 'https://a.tile.openstreetmap.org/6/32/21.png';
  const openWeatherCloudsPreview = openWeatherKey
    ? `https://tile.openweathermap.org/map/clouds_new/6/32/21.png?appid=${openWeatherKey}`
    : 'https://a.tile.openstreetmap.org/6/32/21.png';
  const openWeatherPrecipitationPreview = openWeatherKey
    ? `https://tile.openweathermap.org/map/precipitation_new/6/32/21.png?appid=${openWeatherKey}`
    : 'https://a.tile.openstreetmap.org/6/32/21.png';
  const openWeatherPressurePreview = openWeatherKey
    ? `https://tile.openweathermap.org/map/pressure_new/6/32/21.png?appid=${openWeatherKey}`
    : 'https://a.tile.openstreetmap.org/6/32/21.png';
  const openWeatherWindPreview = openWeatherKey
    ? `https://tile.openweathermap.org/map/wind_new/6/32/21.png?appid=${openWeatherKey}`
    : 'https://a.tile.openstreetmap.org/6/32/21.png';
  const mapTypeOptions = [
    {
      id: 'osm' as BaseLayerId,
      label: 'Estandar',
      preview: 'https://a.tile.openstreetmap.org/6/32/21.png',
    },
    {
      id: 'satellite' as BaseLayerId,
      label: 'Satelite',
      preview:
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/6/21/32',
    },
  ];

  const detailOptions = [
    {
      id: 'transport' as OverlayLayerId,
      label: 'Transporte',
      preview: 'https://tileserver.memomaps.de/tilegen/6/32/21.png',
    },
    {
      id: 'railways' as OverlayLayerId,
      label: 'Ferrocarriles',
      preview: 'https://a.tiles.openrailwaymap.org/standard/6/32/21.png',
    },
    {
      id: 'refugios' as OverlayLayerId,
      label: 'Refugios',
      preview: 'https://a.tile.openstreetmap.org/6/32/21.png',
    },
  ];
  const weatherOptions = [
    {
      id: 'airtemp' as OverlayLayerId,
      label: 'Temperatura',
      preview: openWeatherPreview,
    },
    {
      id: 'clouds' as OverlayLayerId,
      label: 'Nubes',
      preview: openWeatherCloudsPreview,
    },
    {
      id: 'precipitation' as OverlayLayerId,
      label: 'Precipitacion',
      preview: openWeatherPrecipitationPreview,
    },
    {
      id: 'pressure' as OverlayLayerId,
      label: 'Presion nivel del mar',
      preview: openWeatherPressurePreview,
    },
    {
      id: 'wind' as OverlayLayerId,
      label: 'Velocidad del viento',
      preview: openWeatherWindPreview,
    },
    {
      id: 'inundacion' as OverlayLayerId,
      label: 'Riesgo inundacion (ARPSI)',
      preview:
        'https://wms.mapama.gob.es/sig/agua/ZI_ARPSI?service=WMS&request=GetMap&version=1.3.0&layers=NZ.RiskZone&styles=Agua_Zi_ARPSI&crs=CRS:84&bbox=-6,36,3,44&width=256&height=256&format=image/png&transparent=true',
    },
  ];

  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:flex w-[3vw] min-w-12 flex-col items-center justify-start gap-6 pt-4 z-3000 bg-card/90 text-foreground shadow-lg border border-border relative">
        <ThemeToggle className="border-0 shadow-none" />

        <button
          type="button"
          className="mt-12 w-10 h-10 flex items-center justify-center rounded-lg text-foreground hover:bg-accent transition relative"
          onClick={onLayersToggle}
          onMouseEnter={(e) => {
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
            setTooltip({ name: 'Capas', top: rect.top + rect.height / 2, left: rect.right });
          }}
          onMouseLeave={() => setTooltip(null)}
          aria-expanded={layersOpen}
          aria-controls="layers-panel"
        >
          <Layers className="h-5 w-5" />
        </button>

        <button
          type="button"
          className="mt-8 w-10 h-10 flex items-center justify-center rounded-lg text-foreground hover:bg-accent transition relative"
          onClick={onWeatherToggle}
          onMouseEnter={(e) => {
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
            setTooltip({ name: 'Clima', top: rect.top + rect.height / 2, left: rect.right });
          }}
          onMouseLeave={() => setTooltip(null)}
          aria-expanded={weatherOpen}
          aria-controls="weather-panel"
        >
          <Cloud className="h-5 w-5" />
        </button>

        <div className="flex-[0.05]" />

        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center rounded-lg text-foreground hover:bg-accent transition relative"
          onClick={() => onCompareClick?.()}
          onMouseEnter={(e) => {
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
            setTooltip({ name: 'Comparar ciudades', top: rect.top + rect.height / 2, left: rect.right });
          }}
          onMouseLeave={() => setTooltip(null)}
        >
          <ArrowLeftRight className="h-5 w-5" />
        </button>

        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center rounded-lg text-foreground hover:bg-accent transition relative"
          onClick={() => onHistoryClick?.()}
          onMouseEnter={(e) => {
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
            setTooltip({ name: 'Histórico', top: rect.top + rect.height / 2, left: rect.right });
          }}
          onMouseLeave={() => setTooltip(null)}
        >
          <History className="h-5 w-5" />
        </button>

        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center rounded-lg text-foreground hover:bg-accent transition relative"
          onClick={() => onSaveClick?.()}
          onMouseEnter={(e) => {
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
            setTooltip({ name: 'Notas y comentarios', top: rect.top + rect.height / 2, left: rect.right });
          }}
          onMouseLeave={() => setTooltip(null)}
        >
          <StickyNote className="h-5 w-5" />
        </button>

        <div className="flex-1" />
      </aside>

      {/* Tooltip encima del mapa */}
      {tooltip && (
        <div
          className="fixed text-xs px-2 py-1 rounded border border-border bg-popover text-foreground shadow-lg z-[9999] whitespace-nowrap"
          style={{ top: tooltip.top, left: tooltip.left + 16, transform: 'translateY(-50%)' }}
        >
          <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full border-y-[6px] border-y-transparent border-r-[7px] border-r-border" />
          <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[calc(100%-1px)] border-y-[5px] border-y-transparent border-r-[6px] border-r-popover" />
          {tooltip.name}
        </div>
      )}

      <div
        className={`fixed inset-x-0 top-0 md:inset-auto md:z-[6000] ${
          layersOpen
            ? 'bottom-0 z-[1400] pointer-events-auto'
            : 'bottom-16 z-[1200] pointer-events-none'
        }`}
      >
        <button
          type="button"
          aria-label="Cerrar panel de capas"
          className={`absolute inset-0 bg-black/50 transition-opacity md:hidden ${
            layersOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={onLayersToggle}
        />

        <div
          id="layers-panel"
          className={`fixed left-0 right-0 h-[clamp(360px,55vh,520px)] rounded-t-2xl bg-card border-t border-border shadow-2xl p-4 text-foreground transition-transform duration-300 ease-out md:left-[calc(var(--sidebar-offset)+1rem)] md:top-24 md:bottom-auto md:right-auto md:h-auto md:w-72 md:rounded-xl md:border md:border-border md:transition-none md:p-4 md:h-[clamp(420px,60vh,640px)] ${
            layersOpen ? 'bottom-0 translate-y-0 z-[1500]' : 'bottom-16 translate-y-full z-[800] md:translate-y-0'
          } ${layersOpen ? 'md:block' : 'md:hidden'}`}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Capas del mapa</h3>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={onLayersToggle}
              aria-label="Cerrar capas"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4 pb-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                Tipo de mapa
              </p>
              <div className="grid grid-cols-3 gap-3 md:grid-cols-2">
                {mapTypeOptions.map((layer) => (
                  <label
                    key={layer.id}
                    className={`flex flex-col items-center gap-2 text-xs leading-snug text-foreground ${
                      layer.id === 'ica' && !aqiAvailable ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="base-layer"
                      className="sr-only peer"
                      checked={baseLayerId === layer.id}
                      onChange={() => onBaseLayerChange(layer.id)}
                    />
                    <div className="h-20 w-full overflow-hidden rounded-lg border border-border/60 bg-muted/30 shadow-sm transition-all peer-checked:border-primary peer-checked:ring-2 peer-checked:ring-primary/30 md:h-14">
                      <img
                        src={layer.preview}
                        alt={layer.label}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <span className="text-center text-[11px] text-foreground">{layer.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                Detalles
              </p>
              <div className="grid grid-cols-3 gap-3 md:grid-cols-2">
                {detailOptions.map((layer) => (
                  <label
                    key={layer.id}
                    className="flex flex-col items-center gap-2 text-xs leading-snug text-foreground"
                  >
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={overlayLayerIds.includes(layer.id)}
                      onChange={() => onOverlayToggle(layer.id)}
                    />
                    <div className="h-20 w-full overflow-hidden rounded-lg border border-border/60 bg-muted/30 shadow-sm transition-all peer-checked:border-primary peer-checked:ring-2 peer-checked:ring-primary/30 md:h-14">
                      <img
                        src={layer.preview}
                        alt={layer.label}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <span className="text-center text-[11px] text-foreground">{layer.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`fixed inset-x-0 top-0 md:inset-auto md:z-[6000] ${
          weatherOpen
            ? 'bottom-0 z-[1400] pointer-events-auto'
            : 'bottom-16 z-[1200] pointer-events-none'
        }`}
      >
        <button
          type="button"
          aria-label="Cerrar panel de clima"
          className={`absolute inset-0 bg-black/50 transition-opacity md:hidden ${
            weatherOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={onWeatherToggle}
        />

        <div
          id="weather-panel"
          className={`fixed left-0 right-0 h-[clamp(320px,45vh,420px)] rounded-t-2xl bg-card border-t border-border shadow-2xl p-4 text-foreground transition-transform duration-300 ease-out md:left-[calc(var(--sidebar-offset)+1rem)] md:top-24 md:bottom-auto md:right-auto md:h-auto md:w-72 md:rounded-xl md:border md:border-border md:transition-none md:p-4 md:h-[clamp(320px,50vh,520px)] ${
            weatherOpen ? 'bottom-0 translate-y-0 z-[1500]' : 'bottom-16 translate-y-full z-[800] md:translate-y-0'
          } ${weatherOpen ? 'md:block' : 'md:hidden'}`}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Clima</h3>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={onWeatherToggle}
              aria-label="Cerrar clima"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4 pb-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
              Capas meteorologicas
            </p>
            <div className="grid grid-cols-3 gap-3 md:grid-cols-2">
              <label
                className={`flex flex-col items-center gap-2 text-xs leading-snug text-foreground ${
                  !aqiAvailable ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only peer"
                  disabled={!aqiAvailable}
                  checked={airQualityOn}
                  onChange={onAirQualityToggle}
                />
                <div className="h-20 w-full overflow-hidden rounded-lg border border-border/60 bg-muted/30 shadow-sm transition-all peer-checked:border-primary peer-checked:ring-2 peer-checked:ring-primary/30 md:h-14">
                  <img
                    src={aqiPreview}
                    alt="Calidad del aire"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <span className="text-center text-[11px] text-foreground">Calidad del aire</span>
              </label>

              {weatherOptions.map((layer) => (
                <label
                  key={layer.id}
                  className="flex flex-col items-center gap-2 text-xs leading-snug text-foreground"
                >
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={overlayLayerIds.includes(layer.id)}
                    onChange={() => onOverlayToggle(layer.id)}
                  />
                  <div className="h-20 w-full overflow-hidden rounded-lg border border-border/60 bg-muted/30 shadow-sm transition-all peer-checked:border-primary peer-checked:ring-2 peer-checked:ring-primary/30 md:h-14">
                    <img
                      src={layer.preview}
                      alt={layer.label}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <span className="text-center text-[11px] text-foreground">{layer.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile */}
      <div className="fixed top-20 right-3 md:hidden z-[1100] flex flex-col items-center gap-3">
        <button
          type="button"
          className="w-11 h-11 flex items-center justify-center rounded-full bg-card/95 text-foreground shadow-lg border border-border hover:bg-accent transition"
          onClick={onLayersToggle}
          aria-expanded={layersOpen}
          aria-controls="layers-panel"
        >
          <Layers className="h-5 w-5" />
        </button>

        <ThemeToggle />
      </div>

      <div className="fixed bottom-0 left-0 right-0 md:hidden z-[1300]">
        <div className="mx-auto flex h-16 w-full items-center justify-center gap-3 bg-card/95 px-4 shadow-xl border-t border-border">
          <button
            type="button"
            className="w-11 h-11 flex items-center justify-center rounded-full text-foreground hover:bg-accent transition"
            onClick={onWeatherToggle}
            aria-expanded={weatherOpen}
            aria-controls="weather-panel"
          >
            <Cloud className="h-5 w-5" />
          </button>

          <button
            type="button"
            className="w-11 h-11 flex items-center justify-center rounded-full text-foreground hover:bg-accent transition"
            onClick={() => onCompareClick?.()}
          >
            <ArrowLeftRight className="h-5 w-5" />
          </button>

          <button
            type="button"
            className="w-11 h-11 flex items-center justify-center rounded-full text-foreground hover:bg-accent transition"
            onClick={() => onHistoryClick?.()}
          >
            <History className="h-5 w-5" />
          </button>

          <button
            type="button"
            className="w-11 h-11 flex items-center justify-center rounded-full text-foreground hover:bg-accent transition"
            onClick={() => onSaveClick?.()}
          >
            <StickyNote className="h-5 w-5" />
          </button>
        </div>
      </div>
    </>
  );
}
