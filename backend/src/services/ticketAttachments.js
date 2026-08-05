const fs = require("fs");
const path = require("path");
const multer = require("multer");

const ATTACHMENT_ROOT = path.resolve(
  process.env.TICKET_ATTACHMENT_DIR ||
    path.join(__dirname, "..", "..", "storage", "ticket-attachments")
);

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);

const MAX_FILES = 5;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

function ensureRoot() {
  fs.mkdirSync(ATTACHMENT_ROOT, { recursive: true });
}

function safeFileName(name) {
  return String(name || "attachment")
    .replace(/[^\w.\-()+ ]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "attachment";
}

const storage = multer.diskStorage({
  destination(_req, _file, callback) {
    try {
      ensureRoot();
      callback(null, ATTACHMENT_ROOT);
    } catch (error) {
      callback(error);
    }
  },
  filename(_req, file, callback) {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    callback(null, `${stamp}-${safeFileName(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { files: MAX_FILES, fileSize: MAX_FILE_BYTES },
  fileFilter(_req, file, callback) {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return callback(
        Object.assign(new Error("Only PNG, JPG, WebP, or PDF files are allowed."), {
          status: 400,
        })
      );
    }
    return callback(null, true);
  },
});

/**
 * Accept multipart uploads when present; leave JSON bodies untouched.
 */
function optionalAttachments(req, res, next) {
  const contentType = String(req.headers["content-type"] || "");
  if (!contentType.includes("multipart/form-data")) return next();

  return upload.array("attachments", MAX_FILES)(req, res, (error) => {
    if (!error) return next();
    const status = error.status || (error.code === "LIMIT_FILE_SIZE" ? 400 : 400);
    return res.status(status).json({
      error:
        error.code === "LIMIT_FILE_SIZE"
          ? "Each attachment must be 8 MB or smaller."
          : error.message || "Attachment upload failed.",
    });
  });
}

function relativeStoredPath(absolutePath) {
  return path.relative(ATTACHMENT_ROOT, absolutePath).replace(/\\/g, "/");
}

function absoluteFromStored(storedPath) {
  const absolute = path.resolve(ATTACHMENT_ROOT, storedPath);
  if (!absolute.startsWith(ATTACHMENT_ROOT)) {
    throw Object.assign(new Error("Invalid attachment path."), { status: 400 });
  }
  return absolute;
}

async function saveUploadedFiles(database, ticketId, userId, files = []) {
  if (!Array.isArray(files) || files.length === 0) return [];

  const saved = [];
  for (const file of files) {
    const storedPath = relativeStoredPath(file.path);
    const result = await database.query(
      `INSERT INTO ticket_attachments (
         ticket_id, uploaded_by, original_name, stored_name, stored_path, content_type, size_bytes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, ticket_id, original_name, content_type, size_bytes, created_at`,
      [
        ticketId,
        userId || null,
        file.originalname || "attachment",
        path.basename(file.path),
        storedPath,
        file.mimetype || null,
        file.size || null,
      ]
    );
    saved.push(result.rows[0]);
  }
  return saved;
}

function cleanupFiles(files = []) {
  for (const file of files) {
    if (!file?.path) continue;
    fs.unlink(file.path, () => {});
  }
}

async function listAttachments(database, ticketId) {
  const result = await database.query(
    `SELECT a.id, a.ticket_id, a.original_name, a.content_type, a.size_bytes, a.created_at,
            u.name AS uploaded_by_name
       FROM ticket_attachments a
       LEFT JOIN users u ON u.id = a.uploaded_by
      WHERE a.ticket_id = $1
      ORDER BY a.created_at ASC, a.id ASC`,
    [ticketId]
  );
  return result.rows;
}

async function getAttachment(database, attachmentId) {
  const result = await database.query(
    `SELECT a.*, t.requester_id
       FROM ticket_attachments a
       JOIN tickets t ON t.id = a.ticket_id
      WHERE a.id = $1
      LIMIT 1`,
    [attachmentId]
  );
  return result.rows[0] || null;
}

module.exports = {
  ATTACHMENT_ROOT,
  MAX_FILES,
  optionalAttachments,
  saveUploadedFiles,
  cleanupFiles,
  listAttachments,
  getAttachment,
  absoluteFromStored,
  ensureRoot,
};
