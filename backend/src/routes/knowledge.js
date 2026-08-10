const express = require("express");

const pool = require("../db/pool");
const auth = require("../middleware/auth");

const router = express.Router();
router.use(auth);

/**
 * Employee-facing knowledge base.
 *
 * Articles come from the Freshservice solutions imported into fs_records
 * (category → folder → article). The legacy knowledge_base table is used only
 * as a fallback when no solutions have been synced.
 */

const BLOCK_TAGS = /<(script|style|iframe|object|embed|form|link|meta)[\s\S]*?<\/\1>/gi;
const SELF_CLOSING_BLOCKED = /<(script|style|iframe|object|embed|form|link|meta)[^>]*\/?>/gi;
const EVENT_ATTRS = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URLS = /\s(href|src)\s*=\s*("|')?\s*javascript:[^"'>\s]*("|')?/gi;

/** Conservative allowlist-ish sanitiser: strips executable markup. */
function sanitizeHtml(value) {
  return String(value || "")
    .replace(BLOCK_TAGS, "")
    .replace(SELF_CLOSING_BLOCKED, "")
    .replace(EVENT_ATTRS, "")
    .replace(JS_URLS, "");
}

const ENTITIES = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  middot: "·",
  bull: "•",
};

/** Freshservice description_text still carries HTML entities and stray tags. */
function decodeEntities(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&([a-z]+);/gi, (match, name) => {
      const key = String(name).toLowerCase();
      return Object.prototype.hasOwnProperty.call(ENTITIES, key)
        ? ENTITIES[key]
        : " ";
    })
    .replace(/&#(\d+);/g, (_match, code) =>
      String.fromCharCode(Number(code))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) =>
      String.fromCharCode(parseInt(code, 16))
    );
}

function summarise(text, limit = 180) {
  const clean = decodeEntities(text)
    .replace(/\s+/g, " ")
    // Drop leading punctuation/colons left behind by stripped markup.
    .replace(/^[\s:;,.\-–—•·]+/, "")
    .trim();
  if (!clean) return "";
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit).replace(/\s+\S*$/, "")}…`;
}

function readingMinutes(text) {
  const words = decodeEntities(text).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

router.get("/", async (request, response) => {
  try {
    // Ops dashboard only needs a short suggestion list; full article bodies
    // are for the employee Knowledge page.
    const lite = ["1", "true", "yes"].includes(
      String(request.query.lite || "").toLowerCase()
    );
    const requestedLimit = Number(request.query.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 500)
      : 500;

    const result = await pool.query(
      `
      SELECT a.fs_id, a.name AS title, a.updated_at,
             a.raw->>'description'      AS body_html,
             a.raw->>'description_text' AS body_text,
             f.name AS folder_name,
             c.name AS category_name
        FROM fs_records a
        LEFT JOIN fs_records f
          ON f.kind = 'solution_folder' AND f.fs_id = a.parent_fs_id
        LEFT JOIN fs_records c
          ON c.kind = 'solution_category' AND c.fs_id = f.parent_fs_id
       WHERE a.kind = 'solution_article'
         -- Freshservice ships demo articles ("… (Sample)"); never show them.
         AND a.name NOT ILIKE '%(sample)%'
       ORDER BY c.name NULLS LAST, f.name NULLS LAST, a.name
       LIMIT $1
    `,
      [limit]
    );

    if (result.rows.length) {
      return response.json(
        result.rows.map((row) => {
          const base = {
            id: `fs-${row.fs_id}`,
            title: row.title,
            category: row.category_name || "General",
            folder: row.folder_name || null,
            summary: summarise(row.body_text),
            readingMinutes: readingMinutes(row.body_text),
            updatedAt: row.updated_at,
          };

          if (lite) return base;

          return {
            ...base,
            bodyHtml: sanitizeHtml(row.body_html),
            bodyText: row.body_text || "",
          };
        })
      );
    }

    const legacy = await pool.query(
      "SELECT * FROM knowledge_base ORDER BY title LIMIT $1",
      [limit]
    );
    return response.json(
      legacy.rows.map((row) => ({
        id: String(row.id),
        title: row.title,
        category: "General",
        folder: null,
        summary: "",
        ...(lite
          ? {}
          : {
              bodyHtml: "",
              bodyText: "",
            }),
        readingMinutes: 1,
        updatedAt: row.created_at,
      }))
    );
  } catch (error) {
    console.error("Fetch knowledge articles failed:", error.message);
    return response
      .status(500)
      .json({ error: "Failed to fetch knowledge articles." });
  }
});

module.exports = router;
