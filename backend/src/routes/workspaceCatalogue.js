const express = require("express");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const pool = require("../db/pool");
const router = express.Router();
router.use(auth);
const manage = allowRoles("admin","superadmin");
const clean = (value, max = 4000) => String(value ?? "").trim().slice(0,max);
const validTypes = new Set(["incident","service_request"]);
const validPriorities = new Set(["Low","Medium","High","Critical"]);
const workspaceUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validWorkspaceId(value) {
  const workspaceId = clean(value, 80);

  return workspaceUuidPattern.test(workspaceId)
    ? workspaceId
    : null;
}
function normalize(body = {}) {
          const catalogueType = clean(body.catalogueType || body.catalogue_type,30).toLowerCase();
          const defaultPriority = clean(body.defaultPriority || body.default_priority || "Medium",20);
          if (!validTypes.has(catalogueType))
            throw Object.assign(new Error("Catalogue type must be incident or service_request."),{status:400});
          if (!validPriorities.has(defaultPriority)) throw Object.assign(new Error("Default priority is invalid."),{status:400});
          const item = {
           workspaceId: validWorkspaceId(
             body.workspaceId || body.workspace_id
           ),
           catalogueType,


            category: clean(body.category,160), subCategory: clean(body.subCategory || body.sub_category,180) || null,
            itemName: clean(body.itemName || body.item_name,200), userDescription: clean(body.userDescription || body.user_description),
            internalGuidance: clean(body.internalGuidance || body.internal_guidance), iconKey: clean(body.iconKey || body.icon_key,80) || null,
            colourKey: clean(body.colourKey || body.colour_key,40) || null, defaultPriority,
            priorityLocked: Boolean(body.priorityLocked ?? body.priority_locked), summaryLocked: Boolean(body.summaryLocked ?? body.summary_locked),
            defaultSummary: clean(body.defaultSummary || body.default_summary,500) || null,
            descriptionTemplate: clean(body.descriptionTemplate || body.description_template) || null,
            defaultImpact: clean(body.defaultImpact || body.default_impact,20) || null,
            defaultUrgency: clean(body.defaultUrgency || body.default_urgency,20) || null,
            slaPolicyKey: clean(body.slaPolicyKey || body.sla_policy_key,120) || null,
            defaultGroupId: Number(body.defaultGroupId || body.default_group_id) || null,
            defaultAssigneeUserId: Number(body.defaultAssigneeUserId || body.default_assignee_user_id) || null,
            requiredFields: Array.isArray(body.requiredFields) ? body.requiredFields : [], optionalFields: Array.isArray(body.optionalFields) ? body.optionalFields : [],
            visibility: body.visibility && typeof body.visibility === "object" ? body.visibility : {employee:true,operations:true,plant:false,workspace:true},
            displayOrder: Number(body.displayOrder || body.display_order) || 0, isOther: Boolean(body.isOther ?? body.is_other), isActive: body.isActive === undefined ? true : Boolean(body.isActive)
          };
          if (!item.workspaceId) {
              throw Object.assign(
                new Error("A valid workspace is required."),
                {
                  status: 400,
                  code: "INVALID_WORKSPACE_ID",
                }
              );
            }

            if (!item.category || !item.itemName) {
              throw Object.assign(
                new Error("Category and item name are required."),
                {
                  status: 400,
                }
              );
            }
          if (item.isOther) {
            item.itemName = "Other";
            item.priorityLocked = false;
            item.summaryLocked = false;
            item.defaultSummary = null;
            item.descriptionTemplate = null;
          }
          return item;
        }
async function history(db,item,action,reason,oldValue,newValue,userId){
  await db.query(`
    INSERT INTO workspace_catalogue_item_history(
    item_id,
    workspace_id,
    catalogue_type,
    action,
    reason,
    old_value,
    new_value,
    actor_user_id
    )
    VALUES
     ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8)`,
         [item?.id||
          null,item?.workspace_id||
          newValue?.workspace_id||
          null,item?.catalogue_type||
          newValue?.catalogue_type||
          null,action,reason||
          null,oldValue?JSON.stringify(oldValue):
          null,newValue?JSON.stringify(newValue):
          null,userId
        ])
    ;}
