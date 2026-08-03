require("dotenv").config();

/**
 * Thin Freshservice REST v2 client used by the archive sync.
 *
 * The tenant is capped at 120 requests/minute, so every call passes through a
 * throttle and honours `Retry-After` on 429 responses. Callers get plain JSON
 * back and are expected to tolerate the sync being interrupted at any point.
 */

const DEFAULT_DOMAIN = "atdalliance.freshservice.com";

const domain = String(process.env.FRESHSERVICE_DOMAIN || DEFAULT_DOMAIN)
  .trim()
  .replace(/^https?:\/\//, "")
  .replace(/\/+$/, "");

const apiKey = String(process.env.FRESHSERVICE_API_KEY || "").trim();

// Stay a little under the documented ceiling so concurrent admin activity in
// the Freshservice UI does not push us over the limit.
const maxPerMinute = Math.max(
  10,
  Number.parseInt(process.env.FRESHSERVICE_RATE_LIMIT || "100", 10) || 100
);

const minIntervalMs = Math.ceil(60000 / maxPerMinute);
const requestTimeoutMs = Math.max(
  5000,
  Number.parseInt(process.env.FRESHSERVICE_TIMEOUT || "45000", 10) || 45000
);

const state = {
  apiCalls: 0,
  throttled: 0,
  lastRequestAt: 0,
  rateLimitRemaining: null,
};

function assertConfigured() {
  if (!apiKey) {
    throw new Error(
      "FRESHSERVICE_API_KEY is not set. Add it to backend/.env before running the archive sync."
    );
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttle() {
  const waitFor = state.lastRequestAt + minIntervalMs - Date.now();
  if (waitFor > 0) await sleep(waitFor);
  state.lastRequestAt = Date.now();
}

function buildUrl(path, query = {}) {
  const url = new URL(
    path.startsWith("/api/") ? path : `/api/v2/${path.replace(/^\/+/, "")}`,
    `https://${domain}`
  );

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

/**
 * Performs a single GET against the Freshservice API.
 *
 * Returns `{ status, body }`. A `404`/`403` resolves with a null body instead
 * of throwing so the sync can skip endpoints the plan does not include.
 */
async function request(path, query = {}, attempt = 1) {
  assertConfigured();
  await throttle();

  const url = buildUrl(path, query);
  const auth = Buffer.from(`${apiKey}:X`).toString("base64");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);

  let response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
        "User-Agent": "ATD-Helpdesk-Archive/1.0",
      },
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    if (attempt <= 4) {
      await sleep(2000 * attempt);
      return request(path, query, attempt + 1);
    }
    throw new Error(`Freshservice request failed for ${path}: ${error.message}`);
  }
  clearTimeout(timer);

  state.apiCalls += 1;
  const remaining = response.headers.get("x-ratelimit-remaining");
  if (remaining !== null) state.rateLimitRemaining = Number(remaining);

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after") || 60);
    state.throttled += 1;
    await sleep((Number.isFinite(retryAfter) ? retryAfter : 60) * 1000 + 1000);
    return request(path, query, attempt);
  }

  if (response.status === 404 || response.status === 403) {
    return { status: response.status, body: null };
  }

  if (response.status >= 500 && attempt <= 4) {
    await sleep(3000 * attempt);
    return request(path, query, attempt + 1);
  }

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Freshservice ${response.status} on ${path}: ${text.slice(0, 400)}`
    );
  }

  if (!text) return { status: response.status, body: {} };

  try {
    return { status: response.status, body: JSON.parse(text) };
  } catch {
    throw new Error(`Freshservice returned non-JSON for ${path}`);
  }
}

async function get(path, query = {}) {
  const { body } = await request(path, query);
  return body;
}

/**
 * Walks a paginated collection endpoint and yields each page's array.
 * `collection` is the key holding the array in the response body.
 */
async function* paginate(path, collection, query = {}, options = {}) {
  const perPage = options.perPage || 100;
  const maxPages = options.maxPages || 500;

  for (let page = 1; page <= maxPages; page += 1) {
    const body = await get(path, { ...query, per_page: perPage, page });
    if (!body) return;

    const rows = Array.isArray(body[collection]) ? body[collection] : [];
    if (rows.length === 0) return;

    yield { rows, page };

    if (rows.length < perPage) return;
  }
}

async function fetchAll(path, collection, query = {}, options = {}) {
  const all = [];
  for await (const { rows } of paginate(path, collection, query, options)) {
    all.push(...rows);
  }
  return all;
}

module.exports = {
  domain,
  get,
  request,
  paginate,
  fetchAll,
  isConfigured: () => Boolean(apiKey),
  stats: () => ({ ...state }),
};
