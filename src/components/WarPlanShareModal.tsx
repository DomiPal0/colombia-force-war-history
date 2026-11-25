import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Share2,
  X,
} from 'lucide-react';
import type { WarPlanPlayer, WarPlanSize } from '../types/warPlan';
import {
  buildWhatsAppReportText,
  renderWarPlanReportPng,
} from '../utils/warPlanFormatting';

interface WarPlanShareModalProps {
  isOpen: boolean;
  players: WarPlanPlayer[];
  warSize: WarPlanSize;
  onClose: () => void;
}

type ShareMode = 'image' | 'text';

export function WarPlanShareModal({
  isOpen,
  players,
  warSize,
  onClose,
}: WarPlanShareModalProps) {
  const [mode, setMode] = useState<ShareMode>('image');
  const [pngBlob, setPngBlob] = useState<Blob | null>(null);
  const [pngUrl, setPngUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  const assignedPlayers = useMemo(
    () => players.filter((player) => player.objective.trim() !== ''),
    [players],
  );

  const reportText = useMemo(
    () => buildWhatsAppReportText(assignedPlayers, warSize),
    [assignedPlayers, warSize],
  );

  const canNativeShareFiles = useMemo(() => {
    if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') {
      return false;
    }
    try {
      const dummy = new File([''], 'plan.png', { type: 'image/png' });
      return navigator.canShare({ files: [dummy] });
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || assignedPlayers.length === 0) {
      setPngBlob(null);
      setPngUrl(null);
      setImageError(null);
      return;
    }

    let active = true;
    let createdUrl: string | null = null;
    setIsGenerating(true);
    setImageError(null);

    renderWarPlanReportPng(assignedPlayers, warSize)
      .then((blob) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setPngBlob(blob);
        setPngUrl(createdUrl);
      })
      .catch((err) => {
        if (!active) return;
        setImageError(
          err instanceof Error ? err.message : 'No se pudo generar la imagen.',
        );
      })
      .finally(() => {
        if (active) setIsGenerating(false);
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [isOpen, assignedPlayers, warSize]);

  useEffect(() => {
    if (!copiedText) return;
    const timer = window.setTimeout(() => setCopiedText(false), 2500);
    return () => window.clearTimeout(timer);
  }, [copiedText]);

  if (!isOpen) return null;

  const handleDownloadPng = () => {
    if (!pngUrl) return;
    const anchor = document.createElement('a');
    anchor.href = pngUrl;
    anchor.download = `colombia-force-sala-guerra-${warSize}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const handleNativeSharePng = async () => {
    if (!pngBlob) return;
    try {
      const file = new File([pngBlob], `sala-guerra-${warSize}.png`, {
        type: 'image/png',
      });
      await navigator.share({
        title: `COLOMBIA FORCE · Sala de Guerra (${warSize})`,
        files: [file],
      });
    } catch {
      // El usuario canceló el selector nativo
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopiedText(true);
    } catch {
      setCopiedText(false);
    }
  };

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(reportText)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#060b14]/80 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-plan-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border-2 border-[#3b5573] bg-[#0f1b2b] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="share-plan-title"
              className="font-display text-lg font-extrabold text-white"
            >
              Compartir reporte por WhatsApp
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Incluye únicamente a los jugadores con objetivo asignado ({assignedPlayers.length}).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-[#16273e] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 inline-flex w-fit rounded-lg border-2 border-[#334b66] bg-[#0b1422] p-0.5">
          <button
            type="button"
            onClick={() => setMode('image')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
              mode === 'image'
                ? 'bg-[#c6f36b] text-[#111c08]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            <span>Imagen (PNG)</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('text')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
              mode === 'text'
                ? 'bg-[#c6f36b] text-[#111c08]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Texto WhatsApp</span>
          </button>
        </div>

        {assignedPlayers.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-[#3b5573] bg-[#0b1422] px-4 py-8 text-center text-sm text-slate-300">
            Aún no hay jugadores con objetivo asignado para generar el reporte.
          </div>
        ) : mode === 'image' ? (
          <div className="mt-4 flex min-h-0 flex-col gap-4">
            <div className="max-h-[48vh] overflow-auto rounded-lg border border-[#263a52] bg-[#0a111d] p-2">
              {isGenerating ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Generando imagen de la tabla…
                </div>
              ) : imageError ? (
                <div className="py-8 text-center text-xs text-rose-300">
                  {imageError}
                </div>
              ) : pngUrl ? (
                <img
                  src={pngUrl}
                  alt="Vista previa del reporte de Sala de Guerra"
                  className="mx-auto h-auto max-w-full rounded"
                />
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {canNativeShareFiles && pngBlob && (
                <button
                  type="button"
                  onClick={handleNativeSharePng}
                  className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#c6f36b] bg-[#c6f36b] px-4 py-2 text-xs font-bold text-[#111c08] transition hover:bg-[#d9f99d]"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Enviar por WhatsApp / Compartir</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={!pngUrl}
                className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#3b5573] bg-[#101c2d] px-4 py-2 text-xs font-semibold text-white transition hover:border-[#c6f36b] disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Descargar PNG</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex min-h-0 flex-col gap-4">
            <pre className="max-h-[44vh] overflow-auto whitespace-pre-wrap rounded-lg border border-[#263a52] bg-[#0b1422] p-3.5 font-mono text-xs leading-relaxed text-slate-200">
              {reportText}
            </pre>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCopyText}
                className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#3b5573] bg-[#101c2d] px-4 py-2 text-xs font-semibold text-white transition hover:border-[#c6f36b]"
              >
                {copiedText ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#c6f36b]" />
                    <span className="text-[#c6f36b]">Texto copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copiar texto</span>
                  </>
                )}
              </button>

              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#c6f36b] bg-[#c6f36b] px-4 py-2 text-xs font-bold text-[#111c08] transition hover:bg-[#d9f99d]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Abrir en WhatsApp</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
