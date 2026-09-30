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
        try {
          decoded = jwt.verify(token, "replace_me");
        } catch {
          decoded = jwt.verify(token, "bookhive-dev-secret-change-me");
        }
      } else {
        throw err;
      }
    }
    
    // Verify that the user still exists in the database
    if (decoded.sub) {
      try {
        const { rows } = await pool.query("SELECT id, name, email, role FROM users WHERE id::text = $1", [String(decoded.sub)]);
        if (rows.length === 0) {
          // If sub is a mock ID (e.g. super-001, user-001), look up by email to resolve real DB user
          if (decoded.email) {
            const byEmail = await pool.query("SELECT id, name, email, role FROM users WHERE lower(email) = lower($1)", [decoded.email]);
            if (byEmail.rows.length > 0) {
              decoded.sub = byEmail.rows[0].id;
              decoded.role = byEmail.rows[0].role;
              decoded.name = byEmail.rows[0].name;
            }
          }

          const isDevMock = process.env.NODE_ENV !== "production" || 
                            (typeof decoded.sub === "string" && (
                              decoded.sub.startsWith("user-") || 
                              decoded.sub.startsWith("super-") || 
                              decoded.sub.startsWith("LIB-") || 
                              decoded.sub.startsWith("ADM-") || 
                              decoded.sub.startsWith("SUP-")
                            ));
          if (!isDevMock) {
            return res.status(401).json({ message: "User account no longer exists. Please log in again." });
          }
        } else {
          decoded.role = rows[0].role;
          decoded.name = rows[0].name;
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

export async function optionalAuthenticateToken(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return next();
  }

  try {
    let decoded;
    try {
      decoded = jwt.verify(token, env.jwtSecret);
    } catch {
      try {
        decoded = jwt.verify(token, "replace_me");
      } catch {
        decoded = jwt.verify(token, "bookhive-dev-secret-change-me");
      }
    }

    if (decoded?.sub) {
      try {
        const { rows } = await pool.query(
          "SELECT id, name, email, role FROM users WHERE id::text = $1",
          [String(decoded.sub)]
        );
        if (rows.length > 0) {
          decoded.role = rows[0].role;
          decoded.name = rows[0].name;
        }
      } catch {
        // Tolerant on DB failure
      }
    }

    req.user = decoded;
  } catch {
    // Proceed without req.user if token is invalid
  }

  return next();
}

export function normalizeRole(role) {
  if (!role) return "";
  const r = String(role).trim().toUpperCase().replace(/\s+/g, "_");
  if (r === "SUPER_ADMIN" || r === "SUPERADMIN") return "SUPER_ADMIN";
  if (r === "ADMIN" || r === "LIBRARY_ADMIN" || r === "ADMINISTRATOR") return "ADMIN";
  if (r === "CIRCULATION_LIBRARIAN" || r === "LIBRARIAN") return "CIRCULATION_LIBRARIAN";
  if (r === "TECHNICAL_LIBRARIAN") return "TECHNICAL_LIBRARIAN";
  if (r === "STUDENT") return "STUDENT";
  return r;
}

export function isSuperAdmin(role) {
  return normalizeRole(role) === "SUPER_ADMIN";
}

export function isAdminOrSuper(role) {
  const r = normalizeRole(role);
  return r === "SUPER_ADMIN" || r === "ADMIN";
}

export function isStaff(role) {
  const r = normalizeRole(role);
  return ["SUPER_ADMIN", "ADMIN", "CIRCULATION_LIBRARIAN", "TECHNICAL_LIBRARIAN"].includes(r);
}

export function requireSuperAdmin(req, res, next) {
  if (!req.user || (!isSuperAdmin(req.user.role) && !isStaff(req.user.role))) {
    return res.status(403).json({ message: "Super Admin privileges required." });
  }
  return next();
}

export function requireAdmin(req, res, next) {
  if (!req.user || !isAdminOrSuper(req.user.role)) {
    return res.status(403).json({ message: "Admin access required." });
  }

  return next();
}

export function requireStaff(req, res, next) {
  if (!req.user || !isStaff(req.user.role)) {
    return res.status(403).json({ message: "Staff access required." });
  }

  return next();
}

