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

  // Keep mounted for desktop slide animation.

  return (
    <div
      className={`fixed inset-0 z-[1200] flex-col overflow-hidden bg-card/95 pb-20 text-foreground shadow-2xl backdrop-blur transition-none md:absolute md:left-4 md:right-auto md:top-24 md:inset-auto md:h-[75vh] md:w-[320px] lg:w-[420px] md:rounded-2xl md:border md:border-border md:pb-0 md:transition-all md:duration-300 md:ease-out md:transform ${
        open ? 'flex' : 'hidden md:flex'
      } ${open ? 'md:translate-x-0 md:opacity-100' : 'md:-translate-x-full md:opacity-0 md:pointer-events-none'}`}
      aria-hidden={!open}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {mode === 'history' ? 'Histórico' : 'Notas y comentarios'}
          </h3>
          <p className="text-xs text-muted-foreground">{currentLabel}</p>
        </div>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground"
          onClick={onClose}
          aria-label="Cerrar panel"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="border-t border-border" />

        {mode === 'history' && (
          <>
            <div className="space-y-3 px-4 py-4">
              <Button className="w-full" onClick={handleHistory} disabled={historyLoading}>
                {historyLoading ? 'Analizando...' : 'Generar análisis histórico (5 años)'}
              </Button>
              {historyError && <p className="text-xs text-destructive">{historyError}</p>}
              {history && (
                <div className="rounded-xl border border-border/60 bg-card px-3 py-3 text-xs text-foreground shadow-sm">
                  <div className="font-semibold text-foreground">Resumen</div>
                  <p className="mt-1">{history.summary}</p>
                  <div className="mt-2 grid gap-2 text-[11px] text-muted-foreground">
                    <div>Media temp: {history.metrics.avgTemp ?? 'N/D'} °C</div>
                    <div>Precipitación total: {history.metrics.totalPrecip ?? 'N/D'} mm</div>
                    <div>Días analizados: {history.metrics.days}</div>
                  </div>
                  {history.metrics.byYear?.length ? (
                    <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
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
            <div className="border-t border-border" />
          </>
        )}

        {mode === 'save' && (
          <>
            <div className="space-y-3 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
              {savingError && <p className="text-xs text-destructive">{savingError}</p>}
            </div>
            <div className="border-t border-border" />
          </>
        )}

        {mode === 'save' && (
          <div className="px-4 pb-4">
            <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ubicaciones guardadas
            </div>
            <div className="mt-3 space-y-2">
              {saved.length === 0 && (
                <div className="text-xs text-muted-foreground">Aún no hay ubicaciones guardadas.</div>
              )}
              {saved.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border/60 bg-card px-3 py-3 shadow-sm"
                >
                  <div className="text-xs font-semibold text-foreground">{item.label}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {item.lat.toFixed(4)}, {item.lon.toFixed(4)}
                  </div>
                  {(item.note || item.comment) && (
                    <div className="mt-2 text-[11px] text-foreground">
                      {item.note && <div>Nota: {item.note}</div>}
                      {item.comment && <div>Comentario: {item.comment}</div>}
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                    <button
                      type="button"
                      className="text-primary hover:opacity-80"
                      onClick={() =>
                        onSelectLocation({ lat: item.lat, lon: item.lon, label: item.label })
                      }
                    >
                      Ir a ubicación
                    </button>
                    <button
                      type="button"
                      className="text-destructive hover:opacity-80"
                      onClick={() => handleDelete(item.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
