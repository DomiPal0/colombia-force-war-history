import { RotateCcw, Search } from 'lucide-react';
import type { OutcomeFilter } from '../types/war';

interface WarFiltersProps {
  query: string;
  outcome: OutcomeFilter;
  size: string;
  availableSizes: string[];
  hasActiveFilters: boolean;
  onQueryChange: (value: string) => void;
  onOutcomeChange: (value: OutcomeFilter) => void;
  onSizeChange: (value: string) => void;
  onResetFilters: () => void;
}

export function WarFilters({
  query,
  outcome,
  size,
  availableSizes,
  hasActiveFilters,
  onQueryChange,
  onOutcomeChange,
  onSizeChange,
  onResetFilters,
}: WarFiltersProps) {
  return (
    <section
      aria-label="Filtros del historial"
      className="mt-6 flex flex-wrap items-end justify-between gap-3 border-t-2 border-[#25374d] pt-5"
    >
      <div className="flex flex-1 flex-wrap items-end gap-3">
        <div className="grid min-w-[200px] flex-1 gap-1.5 sm:max-w-[330px]">
          <label
            htmlFor="query"
            className="text-[11px] font-bold uppercase tracking-[0.09em] text-slate-400"
          >
            Buscar rival
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="query"
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Nombre de alianza…"
              autoComplete="off"
              className="w-full rounded-lg border-2 border-[#3b5573] bg-[#101c2d] py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 transition focus:border-[#c6f36b] focus:outline-none"
            />
          </div>
        </div>

        <div className="grid min-w-[145px] gap-1.5">
          <label
            htmlFor="outcome"
            className="text-[11px] font-bold uppercase tracking-[0.09em] text-slate-400"
          >
            Resultado
          </label>
          <select
            id="outcome"
            value={outcome}
            onChange={(e) => onOutcomeChange(e.target.value as OutcomeFilter)}
            className="rounded-lg border-2 border-[#3b5573] bg-[#101c2d] px-3 py-2 text-sm text-white transition focus:border-[#c6f36b] focus:outline-none"
          >
            <option value="all">Todos</option>
            <option value="win">Victoria</option>
            <option value="loss">Derrota</option>
            <option value="time">Time War</option>
            <option value="close">Close War</option>
          </select>
        </div>

        <div className="grid min-w-[130px] gap-1.5">
          <label
            htmlFor="size"
            className="text-[11px] font-bold uppercase tracking-[0.09em] text-slate-400"
          >
            Tamaño
          </label>
          <select
            id="size"
            value={size}
            onChange={(e) => onSizeChange(e.target.value)}
            className="rounded-lg border-2 border-[#3b5573] bg-[#101c2d] px-3 py-2 text-sm text-white transition focus:border-[#c6f36b] focus:outline-none"
          >
            <option value="all">Todos</option>
            {availableSizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={onResetFilters}
        disabled={!hasActiveFilters}
        className={`inline-flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-semibold transition whitespace-nowrap shrink-0 ${
          hasActiveFilters
            ? 'border-[#c6f36b] bg-[#c6f36b]/15 text-[#d9f99d] hover:bg-[#c6f36b]/25'
            : 'cursor-not-allowed border-[#334b66] bg-[#101c2d] text-slate-500'
        }`}
      >
        <RotateCcw className="h-4 w-4" />
        <span>Restablecer filtros</span>
      </button>
    </section>
  );
}