router.get("/items",async(req,res,next)=>{
      try{
        const values=[];
        const where=["i.archived_at IS NULL"];

        if(req.query.workspaceId){
          const selectedWorkspaceId = validWorkspaceId(req.query.workspaceId);

        if (!selectedWorkspaceId) {

          return res.status(400).json({
            error: "A valid workspaceId is required.",
                  code: "INVALID_WORKSPACE_ID",
          });
      }

values.push(selectedWorkspaceId);
where.push(`i.workspace_id=$${values.length}`);}

if(req.query.catalogueType){
  values.push(clean(req.query.catalogueType,30));
  where.push(`i.catalogue_type=$${values.length}`);}
const requestedEntry=clean(req.query.entry,20).toLowerCase();
const validEntry=["employee","operations","plant","workspace"].includes(requestedEntry)?requestedEntry:"workspace";
values.push(validEntry);
where.push(`i.visibility->>$${values.length}='true'`);
  const r=await pool.query(`
    SELECT i.*,
    w.name workspace_name,
    w.code workspace_code,
    g.name default_group_name,
    u.name default_assignee_name
    FROM workspace_catalogue_items i
    JOIN service_workspaces w
    ON w.id=i.workspace_id
    LEFT JOIN support_groups g
    ON g.id=i.default_group_id
    LEFT JOIN users u
    ON u.id=i.default_assignee_user_id
    WHERE ${where.join(" AND ")}
    ORDER BY w.name,
    i.catalogue_type,
    i.category,
    i.sub_category
    NULLS FIRST,
    i.display_order,
    i.item_name`,
    values);
    res.json({items:r.rows});}
    catch(e){next(e);}});

router.get("/items/:id/history",manage,async(req,res,next)=>{
  try{const r=await pool.query(`
    SELECT h.*,u.name actor_name
    FROM workspace_catalogue_item_history h
    LEFT JOIN users u
    ON u.id=h.actor_user_id
    WHERE h.item_id=$1
    ORDER BY h.created_at DESC`,
    [req.params.id]);
    res.json({history:r.rows});}
  catch(e){next(e);}});

router.get("/items/:id/tickets",manage,async(req,res,next)=>{
  try{
    const itemId=Number(req.params.id);
    if(!Number.isInteger(itemId)||itemId<=0)return res.status(400).json({error:"A valid catalogue item id is required."});
    const page=Math.max(1,Number(req.query.page)||1);
    let limit=Number(req.query.limit);
    if(!Number.isFinite(limit)||limit<1||limit>50)limit=50;
    const name=clean(req.query.name,200);
    const item=await pool.query(`SELECT workspace_id FROM workspace_catalogue_items WHERE id=$1`,[itemId]);
    if(!item.rowCount)return res.status(404).json({error:"Catalogue item not found."});
    const offset=(page-1)*limit;
    let rows,total;
    if(name){
      const like=`%${name.replace(/\\/g,"\\\\").replace(/[%_]/g,"\\$&")}%`;
      const workspaceCode=await pool.query(`SELECT UPPER(w.code) code FROM service_workspaces w WHERE w.id=$1`,[item.rows[0].workspace_id]);
      const code=workspaceCode.rows[0]?.code||null;
      total=await pool.query(`SELECT COUNT(*)::int total FROM tickets WHERE workspace=$1 AND catalogue_item_name ILIKE $2`,[code,like]);
      rows=await pool.query(`SELECT id,ticket_ref,title,status,priority,workspace,created_at,catalogue_item_id,catalogue_item_name FROM tickets WHERE workspace=$1 AND catalogue_item_name ILIKE $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,[code,like,limit,offset]);
    }else{
      total=await pool.query(`SELECT COUNT(*)::int total FROM tickets WHERE catalogue_item_id=$1`,[itemId]);
      rows=await pool.query(`SELECT id,ticket_ref,title,status,priority,workspace,created_at,catalogue_item_id,catalogue_item_name FROM tickets WHERE catalogue_item_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,[itemId,limit,offset]);
    }
    res.json({tickets:rows.rows,total:total.rows[0].total,page,limit});
  }
  catch(e){next(e);}
});

