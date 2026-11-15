import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AllianceHeader } from './components/AllianceHeader';
import { MetricsOverview } from './components/MetricsOverview';
import { WarCardList } from './components/WarCardList';
import { WarFilters } from './components/WarFilters';
import { WinLossChart } from './components/WinLossChart';
import fallbackSnapshot from '../data/wars.json';
import type { OutcomeFilter, WarEntry, WarsSnapshot } from './types/war';
import { computeSummaryStats, matchesWarFilters } from './utils/warUtils';

const PAGE_SIZE = 25;

export default function App() {
  const [wars, setWars] = useState<WarEntry[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState<string>('');
  const [outcome, setOutcome] = useState<OutcomeFilter>('all');
  const [size, setSize] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);

  const listTopRef = useRef<HTMLDivElement>(null);

  const fetchArchive = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch('./api/wars');
      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('application/json')) {
        const data = (await response.json()) as WarsSnapshot;
        setWars(Array.isArray(data.wars) ? data.wars : []);
        setUpdatedAt(data.updated_at || '');
        return;
      }
      throw new Error('Static fallback');
    } catch {
      const bundled = fallbackSnapshot as WarsSnapshot;
      if (Array.isArray(bundled.wars) && bundled.wars.length > 0) {
        setWars(bundled.wars);
        setUpdatedAt(bundled.updated_at || '');
      } else {
        setLoadError('No se pudo cargar el archivo de guerras.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArchive();
  }, [fetchArchive]);

  const availableSizes = useMemo(() => {
    const unique = new Set<string>();
    for (const war of wars) {
      if (war.size && war.size !== '—') unique.add(war.size);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [wars]);

  const filteredWars = useMemo(
    () =>
      wars.filter((war) =>
        matchesWarFilters(war, query, outcome, size, selectedPeriod),
      ),
    [wars, query, outcome, size, selectedPeriod],
  );

  const summaryStats = useMemo(
    () => computeSummaryStats(filteredWars),
    [filteredWars],
  );

  const hasActiveFilters = Boolean(
    query.trim() || outcome !== 'all' || size !== 'all' || selectedPeriod,
  );

  const totalPages = Math.max(1, Math.ceil(filteredWars.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pageWars = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredWars.slice(start, start + PAGE_SIZE);
  }, [filteredWars, safePage]);

  const latestWar = wars[0];

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  const handleOutcomeChange = (value: OutcomeFilter) => {
    setOutcome(value);
    setPage(1);
  };

  const handleSizeChange = (value: string) => {
    setSize(value);
    setPage(1);
  };

  const handleSelectPeriod = (periodKey: string | null) => {
    setSelectedPeriod(periodKey);
    setPage(1);
  };

  const handleResetFilters = () => {
    setQuery('');
    setOutcome('all');
    setSize('all');
    setSelectedPeriod(null);
    setPage(1);
  };

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_78%_-10%,rgba(33,55,84,0.48)_0%,transparent_48%)] bg-[#0a111d]">
      <main className="mx-auto max-w-[1320px] px-4 py-7 sm:px-7 sm:py-9">
        <AllianceHeader latestWar={latestWar} />

        {isLoading ? (
          <div className="mt-6 space-y-4">
            <div className="h-20 animate-pulse rounded-xl border-2 border-[#25374d] bg-[#101c2d]" />
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              <div className="h-16 animate-pulse rounded-xl border-2 border-[#25374d] bg-[#101c2d]" />
              <div className="h-16 animate-pulse rounded-xl border-2 border-[#25374d] bg-[#101c2d]" />
              <div className="h-16 animate-pulse rounded-xl border-2 border-[#25374d] bg-[#101c2d]" />
            </div>
            <div className="h-56 animate-pulse rounded-xl border-2 border-[#25374d] bg-[#101c2d]" />
          </div>
        ) : loadError ? (
          <div className="mt-8 rounded-xl border-2 border-rose-500/50 bg-rose-950/20 p-6 text-center">
            <p className="text-sm font-semibold text-rose-300">{loadError}</p>
            <button
              type="button"
              onClick={fetchArchive}
              className="mt-4 rounded-lg border-2 border-rose-400/60 bg-[#121f31] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1a2c44]"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <>
            <MetricsOverview
              latestWar={latestWar}
              totalWars={summaryStats.total}
              wins={summaryStats.wins}
              losses={summaryStats.losses}
            />

            <WinLossChart
              wars={wars}
              selectedPeriod={selectedPeriod}
              onSelectPeriod={handleSelectPeriod}
            />

            <div ref={listTopRef}>
              <WarFilters
                query={query}
                outcome={outcome}
                size={size}
                availableSizes={availableSizes}
                hasActiveFilters={hasActiveFilters}
                onQueryChange={handleQueryChange}
                onOutcomeChange={handleOutcomeChange}
                onSizeChange={handleSizeChange}
                onResetFilters={handleResetFilters}
              />
            </div>

            <WarCardList
              wars={pageWars}
              totalMatched={filteredWars.length}
              totalArchive={wars.length}
              page={safePage}
              totalPages={totalPages}
              selectedPeriod={selectedPeriod}
              onClearPeriod={() => handleSelectPeriod(null)}
              onPageChange={handlePageChange}
              onResetFilters={handleResetFilters}
            />
          </>
        )}

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t-2 border-[#25374d] pt-5 text-xs text-slate-400">
          <span>
            Las cifras reflejan las tarjetas recopiladas del historial de{' '}
            <a
              href="https://domistats.com/alliance_wars/68105?page=1"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[#c6f36b] underline-offset-4 hover:underline"
            >
              DomiStats
            </a>
            .
          </span>
          {updatedAt && (
            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
              Última sincronización: {updatedAt}
            </span>
          )}
        </footer>
      </main>
    </div>
  );
}
