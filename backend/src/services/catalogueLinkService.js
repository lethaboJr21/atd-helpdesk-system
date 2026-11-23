const ARCHIVED_ITEM_NOTICE = "This catalogue item has been archived. You can still raise a ticket using the general Other path.";

async function resolveItem(client, itemId) {
  const result = await client.query(
    `SELECT i.*,UPPER(w.code) workspace_code
     FROM workspace_catalogue_items i
     JOIN service_workspaces w ON w.id=i.workspace_id
     WHERE i.id=$1
     LIMIT 1`,
    [itemId]
  );
  const item = result.rows[0] || null;
  if (!item) return { item: null, route: "missing" };
  if (item.is_active === true && item.archived_at === null) return { item, route: "active" };
  return { item, route: "archived" };
}

async function resolveOtherItem(client, workspaceId, catalogueType) {
  const result = await client.query(
    `SELECT i.*,UPPER(w.code) workspace_code
     FROM workspace_catalogue_items i
     JOIN service_workspaces w ON w.id=i.workspace_id
     WHERE i.workspace_id=$1
       AND i.catalogue_type=$2
       AND i.is_other=TRUE
       AND i.is_active=TRUE
       AND i.archived_at IS NULL
     ORDER BY i.id
     LIMIT 1`,
    [workspaceId, catalogueType]
  );
  return result.rows[0] || null;
}

function buildSnapshot(item) {
  if (!item) return null;
  return {
    category: item.category ?? null,
    subCategory: item.sub_category ?? null,
    itemName: item.item_name ?? null,
    defaultPriority: item.default_priority ?? null,
    slaPolicyKey: item.sla_policy_key ?? null,
    defaultGroupId: item.default_group_id ?? null,
    defaultAssigneeUserId: item.default_assignee_user_id ?? null,
    snapshotAt: new Date().toISOString(),
  };
}

function resolveDefaults(item) {
  if (!item) return { priority: null, groupId: null, assigneeUserId: null, priorityLocked: false };
  return {
    priority: item.default_priority ?? null,
    groupId: item.default_group_id ?? null,
    assigneeUserId: item.default_assignee_user_id ?? null,
    priorityLocked: Boolean(item.priority_locked),
  };
}

function unlinkedOutcome(itemName) {
  return {
    linked: false,
    itemId: null,
    itemName: itemName || null,
    snapshot: null,
    defaults: resolveDefaults(null),
    otherRoute: false,
    notice: null,
  };
}

async function resolve(client, { itemId, itemName, workspaceId, catalogueType } = {}) {
  const parsedItemId = Number(itemId);
  if (!client || itemId == null || itemId === "" || !Number.isInteger(parsedItemId) || parsedItemId <= 0) {
    return unlinkedOutcome(itemName);
  }
  const { item, route } = await resolveItem(client, parsedItemId);
  if (route === "active") {
    return {
      linked: true,
      itemId: item.id,
      itemName: item.item_name,
      snapshot: buildSnapshot(item),
      defaults: resolveDefaults(item),
      otherRoute: false,
      notice: null,
    };
  }
  if (route === "archived") {
    const other = await resolveOtherItem(client, workspaceId || item.workspace_id, catalogueType || item.catalogue_type);
    if (other) {
      return {
        linked: true,
        itemId: other.id,
        itemName: other.item_name,
        snapshot: buildSnapshot(other),
        defaults: resolveDefaults(other),
        otherRoute: true,
        notice: ARCHIVED_ITEM_NOTICE,
      };
    }
  }
  return unlinkedOutcome(itemName);
}

module.exports = { resolve, resolveItem, resolveOtherItem, buildSnapshot, resolveDefaults, ARCHIVED_ITEM_NOTICE };