router.delete("/items/:id",manage,async(req,res,next)=>{
  const db=await pool.connect();
  try{
    await db.query("BEGIN");
    const before=await db.query(`SELECT * FROM workspace_catalogue_items WHERE id=$1 FOR UPDATE`,[req.params.id]);
    if(!before.rowCount){await db.query("ROLLBACK");return res.status(404).json({error:"Catalogue item not found."});}
    const refs=await db.query(`SELECT COUNT(*)::int total FROM tickets WHERE catalogue_item_id=$1`,[req.params.id]);
    const referencedBy=refs.rows[0].total;
    if(referencedBy>0){
      await db.query("ROLLBACK");
      return res.status(409).json({error:`This catalogue item is referenced by ${referencedBy} tickets. Archive it instead.`,referencedBy});
    }
    await history(db,before.rows[0],"deleted",clean(req.body?.reason),before.rows[0],null,req.user.id);
    await db.query(`DELETE FROM workspace_catalogue_items WHERE id=$1`,[req.params.id]);
    await db.query("COMMIT");
    res.status(204).send();
  }
  catch(e){await db.query("ROLLBACK").catch(()=>{});next(e);}
  finally{db.release();}
});

router.post("/items",manage,async(req,res,next)=>{
  const db=await pool.connect();
  try{
    const x=normalize(req.body);
    await db.query("BEGIN");
    const r=await db.query(`
      INSERT INTO workspace_catalogue_items(
      workspace_id,
      catalogue_type,
      category,
      sub_category,
      item_name,
      user_description,
      internal_guidance,
      icon_key,
      colour_key,
      default_priority,
      priority_locked,
      summary_locked,
      default_summary,
      description_template,
      default_impact,
      default_urgency,
      sla_policy_key,
      default_group_id,
      default_assignee_user_id,
      required_fields,
      optional_fields,
      visibility,
      display_order,
      is_other,
      is_active,
      created_by,
      updated_by
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21::jsonb,$22::jsonb,$23,$24,$25,$26,$26)
      RETURNING *`,
      [x.workspaceId,x.catalogueType,x.category,x.subCategory,x.itemName,x.userDescription,x.internalGuidance,x.iconKey,x.colourKey,x.defaultPriority,x.priorityLocked,x.summaryLocked,x.defaultSummary,x.descriptionTemplate,x.defaultImpact,x.defaultUrgency,x.slaPolicyKey,x.defaultGroupId,x.defaultAssigneeUserId,JSON.stringify(x.requiredFields),JSON.stringify(x.optionalFields),JSON.stringify(x.visibility),x.displayOrder,x.isOther,x.isActive,req.user.id]);
      await history(db,r.rows[0],"created",clean(req.body.reason),null,r.rows[0],req.user.id);
      await db.query("COMMIT");
      res.status(201).json(r.rows[0]);}
      catch(e){await db.query("ROLLBACK").catch(()=>{});next(e);
      }finally
      {db.release();
      }
    });

