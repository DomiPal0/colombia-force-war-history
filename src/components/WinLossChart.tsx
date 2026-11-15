import { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import type { ChartRange, WarEntry } from '../types/war';
import {
  buildPeriodBuckets,
  computeSummaryStats,
  formatSigned,
  sliceWarsByRange,
} from '../utils/warUtils';

interface WinLossChartProps {
  wars: WarEntry[];
  selectedPeriod: string | null;
  onSelectPeriod: (periodKey: string | null) => void;
}

const RANGE_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: '50', label: '50' },
  { value: '100', label: '100' },
  { value: 'year', label: '1 año' },
  { value: 'all', label: 'Todo' },
];

export function WinLossChart({
  wars,
  selectedPeriod,
  onSelectPeriod,
}: WinLossChartProps) {
  const [range, setRange] = useState<ChartRange>('100');
  const [hoveredPeriod, setHoveredPeriod] = useState<string | null>(null);

  const scopedWars = useMemo(() => sliceWarsByRange(wars, range), [wars, range]);
  const groupByYear = range === 'all';
  const buckets = useMemo(
    () => buildPeriodBuckets(scopedWars, groupByYear),
    [scopedWars, groupByYear],
  );
  const scopedStats = useMemo(() => computeSummaryStats(scopedWars), [scopedWars]);

  const maxBarValue = useMemo(() => {
    const peak = Math.max(...buckets.map((b) => Math.max(b.wins, b.losses)), 1);
    return peak;
  }, [buckets]);

  const activeBucket = useMemo(() => {
    const key = hoveredPeriod || selectedPeriod;
    if (!key) return buckets[buckets.length - 1] || null;
    return buckets.find((b) => b.periodKey === key) || buckets[buckets.length - 1] || null;
  }, [buckets, hoveredPeriod, selectedPeriod]);

  return (
    <section
      aria-label="Gráfica de victorias y derrotas"
      className="mt-6 rounded-xl border-2 border-[#334b66] bg-[#101c2d] p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#23354b] pb-3.5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[#c6f36b]" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-white sm:text-base">
            Victorias vs Derrotas
          </h2>
        </div>

        <div className="inline-flex flex-wrap rounded-lg border-2 border-[#334b66] bg-[#0b1422] p-0.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRange(opt.value)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition tabular-nums ${
                range === opt.value
                  ? 'bg-[#c6f36b] text-[#111c08]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.value === 'all' ? `Todo (${wars.length})` : opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lectura compacta del período activo (siempre en una sola línea) */}
      {activeBucket && (
        <div className="mt-3 flex flex-nowrap items-center justify-between gap-2 overflow-hidden rounded-lg border-2 border-[#263a52] bg-[#0b1422] px-2.5 py-2 text-[11px] whitespace-nowrap sm:px-3 sm:text-xs">
          <span className="shrink-0 font-mono font-bold tracking-tight text-slate-200 sm:tracking-normal">
            {activeBucket.fullLabel}
          </span>
          <div className="flex shrink-0 flex-nowrap items-center gap-2 font-mono tracking-tight tabular-nums sm:gap-4 sm:tracking-normal">
            <span className="font-semibold text-emerald-400">
              {activeBucket.wins} V
            </span>
            <span className="font-semibold text-rose-400">
              {activeBucket.losses} D
            </span>
            <span className="font-semibold text-sky-300">
              {activeBucket.winRate}%
            </span>
            <span
              className={`font-semibold ${
                activeBucket.netGlory >= 0 ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              Gloria: {formatSigned(activeBucket.netGlory)}
            </span>
          </div>
        </div>
      )}

      {/* Barras limpias adaptadas a pantalla móvil sin desbordamiento */}
      {buckets.length > 0 && (
        <div className="mt-4">
          <div className="flex h-[156px] items-end gap-1.5 sm:h-[176px] sm:gap-2.5">
            {buckets.map((bucket) => {
              const winPct = Math.round((bucket.wins / maxBarValue) * 100);
              const lossPct = Math.round((bucket.losses / maxBarValue) * 100);
              const isSelected = selectedPeriod === bucket.periodKey;
              const isHovered = hoveredPeriod === bucket.periodKey;

              return (
                <button
                  key={bucket.periodKey}
                  type="button"
                  onMouseEnter={() => setHoveredPeriod(bucket.periodKey)}
                  onMouseLeave={() => setHoveredPeriod(null)}
                  onClick={() =>
                    onSelectPeriod(isSelected ? null : bucket.periodKey)
                  }
                  aria-label={`${bucket.fullLabel}: ${bucket.wins} victorias, ${bucket.losses} derrotas`}
                  className={`group flex h-full min-w-0 flex-1 flex-col items-center justify-end rounded-md px-0.5 pt-1.5 transition ${
                    isSelected
                      ? 'bg-[#c6f36b]/15 ring-2 ring-[#c6f36b]'
                      : isHovered
                        ? 'bg-[#1a2c44]'
                        : 'hover:bg-[#162538]'
                  }`}
                >
                  <div className="flex h-[116px] w-full items-end justify-center gap-[2px] sm:h-[134px] sm:gap-1">
                    <div
                      className="w-1/2 max-w-[16px] rounded-t-sm bg-emerald-400 transition-all group-hover:bg-emerald-300"
                      style={{
                        height: `${Math.max(winPct, bucket.wins > 0 ? 7 : 0)}%`,
                      }}
                    />
                    <div
                      className="w-1/2 max-w-[16px] rounded-t-sm bg-rose-400 transition-all group-hover:bg-rose-300"
                      style={{
                        height: `${Math.max(lossPct, bucket.losses > 0 ? 7 : 0)}%`,
                      }}
                    />
                  </div>
                  <span
                    className={`mt-1.5 w-full truncate text-center font-mono text-[10px] leading-none tabular-nums ${
                      isSelected ? 'font-bold text-[#c6f36b]' : 'text-slate-400'
                    }`}
                  >
                    {bucket.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t-2 border-[#23354b] pt-2.5 text-xs text-slate-300">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
                Victorias ({scopedStats.wins})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-rose-400" />
                Derrotas ({scopedStats.losses})
              </span>
            </div>

            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
              Efectividad: <b className="text-slate-200">{scopedStats.winRate.toFixed(1)}%</b>
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
