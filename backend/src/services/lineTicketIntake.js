const { normaliseWorkspaceCode } = require("./workspaceCodeRegistry");

const clean = (value) => String(value ?? "").trim();
const same = (left, right) => clean(left).toLowerCase() === clean(right).toLowerCase();
const positiveId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

function failure(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

async function authorizeLineTicketIntake(database, {
  actorId,
  workspace,
  ticketType,
  details,
  category,
  subCategory,
  itemCategory,
}) {
  const actorResult = await database.query(
    `SELECT department
     FROM users
     WHERE id=$1
       AND approved=TRUE
       AND status='active'
       AND archived_at IS NULL
       AND deactivated_at IS NULL
       AND COALESCE(account_type,'person')='person'
     LIMIT 1`,
    [actorId]
  );
  const actor = actorResult.rows[0];
  if (!actor || clean(actor.department).toLowerCase() !== "production") {
    return { isLineReporter: false };
  }

  const workspaceCode = normaliseWorkspaceCode(workspace);
  if (!["IT", "PDM"].includes(workspaceCode)) {
    throw failure(
      403,
      "LINE_WORKSPACE_SCOPE_DENIED",
      "Production line users may submit only Network requests to IT or catalogue incidents to PDM."
    );
  }

  if (workspaceCode === "PDM") {
    return { isLineReporter: true, workspace: workspaceCode };
  }

  if (!["incident", "service_request"].includes(ticketType)) {
    throw failure(
      403,
      "LINE_IT_NETWORK_ONLY",
      "Production line users may submit only Network incidents or requests to IT."
    );
  }

  const itemId = positiveId(details?.catalogItemId || details?.catalogueItemId);
  if (!itemId) {
    throw failure(
      400,
      "LINE_IT_NETWORK_CATALOGUE_REQUIRED",
      "Select an active Network item from the IT catalogue."
    );
  }

  const catalogueResult = await database.query(
    `SELECT item.category,item.sub_category,item.item_name
     FROM workspace_catalogue_items item
     JOIN service_workspaces workspace ON workspace.id=item.workspace_id
     WHERE item.id=$1
       AND UPPER(workspace.code)='IT'
       AND item.catalogue_type=$2
       AND item.is_active=TRUE
       AND item.archived_at IS NULL
     LIMIT 1`,
    [itemId, ticketType]
  );
  const item = catalogueResult.rows[0];
  const selectedItemName = itemCategory || details?.catalogItemName;
  if (
    !item ||
    !/^network/i.test(clean(item.category)) ||
    !same(category, item.category) ||
    !same(subCategory, item.sub_category) ||
    !same(selectedItemName, item.item_name) ||
    !same(details?.catalogItemName, item.item_name)
  ) {
    throw failure(
      400,
      "LINE_IT_NETWORK_CATALOGUE_INVALID",
      "The selected IT item is not an active Network catalogue option."
    );
  }

  return { isLineReporter: true, workspace: workspaceCode };
}

module.exports = { authorizeLineTicketIntake };
