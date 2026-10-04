import { ChevronLeft, ChevronRight, Download, FileText, Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
export function canPreviewTicketAttachment(attachment) { return INLINE_TYPES.has(String(attachment?.content_type || "").trim().toLowerCase()); }

export default function TicketAttachmentPreview({ attachment, attachments = [], url, onClose, onDownload, onNavigate }) {
  const [zoom, setZoom] = useState(1);
  const [fullScreen, setFullScreen] = useState(false);
  const contentType = String(attachment?.content_type || "").toLowerCase();
  const isImage = contentType.startsWith("image/");
  const previewable = useMemo(() => (attachments || []).filter(canPreviewTicketAttachment), [attachments]);
  const currentIndex = previewable.findIndex((item) => Number(item.id) === Number(attachment?.id));
  const details = useMemo(() => [attachment?.content_type, attachment?.size_bytes ? `${Math.ceil(Number(attachment.size_bytes) / 1024)} KB` : null, attachment?.uploaded_by_name, attachment?.created_at ? new Date(attachment.created_at).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "medium" }) : null].filter(Boolean).join(" | "), [attachment]);

  useEffect(() => { setZoom(1); setFullScreen(false); }, [attachment?.id]);
  useEffect(() => {
    if (!attachment || !url) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && currentIndex > 0) onNavigate?.(previewable[currentIndex - 1]);
      if (event.key === "ArrowRight" && currentIndex >= 0 && currentIndex < previewable.length - 1) onNavigate?.(previewable[currentIndex + 1]);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [attachment, currentIndex, onClose, onNavigate, previewable, url]);

  if (!attachment || !url) return null;
  return createPortal(
    <div className={`fixed inset-0 z-[1600] flex flex-col bg-slate-950/90 backdrop-blur ${fullScreen ? "p-0" : "p-3"}`} role="dialog" aria-modal="true" aria-label={`Preview ${attachment.original_name || "attachment"}`}>
      <header className={`flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 shadow-xl ${fullScreen ? "rounded-none" : "rounded-2xl"}`}>
        <div className="min-w-0"><p className="truncate font-bold text-slate-950">{attachment.original_name || "Attachment"}</p>{details ? <p className="text-xs text-slate-500">{details}</p> : null}<p className="text-[11px] font-semibold text-slate-400">{currentIndex >= 0 ? `${currentIndex + 1} of ${previewable.length} previewable attachments` : "Attachment preview"}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={currentIndex <= 0} onClick={() => onNavigate?.(previewable[currentIndex - 1])} className="rounded-lg border p-2 disabled:opacity-40" aria-label="Previous attachment"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" disabled={currentIndex < 0 || currentIndex >= previewable.length - 1} onClick={() => onNavigate?.(previewable[currentIndex + 1])} className="rounded-lg border p-2 disabled:opacity-40" aria-label="Next attachment"><ChevronRight className="h-4 w-4" /></button>
          {isImage ? <><button type="button" onClick={() => setZoom((value) => Math.max(.5, value - .25))} className="rounded-lg border p-2" aria-label="Zoom out"><ZoomOut className="h-4 w-4" /></button><button type="button" onClick={() => setZoom((value) => Math.min(3, value + .25))} className="rounded-lg border p-2" aria-label="Zoom in"><ZoomIn className="h-4 w-4" /></button></> : null}
          <button type="button" onClick={() => setFullScreen((value) => !value)} className="rounded-lg border p-2" aria-label={fullScreen ? "Exit full screen" : "Open full screen"}><Maximize2 className="h-4 w-4" /></button>
          <button type="button" onClick={onDownload} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold"><Download className="h-4 w-4" />Download</button>
          <button type="button" onClick={onClose} className="rounded-lg border p-2" aria-label="Close preview"><X className="h-4 w-4" /></button>
        </div>
      </header>
      <main className={`mt-3 flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-900/70 p-4 ${fullScreen ? "rounded-none" : "rounded-2xl"}`}>
        {isImage ? <img src={url} alt={attachment.original_name || "Ticket attachment"} className="max-h-full max-w-full object-contain transition-transform" style={{ transform: `scale(${zoom})` }} /> : contentType === "application/pdf" ? <iframe src={url} title={attachment.original_name || "PDF attachment"} className="h-full min-h-[70vh] w-full rounded-xl bg-white" /> : <div className="text-center text-white"><FileText className="mx-auto h-10 w-10" /><p className="mt-3">Preview unavailable.</p></div>}
      </main>
    </div>, document.body
  );
}
