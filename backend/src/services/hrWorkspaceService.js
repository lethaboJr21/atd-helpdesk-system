const pool = require("../db/pool");
const { getUsers: getMicrosoftUsers } = require("./azureUsers");
const { clearSettingsCache, setSetting } = require("./systemSettings");

const HR_REQUEST_TYPES = new Set([
  "ad_account",
  "m365_account",
  "device_assignment",
  "employee_onboarding",
  "offboarding",
  "other",
]);
const IT_ROLES = new Set(["agent", "operator", "manager", "admin", "superadmin"]);
const ADMIN_ROLES = new Set(["admin", "superadmin"]);
const HR_APPROVAL_SETTING = "hr.manager_approval_enabled";

function httpError(status, message, code) {
  return Object.assign(new Error(message), { status, code });
}

function clean(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function positiveId(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw httpError(400, `${label} must be a valid ID.`, "HR_REQUEST_ID_INVALID");
  }
  return parsed;
}

function dateValue(value, label) {
  const date = clean(value, 10);
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw httpError(400, `${label} must be a valid calendar date.`, "HR_REQUEST_INVALID_DATE");
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw httpError(400, `${label} must be a valid calendar date.`, "HR_REQUEST_INVALID_DATE");
  }
  return date;
}

function validateRequest(input = {}) {
  const requestType = clean(input.requestType, 32);
  const employeeName = clean(input.employeeName, 160);
  const employeeEmail = clean(input.employeeEmail, 254).toLowerCase();
  const department = clean(input.department, 120);
  const jobTitle = clean(input.jobTitle, 120);
  const deviceType = clean(input.deviceType, 120);
  const employeeMicrosoftId = clean(input.employeeMicrosoftId, 128);
  const isNewHire = input.isNewHire === true || clean(input.isNewHire, 8).toLowerCase() === "true";
  const details = clean(input.details, 5000);
  const startDate = dateValue(input.startDate, "Start date");
  const effectiveDate = dateValue(input.effectiveDate, "Effective date");

  if (!HR_REQUEST_TYPES.has(requestType)) {
    throw httpError(400, "Select a valid HR service request type.", "HR_REQUEST_TYPE_INVALID");
  }
  if (employeeName.length < 2) {
    throw httpError(400, "Employee name is required.", "HR_REQUEST_EMPLOYEE_REQUIRED");
  }
  if (!department) {
    throw httpError(400, "Department is required.", "HR_REQUEST_DEPARTMENT_REQUIRED");
  }
  if (employeeEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employeeEmail)) {
    throw httpError(400, "Enter a valid employee email address.", "HR_REQUEST_EMAIL_INVALID");
  }
  if (["ad_account", "m365_account", "employee_onboarding"].includes(requestType) && !startDate) {
    throw httpError(400, "A start date is required for account setup.", "HR_REQUEST_START_DATE_REQUIRED");
  }
  if (requestType === "employee_onboarding" && !deviceType) {
    throw httpError(400, "Select a device type for the new employee.", "HR_ONBOARDING_DEVICE_REQUIRED");
  }
  if (requestType === "employee_onboarding" && !isNewHire && !employeeMicrosoftId) {
    throw httpError(400, "Select an existing Entra employee or mark this request as a new hire.", "HR_ONBOARDING_EMPLOYEE_SOURCE_REQUIRED");
  }
  if (isNewHire && employeeMicrosoftId) {
    throw httpError(400, "A new-hire request cannot include an existing Entra identity.", "HR_ONBOARDING_EMPLOYEE_SOURCE_INVALID");
  }
  if (requestType === "offboarding" && !effectiveDate) {
    throw httpError(400, "An effective date is required for offboarding.", "HR_REQUEST_EFFECTIVE_DATE_REQUIRED");
  }

  return {
    requestType,
    employeeName,
    employeeEmail: employeeEmail || null,
    department,
    jobTitle: jobTitle || null,
    employeeMicrosoftId: employeeMicrosoftId || null,
    isNewHire,
    startDate,
    effectiveDate,
    deviceType: deviceType || null,
    details,
  };
}

