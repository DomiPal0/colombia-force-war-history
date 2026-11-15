import type { AllianceOverview, WarEntry } from '../types/war';
import { normalizeRankDisplay } from '../utils/warUtils';

interface AllianceHeaderProps {
  latestWar?: WarEntry;
  alliance?: AllianceOverview;
}

export function AllianceHeader({ latestWar, alliance }: AllianceHeaderProps) {
  const rankNumber = normalizeRankDisplay(alliance?.rank ?? latestWar?.left.rank);

  return (
    <header className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#25374d] pb-4">
        <div className="flex items-center gap-3">
          <div
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 border-[#7ea333] bg-gradient-to-br from-[#c6f36b] to-[#84a835] font-display text-sm font-extrabold tracking-tight text-[#0d1607]"
            aria-hidden="true"
          >
            CF
          </div>
          <span className="font-display text-xs font-bold uppercase tracking-[0.14em] text-slate-300 sm:text-sm">
            ARCHIVO DE ALIANZA - HISTORIAL DE GUERRAS
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4 sm:gap-7">
          <div className="flex items-center gap-3.5">
            <img
              src="./assets/escudo-colfor.png"
              alt="Escudo COLOMBIA FORCE"
              className="h-12 w-12 shrink-0 object-contain"
            />
            <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight text-white sm:text-5xl">
              COLOMBIA FORCE
            </h1>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Ranking
            </span>
            <div
              className="inline-flex min-w-[84px] items-center justify-center gap-1 rounded-lg border-2 border-[#47668a] bg-[#121f31] px-3 py-1.5 font-mono text-lg font-bold text-[#facc15] tabular-nums shadow-sm sm:min-w-[92px] sm:px-3.5 sm:text-xl"
              title="Ranking actual de la alianza en DomiStats"
            >
              <span className="text-slate-400">#</span>
              <span>{rankNumber}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
