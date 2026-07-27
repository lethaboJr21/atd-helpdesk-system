/**
 * Express error middleware for malformed JSON request bodies.
 *
 * Register this middleware after all application routes and before the
 * final generic error handler.
 */
function jsonErrorHandler(error, request, response, next) {
  const isJsonParsingError =
    error instanceof SyntaxError &&
    error.status === 400 &&
    Object.prototype.hasOwnProperty.call(error, "body");

  if (!isJsonParsingError) {
    return next(error);
  }

  console.warn("Invalid JSON request rejected:", {
    method: request.method,
    path: request.originalUrl,
    userId: request.user?.id || null,
    contentType: request.get("content-type") || null,
  });

  return response.status(400).json({
    error: "The request body contains invalid JSON.",
  });
}

module.exports = jsonErrorHandler;