async function getHrAccess(user, database = pool) {
  const approvalResult = await database.query(
    "SELECT setting_value FROM system_settings WHERE setting_key=$1 LIMIT 1",
    [HR_APPROVAL_SETTING]
  );
  const managerApprovalEnabled = approvalResult.rows[0]?.setting_value === true;
  const workspaceResult = await database.query(
    "SELECT id, status FROM service_workspaces WHERE code='HR' LIMIT 1"
  );
  const workspace = workspaceResult.rows[0];
  if (!workspace) {
    throw httpError(503, "The HR workspace has not been configured.", "HR_WORKSPACE_NOT_CONFIGURED");
  }

  const memberResult = await database.query(
    `SELECT member_role FROM workspace_members
     WHERE workspace_id=$1 AND user_id=$2 AND is_active=TRUE
     LIMIT 1`,
    [workspace.id, user.id]
  );
  const memberRole = memberResult.rows[0]?.member_role || null;
  const portalRole = String(user.role || "").toLowerCase();
  const department = String(user.department || "").trim().toLowerCase();
  const isAdmin = ADMIN_ROLES.has(portalRole);
  const isItOperator = IT_ROLES.has(portalRole) && (
    isAdmin
    || ["it", "information technology", "helpdesk"].includes(department)
    || (!memberRole && !["hr", "human resources"].includes(department))
  );
  if (!memberRole && !isAdmin && !isItOperator) {
    throw httpError(403, "HR workspace membership or IT operations access is required.", "HR_WORKSPACE_ACCESS_DENIED");
  }
  return {
    workspace,
    memberRole,
    isAdmin,
    isItOperator,
    isHrMember: Boolean(memberRole) || isAdmin,
    canCreate: isAdmin || ["agent", "manager"].includes(memberRole),
    canApprove: managerApprovalEnabled && (isAdmin || memberRole === "manager"),
    canFulfill: isItOperator,
    managerApprovalEnabled,
  };
}

async function writeEvent(database, requestId, actorUserId, action, note = null) {
  await database.query(
    `INSERT INTO hr_service_request_events(request_id, actor_user_id, action, note)
     VALUES($1, $2, $3, $4)`,
    [requestId, actorUserId || null, action, note || null]
  );
}

async function bypassPendingRequests(actorUserId = null) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pending = await client.query(
      `UPDATE hr_service_requests
       SET status='approved',
           approval_note='Manager approval bypassed while the approval toggle is disabled.',
           reviewed_by_user_id=NULL,
           reviewed_at=NOW(),
           updated_at=NOW()
       WHERE status='pending_approval'
       RETURNING id`
    );
    for (const request of pending.rows) {
      await writeEvent(
        client,
        request.id,
        actorUserId,
        "approval_bypassed",
        "Manager approval disabled; request advanced to IT."
      );
    }
    await client.query("COMMIT");
    return pending.rowCount;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function setManagerApprovalEnabled(enabled, user) {
  if (!ADMIN_ROLES.has(String(user.role || "").toLowerCase())) {
    throw httpError(403, "Only administrators can change HR Manager approval.", "HR_APPROVAL_SETTING_DENIED");
  }
  if (typeof enabled !== "boolean") {
    throw httpError(400, "Approval setting must be a boolean.", "HR_APPROVAL_SETTING_INVALID");
  }

  const client = await pool.connect();
  let autoApprovedCount = 0;
  try {
    await client.query("BEGIN");
    await setSetting(HR_APPROVAL_SETTING, enabled, {
      description: "Enables HR Manager review before IT fulfillment.",
      updatedBy: user.id,
      database: client,
    });

    if (!enabled) {
      const pending = await client.query(
        `UPDATE hr_service_requests
         SET status='approved',
             approval_note='Manager approval bypassed while the approval toggle is disabled.',
             reviewed_by_user_id=NULL,
             reviewed_at=NOW(),
             updated_at=NOW()
         WHERE status='pending_approval'
         RETURNING id`
      );
      autoApprovedCount = pending.rowCount;
      for (const request of pending.rows) await writeEvent(client, request.id, user.id, "approval_bypassed", "Manager approval disabled; request advanced to IT.");
    }

    await client.query(
      `INSERT INTO administration_audit_log(actor_user_id, action, new_value)
       VALUES($1, 'hr_manager_approval_setting_updated', $2::jsonb)`,
      [user.id, JSON.stringify({ enabled, autoApprovedCount })]
    );
    await client.query("COMMIT");
    clearSettingsCache(HR_APPROVAL_SETTING);
    return { managerApprovalEnabled: enabled, autoApprovedCount };
  } catch (error) {
    await client.query("ROLLBACK");
    clearSettingsCache(HR_APPROVAL_SETTING);
    throw error;
  } finally {
    client.release();
  }
}

