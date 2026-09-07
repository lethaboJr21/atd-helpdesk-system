const crypto = require("crypto");
const pool = require("../db/pool");
const { getSetting } = require("./systemSettings");
const MODES = new Set(["disabled", "preview", "enforced"]);
function hashContent(value) { return crypto.createHash("sha256").update(String(value || "")).digest("hex"); }
async function getEnforcementMode(database = pool) {
  try { const mode = String(await getSetting("terms.enforcement_mode", "preview", database)).toLowerCase(); return MODES.has(mode) ? mode : "disabled"; }
  catch (error) { if (error.code === "42P01") return "disabled"; throw error; }
}
async function getCurrentDocuments(database = pool) {
  try {
    const result = await database.query(`SELECT id, document_key, version, title, summary, content_html, content_hash, published_at
      FROM legal_documents WHERE published_at IS NOT NULL AND retired_at IS NULL
      ORDER BY document_key, published_at DESC, id DESC`);
    const seen = new Set();
    return result.rows.filter((row) => seen.has(row.document_key) ? false : (seen.add(row.document_key), true));
  } catch (error) { if (error.code === "42P01") return []; throw error; }
}
async function getTermsState(userId, database = pool) {
  const mode = await getEnforcementMode(database);
  const documents = await getCurrentDocuments(database);
  if (!userId || !documents.length) return { mode, required: false, documents, outstanding: [] };
  const result = await database.query(`SELECT legal_document_id FROM legal_document_acceptances WHERE user_id=$1 AND legal_document_id=ANY($2::bigint[])`, [userId, documents.map((d) => d.id)]);
  const accepted = new Set(result.rows.map((r) => Number(r.legal_document_id)));
  const outstanding = documents.filter((d) => !accepted.has(Number(d.id)));
  return { mode, required: mode === "enforced" && outstanding.length > 0, previewRequired: mode === "preview" && outstanding.length > 0, documents, outstanding };
}
async function acceptCurrentDocuments({ userId, documentIds, ipAddress, userAgent, database = pool }) {
  const state = await getTermsState(userId, database);
  const currentIds = new Set(state.documents.map((d) => Number(d.id)));
  const supplied = [...new Set((documentIds || []).map(Number).filter(Number.isInteger))];
  if (!supplied.length || supplied.some((id) => !currentIds.has(id))) throw Object.assign(new Error("Accept every current legal document."), { status: 400 });
  const missing = state.outstanding.map((d) => Number(d.id)).filter((id) => !supplied.includes(id));
  if (missing.length) throw Object.assign(new Error("Accept every outstanding legal document."), { status: 400 });
  for (const id of supplied) await database.query(`INSERT INTO legal_document_acceptances(user_id,legal_document_id,ip_address,user_agent) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,legal_document_id) DO NOTHING`, [userId,id,ipAddress || null,String(userAgent || "").slice(0,1000) || null]);
  return getTermsState(userId, database);
}
module.exports = { hashContent, getEnforcementMode, getCurrentDocuments, getTermsState, acceptCurrentDocuments };
