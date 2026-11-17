import type { WarEntry, WarsSnapshot } from '../types/war';

export const DEFAULT_GITHUB_REPO = 'DomiPal0/colombia-force-war-history';
export const WAR_SIZE_OPTIONS = ['10 v 10', '15 v 15', '20 v 20', '30 v 30'] as const;

/**
 * Última fecha del archivo histórico previo al cambio de DomiStats.
 * Ninguna guerra igual o anterior a esta fecha puede editarse desde la interfaz.
 */
export const HISTORICAL_LOCK_CUTOFF = '2026/11/13';
export const EDITABLE_WINDOW_DAYS = 15;

const STORAGE_KEY = 'cf_war_editor_config_v1';

export interface EditorConfig {
  token: string;
  repo: string;
}

export function detectDefaultRepo(): string {
  if (typeof window === 'undefined') return DEFAULT_GITHUB_REPO;
  const host = window.location.hostname.toLowerCase();
  if (host.endsWith('.github.io')) {
    const owner = host.slice(0, -'.github.io'.length);
    const segment = window.location.pathname.split('/').filter(Boolean)[0];
    if (owner && segment) {
      return `${owner}/${segment}`;
    }
  }
  return DEFAULT_GITHUB_REPO;
}

export function loadEditorConfig(): EditorConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EditorConfig>;
    const token = typeof parsed.token === 'string' ? parsed.token.trim() : '';
    const repo = typeof parsed.repo === 'string' && parsed.repo.trim()
      ? parsed.repo.trim()
      : detectDefaultRepo();
    if (!token) return null;
    return { token, repo };
  } catch {
    return null;
  }
}

export function saveEditorConfig(config: EditorConfig): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      token: config.token.trim(),
      repo: config.repo.trim() || detectDefaultRepo(),
    }),
  );
}

export function clearEditorConfig(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

function parseWarDateUtcMs(dateStr: string | undefined): number | null {
  const match = (dateStr || '').trim().match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Solo permite editar guerras nuevas posteriores al archivo histórico (2026/11/13)
 * y dentro de los últimos 15 días respecto a la guerra más reciente registrada.
 */
export function isEditableNewWar(war: WarEntry, latestWarDate?: string): boolean {
  const warDate = (war.date || '').trim();
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(warDate)) return false;
  if (warDate <= HISTORICAL_LOCK_CUTOFF) return false;

  const warMs = parseWarDateUtcMs(warDate);
  const referenceMs = parseWarDateUtcMs(latestWarDate) ?? Date.now();
  if (warMs === null) return false;

  const diffDays = (referenceMs - warMs) / (1000 * 60 * 60 * 24);
  return diffDays <= EDITABLE_WINDOW_DAYS;
}

function decodeBase64Utf8(base64: string): string {
  const clean = base64.replace(/\s+/g, '');
  const binary = window.atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return window.btoa(binary);
}

function buildWarMatchKey(war: WarEntry): string {
  return `${war.date.trim()}||${war.left.name.trim().toUpperCase()}||${war.right.name.trim().toUpperCase()}`;
}

export async function verifyGitHubToken(token: string, repo: string): Promise<{ repoFullName: string }> {
  const cleanToken = token.trim();
  const cleanRepo = repo.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '');

  if (!cleanToken) {
    throw new Error('Ingresa un token personal de GitHub.');
  }
  if (!/^[^/\s]+\/[^/\s]+$/.test(cleanRepo)) {
    throw new Error('El repositorio debe tener formato usuario/repositorio.');
  }

  const response = await fetch(`https://api.github.com/repos/${cleanRepo}`, {
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${cleanToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (response.status === 401) {
    throw new Error('El token es inválido o expiró.');
  }
  if (response.status === 403) {
    throw new Error('El token no tiene acceso suficiente a este repositorio.');
  }
  if (response.status === 404) {
    throw new Error('No se encontró el repositorio o el token no tiene permiso para verlo.');
  }
  if (!response.ok) {
    throw new Error(`GitHub respondió con error HTTP ${response.status}.`);
  }

  const data = (await response.json()) as {
    full_name?: string;
    permissions?: { push?: boolean };
  };

  if (data.permissions && data.permissions.push === false) {
    throw new Error('El token es solo de lectura; necesita permiso Contents: Read and write.');
  }

  return { repoFullName: data.full_name || cleanRepo };
}

interface GitHubContentsResponse {
  sha: string;
  content: string;
  encoding?: string;
}

export async function saveWarEditsToGitHub(params: {
  token: string;
  repo: string;
  war: WarEntry;
  stars: [string, string];
  size: string;
}): Promise<{ war: WarEntry }> {
  const cleanToken = params.token.trim();
  const cleanRepo = params.repo.trim();

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${cleanToken}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const getResp = await fetch(
    `https://api.github.com/repos/${cleanRepo}/contents/data/wars.json`,
    {
      cache: 'no-store',
      headers,
    },
  );

  if (getResp.status === 401 || getResp.status === 403) {
    throw new Error('El token de GitHub no es válido o no tiene permiso de escritura.');
  }
  if (!getResp.ok) {
    throw new Error(`No se pudo leer data/wars.json en GitHub (HTTP ${getResp.status}).`);
  }

  const filePayload = (await getResp.json()) as GitHubContentsResponse;
  const decodedJson = decodeBase64Utf8(filePayload.content);
  const snapshot = JSON.parse(decodedJson) as WarsSnapshot;

  if (!Array.isArray(snapshot.wars)) {
    throw new Error('El formato de data/wars.json en GitHub no es válido.');
  }

  const targetKey = buildWarMatchKey(params.war);
  const targetIndex = snapshot.wars.findIndex((item) => buildWarMatchKey(item) === targetKey);
  if (targetIndex === -1) {
    throw new Error('No se encontró esta guerra dentro de data/wars.json.');
  }

  const targetWar = snapshot.wars[targetIndex];
  const latestDate = snapshot.wars[0]?.date;
  if (!isEditableNewWar(targetWar, latestDate)) {
    throw new Error('Las guerras antiguas están bloqueadas y no pueden modificarse.');
  }

  const updatedWar: WarEntry = {
    ...targetWar,
    stars: [params.stars[0], params.stars[1]],
    size: params.size,
  };
  snapshot.wars[targetIndex] = updatedWar;

  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  const putResp = await fetch(
    `https://api.github.com/repos/${cleanRepo}/contents/data/wars.json`,
    {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `chore: editar estrellas y tamaño (${updatedWar.title}, ${updatedWar.date})`,
        content: encodeBase64Utf8(serialized),
        sha: filePayload.sha,
      }),
    },
  );

  if (putResp.status === 409) {
    throw new Error('Hubo una actualización simultánea en GitHub. Intenta guardar de nuevo.');
  }
  if (putResp.status === 401 || putResp.status === 403 || putResp.status === 404) {
    throw new Error('El token no tiene permiso Contents: Read and write sobre este repositorio.');
  }
  if (!putResp.ok) {
    throw new Error(`No se pudo guardar en GitHub (HTTP ${putResp.status}).`);
  }

  return { war: updatedWar };
}
