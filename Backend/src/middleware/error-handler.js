export function errorHandler(error, _req, res, _next) {
  void _next;

  const isDbError =
    error?.code === "DB_OFFLINE" ||
    error?.code === "ECONNREFUSED" ||
    error?.code === "ETIMEDOUT" ||
    error?.code === "ENOTFOUND" ||
    error?.message?.toLowerCase().includes("database offline") ||
    error?.message?.toLowerCase().includes("connect econnrefused");

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

  console.error(error);
  return res.status(500).json({
    message: error.message || "Internal server error.",
  });
}
