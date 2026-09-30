import { pbkdf2Sync, timingSafeEqual } from "node:crypto";

const PASSWORD_SALT = "bookhive-admin-salt";

export function hashAdminPassword(password: string) {
  return pbkdf2Sync(password, PASSWORD_SALT, 120000, 32, "sha256").toString("hex");
}

export function verifyAdminPassword(password: string, hashedPassword: string) {
  const incoming = Buffer.from(hashAdminPassword(password), "hex");
  const current = Buffer.from(hashedPassword, "hex");
  return incoming.length === current.length && timingSafeEqual(incoming, current);
}
