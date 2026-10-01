export function errorHandler(error, _req, res, _next) {
  void _next;

  const msg = (error?.message || "").toLowerCase();
  const code = error?.code;

  // Handle missing tables gracefully (e.g., fresh database before migrations)
  const isMissingTable =
    code === "42P01" ||
    code === "ER_NO_SUCH_TABLE" ||
    code === 1146 ||
    error?.isMissingTable ||
    msg.includes("doesn't exist") ||
    msg.includes("does not exist") ||
    msg.includes("no such table") ||
    (msg.includes("relation") && msg.includes("does not exist"));

  if (isMissingTable) {
    console.warn("[Backend API] Missing table notice caught by error handler:", error.message);
    return res.status(200).json({
      status: "ok",
      fallback: true,
      message: "Database table not yet initialized. Returning empty fallback.",
      books: [],
      data: [],
      records: [],
      total: 0,
      timestamp: new Date().toISOString(),
    });
  }

  const isDbError =
    code === "DB_OFFLINE" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "PROTOCOL_CONNECTION_LOST" ||
    code === "ER_ACCESS_DENIED_ERROR" ||
    code === "HANDSHAKE_ERROR" ||
    msg.includes("database offline") ||
    msg.includes("connect econnrefused") ||
    msg.includes("connection terminated") ||
    msg.includes("connection timeout") ||
    msg.includes("password authentication failed");

  if (isDbError) {
    console.warn("[Backend API] Database unavailable notice:", error.message);
    return res.status(503).json({
      status: "degraded",
      error: "Database unavailable",
      message:
        "The database service is currently unavailable. Public routes and health checks remain operational.",
      timestamp: new Date().toISOString(),
    });
  }

  console.error("[Backend Error Handler]:", error);
  return res.status(error.status || 500).json({
    message: error.message || "Internal server error.",
  });
}
