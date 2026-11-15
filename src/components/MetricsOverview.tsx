import { Flame, ShieldCheck, Swords, Trophy } from 'lucide-react';
import type { WarEntry } from '../types/war';

interface MetricsOverviewProps {
  latestWar?: WarEntry;
  totalWars: number;
  wins: number;
  losses: number;
}

export function MetricsOverview({ latestWar, totalWars, wins, losses }: MetricsOverviewProps) {
  const recentGlory = latestWar?.left.glory || '—';
  const recentDivision =
    latestWar?.left.division && latestWar.left.division !== '—'
      ? latestWar.left.division
      : null;
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;

  return (
    <section aria-label="Resumen de resultados" className="mt-6 space-y-3">
      {/* Gloria Reciente directamente debajo del nombre de la alianza */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-[#3b5573] bg-gradient-to-r from-[#132134] via-[#101c2d] to-[#132134] px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="flex items-center gap-3.5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border-2 border-[#47668a] bg-[#0d1726] text-[#c6f36b]">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.11em] text-slate-400 sm:text-xs">
              Gloria Reciente
            </p>
            <p className="font-mono text-2xl font-bold leading-tight text-white tabular-nums sm:text-4xl">
              {recentGlory}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5 text-right sm:gap-6">
          {recentDivision && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 sm:text-[11px]">
                División actual
              </p>
              <p className="text-xs font-bold text-sky-300 sm:text-sm">{recentDivision}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 sm:text-[11px]">
              Efectividad
            </p>
            <p className="font-mono text-xs font-bold text-[#c6f36b] tabular-nums sm:text-sm">
              {winRate}%
            </p>
          </div>
        </div>
      </div>

      {/* 3 cuadros uno al lado del otro también en móvil */}
      <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
        <div className="flex items-center justify-between rounded-xl border-2 border-[#334b66] bg-[#101c2d] px-2.5 py-2.5 sm:px-4 sm:py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase leading-tight tracking-[0.06em] text-slate-400 sm:text-[11px] sm:tracking-[0.1em]">
              Total de guerras
            </p>
            <p className="mt-1 font-mono text-lg font-bold text-slate-100 tabular-nums sm:mt-0.5 sm:text-2xl">
              {totalWars.toLocaleString('en-US')}
            </p>
          </div>
          <Swords className="hidden h-5 w-5 shrink-0 text-slate-400 sm:block" />
        </div>

        <div className="flex items-center justify-between rounded-xl border-2 border-[#334b66] bg-[#101c2d] px-2.5 py-2.5 sm:px-4 sm:py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase leading-tight tracking-[0.06em] text-slate-400 sm:text-[11px] sm:tracking-[0.1em]">
              Victorias
            </p>
            <p className="mt-1 font-mono text-lg font-bold text-emerald-400 tabular-nums sm:mt-0.5 sm:text-2xl">
              {wins.toLocaleString('en-US')}
            </p>
          </div>
          <Trophy className="hidden h-5 w-5 shrink-0 text-emerald-400/80 sm:block" />
        </div>

        <div className="flex items-center justify-between rounded-xl border-2 border-[#334b66] bg-[#101c2d] px-2.5 py-2.5 sm:px-4 sm:py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase leading-tight tracking-[0.06em] text-slate-400 sm:text-[11px] sm:tracking-[0.1em]">
              Derrotas
            </p>
            <p className="mt-1 font-mono text-lg font-bold text-rose-400 tabular-nums sm:mt-0.5 sm:text-2xl">
              {losses.toLocaleString('en-US')}
            </p>
          </div>
          <ShieldCheck className="hidden h-5 w-5 shrink-0 text-rose-400/80 sm:block" />
        </div>
      </div>
    </section>
  );
}
