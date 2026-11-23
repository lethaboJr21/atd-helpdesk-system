const GROUP_NAME = "PDM Line Support";

async function supportGroupId(database) {
  const result = await database.query(
    `SELECT id
     FROM support_groups
     WHERE LOWER(name)=LOWER($1)
       AND COALESCE(is_active,TRUE)=TRUE
     LIMIT 1`,
    [GROUP_NAME]
  );
  return result.rows[0]?.id || null;
}

async function isSupportMember(database, userId) {
  const result = await database.query(
    `SELECT 1
     FROM support_group_members member
     JOIN support_groups group_row ON group_row.id=member.group_id
     JOIN users user_row ON user_row.id=member.user_id
     WHERE member.user_id=$1
       AND LOWER(group_row.name)=LOWER($2)
       AND COALESCE(group_row.is_active,TRUE)=TRUE
       AND user_row.approved=TRUE
       AND user_row.status='active'
       AND user_row.archived_at IS NULL
       AND user_row.deactivated_at IS NULL
       AND COALESCE(user_row.account_type,'person')='person'
     LIMIT 1`,
    [userId, GROUP_NAME]
  );
  return Boolean(result.rowCount);
}

module.exports = { GROUP_NAME, supportGroupId, isSupportMember };
