import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, Trash2, X } from 'lucide-react';
import {
  detectDefaultRepo,
  verifyGitHubToken,
  type EditorConfig,
} from '../utils/githubEditor';

interface EditorAuthModalProps {
  isOpen: boolean;
  currentConfig: EditorConfig | null;
  onClose: () => void;
  onSaveConfig: (config: EditorConfig) => void;
  onClearConfig: () => void;
}

export function EditorAuthModal({
  isOpen,
  currentConfig,
  onClose,
  onSaveConfig,
  onClearConfig,
}: EditorAuthModalProps) {
  const [token, setToken] = useState<string>('');
  const [repo, setRepo] = useState<string>(detectDefaultRepo());
  const [showToken, setShowToken] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setToken(currentConfig?.token || '');
    setRepo(currentConfig?.repo || detectDefaultRepo());
    setShowToken(false);
    setError(null);
  }, [isOpen, currentConfig]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isVerifying) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isVerifying, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsVerifying(true);
    try {
      const result = await verifyGitHubToken(token, repo);
      onSaveConfig({
        token: token.trim(),
        repo: result.repoFullName,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo verificar el token en GitHub.',
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisconnect = () => {
    onClearConfig();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#060b14]/80 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editor-auth-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isVerifying) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border-2 border-[#3b5573] bg-[#0f1b2b] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#3b5573] bg-[#101c2d] text-[#c6f36b]">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h2
                id="editor-auth-title"
                className="font-display text-base font-extrabold text-white"
              >
                Modo editor de guerras nuevas
              </h2>
              <p className="text-xs text-slate-400">
                Solo permite editar estrellas y tamaño de guerras recientes.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isVerifying}
            aria-label="Cerrar ventana"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-[#16273e] hover:text-white disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label
              htmlFor="github-editor-token"
              className="block text-[11px] font-bold uppercase tracking-[0.09em] text-slate-400"
            >
              Token de GitHub (Fine-grained PAT)
            </label>
            <div className="relative mt-1.5">
              <input
                id="github-editor-token"
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="github_pat_..."
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-lg border-2 border-[#3b5573] bg-[#101c2d] py-2 pl-3 pr-10 font-mono text-xs text-white placeholder:text-slate-500 transition focus:border-[#c6f36b] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowToken((prev) => !prev)}
                aria-label={showToken ? 'Ocultar token' : 'Mostrar token'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-200"
              >
                {showToken ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
              Se guarda únicamente en este navegador/dispositivo y requiere permiso{' '}
              <span className="font-mono text-slate-200">Contents: Read and write</span>{' '}
              sobre el repositorio.
            </p>
          </div>

          <div>
            <label
              htmlFor="github-editor-repo"
              className="block text-[11px] font-bold uppercase tracking-[0.09em] text-slate-400"
            >
              Repositorio en GitHub
            </label>
            <input
              id="github-editor-repo"
              type="text"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="DomiPal0/colombia-force-war-history"
              autoComplete="off"
              spellCheck={false}
              className="mt-1.5 w-full rounded-lg border-2 border-[#3b5573] bg-[#101c2d] px-3 py-2 font-mono text-xs text-white placeholder:text-slate-500 transition focus:border-[#c6f36b] focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-500/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            {currentConfig?.token ? (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isVerifying}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-950/25 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-950/45 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Desactivar</span>
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isVerifying}
                className="rounded-lg border-2 border-[#3b5573] bg-[#101c2d] px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-400 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isVerifying || !token.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#c6f36b] bg-[#c6f36b] px-4 py-2 text-xs font-bold text-[#111c08] transition hover:bg-[#d9f99d] disabled:cursor-not-allowed disabled:opacity-55"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{isVerifying ? 'Verificando…' : 'Activar'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
