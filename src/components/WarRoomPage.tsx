import { useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  Check,
  Eraser,
  Pencil,
  Plus,
  Save,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import type { PlayerLine, WarPlanSize, WarPlanSnapshot } from '../types/warPlan';
import {
  getMissingWarBases,
  sortWarPlanPlayers,
  WAR_PLAN_SIZES,
  type SortDirection,
  type WarPlanSortField,
} from '../utils/warPlanFormatting';
import { PlayerObjectiveModal } from './PlayerObjectiveModal';
import { WarPlanShareModal } from './WarPlanShareModal';

interface WarRoomPageProps {
  plan: WarPlanSnapshot;
  isLoading: boolean;
  isEditorUnlocked: boolean;
  hasUnsavedChanges: boolean;
  onUpdatePlan: (updater: (prev: WarPlanSnapshot) => WarPlanSnapshot) => void;
  onSavePlanToGitHub: () => Promise<void>;
  onNavigateBack: () => void;
}

export function WarRoomPage({
  plan,
  isLoading,
  isEditorUnlocked,
  hasUnsavedChanges,
  onUpdatePlan,
  onSavePlanToGitHub,
  onNavigateBack,
}: WarRoomPageProps) {
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<WarPlanSortField>('default');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [editorFilter, setEditorFilter] = useState<'all' | 'assigned'>('all');

  const [confirmClearAll, setConfirmClearAll] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const [isShareOpen, setIsShareOpen] = useState<boolean>(false);
  const [isShareSavePromptOpen, setIsShareSavePromptOpen] = useState<boolean>(false);
  const [missingBasesWarning, setMissingBasesWarning] = useState<number[] | null>(null);
  const [pendingShareAfterSave, setPendingShareAfterSave] = useState<boolean>(false);
  const [isDefenseModalOpen, setIsDefenseModalOpen] = useState<boolean>(false);
  const [isRosterOpen, setIsRosterOpen] = useState<boolean>(false);
  const [newPlayerName, setNewPlayerName] = useState<string>('');
  const [newPlayerLine, setNewPlayerLine] = useState<PlayerLine | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [bannerLoadError, setBannerLoadError] = useState<boolean>(false);

  const assignedCount = useMemo(
    () => plan.players.filter((p) => p.objective.trim() !== '').length,
    [plan.players],
  );

  const defensePlayers = useMemo(
    () => plan.players.filter((p) => p.line === 'Def'),
    [plan.players],
  );

  const defenseInitialObjective = useMemo(() => {
    const nonEmpty = Array.from(
      new Set(
        defensePlayers
          .map((p) => p.objective.trim())
          .filter((val) => val.length > 0),
      ),
    );
    return nonEmpty.length === 1 ? nonEmpty[0] : '';
  }, [defensePlayers]);

  const displayedPlayers = useMemo(() => {
    const baseList =
      !isEditorUnlocked || editorFilter === 'assigned'
        ? plan.players.filter((p) => p.objective.trim() !== '')
        : plan.players;
    return sortWarPlanPlayers(baseList, sortField, sortDirection);
  }, [plan.players, isEditorUnlocked, editorFilter, sortField, sortDirection]);

  const editingPlayer = useMemo(
    () =>
      isEditorUnlocked && editingPlayerId
        ? plan.players.find((p) => p.id === editingPlayerId) ?? null
        : null,
    [isEditorUnlocked, editingPlayerId, plan.players],
  );

  const handleSizeChange = (nextSize: WarPlanSize) => {
    onUpdatePlan((prev) => ({
      ...prev,
      warSize: nextSize,
    }));
  };

  const handleSortByName = () => {
    if (sortField === 'name') {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField('name');
      setSortDirection('asc');
    }
  };

  const handleSortByLine = () => {
    if (sortField === 'line') {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField('line');
      setSortDirection('asc');
    }
  };

  const handleSetPlayerLine = (playerId: string, nextLine: PlayerLine) => {
    if (!isEditorUnlocked) return;
    onUpdatePlan((prev) => ({
      ...prev,
      players: prev.players.map((player) =>
        player.id === playerId ? { ...player, line: nextLine } : player,
      ),
    }));
  };

  const handleApplyDefenseObjective = (nextObjective: string) => {
    if (!isEditorUnlocked) return;
    onUpdatePlan((prev) => ({
      ...prev,
      players: prev.players.map((player) =>
        player.line === 'Def' ? { ...player, objective: nextObjective } : player,
      ),
    }));
  };

  const handleChangePlayerObjective = (playerId: string, nextObjective: string) => {
    if (!isEditorUnlocked) return;
    onUpdatePlan((prev) => ({
      ...prev,
      players: prev.players.map((player) =>
        player.id === playerId ? { ...player, objective: nextObjective } : player,
      ),
    }));
  };

  const handleClearPlayerObjective = (playerId: string) => {
    if (!isEditorUnlocked) return;
    onUpdatePlan((prev) => ({
      ...prev,
      players: prev.players.map((player) =>
        player.id === playerId ? { ...player, objective: '' } : player,
      ),
    }));
  };

  const handleClearAllObjectives = () => {
    if (!isEditorUnlocked) return;
    onUpdatePlan((prev) => ({
      ...prev,
      players: prev.players.map((player) => ({ ...player, objective: '' })),
    }));
    setConfirmClearAll(false);
  };

  const executeSave = async (openShareOnSuccess: boolean) => {
    if (!isEditorUnlocked || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await onSavePlanToGitHub();
      setSaveSuccess(true);
      setMissingBasesWarning(null);
      setIsShareSavePromptOpen(false);
      setPendingShareAfterSave(false);
      if (openShareOnSuccess) {
        setIsShareOpen(true);
      }
      window.setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'No se pudo guardar en GitHub.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!isEditorUnlocked || isSaving) return;
    setSaveError(null);
    const missingBases = getMissingWarBases(plan.players, plan.warSize);
    if (missingBases.length > 0) {
      setPendingShareAfterSave(false);
      setMissingBasesWarning(missingBases);
      return;
    }
    await executeSave(false);
  };

  const handleRequestShare = () => {
    if (assignedCount === 0) return;
    setSaveError(null);
    if (hasUnsavedChanges) {
      setIsShareSavePromptOpen(true);
      return;
    }
    setIsShareOpen(true);
  };

  const handleSaveAndShare = async () => {
    if (!isEditorUnlocked || isSaving) return;
    setSaveError(null);
    const missingBases = getMissingWarBases(plan.players, plan.warSize);
    if (missingBases.length > 0) {
      setIsShareSavePromptOpen(false);
      setPendingShareAfterSave(true);
      setMissingBasesWarning(missingBases);
      return;
    }
    await executeSave(true);
  };

  const handleIgnoreAndSave = async () => {
    await executeSave(pendingShareAfterSave);
  };

  const handleDismissWarnings = () => {
    if (isSaving) return;
    setMissingBasesWarning(null);
    setIsShareSavePromptOpen(false);
    setPendingShareAfterSave(false);
  };

  const handleAddPlayer = (event: FormEvent) => {
    event.preventDefault();
    const cleanedName = newPlayerName.trim();
    if (!cleanedName) {
      setRosterError('Escribe el nick del jugador.');
      return;
    }
    if (!newPlayerLine) {
      setRosterError('Selecciona la etiqueta de línea (Def o Atk) antes de agregar.');
      return;
    }
    const duplicate = plan.players.some(
      (p) => p.name.trim().toLowerCase() === cleanedName.toLowerCase(),
    );
    if (duplicate) {
      setRosterError('Ese jugador ya existe en la lista.');
      return;
    }

    const idBase = cleanedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const id = `${idBase || 'player'}-${Date.now().toString(36)}`;

    onUpdatePlan((prev) => ({
      ...prev,
      players: [
        ...prev.players,
        { id, name: cleanedName, line: newPlayerLine, objective: '' },
      ],
    }));
    setNewPlayerName('');
    setNewPlayerLine(null);
    setRosterError(null);
  };

  const handleDeletePlayer = (playerId: string) => {
    onUpdatePlan((prev) => ({
      ...prev,
      players: prev.players.filter((p) => p.id !== playerId),
    }));
  };

  return (
    <div className="space-y-6">
      {/* Barra superior coherente con Historial */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#25374d] pb-4">
          <div className="flex items-center gap-3">
            <div
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 border-[#7ea333] bg-gradient-to-br from-[#c6f36b] to-[#84a835] font-display text-sm font-extrabold tracking-tight text-[#0d1607]"
              aria-hidden="true"
            >
              CF
            </div>
            <span className="font-display text-xs font-bold uppercase tracking-[0.14em] text-slate-300 sm:text-sm">
              SALA DE GUERRA · PLANIFICACIÓN TÁCTICA
            </span>
          </div>

          <button
            type="button"
            onClick={onNavigateBack}
            className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#3b5573] bg-[#101c2d] px-3.5 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-[#c6f36b] hover:text-[#c6f36b] whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Historial</span>
          </button>
        </div>

        {/* Banner panorámico Sala de Guerra */}
        <div className="relative overflow-hidden rounded-xl border-2 border-[#334b66] bg-[#0b1422]">
          {!bannerLoadError ? (
            <img
              src="./assets/sala-guerra-banner.jpg"
              alt="Comandantes de guerra y batalla táctica"
              referrerPolicy="no-referrer"
              onError={() => setBannerLoadError(true)}
              className="h-48 w-full object-cover object-[50%_15%] sm:h-[320px] md:h-[390px] lg:h-[460px]"
            />
          ) : (
            <div className="h-48 w-full bg-[radial-gradient(circle_at_60%_30%,rgba(247,170,55,0.22),transparent_55%),linear-gradient(135deg,#0d192b_0%,#0a111d_100%)] sm:h-[320px] md:h-[390px] lg:h-[460px]" />
          )}

          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0a111d] via-[#0a111d]/30 to-transparent"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0a111d]/85 via-[#0a111d]/25 to-transparent"
            aria-hidden="true"
          />

          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex items-center gap-3">
              <img
                src="./assets/escudo-colfor.png"
                alt="Escudo COLOMBIA FORCE"
                className="h-10 w-10 shrink-0 object-contain sm:h-12 sm:w-12"
              />
              <div>
                <h1 className="font-display text-2xl font-extrabold uppercase tracking-tight text-white sm:text-4xl">
                  Sala de Guerra
                </h1>
                <p className="mt-0.5 text-xs font-semibold text-slate-200 tabular-nums sm:text-sm">
                  COLOMBIA FORCE · {plan.warSize}
                </p>
                <p className="mt-0.5 font-mono text-[11px] font-medium text-slate-300 tabular-nums sm:text-xs">
                  {plan.updated_at ? plan.updated_at : 'Sin guardar aún'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-20 animate-pulse rounded-xl border-2 border-[#25374d] bg-[#101c2d]" />
          <div className="h-64 animate-pulse rounded-xl border-2 border-[#25374d] bg-[#101c2d]" />
        </div>
      ) : (
        <>
          {/* Barra superior compacta solo para editor con token */}
          {isEditorUnlocked && (
            <section
              aria-label="Configuración y acciones del plan"
              className="space-y-3 rounded-xl border-2 border-[#334b66] bg-[#101c2d] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    TAMAÑO DE GUERRA
                  </h2>
                  <div className="mt-1.5 inline-flex flex-wrap rounded-lg border-2 border-[#334b66] bg-[#0b1422] p-0.5">
                    {WAR_PLAN_SIZES.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => handleSizeChange(item.value)}
                        className={`rounded-md px-3 py-1 font-mono text-xs font-semibold transition whitespace-nowrap ${
                          plan.warSize === item.value
                            ? 'bg-[#c6f36b] text-[#111c08]'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {item.value}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {confirmClearAll ? (
                    <div className="inline-flex items-center gap-1.5 rounded-lg border-2 border-rose-500/60 bg-rose-950/30 px-2.5 py-1">
                      <span className="text-[11px] font-semibold text-rose-200">
                        ¿Limpiar objetivos?
                      </span>
                      <button
                        type="button"
                        onClick={handleClearAllObjectives}
                        className="rounded bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-rose-400"
                      >
                        Sí
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearAll(false)}
                        className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-300 hover:text-white"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(true)}
                      disabled={assignedCount === 0}
                      className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#3b5573] bg-[#0b1422] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-rose-400/70 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Eraser className="h-3.5 w-3.5" />
                      <span>Limpiar objetivos</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleRequestShare}
                    disabled={assignedCount === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#3b5573] bg-[#0b1422] px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-[#f7aa37] hover:text-[#f7aa37] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>Compartir</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`inline-flex items-center gap-1.5 rounded-lg border-2 px-3.5 py-1.5 text-xs font-bold transition disabled:opacity-60 ${
                      hasUnsavedChanges
                        ? 'border-[#c6f36b] bg-[#c6f36b] text-[#111c08] hover:bg-[#d9f99d]'
                        : 'border-[#3b5573] bg-[#122033] text-slate-200 hover:border-[#c6f36b]'
                    }`}
                  >
                    {saveSuccess ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Guardado</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        <span>{isSaving ? 'Guardando…' : 'Guardar'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-400">
                <p>
                  Selecciona uno de los <strong className="text-slate-200">PARCEROS</strong> para asignar hasta 2 objetivos
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span>Para asignar múltiples bases a la línea Defensiva presionar</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPlayerId(null);
                      setIsDefenseModalOpen(true);
                    }}
                    disabled={defensePlayers.length === 0}
                    className="inline-flex items-center rounded-md border border-rose-400/60 bg-rose-500/15 px-2.5 py-0.5 text-xs font-bold text-rose-300 transition hover:border-rose-400 hover:bg-rose-500/25 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Defensa
                  </button>
                </div>
              </div>

              {saveError && (
                <div className="rounded-lg border border-rose-500/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
                  {saveError}
                </div>
              )}
            </section>
          )}

          {/* Barra de filtro justo arriba de la tabla */}
          {isEditorUnlocked ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-400">
                Haz clic en <strong className="text-slate-200">PARCEROS</strong> o <strong className="text-slate-200">LINEA</strong> para ordenar.
              </p>
              <div className="inline-flex rounded-lg border-2 border-[#334b66] bg-[#0b1422] p-0.5">
                <button
                  type="button"
                  onClick={() => setEditorFilter('all')}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                    editorFilter === 'all'
                      ? 'bg-[#c6f36b] text-[#111c08]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Todos ({plan.players.length})
                </button>
                <button
                  type="button"
                  onClick={() => setEditorFilter('assigned')}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                    editorFilter === 'assigned'
                      ? 'bg-[#c6f36b] text-[#111c08]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Con objetivo ({assignedCount})
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              Haz clic en <strong className="text-slate-200">PARCEROS</strong> para ordenar alfabéticamente.
            </p>
          )}

          {/* Tabla de 3 columnas: PARCEROS | LINEA | OBJETIVO */}
          <section
            aria-label="Tabla de asignaciones de guerra"
            className="overflow-hidden rounded-xl border-2 border-[#334b66] bg-[#0f1b2b]"
          >
            <table className="w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-[#25374d] bg-[#101c2d] text-[11px] font-bold uppercase tracking-[0.11em] text-slate-400">
                  <th className="w-[38%] px-2.5 py-3 sm:w-[36%] sm:px-5">
                    <button
                      type="button"
                      onClick={handleSortByName}
                      className={`inline-flex items-center gap-1.5 transition hover:text-white ${
                        sortField === 'name' ? 'text-[#c6f36b]' : ''
                      }`}
                    >
                      <span className="ml-0 pt-0">PARCEROS</span>
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    </button>
                  </th>
                  <th className="w-[16%] px-1 py-3 text-center sm:w-[16%] sm:px-3">
                    <button
                      type="button"
                      onClick={handleSortByLine}
                      className={`inline-flex items-center justify-center gap-1 transition hover:text-white ${
                        sortField === 'line' ? 'text-[#c6f36b]' : ''
                      }`}
                    >
                      <span>LINEA</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="w-[46%] px-2.5 py-3 text-center sm:w-[48%] sm:px-5">
                    OBJETIVO
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f3045]">
                {displayedPlayers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-10 text-center text-sm text-slate-400"
                    >
                      No hay asignaciones registradas por el momento.
                    </td>
                  </tr>
                ) : (
                  displayedPlayers.map((player) => {
                    const hasObjective = player.objective.trim() !== '';
                    const lineColorClass =
                      player.line === 'Def' ? 'text-rose-400' : 'text-blue-400';
                    return (
                      <tr
                        key={player.id}
                        className="transition hover:bg-[#132236]/75"
                      >
                        <td className="px-2 py-2 sm:px-4">
                          {isEditorUnlocked ? (
                            <button
                              type="button"
                              onClick={() => {
                                setIsDefenseModalOpen(false);
                                setEditingPlayerId(player.id);
                              }}
                              className="mt-0 -ml-[3px] w-full rounded-lg py-0 pl-[8px] pr-2 text-left font-display text-[14px] font-extrabold tracking-tight text-[#f7aa37] transition hover:bg-[#182a42] hover:ring-1 hover:ring-[#c6f36b]/60 active:scale-[0.99] break-words"
                            >
                              {player.name}
                            </button>
                          ) : (
                            <span className="mt-0 -ml-[3px] block py-0 pl-[8px] pr-2 font-display text-[14px] font-extrabold tracking-tight text-[#f7aa37] break-words">
                              {player.name}
                            </span>
                          )}
                        </td>

                        <td className="px-1 py-2 text-center sm:px-3">
                          <span
                            className={`inline-block font-mono text-[11px] font-semibold ${lineColorClass}`}
                          >
                            {player.line}
                          </span>
                        </td>

                        <td className="px-2 py-2 text-center sm:px-4">
                          <div className="relative flex items-center justify-center">
                            <span
                              className={`block w-full text-center font-mono text-[11px] font-semibold tabular-nums break-words ${
                                isEditorUnlocked && hasObjective ? 'px-6' : 'px-1'
                              } ${hasObjective ? 'text-[#ecfccb]' : 'text-slate-600'}`}
                            >
                              {hasObjective ? player.objective : '—'}
                            </span>

                            {isEditorUnlocked && hasObjective && (
                              <button
                                type="button"
                                onClick={() => handleClearPlayerObjective(player.id)}
                                title={`Limpiar objetivo de ${player.name}`}
                                aria-label={`Limpiar objetivo de ${player.name}`}
                                className="absolute right-0 top-1/2 -translate-y-1/2 inline-flex h-[20px] shrink-0 items-center justify-center rounded-md py-0 pl-1 pr-0.5 text-slate-400 transition hover:bg-rose-950/40 hover:text-rose-300"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </section>

          {/* Parte inferior de la tabla: botón de edición de jugadores (solo token activo) */}
          {isEditorUnlocked && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsRosterOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#3b5573] bg-[#101c2d] px-2.5 py-1 text-xs font-semibold text-slate-300 transition hover:border-[#c6f36b] hover:text-[#c6f36b]"
                >
                  <Pencil className="h-3 w-3" />
                  <span>
                    {isRosterOpen ? 'Cerrar edición de parceros' : 'Editar parceros'}
                  </span>
                </button>

                {hasUnsavedChanges && (
                  <span className="text-xs font-medium text-amber-300">
                    Tienes cambios sin guardar en GitHub.
                  </span>
                )}
              </div>

              {isRosterOpen && (
                <div className="space-y-4 rounded-xl border-2 border-[#334b66] bg-[#101c2d] p-4">
                  <form
                    onSubmit={handleAddPlayer}
                    className="flex flex-wrap items-end gap-3"
                  >
                    <div className="grid min-w-[200px] flex-1 gap-1.5 sm:max-w-xs">
                      <label
                        htmlFor="new-player-name"
                        className="text-[11px] font-bold uppercase tracking-[0.09em] text-slate-400"
                      >
                        Agregar jugador
                      </label>
                      <input
                        id="new-player-name"
                        type="text"
                        value={newPlayerName}
                        onChange={(e) => {
                          setNewPlayerName(e.target.value);
                          setRosterError(null);
                        }}
                        placeholder="Nick del jugador…"
                        autoComplete="off"
                        className="w-full rounded-lg border-2 border-[#3b5573] bg-[#0b1422] px-3 py-2 text-sm text-white placeholder:text-slate-500 transition focus:border-[#c6f36b] focus:outline-none"
                      />
                    </div>

                    <div className="grid gap-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-[0.09em] text-slate-400">
                        Línea *
                      </span>
                      <div
                        className="inline-flex rounded-lg border-2 border-[#3b5573] bg-[#0b1422] p-0.5"
                        role="group"
                        aria-label="Seleccionar etiqueta de línea"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setNewPlayerLine('Def');
                            setRosterError(null);
                          }}
                          className={`rounded-md px-3 py-1.5 font-mono text-xs font-bold transition ${
                            newPlayerLine === 'Def'
                              ? 'bg-rose-500/25 text-rose-300 ring-1 ring-rose-400/60'
                              : 'text-slate-400 hover:text-rose-300'
                          }`}
                        >
                          Def
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNewPlayerLine('Atk');
                            setRosterError(null);
                          }}
                          className={`rounded-md px-3 py-1.5 font-mono text-xs font-bold transition ${
                            newPlayerLine === 'Atk'
                              ? 'bg-blue-500/25 text-blue-300 ring-1 ring-blue-400/60'
                              : 'text-slate-400 hover:text-blue-300'
                          }`}
                        >
                          Atk
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#c6f36b] bg-[#c6f36b] px-4 py-2 text-xs font-bold text-[#111c08] transition hover:bg-[#d9f99d]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Agregar</span>
                    </button>
                  </form>

                  {rosterError && (
                    <p className="text-xs text-rose-300">{rosterError}</p>
                  )}

                  <div className="border-t border-[#23354b] pt-3">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.09em] text-slate-400">
                      Lista permanente ({plan.players.length} jugadores)
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {plan.players.map((player) => (
                        <div
                          key={player.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-[#2a3f59] bg-[#0b1422] px-3 py-1.5"
                        >
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#f7aa37]">
                            {player.name}
                          </span>

                          <div
                            className="inline-flex shrink-0 rounded border border-[#2a3f59] bg-[#101c2d] p-0.5"
                            role="group"
                            aria-label={`Etiqueta de ${player.name}`}
                          >
                            <button
                              type="button"
                              onClick={() => handleSetPlayerLine(player.id, 'Def')}
                              className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold transition ${
                                player.line === 'Def'
                                  ? 'bg-rose-500/25 text-rose-300'
                                  : 'text-slate-500 hover:text-rose-300'
                              }`}
                            >
                              Def
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetPlayerLine(player.id, 'Atk')}
                              className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold transition ${
                                player.line === 'Atk'
                                  ? 'bg-blue-500/25 text-blue-300'
                                  : 'text-slate-500 hover:text-blue-300'
                              }`}
                            >
                              Atk
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeletePlayer(player.id)}
                            title={`Eliminar a ${player.name}`}
                            aria-label={`Eliminar a ${player.name}`}
                            className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-rose-950/40 hover:text-rose-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <PlayerObjectiveModal
        player={isDefenseModalOpen ? null : editingPlayer}
        warSize={plan.warSize}
        isDefenseGroup={isDefenseModalOpen}
        defenseCount={defensePlayers.length}
        defenseInitialObjective={defenseInitialObjective}
        onChangeObjective={handleChangePlayerObjective}
        onApplyDefenseObjective={handleApplyDefenseObjective}
        onClose={() => {
          setEditingPlayerId(null);
          setIsDefenseModalOpen(false);
        }}
      />

      <WarPlanShareModal
        isOpen={isShareOpen}
        players={displayedPlayers}
        warSize={plan.warSize}
        onClose={() => setIsShareOpen(false)}
      />

      {isShareSavePromptOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-save-warning-title"
          onClick={handleDismissWarnings}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border-2 border-[#3b5573] bg-[#0d1726] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#25374d] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="h-5 w-5 shrink-0 text-[#f7aa37]" />
                <h2
                  id="share-save-warning-title"
                  className="font-display text-lg font-extrabold uppercase tracking-tight text-white"
                >
                  Guarda antes de compartir
                </h2>
              </div>
              <button
                type="button"
                onClick={handleDismissWarnings}
                disabled={isSaving}
                aria-label="Cerrar advertencia"
                className="rounded-lg p-1 text-slate-400 transition hover:bg-[#16253b] hover:text-white disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 px-5 py-4">
              <p className="text-sm text-slate-300">
                Tienes cambios sin guardar. Es necesario guardar la asignación en GitHub para poder abrir el menú de compartir.
              </p>

              {saveError && (
                <div className="rounded-lg border border-rose-500/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
                  {saveError}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-[#25374d] bg-[#0b1320] px-5 py-3.5">
              <button
                type="button"
                onClick={handleDismissWarnings}
                disabled={isSaving}
                className="rounded-lg border-2 border-[#3b5573] bg-[#101c2d] px-3.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-400 hover:text-white disabled:opacity-50"
              >
                Regresar a editar
              </button>
              <button
                type="button"
                onClick={handleSaveAndShare}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#c6f36b] bg-[#c6f36b] px-4 py-1.5 text-xs font-bold text-[#111c08] transition hover:bg-[#d9f99d] disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{isSaving ? 'Guardando…' : 'Guardar y compartir'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {missingBasesWarning && missingBasesWarning.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="missing-bases-warning-title"
          onClick={handleDismissWarnings}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border-2 border-[#3b5573] bg-[#0d1726] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#25374d] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="h-5 w-5 shrink-0 text-[#f7aa37]" />
                <h2
                  id="missing-bases-warning-title"
                  className="font-display text-lg font-extrabold uppercase tracking-tight text-white"
                >
                  Faltan bases por asignar
                </h2>
              </div>
              <button
                type="button"
                onClick={handleDismissWarnings}
                disabled={isSaving}
                aria-label="Cerrar advertencia"
                className="rounded-lg p-1 text-slate-400 transition hover:bg-[#16253b] hover:text-white disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 px-5 py-4">
              <p className="text-sm text-slate-300">
                En la guerra <strong className="text-white">{plan.warSize}</strong>{' '}
                {missingBasesWarning.length === 1
                  ? 'falta 1 base sin asignar:'
                  : `faltan ${missingBasesWarning.length} bases sin asignar:`}
              </p>

              <div className="flex flex-wrap gap-1.5 rounded-xl border border-[#25374d] bg-[#0a111d] p-3">
                {missingBasesWarning.map((baseNum) => (
                  <span
                    key={baseNum}
                    className="inline-flex min-w-[36px] items-center justify-center rounded-md border border-[#f7aa37]/50 bg-[#121f31] px-2 py-1 font-mono text-xs font-bold text-[#f7aa37] tabular-nums"
                  >
                    #{baseNum}
                  </span>
                ))}
              </div>

              {saveError && (
                <div className="rounded-lg border border-rose-500/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
                  {saveError}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-[#25374d] bg-[#0b1320] px-5 py-3.5">
              <button
                type="button"
                onClick={handleDismissWarnings}
                disabled={isSaving}
                className="rounded-lg border-2 border-[#3b5573] bg-[#101c2d] px-3.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-400 hover:text-white disabled:opacity-50"
              >
                Regresar a editar
              </button>
              <button
                type="button"
                onClick={handleIgnoreAndSave}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#c6f36b] bg-[#c6f36b] px-4 py-1.5 text-xs font-bold text-[#111c08] transition hover:bg-[#d9f99d] disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" />
                <span>
                  {isSaving
                    ? 'Guardando…'
                    : pendingShareAfterSave
                      ? 'Ignorar, guardar y compartir'
                      : 'Ignorar y guardar'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
