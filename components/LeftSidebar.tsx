'use client';

import { useState } from 'react';
import {
  Layers,
  Cloud,
  ArrowLeftRight,
  History,
  StickyNote,
  Sparkles,
  Thermometer,
  Droplets,
  Gauge,
  Wind,
  CloudRain,
} from 'lucide-react';
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
  reportAvailable?: boolean;
  reportOpen?: boolean;
  onReportToggle?: () => void;
  baseLayerId: BaseLayerId;
  overlayLayerIds: OverlayLayerId[];
  onBaseLayerChange: (id: BaseLayerId) => void;
  onOverlayToggle: (id: OverlayLayerId) => void;
  aqiAvailable: boolean;
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
  reportAvailable = false,
  reportOpen = false,
  onReportToggle,
  baseLayerId,
  overlayLayerIds,
  onBaseLayerChange,
  onOverlayToggle,
  aqiAvailable,
  airQualityOn,
  onAirQualityToggle,
}: LeftSidebarProps) {
  const [tooltip, setTooltip] = useState<{ name: string; top: number; left: number } | null>(null);
  const mapPreview = 'https://a.tile.openstreetmap.org/8/128/85.png';
  const mapTypeOptions = [
    {
      id: 'osm' as BaseLayerId,
      label: 'Estándar',
      preview: 'https://a.tile.openstreetmap.org/6/32/21.png',
    },
    {
      id: 'satellite' as BaseLayerId,
      label: 'Satélite',
      preview:
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/6/21/32',
    },
    {
      id: 'transport' as BaseLayerId,
      label: 'Transporte',
      preview: 'https://tileserver.memomaps.de/tilegen/6/32/21.png',
    },
  ];

  const detailOptions = [
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
      preview: mapPreview,
      icon: Thermometer,
      iconClass: 'text-white',
      iconBgClass: 'bg-rose-500/90',
    },
    {
      id: 'precipitation' as OverlayLayerId,
      label: 'Precipitación',
      preview: mapPreview,
      icon: Droplets,
      iconClass: 'text-white',
      iconBgClass: 'bg-sky-500/90',
    },
    {
      id: 'clouds' as OverlayLayerId,
      label: 'Nubes',
      preview: mapPreview,
      icon: Cloud,
      iconClass: 'text-white',
      iconBgClass: 'bg-slate-500/90',
    },
    {
      id: 'pressure' as OverlayLayerId,
      label: 'Presión nivel del mar',
      preview: mapPreview,
      icon: Gauge,
      iconClass: 'text-white',
      iconBgClass: 'bg-amber-500/90',
    },
    {
      id: 'inundacion' as OverlayLayerId,
      label: 'Riesgo Inundación (ARPSI)',
      preview: mapPreview,
      icon: CloudRain,
      iconClass: 'text-white',
      iconBgClass: 'bg-blue-600/90',
    },
  ];

  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:flex w-[3vw] min-w-12 flex-col items-center justify-start gap-4 pt-3 z-[3000] bg-card/90 text-foreground shadow-lg border border-border relative">
        <ThemeToggle className="border-0 shadow-none" />

        <button
          type="button"
          className="mt-8 w-10 h-10 flex items-center justify-center rounded-lg text-foreground hover:bg-accent transition relative"
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
          className="mt-6 w-10 h-10 flex items-center justify-center rounded-lg text-foreground hover:bg-accent transition relative"
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

        <div className="flex-[0.2]" />

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
            setTooltip({
              name: 'Generar histórico',
              top: rect.top + rect.height / 2,
              left: rect.right,
            });
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
            setTooltip({
              name: 'Guardar ubicación y comentario',
              top: rect.top + rect.height / 2,
              left: rect.right,
            });
          }}
          onMouseLeave={() => setTooltip(null)}
        >
          <StickyNote className="h-5 w-5" />
        </button>

        {reportAvailable && (
          <button
            type="button"
            className={`mt-8 w-10 h-10 flex items-center justify-center rounded-lg text-foreground hover:bg-accent transition relative ${
              reportOpen ? 'bg-accent' : ''
            }`}
            onClick={() => onReportToggle?.()}
            onMouseEnter={(e) => {
              const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
              setTooltip({ name: 'Informe IA', top: rect.top + rect.height / 2, left: rect.right });
            }}
            onMouseLeave={() => setTooltip(null)}
            aria-pressed={reportOpen}
            aria-label="Informe IA"
          >
            <Sparkles className="h-5 w-5" />
          </button>
        )}

        <div className="flex-1" />
        <img
          src="/Logo.png"
          alt="Logo"
          className="absolute bottom-3 h-[26px] w-[26px] rounded-full border border-border bg-white object-cover shadow-sm"
          onMouseEnter={(e) => {
            const rect = (e.currentTarget as HTMLImageElement).getBoundingClientRect();
            setTooltip({ name: 'AtlasAI', top: rect.top + rect.height / 2, left: rect.right });
          }}
          onMouseLeave={() => setTooltip(null)}
        />
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
        className={`fixed inset-x-0 top-0 md:inset-auto md:z-[2000] ${
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
          className={`fixed left-0 right-0 h-[clamp(360px,55vh,520px)] rounded-t-2xl bg-card border-t border-border shadow-2xl p-4 text-foreground transition-transform duration-300 ease-out md:left-[calc(var(--sidebar-offset)+1rem)] md:top-24 md:bottom-auto md:right-auto md:h-auto md:w-72 md:rounded-xl md:border md:border-border md:p-4 md:h-[clamp(420px,60vh,640px)] md:transition-all md:duration-300 md:ease-out md:transform md:translate-y-0 ${
            layersOpen ? 'bottom-0 translate-y-0 z-[1500]' : 'bottom-16 translate-y-full z-[800]'
          } ${layersOpen ? 'md:translate-x-0 md:opacity-100' : 'md:-translate-x-full md:opacity-0 md:pointer-events-none'}`}
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
        className={`fixed inset-x-0 top-0 md:inset-auto md:z-[2000] ${
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
          className={`fixed left-0 right-0 h-[clamp(320px,45vh,420px)] rounded-t-2xl bg-card border-t border-border shadow-2xl p-4 text-foreground transition-transform duration-300 ease-out md:left-[calc(var(--sidebar-offset)+1rem)] md:top-24 md:bottom-auto md:right-auto md:h-auto md:w-72 md:rounded-xl md:border md:border-border md:p-4 md:h-[clamp(320px,50vh,520px)] md:transition-all md:duration-300 md:ease-out md:transform md:translate-y-0 ${
            weatherOpen ? 'bottom-0 translate-y-0 z-[1500]' : 'bottom-16 translate-y-full z-[800]'
          } ${weatherOpen ? 'md:translate-x-0 md:opacity-100' : 'md:-translate-x-full md:opacity-0 md:pointer-events-none'}`}
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
                <div className="relative h-20 w-full overflow-hidden rounded-lg border border-border/60 bg-muted/30 shadow-sm transition-all peer-checked:border-primary peer-checked:ring-2 peer-checked:ring-primary/30 md:h-14">
                  <img
                    src={mapPreview}
                    alt="Calidad del aire"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-500/90 text-white shadow-md md:h-9 md:w-9">
                    <Wind className="h-6 w-6 md:h-5 md:w-5" />
                  </div>
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
                  <div className="relative h-20 w-full overflow-hidden rounded-lg border border-border/60 bg-muted/30 shadow-sm transition-all peer-checked:border-primary peer-checked:ring-2 peer-checked:ring-primary/30 md:h-14">
                    <img
                      src={layer.preview}
                      alt={layer.label}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <div
                      className={`absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-md md:h-9 md:w-9 ${layer.iconBgClass}`}
                    >
                      <layer.icon className={`h-6 w-6 md:h-5 md:w-5 ${layer.iconClass}`} />
                    </div>
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
        <div className="relative mx-auto flex h-16 w-full items-center justify-center gap-3 bg-card/95 px-4 shadow-xl border-t border-border">
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

          {reportAvailable && (
            <button
              type="button"
              className={`w-11 h-11 flex items-center justify-center rounded-full text-foreground hover:bg-accent transition ${
                reportOpen ? 'bg-accent' : ''
              }`}
              onClick={() => onReportToggle?.()}
              aria-pressed={reportOpen}
              aria-label="Informe IA"
            >
              <Sparkles className="h-5 w-5" />
            </button>
          )}

          <img
            src="/Logo.png"
            alt="Logo"
            className="absolute right-4 h-[26px] w-[26px] rounded-full border border-border bg-white object-cover shadow-sm"
          />
        </div>
      </div>
    </>
  );
}
