import express from 'express';
import * as cheerio from 'cheerio';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AllianceOverview, AllianceSide, WarEntry, WarsSnapshot } from './src/types/war.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'data', 'wars.json');
const WAR_PLAN_FILE = path.join(__dirname, 'data', 'war-plan.json');
const DOMISTATS_URL = 'https://domistats.com/alliance_wars/68105?page=1';
const DOMISTATS_ALLIANCE_URL = 'https://domistats.com/alliance/68105';
const PORT = Number(process.env.PORT) || 3000;

function normalizeRank(raw: string | undefined): string {
  const value = (raw || '').trim();
  if (!value || value === '—') return '—';
  const match = value.match(/^#\s*(\d+)$/);
  return match ? `#${match[1]}` : value;
}

function normalizeText(raw: string | undefined, fallback = '—'): string {
  const cleaned = (raw || '').replace(/\s+/g, ' ').trim();
  return cleaned || fallback;
}

function warKey(war: WarEntry): string {
  return `${war.date.trim()}||${war.left.name.trim().toUpperCase()}||${war.right.name.trim().toUpperCase()}`;
}

function missingValue(val: string | undefined): boolean {
  return !val || val.trim() === '' || val.trim() === '—';
}

function readSide($: cheerio.CheerioAPI, warEl: ReturnType<cheerio.CheerioAPI>, sideName: 'left' | 'right'): AllianceSide {
  const side = warEl.find(`.war-opponent-${sideName}`).first();
  if (!side.length) {
    throw new Error(`Falta el bloque .war-opponent-${sideName}`);
  }
  const divisionSpans = side
    .find('.division-rank > span')
    .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter(Boolean);

  return {
    name: normalizeText(side.find('.war-alliance-name').first().text()),
    rank: normalizeRank(side.find('.war-crest-rank').first().text()),
    glory: normalizeText(side.find('.war-alliance-glory span').first().text()),
    division: divisionSpans.length ? divisionSpans.join(' ') : '—',
  };
}

function parseDomiStatsHtml(html: string): WarEntry[] {
  const $ = cheerio.load(html);
  const entries = $('.wars-container .war');
  if (!entries.length) {
    throw new Error('No se encontraron guerras en la página 1 de DomiStats.');
  }

  const parsed: WarEntry[] = [];
  entries.each((_, node) => {
    const warEl = $(node);
    let left = readSide($, warEl, 'left');
    let right = readSide($, warEl, 'right');
    if (left.name !== 'COLOMBIA FORCE' && right.name !== 'COLOMBIA FORCE') {
      return;
    }

    const starNodes = warEl.find('.war-stars');
    const leftStarNode = warEl
      .find('.war-stars.war-stars-left.no-wrap, .war-stars.war-stars-left')
      .first();
    const rightStarNode = warEl
      .find('.war-stars.no-wrap:not(.war-stars-left), .war-stars:not(.war-stars-left)')
      .first();
    let leftStars = normalizeText(
      (leftStarNode.length ? leftStarNode : starNodes.eq(0)).text(),
    );
    let rightStars = normalizeText(
      (rightStarNode.length ? rightStarNode : starNodes.eq(1)).text(),
    );
    let result = normalizeText(warEl.find('.war-glory-winner, .war-glory-loser').first().text());

    if (left.name !== 'COLOMBIA FORCE') {
      [left, right] = [right, left];
      [leftStars, rightStars] = [rightStars, leftStars];
      if (result !== '—') {
        const numeric = Number(result.replace(/,/g, ''));
        if (!Number.isNaN(numeric)) {
          result = String(-numeric);
        }
      }
    }

    const noteTags = warEl
      .find('.war-glory-center .war-tag')
      .filter((_, el) => $(el).hasClass('war-tag-close') || $(el).hasClass('war-tag-time'))
      .map((_, el) => normalizeText($(el).text(), ''))
      .get()
      .filter(Boolean);

    const date = normalizeText(warEl.find('.war-rel-time').first().attr('data-tooltip'), '');
    const title = normalizeText(warEl.attr('data-share-title'), `${left.name} vs ${right.name}`);
    const size = normalizeText(warEl.find('.war-tag-size').first().text());

    parsed.push({
      page: 1,
      title,
      date,
      left,
      right,
      result,
      stars: [leftStars, rightStars],
      size,
      notes: noteTags.length ? noteTags.join(', ') : '—',
    });
  });

  if (!parsed.length) {
    throw new Error('No se pudo leer ninguna guerra válida de COLOMBIA FORCE.');
  }
  return parsed;
}

function parseAllianceHtml(html: string): AllianceOverview {
  const $ = cheerio.load(html);

  let glory = '—';
  const gloryCandidates = $(
    '[data-tooltip="Glory"] .glory-value, .alliance-info-subcontainer .glory-row .glory-value, .glory-row .glory-value, .glory-value',
  );
  gloryCandidates.each((_, el) => {
    if (glory !== '—') return;
    const node = $(el);
    const imgSpan = node.find('img[alt="Glory"]').first().next('span');
    const val = normalizeText(imgSpan.length ? imgSpan.text() : node.text(), '');
    if (/\d/.test(val)) {
      glory = val;
    }
  });
  if (glory === '—') {
    $('img[alt="Glory"]').each((_, el) => {
      if (glory !== '—') return;
      const nextSpan = $(el).next('span');
      if (nextSpan.length) {
        const val = normalizeText(nextSpan.text(), '');
        if (/\d/.test(val)) {
          glory = val;
        }
      }
    });
  }

  let rank = '—';
  const rankNode = $(
    '.alliance-info-subcontainer .rank-box-with-diff .rank-box, [data-tooltip="Ranking"] .rank-box, .rank-box-with-diff .rank-box, .rank-box',
  ).first();
  if (rankNode.length) {
    const compactRank = rankNode.text().replace(/\s+/g, '').trim();
    if (compactRank) {
      rank = normalizeRank(compactRank.startsWith('#') ? compactRank : `#${compactRank}`);
    }
  }

  let division = '—';
  const divNode = $('.alliance-info-subcontainer .division-rank, .division-rank').first();
  if (divNode.length) {
    const spans = divNode
      .children('span')
      .map((_, el) => normalizeText($(el).text(), ''))
      .get()
      .filter(Boolean);
    division = spans.length ? spans.join(' ') : normalizeText(divNode.text());
  }

  if (glory === '—' && rank === '—' && division === '—') {
    throw new Error('No se pudieron leer los datos actuales de la alianza en DomiStats.');
  }

  return { glory, rank, division };
}

function mergeHistory(recentWars: WarEntry[], savedWars: WarEntry[]): { wars: WarEntry[]; added: number; updated: number } {
  const savedByKey = new Map<string, WarEntry>();
  for (const war of savedWars) {
    savedByKey.set(warKey(war), war);
  }

  const merged: WarEntry[] = [];
  const seenKeys = new Set<string>();
  let added = 0;
  let updated = 0;

  for (const rawNew of recentWars) {
    const newWar: WarEntry = {
      ...rawNew,
      stars: [rawNew.stars[0] || '—', rawNew.stars[1] || '—'],
    };
    const key = warKey(newWar);
    if (seenKeys.has(key)) continue;

    const oldWar = savedByKey.get(key);
    if (oldWar) {
      updated += 1;
      for (let i = 0; i < 2; i += 1) {
        if (missingValue(newWar.stars[i]) && !missingValue(oldWar.stars?.[i])) {
          newWar.stars[i] = oldWar.stars[i];
        }
      }
      if (missingValue(newWar.size) && !missingValue(oldWar.size)) {
        newWar.size = oldWar.size;
      }
      if (missingValue(newWar.notes) && !missingValue(oldWar.notes)) {
        newWar.notes = oldWar.notes;
      }
    } else {
      added += 1;
    }

    merged.push(newWar);
    seenKeys.add(key);
  }

  for (const oldWar of savedWars) {
    const key = warKey(oldWar);
    if (!seenKeys.has(key)) {
      merged.push(oldWar);
      seenKeys.add(key);
    }
  }

  merged.sort((a, b) => b.date.localeCompare(a.date));
  return { wars: merged, added, updated };
}

async function readSnapshot(): Promise<WarsSnapshot> {
  const raw = await fs.readFile(DATA_FILE, 'utf-8');
  return JSON.parse(raw) as WarsSnapshot;
}

function formatUtcTimestamp(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm} UTC`;
}

async function refreshFromDomiStats(): Promise<WarsSnapshot & { added: number; updated: number }> {
  const fetchHeaders = {
    'User-Agent': 'Mozilla/5.0 (compatible; ColombiaForceWarArchive/1.0; live-sync)',
    Accept: 'text/html,application/xhtml+xml',
    'Cache-Control': 'no-cache',
  };
  const response = await fetch(DOMISTATS_URL, {
    headers: fetchHeaders,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error(`DomiStats respondió con estado HTTP ${response.status}.`);
  }

  const html = await response.text();
  const recentWars = parseDomiStatsHtml(html);
  const current = await readSnapshot();
  const { wars, added, updated } = mergeHistory(recentWars, current.wars);

  let alliance: AllianceOverview | undefined = current.alliance;
  try {
    const allianceResp = await fetch(DOMISTATS_ALLIANCE_URL, {
      headers: fetchHeaders,
      signal: AbortSignal.timeout(20000),
    });
    if (allianceResp.ok) {
      const allianceHtml = await allianceResp.text();
      const fetched = parseAllianceHtml(allianceHtml);
      alliance = {
        glory: !missingValue(fetched.glory) ? fetched.glory : current.alliance?.glory || '—',
        rank: !missingValue(fetched.rank) ? fetched.rank : current.alliance?.rank || '—',
        division: !missingValue(fetched.division) ? fetched.division : current.alliance?.division || '—',
      };
    }
  } catch (err) {
    console.warn(
      '[Alliance Sync] Se conservó el resumen previo de la alianza:',
      err instanceof Error ? err.message : err,
    );
  }

  const updatedSnapshot: WarsSnapshot = {
    updated_at: formatUtcTimestamp(new Date()),
    refresh_pages: 1,
    ...(alliance ? { alliance } : {}),
    wars,
  };

  await fs.writeFile(DATA_FILE, `${JSON.stringify(updatedSnapshot, null, 2)}\n`, 'utf-8');
  return { ...updatedSnapshot, added, updated };
}

function scheduleDailyRefresh() {
  const scheduleNext = () => {
    const now = new Date();
    // 08:00 a. m. Colombia (UTC-5) = 13:00 UTC | 06:00 p. m. Colombia (UTC-5) = 23:00 UTC
    const candidates = [
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 13, 0, 0, 0)),
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 0, 0, 0)),
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 13, 0, 0, 0)),
    ];
    const nextRun = candidates.find((candidate) => candidate.getTime() > now.getTime())!;
    const delayMs = nextRun.getTime() - now.getTime();
    setTimeout(async () => {
      try {
        const result = await refreshFromDomiStats();
        console.log(
          `[Daily Sync COT] ${result.wars.length} guerras totales (+${result.added} nuevas).`,
        );
      } catch (err) {
        console.warn(
          '[Daily Sync COT] Se conservó data/wars.json:',
          err instanceof Error ? err.message : err,
        );
      } finally {
        scheduleNext();
      }
    }, delayMs).unref();
  };

  scheduleNext();
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/wars', async (_req, res) => {
    try {
      const snapshot = await readSnapshot();
      res.json(snapshot);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'No se pudo leer la base de datos de guerras.',
      });
    }
  });

  app.get('/api/war-plan', async (_req, res) => {
    try {
      const raw = await fs.readFile(WAR_PLAN_FILE, 'utf-8');
      res.json(JSON.parse(raw));
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'No se pudo leer la planeación de guerra.',
      });
    }
  });

  app.post('/api/wars/refresh', async (_req, res) => {
    try {
      const result = await refreshFromDomiStats();
      res.json(result);
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Error al sincronizar con DomiStats.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  scheduleDailyRefresh();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`COLOMBIA FORCE War Archive running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
