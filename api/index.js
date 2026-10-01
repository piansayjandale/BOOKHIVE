import app from "../Backend/src/app.js";

/**
 * Vercel Serverless Function entry point for BookHive API.
 * Safely wraps Express application invocation with top-level try/catch.
 */
export default function handler(req, res) {
  // Short-circuit /favicon.ico immediately with 204 No Content
  // to avoid invoking Express DB routes or hitting cold starts.
  if (req.url === "/favicon.ico") {
    res.statusCode = 204;
    return res.end();
  }

  try {
    return app(req, res);
  } catch (err) {
    console.error("[Vercel Serverless Invocation Error]:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          status: "error",
          app: "BOOKHIVE",
          message: "Internal serverless error caught safely.",
          error: err.message || String(err),
        })
      );
    }
  }
}
