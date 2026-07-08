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
    const decoded = jwt.verify(token, env.jwtSecret);
    
    // Verify that the user still exists in the database
    const { rows } = await pool.query("SELECT id FROM users WHERE id = $1", [decoded.sub]);
    if (rows.length === 0) {
      const isDevMock = process.env.NODE_ENV !== "production" && 
                         (decoded.sub === "user-001" || decoded.sub === "user-002");
      if (!isDevMock) {
        return res.status(401).json({ message: "User account no longer exists. Please log in again." });
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
