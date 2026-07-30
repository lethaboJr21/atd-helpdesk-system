const express = require("express");
const axios = require("axios");

const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");

const router = express.Router();

router.use(auth);

const OPERATIONS_ROLES = new Set([
  "agent",
  "operator",
  "manager",
  "admin",
  "superadmin",
]);

const AMS_API_URL = String(
  process.env.AMS_API_URL ||
    "https://portal.atdalliance.co.za/ams/api/helpdesk_api.php"
).trim();

const AMS_API_TOKEN = String(
  process.env.AMS_API_TOKEN || ""
).trim();

const AMS_REQUEST_TIMEOUT_MS = Math.max(
  Number.parseInt(
    process.env.AMS_REQUEST_TIMEOUT || "15000",
    10
  ) || 15000,
  1000
);

const AMS_MAX_RESPONSE_SIZE_BYTES = 10 * 1024 * 1024;

function normalizeOptionalText(value) {
  const normalizedValue = String(value || "").trim();
  return normalizedValue || undefined;
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizePositiveInteger(value) {
  const parsedValue = Number(value);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < 1
  ) {
    return null;
  }

  return parsedValue;
}

function isOperationsUser(user) {
  return OPERATIONS_ROLES.has(
    String(user?.role || "")
      .trim()
      .toLowerCase()
  );
}

function getAmsErrorDetails(error) {
  return {
    message:
      error?.message ||
      "Unknown AMS error",
    code: error?.code || null,
    status:
      error?.response?.status || null,
    upstreamError:
      error?.response?.data?.error ||
      error?.response?.data?.message ||
      null,
  };
}

function sendAmsFailureResponse(
  response,
  error,
  fallbackMessage
) {
  const details = getAmsErrorDetails(error);

  if (
    details.code === "AMS_URL_NOT_CONFIGURED" ||
    details.code === "AMS_TOKEN_NOT_CONFIGURED"
  ) {
    return response.status(503).json({
      error:
        "The Asset Management System integration is not configured.",
      code: "AMS_NOT_CONFIGURED",
    });
  }

  if (
    details.code === "ECONNABORTED" ||
    details.code === "ETIMEDOUT"
  ) {
    return response.status(504).json({
      error:
        "The Asset Management System did not respond in time.",
      code: "AMS_TIMEOUT",
    });
  }

  if (
    details.code === "ENOTFOUND" ||
    details.code === "EAI_AGAIN"
  ) {
    return response.status(502).json({
      error:
        "The Asset Management System address could not be resolved.",
      code: "AMS_DNS_FAILURE",
    });
  }

  if (details.code === "ECONNREFUSED") {
    return response.status(502).json({
      error:
        "The Asset Management System is currently unavailable.",
      code: "AMS_CONNECTION_REFUSED",
    });
  }

  if (
    details.status === 401 ||
    details.status === 403
  ) {
    return response.status(502).json({
      error:
        "The Helpdesk could not authenticate with the Asset Management System.",
      code: "AMS_AUTHENTICATION_FAILED",
    });
  }

  if (details.code === "AMS_INVALID_RESPONSE") {
    return response.status(502).json({
      error:
        "The Asset Management System returned an invalid response.",
      code: "AMS_INVALID_RESPONSE",
    });
  }

  return response.status(502).json({
    error: fallbackMessage,
    code: "AMS_REQUEST_FAILED",
  });
}

async function amsGet(params) {
  if (!AMS_API_URL) {
    const configurationError = new Error(
      "AMS_API_URL is not configured."
    );

    configurationError.code =
      "AMS_URL_NOT_CONFIGURED";

    throw configurationError;
  }

  if (!AMS_API_TOKEN) {
    const configurationError = new Error(
      "AMS_API_TOKEN is not configured in backend/.env."
    );

    configurationError.code =
      "AMS_TOKEN_NOT_CONFIGURED";

    throw configurationError;
  }

  const response = await axios.get(
    AMS_API_URL,
    {
      params,
      headers: {
        "X-AMS-Token": AMS_API_TOKEN,
        Accept: "application/json",
        "User-Agent":
          "ATD-Helpdesk-Asset-Gateway/1.0",
      },
      timeout: AMS_REQUEST_TIMEOUT_MS,
      maxContentLength:
        AMS_MAX_RESPONSE_SIZE_BYTES,
      maxBodyLength:
        AMS_MAX_RESPONSE_SIZE_BYTES,
      validateStatus(statusCode) {
        return (
          statusCode >= 200 &&
          statusCode < 300
        );
      },
    }
  );

  if (
    !response.data ||
    typeof response.data !== "object"
  ) {
    const invalidResponseError = new Error(
      "AMS returned an invalid response."
    );

    invalidResponseError.code =
      "AMS_INVALID_RESPONSE";

    throw invalidResponseError;
  }

  return response.data;
}

