import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { pool } from "../db/pool.js";

export async function authenticateToken(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Missing authorization token." });
  }

  try {
    let decoded;
    try {
      decoded = jwt.verify(token, env.jwtSecret);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        decoded = jwt.verify(token, "bookhive-dev-secret-change-me");
      } else {
        throw err;
      }
    }
    
    // Verify that the user still exists in the database
    if (decoded.sub) {
      try {
        const { rows } = await pool.query("SELECT id FROM users WHERE id = $1", [decoded.sub]);
        if (rows.length === 0) {
          const isDevMock = process.env.NODE_ENV !== "production" || 
                            (typeof decoded.sub === "string" && (decoded.sub.startsWith("user-") || decoded.sub.startsWith("LIB-") || decoded.sub.startsWith("ADM-")));
          if (!isDevMock) {
            return res.status(401).json({ message: "User account no longer exists. Please log in again." });
          }
        }
      } catch (dbErr) {
        if (process.env.NODE_ENV === "production") {
          throw dbErr;
        }
      }
    }

    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "Admin") {
    return res.status(403).json({ message: "Admin access required." });
  }

  return next();
}
