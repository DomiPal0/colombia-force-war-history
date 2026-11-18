import { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Pencil, Star, X } from 'lucide-react';
import type { WarEntry } from '../types/war';
import { isEditableNewWar, WAR_SIZE_OPTIONS } from '../utils/githubEditor';
import {
  formatPeriodLabel,
  formatSigned,
  formatStars,
  parseResultNumber,
} from '../utils/warUtils';

interface WarCardListProps {
  wars: WarEntry[];
  totalMatched: number;
  totalArchive: number;
  page: number;
  totalPages: number;
  selectedPeriod: string | null;
  onClearPeriod: () => void;
  onPageChange: (nextPage: number) => void;
  onResetFilters: () => void;
  isEditorUnlocked?: boolean;
  latestWarDate?: string;
  onSaveWarDetails?: (
    war: WarEntry,
    stars: [string, string],
    size: string,
  ) => Promise<void>;
}

function getWarDomKey(war: WarEntry): string {
  return `${war.date}-${war.left.name}-${war.right.name}`;
}

export function WarCardList({
  wars,
  totalMatched,
  totalArchive,
  page,
  totalPages,
  selectedPeriod,
  onClearPeriod,
  onPageChange,
  onResetFilters,
  isEditorUnlocked = false,
  latestWarDate,
  onSaveWarDetails,
}: WarCardListProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftLeftStars, setDraftLeftStars] = useState<string>('');
  const [draftRightStars, setDraftRightStars] = useState<string>('');
  const [draftSize, setDraftSize] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedNoticeKey, setSavedNoticeKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditorUnlocked) {
      setEditingKey(null);
      setSaveError(null);
    }
  }, [isEditorUnlocked]);

  useEffect(() => {
    if (!savedNoticeKey) return;
    const timer = window.setTimeout(() => setSavedNoticeKey(null), 4000);
    return () => window.clearTimeout(timer);
  }, [savedNoticeKey]);

  const startEditing = (war: WarEntry) => {
    const key = getWarDomKey(war);
    setEditingKey(key);
    setDraftLeftStars(war.stars[0] && war.stars[0] !== '—' ? war.stars[0] : '');
    setDraftRightStars(war.stars[1] && war.stars[1] !== '—' ? war.stars[1] : '');
    setDraftSize(
      WAR_SIZE_OPTIONS.includes(war.size as (typeof WAR_SIZE_OPTIONS)[number])
        ? war.size
        : '',
    );
    setSaveError(null);
  };

  const cancelEditing = () => {
    if (isSaving) return;
    setEditingKey(null);
    setSaveError(null);
  };

  const handleSave = async (war: WarEntry) => {
    if (!onSaveWarDetails || isSaving) return;
    const key = getWarDomKey(war);
    const nextStars: [string, string] = [
      draftLeftStars.trim() || '—',
      draftRightStars.trim() || '—',
    ];
    const nextSize = draftSize.trim() || '—';

    setIsSaving(true);
    setSaveError(null);
    try {
      await onSaveWarDetails(war, nextStars, nextSize);
      setEditingKey(null);
      setSavedNoticeKey(key);
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'No se pudieron guardar los cambios.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-4">
      <div
        className="flex flex-wrap items-center justify-between gap-2 pb-3 text-xs font-medium text-slate-400 tabular-nums"
        aria-live="polite"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span>
            Mostrando {wars.length} de {totalMatched} guerras filtradas (archivo total: {totalArchive})
          </span>

          {selectedPeriod && (
            <button
              type="button"
              onClick={onClearPeriod}
              className="inline-flex items-center gap-1 rounded-md border-2 border-[#c6f36b]/60 bg-[#c6f36b]/15 px-2 py-0.5 text-[11px] font-semibold text-[#d9f99d] transition hover:bg-[#c6f36b]/25"
            >
              <span>Período: {formatPeriodLabel(selectedPeriod).full}</span>
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {totalMatched > 0 && totalPages > 1 && (
          <nav
            aria-label="Paginación superior"
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-[#3b5573] bg-[#101c2d] px-2.5 py-1 text-[11px] font-semibold text-slate-100 transition hover:border-[#c6f36b] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Anterior</span>
            </button>

            <span className="font-mono text-[11px] font-semibold text-slate-300">
              Pág. {page}/{totalPages}
            </span>

            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-[#c6f36b] bg-[#c6f36b] px-2.5 py-1 text-[11px] font-bold text-[#111c08] transition hover:bg-[#d9f99d] disabled:cursor-not-allowed disabled:border-[#3b5573] disabled:bg-[#101c2d] disabled:text-slate-500"
            >
              <span>Siguiente</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </nav>
        )}
      </div>

      {wars.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-[#3b5573] bg-[#0e1827] px-5 py-12 text-center">
          <p className="text-sm font-medium text-slate-300">
            No hay guerras que coincidan con los filtros actuales.
          </p>
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-4 inline-flex items-center rounded-lg border-2 border-[#47668a] bg-[#132236] px-4 py-2 text-xs font-semibold text-white transition hover:border-[#c6f36b]"
          >
            Restablecer filtros
          </button>
        </div>
      ) : (
        <section aria-label="Listado de guerras" className="grid gap-3">
          {wars.map((war) => {
            const key = getWarDomKey(war);
            const canEdit = Boolean(
              isEditorUnlocked &&
                onSaveWarDetails &&
                isEditableNewWar(war, latestWarDate),
            );
            const isEditing = canEdit && editingKey === key;

            const resNum = parseResultNumber(war.result);
            const resultTone =
              resNum === null ? 'none' : resNum > 0 ? 'win' : 'loss';
            const resultLabel =
              resultTone === 'win'
                ? `VICTORIA ${formatSigned(resNum)}`
                : resultTone === 'loss'
                  ? `DERROTA ${formatSigned(resNum)}`
                  : 'Sin resultado';

            const extraNotes =
              war.notes && war.notes !== '—'
                ? war.notes
                    .split(',')
                    .map((n) => n.trim())
                    .filter(Boolean)
                : [];

            return (
              <article
                key={key}
                className="grid grid-cols-1 items-start gap-4 rounded-xl border-2 border-[#334b66] bg-gradient-to-r from-[#122033] via-[#0f1b2b] to-[#122033] px-4 py-4 transition hover:border-[#5b7fa6] md:grid-cols-[minmax(0,1fr)_196px_minmax(0,1fr)] md:px-5"
              >
                {/* Lado Izquierdo: COLOMBIA FORCE */}
                <div className="min-w-0 text-left">
                  <h3 className="font-display text-[20px] font-extrabold leading-snug tracking-tight text-[#f7aa37] break-words">
                    {war.left.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Ranking:{' '}
                    <span className="font-mono font-semibold text-slate-200 tabular-nums">
                      {war.left.rank}
                    </span>{' '}
                    · Gloria:{' '}
                    <span className="font-mono font-semibold text-slate-200 tabular-nums">
                      {war.left.glory}
                    </span>{' '}
                    · División:{' '}
                    <span className="font-semibold text-slate-200">{war.left.division}</span>
                  </p>
                  {(isEditing || war.size !== '—' || extraNotes.length > 0) && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      {isEditing ? (
                        <select
                          aria-label="Tamaño de guerra"
                          value={draftSize}
                          onChange={(e) => setDraftSize(e.target.value)}
                          disabled={isSaving}
                          className="rounded-lg border-2 border-[#3b5573] bg-[#101c2d] px-2.5 py-1 font-mono text-xs font-semibold text-white transition focus:border-[#c6f36b] focus:outline-none disabled:opacity-60"
                        >
                          <option value="">Tamaño…</option>
                          {WAR_SIZE_OPTIONS.map((optionSize) => (
                            <option key={optionSize} value={optionSize}>
                              {optionSize}
                            </option>
                          ))}
                        </select>
                      ) : (
                        war.size !== '—' && (
                          <span className="rounded-md border border-[#3d5775] bg-[#0c1624] px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-200">
                            {war.size}
                          </span>
                        )
                      )}
                      {extraNotes.map((note) => {
                        const isClose = note.toLowerCase().includes('close');
                        const isTime = note.toLowerCase().includes('time');
                        return (
                          <span
                            key={note}
                            className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                              isClose
                                ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                                : isTime
                                  ? 'border-sky-500/50 bg-sky-500/10 text-sky-300'
                                  : 'border-[#3d5775] bg-[#0c1624] text-slate-300'
                            }`}
                          >
                            {note}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Centro: Fecha, Estrellas con estrella amarilla grande, Resultado más legible */}
                <div className="flex flex-col items-center justify-start border-y-2 border-[#23354b] py-3 text-center md:border-x-2 md:border-y-0 md:px-3 md:py-0">
                  <time className="font-mono text-xs font-medium text-slate-400 tabular-nums">
                    {war.date}
                  </time>

                  {isEditing ? (
                    <div className="mt-1.5 flex items-center justify-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={3}
                        value={draftLeftStars}
                        onChange={(e) =>
                          setDraftLeftStars(e.target.value.replace(/[^\d]/g, '').slice(0, 3))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSave(war);
                          if (e.key === 'Escape') cancelEditing();
                        }}
                        disabled={isSaving}
                        placeholder="—"
                        aria-label={`Estrellas de ${war.left.name}`}
                        className="w-14 rounded-lg border-2 border-[#3b5573] bg-[#101c2d] px-1.5 py-1 text-center font-mono text-base font-bold text-white placeholder:text-slate-500 transition focus:border-[#c6f36b] focus:outline-none disabled:opacity-60"
                      />
                      <Star
                        className="h-5 w-5 shrink-0 fill-yellow-400 text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.35)] sm:h-6 sm:w-6"
                        aria-hidden="true"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={3}
                        value={draftRightStars}
                        onChange={(e) =>
                          setDraftRightStars(e.target.value.replace(/[^\d]/g, '').slice(0, 3))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSave(war);
                          if (e.key === 'Escape') cancelEditing();
                        }}
                        disabled={isSaving}
                        placeholder="—"
                        aria-label={`Estrellas de ${war.right.name}`}
                        className="w-14 rounded-lg border-2 border-[#3b5573] bg-[#101c2d] px-1.5 py-1 text-center font-mono text-base font-bold text-white placeholder:text-slate-500 transition focus:border-[#c6f36b] focus:outline-none disabled:opacity-60"
                      />
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center justify-center gap-2 font-mono text-2xl font-extrabold leading-none text-slate-100 tabular-nums sm:text-[26px]">
                      <span>{formatStars(war.stars[0])}</span>
                      <Star
                        className="h-5 w-5 shrink-0 fill-yellow-400 text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.35)] sm:h-6 sm:w-6"
                        aria-hidden="true"
                      />
                      <span>{formatStars(war.stars[1])}</span>
                    </div>
                  )}

                  <div
                    className={`mt-2 font-display text-lg font-extrabold uppercase tracking-wide tabular-nums sm:text-base ${
                      resultTone === 'win'
                        ? 'text-emerald-400'
                        : resultTone === 'loss'
                          ? 'text-rose-400'
                          : 'text-slate-400'
                    }`}
                  >
                    {resultLabel}
                  </div>

                  {canEdit && (
                    <div className="mt-2 flex flex-col items-center gap-1.5">
                      {isEditing ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSave(war)}
                              disabled={isSaving}
                              className="inline-flex items-center gap-1 rounded-md border border-[#c6f36b] bg-[#c6f36b] px-2.5 py-1 text-[11px] font-bold text-[#111c08] transition hover:bg-[#d9f99d] disabled:opacity-60"
                            >
                              <Check className="h-3 w-3" />
                              <span>{isSaving ? 'Guardando…' : 'Guardar'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              disabled={isSaving}
                              className="inline-flex items-center gap-1 rounded-md border border-[#3b5573] bg-[#101c2d] px-2 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-slate-400 hover:text-white disabled:opacity-60"
                            >
                              <X className="h-3 w-3" />
                              <span>Cancelar</span>
                            </button>
                          </div>
                          {saveError && (
                            <p className="max-w-[180px] text-[11px] leading-tight text-rose-300">
                              {saveError}
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEditing(war)}
                            className="inline-flex items-center gap-1 rounded-md border border-[#3b5573] bg-[#101c2d] px-2 py-0.5 text-[11px] font-semibold text-slate-300 transition hover:border-[#c6f36b] hover:text-[#c6f36b]"
                          >
                            <Pencil className="h-3 w-3" />
                            <span>Editar</span>
                          </button>
                          {savedNoticeKey === key && (
                            <span className="text-[11px] font-semibold text-[#c6f36b]">
                              Guardado
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Lado Derecho: Rival alineado exactamente a la misma altura */}
                <div className="min-w-0 text-left md:text-right">
                  <h3 className="font-display text-[20px] font-extrabold leading-snug tracking-tight text-[#f7aa37] break-words">
                    {war.right.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Ranking:{' '}
                    <span className="font-mono font-semibold text-slate-200 tabular-nums">
                      {war.right.rank}
                    </span>{' '}
                    · Gloria:{' '}
                    <span className="font-mono font-semibold text-slate-200 tabular-nums">
                      {war.right.glory}
                    </span>{' '}
                    · División:{' '}
                    <span className="font-semibold text-slate-200">{war.right.division}</span>
                  </p>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Paginación */}
      <nav
        aria-label="Paginación"
        className="mt-6 flex items-center justify-center gap-3 py-3 text-sm tabular-nums"
      >
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#3b5573] bg-[#101c2d] px-3.5 py-2 text-xs font-semibold text-slate-100 transition hover:border-[#c6f36b] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Anterior</span>
        </button>

        <span className="font-mono text-xs font-semibold text-slate-300">
          Página {totalMatched ? page : 0} de {totalMatched ? totalPages : 0}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages || totalMatched === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#c6f36b] bg-[#c6f36b] px-3.5 py-2 text-xs font-bold text-[#111c08] transition hover:bg-[#d9f99d] disabled:cursor-not-allowed disabled:border-[#3b5573] disabled:bg-[#101c2d] disabled:text-slate-500"
        >
          <span>Siguiente</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
}