function assertAmsSuccess(
  data,
  fallbackMessage
) {
  if (data?.success === false) {
    const upstreamError = new Error(
      data.error ||
        data.message ||
        fallbackMessage
    );

    upstreamError.code =
      "AMS_UPSTREAM_ERROR";

    throw upstreamError;
  }
}

function extractAssets(data) {
  if (Array.isArray(data?.assets)) {
    return data.assets;
  }

  if (Array.isArray(data)) {
    return data;
  }

  return [];
}

async function getEmployeeAssets({
  email,
  name,
}) {
  const normalizedEmail =
    normalizeEmail(email);

  const normalizedName =
    normalizeOptionalText(name);

  if (!normalizedEmail && !normalizedName) {
    const identityError = new Error(
      "An employee email address or name is required."
    );

    identityError.code =
      "EMPLOYEE_IDENTITY_REQUIRED";

    throw identityError;
  }

  const data = await amsGet({
    action: "employee_assets",
    email:
      normalizedEmail || undefined,
    name: normalizedName,
  });

  assertAmsSuccess(
    data,
    "AMS could not retrieve employee assets."
  );

  return {
    employee: data.employee || null,
    assets: extractAssets(data),
  };
}

function assetMatchesId(asset, assetId) {
  return (
    Number(asset?.id) ===
    Number(assetId)
  );
}

router.get(
  "/mine",
  async (request, response) => {
    try {
      const result =
        await getEmployeeAssets({
          email: request.user.email,
          name: request.user.name,
        });

      return response.json({
        scope: "authenticated-user",
        employee: result.employee,
        assets: result.assets,
        count: result.assets.length,
      });
    } catch (error) {
      console.error(
        "AMS authenticated employee assets fetch failed:",
        {
          userId:
            request.user?.id || null,
          message: error.message,
          code: error.code || null,
          status:
            error.response?.status || null,
        }
      );

      if (
        error.code ===
        "EMPLOYEE_IDENTITY_REQUIRED"
      ) {
        return response.status(422).json({
          error:
            "Your Helpdesk account does not contain enough information to match an AMS employee record.",
          code:
            "EMPLOYEE_IDENTITY_INCOMPLETE",
        });
      }

      return sendAmsFailureResponse(
        response,
        error,
        "Failed to retrieve your assigned assets."
      );
    }
  }
);

router.get(
  "/by-user",
  async (request, response) => {
    const requestedEmail =
      normalizeEmail(
        request.query.email
      );

    const requestedName =
      normalizeOptionalText(
        request.query.name
      );

    const requestedAnotherIdentity =
      Boolean(
        requestedEmail ||
          requestedName
      );

    if (
      requestedAnotherIdentity &&
      !isOperationsUser(request.user)
    ) {
      return response.status(403).json({
        error:
          "You are not authorised to retrieve another employee's assets.",
        code:
          "EMPLOYEE_ASSET_LOOKUP_FORBIDDEN",
      });
    }

    const effectiveEmail =
      requestedAnotherIdentity
        ? requestedEmail
        : normalizeEmail(
            request.user.email
          );

    const effectiveName =
      requestedAnotherIdentity
        ? requestedName
        : normalizeOptionalText(
            request.user.name
          );

    try {
      const result =
        await getEmployeeAssets({
          email: effectiveEmail,
          name: effectiveName,
        });

      return response.json({
        scope: requestedAnotherIdentity
          ? "authorised-employee-lookup"
          : "authenticated-user",
        employee: result.employee,
        assets: result.assets,
        count: result.assets.length,
      });
    } catch (error) {
      console.error(
        "AMS employee asset lookup failed:",
        {
          userId:
            request.user?.id || null,
          requestedAnotherIdentity,
          message: error.message,
          code: error.code || null,
          status:
            error.response?.status || null,
        }
      );

      if (
        error.code ===
        "EMPLOYEE_IDENTITY_REQUIRED"
      ) {
        return response.status(422).json({
          error:
            "An employee email address or name is required.",
          code:
            "EMPLOYEE_IDENTITY_REQUIRED",
        });
      }

      return sendAmsFailureResponse(
        response,
        error,
        "Failed to retrieve employee assets."
      );
    }
  }
);

