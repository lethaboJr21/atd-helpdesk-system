export default function LegalDocumentViewer({ document }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><h2 className="text-lg font-bold text-slate-950">{document.title}</h2><span className="text-xs font-bold text-slate-500">Version {document.version}</span></div>{document.summary ? <p className="mt-2 text-sm text-slate-600">{document.summary}</p> : null}<div className="prose prose-slate mt-4 max-w-none text-sm" dangerouslySetInnerHTML={{ __html: document.content_html }} /></article>;
}
