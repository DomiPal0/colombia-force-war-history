import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AllianceHeader } from './components/AllianceHeader';
import { MetricsOverview } from './components/MetricsOverview';
import { WarCardList } from './components/WarCardList';
import { WarFilters } from './components/WarFilters';
import { WinLossChart } from './components/WinLossChart';
import fallbackSnapshot from '../data/wars.json';
import type { AllianceOverview, OutcomeFilter, WarEntry, WarsSnapshot } from './types/war';
import { computeSummaryStats, matchesWarFilters } from './utils/warUtils';

const PAGE_SIZE = 25;
const VALID_OUTCOMES: OutcomeFilter[] = ['all', 'win', 'loss', 'time', 'close'];

interface NavigationState {
  query: string;
  outcome: OutcomeFilter;
  size: string;
  selectedPeriod: string | null;
  page: number;
}

function readNavigationStateFromUrl(): NavigationState {
  if (typeof window === 'undefined') {
    return {
      query: '',
      outcome: 'all',
      size: 'all',
      selectedPeriod: null,
      page: 1,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const rawPage = Number.parseInt(params.get('page') || '1', 10);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;

  const rawOutcome = params.get('outcome') as OutcomeFilter | null;
  const outcome =
    rawOutcome && VALID_OUTCOMES.includes(rawOutcome) ? rawOutcome : 'all';

  const query = params.get('q') || '';
  const size = params.get('size') || 'all';
  const periodParam = params.get('period');
  const selectedPeriod =
    periodParam && periodParam.trim() ? periodParam.trim() : null;

  return {
    query,
    outcome,
    size,
    selectedPeriod,
    page,
  };
}

function buildUrlForState(state: NavigationState): string {
  const params = new URLSearchParams();
  if (state.page > 1) params.set('page', String(state.page));
  if (state.query.trim()) params.set('q', state.query);
  if (state.outcome !== 'all') params.set('outcome', state.outcome);
  if (state.size !== 'all') params.set('size', state.size);
  if (state.selectedPeriod) params.set('period', state.selectedPeriod);

  const search = params.toString();
  const basePath = window.location.pathname;
  return `${basePath}${search ? `?${search}` : ''}${window.location.hash}`;
}

export default function App() {
  const initialNav = useMemo(() => readNavigationStateFromUrl(), []);

  const [wars, setWars] = useState<WarEntry[]>([]);
  const [alliance, setAlliance] = useState<AllianceOverview | undefined>(undefined);
  const [updatedAt, setUpdatedAt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState<string>(initialNav.query);
  const [outcome, setOutcome] = useState<OutcomeFilter>(initialNav.outcome);
  const [size, setSize] = useState<string>(initialNav.size);
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(
    initialNav.selectedPeriod,
  );
  const [page, setPage] = useState<number>(initialNav.page);

  const listTopRef = useRef<HTMLDivElement>(null);
  const navStateRef = useRef<NavigationState>(initialNav);
  navStateRef.current = { query, outcome, size, selectedPeriod, page };

  useEffect(() => {
    window.history.replaceState(initialNav, '', buildUrlForState(initialNav));
  }, [initialNav]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const stateFromHistory = event.state as Partial<NavigationState> | null;
      const nextState: NavigationState =
        stateFromHistory && typeof stateFromHistory.page === 'number'
          ? {
              query: typeof stateFromHistory.query === 'string' ? stateFromHistory.query : '',
              outcome:
                stateFromHistory.outcome &&
                VALID_OUTCOMES.includes(stateFromHistory.outcome)
                  ? stateFromHistory.outcome
                  : 'all',
              size: typeof stateFromHistory.size === 'string' ? stateFromHistory.size : 'all',
              selectedPeriod:
                typeof stateFromHistory.selectedPeriod === 'string'
                  ? stateFromHistory.selectedPeriod
                  : null,
              page: stateFromHistory.page >= 1 ? stateFromHistory.page : 1,
            }
          : readNavigationStateFromUrl();

      const pageChanged = nextState.page !== navStateRef.current.page;

      setQuery(nextState.query);
      setOutcome(nextState.outcome);
      setSize(nextState.size);
      setSelectedPeriod(nextState.selectedPeriod);
      setPage(nextState.page);

      if (pageChanged) {
        requestAnimationFrame(() => {
          listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const commitNavigation = useCallback(
    (patch: Partial<NavigationState>, mode: 'push' | 'replace' = 'push') => {
      const nextState: NavigationState = {
        ...navStateRef.current,
        ...patch,
      };
      setQuery(nextState.query);
      setOutcome(nextState.outcome);
      setSize(nextState.size);
      setSelectedPeriod(nextState.selectedPeriod);
      setPage(nextState.page);

      const url = buildUrlForState(nextState);
      if (mode === 'push') {
        window.history.pushState(nextState, '', url);
      } else {
        window.history.replaceState(nextState, '', url);
      }
    },
    [],
  );

  const fetchArchive = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch('./api/wars');
      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('application/json')) {
        const data = (await response.json()) as WarsSnapshot;
        setWars(Array.isArray(data.wars) ? data.wars : []);
        setAlliance(data.alliance);
        setUpdatedAt(data.updated_at || '');
        return;
      }
      throw new Error('Static fallback');
    } catch {
      const bundled = fallbackSnapshot as WarsSnapshot;
      if (Array.isArray(bundled.wars) && bundled.wars.length > 0) {
        setWars(bundled.wars);
        setAlliance(bundled.alliance);
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
    commitNavigation({ query: value, page: 1 }, 'replace');
  };

  const handleOutcomeChange = (value: OutcomeFilter) => {
    commitNavigation({ outcome: value, page: 1 }, 'push');
  };

  const handleSizeChange = (value: string) => {
    commitNavigation({ size: value, page: 1 }, 'push');
  };

  const handleSelectPeriod = (periodKey: string | null) => {
    commitNavigation({ selectedPeriod: periodKey, page: 1 }, 'push');
  };

  const handleResetFilters = () => {
    commitNavigation(
      { query: '', outcome: 'all', size: 'all', selectedPeriod: null, page: 1 },
      'push',
    );
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage === safePage) return;
    commitNavigation({ page: nextPage }, 'push');
    listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_78%_-10%,rgba(33,55,84,0.48)_0%,transparent_48%)] bg-[#0a111d]">
      <main className="mx-auto max-w-[1320px] px-4 py-7 sm:px-7 sm:py-9">
        <AllianceHeader latestWar={latestWar} alliance={alliance} />

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
              alliance={alliance}
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
