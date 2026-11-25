import { useEffect, useState } from 'react';
import { Check, Eraser, RotateCcw, X } from 'lucide-react';
import type { WarDirective, WarPlanPlayer, WarPlanSize } from '../types/warPlan';
import {
  applySelectionToObjective,
  countObjectives,
  getBaseCountForSize,
  MAX_DEFENSE_OBJECTIVES,
  MAX_OBJECTIVES_PER_PLAYER,
  removeLastObjectivePart,
} from '../utils/warPlanFormatting';

interface PlayerObjectiveModalProps {
  player: WarPlanPlayer | null;
  warSize: WarPlanSize;
  isDefenseGroup?: boolean;
  defenseCount?: number;
  defenseInitialObjective?: string;
  onChangeObjective: (playerId: string, nextObjective: string) => void;
  onApplyDefenseObjective?: (nextObjective: string) => void;
  onClose: () => void;
}

const DIRECTIVES: { value: WarDirective | null; label: string }[] = [
  { value: null, label: 'Atacar' },
  { value: 'espiar', label: 'Espiar' },
  { value: 'libre', label: 'Libre' },
  { value: 'esperar', label: 'Esperar' },
];

export function PlayerObjectiveModal({
  player,
  warSize,
  isDefenseGroup = false,
  defenseCount = 0,
  defenseInitialObjective = '',
  onChangeObjective,
  onApplyDefenseObjective,
  onClose,
}: PlayerObjectiveModalProps) {
  const [activeDirective, setActiveDirective] = useState<WarDirective | null>(null);
  const [defenseDraft, setDefenseDraft] = useState<string>('');

  const isOpen = Boolean(player) || isDefenseGroup;

  useEffect(() => {
    if (!isOpen) return;
    setActiveDirective(null);
    if (isDefenseGroup) {
      setDefenseDraft(defenseInitialObjective);
    }
  }, [isOpen, isDefenseGroup, player?.id, defenseInitialObjective]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxObjectives = isDefenseGroup
    ? MAX_DEFENSE_OBJECTIVES
    : MAX_OBJECTIVES_PER_PLAYER;
  const currentObjective = isDefenseGroup
    ? defenseDraft
    : player?.objective ?? '';

  const updateObjective = (next: string) => {
    if (isDefenseGroup) {
      setDefenseDraft(next);
    } else if (player) {
      onChangeObjective(player.id, next);
    }
  };

  const baseCount = getBaseCountForSize(warSize);
  const baseNumbers = Array.from({ length: baseCount }, (_, idx) => idx + 1);
  const objectiveCount = countObjectives(currentObjective);
  const isAtLimit = objectiveCount >= maxObjectives;

  const handleSelectBase = (baseNum: number) => {
    const next = applySelectionToObjective(
      currentObjective,
      baseNum,
      activeDirective,
      maxObjectives,
    );
    if (next !== currentObjective) {
      updateObjective(next);
      if (activeDirective === 'libre' || activeDirective === 'esperar') {
        setActiveDirective(null);
      }
    }
  };

  const handleApplyDirectiveOnly = () => {
    if (!activeDirective) return;
    const next = applySelectionToObjective(
      currentObjective,
      null,
      activeDirective,
      maxObjectives,
    );
    if (next !== currentObjective) {
      updateObjective(next);
    }
    setActiveDirective(null);
  };

  const handleUndo = () => {
    updateObjective(removeLastObjectivePart(currentObjective));
  };

  const handleClear = () => {
    updateObjective('');
    setActiveDirective(null);
  };

  const handleConfirmDone = () => {
    if (isDefenseGroup && onApplyDefenseObjective) {
      onApplyDefenseObjective(defenseDraft);
    }
    onClose();
  };

  const canApplyDirectiveOnly =
    activeDirective !== null &&
    applySelectionToObjective(
      currentObjective,
      null,
      activeDirective,
      maxObjectives,
    ) !== currentObjective;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#060b14]/80 px-3 py-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-player-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-xl border-2 border-[#3b5573] bg-[#0f1b2b] shadow-2xl">
        {/* Encabezado */}
        <div className="mt-0 flex items-start justify-between gap-3 border-b-2 border-[#23354b] px-4 pt-[5px] pb-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-slate-400">
              Asignar objetivos · {warSize}
            </p>
            <h2
              id="assign-player-title"
              className={`mt-[2px] truncate py-0 font-display text-[15px] leading-[21px] font-extrabold ${
                isDefenseGroup ? 'text-rose-400' : 'text-[#f7aa37]'
              }`}
            >
              {isDefenseGroup
                ? `Línea Defensiva (${defenseCount})`
                : player?.name}
            </h2>
          </div>

          <div className="flex h-[28px] shrink-0 items-center gap-2">
            <span
              className={`font-mono text-xs font-bold tabular-nums ${
                isAtLimit ? 'text-[#f7aa37]' : 'text-slate-300'
              }`}
            >
              {objectiveCount}/{maxObjectives}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar ventana"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-[#16273e] hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          {/* Objetivo actual */}
          <div className="-mt-[9px] -mb-[1px] ml-0 min-h-[111px] rounded-lg border-2 border-[#2a3f59] bg-[#0b1422] px-3 pt-[2px] pb-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="my-0 py-0 text-[10px] leading-[14.5px] font-bold uppercase tracking-[0.09em] text-slate-400">
                Objetivo actual
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={!currentObjective}
                  className="inline-flex items-center gap-1 rounded border border-[#3b5573] bg-[#101c2d] px-2 py-0.5 text-[11px] font-semibold text-slate-300 transition hover:border-[#c6f36b] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Deshacer</span>
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={!currentObjective}
                  className="inline-flex items-center gap-1 rounded border border-[#3b5573] bg-[#101c2d] px-2 py-0.5 text-[11px] font-semibold text-slate-300 transition hover:border-rose-400/70 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Eraser className="h-3 w-3" />
                  <span>Limpiar</span>
                </button>
              </div>
            </div>
            <p className="mt-1.5 font-mono text-base font-normal not-italic no-underline text-[#ef5d5d] tabular-nums">
              {currentObjective || 'Sin asignar'}
            </p>
            {isAtLimit && (
              <p className="mt-1 text-[11px] font-medium text-[#f7aa37]">
                Máximo {maxObjectives} objetivos alcanzados. Usa Deshacer o Limpiar para cambiarlos.
              </p>
            )}
          </div>

          {/* Directiva */}
          <div>
            <span className="my-0 py-0 text-[11px] font-bold uppercase tracking-[0.11em] text-slate-400">
              Tipo / Directiva
            </span>
            <div className="mt-[3px] grid grid-cols-4 gap-1 rounded-lg border-2 border-[#334b66] bg-[#0b1422] p-0.5">
              {DIRECTIVES.map((dir) => {
                const isActive = activeDirective === dir.value;
                return (
                  <button
                    key={dir.label}
                    type="button"
                    onClick={() =>
                      setActiveDirective((prev) =>
                        prev === dir.value && dir.value !== null ? null : dir.value,
                      )
                    }
                    className={`rounded-md py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? dir.value === null
                          ? 'bg-[#c6f36b] text-[#111c08]'
                          : 'bg-[#f7aa37] text-[#1a1103]'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {dir.label}
                  </button>
                );
              })}
            </div>

            {activeDirective !== null && (
              <div className="mt-[8px] -mb-[13px] flex min-h-[47px] flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400">
                  Toca una base abajo o aplícala sin base:
                </span>
                <button
                  type="button"
                  onClick={handleApplyDirectiveOnly}
                  disabled={!canApplyDirectiveOnly}
                  className="-mt-[7px] rounded-md border border-[#f7aa37]/70 bg-[#f7aa37]/15 px-2.5 py-1 text-[11px] font-bold text-[#f7aa37] transition hover:bg-[#f7aa37]/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Asignar solo &ldquo;{activeDirective}&rdquo;
                </button>
              </div>
            )}
          </div>

          {/* Bases Enemigas */}
          <div className="m-0 p-0">
            <span className="text-[11px] font-bold uppercase tracking-[0.11em] text-slate-400">
              Bases Enemigas (1 a {baseCount})
            </span>
            <div className="mt-0 mb-0 grid grid-cols-5 gap-2 border-solid">
              {baseNumbers.map((num) => {
                const previewIfClicked = applySelectionToObjective(
                  currentObjective,
                  num,
                  activeDirective,
                  maxObjectives,
                );
                const wouldChange = previewIfClicked !== currentObjective;
                return (
                  <button
                    key={num}
                    type="button"
                    disabled={!wouldChange}
                    onClick={() => handleSelectBase(num)}
                    className="h-[34px] rounded-lg border-2 border-[#334b66] bg-[#0b1422] py-0 font-mono text-sm font-bold text-slate-100 transition hover:border-[#c6f36b] hover:bg-[#16273e] hover:text-[#c6f36b] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {num}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Pie del modal */}
        <div className="my-0 flex h-[43.5px] items-center border-t-2 border-[#23354b] px-4 py-0">
          <button
            type="button"
            onClick={handleConfirmDone}
            className="mt-[5px] mb-0 inline-flex h-[26px] w-full items-center justify-center gap-1.5 rounded-lg border-2 border-[#c6f36b] bg-[#c6f36b] px-4 pt-[1px] pb-0 text-sm font-bold text-[#111c08] transition hover:bg-[#d9f99d]"
          >
            <Check className="h-4 w-4" />
            <span>Listo</span>
          </button>
        </div>
      </div>
    </div>
  );
}
