import type { WarDirective, WarPlanPlayer, WarPlanSize } from '../types/warPlan';

export const MAX_OBJECTIVES_PER_PLAYER = 2;
export const MAX_DEFENSE_OBJECTIVES = 5;

export const WAR_PLAN_SIZES: { value: WarPlanSize; count: number }[] = [
  { value: '10v10', count: 10 },
  { value: '15v15', count: 15 },
  { value: '20v20', count: 20 },
  { value: '30v30', count: 30 },
];

export function getBaseCountForSize(size: WarPlanSize): number {
  return WAR_PLAN_SIZES.find((item) => item.value === size)?.count ?? 15;
}

export function getMissingWarBases(
  players: WarPlanPlayer[],
  warSize: WarPlanSize,
): number[] {
  const totalBases = getBaseCountForSize(warSize);
  const assignedBases = new Set<number>();

  for (const player of players) {
    const parsed = parseObjective(player.objective);
    for (const seg of parsed.segments) {
      if (seg.type === 'attack') {
        assignedBases.add(seg.base);
      } else {
        for (const base of seg.bases) {
          assignedBases.add(base);
        }
      }
    }
  }

  const missing: number[] = [];
  for (let base = 1; base <= totalBases; base += 1) {
    if (!assignedBases.has(base)) {
      missing.push(base);
    }
  }
  return missing;
}

type ObjectiveSegment =
  | { type: 'attack'; base: number }
  | { type: 'spy'; bases: number[] };

interface ParsedObjective {
  segments: ObjectiveSegment[];
  trailing: 'libre' | 'esperar' | null;
}

function parseObjective(raw: string): ParsedObjective {
  const cleaned = raw.trim();
  if (!cleaned) {
    return { segments: [], trailing: null };
  }

  const tokens = cleaned
    .split(/\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const segments: ObjectiveSegment[] = [];
  let trailing: 'libre' | 'esperar' | null = null;

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (lower === 'libre' || lower === 'esperar') {
      trailing = lower;
      continue;
    }

    if (lower === 'espiar') {
      segments.push({ type: 'spy', bases: [] });
      continue;
    }

    if (lower.startsWith('espiar ')) {
      const nums = Array.from(token.matchAll(/\d+/g))
        .map((match) => Number(match[0]))
        .filter((num) => Number.isFinite(num) && num > 0);
      segments.push({ type: 'spy', bases: nums });
      continue;
    }

    if (/^\d+$/.test(token)) {
      const baseNum = Number(token);
      if (Number.isFinite(baseNum) && baseNum > 0) {
        segments.push({ type: 'attack', base: baseNum });
      }
    }
  }

  return { segments, trailing };
}

function formatSpyBases(bases: number[]): string {
  if (bases.length === 0) return 'espiar';
  if (bases.length === 1) return `espiar ${bases[0]}`;
  if (bases.length === 2) return `espiar ${bases[0]} y ${bases[1]}`;
  const head = bases.slice(0, -1).join(', ');
  return `espiar ${head} y ${bases[bases.length - 1]}`;
}

function formatParsedObjective(parsed: ParsedObjective): string {
  const parts: string[] = [];

  for (const seg of parsed.segments) {
    if (seg.type === 'attack') {
      parts.push(String(seg.base));
    } else {
      parts.push(formatSpyBases(seg.bases));
    }
  }

  if (parsed.trailing) {
    parts.push(parsed.trailing);
  }

  return parts.join(' - ');
}

export function countObjectives(raw: string): number {
  const parsed = parseObjective(raw);
  let count = 0;

  for (const seg of parsed.segments) {
    if (seg.type === 'attack') {
      count += 1;
    } else {
      count += Math.max(1, seg.bases.length);
    }
  }

  if (parsed.trailing) {
    count += 1;
  }

  return count;
}

