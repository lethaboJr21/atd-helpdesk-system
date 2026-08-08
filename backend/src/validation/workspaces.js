const WORKSPACE_STATUSES = new Set(["draft", "active", "inactive", "archived"]);
const TEMPLATE_STATUSES = new Set(["draft", "published", "inactive", "archived"]);
const CONFIDENTIALITY = new Set(["standard", "restricted", "confidential"]);
const MEMBER_ROLES = new Set(["manager", "agent", "viewer"]);
const FIELD_TYPES = new Set(["short_text","long_text","number","date","datetime","select","multi_select","radio","checkbox","employee","department","location","asset","attachment","image_attachment","consent","info","section"]);
function cleanCode(value){return String(value||"").trim().toUpperCase().replace(/[^A-Z0-9_-]/g,"");}
function cleanText(value,max=2000){const text=String(value??"").trim();return text.slice(0,max);}
function validateWorkspace(input,partial=false){const errors=[];if(!partial||input.name!==undefined){if(!cleanText(input.name,160))errors.push("Workspace name is required.");}if(!partial||input.code!==undefined){if(!cleanCode(input.code))errors.push("Workspace code is required.");}if(input.status!==undefined&&!WORKSPACE_STATUSES.has(input.status))errors.push("Invalid workspace status.");return{valid:!errors.length,errors,value:{...input,name:input.name===undefined?undefined:cleanText(input.name,160),code:input.code===undefined?undefined:cleanCode(input.code),description:input.description===undefined?undefined:cleanText(input.description,4000)}};}
function validateTemplate(input,partial=false){const errors=[];if(!partial||input.name!==undefined){if(!cleanText(input.name,160))errors.push("Template name is required.");}if(!partial||input.code!==undefined){if(!cleanCode(input.code))errors.push("Template code is required.");}if(input.status!==undefined&&!TEMPLATE_STATUSES.has(input.status))errors.push("Invalid template status.");if(input.confidentiality!==undefined&&!CONFIDENTIALITY.has(input.confidentiality))errors.push("Invalid confidentiality level.");const fields=input.fieldSchema||input.field_schema;if(fields!==undefined){if(!Array.isArray(fields))errors.push("fieldSchema must be an array.");else fields.forEach((field,index)=>{if(!FIELD_TYPES.has(field.type))errors.push(`Unsupported field type at index ${index}.`);});}return{valid:!errors.length,errors,value:{...input,code:input.code===undefined?undefined:cleanCode(input.code)}};}
function validateCategory(input, partial = false) {
  const errors = [];
  const name = input.name === undefined ? undefined : cleanText(input.name, 160);
  const code = input.code === undefined ? undefined : cleanCode(input.code);
  const description = input.description === undefined ? undefined : cleanText(input.description, 2000);
  const parentId = input.parentId === undefined ? undefined : (input.parentId || null);
  const parsedSort = input.sortOrder === undefined ? undefined : Number(input.sortOrder);
  if (!partial || input.name !== undefined) if (!name) errors.push("Category name is required.");
  if (!partial || input.code !== undefined) if (!code) errors.push("Category code is required.");
  if (parsedSort !== undefined && (!Number.isInteger(parsedSort) || parsedSort < 0 || parsedSort > 100000)) errors.push("Sort order must be a whole number between 0 and 100000.");
  if (input.isActive !== undefined && typeof input.isActive !== "boolean") errors.push("isActive must be true or false.");
  return { valid: errors.length === 0, errors, value: { name, code, description, parentId, sortOrder: parsedSort, isActive: input.isActive } };
}
function validateMember(input){const errors=[];const userId=Number(input.userId);if(!Number.isInteger(userId)||userId<=0)errors.push("A valid userId is required.");if(!MEMBER_ROLES.has(input.memberRole))errors.push("Invalid workspace member role.");return{valid:!errors.length,errors,value:{userId,memberRole:input.memberRole}};}
function validateStatusChange(input){const errors=[];if(!WORKSPACE_STATUSES.has(input.status))errors.push("Invalid target workspace status.");const reason=cleanText(input.reason,1000);if(["inactive","archived"].includes(input.status)&&!reason)errors.push("A reason is required for deactivation or archival.");return{valid:!errors.length,errors,value:{status:input.status,reason:reason||null}};}
module.exports={WORKSPACE_STATUSES,TEMPLATE_STATUSES,CONFIDENTIALITY,MEMBER_ROLES,FIELD_TYPES,validateWorkspace,validateTemplate,validateCategory,validateMember,validateStatusChange};