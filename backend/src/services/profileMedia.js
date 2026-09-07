"use strict";

const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const pool = require("../db/pool");

const MEDIA_DIR = path.resolve(process.env.PROFILE_MEDIA_DIR || path.join(__dirname, "../../storage/profile-media"));
const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_DIMENSION = 8192;
const OUTPUTS = Object.freeze({ avatar: { width: 512, height: 512, fit: "cover" }, background: { width: 2560, height: 1440, fit: "inside" } });
const ALLOWED_INPUTS = new Set(["image/jpeg", "image/png", "image/webp"]);

function httpError(status, message, code) { const error = new Error(message); error.status = status; error.code = code; return error; }
function assertMediaType(value) { if (!OUTPUTS[value]) throw httpError(400,"Unsupported profile media type.","PROFILE_MEDIA_TYPE_INVALID"); return value; }
function canManage(actor, userId) { return Number(actor.id) === Number(userId) || ["admin","superadmin"].includes(actor.role); }
function publicRow(row) { return row ? { id:Number(row.id), userId:Number(row.user_id), mediaType:row.media_type, source:row.media_source, contentType:row.content_type, width:row.width, height:row.height, revision:Number(row.revision), visibility:row.visibility, url:`/api/profile-media/users/${row.user_id}/${row.media_type}?v=${row.revision}`, updatedAt:row.updated_at } : null; }
function confined(filePath) { const value = path.resolve(filePath); if (value !== MEDIA_DIR && !value.startsWith(`${MEDIA_DIR}${path.sep}`)) throw httpError(500,"Unsafe profile-media path.","PROFILE_MEDIA_PATH_INVALID"); return value; }
async function ensureDirectory() { await fs.mkdir(MEDIA_DIR,{recursive:true,mode:0o700}); }

async function processImage(buffer, mediaType) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_INPUT_BYTES) throw httpError(400,"The image is empty or too large.","PROFILE_MEDIA_SIZE_INVALID");
  const image = sharp(buffer,{failOn:"error",limitInputPixels:MAX_DIMENSION*MAX_DIMENSION});
  const metadata = await image.metadata();
  if (!ALLOWED_INPUTS.has(`image/${metadata.format === "jpg" ? "jpeg" : metadata.format}`)) throw httpError(400,"Use a JPEG, PNG, or WebP image.","PROFILE_MEDIA_FORMAT_INVALID");
  if (!metadata.width || !metadata.height || metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) throw httpError(400,"Image dimensions are unsupported.","PROFILE_MEDIA_DIMENSIONS_INVALID");
  const target = OUTPUTS[mediaType];
  const output = await image.rotate().resize({ ...target, withoutEnlargement:true, position:"centre" }).webp({quality:86,effort:4}).toBuffer({resolveWithObject:true});
  return { buffer:output.data, width:output.info.width, height:output.info.height, contentType:"image/webp", sha256:crypto.createHash("sha256").update(output.data).digest("hex") };
}

async function writeAudit(db, actorId, userId, action, oldValue, newValue, details={}) {
  await db.query(`INSERT INTO administration_audit_log(actor_user_id,target_user_id,action,old_value,new_value,details) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)`,[actorId,userId,action,oldValue?JSON.stringify(oldValue):null,newValue?JSON.stringify(newValue):null,JSON.stringify(details)]);
}

async function active(userId, mediaType, db=pool) { return (await db.query(`SELECT * FROM user_profile_media WHERE user_id=$1 AND media_type=$2 AND is_active=TRUE LIMIT 1`,[userId,assertMediaType(mediaType)])).rows[0] || null; }

async function replace({actor,userId,mediaType,file,visibility="portal"}) {
  if (!canManage(actor,userId)) throw httpError(403,"You cannot manage this profile media.","PROFILE_MEDIA_DENIED");
  if (!file || !ALLOWED_INPUTS.has(file.mimetype)) throw httpError(400,"Use a JPEG, PNG, or WebP image.","PROFILE_MEDIA_FORMAT_INVALID");
  const result = await processImage(file.buffer,assertMediaType(mediaType));
  await ensureDirectory();
  const storedName = `${userId}-${mediaType}-${crypto.randomUUID()}.webp`;
  const storedPath = confined(path.join(MEDIA_DIR,storedName));
  await fs.writeFile(storedPath,result.buffer,{mode:0o600,flag:"wx"});
  const client = await pool.connect();
  let previous;
  try {
    await client.query("BEGIN");
    previous = await active(userId,mediaType,client);
    const revision = Number(previous?.revision || 0) + 1;
    if (previous) await client.query(`UPDATE user_profile_media SET is_active=FALSE,removed_at=NOW(),removed_by_user_id=$2,removal_reason='replaced',updated_at=NOW() WHERE id=$1`,[previous.id,actor.id]);
    const inserted = (await client.query(`INSERT INTO user_profile_media(user_id,media_type,media_source,stored_name,stored_path,content_type,size_bytes,width,height,sha256,revision,visibility,uploaded_by_user_id) VALUES($1,$2,'upload',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,[userId,mediaType,storedName,storedPath,result.contentType,result.buffer.length,result.width,result.height,result.sha256,revision,visibility,actor.id])).rows[0];
    await writeAudit(client,actor.id,userId,previous?"profile_media_replaced":"profile_media_uploaded",previous?publicRow(previous):null,publicRow(inserted),{mediaType});
    await client.query("COMMIT");
    if (previous?.stored_path) fs.unlink(confined(previous.stored_path)).catch(()=>{});
    return publicRow(inserted);
  } catch(error) { await client.query("ROLLBACK").catch(()=>{}); await fs.unlink(storedPath).catch(()=>{}); throw error; } finally { client.release(); }
}

async function remove({actor,userId,mediaType,reason}) {
  if (!canManage(actor,userId)) throw httpError(403,"You cannot manage this profile media.","PROFILE_MEDIA_DENIED");
  const client = await pool.connect();
  let previous;
  try {
    await client.query("BEGIN");
    previous = await active(userId,mediaType,client);
    if (!previous) throw httpError(404,"Active profile media was not found.","PROFILE_MEDIA_NOT_FOUND");
    await client.query(`UPDATE user_profile_media SET is_active=FALSE,removed_at=NOW(),removed_by_user_id=$2,removal_reason=$3,updated_at=NOW() WHERE id=$1`,[previous.id,actor.id,String(reason||"Removed by user").slice(0,500)]);
    await writeAudit(client,actor.id,userId,"profile_media_removed",publicRow(previous),null,{mediaType});
    await client.query("COMMIT");
    fs.unlink(confined(previous.stored_path)).catch(()=>{});
    return {removed:true,mediaType};
  } catch(error) { await client.query("ROLLBACK").catch(()=>{}); throw error; } finally { client.release(); }
}

module.exports = { MEDIA_DIR, MAX_INPUT_BYTES, ALLOWED_INPUTS, active, publicRow, replace, remove, confined, canManage, httpError };
