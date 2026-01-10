'use client';

import { useState } from 'react';
import {
  baseLayerOptions,
  overlayLayerOptions,
  BaseLayerId,
  OverlayLayerId,
} from '../map/layers';

interface LeftSidebarProps {
  layersOpen: boolean;
  onLayersToggle: () => void;
  onCompareClick?: () => void;
  onHistoryClick?: () => void;
  onSaveClick?: () => void;
  baseLayerId: BaseLayerId;
  overlayLayerIds: OverlayLayerId[];
  onBaseLayerChange: (id: BaseLayerId) => void;
  onOverlayToggle: (id: OverlayLayerId) => void;
  aqiAvailable: boolean;
}

export default function LeftSidebar({
  layersOpen,
  onLayersToggle,
  onCompareClick,
  onHistoryClick,
  onSaveClick,
  baseLayerId,
  overlayLayerIds,
  onBaseLayerChange,
  onOverlayToggle,
  aqiAvailable,
}: LeftSidebarProps) {
  const [tooltip, setTooltip] = useState<{ name: string; top: number; left: number } | null>(null);

  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:flex w-[3vw] min-w-12 flex-col items-center justify-center gap-6 z-3000 bg-[#F4EDE6] relative">
        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center rounded-lg text-black hover:bg-black/10 transition relative"
          onClick={onLayersToggle}
          onMouseEnter={(e) => {
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
            setTooltip({ name: 'Capas', top: rect.top + rect.height / 2, left: rect.right });
          }}
          onMouseLeave={() => setTooltip(null)}
          aria-expanded={layersOpen}
          aria-controls="layers-panel"
        >
          🗺️
        </button>

        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center rounded-lg text-black hover:bg-black/10 transition relative"
          onClick={() => onCompareClick?.()}
          onMouseEnter={(e) => {
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
            setTooltip({ name: 'Comparar ciudades', top: rect.top + rect.height / 2, left: rect.right });
          }}
          onMouseLeave={() => setTooltip(null)}
        >
          🏙️
        </button>

        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center rounded-lg text-black hover:bg-black/10 transition relative"
          onClick={() => onHistoryClick?.()}
          onMouseEnter={(e) => {
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
            setTooltip({ name: 'Histórico y notas', top: rect.top + rect.height / 2, left: rect.right });
          }}
          onMouseLeave={() => setTooltip(null)}
        >
          🗂️
        </button>

        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center rounded-lg text-black hover:bg-black/10 transition relative"
          onClick={() => onSaveClick?.()}
          onMouseEnter={(e) => {
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
            setTooltip({ name: 'Guardar ubicación', top: rect.top + rect.height / 2, left: rect.right });
          }}
          onMouseLeave={() => setTooltip(null)}
        >
          💾
        </button>

      </aside>

      {/* Tooltip encima del mapa */}
      {tooltip && (
        <div
          className="fixed bg-black text-white text-xs px-2 py-1 rounded shadow-lg z-[9999] whitespace-nowrap"
          style={{ top: tooltip.top, left: tooltip.left, transform: 'translateY(-50%)' }}
        >
          {tooltip.name}
        </div>
      )}

      {layersOpen && (
        <div
          id="layers-panel"
          className="fixed left-4 right-4 bottom-4 md:left-16 md:top-24 md:bottom-auto md:right-auto md:w-64 bg-white border border-black/10 rounded-xl shadow-xl z-[6000] p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Capas del mapa</h3>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-700"
              onClick={onLayersToggle}
              aria-label="Cerrar capas"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Base</p>
              <div className="space-y-2">
                {baseLayerOptions.map((layer) => (
                  <label
                    key={layer.id}
                    className={`flex items-center gap-2 text-sm text-gray-700 ${
                      layer.requiresToken && !aqiAvailable ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="base-layer"
                      className="accent-black"
                      disabled={layer.requiresToken && !aqiAvailable}
                      checked={baseLayerId === layer.id}
                      onChange={() => onBaseLayerChange(layer.id)}
                    />
                    <span>
                      {layer.label}
                      {layer.requiresToken && !aqiAvailable ? ' (requiere token)' : ''}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Superposiciones</p>
              <div className="space-y-2">
                {overlayLayerOptions.map((layer) => (
                  <label key={layer.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="accent-black"
                      checked={overlayLayerIds.includes(layer.id)}
                      onChange={() => onOverlayToggle(layer.id)}
                    />
                    {layer.label}
                  </label>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Mobile */}
      <div className="fixed top-1/2 right-3 -translate-y-1/2 flex md:hidden flex-col gap-3 z-[5000]">
        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#211304] text-white shadow-lg hover:scale-110 transition"
          onClick={onLayersToggle}
          aria-expanded={layersOpen}
          aria-controls="layers-panel"
        >
          🗺️
        </button>

        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#211304] text-white shadow-lg hover:scale-110 transition"
          onClick={() => onCompareClick?.()}
        >
          🏙️
        </button>

        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#211304] text-white shadow-lg hover:scale-110 transition"
          onClick={() => onHistoryClick?.()}
        >
          🗂️
        </button>

        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#211304] text-white shadow-lg hover:scale-110 transition"
          onClick={() => onSaveClick?.()}
        >
          💾
        </button>
      </div>
    </>
  );
}
