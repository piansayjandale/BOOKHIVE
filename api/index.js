if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
    }
  };
}
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData {};
}
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D {};
}

if (typeof global !== 'undefined') {
  if (!global.DOMMatrix) global.DOMMatrix = globalThis.DOMMatrix;
  if (!global.ImageData) global.ImageData = globalThis.ImageData;
  if (!global.Path2D) global.Path2D = globalThis.Path2D;
}

import "./polyfills.js";
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
