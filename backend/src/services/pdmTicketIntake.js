const { normaliseWorkspaceCode } = require("./workspaceCodeRegistry");

const clean = (value, limit = 500) => String(value ?? "").trim().slice(0, limit);
const equal = (left, right) => clean(left).toLowerCase() === clean(right).toLowerCase();

function failure(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

function positiveId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function isActivePerson(person) {
  return Boolean(person);
}

function isPdmReporter(person) {
  const department = clean(person.department).toLowerCase();
  const title = clean(person.job_title).toLowerCase();
  const role = clean(person.role).toLowerCase();

  if (["admin", "superadmin"].includes(role)) return true;
  if (["pdm", "process engineering", "process engineering (pdm)"].includes(department)) {
    return title.includes("process engineer") || title.includes("supervisor") ||
      title.includes("manager") || role === "manager";
  }
  return department === "production" && title.includes("supervisor");
}

function isProductionOperator(person) {
  const title = clean(person.job_title).toLowerCase();
  return clean(person.department).toLowerCase() === "production" &&
    title.includes("operator") && !title.includes("supervisor");
}

function isProductionSupervisor(person) {
  const department = clean(person.department).toLowerCase();
  const title = clean(person.job_title).toLowerCase();
  return department === "production" && title.includes("supervisor");
}

async function activePerson(database, userId) {
  const result = await database.query(
    `SELECT id,department,job_title,role
     FROM users
     WHERE id=$1
       AND approved=TRUE
       AND status='active'
       AND archived_at IS NULL
       AND deactivated_at IS NULL
       AND COALESCE(account_type,'person')='person'
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function authorizePdmTicketIntake(database, {
  actorId,
  requesterId,
  workspace,
  ticketType,
  details,
  priority,
  category,
  subCategory,
  itemCategory,
  supervisorApproval = false,
}) {
  if (normaliseWorkspaceCode(workspace) !== "PDM") {
    return { isPdm: false, allowHigh: false, isProxy: false };
  }

  if (ticketType !== "incident") {
    throw failure(400, "PDM_INCIDENTS_ONLY", "The PDM line-issue catalogue accepts incident tickets only.");
  }

  const actor = await activePerson(database, positiveId(actorId));
  if (!isActivePerson(actor)) {
    throw failure(403, "PDM_REPORTER_INACTIVE", "Only active employee accounts may report PDM line issues.");
  }

  const selectedRequesterId = positiveId(requesterId) || positiveId(actorId);
  if (!selectedRequesterId) {
    throw failure(400, "PDM_REQUESTER_REQUIRED", "Select an active Production supervisor for this PDM report.");
  }

  const requester = selectedRequesterId === Number(actor.id)
    ? actor
    : await activePerson(database, selectedRequesterId);
  if (!isActivePerson(requester)) {
    throw failure(400, "PDM_REQUESTER_INACTIVE", "The selected PDM requester is not an active employee account.");
  }

  const isProxy = selectedRequesterId !== Number(actor.id);
  if (isProxy) {
    const reason = clean(details?.pdmSupervisorLoginUnavailableReason, 1000);
    const supervisorApprovedOperatorReport =
      supervisorApproval === true &&
      isProductionSupervisor(actor) &&
      isProductionOperator(requester);
    if (!supervisorApprovedOperatorReport && (!isProductionOperator(actor) ||
        !equal(details?.pdmSupervisorLoginUnavailable, true) ||
        reason.length < 10 ||
        clean(requester.department).toLowerCase() !== "production" ||
        !clean(requester.job_title).toLowerCase().includes("supervisor"))) {
      throw failure(403, "PDM_PROXY_REPORT_FORBIDDEN", "Only a Production operator may report for an active Production supervisor who cannot access their email account. Provide the reason.");
    }
  } else if (!isPdmReporter(actor)) {
    throw failure(403, "PDM_REPORTER_FORBIDDEN", "PDM incidents may be reported by PDM Process Engineers and managers, Production supervisors, and administrators.");
  }

  const itemId = positiveId(details?.catalogItemId || details?.catalogueItemId);
  if (!itemId) {
    throw failure(400, "PDM_CATALOGUE_ITEM_REQUIRED", "Select an item from the active PDM line-issue catalogue.");
  }

  const catalogueResult = await database.query(
    `SELECT i.id,i.category,i.sub_category,i.item_name,i.default_priority,i.priority_locked,i.default_group_id
     FROM workspace_catalogue_items i
     JOIN service_workspaces w ON w.id=i.workspace_id
     WHERE i.id=$1
       AND w.code='PDM'
       AND i.catalogue_type='incident'
       AND i.is_active=TRUE
       AND i.archived_at IS NULL
     LIMIT 1`,
    [itemId]
  );
  const item = catalogueResult.rows[0];
  if (!item ||
      !equal(category, item.category) ||
      !equal(subCategory, item.sub_category) ||
      !equal(itemCategory, item.item_name) ||
      !equal(details?.catalogItemName, item.item_name)) {
    throw failure(400, "PDM_CATALOGUE_ITEM_INVALID", "The selected issue does not match an active PDM catalogue item.");
  }

  if (item.priority_locked && !equal(priority, item.default_priority)) {
    throw failure(400, "PDM_CATALOGUE_PRIORITY_LOCKED", "Priority is fixed by the selected PDM catalogue item.");
  }

  return {
    isPdm: true,
    allowHigh: true,
    isProxy,
    defaultGroupId: item.default_group_id || null,
  };
}

module.exports = {
  authorizePdmTicketIntake,
  isPdmReporter,
  isProductionOperator,
  isProductionSupervisor,
};
