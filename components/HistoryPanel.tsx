'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Location = {
  lat: number;
  lon: number;
  label: string;
};

type SavedLocation = {
  id: string;
  lat: number;
  lon: number;
  label: string;
  note?: string;
  comment?: string;
  savedAt: string;
};

type HistorySummary = {
  summary: string;
  metrics: {
    avgTemp: number | null;
    totalPrecip: number | null;
    days: number;
    byYear?: { year: number; avgTemp: number | null; totalPrecip: number | null }[];
  };
};

const STORAGE_KEY = 'geo-ai-saved';

export default function HistoryPanel({
  open,
  onClose,
  location,
  onSelectLocation,
  mode = 'history',
}: {
  open: boolean;
  onClose: () => void;
  location: Location | null;
  onSelectLocation: (loc: Location) => void;
  mode?: 'history' | 'save';
}) {
  const [note, setNote] = useState('');
  const [comment, setComment] = useState('');
  const [savingError, setSavingError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedLocation[]>([]);
  const [history, setHistory] = useState<HistorySummary | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setSaved(parsed);
    } catch {
      setSaved([]);
    }
  }, []);

  const saveLocations = (next: SavedLocation[]) => {
    setSaved(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const handleSave = () => {
    if (!location) {
      setSavingError('Selecciona una ubicación en el mapa.');
      return;
    }
    setSavingError(null);
    const id = `${location.lat}-${location.lon}-${Date.now()}`;
    const entry: SavedLocation = {
      id,
      lat: location.lat,
      lon: location.lon,
      label: location.label,
      note: note.trim() || undefined,
      comment: comment.trim() || undefined,
      savedAt: new Date().toISOString(),
    };
    const next = [entry, ...saved];
    saveLocations(next);
    setNote('');
    setComment('');
  };

  const handleDelete = (id: string) => {
    const next = saved.filter((item) => item.id !== id);
    saveLocations(next);
  };

  const handleHistory = async () => {
    if (!location) {
      setHistoryError('Selecciona una ubicación en el mapa.');
      return;
    }
    setHistoryLoading(true);
    setHistoryError(null);
    setHistory(null);
    try {
      const res = await fetch(
        `/api/historico?lat=${location.lat}&lon=${location.lon}`
      );
      const data = await res.json();
      if (!res.ok) {
        setHistoryError(data.error || 'No se pudo obtener el histórico.');
        return;
      }
      setHistory(data);
    } catch (err) {
      console.error(err);
      setHistoryError('Error al obtener el histórico.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const currentLabel = useMemo(() => location?.label ?? 'Sin ubicación', [location]);

  if (!open) return null;

  return (
    <div className="absolute left-3 right-3 top-16 z-[1200] max-h-[75vh] overflow-hidden rounded-2xl border border-black/10 bg-white/95 shadow-2xl backdrop-blur sm:left-4 sm:right-4 sm:top-20 md:left-4 md:right-auto md:top-24 md:h-[75vh] md:w-[420px]">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Histórico y notas</h3>
          <p className="text-xs text-gray-500">{currentLabel}</p>
        </div>
        <button
          type="button"
          className="text-gray-400 hover:text-gray-700"
          onClick={onClose}
          aria-label="Cerrar panel"
        >
          ✕
        </button>
      </div>
      <div className="border-t border-black/10" />

      {mode === 'history' && (
        <>
          <div className="space-y-3 px-4 py-4">
            <Button className="w-full" onClick={handleHistory} disabled={historyLoading}>
              {historyLoading ? 'Analizando...' : 'Generar análisis histórico (5 años)'}
            </Button>
            {historyError && <p className="text-xs text-red-500">{historyError}</p>}
            {history && (
              <div className="rounded-xl border border-black/5 bg-white px-3 py-3 text-xs text-gray-700 shadow-sm">
                <div className="font-semibold text-gray-900">Resumen</div>
                <p className="mt-1">{history.summary}</p>
                <div className="mt-2 grid gap-2 text-[11px] text-gray-600">
                  <div>Media temp: {history.metrics.avgTemp ?? 'N/D'} °C</div>
                  <div>Precipitación total: {history.metrics.totalPrecip ?? 'N/D'} mm</div>
                  <div>Días analizados: {history.metrics.days}</div>
                </div>
                {history.metrics.byYear?.length ? (
                  <div className="mt-3 space-y-1 text-[11px] text-gray-600">
                    {history.metrics.byYear.map((year) => (
                      <div key={year.year}>
                        {year.year}: {year.avgTemp ?? 'N/D'} °C · {year.totalPrecip ?? 'N/D'} mm
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
          <div className="border-t border-black/10" />
        </>
      )}

      {mode === 'save' && (
        <>
          <div className="space-y-3 px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Guardar ubicación
            </div>
            <Input
              placeholder="Nota rápida (opcional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Input
              placeholder="Comentario (opcional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <Button className="w-full" onClick={handleSave}>
              Guardar ubicación
            </Button>
            {savingError && <p className="text-xs text-red-500">{savingError}</p>}
          </div>
          <div className="border-t border-black/10" />
        </>
      )}

      <div className="max-h-[35vh] overflow-y-auto px-4 pb-4">
        <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Ubicaciones guardadas
        </div>
        <div className="mt-3 space-y-2">
          {saved.length === 0 && (
            <div className="text-xs text-gray-400">Aún no hay ubicaciones guardadas.</div>
          )}
          {saved.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-black/5 bg-white px-3 py-3 shadow-sm"
            >
              <div className="text-xs font-semibold text-gray-900">{item.label}</div>
              <div className="mt-1 text-[11px] text-gray-500">
                {item.lat.toFixed(4)}, {item.lon.toFixed(4)}
              </div>
              {(item.note || item.comment) && (
                <div className="mt-2 text-[11px] text-gray-700">
                  {item.note && <div>Nota: {item.note}</div>}
                  {item.comment && <div>Comentario: {item.comment}</div>}
                </div>
              )}
              <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-700"
                  onClick={() =>
                    onSelectLocation({ lat: item.lat, lon: item.lon, label: item.label })
                  }
                >
                  Ir a ubicación
                </button>
                <button
                  type="button"
                  className="text-red-500 hover:text-red-600"
                  onClick={() => handleDelete(item.id)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