router.get(
  "/stats",
  allowRoles(
    "agent",
    "operator",
    "manager",
    "admin",
    "superadmin"
  ),
  async (request, response) => {
    try {
      const data = await amsGet({
        action: "stats",
      });

      assertAmsSuccess(
        data,
        "AMS could not retrieve asset statistics."
      );

      return response.json(data);
    } catch (error) {
      console.error(
        "AMS asset statistics fetch failed:",
        {
          userId:
            request.user?.id || null,
          ...getAmsErrorDetails(error),
        }
      );

      return sendAmsFailureResponse(
        response,
        error,
        "Failed to retrieve AMS asset statistics."
      );
    }
  }
);

router.get(
  "/",
  allowRoles(
    "agent",
    "operator",
    "manager",
    "admin",
    "superadmin"
  ),
  async (request, response) => {
    const type =
      normalizeOptionalText(
        request.query.type
      );

    const status =
      normalizeOptionalText(
        request.query.status
      );

    const search =
      normalizeOptionalText(
        request.query.q ||
          request.query.search
      );

    try {
      const data = await amsGet({
        action: "assets",
        type,
        status,
        q: search,
      });

      assertAmsSuccess(
        data,
        "AMS could not retrieve the asset register."
      );

      return response.json(
        extractAssets(data)
      );
    } catch (error) {
      console.error(
        "AMS full asset register fetch failed:",
        {
          userId:
            request.user?.id || null,
          type: type || null,
          status: status || null,
          searchSupplied:
            Boolean(search),
          ...getAmsErrorDetails(error),
        }
      );

      return sendAmsFailureResponse(
        response,
        error,
        "Failed to retrieve the AMS asset register."
      );
    }
  }
);

router.get(
  "/:id",
  async (request, response) => {
    const assetId =
      normalizePositiveInteger(
        request.params.id
      );

    if (!assetId) {
      return response.status(400).json({
        error: "Invalid asset ID.",
        code: "INVALID_ASSET_ID",
      });
    }

    try {
      if (!isOperationsUser(request.user)) {
        const employeeAssetResult =
          await getEmployeeAssets({
            email: request.user.email,
            name: request.user.name,
          });

        const assignedAsset =
          employeeAssetResult.assets.find(
            (asset) =>
              assetMatchesId(
                asset,
                assetId
              )
          );

        if (!assignedAsset) {
          return response.status(403).json({
            error:
              "You may only view details for assets assigned to your account.",
            code:
              "ASSET_DETAIL_FORBIDDEN",
          });
        }
      }

      const data = await amsGet({
        action: "asset",
        id: assetId,
      });

      assertAmsSuccess(
        data,
        "Asset not found."
      );

      if (!data.asset) {
        return response.status(404).json({
          error: "Asset not found.",
          code: "ASSET_NOT_FOUND",
        });
      }

      return response.json(data.asset);
    } catch (error) {
      console.error(
        "AMS asset detail fetch failed:",
        {
          userId:
            request.user?.id || null,
          assetId,
          operationsAccess:
            isOperationsUser(
              request.user
            ),
          ...getAmsErrorDetails(error),
        }
      );

      if (
        error.code ===
        "AMS_UPSTREAM_ERROR"
      ) {
        return response.status(404).json({
          error:
            error.message ||
            "Asset not found.",
          code: "ASSET_NOT_FOUND",
        });
      }

      return sendAmsFailureResponse(
        response,
        error,
        "Failed to retrieve the asset details."
      );
    }
  }
);

module.exports = router;
