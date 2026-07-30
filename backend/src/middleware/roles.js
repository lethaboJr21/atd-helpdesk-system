module.exports = function allowRoles(...allowedRoles) {
  const normalizedAllowedRoles = allowedRoles.map((role) => String(role).trim().toLowerCase());

  return (request, response, next) => {
    const userRole = String(request.user?.role || "").trim().toLowerCase();
    if (!userRole) return response.status(403).json({ code: "ROLE_REQUIRED", error: "No role assigned" });
    if (!normalizedAllowedRoles.includes(userRole)) {
      return response.status(403).json({ code: "ROLE_ACCESS_DENIED", error: "Access denied" });
    }
    return next();
  };
};
