import type { ChartRange, OutcomeFilter, WarEntry } from '../types/war';

export function parseResultNumber(value: string): number | null {
  const cleaned = String(value ?? '').replace(/,/g, '').trim();
  if (!cleaned || cleaned === '—') return null;
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

export function formatSigned(value: number | null): string {
  if (value === null) return 'Sin resultado';
  const absFormatted = Math.abs(value).toLocaleString('en-US');
  return value > 0 ? `+${absFormatted}` : `-${absFormatted}`;
}

export function normalizeRankDisplay(raw: string | undefined): string {
  const cleaned = (raw || '').replace(/\s+/g, '').trim();
  if (!cleaned || cleaned === '—') return '—';
  return cleaned.startsWith('#') ? cleaned.slice(1) : cleaned;
}

export function formatStars(value: string | undefined): string {
  const cleaned = (value || '').trim();
  return cleaned || '—';
}

export function matchesWarFilters(
  war: WarEntry,
  query: string,
  outcome: OutcomeFilter,
  size: string,
  periodFilter: string | null,
): boolean {
  const q = query.trim().toLowerCase();
  if (q && !war.right.name.toLowerCase().includes(q) && !war.left.name.toLowerCase().includes(q)) {
    return false;
  }

  const resNum = parseResultNumber(war.result);
  if (outcome === 'win' && (resNum === null || resNum <= 0)) return false;
  if (outcome === 'loss' && (resNum === null || resNum >= 0)) return false;
  if (outcome === 'time' && !war.notes.toLowerCase().includes('time')) return false;
  if (outcome === 'close' && !war.notes.toLowerCase().includes('close')) return false;

  if (size !== 'all' && war.size !== size) return false;
  if (periodFilter && !war.date.startsWith(periodFilter)) return false;

  return true;
}

export function computeSummaryStats(wars: WarEntry[]) {
  let wins = 0;
  let losses = 0;
  let netGlory = 0;

  for (const war of wars) {
    const res = parseResultNumber(war.result);
    if (res !== null) {
      netGlory += res;
      if (res > 0) wins += 1;
      else if (res < 0) losses += 1;
    }
  }

  const decided = wins + losses;
  const winRate = decided > 0 ? (wins / decided) * 100 : 0;

  let currentStreakCount = 0;
  let currentStreakType: 'win' | 'loss' | null = null;
  for (const war of wars) {
    const res = parseResultNumber(war.result);
    if (res === null || res === 0) continue;
    const type = res > 0 ? 'win' : 'loss';
    if (!currentStreakType) {
      currentStreakType = type;
      currentStreakCount = 1;
    } else if (currentStreakType === type) {
      currentStreakCount += 1;
    } else {
      break;
    }
  }

  return {
    total: wars.length,
    wins,
    losses,
    winRate,
    netGlory,
    currentStreakCount,
    currentStreakType,
  };
}

export interface PeriodBucket {
  periodKey: string; // YYYY/MM or YYYY
  label: string;
  fullLabel: string;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
  netGlory: number;
}

const MONTH_SHORT_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function formatPeriodLabel(periodKey: string): { short: string; full: string } {
  if (/^\d{4}$/.test(periodKey)) {
    return { short: periodKey, full: `Año ${periodKey}` };
  }
  const [year, month] = periodKey.split('/');
  const idx = Number(month) - 1;
  const mName = MONTH_SHORT_ES[idx] || month;
  return {
    short: mName,
    full: `${mName} ${year}`,
  };
}

export function sliceWarsByRange(wars: WarEntry[], range: ChartRange): WarEntry[] {
  if (range === '50') return wars.slice(0, 50);
  if (range === '100') return wars.slice(0, 100);
  if (range === 'year') {
    if (!wars.length) return wars;
    const latestYear = Number(wars[0].date.slice(0, 4));
    const latestMonth = Number(wars[0].date.slice(5, 7));
    const cutoffStr = `${latestYear - 1}/${String(latestMonth).padStart(2, '0')}`;
    return wars.filter((w) => w.date.slice(0, 7) >= cutoffStr);
  }
  return wars;
}

export function buildPeriodBuckets(wars: WarEntry[], groupByYear: boolean): PeriodBucket[] {
  const map = new Map<string, PeriodBucket>();

  for (const war of wars) {
    const key = groupByYear ? war.date.slice(0, 4) : war.date.slice(0, 7);
    if (groupByYear ? !/^\d{4}$/.test(key) : !/^\d{4}\/\d{2}$/.test(key)) continue;

    let bucket = map.get(key);
    if (!bucket) {
      const labels = formatPeriodLabel(key);
      bucket = {
        periodKey: key,
        label: labels.short,
        fullLabel: labels.full,
        wins: 0,
        losses: 0,
        total: 0,
        winRate: 0,
        netGlory: 0,
      };
      map.set(key, bucket);
    }

    const res = parseResultNumber(war.result);
    if (res !== null) {
      bucket.netGlory += res;
      if (res > 0) bucket.wins += 1;
      else if (res < 0) bucket.losses += 1;
    }
    bucket.total += 1;
  }

  const buckets = Array.from(map.values()).sort((a, b) => a.periodKey.localeCompare(b.periodKey));
  for (const b of buckets) {
    const decided = b.wins + b.losses;
    b.winRate = decided > 0 ? Math.round((b.wins / decided) * 100) : 0;
  }
  return buckets;
}
