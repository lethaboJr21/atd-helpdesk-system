# Cross-Workspace Access Management API

> **Base URL**: `/api/cross-workspace-access`
> **Authentication**: JWT token required (`auth` middleware)
> **Authorization**: Manager roles only (`manager`, `admin`, `superadmin`) for grant/revoke/list operations

## Overview

The cross-workspace access API allows workspace managers to grant time-limited exceptions that permit a user to access resources in a workspace outside their primary workspace. All access attempts are audited.

**Maximum exception duration**: 90 days (configurable via `CROSS_WORKSPACE_EXCEPTION_MAX_DAYS`).

---

## Endpoints

### List Exceptions

```
GET /api/cross-workspace-access
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `granteeUserId` | number | Filter by grantee user ID |
| `targetWorkspace` | string | Filter by target workspace code (FIN, IT, PDM, HR, FAC) |
| `activeOnly` | boolean | If `true`, return only active (non-expired, non-revoked) exceptions |
| `limit` | number | Max results (default 100, max 500) |

**Response:**
```json
{
  "exceptions": [
    {
      "id": 1,
      "grantor_user_id": 5,
      "grantee_user_id": 12,
      "target_workspace": "IT",
      "expires_at": "2026-12-15T00:00:00Z",
      "revoked_at": null,
      "reason": "Month-end reconciliation requires IT ticket access",
      "created_at": "2026-11-15T10:00:00Z",
      "grantor_name": "Bongani",
      "grantee_name": "Sarah"
    }
  ]
}
```

---

### Get Exception by ID

```
GET /api/cross-workspace-access/:id
```

**Response:** `{ "exception": { ... } }` or 404 if not found.

---

### Grant Exception

```
POST /api/cross-workspace-access
```

**Request Body:**
```json
{
  "granteeUserId": 12,
  "targetWorkspace": "IT",
  "expiresAt": "2026-12-15T00:00:00Z",
  "reason": "Month-end reconciliation requires IT ticket access"
}
```

**Response (201):**
```json
{
  "exception": {
    "id": 1,
    "grantor_user_id": 5,
    "grantee_user_id": 12,
    "target_workspace": "IT",
    "expires_at": "2026-12-15T00:00:00Z",
    "revoked_at": null,
    "reason": "Month-end reconciliation requires IT ticket access",
    "created_at": "2026-11-15T10:00:00Z"
  }
}
```

**Error Codes:**
| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `VALIDATION_ERROR` | Missing required fields |
| 400 | `EXCEPTION_EXPIRY_REQUIRED` | `expiresAt` is missing or not in the future |
| 400 | `EXCEPTION_EXPIRY_TOO_FAR` | `expiresAt` exceeds 90 days from now |

---

### Revoke Exception

```
DELETE /api/cross-workspace-access/:id
```

**Response:**
```json
{
  "exception": { ... },
  "revoked": true
}
```

After revocation, the grantee's cross-workspace access is immediately denied.

---

### Check Exception (Any Authenticated User)

```
GET /api/cross-workspace-access/check/:userId/:targetWorkspace
```

**Response (allowed):**
```json
{
  "allowed": true,
  "exception": { ... },
  "reason": "Month-end reconciliation requires IT ticket access"
}
```

**Response (denied):**
```json
{
  "allowed": false,
  "reason": "CROSS_WORKSPACE_ACCESS_DENIED"
}
```

**Denial Reasons:**
| Reason | Description |
|--------|-------------|
| `CROSS_WORKSPACE_ACCESS_DENIED` | No active exception exists |
| `CROSS_WORKSPACE_EXCEPTION_EXPIRED` | Exception has expired |
| `CROSS_WORKSPACE_EXCEPTION_REVOKED` | Exception was manually revoked |

---

## Audit Logging

Every cross-workspace access attempt is logged to `cross_workspace_access_log` with:
- User ID, source workspace, target workspace
- Resource type and ID
- Exception ID (if access was allowed)
- Timestamp and reason

If audit logging fails, access is denied (fail-closed per `AUDIT_LOG_FAILURE`).

---

## Scheduled Purge

A daily cron job (`0 2 * * *` in Africa/Johannesburg timezone) automatically revokes expired exceptions by setting `revoked_at = NOW()` where `expires_at < NOW() AND revoked_at IS NULL`.