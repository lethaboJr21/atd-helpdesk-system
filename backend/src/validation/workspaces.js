const WORKSPACE_STATUSES = new Set(["draft", "active", "inactive", "archived"]);
const TEMPLATE_STATUSES = new Set(["draft", "published", "inactive", "archived"]);
const CONFIDENTIALITY = new Set(["standard", "restricted", "confidential"]);
const MEMBER_ROLES = new Set(["manager", "agent", "viewer"]);
const FIELD_TYPES = new Set(["short_text","long_text","number","date","datetime","select","multi_select","radio","checkbox","employee","department","location","asset","attachment","image_attachment","consent","info","section"]);

function cleanCode(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}
function validateWorkspace(input, partial = false) {
  const errors = [];
  if (!partial || input.name !== undefined) if (!String(input.name || "").trim()) errors.push("Workspace name is required.");
  if (!partial || input.code !== undefined) if (!cleanCode(input.code)) errors.push("Workspace code is required.");
  if (input.status !== undefined && !WORKSPACE_STATUSES.has(input.status)) errors.push("Invalid workspace status.");
  return { valid: errors.length === 0, errors, value: { ...input, code: input.code === undefined ? undefined : cleanCode(input.code) } };
}
function validateTemplate(input, partial = false) {
  const errors = [];
  if (!partial || input.name !== undefined) if (!String(input.name || "").trim()) errors.push("Template name is required.");
  if (!partial || input.code !== undefined) if (!cleanCode(input.code)) errors.push("Template code is required.");
  if (input.status !== undefined && !TEMPLATE_STATUSES.has(input.status)) errors.push("Invalid template status.");
  if (input.confidentiality !== undefined && !CONFIDENTIALITY.has(input.confidentiality)) errors.push("Invalid confidentiality level.");
  const fields = input.fieldSchema || input.field_schema;
  if (fields !== undefined) {
    if (!Array.isArray(fields)) errors.push("fieldSchema must be an array.");
    else fields.forEach((field, index) => { if (!FIELD_TYPES.has(field.type)) errors.push(`Unsupported field type at index ${index}.`); });
  }
  return { valid: errors.length === 0, errors, value: { ...input, code: input.code === undefined ? undefined : cleanCode(input.code) } };
}
module.exports = { WORKSPACE_STATUSES, TEMPLATE_STATUSES, CONFIDENTIALITY, MEMBER_ROLES, FIELD_TYPES, validateWorkspace, validateTemplate };