async function listRequests(user) {
  const access = await getHrAccess(user);
  if (!access.managerApprovalEnabled) {
    await bypassPendingRequests();
  }
  const values = [];
  let where = "";
  if (!access.isHrMember) {
    values.push(["approved", "handed_off"]);
    where = "WHERE r.status = ANY($1::varchar[])";
  }
  const result = await pool.query(
    `SELECT r.id, r.requester_user_id, requester.name AS requester_name,
            r.request_type, r.employee_name, r.employee_email, r.department,
            r.employee_microsoft_id, r.is_new_hire,
            r.job_title, r.start_date, r.effective_date, r.device_type, r.details,
            r.status, r.approval_note, r.reviewed_by_user_id, reviewer.name AS reviewer_name,
            r.reviewed_at, r.it_ticket_id, t.ticket_ref AS it_ticket_ref,
            t.status AS it_ticket_status, r.created_at, r.updated_at,
            f.ad_username, f.ad_email, f.ad_account_completed_at,
            f.m365_request_sent_at, f.m365_email, f.m365_sso_completed_at,
            f.ams_asset_id, f.ams_asset_name, f.ams_asset_tag,
            f.ams_serial_number, f.asset_allocated_at,
            f.issuance_signature_name, f.issuance_signed_at
     FROM hr_service_requests r
     JOIN users requester ON requester.id=r.requester_user_id
     LEFT JOIN users reviewer ON reviewer.id=r.reviewed_by_user_id
     LEFT JOIN tickets t ON t.id=r.it_ticket_id
     LEFT JOIN hr_onboarding_fulfillment f ON f.request_id=r.id
     ${where}
     ORDER BY CASE r.status
       WHEN 'pending_approval' THEN 0
       WHEN 'approved' THEN 1
       WHEN 'handed_off' THEN 2
       ELSE 3
     END, r.created_at DESC
     LIMIT 200`,
    values
  );
  return {
    requests: result.rows,
    access: {
      hrRole: access.memberRole,
      currentUserId: user.id,
      isHrMember: access.isHrMember,
      canCreate: access.canCreate,
      canApprove: access.canApprove,
      canFulfill: access.canFulfill,
      canManageApprovalSetting: access.isAdmin,
      managerApprovalEnabled: access.managerApprovalEnabled,
    },
  };
}

