"use strict";
const crypto=require("crypto");
const fs=require("fs");
const fsp=require("fs/promises");
const path=require("path");
const multer=require("multer");
const pool=require("../db/pool");
const ROOT=path.resolve(process.env.COMPANY_COMMUNICATION_ATTACHMENT_DIR||path.join(__dirname,"../../storage/company-communications"));
const MAX_FILES=10,MAX_FILE_BYTES=10*1024*1024;
const ALLOWED=new Set(["application/pdf","image/png","image/jpeg","image/webp","text/plain","text/csv","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.openxmlformats-officedocument.presentationml.presentation"]);
function httpError(status,message,code){const e=new Error(message);e.status=status;e.code=code;return e;}
function safeName(value){return String(value||"attachment").replace(/[\r\n"\\/]/g,"_").slice(0,240)||"attachment";}
function confined(value){const resolved=path.resolve(value);if(resolved!==ROOT&&!resolved.startsWith(`${ROOT}${path.sep}`))throw httpError(500,"Unsafe communication attachment path.","COMMUNICATION_ATTACHMENT_PATH_INVALID");return resolved;}
const upload=multer({storage:multer.memoryStorage(),limits:{files:MAX_FILES,fileSize:MAX_FILE_BYTES},fileFilter(_req,file,cb){const ok=ALLOWED.has(String(file.mimetype||"").toLowerCase());cb(ok?null:httpError(400,"Unsupported attachment type.","COMMUNICATION_ATTACHMENT_TYPE_INVALID"),ok);}}).array("attachments",MAX_FILES);
function optionalAttachments(req,res,next){if(!String(req.headers["content-type"]||"").includes("multipart/form-data"))return next();return upload(req,res,(error)=>{if(!error)return next();const message=error.code==="LIMIT_FILE_SIZE"?"Each attachment must be 10 MB or smaller.":error.message||"Attachment upload failed.";return res.status(error.status||400).json({error:message,code:error.code||"COMMUNICATION_ATTACHMENT_UPLOAD_INVALID"});});}
async function saveUploadedFiles(db,campaignId,userId,files=[]){if(!files.length)return[];await fsp.mkdir(ROOT,{recursive:true,mode:0o700});const written=[];try{for(const file of files){const storedName=`${campaignId}-${crypto.randomUUID()}`;const storedPath=confined(path.join(ROOT,storedName));await fsp.writeFile(storedPath,file.buffer,{mode:0o600,flag:"wx"});written.push(storedPath);const sha256=crypto.createHash("sha256").update(file.buffer).digest("hex");await db.query(`INSERT INTO company_communication_attachments(campaign_id,original_name,stored_name,stored_path,content_type,size_bytes,sha256,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[campaignId,safeName(file.originalname),storedName,storedPath,String(file.mimetype||"application/octet-stream"),file.size,sha256,userId]);}return list(db,campaignId);}catch(error){await Promise.all(written.map((file)=>fsp.unlink(file).catch(()=>{})));throw error;}}
async function list(db,campaignId){return(await db.query(`SELECT id,campaign_id,original_name,content_type,size_bytes,sha256,created_at FROM company_communication_attachments WHERE campaign_id=$1 ORDER BY created_at,id`,[campaignId])).rows;}
async function get(db,id){return(await db.query(`SELECT * FROM company_communication_attachments WHERE id=$1 LIMIT 1`,[id])).rows[0]||null;}
async function remove(db,id){const row=await get(db,id);if(!row)return null;await db.query(`DELETE FROM company_communication_attachments WHERE id=$1`,[id]);await fsp.unlink(confined(row.stored_path)).catch(()=>{});return row;}
async function emailAttachments(db,campaignId){const rows=(await db.query(`SELECT original_name,stored_path,content_type,size_bytes FROM company_communication_attachments WHERE campaign_id=$1 ORDER BY id`,[campaignId])).rows;return rows.map((row)=>({filename:safeName(row.original_name),path:confined(row.stored_path),contentType:row.content_type,size:row.size_bytes}));}
module.exports={ROOT,MAX_FILES,MAX_FILE_BYTES,ALLOWED,optionalAttachments,saveUploadedFiles,list,get,remove,emailAttachments,confined,safeName,fs,httpError};