export function applySelectionToObjective(
  currentObjective: string,
  selectedBase: number | null,
  selectedDirective: WarDirective | null,
  maxObjectives: number = MAX_OBJECTIVES_PER_PLAYER,
): string {
  if (selectedBase === null && selectedDirective === null) {
    return currentObjective;
  }

  const parsed = parseObjective(currentObjective);
  const currentCount = countObjectives(currentObjective);

  if (selectedBase !== null && selectedDirective === 'espiar') {
    const existingSpy = parsed.segments.find(
      (seg): seg is { type: 'spy'; bases: number[] } => seg.type === 'spy',
    );
    if (existingSpy) {
      if (existingSpy.bases.includes(selectedBase)) {
        return currentObjective;
      }
      // Si el bloque espiar estaba vacío ("espiar"), reemplazar por "espiar N" no aumenta la cuenta.
      const addsCount = existingSpy.bases.length === 0 ? 0 : 1;
      if (currentCount + addsCount > maxObjectives) {
        return currentObjective;
      }
      existingSpy.bases.push(selectedBase);
    } else {
      if (currentCount + 1 > maxObjectives) {
        return currentObjective;
      }
      parsed.segments.push({ type: 'spy', bases: [selectedBase] });
    }
    return formatParsedObjective(parsed);
  }

  if (selectedBase !== null) {
    const alreadyAttack = parsed.segments.some(
      (seg) => seg.type === 'attack' && seg.base === selectedBase,
    );

    const needsTrailing =
      selectedDirective === 'libre' || selectedDirective === 'esperar';
    const trailingDelta = needsTrailing && parsed.trailing === null ? 1 : 0;
    const baseDelta = alreadyAttack ? 0 : 1;

    if (currentCount + baseDelta + trailingDelta > maxObjectives) {
      return currentObjective;
    }

    if (!alreadyAttack) {
      parsed.segments.push({ type: 'attack', base: selectedBase });
    }
    if (needsTrailing) {
      parsed.trailing = selectedDirective;
    }
    return formatParsedObjective(parsed);
  }

  // Solo directiva (sin base)
  if (selectedDirective === 'libre' || selectedDirective === 'esperar') {
    if (parsed.trailing === null && currentCount + 1 > maxObjectives) {
      return currentObjective;
    }
    parsed.trailing = selectedDirective;
  } else if (selectedDirective === 'espiar') {
    const hasSpy = parsed.segments.some((seg) => seg.type === 'spy');
    if (!hasSpy) {
      if (currentCount + 1 > maxObjectives) {
        return currentObjective;
      }
      parsed.segments.push({ type: 'spy', bases: [] });
    }
  }

  return formatParsedObjective(parsed);
}

export function removeLastObjectivePart(currentObjective: string): string {
  const parsed = parseObjective(currentObjective);
  if (parsed.trailing) {
    parsed.trailing = null;
    return formatParsedObjective(parsed);
  }

  const last = parsed.segments[parsed.segments.length - 1];
  if (!last) return '';

  if (last.type === 'spy' && last.bases.length > 1) {
    last.bases.pop();
  } else {
    parsed.segments.pop();
  }
  return formatParsedObjective(parsed);
}

const FANCY_CHAR_MAP: Record<string, string> = {
  ɮ: 'b',
  ʊ: 'u',
  ɖ: 'd',
  ɦ: 'h',
  ǟ: 'a',
};

