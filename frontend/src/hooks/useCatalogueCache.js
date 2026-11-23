const DEFAULT_TTL = parseInt(import.meta.env?.VITE_CATALOGUE_CACHE_TTL_MS || "300000", 10);
const memoryFallback = new Map();

function safeGet(key) {
  try { const raw = sessionStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}

function safeSet(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); return true; }
  catch {
    let oldest = null, oldestTime = Infinity;
    for (const [k, v] of memoryFallback.entries()) { if (v.cachedAt < oldestTime) { oldestTime = v.cachedAt; oldest = k; } }
    if (oldest) memoryFallback.delete(oldest);
    memoryFallback.set(key, value);
    return false;
  }
}

export function get(key) {
  const entry = safeGet(key) || memoryFallback.get(key);
  if (!entry) return null;
  if (!entry.items || !Array.isArray(entry.items) || typeof entry.cachedAt !== "number") {
    invalidate(key);
    return null;
  }
  if (Date.now() - entry.cachedAt > (entry.ttl || DEFAULT_TTL)) {
    invalidate(key);
    return null;
  }
  return entry;
}

export function set(key, items, categories, ttl = DEFAULT_TTL) {
  const entry = { items, categories, cachedAt: Date.now(), ttl };
  safeSet(key, entry);
}

export function invalidate(key) {
  try { sessionStorage.removeItem(key); } catch {}
  memoryFallback.delete(key);
}

export function isExpired(entry) {
  if (!entry || typeof entry.cachedAt !== "number") return true;
  return Date.now() - entry.cachedAt > (entry.ttl || DEFAULT_TTL);
}

export function cacheKey(catalogueType, workspaceCode) {
  return `catalogue_${catalogueType}_${workspaceCode}`;
}

export { DEFAULT_TTL };