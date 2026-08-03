const express=require("express");
const auth=require("../middleware/auth");
const allowRoles=require("../middleware/roles");
const service=require("../services/workspaces");
const {validateWorkspace}=require("../validation/workspaces");
const router=express.Router();
router.use(auth);
const manage=allowRoles("manager","admin","superadmin");
router.get("/",async(req,res,next)=>{try{return res.json(await service.listWorkspaces(req.query,req.user));}catch(error){return next(error);}});
router.post("/",manage,async(req,res,next)=>{try{const result=validateWorkspace(req.body);if(!result.valid)return res.status(400).json({error:"Workspace validation failed.",details:result.errors});return res.status(201).json(await service.createWorkspace(result.value,req));}catch(error){if(error.code==="23505")return res.status(409).json({error:"Workspace code already exists."});return next(error);}});
router.get("/:workspaceId/dashboard",async(req,res,next)=>{try{const result=await service.dashboard(req.params.workspaceId,req.user);if(!result)return res.status(404).json({error:"Workspace not found."});return res.json(result);}catch(error){return next(error);}});
router.get("/:workspaceId",async(req,res,next)=>{try{const result=await service.getWorkspace(req.params.workspaceId);if(!result)return res.status(404).json({error:"Workspace not found."});return res.json(result);}catch(error){return next(error);}});
router.put("/:workspaceId",manage,async(req,res,next)=>{try{const validation=validateWorkspace(req.body,true);if(!validation.valid)return res.status(400).json({error:"Workspace validation failed.",details:validation.errors});const result=await service.updateWorkspace(req.params.workspaceId,validation.value,req);if(!result)return res.status(404).json({error:"Workspace not found."});return res.json(result);}catch(error){return next(error);}});
for(const [action,status] of Object.entries({activate:"active",deactivate:"inactive",archive:"archived",restore:"inactive"})){router.post(`/:workspaceId/${action}`,manage,async(req,res,next)=>{try{const result=await service.transitionWorkspace(req.params.workspaceId,status,req);if(!result)return res.status(404).json({error:"Workspace not found."});return res.json(result);}catch(error){return next(error);}});}
module.exports=router;