export function normalizePlayerSortKey(name: string): string {
  return Array.from(name.trim().toLowerCase())
    .map((ch) => FANCY_CHAR_MAP[ch] ?? ch)
    .join('')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export type WarPlanSortField = 'name' | 'line' | 'default';
export type SortDirection = 'asc' | 'desc';

export function sortWarPlanPlayers(
  players: WarPlanPlayer[],
  field: WarPlanSortField,
  direction: SortDirection,
): WarPlanPlayer[] {
  if (field === 'default') return players;

  const list = [...players];
  list.sort((a, b) => {
    const nameCmp = normalizePlayerSortKey(a.name).localeCompare(
      normalizePlayerSortKey(b.name),
      'es',
    );
    if (field === 'line') {
      const lineCmp = a.line.localeCompare(b.line, 'es');
      if (lineCmp !== 0) {
        return direction === 'asc' ? lineCmp : -lineCmp;
      }
      return nameCmp;
    }
    return direction === 'asc' ? nameCmp : -nameCmp;
  });

  return list;
}

export interface WarPlanReportEntry {
  name: string;
  objective: string;
  isDefenseGroup?: boolean;
}

export function buildShareReportEntries(
  players: WarPlanPlayer[],
): WarPlanReportEntry[] {
  const entries: WarPlanReportEntry[] = [];
  const defenseObjectives: string[] = [];

  for (const player of players) {
    const objective = player.objective.trim();
    if (!objective) continue;

    if (player.line === 'Def') {
      if (!defenseObjectives.includes(objective)) {
        defenseObjectives.push(objective);
      }
    } else {
      entries.push({
        name: player.name,
        objective,
      });
    }
  }

  if (defenseObjectives.length > 0) {
    entries.push({
      name: 'Defensivos',
      objective: defenseObjectives.join(' / '),
      isDefenseGroup: true,
    });
  }

  return entries;
}

export function buildWhatsAppReportText(
  players: WarPlanPlayer[],
  warSize: WarPlanSize,
): string {
  const entries = buildShareReportEntries(players);
  const now = new Date();
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

  const lines = [
    `*COLOMBIA FORCE · SALA DE GUERRA (${warSize})*`,
    `Fecha: ${dateStr}`,
    '',
  ];

  if (entries.length > 0) {
    const maxNameLen = entries.reduce(
      (max, entry) => Math.max(max, Array.from(entry.name).length),
      0,
    );
    const maxObjLen = entries.reduce(
      (max, entry) => Math.max(max, Array.from(entry.objective).length),
      0,
    );
    const nameColWidth = maxNameLen + 2;
    const objColWidth = Math.max(maxObjLen, 8);

    lines.push('```');
    for (const entry of entries) {
      const nameChars = Array.from(entry.name).length;
      const objChars = Array.from(entry.objective).length;
      const namePad = ' '.repeat(Math.max(1, nameColWidth - nameChars));
      const leftCenterPad = ' '.repeat(
        Math.max(0, Math.floor((objColWidth - objChars) / 2)),
      );
      lines.push(`${entry.name}${namePad}${leftCenterPad}${entry.objective}`);
    }
    lines.push('```');
  }

  return lines.join('\n');
}

export async function renderWarPlanReportPng(
  players: WarPlanPlayer[],
  warSize: WarPlanSize,
): Promise<Blob> {
  const entries = buildShareReportEntries(players);
  const assignedPlayerCount = players.filter(
    (player) => player.objective.trim() !== '',
  ).length;
  const scale = 2;
  const width = 760;
  const paddingX = 32;
  const headerHeight = 104;
  const tableHeaderHeight = 42;
  const rowHeight = 44;
  const footerHeight = 40;
  const bodyRows = Math.max(entries.length, 1);
  const totalHeight = headerHeight + tableHeaderHeight + bodyRows * rowHeight + footerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = totalHeight * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo inicializar el lienzo para generar la imagen.');
  }

  ctx.scale(scale, scale);

  // Fondo principal
  ctx.fillStyle = '#0a111d';
  ctx.fillRect(0, 0, width, totalHeight);

  // Borde exterior de tarjeta
  ctx.strokeStyle = '#334b66';
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, width - 24, totalHeight - 24);

  // Encabezado
  ctx.fillStyle = '#c6f36b';
  ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('COLOMBIA FORCE · PLANIFICACIÓN TÁCTICA', paddingX, 42);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 26px "Barlow", "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`SALA DE GUERRA · ${warSize}`, paddingX, 74);

  const now = new Date();
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 13px "JetBrains Mono", monospace';
  const metaText = `${dateStr} · ${assignedPlayerCount} asignados`;
  const metaMetrics = ctx.measureText(metaText);
  ctx.fillText(metaText, width - paddingX - metaMetrics.width, 72);

  // Cabecera de tabla (2 columnas: PARCEROS | OBJETIVO centrado)
  const tableTop = headerHeight;
  const tableWidth = width - paddingX * 2;
  ctx.fillStyle = '#101c2d';
  ctx.fillRect(paddingX, tableTop, tableWidth, tableHeaderHeight);
  ctx.strokeStyle = '#334b66';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(paddingX, tableTop, tableWidth, tableHeaderHeight);

  const colParcerosX = paddingX + 18;
  const colObjetivoCenterX = paddingX + 340 + (tableWidth - 340) / 2;

  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PARCEROS', colParcerosX, tableTop + 26);
  ctx.textAlign = 'center';
  ctx.fillText('OBJETIVO', colObjetivoCenterX, tableTop + 26);

  // Filas
  entries.forEach((entry, index) => {
    const y = tableTop + tableHeaderHeight + index * rowHeight;
    ctx.fillStyle = index % 2 === 0 ? '#0d1726' : '#111e31';
    ctx.fillRect(paddingX, y, tableWidth, rowHeight);

    ctx.strokeStyle = '#23354b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(paddingX, y + rowHeight);
    ctx.lineTo(paddingX + tableWidth, y + rowHeight);
    ctx.stroke();

    // Nick en ámbar #f7aa37 (Defensivos en rojo suave)
    ctx.textAlign = 'left';
    ctx.fillStyle = entry.isDefenseGroup ? '#fb7185' : '#f7aa37';
    ctx.font = '700 16px "Barlow", "Plus Jakarta Sans", sans-serif';
    ctx.fillText(entry.name, colParcerosX, y + 28, 310);

    // Objetivo centrado en verde lima claro
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ecfccb';
    ctx.font = '700 15px "JetBrains Mono", monospace';
    ctx.fillText(entry.objective, colObjetivoCenterX, y + 27, tableWidth - 360);
  });

  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    'Solo incluye jugadores con objetivo asignado.',
    paddingX,
    totalHeight - 20,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('No se pudo exportar la imagen PNG.'));
    }, 'image/png');
  });
}