router.put("/items/:id",manage,async(req,res,next)=>{const db=await pool.connect();try{const x=normalize(req.body);await db.query("BEGIN");const before=await db.query(`SELECT * FROM workspace_catalogue_items WHERE id=$1 FOR UPDATE`,[req.params.id]);if(!before.rowCount){await db.query("ROLLBACK");return res.status(404).json({error:"Catalogue item not found."});}const r=await db.query(`UPDATE workspace_catalogue_items SET workspace_id=$2,catalogue_type=$3,category=$4,sub_category=$5,item_name=$6,user_description=$7,internal_guidance=$8,icon_key=$9,colour_key=$10,default_priority=$11,priority_locked=$12,summary_locked=$13,default_summary=$14,description_template=$15,default_impact=$16,default_urgency=$17,sla_policy_key=$18,default_group_id=$19,default_assignee_user_id=$20,required_fields=$21::jsonb,optional_fields=$22::jsonb,visibility=$23::jsonb,display_order=$24,is_other=$25,is_active=$26,updated_by=$27,updated_at=NOW() WHERE id=$1 RETURNING *`,[req.params.id,x.workspaceId,x.catalogueType,x.category,x.subCategory,x.itemName,x.userDescription,x.internalGuidance,x.iconKey,x.colourKey,x.defaultPriority,x.priorityLocked,x.summaryLocked,x.defaultSummary,x.descriptionTemplate,x.defaultImpact,x.defaultUrgency,x.slaPolicyKey,x.defaultGroupId,x.defaultAssigneeUserId,JSON.stringify(x.requiredFields),JSON.stringify(x.optionalFields),JSON.stringify(x.visibility),x.displayOrder,x.isOther,x.isActive,req.user.id]);await history(db,r.rows[0],"updated",clean(req.body.reason),before.rows[0],r.rows[0],req.user.id);await db.query("COMMIT");res.json(r.rows[0]);}catch(e){await db.query("ROLLBACK").catch(()=>{});next(e);}finally{db.release();}});
router.post("/items/:id/duplicate",manage,async(req,res,next)=>{try{const source=await pool.query(`SELECT * FROM workspace_catalogue_items WHERE id=$1 AND archived_at IS NULL`,[req.params.id]);if(!source.rowCount)return res.status(404).json({error:"Catalogue item not found."});const s=source.rows[0];const r=await pool.query(`INSERT INTO workspace_catalogue_items(workspace_id,catalogue_type,category,sub_category,item_name,user_description,internal_guidance,icon_key,colour_key,default_priority,priority_locked,summary_locked,default_summary,description_template,default_impact,default_urgency,sla_policy_key,default_group_id,default_assignee_user_id,required_fields,optional_fields,visibility,display_order,is_other,is_active,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,FALSE,FALSE,$24,$24) RETURNING *`,[s.workspace_id,s.catalogue_type,s.category,s.sub_category,`${s.item_name} Copy`,s.user_description,s.internal_guidance,s.icon_key,s.colour_key,s.default_priority,s.priority_locked,s.summary_locked,s.default_summary,s.description_template,s.default_impact,s.default_urgency,s.sla_policy_key,s.default_group_id,s.default_assignee_user_id,s.required_fields,s.optional_fields,s.visibility,s.display_order+1,req.user.id]);res.status(201).json(r.rows[0]);}catch(e){next(e);}});
router.patch("/items/:id/status",manage,async(req,res,next)=>{try{const action=clean(req.body.action,20);const clause=action==="archive"?"archived_at=NOW(),is_active=FALSE":action==="activate"?"archived_at=NULL,is_active=TRUE":"is_active=FALSE";const before=await pool.query(`SELECT * FROM workspace_catalogue_items WHERE id=$1`,[req.params.id]);if(!before.rowCount)return res.status(404).json({error:"Catalogue item not found."});const r=await pool.query(`UPDATE workspace_catalogue_items SET ${clause},updated_by=$2,updated_at=NOW() WHERE id=$1 RETURNING *`,[req.params.id,req.user.id]);await history(pool,r.rows[0],action,clean(req.body.reason),before.rows[0],r.rows[0],req.user.id);res.json(r.rows[0]);}catch(e){next(e);}});
router.post(
  "/ensure-other",
  manage,
  async (req, res, next) => {
    try {
      const workspaceId = validWorkspaceId(req.body.workspaceId);
      const catalogueType = clean(req.body.catalogueType, 30);
      if (!workspaceId || !validTypes.has(catalogueType)) {
        return res.status(400).json({ error: "Workspace and catalogue type are required.", code: !workspaceId ? "INVALID_WORKSPACE_ID" : "CATALOGUE_FIELDS_REQUIRED" });
      }
      // SINGLE_CATALOGUE_OTHER_GOVERNANCE: one Other record for the whole catalogue.
      const result = await pool.query(`
        INSERT INTO workspace_catalogue_items(
          workspace_id,catalogue_type,category,sub_category,item_name,
          default_priority,priority_locked,summary_locked,is_other,is_active,
          display_order,created_by,updated_by
        ) VALUES($1,$2,'Other',NULL,'Other','Medium',FALSE,FALSE,TRUE,TRUE,999,$3,$3)
        ON CONFLICT(workspace_id,catalogue_type,category,sub_category,item_name)
        DO UPDATE SET is_other=TRUE,is_active=TRUE,archived_at=NULL,priority_locked=FALSE,summary_locked=FALSE,updated_by=EXCLUDED.updated_by,updated_at=NOW()
        RETURNING *`,[workspaceId,catalogueType,req.user.id]);
      const ensured=result.rows[0];
      await pool.query(`UPDATE workspace_catalogue_items SET is_active=FALSE,archived_at=COALESCE(archived_at,NOW()),updated_at=NOW()
        WHERE workspace_id=$1 AND catalogue_type=$2 AND is_other=TRUE AND archived_at IS NULL AND id<>$3`,[workspaceId,catalogueType,ensured.id]);
      return res.json(ensured);
    } catch (error) { return next(error); }
  }
);
router.get("/request-options",async(req,res,next)=>{try{
  const requestedId=String(req.query.workspaceId || "").trim();
  const requestedWorkspace=clean(req.query.workspace || req.query.workspaceCode || req.query.workspaceName,160);
  const type=clean(req.query.catalogueType,30);
  if(!validTypes.has(type))return res.status(400).json({error:"A valid catalogueType is required."});
  let workspaceId=workspaceUuidPattern.test(requestedId)?requestedId:null;
  if(!workspaceId&&requestedWorkspace){
    const normalized=requestedWorkspace.toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g," ").replace(/\b(service request|service requests|request service|helpdesk)\b/g," ").replace(/\s+/g," ").trim();
    const candidates=await pool.query("SELECT id,code,name,status FROM service_workspaces WHERE LOWER(COALESCE(status,'draft')) NOT IN ('archived','disabled','inactive') ORDER BY CASE WHEN UPPER(code)='IT' THEN 0 ELSE 1 END,name");
    const norm=v=>String(v||"").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g," ").replace(/\b(service request|service requests|request service|helpdesk)\b/g," ").replace(/\s+/g," ").trim();
    const found=candidates.rows.find(row=>[row.code,row.name].some(v=>norm(v)===normalized)) || candidates.rows.find(row=>[row.code,row.name].some(v=>{const n=norm(v);return normalized&&(n.startsWith(normalized+" ")||normalized.startsWith(n+" "));}));
    workspaceId=found?.id||null;
  }
  if(!workspaceId)return res.status(400).json({code:"WORKSPACE_CATALOGUE_WORKSPACE_NOT_FOUND",error:"The request workspace could not be resolved to an active managed workspace."});
  const requestedEntry=clean(req.query.entry,20).toLowerCase();
  const validEntry=["employee","operations","plant","workspace"].includes(requestedEntry)?requestedEntry:"workspace";
  const r=await pool.query(`SELECT id,workspace_id,catalogue_type,category,sub_category,item_name,user_description,icon_key,colour_key,default_priority,priority_locked,summary_locked,default_summary,description_template,default_impact,default_urgency,sla_policy_key,default_group_id,required_fields,optional_fields,visibility,is_other,display_order FROM workspace_catalogue_items WHERE workspace_id=$1 AND catalogue_type=$2 AND is_active=TRUE AND archived_at IS NULL AND visibility->>$3='true' ORDER BY category,sub_category NULLS FIRST,display_order,item_name`,[workspaceId,type,validEntry]);
  res.json({workspaceId,items:r.rows});
}catch(e){next(e);}});
module.exports = router;
