import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Eraser, Loader2, Printer } from "lucide-react";
import { hrWorkspaceApi } from "../../services/api";

function SignatureCanvas({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const ink = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const position = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const start = (event) => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const point = position(event);
    drawing.current = true;
    canvas.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#0f172a";
  };

  const move = (event) => {
    if (!drawing.current) return;
    const point = position(event);
    const context = canvasRef.current.getContext("2d");
    context.lineTo(point.x, point.y);
    context.stroke();
    ink.current = true;
    setHasInk(true);
  };

  const finish = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (ink.current) onChange(canvasRef.current.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    drawing.current = false;
    ink.current = false;
    setHasInk(false);
    onChange("");
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={900}
        height={220}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        className="h-36 w-full touch-none rounded-xl border border-slate-300 bg-white"
        aria-label="Employee acknowledgement signature"
      />
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-slate-500">{hasInk ? "Signature captured on this device." : "Sign above using a finger, stylus, or mouse."}</p>
        <button type="button" onClick={clear} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-700">
          <Eraser className="h-3.5 w-3.5" />Clear
        </button>
      </div>
    </div>
  );
}

export default function DeviceIssuanceSignoff({ request, onSaved }) {
  const [signerName, setSignerName] = useState(request.employee_name || "");
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [issuance, setIssuance] = useState(null);
  const [loading, setLoading] = useState(Boolean(request.issuance_signed_at));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!request.issuance_signed_at) return undefined;
    let active = true;
    hrWorkspaceApi.getIssuance(request.id)
      .then((response) => {
        if (active) setIssuance(response.data);
      })
      .catch((loadError) => {
        if (active) setError(loadError?.response?.data?.error || loadError.message || "The signed issuance form could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [request.id, request.issuance_signed_at]);

  const save = async () => {
    if (!signatureDataUrl) {
      setError("Capture the employee's signature before saving the issuance form.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await hrWorkspaceApi.saveIssuanceSignature(request.id, { signerName, signatureDataUrl });
      const response = await hrWorkspaceApi.getIssuance(request.id);
      setIssuance(response.data);
      await onSaved?.();
    } catch (saveError) {
      setError(saveError?.response?.data?.error || saveError.message || "The signed issuance form could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const issueDate = issuance?.issuance_signed_at
    ? new Date(issuance.issuance_signed_at).toLocaleString()
    : "";

  return (
    <section className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-bold text-slate-900">Device issuance acknowledgement</h4>
          <p className="mt-1 text-xs text-slate-600">Capture the employee's in-person acknowledgement on a tablet or other device. This is not a qualified digital certificate.</p>
        </div>
        {issuance ? (
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">
            <Printer className="h-4 w-4" />Print issuance form
          </button>
        ) : null}
      </div>

      {error ? <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Loading the signed receipt…</p>
      ) : issuance ? (
        <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" />Signed by {issuance.issuance_signature_name} on {issueDate}.</p>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-semibold text-slate-700">
            Employee name
            <input className="input mt-1" value={signerName} onChange={(event) => setSignerName(event.target.value)} maxLength={160} />
          </label>
          <SignatureCanvas onChange={setSignatureDataUrl} />
          <button type="button" onClick={save} disabled={saving || !signerName.trim()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {saving ? "Saving acknowledgement…" : "Save signed issuance form"}
          </button>
        </div>
      )}

      <style>{`
        .issuance-print { display: none; }
        @media print {
          body * { visibility: hidden !important; }
          .issuance-print, .issuance-print * { visibility: visible !important; }
          .issuance-print {
            display: block !important;
            position: fixed;
            inset: 0;
            z-index: 9999;
            background: #fff;
            color: #0f172a;
            padding: 32px;
          }
        }
      `}</style>
      {issuance ? (
        <article className="issuance-print">
          <h1 className="text-2xl font-bold">Device Issuance Form</h1>
          <p className="mt-1 text-sm">HR request HR-{request.id} · IT ticket {request.it_ticket_ref || "—"}</p>
          <hr className="my-5" />
          <h2 className="font-bold">Employee</h2>
          <p>{issuance.employee_name} · {issuance.m365_email || issuance.employee_email || "Work email pending"}</p>
          <p>{issuance.department}{issuance.job_title ? ` · ${issuance.job_title}` : ""}</p>
          <p>Start date: {issuance.start_date ? new Date(issuance.start_date).toLocaleDateString() : "—"}</p>
          <h2 className="mt-6 font-bold">Issued device</h2>
          <p>{issuance.ams_asset_name} · Asset tag {issuance.ams_asset_tag}</p>
          <p>Serial number: {issuance.ams_serial_number || "—"} · AMS asset ID: {issuance.ams_asset_id}</p>
          <p className="mt-6">I acknowledge receipt of the device identified above and understand that it remains company property.</p>
          <p className="mt-6 text-sm">Signed: {issuance.issuance_signature_name} · {issueDate}</p>
          {issuance.issuance_signature_data_url ? <img src={issuance.issuance_signature_data_url} alt="Employee acknowledgement signature" className="mt-2 h-20 max-w-xs border-b border-slate-400 object-contain" /> : null}
          <p className="mt-2 text-xs text-slate-500">Electronic acknowledgement captured by the Helpdesk during in-person device issuance.</p>
        </article>
      ) : null}
    </section>
  );
}