async function createRequest(input, user) {
  const access = await getHrAccess(user);
  if (!access.canCreate) {
    throw httpError(403, "Only HR workspace agents and managers can submit HR service requests.", "HR_REQUEST_CREATE_DENIED");
  }
  if (access.workspace.status !== "active") {
    throw httpError(409, "Activate the HR workspace before submitting requests.", "HR_WORKSPACE_INACTIVE");
  }
  let requestInput = { ...input };
  const employeeMicrosoftId = clean(input.employeeMicrosoftId, 128);
  if (employeeMicrosoftId) {
    const directoryUsers = await getMicrosoftUsers({ includeGuests: false, includeDisabled: false });
    const directoryUser = directoryUsers.find((employee) =>
      employee.microsoftId === employeeMicrosoftId &&
      employee.accountEnabled &&
      employee.accountType === "person"
    );
    if (!directoryUser) {
      throw httpError(400, "Select an active person from the current Entra directory.", "HR_DIRECTORY_EMPLOYEE_INVALID");
    }
    requestInput = {
      ...requestInput,
      employeeName: directoryUser.name,
      employeeEmail: directoryUser.email,
      department: directoryUser.department || input.department,
      jobTitle: directoryUser.jobTitle || input.jobTitle,
      employeeMicrosoftId,
      isNewHire: false,
    };
  }
  const request = validateRequest(requestInput);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const status = access.managerApprovalEnabled ? "pending_approval" : "approved";
    const approvalNote = access.managerApprovalEnabled
      ? null
      : "Manager approval bypassed while the approval toggle is disabled.";
    const result = await client.query(
      `INSERT INTO hr_service_requests(
         requester_user_id, request_type, employee_name, employee_email, department,
         job_title, start_date, effective_date, device_type, details,
         employee_microsoft_id, is_new_hire, status, approval_note, reviewed_at
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,CASE WHEN $13='approved' THEN NOW() ELSE NULL END)
       RETURNING *`,
      [
        user.id,
        request.requestType,
        request.employeeName,
        request.employeeEmail,
        request.department,
        request.jobTitle,
        request.startDate,
        request.effectiveDate,
        request.deviceType,
        request.details,
        request.employeeMicrosoftId,
        request.isNewHire,
        status,
        approvalNote,
      ]
    );
    if (request.requestType === "employee_onboarding") {
      await client.query(
        "INSERT INTO hr_onboarding_fulfillment(request_id) VALUES($1)",
        [result.rows[0].id]
      );
    }
    await writeEvent(client, result.rows[0].id, user.id, "submitted");
    if (!access.managerApprovalEnabled) {
      await writeEvent(
        client,
        result.rows[0].id,
        user.id,
        "approval_bypassed",
        "Manager approval is disabled; the request is available to IT."
      );
    }
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listDirectoryEmployees(user) {
  const access = await getHrAccess(user);
  if (!access.isHrMember && !access.canFulfill) {
    throw httpError(403, "HR workspace or IT operations access is required to search Entra employees.", "HR_DIRECTORY_ACCESS_DENIED");
  }
  try {
    const employees = await getMicrosoftUsers({ includeGuests: false, includeDisabled: false });
    return employees
      .filter((employee) => employee.accountEnabled && employee.accountType === "person")
      .map(({ microsoftId, name, email, department, jobTitle }) => ({
        microsoftId,
        name,
        email,
        department,
        jobTitle,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  } catch (error) {
    console.error("HR Entra employee directory fetch failed:", {
      message: error.message,
      status: error.response?.status || null,
    });
    throw httpError(502, "The Entra employee directory could not be loaded.", "HR_DIRECTORY_UNAVAILABLE");
  }
}

async function updateOnboardingStep(requestId, input, user) {
  requestId = positiveId(requestId, "Request ID");
  const access = await getHrAccess(user);
  if (!access.canFulfill) {
    throw httpError(403, "IT operations access is required to update onboarding fulfillment.", "HR_ONBOARDING_FULFILLMENT_DENIED");
  }
  const step = clean(input.step, 32).toLowerCase();
  if (!["ad_account", "m365_request", "m365_sso", "ams_asset"].includes(step)) {
    throw httpError(400, "Choose a valid onboarding fulfillment step.", "HR_ONBOARDING_STEP_INVALID");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(
      `SELECT r.*,f.*
       FROM hr_service_requests r
       JOIN hr_onboarding_fulfillment f ON f.request_id=r.id
       WHERE r.id=$1
       FOR UPDATE OF r,f`,
      [requestId]
    );
    const request = current.rows[0];
    if (!request) throw httpError(404, "Onboarding request not found.", "HR_ONBOARDING_REQUEST_NOT_FOUND");
    if (request.request_type !== "employee_onboarding" || request.status !== "handed_off" || !request.it_ticket_id) {
      throw httpError(409, "Onboarding fulfillment is available only after the approved request is linked to an IT ticket.", "HR_ONBOARDING_NOT_HANDED_OFF");
    }

    let updateSql;
    let values;
    let eventAction;
    let eventNote;
    if (step === "ad_account") {
      const username = clean(input.adUsername, 254);
      const email = clean(input.adEmail, 254).toLowerCase();
      if (!username || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw httpError(400, "Enter the created AD username and valid account email.", "HR_AD_ACCOUNT_DETAILS_REQUIRED");
      }
      if (request.ad_account_completed_at) throw httpError(409, "AD account creation is already recorded.", "HR_ONBOARDING_STEP_ALREADY_COMPLETE");
      updateSql = `UPDATE hr_onboarding_fulfillment
        SET ad_username=$2,ad_email=$3,ad_account_completed_at=NOW(),
            ad_account_completed_by_user_id=$4,updated_at=NOW()
        WHERE request_id=$1`;
      values = [requestId, username, email, user.id];
      eventAction = "ad_account_created";
      eventNote = `AD account recorded for ${email}`;
    } else if (step === "m365_request") {
      if (!request.ad_account_completed_at) throw httpError(409, "Record AD account creation before the AMS M365/SSO request.", "HR_ONBOARDING_STEP_ORDER_INVALID");
      if (request.m365_request_sent_at) throw httpError(409, "The AMS M365/SSO request is already recorded.", "HR_ONBOARDING_STEP_ALREADY_COMPLETE");
      updateSql = `UPDATE hr_onboarding_fulfillment
        SET m365_request_sent_at=NOW(),m365_request_sent_by_user_id=$2,updated_at=NOW()
        WHERE request_id=$1`;
      values = [requestId, user.id];
      eventAction = "ams_m365_request_sent";
      eventNote = "IT confirmed the M365/SSO request was sent through AMS.";
    } else if (step === "m365_sso") {
      const email = clean(input.m365Email, 254).toLowerCase();
      if (!request.m365_request_sent_at) throw httpError(409, "Record the AMS M365/SSO request before confirming account creation.", "HR_ONBOARDING_STEP_ORDER_INVALID");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw httpError(400, "Enter the created M365 account email.", "HR_M365_ACCOUNT_EMAIL_REQUIRED");
      }
      if (request.m365_sso_completed_at) throw httpError(409, "M365/SSO account creation is already recorded.", "HR_ONBOARDING_STEP_ALREADY_COMPLETE");
      updateSql = `UPDATE hr_onboarding_fulfillment
        SET m365_email=$2,m365_sso_completed_at=NOW(),
            m365_sso_completed_by_user_id=$3,updated_at=NOW()
        WHERE request_id=$1`;
      values = [requestId, email, user.id];
      eventAction = "m365_sso_created";
      eventNote = `M365/SSO account recorded for ${email}`;
    } else {
      const assetId = clean(input.assetId, 128);
      const assetName = clean(input.assetName, 200);
      const assetTag = clean(input.assetTag, 120);
      const serialNumber = clean(input.serialNumber, 160);
      if (!request.m365_sso_completed_at) throw httpError(409, "Confirm M365/SSO account creation before recording the device allocation.", "HR_ONBOARDING_STEP_ORDER_INVALID");
      if (!assetId || !assetName || !assetTag) {
        throw httpError(400, "Select an AMS asset with an asset tag before confirming allocation.", "HR_ONBOARDING_ASSET_REQUIRED");
      }
      if (request.asset_allocated_at) throw httpError(409, "AMS asset allocation is already recorded.", "HR_ONBOARDING_STEP_ALREADY_COMPLETE");
      updateSql = `UPDATE hr_onboarding_fulfillment
        SET ams_asset_id=$2,ams_asset_name=$3,ams_asset_tag=$4,ams_serial_number=$5,
            asset_allocated_at=NOW(),asset_allocated_by_user_id=$6,updated_at=NOW()
        WHERE request_id=$1`;
      values = [requestId, assetId, assetName, assetTag, serialNumber || null, user.id];
      eventAction = "ams_asset_allocated";
      eventNote = `AMS asset ${assetTag} (${assetName}) allocated.`;
    }

    await client.query(updateSql, values);
    await writeEvent(client, requestId, user.id, eventAction, eventNote);
    await client.query("COMMIT");
    return { requestId: Number(requestId), step, completedAt: new Date().toISOString() };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function saveDeviceIssuanceSignature(requestId, input, user) {
  requestId = positiveId(requestId, "Request ID");
  const access = await getHrAccess(user);
  if (!access.canFulfill) {
    throw httpError(403, "IT operations access is required to record device issuance.", "HR_ISSUANCE_SIGNOFF_DENIED");
  }
  const signerName = clean(input.signerName, 160);
  const signatureDataUrl = String(input.signatureDataUrl || "");
  if (signatureDataUrl.length > 2000000 ||
      !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(signatureDataUrl)) {
    throw httpError(400, "Capture a valid PNG signature before saving the issuance form.", "HR_ISSUANCE_SIGNATURE_INVALID");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(
      `SELECT r.employee_name,r.request_type,r.status,r.it_ticket_id,
              f.asset_allocated_at,f.issuance_signed_at
       FROM hr_service_requests r
       JOIN hr_onboarding_fulfillment f ON f.request_id=r.id
       WHERE r.id=$1
       FOR UPDATE OF r,f`,
      [requestId]
    );
    const request = current.rows[0];
    if (!request) throw httpError(404, "Onboarding request not found.", "HR_ONBOARDING_REQUEST_NOT_FOUND");
    if (request.request_type !== "employee_onboarding" || request.status !== "handed_off" || !request.it_ticket_id || !request.asset_allocated_at) {
      throw httpError(409, "The issuance form is available only after the onboarding device is allocated.", "HR_ISSUANCE_NOT_READY");
    }
    if (signerName.toLowerCase() !== clean(request.employee_name, 160).toLowerCase()) {
      throw httpError(400, "The signer name must match the employee on the issuance form.", "HR_ISSUANCE_SIGNER_MISMATCH");
    }
    if (request.issuance_signed_at) {
      throw httpError(409, "The device issuance form has already been signed.", "HR_ISSUANCE_ALREADY_SIGNED");
    }

    await client.query(
      `UPDATE hr_onboarding_fulfillment
       SET issuance_signature_name=$2,issuance_signature_data_url=$3,
           issuance_signed_at=NOW(),issuance_signed_by_user_id=$4,updated_at=NOW()
       WHERE request_id=$1`,
      [requestId, signerName, signatureDataUrl, user.id]
    );
    await writeEvent(client, requestId, user.id, "issuance_signed", `Device issuance acknowledged by ${signerName}.`);
    await client.query("COMMIT");
    return { requestId: Number(requestId), signerName, signedAt: new Date().toISOString() };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getDeviceIssuance(requestId, user) {
  requestId = positiveId(requestId, "Request ID");
  const access = await getHrAccess(user);
  if (!access.isHrMember && !access.canFulfill) {
    throw httpError(403, "HR workspace or IT operations access is required to view the issuance form.", "HR_ISSUANCE_ACCESS_DENIED");
  }
  const result = await pool.query(
    `SELECT r.id,r.employee_name,r.employee_email,r.department,r.job_title,r.start_date,
            f.m365_email,
            f.ams_asset_id,f.ams_asset_name,f.ams_asset_tag,f.ams_serial_number,
            f.issuance_signature_name,f.issuance_signature_data_url,f.issuance_signed_at
     FROM hr_service_requests r
     JOIN hr_onboarding_fulfillment f ON f.request_id=r.id
     WHERE r.id=$1 AND r.request_type='employee_onboarding'`,
    [requestId]
  );
  if (!result.rows[0]) throw httpError(404, "Device issuance form not found.", "HR_ISSUANCE_NOT_FOUND");
  return result.rows[0];
}

async function reviewRequest(requestId, decision, note, user) {
  requestId = positiveId(requestId, "Request ID");
  const access = await getHrAccess(user);
  if (!access.canApprove) {
    throw httpError(403, "HR Manager approval is required.", "HR_APPROVAL_DENIED");
  }
  const normalizedDecision = clean(decision, 16).toLowerCase();
  const approvalNote = clean(note, 2000);
  if (!["approve", "reject"].includes(normalizedDecision)) {
    throw httpError(400, "Choose approve or reject.", "HR_APPROVAL_DECISION_INVALID");
  }
  if (normalizedDecision === "reject" && !approvalNote) {
    throw httpError(400, "A reason is required to reject the request.", "HR_REJECTION_REASON_REQUIRED");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(
      "SELECT * FROM hr_service_requests WHERE id=$1 FOR UPDATE",
      [requestId]
    );
    const request = current.rows[0];
    if (!request) throw httpError(404, "HR request not found.", "HR_REQUEST_NOT_FOUND");
    if (Number(request.requester_user_id) === Number(user.id)) {
      throw httpError(403, "A requester cannot approve or reject their own request.", "HR_SELF_APPROVAL_DENIED");
    }
    if (request.status !== "pending_approval") {
      throw httpError(409, "Only pending HR requests can be reviewed.", "HR_REQUEST_ALREADY_REVIEWED");
    }

    const status = normalizedDecision === "approve" ? "approved" : "rejected";
    const result = await client.query(
      `UPDATE hr_service_requests
       SET status=$2, approval_note=$3, reviewed_by_user_id=$4,
           reviewed_at=NOW(), updated_at=NOW()
       WHERE id=$1
       RETURNING *`,
      [requestId, status, approvalNote || null, user.id]
    );
    await writeEvent(client, requestId, user.id, status, approvalNote);
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function linkItTicket(requestId, ticketId, user) {
  requestId = positiveId(requestId, "Request ID");
  ticketId = positiveId(ticketId, "Ticket ID");
  const access = await getHrAccess(user);
  if (!access.canFulfill) {
    throw httpError(403, "IT operations access is required to link a fulfillment ticket.", "HR_IT_FULFILLMENT_DENIED");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(
      "SELECT * FROM hr_service_requests WHERE id=$1 FOR UPDATE",
      [requestId]
    );
    const request = current.rows[0];
    if (!request) throw httpError(404, "HR request not found.", "HR_REQUEST_NOT_FOUND");

    if (request.it_ticket_id) {
      if (Number(request.it_ticket_id) !== Number(ticketId)) {
        throw httpError(409, "An IT ticket is already linked to this HR request.", "HR_TICKET_ALREADY_LINKED");
      }
      await client.query("COMMIT");
      return { requestId: Number(requestId), ticketId: Number(ticketId), status: request.status };
    }
    if (request.status !== "approved") {
      throw httpError(409, "Only approved HR requests can be handed to IT.", "HR_REQUEST_NOT_APPROVED");
    }

    const ticketResult = await client.query(
      `SELECT id FROM tickets
       WHERE id=$1 AND workspace='IT' AND ticket_type='service_request'
         AND request_details->>'hrServiceRequestId'=$2
       LIMIT 1`,
      [ticketId, String(requestId)]
    );
    if (!ticketResult.rows[0]) {
      throw httpError(400, "The IT ticket must reference this approved HR request.", "HR_TICKET_LINK_INVALID");
    }

    await client.query(
      `UPDATE hr_service_requests
       SET it_ticket_id=$2, status='handed_off', updated_at=NOW()
       WHERE id=$1`,
      [requestId, ticketId]
    );
    await writeEvent(client, requestId, user.id, "handed_off", `IT ticket #${ticketId}`);
    await client.query("COMMIT");
    return { requestId: Number(requestId), ticketId: Number(ticketId), status: "handed_off" };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  validateRequest,
  getHrAccess,
  setManagerApprovalEnabled,
  listRequests,
  listDirectoryEmployees,
  createRequest,
  updateOnboardingStep,
  saveDeviceIssuanceSignature,
  getDeviceIssuance,
  reviewRequest,
  linkItTicket,
};
