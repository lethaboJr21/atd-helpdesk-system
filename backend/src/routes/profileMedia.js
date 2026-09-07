"use strict";

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const media = require("../services/profileMedia");

const router = express.Router();
const upload = multer({ storage:multer.memoryStorage(), limits:{files:1,fileSize:media.MAX_INPUT_BYTES}, fileFilter(_request,file,callback){ callback(media.ALLOWED_INPUTS.has(file.mimetype)?null:media.httpError(400,"Use a JPEG, PNG, or WebP image.","PROFILE_MEDIA_FORMAT_INVALID"),media.ALLOWED_INPUTS.has(file.mimetype)); } });
const id = (value) => { const parsed=Number(value); return Number.isInteger(parsed)&&parsed>0?parsed:null; };

router.get("/users/:userId/:mediaType/metadata",async(request,response,next)=>{try{const userId=id(request.params.userId);if(!userId)throw media.httpError(400,"Invalid user ID.","PROFILE_MEDIA_USER_INVALID");const row=await media.active(userId,request.params.mediaType);if(row?.visibility==="private"&&!media.canManage(request.user,userId))throw media.httpError(403,"This profile media is private.","PROFILE_MEDIA_PRIVATE");return response.json({media:media.publicRow(row)});}catch(error){next(error);}});
router.get("/users/:userId/:mediaType",async(request,response,next)=>{try{const userId=id(request.params.userId);if(!userId)throw media.httpError(400,"Invalid user ID.","PROFILE_MEDIA_USER_INVALID");const row=await media.active(userId,request.params.mediaType);if(!row)throw media.httpError(404,"Profile media was not found.","PROFILE_MEDIA_NOT_FOUND");if(row.visibility==="private"&&!media.canManage(request.user,userId))throw media.httpError(403,"This profile media is private.","PROFILE_MEDIA_PRIVATE");response.set({"Content-Type":row.content_type,"Cache-Control":"private, max-age=3600","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; img-src 'self'; sandbox"});return fs.createReadStream(media.confined(row.stored_path)).on("error",next).pipe(response);}catch(error){next(error);}});
router.post("/users/:userId/:mediaType",upload.single("image"),async(request,response,next)=>{try{const userId=id(request.params.userId);if(!userId)throw media.httpError(400,"Invalid user ID.","PROFILE_MEDIA_USER_INVALID");const result=await media.replace({actor:request.user,userId,mediaType:request.params.mediaType,file:request.file,visibility:request.body.visibility});return response.status(201).json({message:"Profile media saved.",media:result});}catch(error){next(error);}});
router.delete("/users/:userId/:mediaType",async(request,response,next)=>{try{const userId=id(request.params.userId);if(!userId)throw media.httpError(400,"Invalid user ID.","PROFILE_MEDIA_USER_INVALID");return response.json(await media.remove({actor:request.user,userId,mediaType:request.params.mediaType,reason:request.body?.reason}));}catch(error){next(error);}});
router.use((error,_request,response,next)=>{if(error instanceof multer.MulterError)return response.status(400).json({code:"PROFILE_MEDIA_UPLOAD_INVALID",error:error.code==="LIMIT_FILE_SIZE"?"The image exceeds 8 MB.":error.message});if(error?.status)return response.status(error.status).json({code:error.code||"PROFILE_MEDIA_ERROR",error:error.message});return next(error);});

module.exports = router;
